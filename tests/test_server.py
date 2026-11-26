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
import threading
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
        shutil.copytree(ROOT / "collector", cls.tmp / "collector", ignore=shutil.ignore_patterns("__pycache__"))
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

    # ---- format versions
    def history_of(self, name):
        return list((self.tmp / "data" / "labs" / ".history").glob(f"{name}.*.json"))

    def test_keep_copy_after_a_format_upgrade(self):
        name = "upgrade-test"
        self.assertEqual(self.put_lab(name, doc={"devices": [], "version": 1})[0], 200)
        before = len(self.history_of(name))
        h = {"X-LabTracer": "1", "X-LabTracer-Keep-Copy": "1"}
        st, _, _ = self.req("PUT", f"/api/labs/{name}", {"devices": [], "version": 2}, h)
        self.assertEqual(st, 200)
        self.assertEqual(len(self.history_of(name)), before + 1, "the old format is kept in .history")

    def test_newer_format_is_never_overwritten(self):
        name = "newer-test"
        self.assertEqual(self.put_lab(name, doc={"devices": [], "version": 3})[0], 200)
        for force in (False, True):
            st, _, doc = self.put_lab(name, force=force, doc={"devices": [], "version": 2})
            self.assertEqual(st, 409, f"force={force}")
            self.assertTrue(doc.get("newer"))
            self.assertFalse(doc.get("conflict"), "not reported as a two-window conflict")
            self.assertIn("format 3", doc["error"])
        self.assertEqual(self.put_lab(name, doc={"devices": []})[0], 409, "no version = format 1")
        self.assertEqual(self.put_lab(name, doc={"devices": [], "version": 3})[0], 200, "same format saves")
        self.assertEqual(self.put_lab(name, doc={"devices": [], "version": 4})[0], 200, "newer format saves")

    def test_library_versions(self):
        h = {"X-LabTracer": "1"}
        hist = self.tmp / "data" / ".history"
        self.assertEqual(self.req("PUT", "/api/library", {"templates": [], "version": 1}, h)[0], 200)
        n = len(list(hist.glob("library.*.json"))) if hist.exists() else 0
        st, _, _ = self.req("PUT", "/api/library", {"templates": [], "version": 2}, {**h, "X-LabTracer-Keep-Copy": "1"})
        self.assertEqual(st, 200)
        self.assertEqual(len(list(hist.glob("library.*.json"))), n + 1, "copy of the old library kept")
        st, _, doc = self.req("PUT", "/api/library", {"templates": []}, h)
        self.assertEqual(st, 409)
        self.assertTrue(doc["newer"])
        self.assertEqual(self.req("PUT", "/api/library", {"templates": [], "version": 1}, h)[0], 409)
        (self.tmp / "data" / "library.json").unlink()  # the other tests start without a library

    def test_damaged_lab_gives_a_clear_error(self):
        labs = self.tmp / "data" / "labs"
        (labs / "broken.json").write_text('{"devices": [', "utf-8")
        (labs / "binary.json").write_bytes(b"\xff\xfe\x00garbage")
        for name in ("broken", "binary"):
            st, _, doc = self.req("GET", f"/api/labs/{name}")
            self.assertEqual(st, 422, name)
            self.assertIn("damaged", doc["error"])
        self.assertIn("line 1", self.req("GET", "/api/labs/broken")[2]["error"])
        self.assertEqual(self.req("GET", "/api/ping")[0], 200, "the server keeps running")
        names = [x["name"] for x in self.req("GET", "/api/labs")[2]]
        self.assertIn("broken", names, "a damaged lab is still listed, so it can be opened or deleted")


    def test_collect_endpoints(self):
        st, _, body = self.req("GET", "/api/observed/nolab")
        self.assertEqual((st, body), (200, {"devices": {}}))
        st, _, _ = self.req("GET", "/api/observed/nolab/dev_x")
        self.assertEqual(st, 404)
        st, _, _ = self.req("GET", "/api/collect/jobs/nope")
        self.assertEqual(st, 404)
        st, _, body = self.req("POST", "/api/collect/lab1", {"devices": "x"}, {"X-LabTracer": "1"})
        self.assertEqual(st, 400)
        st, _, _ = self.req("POST", "/api/collect/lab1", {"devices": []})
        self.assertEqual(st, 403, "collect needs the X-LabTracer header")
        st, _, body = self.req("GET", "/api/collect/caps")
        self.assertEqual(st, 200)
        self.assertIn("linux", body["supported"])
        # a bad host fails at once, with no connection attempt
        st, _, body = self.req("POST", "/api/collect/lab1", {"devices": [{"id": "dev_1", "host": "-oProxyCommand=x"}]}, {"X-LabTracer": "1"})
        self.assertEqual(st, 200)
        self.assertEqual(body["devices"]["dev_1"]["state"], "error")


    def ws_open(self, origin=None):
        """Raw WebSocket handshake on /api/events. Returns (status line, socket)."""
        s = socket.create_connection(("127.0.0.1", self.port), timeout=5)
        host = f"127.0.0.1:{self.port}"
        s.sendall((f"GET /api/events HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                   f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n"
                   f"Origin: {origin or 'http://' + host}\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = s.recv(1)
            if not chunk:
                break
            head += chunk
        return head.split(b"\r\n")[0].decode(), s

    def test_events_websocket(self):
        status, s = self.ws_open()
        try:
            self.assertIn("101", status)
            b0, n = s.recv(2)
            self.assertEqual(b0, 0x81, "a text frame")
            self.assertEqual(json.loads(s.recv(n)), {"type": "hello"})
            payload = json.dumps({"type": "subscribe", "monitor": True}).encode()
            mask = b"\x01\x02\x03\x04"
            s.sendall(bytes([0x81, 0x80 | len(payload)]) + mask + bytes(c ^ mask[i % 4] for i, c in enumerate(payload)))
            b0, n = s.recv(2)
            ev = json.loads(s.recv(n))
            self.assertEqual(ev["type"], "monitor", "server.py polls the agent for subscribers and pushes the result")
            self.assertIn("no agent configured", ev["error"])
        finally:
            s.close()
        status, s = self.ws_open(origin="http://evil.example")
        s.close()
        self.assertIn("403", status, "another origin can not listen")

    def test_remediate_endpoints(self):
        h = {"X-LabTracer": "1"}
        st, _, body = self.req("POST", "/api/remediate/lab1/plan", {"device": {"id": "dev_1", "driver": "ios", "host": "192.0.2.1"},
                                                                    "ops": [{"op": "exec", "cmd": "reload"}]}, h)
        self.assertEqual(st, 400)
        self.assertIn("unknown operation", body["error"])
        st, _, body = self.req("POST", "/api/remediate/lab1/plan", {"device": {"id": "dev_1", "driver": "ios", "host": "192.0.2.1"},
                                                                    "ops": [{"op": "sw-access", "port": "Gi0/3", "vlan": 20}]}, h)
        self.assertEqual(st, 200)
        self.assertIn(" switchport access vlan 20", body["commands"])
        st, _, body = self.req("POST", "/api/remediate/apply", {"planId": "made-up"}, h)
        self.assertEqual(st, 400)
        st, _, _ = self.req("POST", "/api/remediate/apply", {"planId": "made-up"})
        self.assertEqual(st, 403, "apply needs the X-LabTracer header")


class SshBridgeTest(unittest.TestCase):
    def test_paramiko_not_loaded_at_import(self):
        code = ("import sys; sys.path.insert(0, sys.argv[1]); import ssh_bridge; "
                "print('paramiko' in sys.modules)")
        out = subprocess.run([sys.executable, "-c", code, str(ROOT)], capture_output=True, text=True, check=True)
        self.assertEqual(out.stdout.strip(), "False", "server.py should start without loading paramiko")


STATUS_DAT = """# NAGIOS STATE RETENTION FILE
info {
	created=%(created)d
	version=4.5.1
	}

hoststatus {
	host_name=srv-01
	has_been_checked=1
	current_state=0
	plugin_output=PING OK - Packet loss = 0%%, RTA = 0.42 ms
	last_state_change=1700000000
	_LABTRACER_ID=0;dev_srv
	}

hoststatus {
	host_name=nas-01
	has_been_checked=1
	current_state=0
	plugin_output=PING OK
	last_state_change=1700000100
	}

hoststatus {
	host_name=plug-01
	has_been_checked=1
	current_state=2
	plugin_output=CRITICAL - Host Unreachable (192.168.50.20)
	last_state_change=1700000200
	}

servicestatus {
	host_name=srv-01
	service_description=ssh-22
	has_been_checked=1
	current_state=0
	plugin_output=SSH OK - OpenSSH_9.2
	last_state_change=1700000000
	}

servicestatus {
	host_name=nas-01
	service_description=smb-445
	has_been_checked=1
	current_state=2
	plugin_output=connect to address 192.168.30.10 and port 445: Connection refused
	last_state_change=1700000300
	}
"""


class AgentNagiosTest(unittest.TestCase):
    TARGETS = [{"id": "dev_srv", "name": "renamed in LabTracer", "checks": []},  # found by _LABTRACER_ID
               {"id": "dev_nas", "name": "nas 01", "checks": []},                # found by name (nas-01)
               {"id": "dev_plug", "name": "plug-01", "checks": []},
               {"id": "dev_new", "name": "new-box", "checks": []}]

    def make(self, created=None):
        tmp = Path(tempfile.mkdtemp(prefix="labtracer-nagios-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        (tmp / "status.dat").write_text(STATUS_DAT % {"created": created or int(time.time())}, "utf-8")
        cfg = dict(agent.DEFAULTS, source="nagios", nagios_status=str(tmp / "status.dat"))
        a = agent.Agent(cfg, tmp)
        a.set_targets(self.TARGETS)
        a.run_once()
        return a.snapshot()

    def test_names_match_the_labtracer_export(self):
        # the same table as NAMES in tests/nagios.test.mjs
        for a, b in [("srv-01", "srv-01"), ("nas 01", "nas-01"), ("a;b(c)", "a-b-c"), ("  x  ", "x"), ("!!!", "unnamed"),
                     ("o'neil\"s pc", "o-neil-s-pc")]:
            self.assertEqual(agent.nag_name(a), b)

    def test_parse(self):
        created, hosts, services = agent.parse_status_dat(STATUS_DAT % {"created": 5})
        self.assertEqual(created, 5)
        self.assertEqual(hosts["srv-01"]["vars"], {"LABTRACER_ID": "dev_srv"})
        self.assertEqual(services["nas-01"][0]["desc"], "smb-445")

    def test_states(self):
        snap = self.make()
        dev = snap["devices"]
        self.assertEqual(snap["source"], "nagios")
        self.assertEqual(snap["nagiosHosts"], ["nas-01", "plug-01", "srv-01"])
        self.assertEqual(snap["error"], "")
        self.assertEqual((dev["dev_srv"]["state"], dev["dev_srv"]["nagiosHost"]), ("up", "srv-01"), "found by _LABTRACER_ID")
        self.assertEqual([c["label"] for c in dev["dev_srv"]["checks"]], ["host", "ssh-22"])
        self.assertEqual(dev["dev_nas"]["state"], "degraded", "host up, a service critical")
        self.assertIn("Connection refused", dev["dev_nas"]["checks"][1]["err"])
        self.assertEqual((dev["dev_plug"]["state"], dev["dev_plug"]["nagiosState"]), ("unknown", "UNREACHABLE"),
                         "unreachable is not shown as down")
        self.assertEqual((dev["dev_new"]["state"], dev["dev_new"]["nagiosState"]), ("unknown", "not in Nagios"))

    def test_old_status_is_reported(self):
        snap = self.make(created=int(time.time()) - 3600)
        self.assertIn("is Nagios running", snap["error"])

    def test_livestatus_rows(self):
        def fake(path, query, timeout=5.0):
            self.assertTrue(query.startswith("GET "), "read-only queries")
            if query.startswith("GET hosts"):
                return [["srv-01", 0, 1, "PING OK", 1700000000, ["LABTRACER_ID"], ["dev_srv"]]]
            return [["srv-01", "ssh-22", 1, 1, "SSH WARNING", 1700000000]]
        with mock.patch.object(agent, "_livestatus", side_effect=fake):
            _, hosts, services = agent.query_livestatus("/run/naemon/live")
        state, nstate, checks = agent.nagios_device(hosts["srv-01"], services["srv-01"], "srv-01")
        self.assertEqual(hosts["srv-01"]["vars"], {"LABTRACER_ID": "dev_srv"})
        self.assertEqual((state, nstate, checks[1]["state"]), ("degraded", "UP", "WARNING"))

    def test_status_over_http(self):
        from http.server import ThreadingHTTPServer
        tmp = Path(tempfile.mkdtemp(prefix="labtracer-nagios-http-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        (tmp / "status.dat").write_text(STATUS_DAT % {"created": int(time.time())}, "utf-8")
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), agent.Handler)
        httpd.agent = agent.Agent(dict(agent.DEFAULTS, token="t" * 20, source="nagios", nagios_status=str(tmp / "status.dat")), tmp)
        httpd.agent.set_targets(self.TARGETS)
        httpd.agent.run_once()
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        self.addCleanup(httpd.server_close)
        self.addCleanup(httpd.shutdown)  # cleanups run last-in first-out: shutdown, then close
        url = f"http://127.0.0.1:{httpd.server_address[1]}/status"
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(url, timeout=5)
        self.assertEqual(cm.exception.code, 401, "Nagios results also need the token")
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": "Bearer " + "t" * 20}), timeout=5) as r:
            snap = json.loads(r.read())
        self.assertEqual((snap["source"], snap["version"]), ("nagios", agent.VERSION))
        self.assertEqual(snap["devices"]["dev_srv"]["state"], "up")

    def test_missing_status_file(self):
        tmp = Path(tempfile.mkdtemp(prefix="labtracer-nagios-"))
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        a = agent.Agent(dict(agent.DEFAULTS, source="nagios", nagios_status=str(tmp / "nope.dat")), tmp)
        a.run_once()
        self.assertIn("can not read the Nagios status", a.snapshot()["error"])


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
