"""Tests for server.py, ssh_bridge.py and the check agent. Standard library only.

Run:  python -m unittest discover -s tests -v      (or: npm run test:py)

The server tests start a copy of server.py in a temporary folder, so they never
touch your data/ folder. The agent TLS test needs the openssl command and is
skipped without it.
"""

import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
# LABTRACER_AGENT_DIR: test a different copy of the agent (for example an older version)
AGENT_DIR = Path(os.environ.get("LABTRACER_AGENT_DIR") or ROOT / "agent")
sys.path.insert(0, str(AGENT_DIR))
import labtracer_agent as agent  # noqa: E402


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for_port(port, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(f"nothing listens on port {port}")


def stop(proc):
    proc.terminate()
    try:
        proc.wait(5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(5)


class ServerTest(unittest.TestCase):
    """server.py in a temporary copy of the app."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="labtracer-test-"))
        for f in ("server.py", "ssh_bridge.py"):
            shutil.copy2(ROOT / f, cls.tmp / f)
        shutil.copytree(ROOT / "app", cls.tmp / "app")
        cls.port = free_port()
        cls.proc = subprocess.Popen([sys.executable, "server.py", "--port", str(cls.port), "--no-browser"],
                                    cwd=cls.tmp, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        wait_for_port(cls.port)
        cls.base = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        stop(cls.proc)
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def req(self, method, path, body=None, headers=None):
        """(status, headers, parsed JSON or None)"""
        data = None if body is None else json.dumps(body).encode()
        r = urllib.request.Request(self.base + path, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(r, timeout=5) as res:
                raw = res.read()
                return res.status, res.headers, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                doc = json.loads(raw) if raw else None
            except ValueError:
                doc = None
            return e.code, e.headers, doc

    def put_lab(self, name, base=None, force=False, doc=None):
        h = {"X-LabTracer": "1", "Content-Type": "application/json"}
        if base is not None:
            h["X-LabTracer-Base"] = base
        if force:
            h["X-LabTracer-Force"] = "1"
        return self.req("PUT", f"/api/labs/{name}", doc or {"devices": []}, h)

    # ---- guards
    def test_serves_app_and_ping(self):
        self.assertEqual(self.req("GET", "/api/ping")[0], 200)
        with urllib.request.urlopen(self.base + "/", timeout=5) as r:
            self.assertIn(b"LabTracer", r.read())

    def test_foreign_host_refused(self):
        self.assertEqual(self.req("GET", "/api/labs", headers={"Host": "evil.example"})[0], 403)

    def test_write_needs_header(self):
        self.assertEqual(self.req("PUT", "/api/library", {"templates": []})[0], 403)

    def test_preflight_refused(self):
        self.assertEqual(self.req("OPTIONS", "/api/library")[0], 403)

    def test_no_path_traversal(self):
        self.assertEqual(self.req("GET", "/api/labs/..%2F..%2Fserver")[0], 404)

    # ---- save conflicts between two windows
    def test_save_conflict(self):
        name = "conflict-test"
        st, _, doc = self.put_lab(name, base="new")
        self.assertEqual(st, 200)
        st, hdrs, _ = self.req("GET", f"/api/labs/{name}")
        v1 = hdrs["X-LabTracer-Version"]
        self.assertEqual(v1, doc["version"])

        self.assertEqual(self.put_lab(name, base=v1)[0], 200)                 # window A saves
        st, _, doc = self.put_lab(name, base=v1)                              # window B is stale
        self.assertEqual(st, 409)
        self.assertTrue(doc["conflict"])
        self.assertEqual(self.put_lab(name, base="new")[0], 409)             # "new" over an existing lab
        self.assertEqual(self.put_lab(name, base=v1, force=True)[0], 200)    # replace on purpose
        self.assertEqual(self.put_lab(name)[0], 200)                         # old client: no header

        hist = list((self.tmp / "data" / "labs" / ".history").glob(f"{name}.*.json"))
        self.assertGreaterEqual(len(hist), 1, "a forced save keeps a history copy")

    def test_lab_must_be_a_lab(self):
        self.assertEqual(self.req("PUT", "/api/labs/x", {"nope": 1}, {"X-LabTracer": "1"})[0], 400)


class SshBridgeTest(unittest.TestCase):
    def test_paramiko_not_loaded_at_import(self):
        code = ("import sys; sys.path.insert(0, sys.argv[1]); import ssh_bridge; "
                "print('paramiko' in sys.modules)")
        out = subprocess.run([sys.executable, "-c", code, str(ROOT)], capture_output=True, text=True, check=True)
        self.assertEqual(out.stdout.strip(), "False", "server.py should start without loading paramiko")


class AgentTest(unittest.TestCase):
    def test_clean_targets_drops_unknown_checks(self):
        t = agent.clean_targets([{"id": "a", "name": "x", "checks": [
            {"type": "ping", "host": "10.0.0.1"},
            {"type": "tcp", "host": "10.0.0.1", "port": 22},
            {"type": "exec", "host": "10.0.0.1", "cmd": "rm -rf /"},
            {"type": "ping", "host": "-oProxyCommand=x"},
            {"type": "tcp", "host": "10.0.0.1", "port": 70000},
        ]}])
        self.assertEqual([c["type"] for c in t[0]["checks"]], ["ping", "tcp"])

    def _fake_ping(self, stdout, code=0):
        return mock.patch.object(agent.subprocess, "run", return_value=subprocess.CompletedProcess([], code, stdout, b""))

    def test_windows_unreachable_reply_is_down(self):
        out = b"Reply from 192.168.1.1: Destination host unreachable.\r\n"
        with mock.patch.object(agent.os, "name", "nt"), self._fake_ping(out):
            ok, ms, err = agent._ping_binary("192.168.1.50", 1.0)
        self.assertFalse(ok)
        self.assertEqual(err, "unreachable")

    def test_windows_echo_reply_is_up(self):
        out = b"Reply from 192.168.1.50: bytes=32 time=3ms TTL=64\r\n"
        with mock.patch.object(agent.os, "name", "nt"), self._fake_ping(out):
            ok, ms, _ = agent._ping_binary("192.168.1.50", 1.0)
        self.assertTrue(ok)
        self.assertEqual(ms, 3.0)

    def test_windows_ipv6_reply_has_no_ttl(self):
        out = b"Reply from ::1: time<1ms \r\n"
        with mock.patch.object(agent.os, "name", "nt"), self._fake_ping(out):
            ok, _, _ = agent._ping_binary("::1", 1.0)
        self.assertTrue(ok)

    @unittest.skipUnless(shutil.which("openssl"), "needs the openssl command to make a test certificate")
    def test_tls_agent_not_blocked_by_silent_client(self):
        tmp = Path(tempfile.mkdtemp(prefix="labtracer-agent-"))
        try:
            subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(tmp / "k.pem"),
                            "-out", str(tmp / "c.pem"), "-days", "1", "-subj", "/CN=localhost"],
                           check=True, capture_output=True)
            port = free_port()
            (tmp / "a.json").write_text(json.dumps({"port": port, "tls_cert": str(tmp / "c.pem"), "tls_key": str(tmp / "k.pem")}))
            proc = subprocess.Popen([sys.executable, str(AGENT_DIR / "labtracer_agent.py"), "--config", str(tmp / "a.json"),
                                     "--state-dir", str(tmp)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                wait_for_port(port)
                idle = socket.create_connection(("127.0.0.1", port))  # connects, never starts TLS
                try:
                    time.sleep(0.3)
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    with urllib.request.urlopen(f"https://127.0.0.1:{port}/health", timeout=4, context=ctx) as r:
                        self.assertEqual(json.loads(r.read()), {"ok": True})
                finally:
                    idle.close()
            finally:
                stop(proc)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
