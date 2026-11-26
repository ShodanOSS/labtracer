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
from collector import ops, store  # noqa: E402
from collector.conn import Shell  # noqa: E402
from collector.drivers import ios, linux  # noqa: E402


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
        cmds, notes = linux.render(ops.validate([
            {"op": "iface-desc", "port": "eno1", "desc": "uplink $(reboot)"},
            {"op": "iface-ip", "port": "eno1", "ip": "10.0.0.5/24", "old": ["10.0.0.9/24"]},
            {"op": "sw-access", "port": "eno1", "vlan": 20},
        ]))
        self.assertEqual(cmds, ["sudo ip link set dev eno1 alias 'uplink $(reboot)'",
                                "sudo ip addr del 10.0.0.9/24 dev eno1", "sudo ip addr add 10.0.0.5/24 dev eno1"])
        self.assertTrue(any("persistent" in n for n in notes))
        self.assertTrue(any("sw-access" in n for n in notes))
        self.assertFalse(hasattr(linux, "apply"), "Linux changes go to the console, never applied automatically")


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


class PlanTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(store, "OBS_DIR", Path(self.tmp.name))
        self.patch.start()
        self.dev = {"id": "dev_1", "name": "sw1", "host": "192.0.2.10", "user": "admin", "auth": "key"}
        self.ops = [{"op": "sw-access", "port": "Gi0/3", "vlan": 20}]

    def tearDown(self):
        self.patch.stop()
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
        with mock.patch.object(collector, "_apply_one"):
            snap = collector.apply({"planId": r["planId"]})
        self.assertEqual(snap["kind"], "apply")
        with self.assertRaisesRegex(ValueError, "expired or was used"):
            collector.apply({"planId": r["planId"]})

    def test_apply_runs_the_reviewed_commands_then_collects(self):
        r = collector.plan("lab", {"device": {**self.dev, "driver": "ios"}, "ops": self.ops})
        ran = {}

        def fake_apply(sess, cmds, save):
            ran["cmds"], ran["save"] = cmds, save
            return True, "transcript"
        facts = {"collected": 5, "driver": "ios", "errors": [], "rawConfig": ""}
        with mock.patch.object(ios, "apply", side_effect=fake_apply), \
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
        self.assertTrue(ran["save"])
        self.assertEqual(store.read("lab", "dev_1")["facts"]["collected"], 5, "the device is read again after the change")

    def test_plan_without_paramiko_can_still_be_sent_to_the_console(self):
        with mock.patch.object(ssh_bridge, "validate", side_effect=ValueError("paramiko is not installed")):
            r = collector.plan("lab", {"device": {**self.dev, "driver": "ios"}, "ops": self.ops})
        self.assertFalse(r["canApply"])
        self.assertTrue(r["commands"])
        self.assertIn("paramiko", r["notes"][0])


if __name__ == "__main__":
    unittest.main()
