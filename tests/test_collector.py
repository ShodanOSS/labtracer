"""Tests for the collector (collector/): driver parsers, the facts store and job rules.
Standard library only; no device and no paramiko needed.

The parsers run on recorded device output in tests/collect-fixtures/. Their result must
equal the golden *.facts.json files, which tests/drift.test.mjs also reads: that keeps
the Python facts and the JavaScript drift report on one schema.
To update the golden files after a deliberate parser change:
    python tests/test_collector.py --regen
"""

import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "collect-fixtures"
sys.path.insert(0, str(ROOT))
import collector  # noqa: E402
import ssh_bridge  # noqa: E402
from collector import audit, drivers, store  # noqa: E402
from collector.drivers import ios, linux, routeros  # noqa: E402
from collector.facts import cidr, norm_dest, norm_mac, sections  # noqa: E402

CASES = {
    "linux-pve": lambda: linux.parse(sections((FIX / "linux-pve.txt").read_text("utf-8"))),
    "busybox": lambda: linux.parse(sections((FIX / "busybox.txt").read_text("utf-8"))),
    "ios-switch": lambda: ios.parse(json.loads((FIX / "ios-switch.json").read_text("utf-8"))),
}


def parsed(name):
    f = CASES[name]()
    f["collected"] = 0
    return f


class ParserTest(unittest.TestCase):
    def test_golden_facts(self):
        for name in CASES:
            with self.subTest(name):
                want = json.loads((FIX / f"{name}.facts.json").read_text("utf-8"))
                self.assertEqual(parsed(name), want, f"parser output changed; see the docstring to update {name}.facts.json")

    def test_proxmox_host(self):
        f = parsed("linux-pve")
        self.assertEqual(f["system"]["os"], "Proxmox VE 8.2.4")
        by = {i["name"]: i for i in f["interfaces"]}
        self.assertEqual(by["vmbr0"]["ips"], ["192.168.20.11/24"])
        self.assertEqual(by["eno1"]["master"], "vmbr0")
        self.assertFalse(by["eno2"]["adminUp"])
        self.assertEqual(by["wg0"]["kind"], "tunnel")
        # connected (kernel, no gateway) routes are left out; the default and boot routes stay
        self.assertEqual([r["dest"] for r in f["routes"]], ["0.0.0.0/0", "10.50.0.0/16"])
        # loopback listeners are left out
        self.assertEqual([x["port"] for x in f["listening"]], [22, 111, 8006])
        # only guests of this node
        self.assertEqual([g["name"] for g in f["guests"]], ["dc01", "pihole"])
        self.assertEqual(f["neighbors"][0]["remotePort"], "Gi0/2")

    def test_busybox_router(self):
        f = parsed("busybox")
        self.assertEqual(f["system"]["os"], "DD-WRT")
        by = {i["name"]: i for i in f["interfaces"]}
        self.assertEqual(by["br0"]["ips"], ["192.168.1.1/24"])
        self.assertEqual(by["br0"]["mac"], "00:14:bf:aa:bb:01")
        self.assertFalse(by["eth2"]["adminUp"])
        self.assertIn({"dest": "10.8.0.0/16", "via": "192.168.1.2", "dev": ""}, f["routes"])

    def test_ios_switch(self):
        f = parsed("ios-switch")
        self.assertEqual((f["system"]["model"], f["system"]["serial"]), ("WS-C2960X-48TS-L", "FOC1234X0YZ"))
        by = {i["name"]: i for i in f["interfaces"]}
        self.assertEqual(by["GigabitEthernet0/48"]["trunkVlans"], "1,10,20,30,40", "'allowed vlan add' lines are joined")
        self.assertEqual(by["GigabitEthernet0/2"]["vlan"], 20)
        self.assertFalse(by["GigabitEthernet0/1"]["adminUp"])
        self.assertFalse(by["GigabitEthernet0/3"]["operUp"])
        self.assertEqual([v["id"] for v in f["vlans"]], [1, 10, 20, 30], "1002-1005 are left out")
        self.assertNotIn("Last configuration change", f["rawConfig"], "volatile lines are removed")

    def test_ios_without_enable(self):
        o = json.loads((FIX / "ios-switch.json").read_text("utf-8"))
        o.update(prompt="rack-switch>", privileged=False, run="                ^\n% Invalid input detected at '^' marker.\n")
        f = ios.parse(o)
        self.assertTrue(any("privilege 15" in e for e in f["errors"]))
        self.assertEqual(f["rawConfig"], "")
        self.assertTrue(f["interfaces"], "interfaces still come from show ip interface brief")

    def test_helpers(self):
        self.assertEqual(cidr("10.0.0.5", "255.255.255.0"), "10.0.0.5/24")
        self.assertEqual(cidr("fe80::1", 64), "")
        self.assertEqual(norm_dest("default"), "0.0.0.0/0")
        self.assertEqual(norm_mac("3CEC.EF12.3456"), "3c:ec:ef:12:34:56")


class FakeSession:
    def __init__(self, answer):
        self.answer = answer

    def run(self, cmd, timeout=0):
        return 0, self.answer, ""

    def shell(self):
        raise RuntimeError("no shell")


class DetectTest(unittest.TestCase):
    def test_detect(self):
        self.assertIs(drivers.detect(FakeSession("Linux\n")), linux)
        self.assertIs(drivers.detect(FakeSession("\n% Invalid input detected at '^' marker.\n")), ios)
        self.assertIs(drivers.detect(FakeSession("bad command name uname (line 1 column 1)")), routeros)

    def test_planned_drivers_are_refused(self):
        with self.assertRaisesRegex(ValueError, "not supported yet"):
            drivers.get("unifi")


class FakeChan:
    """A device CLI: answers each line with scripted output and the prompt."""

    def __init__(self, answers, prompt="sw1#"):
        self.answers, self.prompt, self.queue, self.sent = answers, prompt, [], []

    def settimeout(self, t):
        pass

    def send(self, s):
        self.sent.append(s)
        if s == "\n":
            self.queue.append(f"\r\nWelcome\r\n{self.prompt}")
        elif s == " ":
            self.queue.append("\r\nline3\r\n" + self.prompt)
        else:
            cmd = s.strip()
            ans = self.answers.get(cmd, "")
            self.queue.append(f"{cmd}\r\n{ans}" + ("" if "More" in ans else self.prompt))  # a pager waits for a key

    def recv(self, n):
        if not self.queue:
            import socket
            raise socket.timeout()
        return self.queue.pop(0).encode()


class ShellTest(unittest.TestCase):
    def test_prompt_echo_and_pager(self):
        from collector.conn import Shell
        ch = FakeChan({"show version": "Cisco IOS Software\r\nVersion 15.2\r\n", "show long": "line1\r\nline2\r\n --More-- "})
        sh = Shell(ch)
        self.assertEqual(sh.prompt, "sw1#")
        self.assertTrue(sh.privileged)
        self.assertEqual(sh.cmd("show version"), "Cisco IOS Software\nVersion 15.2")
        self.assertEqual(sh.cmd("show long").split(), ["line1", "line2", "line3"])
        self.assertIn(" ", ch.sent, "the pager got a space")


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(store, "OBS_DIR", Path(self.tmp.name))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_keeps_distinct_configs(self):
        f = parsed("ios-switch")
        for i, text in enumerate(["a\n", "a\n", "b\n"]):
            store.save("lab", "dev_1", {**f, "collected": i, "rawConfig": text})
        doc = store.read("lab", "dev_1")
        self.assertEqual([c["text"] for c in doc["configs"]], ["b\n", "a\n"])
        self.assertEqual(list(store.read_all("lab")), ["dev_1"])

    def test_names_can_not_leave_the_folder(self):
        store.save("../x", "../../y", parsed("busybox"))
        files = [p.relative_to(self.tmp.name) for p in Path(self.tmp.name).rglob("*.json")]
        self.assertEqual(len(files), 1)
        self.assertNotIn("..", str(files[0]))


class JobTest(unittest.TestCase):
    def setUp(self):
        """Collect runs are written to the audit log: keep it out of ./data."""
        tmp = tempfile.TemporaryDirectory()
        patch = mock.patch.object(audit, "AUDIT_DIR", Path(tmp.name) / "audit")
        patch.start()
        audit.reset_cache()
        self.addCleanup(tmp.cleanup)
        self.addCleanup(audit.reset_cache)
        self.addCleanup(patch.stop)

    def test_bad_params_fail_without_connecting(self):
        with mock.patch.object(ssh_bridge, "validate", side_effect=ValueError("host must be an IP address or a DNS name")):
            snap = collector.start("lab", {"devices": [{"id": "dev_1", "host": "-oProxyCommand=x"}]})
        self.assertTrue(snap["done"])
        self.assertEqual(snap["devices"]["dev_1"]["state"], "error")

    def test_off_on_network_bind(self):
        with mock.patch.object(ssh_bridge, "ENABLED", False):
            with self.assertRaises(PermissionError):
                collector.start("lab", {"devices": []})

    def test_password_is_not_kept(self):
        seen = {}

        def fake_open(p, password=None, trust=None, on_trust=None):
            seen["pw"] = password
            raise ValueError("refused")
        with mock.patch.object(ssh_bridge, "validate", side_effect=lambda d: {**d, "auth": "password", "host": "h"}), \
                mock.patch.object(collector.Session, "open", side_effect=fake_open):
            snap = collector.start("lab", {"devices": [{"id": "dev_1"}], "password": "s3cret"})
            for _ in range(100):
                snap = collector.snapshot(snap["id"])
                if snap["done"]:
                    break
                time.sleep(0.02)
        self.assertEqual(seen["pw"], "s3cret")
        self.assertEqual(snap["devices"]["dev_1"]["state"], "error")
        self.assertNotIn("s3cret", json.dumps(collector._jobs), "the job never holds the password")

    def test_successful_run_stores_facts(self):
        out = (FIX / "linux-pve.txt").read_text("utf-8")
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(store, "OBS_DIR", Path(tmp)), \
                mock.patch.object(ssh_bridge, "validate", side_effect=lambda d: {**d, "auth": "key", "host": "10.0.0.5"}), \
                mock.patch.object(collector.Session, "open", side_effect=lambda *a, **k: mock.Mock(run=lambda *x, **y: (0, out, ""), host="10.0.0.5")):
            snap = collector.start("lab", {"devices": [{"id": "dev_1", "driver": "linux"}]})
            for _ in range(200):
                snap = collector.snapshot(snap["id"])
                if snap["done"]:
                    break
                time.sleep(0.02)
            self.assertEqual(snap["devices"]["dev_1"]["state"], "done", snap)
            facts = store.read("lab", "dev_1")["facts"]
        self.assertEqual(facts["host"], "10.0.0.5")
        self.assertEqual(facts["system"]["hostname"], "srv-01")

    def test_import_does_not_load_paramiko(self):
        code = ("import sys; sys.path.insert(0, sys.argv[1]); import collector; "
                "print('paramiko' in sys.modules)")
        out = subprocess.run([sys.executable, "-c", code, str(ROOT)], capture_output=True, text=True, check=True)
        self.assertEqual(out.stdout.strip(), "False")


if __name__ == "__main__":
    if "--regen" in sys.argv:
        for n in CASES:
            (FIX / f"{n}.facts.json").write_text(json.dumps(parsed(n), indent=1) + "\n", "utf-8", newline="\n")
            print("wrote", n)
    else:
        unittest.main()
