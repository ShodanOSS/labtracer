"""Tests for remediation (push the plan to a device): operation validation, command
rendering, IOS apply on a fake CLI, and the plan/apply rules. No device needed."""

import socket
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import collector  # noqa: E402
import ssh_bridge  # noqa: E402
from collector import audit, backups, changes, ops, store  # noqa: E402
from collector.conn import Shell  # noqa: E402
from collector.drivers import ios, linux, routeros  # noqa: E402


class ValidateTest(unittest.TestCase):
    def test_injection_is_refused(self):
        bad = [
            [{"op": "iface-enable", "port": "Gi0/1\nreload", "enabled": True}],
            [{"op": "iface-enable", "port": "Gi0/1; reboot", "enabled": True}],
            [{"op": "hostname", "name": "sw1 \nreload"}],
            [{"op": "vlan-add", "id": 10, "name": "a b"}],
            [{"op": "sw-trunk", "port": "Gi0/1", "trunkVlans": "1,2\nreload"}],
            [{"op": "route-add", "dest": "10.0.0.0/8", "via": "1.2.3.4; rm -rf /"}],
            [{"op": "iface-ip", "port": "eth0", "ip": "10.0.0.1/24 dev lo"}],
            [{"op": "exec", "cmd": "reload"}],
            [{"op": "vlan-del", "id": 1}],
            [{"op": "sw-access", "port": "Gi0/1", "vlan": 5000}],
            [],
        ]
        for o in bad:
            with self.subTest(o):
                with self.assertRaises(ValueError):
                    ops.validate(o)

    def test_description_loses_control_characters(self):
        c = ops.validate([{"op": "iface-desc", "port": "Gi0/1", "desc": "to srv\r\nreload\x1b"}])
        self.assertEqual(c[0]["desc"], "to srvreload")

    def test_values_are_normalized(self):
        c = ops.validate([{"op": "iface-ip", "port": "eth0", "ip": "10.0.0.5/24", "old": ["10.0.0.9/24"], "extra": 1},
                          {"op": "route-add", "dest": "default", "via": "10.0.0.1"}])
        self.assertEqual(c[0], {"op": "iface-ip", "port": "eth0", "ip": "10.0.0.5/24", "old": ["10.0.0.9/24"]})
        self.assertEqual(c[1]["dest"], "0.0.0.0/0")


class RenderTest(unittest.TestCase):
    def test_ios(self):
        cmds, notes = ios.render(ops.validate([
            {"op": "sw-access", "port": "GigabitEthernet0/3", "vlan": 20},
            {"op": "iface-desc", "port": "GigabitEthernet0/3", "desc": "printer?"},
            {"op": "vlan-add", "id": 40, "name": "wifi"},
            {"op": "iface-ip", "port": "Vlan10", "ip": "192.168.10.3/24", "old": ["192.168.10.2/24"]},
            {"op": "route-del", "dest": "10.0.0.0/8", "via": "192.168.10.254"},
            {"op": "route-add", "dest": "0.0.0.0/0", "via": "192.168.10.1"},
            {"op": "hostname", "name": "core-sw"},
        ]))
        self.assertEqual(cmds, [
            "configure terminal",
            "vlan 40", " name wifi", "exit",
            "interface GigabitEthernet0/3", " switchport mode access", " switchport access vlan 20", " description printer", "exit",
            "interface Vlan10", " ip address 192.168.10.3 255.255.255.0", "exit",
            "no ip route 10.0.0.0 255.0.0.0 192.168.10.254",
            "ip route 0.0.0.0 0.0.0.0 192.168.10.1",
            "hostname core-sw",
            "end",
        ])
        self.assertEqual(notes, [])

    def test_linux_quotes_and_notes(self):
        """Without platform facts (an old collect): console commands only, never applied."""
        cmds, notes, extra = linux.render(ops.validate([
            {"op": "iface-desc", "port": "eno1", "desc": "uplink $(reboot)"},
            {"op": "iface-ip", "port": "eno1", "ip": "10.0.0.5/24", "old": ["10.0.0.9/24"]},
            {"op": "sw-access", "port": "eno1", "vlan": 20},
        ]))
        self.assertEqual(cmds, ["sudo ip link set dev eno1 alias 'uplink $(reboot)'",
                                "sudo ip addr del 10.0.0.9/24 dev eno1", "sudo ip addr add 10.0.0.5/24 dev eno1"])
        self.assertTrue(any("Collect the device again" in n for n in notes))
        self.assertTrue(any("sw-access" in n for n in notes))
        self.assertFalse(extra["canApply"], "no apply until LabTracer knows how the host keeps its config")


class FakeIos:
    """An IOS CLI: config mode prompts, '% Invalid input' for unknown commands."""

    def __init__(self, refuse=()):
        self.mode, self.queue, self.sent, self.refuse = "", [], [], set(refuse)

    def settimeout(self, t):
        pass

    def prompt(self):
        return f"sw1{self.mode}#"

    def send(self, s):
        self.sent.append(s)
        cmd = s.strip()
        if s == "\n":
            self.queue.append("\r\n" + self.prompt())
            return
        out = ""
        if cmd in self.refuse:
            out = "                 ^\r\n% Invalid input detected at '^' marker.\r\n"
        elif cmd == "configure terminal":
            out = "Enter configuration commands, one per line.  End with CNTL/Z.\r\n"
            self.mode = "(config)"
        elif cmd.startswith("interface "):
            self.mode = "(config-if)"
        elif cmd.startswith("vlan "):
            self.mode = "(config-vlan)"
        elif cmd == "exit":
            self.mode = "(config)" if self.mode not in ("", "(config)") else ""
        elif cmd == "end":
            self.mode = ""
        elif cmd == "write memory":
            out = "Building configuration...\r\n[OK]\r\n"
        self.queue.append(f"{cmd}\r\n{out}{self.prompt()}")

    def recv(self, n):
        if not self.queue:
            raise socket.timeout()
        return self.queue.pop(0).encode()


class FakeSess:
    def __init__(self, chan):
        self.sh = Shell(chan)

    def shell(self):
        return self.sh


class ApplyTest(unittest.TestCase):
    CMDS = ["configure terminal", "interface Gi0/3", " switchport access vlan 20", "exit", "end"]

    def test_apply_and_save(self):
        ch = FakeIos()
        ok, log = ios.apply(FakeSess(ch), self.CMDS, save=True)
        self.assertTrue(ok, log)
        self.assertIn("sw1(config-if)#switchport access vlan 20", log)
        self.assertIn("write memory", "".join(ch.sent))

    def test_stops_at_the_first_refused_command(self):
        ch = FakeIos(refuse={"switchport access vlan 20"})
        ok, log = ios.apply(FakeSess(ch), self.CMDS, save=True)
        self.assertFalse(ok)
        self.assertIn("Stopped", log)
        sent = [s.strip() for s in ch.sent]
        self.assertNotIn("write memory", sent, "nothing is saved after a refusal")
        self.assertEqual(sent[-1], "end", "it leaves config mode")


def isolate(tmp):
    """Point every data folder of the collector into tmp (tests never touch ./data)."""
    ps = [mock.patch.object(store, "OBS_DIR", tmp / "observed"), mock.patch.object(audit, "AUDIT_DIR", tmp / "audit"),
          mock.patch.object(backups, "BACKUP_DIR", tmp / "backups"), mock.patch.object(changes, "CHANGE_DIR", tmp / "changes")]
    for p in ps:
        p.start()
    audit.reset_cache()
    return ps


class PlanTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patches = isolate(Path(self.tmp.name))
        self.dev = {"id": "dev_1", "name": "sw1", "host": "192.0.2.10", "user": "admin", "auth": "key"}
        self.ops = [{"op": "sw-access", "port": "Gi0/3", "vlan": 20}]

    def tearDown(self):
        for p in self.patches:
            p.stop()
        audit.reset_cache()
        self.tmp.cleanup()

    def test_needs_a_collect_to_know_the_platform(self):
        with self.assertRaisesRegex(ValueError, "collect the device first"):
            collector.plan("lab", {"device": self.dev, "ops": self.ops})

    def test_driver_from_the_stored_facts(self):
        store.save("lab", "dev_1", {"collected": 1, "driver": "linux", "rawConfig": ""})
        r = collector.plan("lab", {"device": self.dev, "ops": [{"op": "iface-enable", "port": "eno1", "enabled": True}]})
        self.assertEqual(r["driver"], "linux")
        self.assertFalse(r["canApply"])
        with self.assertRaisesRegex(ValueError, "can not apply"):
            collector.apply({"planId": r["planId"]})

    def test_plan_is_used_once(self):
        r = collector.plan("lab", {"device": {**self.dev, "driver": "ios"}, "ops": self.ops})
        self.assertIn(" switchport access vlan 20", r["commands"])
        with mock.patch.object(collector._pool, "submit"):  # nothing runs: only the plan bookkeeping is tested
            snap = collector.apply({"planId": r["planId"]})
        self.assertEqual(snap["kind"], "apply")
        with self.assertRaisesRegex(ValueError, "expired or was used"):
            collector.apply({"planId": r["planId"]})

    def test_apply_runs_the_reviewed_commands_then_collects(self):
        r = collector.plan("lab", {"device": {**self.dev, "driver": "ios"}, "ops": self.ops})
        ran = {}

        def fake_apply(sess, cmds, save, armed, extra, facts):
            ran["cmds"], ran["save"] = cmds, save
            return True, "transcript"
        facts = {"collected": 5, "driver": "ios", "errors": [], "rawConfig": ""}
        with mock.patch.object(ios, "apply", side_effect=fake_apply), \
                mock.patch.object(ios, "backup", return_value={"config": "hostname sw1\n", "files": {}, "archive": "", "onDevice": ""}), \
                mock.patch.object(ios, "persist", return_value=(True, "write memory\n[OK]")) as persist, \
                mock.patch.object(ios, "collect", return_value=dict(facts)), \
                mock.patch.object(collector.Session, "open", side_effect=lambda *a, **k: mock.Mock(host="192.0.2.10")):
            snap = collector.apply({"planId": r["planId"], "save": True})
            for _ in range(200):
                snap = collector.snapshot(snap["id"])
                if snap["done"]:
                    break
                time.sleep(0.02)
        item = snap["devices"]["dev_1"]
        self.assertEqual(item["state"], "done", item)
        self.assertEqual(ran["cmds"], r["commands"])
        self.assertFalse(ran["save"], "apply does not save; the save step does, after the change is confirmed")
        persist.assert_called_once()
        self.assertTrue(item["backup"], "a backup is taken before the change")
        self.assertEqual(store.read("lab", "dev_1")["facts"]["collected"], 5, "the device is read again after the change")

    def test_a_queued_push_still_gets_the_password(self):
        """The job runs after apply() returned (all workers busy): it must still have the password."""
        r = collector.plan("lab", {"device": {**self.dev, "driver": "ios", "auth": "password"}, "ops": self.ops})
        later = []
        seen = {}
        with mock.patch.object(collector._pool, "submit", side_effect=lambda fn, *a: later.append((fn, a))), \
                mock.patch.object(collector, "push", side_effect=lambda job, it, pw, *rest, **kw: seen.setdefault("pw", pw)):
            collector.apply({"planId": r["planId"], "password": "s3cret"})
            for fn, a in later:
                fn(*a)
        self.assertEqual(seen["pw"], "s3cret")

    def test_a_backup_is_restored_only_to_its_own_host(self):
        backups.save("lab", "dev_1", {"id": "20260101-000000-abcdef", "ts": 1, "name": "sw1", "host": "192.0.2.10",
                                      "driver": "ios", "config": "hostname sw1\n"})
        body = {"backup": "20260101-000000-abcdef", "device": {**self.dev, "host": "198.51.100.66"}}
        with mock.patch.object(ssh_bridge, "validate", side_effect=lambda p: {**p, "port": 22, "auth": "key"}), \
                mock.patch.object(collector._pool, "submit") as submit, \
                self.assertRaisesRegex(ValueError, "only restored to the host it came from"):
            collector.restore("lab", body)
        submit.assert_not_called()
        self.assertEqual(audit.read("lab")[0]["event"], "restore-refused")

    def test_plan_without_paramiko_can_still_be_sent_to_the_console(self):
        with mock.patch.object(ssh_bridge, "validate", side_effect=ValueError("paramiko is not installed")):
            r = collector.plan("lab", {"device": {**self.dev, "driver": "ios"}, "ops": self.ops})
        self.assertFalse(r["canApply"])
        self.assertTrue(r["commands"])
        self.assertIn("paramiko", r["notes"][0])


class KeyFileTest(unittest.TestCase):
    def test_key_files_only_from_the_allowed_folders(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            ok, other = Path(a) / "id_test", Path(b) / "secret.txt"
            ok.write_text("key")
            other.write_text("not a key")
            with mock.patch.dict("os.environ", {"LABTRACER_KEY_DIRS": a}):
                self.assertEqual(Path(ssh_bridge.key_path(str(ok))), ok.resolve())
                for bad in (str(other), str(Path(a) / ".." / Path(b).name / "secret.txt"), str(Path(a) / "missing")):
                    with self.subTest(bad), self.assertRaisesRegex(ValueError, "must be in ~/.ssh"):
                        ssh_bridge.key_path(bad)


class HostKeyAuditTest(unittest.TestCase):
    @unittest.skipIf(ssh_bridge.load_paramiko() is None, "paramiko is not installed")
    def test_a_saved_host_key_is_reported(self):
        from collector import conn
        seen = []
        key = mock.Mock()
        key.get_name.return_value = "ssh-ed25519"
        with mock.patch.object(ssh_bridge, "fingerprint", return_value="SHA256:x"), \
                mock.patch.object(ssh_bridge, "remember_host_key"):
            conn._policy("SHA256:x", lambda *a: seen.append(a)).missing_host_key(mock.Mock(), "192.0.2.1", key)
            with self.assertRaises(conn.HostKeyUnknown):
                conn._policy(None, lambda *a: seen.append(a)).missing_host_key(mock.Mock(), "192.0.2.2", key)
        self.assertEqual(seen, [("192.0.2.1", "ssh-ed25519", "SHA256:x")])


if __name__ == "__main__":
    unittest.main()
