"""Tests for operations on real devices, with no device: audit log, backups, staged change
sets and their apply (backup, rollback timer, confirm, restore), the Linux persistent push,
the RouterOS driver, the Guacamole tunnel, the monitoring backends and discovery helpers."""

import base64
import io
import json
import socket
import sys
import tarfile
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import collector  # noqa: E402
import guac  # noqa: E402
import monitoring  # noqa: E402
from collector import audit, backups, changes, discover, ops, store  # noqa: E402
from collector.conn import Shell  # noqa: E402
from collector.drivers import ios, linux, routeros  # noqa: E402

FIX = ROOT / "tests" / "collect-fixtures"


def isolate(test):
    tmp = tempfile.TemporaryDirectory()
    t = Path(tmp.name)
    ps = [mock.patch.object(store, "OBS_DIR", t / "observed"), mock.patch.object(audit, "AUDIT_DIR", t / "audit"),
          mock.patch.object(backups, "BACKUP_DIR", t / "backups"), mock.patch.object(changes, "CHANGE_DIR", t / "changes"),
          mock.patch.object(discover, "DISC_DIR", t / "discovery")]
    for p in ps:
        p.start()
    audit.reset_cache()

    def done():
        for p in ps:
            p.stop()
        audit.reset_cache()
        tmp.cleanup()
    test.addCleanup(done)
    return t


def wait_job(job_id, timeout=5):
    end = time.time() + timeout
    while time.time() < end:
        snap = collector.snapshot(job_id)
        if snap["done"]:
            return snap
        time.sleep(0.02)
    raise AssertionError("job did not finish")


class AuditTest(unittest.TestCase):
    def test_chain_and_tampering(self):
        t = isolate(self)
        for i in range(3):
            audit.record("lab", "apply", dev=f"d{i}", ok=True, transcript="x" * 10)
        self.assertEqual(audit.verify("lab"), {"ok": True, "entries": 3, "broken": None, "why": ""})
        self.assertEqual([e["seq"] for e in audit.read("lab")], [3, 2, 1], "newest first")
        self.assertEqual(len(audit.read("lab", device="d1")), 1)
        p = t / "audit" / "lab.jsonl"
        lines = p.read_text().splitlines()
        e = json.loads(lines[1])
        e["ok"] = False
        p.write_text("\n".join([lines[0], json.dumps(e), lines[2]]) + "\n")
        v = audit.verify("lab")
        self.assertFalse(v["ok"])
        self.assertEqual(v["broken"], 2)
        p.write_text("\n".join([lines[0], lines[2]]) + "\n")
        self.assertIn("does not follow", audit.verify("lab")["why"])

    def test_cut_end_and_deleted_log_are_found(self):
        t = isolate(self)
        for i in range(4):
            audit.record("lab", "apply", dev=f"d{i}", ok=True)
        p = t / "audit" / "lab.jsonl"
        lines = p.read_text().splitlines()
        p.write_text("\n".join(lines[:2]) + "\n")  # the chain of the first two is still valid
        v = audit.verify("lab")
        self.assertFalse(v["ok"])
        self.assertIn("3 to 4 were removed", v["why"])
        p.unlink()
        self.assertIn("deleted", audit.verify("lab")["why"])

    def test_server_log_is_separate(self):
        t = isolate(self)
        audit.record(audit.SERVER, "monitor-config", backend="agent")
        self.assertTrue((t / "audit" / ".server.jsonl").is_file())
        self.assertEqual(audit.read(audit.SERVER)[0]["event"], "monitor-config")
        self.assertEqual(audit.read("server"), [], "a lab named server is a different log")
        self.assertTrue(audit.verify(audit.SERVER)["ok"])

    def test_long_transcripts_are_cut(self):
        isolate(self)
        e = audit.record("lab", "apply", transcript="y" * (audit.MAX_TEXT + 50))
        self.assertLess(len(e["transcript"]), audit.MAX_TEXT + 100)


class BackupTest(unittest.TestCase):
    def test_save_list_read(self):
        isolate(self)
        bid = backups.new_id()
        backups.save("lab", "dev_1", {"id": bid, "ts": 1, "driver": "ios", "config": "hostname a\n", "files": {}, "onDevice": "flash:x"})
        self.assertEqual(backups.list_for("lab", "dev_1")[0]["id"], bid)
        self.assertEqual(backups.read("lab", "dev_1", bid)["config"], "hostname a\n")
        self.assertIsNone(backups.read("lab", "dev_1", "../../etc/passwd"))
        with self.assertRaises(ValueError):
            backups.save("lab", "dev_1", {"id": "../x"})


DEV = {"id": "dev_1", "name": "sw1", "host": "192.0.2.10", "user": "admin", "auth": "key", "driver": "ios"}
DEV2 = {**DEV, "id": "dev_2", "name": "sw2", "host": "192.0.2.11"}
OPS = [{"op": "sw-access", "port": "Gi0/3", "vlan": 20}]


class ChangeSetTest(unittest.TestCase):
    def setUp(self):
        isolate(self)

    def test_stage_review_digest(self):
        doc = changes.create("lab", {"title": "VLAN 20 for printers"})
        doc = changes.add("lab", doc["id"], {"items": [{"device": DEV, "ops": OPS, "labels": ["Set VLAN 20"]}]})
        doc = changes.add("lab", doc["id"], {"items": [{"device": DEV, "ops": [{"op": "iface-desc", "port": "Gi0/3", "desc": "printer"}], "labels": ["desc"]}]})
        self.assertEqual(len(doc["items"]), 1, "a second stage for the same device adds to its item")
        self.assertIn(" description printer", doc["items"][0]["commands"])
        self.assertNotIn("params", doc["items"][0], "SSH settings stay on the server")
        doc = changes.add("lab", doc["id"], {"items": [{"device": DEV2, "ops": OPS}]})
        first = doc["digest"]
        doc = changes.edit("lab", doc["id"], {"move": "dev_2", "by": -1})
        self.assertEqual([it["dev"] for it in doc["items"]], ["dev_2", "dev_1"])
        self.assertNotEqual(doc["digest"], first, "the order is part of what is reviewed")
        with self.assertRaisesRegex(ValueError, "changed since you reviewed"):
            collector.change_apply("lab", doc["id"], {"digest": first})
        doc = changes.edit("lab", doc["id"], {"dropOp": ["dev_1", 1]})
        self.assertNotIn(" description printer", doc["items"][1]["commands"])
        changes.discard("lab", doc["id"])
        with self.assertRaisesRegex(ValueError, "discarded"):
            changes.add("lab", doc["id"], {"items": [{"device": DEV, "ops": OPS}]})
        events = [e["event"] for e in audit.read("lab")]
        for ev in ("change-created", "change-staged", "change-edited", "change-discarded"):
            self.assertIn(ev, events)

    def test_bad_ops_are_refused_when_staged(self):
        doc = changes.create("lab", {})
        with self.assertRaises(ValueError):
            changes.add("lab", doc["id"], {"items": [{"device": DEV, "ops": [{"op": "exec", "cmd": "reload"}]}]})


class FakeOpen:
    """Session.open: scripted results per host (an exception or a mock session)."""

    def __init__(self, fail_hosts=(), fail_after=None):
        self.calls, self.fail_hosts, self.fail_after = [], set(fail_hosts), fail_after

    def __call__(self, p, password=None, trust=None, on_trust=None):
        self.calls.append(p["host"])
        n = self.calls.count(p["host"])
        if p["host"] in self.fail_hosts and (self.fail_after is None or n > self.fail_after):
            raise OSError("timed out")
        return mock.Mock(host=p["host"])


class PushTest(unittest.TestCase):
    def setUp(self):
        isolate(self)
        self.facts = {"collected": 5, "driver": "ios", "errors": [], "rawConfig": "", "ok": True}
        self.patches = [mock.patch.object(ios, "backup", return_value={"config": "hostname sw1\n", "files": {}, "archive": "", "onDevice": "flash:lt-x.cfg"}),
                        mock.patch.object(ios, "collect", side_effect=lambda s: dict(self.facts)),
                        mock.patch.object(ios, "persist", return_value=(True, "[OK]")),
                        mock.patch.object(ios, "confirm", return_value=(True, "configure confirm")),
                        mock.patch.object(ios, "arm", return_value=({"mode": "revert", "minutes": 5}, "armed")),
                        mock.patch.object(ios, "restore", return_value=(True, "Rollback Done"))]
        self.m = {p.attribute: p.start() for p in self.patches}
        for p in self.patches:
            self.addCleanup(p.stop)

    def stage(self, *devs):
        doc = changes.create("lab", {"title": "t"})
        for d in devs:
            doc = changes.add("lab", doc["id"], {"items": [{"device": d, "ops": OPS}]})
        return doc

    def test_multi_device_apply_stops_at_the_first_failure(self):
        doc = self.stage(DEV, DEV2)
        calls = []

        def fake_apply(sess, cmds, **kw):
            calls.append(sess.host)
            return (sess.host != "192.0.2.10"), "% Invalid input"
        with mock.patch.object(ios, "apply", side_effect=fake_apply), mock.patch.object(collector.Session, "open", side_effect=FakeOpen()):
            snap = wait_job(collector.change_apply("lab", doc["id"], {"digest": doc["digest"], "rollback": 5, "save": True})["id"])
        d1, d2 = snap["devices"]["dev_1"], snap["devices"]["dev_2"]
        self.assertEqual(d1["state"], "error")
        self.assertTrue(d1["rolledBack"], "the backup is put back after a refused command")
        self.assertTrue(d1["backup"])
        self.assertEqual(d2["state"], "skipped")
        self.assertEqual(calls, ["192.0.2.10"])
        self.m["persist"].assert_not_called()
        self.assertEqual(changes.get("lab", doc["id"])["status"], "failed")
        self.assertEqual(len(backups.list_for("lab", "dev_1")), 1)
        ev = [e["event"] for e in audit.read("lab")]
        for x in ("change-apply", "backup", "rollback-armed", "apply", "rollback", "change-finished"):
            self.assertIn(x, ev)
        with self.assertRaisesRegex(ValueError, "failed"):
            changes.add("lab", doc["id"], {"items": [{"device": DEV, "ops": OPS}]})

    def test_confirm_then_save(self):
        doc = self.stage(DEV, DEV2)
        with mock.patch.object(ios, "apply", return_value=(True, "ok")) as ap, mock.patch.object(collector.Session, "open", side_effect=FakeOpen()):
            snap = wait_job(collector.change_apply("lab", doc["id"], {"digest": doc["digest"], "rollback": 5, "save": True})["id"])
        self.assertEqual({v["state"] for v in snap["devices"].values()}, {"done"})
        self.assertEqual(self.m["confirm"].call_count, 2)
        self.assertEqual(self.m["persist"].call_count, 2, "write memory after the confirmation")
        self.assertEqual(ap.call_args.kwargs["armed"], {"mode": "revert", "minutes": 5})
        self.assertFalse(ap.call_args.kwargs["save"])
        self.assertEqual(changes.get("lab", doc["id"])["status"], "applied")

    def test_unreachable_after_change_waits_for_the_device_rollback(self):
        doc = self.stage(DEV)
        with mock.patch.object(ios, "apply", return_value=(True, "ok")), \
                mock.patch.object(collector.Session, "open", side_effect=FakeOpen(fail_hosts={"192.0.2.10"}, fail_after=1)):
            snap = wait_job(collector.change_apply("lab", doc["id"], {"digest": doc["digest"], "rollback": 5})["id"])
        d1 = snap["devices"]["dev_1"]
        self.assertEqual(d1["state"], "pending")
        self.assertTrue(d1["rollbackPending"])
        self.assertIn("rolls back by itself", d1["error"])
        self.m["confirm"].assert_not_called()
        self.assertIn("unreachable", [e["event"] for e in audit.read("lab")])


# ---------------------------------------------------------------- Linux persistent push
PVE = json.loads((FIX / "linux-pve.facts.json").read_text())


class FakeExec:
    """Exec channel of a Linux host: scripted answers, files in a dict."""

    def __init__(self, files=None, fail=()):
        self.files, self.fail, self.ran = dict(files or {}), set(fail), []

    def run(self, cmd, timeout=30, stdin=None):
        self.ran.append((cmd, stdin))
        if any(f in cmd for f in self.fail):
            return 1, "", "failed"
        if cmd.startswith("cat ") or " cat " in cmd:
            path = cmd.split()[-1].strip("'")
            return (0, self.files[path], "") if path in self.files else (1, "", "No such file")
        if "tee " in cmd and stdin is not None:
            path = cmd.split("tee ")[1].split()[0].strip("'")
            self.files[path] = stdin if isinstance(stdin, str) else stdin.decode()
        return 0, "", ""


class LinuxPushTest(unittest.TestCase):
    def test_ifupdown2_edits_the_file_and_reloads(self):
        cmds, notes, extra = linux.render(ops.validate([
            {"op": "iface-ip", "port": "vmbr0", "ip": "192.168.20.12/24", "old": ["192.168.20.11/24"]},
            {"op": "route-add", "dest": "10.60.0.0/16", "via": "192.168.20.254"},
            {"op": "iface-enable", "port": "eno2", "enabled": True}]), PVE)
        self.assertTrue(extra["canApply"])
        self.assertIn("@write /etc/network/interfaces", cmds)
        self.assertIn("ifreload -a", cmds, "root login: no sudo")
        new = extra["files"][0]["content"]
        self.assertIn("\taddress 192.168.20.12/24", new, "the indentation of the file is kept")
        self.assertNotIn("192.168.20.11", new)
        self.assertIn("\tgateway 192.168.20.1", new, "other lines are kept")
        self.assertIn("up ip route add 10.60.0.0/16 via 192.168.20.254", new)
        self.assertIn("auto eno2", new)
        self.assertIn("source /etc/network/interfaces.d/*", new)
        self.assertTrue(any("ip link set dev eno2 down" in u for u in extra["undo"]))

    def test_networkmanager_and_netplan(self):
        f = json.loads(json.dumps(PVE))
        f["platform"] = {"uid": 1000, "sudo": True, "nm": {"eno1": "Wired connection 1"}, "ifupdown": False, "netplan": False, "systemdRun": True}
        f["interfaces"].append({"name": "eno1", "ips": ["192.168.30.5/24"], "kind": "eth"})
        cmds, _n, _e = linux.render(ops.validate([{"op": "iface-ip", "port": "eno1", "ip": "192.168.30.6/24", "old": ["192.168.30.5/24"]},
                                                  {"op": "route-add", "dest": "0.0.0.0/0", "via": "192.168.30.1"}]), f)
        self.assertIn("sudo -n nmcli connection modify 'Wired connection 1' ipv4.method manual ipv4.addresses 192.168.30.6/24", cmds)
        self.assertIn("sudo -n nmcli connection modify 'Wired connection 1' ipv4.gateway 192.168.30.1", cmds)
        self.assertIn("sudo -n nmcli device reapply eno1", cmds)
        f["platform"]["netplan"] = True
        cmds, notes, _e = linux.render(ops.validate([{"op": "iface-ip", "port": "eno1", "ip": "dhcp", "old": []}]), f)
        self.assertEqual(cmds[-1], "sudo -n netplan apply")
        self.assertIn("sudo -n netplan set ethernets.eno1.dhcp4=true", cmds)
        self.assertTrue(any("0.101" in n for n in notes))

    def test_no_platform_facts_no_apply(self):
        _c, notes, extra = linux.render(ops.validate([{"op": "hostname", "name": "a"}]), {"driver": "linux"})
        self.assertFalse(extra["canApply"])

    def test_apply_writes_the_reviewed_file_and_refuses_a_changed_one(self):
        cmds, _n, extra = linux.render(ops.validate([{"op": "iface-ip", "port": "vmbr0", "ip": "192.168.20.12/24", "old": []}]), PVE)
        old = PVE["platform"]["interfacesFile"]
        sess = FakeExec({"/etc/network/interfaces": old})
        ok, log = linux.apply(sess, cmds, extra=extra, facts=PVE)
        self.assertTrue(ok, log)
        self.assertIn("192.168.20.12/24", sess.files["/etc/network/interfaces"])
        self.assertIn("ifreload -a", [c for c, _ in sess.ran])
        sess = FakeExec({"/etc/network/interfaces": old + "# edited by hand\n"})
        ok, log = linux.apply(sess, cmds, extra=extra, facts=PVE)
        self.assertFalse(ok)
        self.assertIn("changed on the device since the last collect", log)
        self.assertNotIn("ifreload -a", [c for c, _ in sess.ran], "nothing runs after the refusal")

    def test_apply_needs_root_or_sudo(self):
        f = {**PVE, "platform": {**PVE["platform"], "uid": 1000}}
        ok, log = linux.apply(FakeExec(fail={"sudo -n true"}), ["sudo -n ip link set dev eno2 up"], facts=f)
        self.assertFalse(ok)
        self.assertIn("sudo without a password", log)

    def test_rollback_timer_and_confirm(self):
        sess = FakeExec()
        b = {"id": "20260101-000000-abcdef", "onDevice": "/var/backups/labtracer/20260101-000000-abcdef.tgz", "files": {"/etc/netplan/50.yaml": ""}}
        token, log = linux.arm(sess, b, 5, extra={"undo": ["ip addr del 1.2.3.4/24 dev eno1 || true"]}, facts=PVE)
        self.assertEqual(token, "labtracer-rollback-20260101-000000-abcdef")
        script = next(s for c, s in sess.ran if "rollback.sh" in c and s)
        self.assertIn("tar -xzf /var/backups/labtracer/20260101-000000-abcdef.tgz", script)
        self.assertIn("ip addr del 1.2.3.4/24 dev eno1", script)
        self.assertTrue(any("--on-active=5m" in c for c, _ in sess.ran))
        ok, _ = linux.confirm(sess, token, facts=PVE)
        self.assertTrue(ok)
        self.assertIn("systemctl stop labtracer-rollback-20260101-000000-abcdef.timer", sess.ran[-1][0])

    def test_backup_reads_the_archive(self):
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            data = b"auto lo\n"
            ti = tarfile.TarInfo("etc/network/interfaces")
            ti.size = len(data)
            tar.addfile(ti, io.BytesIO(data))
        b64 = base64.b64encode(buf.getvalue()).decode()

        class S(FakeExec):
            def run(self, cmd, timeout=30, stdin=None):
                return 0, b64[:40] + "\n" + b64[40:] + "\n", ""
        doc = linux.backup(S(), "20260101-000000-abcdef", facts=PVE)
        self.assertEqual(doc["files"], {"/etc/network/interfaces": "auto lo\n"})
        self.assertTrue(doc["onDevice"].endswith(".tgz"))

    @staticmethod
    def _archive(*members):
        """A .tgz with (TarInfo kwargs) members; files get a short body."""
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for m in members:
                ti = tarfile.TarInfo(m["name"])
                for k, v in m.items():
                    if k != "name":
                        setattr(ti, k, v)
                body = b"x\n" if ti.type == tarfile.REGTYPE else b""
                ti.size = len(body)
                tar.addfile(ti, io.BytesIO(body))
        return buf.getvalue()

    def test_restore_file_names_from_the_device_are_not_run(self):
        evil = "/etc/netplan/x' ;reboot; '.yaml"
        lines = linux._restore_lines({"files": {"/etc/netplan/50-cloud.yaml": "", evil: ""}}, "/var/backups/labtracer/r.tgz")
        self.assertIn("/etc/netplan/50-cloud.yaml", lines[1])
        self.assertNotIn("reboot", "".join(lines), "a name that is not a plain netplan file name is left out")
        lines = linux._restore_lines({"files": {}}, "/tmp/a b.tgz")
        self.assertIn("tar -xzf '/tmp/a b.tgz'", lines[0])
        self.assertNotIn("case", lines[1], "no files to keep: every netplan file is removed")

    def test_backup_keeps_only_network_config_files(self):
        raw = self._archive({"name": "etc/hostname"}, {"name": "etc/shadow"}, {"name": "etc/netplan/../../root/x"})
        b64 = base64.b64encode(raw).decode()

        class S(FakeExec):
            def run(self, cmd, timeout=30, stdin=None):
                return 0, b64, ""
        self.assertEqual(list(linux.backup(S(), "20260101-000000-abcdef", facts=PVE)["files"]), ["/etc/hostname"])

    def test_unsafe_archives_are_not_restored(self):
        ok = self._archive({"name": "etc/netplan", "type": tarfile.DIRTYPE}, {"name": "etc/netplan/50.yaml"},
                           {"name": "etc/hosts"}, {"name": "etc/netplan/link.yaml", "type": tarfile.SYMTYPE, "linkname": "50.yaml"})
        self.assertIsNone(linux._archive_problem(ok))
        bad = {
            "outside": self._archive({"name": "etc/cron.d/x"}),
            "dotdot": self._archive({"name": "etc/netplan/../../root/.ssh/authorized_keys"}),
            "abs link": self._archive({"name": "etc/hosts", "type": tarfile.SYMTYPE, "linkname": "/etc/shadow"}),
            "up link": self._archive({"name": "etc/hosts", "type": tarfile.SYMTYPE, "linkname": "../shadow"}),
            "hard link": self._archive({"name": "etc/hosts", "type": tarfile.LNKTYPE, "linkname": "etc/shadow"}),
            "device": self._archive({"name": "etc/hostname", "type": tarfile.CHRTYPE}),
            "garbage": b"not a tar",
        }
        for why, raw in bad.items():
            with self.subTest(why):
                self.assertTrue(linux._archive_problem(raw))
                sess = FakeExec()
                done, log = linux.restore(sess, {"id": "20260101-000000-abcdef", "archive": base64.b64encode(raw).decode()}, facts=PVE)
                self.assertFalse(done)
                self.assertIn("was not restored", log)
                self.assertEqual(sess.ran, [], "nothing is sent to the device")
        token, log = linux.arm(FakeExec(), {"id": "20260101-000000-abcdef", "onDevice": "/var/backups/labtracer/a.tgz",
                                            "archive": base64.b64encode(bad["dotdot"]).decode(), "files": {}}, 5, facts=PVE)
        self.assertIsNone(token)
        self.assertIn("No rollback timer", log)

    def test_interfaces_editor(self):
        e = linux.Ifaces("auto lo eth0\niface lo inet loopback\n\niface eth0 inet dhcp\n")
        e.set_auto("eth0", False)
        self.assertIn("auto lo\n", e.text())
        e.set_method("eth0", "static")
        e.add("eth0", "address 10.0.0.2/24", first=True)
        self.assertIn("iface eth0 inet static\n    address 10.0.0.2/24\n", e.text())
        e.set_method("eth9", "static")
        self.assertIn("auto eth9\niface eth9 inet static", e.text())


# ---------------------------------------------------------------- RouterOS
ROS = {
    "identity": "  name: edge-ros\n",
    "resource": "  version: 7.14.2 (stable)\n  board-name: hAP ac2\n",
    "routerboard": "  model: RBD52G-5HacD2HnD\n  serial-number: HEX12345\n",
    "export": ("# 2026-11-26 10:00:00 by RouterOS 7.14.2\n/interface bridge add name=bridge\n/interface vlan add interface=bridge name=vlan20 vlan-id=20\n"
               "/interface bridge port add bridge=bridge interface=ether2\n/ip address add address=192.168.88.1/24 interface=bridge\n"
               "/ip route add dst-address=0.0.0.0/0 gateway=203.0.113.1\n/ip route add dst-address=10.9.0.0/16 gateway=vlan20 routing-table=other\n"),
    "ifaces": (" 0  R  name=ether1 default-name=ether1 type=ether mtu=1500 mac-address=48:A9:8A:00:00:01 comment=\"wan uplink\"\n"
               " 1  RS name=ether2 type=ether mtu=1500 mac-address=48:A9:8A:00:00:02\n"
               " 2  X  name=ether3 type=ether mtu=1500 mac-address=48:A9:8A:00:00:03\n"
               " 3  R  name=bridge type=bridge mtu=1500 mac-address=48:A9:8A:00:00:02\n"
               " 4  R  name=vlan20 type=vlan mtu=1500 mac-address=48:A9:8A:00:00:02\n"),
    "addrs": (" 0   address=192.168.88.1/24 network=192.168.88.0 interface=bridge actual-interface=bridge\n"
              " 1 D address=203.0.113.7/24 network=203.0.113.0 interface=ether1 actual-interface=ether1\n"),
    "neighbors": " 0 interface=ether2,bridge address=192.168.88.2 address4=192.168.88.2 mac-address=00:1B:54:AA:BB:CC identity=rack-switch interface-name=Gi0/1\n",
    "arp": " 0 DC address=192.168.88.50 mac-address=A4:BB:6D:11:22:33 interface=bridge published=no\n",
    "hosts": (" 0 DL mac-address=48:A9:8A:00:00:02 on-interface=bridge bridge=bridge\n"
              " 1 D  mac-address=A4:BB:6D:11:22:33 on-interface=ether2 bridge=bridge\n"),
    "services": " 0   name=ssh port=22\n 1 X name=telnet port=23\n 2   name=winbox port=8291\n",
}


class RouterOsTest(unittest.TestCase):
    def test_parse(self):
        f = routeros.parse(ROS)
        self.assertEqual(f["system"]["hostname"], "edge-ros")
        self.assertEqual((f["system"]["model"], f["system"]["serial"], f["system"]["osVersion"]), ("RBD52G-5HacD2HnD", "HEX12345", "7.14.2"))
        by = {i["name"]: i for i in f["interfaces"]}
        self.assertEqual(by["ether1"]["desc"], "wan uplink")
        self.assertTrue(by["ether1"]["dhcp"])
        self.assertFalse(by["ether3"]["adminUp"])
        self.assertEqual(by["ether2"]["master"], "bridge")
        self.assertEqual((by["vlan20"]["kind"], by["vlan20"]["vlan"]), ("sub", 20))
        self.assertEqual(by["bridge"]["ips"], ["192.168.88.1/24"])
        self.assertEqual(f["routes"], [{"dest": "0.0.0.0/0", "via": "203.0.113.1", "dev": ""}], "other routing tables are left out")
        self.assertEqual(f["neighbors"][0]["remoteIp"], "192.168.88.2")
        self.assertEqual(f["neighbors"][0]["localPort"], "ether2")
        self.assertEqual(f["arp"], [{"ip": "192.168.88.50", "mac": "a4:bb:6d:11:22:33", "dev": "bridge"}])
        self.assertEqual(f["macTable"], [{"mac": "a4:bb:6d:11:22:33", "vlan": None, "port": "ether2"}], "local entries are left out")
        self.assertEqual([x["port"] for x in f["listening"]], [22, 8291])
        self.assertNotIn("# 2026", f["rawConfig"])

    def test_render_quotes_and_refuses_switch_changes(self):
        cmds, notes = routeros.render(ops.validate([
            {"op": "iface-desc", "port": "ether1", "desc": 'wan "x" $(y) [z]'},
            {"op": "iface-ip", "port": "ether2", "ip": "10.0.0.2/24", "old": ["10.0.0.1/24"]},
            {"op": "route-del", "dest": "0.0.0.0/0", "via": "203.0.113.1"},
            {"op": "sw-access", "port": "ether2", "vlan": 20}]))
        self.assertIn('/interface set [find name="ether1"] comment="wan x (y) z"', cmds)
        self.assertIn('/ip address remove [find address="10.0.0.1/24" and interface="ether2"]', cmds)
        self.assertIn("/ip address add address=10.0.0.2/24 interface=ether2", cmds)
        self.assertIn('/ip route remove [find dst-address="0.0.0.0/0" and gateway="203.0.113.1"]', cmds)
        self.assertTrue(any("sw-access" in n for n in notes))

    def test_apply_stops_on_an_error(self):
        sess = FakeExec()
        sess.run = lambda cmd, timeout=30, stdin=None: (0, "failure: already have such address" if "address add" in cmd else "", "")
        ok, log = routeros.apply(sess, ["/system identity set name=a", "/ip address add address=1.2.3.4/24 interface=ether1", "/x"])
        self.assertFalse(ok)
        self.assertNotIn("> /x", log)


# ---------------------------------------------------------------- IOS backup and timer
class DialogIos:
    """An IOS CLI that asks questions: copy (destination filename), reload in (confirm)."""

    def __init__(self, archive=False):
        self.queue, self.sent, self.archive, self.asking = [], [], archive, None

    def settimeout(self, t):
        pass

    def send(self, s):
        self.sent.append(s)
        if self.asking:
            q, self.asking = self.asking, None
            self.queue.append(q + "\r\nsw1#")
            return
        cmd = s.strip()
        if s == "\n":
            self.queue.append("\r\nsw1#")
        elif cmd.startswith("copy running-config"):
            self.queue.append(f"{cmd}\r\nDestination filename [{cmd.split(':')[-1]}]? ")
            self.asking = "2914 bytes copied in 0.2 secs"
        elif cmd.startswith("reload in"):
            self.queue.append(f"{cmd}\r\nProceed with reload? [confirm]")
            self.asking = "Reload scheduled in 5 minutes"
        elif cmd == "show archive":
            self.queue.append(f"{cmd}\r\n" + ("The maximum archive configurations allowed is 10.\r\nThere are currently 1 archive configurations saved.\r\n" if self.archive
                                               else "Archive feature not enabled\r\n") + "sw1#")
        elif cmd == "show running-config":
            self.queue.append(f"{cmd}\r\nBuilding configuration...\r\nhostname sw1\r\ninterface Gi0/1\r\n!\r\nend\r\nsw1#")
        else:
            self.queue.append(f"{cmd}\r\nsw1#")

    def recv(self, n):
        if not self.queue:
            raise socket.timeout()
        return self.queue.pop(0).encode()


class Sess:
    def __init__(self, chan):
        self.sh = Shell(chan)

    def shell(self):
        return self.sh


class IosSafetyTest(unittest.TestCase):
    def test_backup_answers_the_copy_question(self):
        doc = ios.backup(Sess(DialogIos()), "20260101-000000-abcdef")
        self.assertEqual(doc["onDevice"], "flash:lt-20260101-000000-abcdef.cfg")
        self.assertIn("hostname sw1", doc["config"])
        self.assertNotIn("Building configuration", doc["config"])

    def test_timer_without_and_with_archive(self):
        ch = DialogIos()
        token, _log = ios.arm(Sess(ch), {}, 5)
        self.assertEqual(token, {"mode": "reload", "minutes": 5})
        self.assertIn("\n", ch.sent, "the [confirm] question is answered")
        token, _log = ios.arm(Sess(DialogIos(archive=True)), {}, 5)
        self.assertEqual(token["mode"], "revert")

    def test_restore_needs_a_copy_on_the_device(self):
        ok, msg = ios.restore(Sess(DialogIos()), {"onDevice": ""})
        self.assertFalse(ok)
        self.assertIn("no copy on the device", msg)
        ok, msg = ios.restore(Sess(DialogIos()), {"onDevice": "flash:x; reload"})
        self.assertFalse(ok)


# ---------------------------------------------------------------- Guacamole tunnel
class GuacTest(unittest.TestCase):
    def test_encode_and_parse(self):
        s = guac.instr("key", "65307", "1") + guac.instr("", "ping", "123") + "4.size,3.10"
        ins, rest, done = guac.parse(s)
        self.assertEqual(ins, [["key", "65307", "1"], ["", "ping", "123"]])
        self.assertEqual(rest, "4.size,3.10")
        self.assertEqual(done + rest, s)
        self.assertEqual(guac.parse(guac.instr("clipboard", "héllo ✓")), ([["clipboard", "héllo ✓"]], "", guac.instr("clipboard", "héllo ✓")))
        with self.assertRaises(ValueError):
            guac.parse("4.key;x")

    def test_validate(self):
        p = guac.validate({"protocol": "rdp", "host": "192.0.2.5", "user": "DOMAIN\\admin", "password": "pw", "width": 99999})
        self.assertEqual((p["port"], p["width"]), (3389, 7680))
        for bad in ({"protocol": "http", "host": "a"}, {"protocol": "rdp", "host": "-oProxyCommand=x"},
                    {"protocol": "vnc", "host": "a", "user": "a;b"}, {"protocol": "rdp", "host": "a", "security": "none"}):
            with self.subTest(bad), self.assertRaises(ValueError):
                guac.validate(bad)
        params = guac.connect_params(guac.validate({"protocol": "rdp", "host": "h", "password": "x"}))
        self.assertEqual(params["enable-drive"], "")
        self.assertNotIn("drive-path", params)
        self.assertNotIn("recording-path", params)

    def fake_guacd(self, srv, got):
        conn, _ = srv.accept()
        buf = ""
        while ";" not in buf:
            buf += conn.recv(4096).decode()
        got.append(buf)
        conn.sendall(guac.instr("args", "VERSION_1_5_0", "hostname", "port", "username", "password", "drive-path").encode())
        buf = ""
        while "7.connect" not in buf:
            buf += conn.recv(4096).decode()
        got.append(buf)
        conn.sendall((guac.instr("ready", "$abc") + guac.instr("sync", "1")).encode())
        buf = ""
        try:
            while True:
                data = conn.recv(4096)
                if not data:
                    break
                buf += data.decode()
        except OSError:
            pass
        got.append(buf)
        conn.close()

    def test_handshake_relay_and_filter(self):
        srv = socket.socket()
        srv.bind(("127.0.0.1", 0))
        srv.listen(1)
        got = []
        t = threading.Thread(target=self.fake_guacd, args=(srv, got), daemon=True)
        t.start()

        class WS:
            def __init__(self):
                self.out, self.closed = [], False
                self.inbox = [guac.instr("", "ping", "42"), guac.instr("key", "97", "1"), guac.instr("file", "1", "a.exe")]

            def send_text(self, s):
                self.out.append(s)

            def recv(self):
                time.sleep(0.05)
                return (0x1, self.inbox.pop(0).encode()) if self.inbox else (None, None)

            def close(self, code=1000):
                self.closed = True
        ws = WS()
        p = guac.validate({"protocol": "rdp", "host": "192.0.2.9", "user": "u", "password": "secret"})
        with mock.patch.object(guac, "config", return_value={"guacd": f"127.0.0.1:{srv.getsockname()[1]}", "tls": False, "cafile": "", "insecure": False}):
            guac.run(ws, p)
        t.join(3)
        srv.close()
        self.assertEqual(got[0], guac.instr("select", "rdp"))
        connect = guac.parse(got[1][got[1].index("7.connect"):])[0][0]
        self.assertEqual(connect, ["connect", "VERSION_1_5_0", "192.0.2.9", "3389", "u", "secret", ""], "values in the order guacd asked; drive-path stays empty")
        self.assertTrue(ws.out[0].startswith("0.,32."), "the tunnel UUID first")
        self.assertIn(guac.instr("sync", "1"), "".join(ws.out))
        self.assertIn(guac.instr("", "ping", "42"), ws.out, "the ping is answered by server.py")
        self.assertIn(guac.instr("key", "97", "1"), got[2], "input reaches guacd")
        self.assertNotIn("file", got[2], "a file upload from the browser is refused")
        self.assertTrue(ws.closed)
        self.assertEqual(p["password"], "", "the password is dropped after the connect")


# ---------------------------------------------------------------- monitoring backends
class Fake(BaseHTTPRequestHandler):
    routes = {}

    def log_message(self, *a):
        pass

    def _send(self, obj):
        b = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        Fake.seen.append((self.path, dict(self.headers)))
        self._send(Fake.routes[self.path.split("?")[0] + ("?" + self.path.split("?")[1].split("&")[0] if "?" in self.path else "")])

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Fake.seen.append((body["method"], dict(self.headers)))
        self._send({"jsonrpc": "2.0", "result": Fake.routes[body["method"]], "id": 1})


TARGETS = [{"id": "d1", "name": "srv-01", "checks": [{"type": "ping", "host": "192.168.20.11"}]},
           {"id": "d2", "name": "rack-switch", "checks": [{"type": "ping", "host": "192.168.10.2"}]}]


class MonitoringTest(unittest.TestCase):
    def setUp(self):
        Fake.seen = []
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.cfg = {"url": f"http://127.0.0.1:{self.srv.server_port}", "secret": "tok"}
        monitoring._hist.clear()
        monitoring._since.clear()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()

    def test_prometheus(self):
        Fake.routes = {"/api/v1/query?query=up": {"status": "success", "data": {"result": [
            {"metric": {"instance": "192.168.20.11:9100", "job": "node"}, "value": [1, "1"]},
            {"metric": {"instance": "rack-switch.lab:9116", "job": "snmp"}, "value": [1, "0"]}]}},
            "/api/v1/query?query=probe_success": {"status": "success", "data": {"result": [
                {"metric": {"instance": "192.168.20.11", "job": "icmp"}, "value": [1, "0"]}]}}}
        st = monitoring.status({**self.cfg, "backend": "prometheus"}, TARGETS)
        self.assertEqual(st["devices"]["d1"]["state"], "degraded")
        self.assertEqual(st["devices"]["d2"]["state"], "down", "matched by name")
        self.assertEqual(Fake.seen[0][1].get("Authorization"), "Bearer tok")
        self.assertEqual(len(st["devices"]["d1"]["history"]), 1)

    def test_zabbix(self):
        Fake.routes = {"host.get": [{"hostid": "1", "host": "srv-01", "interfaces": [{"ip": "192.168.20.11", "available": "1"}]},
                                    {"hostid": "2", "host": "sw", "interfaces": [{"ip": "192.168.10.2", "available": "2"}]}],
                       "problem.get": [{"objectid": "9", "name": "Disk full", "severity": "4"}],
                       "trigger.get": [{"triggerid": "9", "hosts": [{"hostid": "1"}]}]}
        st = monitoring.status({**self.cfg, "backend": "zabbix"}, TARGETS)
        self.assertEqual(st["devices"]["d1"]["state"], "degraded")
        self.assertEqual(st["devices"]["d1"]["checks"][1]["state"], "high")
        self.assertEqual(st["devices"]["d2"]["state"], "down")

    def test_icinga2_and_librenms(self):
        Fake.routes = {"/v1/objects/hosts?attrs=name": {"results": [{"attrs": {"name": "srv-01", "address": "192.168.20.11", "state": 0}}]},
                       "/v1/objects/services?attrs=host_name": {"results": [{"attrs": {"host_name": "srv-01", "display_name": "ssh", "state": 2}}]}}
        st = monitoring.status({**self.cfg, "backend": "icinga2", "user": "api", "secret": "pw"}, TARGETS)
        self.assertEqual(st["devices"]["d1"]["state"], "degraded")
        self.assertTrue(Fake.seen[0][1]["Authorization"].startswith("Basic "))
        Fake.routes = {"/api/v0/devices?type=active": {"devices": [{"device_id": 5, "hostname": "192.168.10.2", "status": 0, "status_reason": "icmp"}]},
                       "/api/v0/alerts?state=1": {"alerts": []}}
        st = monitoring.status({**self.cfg, "backend": "librenms"}, TARGETS)
        self.assertEqual(st["devices"]["d2"]["state"], "down")
        self.assertEqual(Fake.seen[-1][1]["X-Auth-Token"], "tok")


# ---------------------------------------------------------------- discovery helpers
class DiscoverTest(unittest.TestCase):
    def test_expand(self):
        self.assertEqual(discover.expand(["10.0.0.0/30"]), ["10.0.0.1", "10.0.0.2"])
        self.assertEqual(discover.expand(["10.0.0.5-7", "10.0.0.6"]), ["10.0.0.5", "10.0.0.6", "10.0.0.7"])
        for bad in (["10.0.0.0/8"], ["hello"], ["10.0.0.9-10.0.0.1"]):
            with self.subTest(bad), self.assertRaises(ValueError):
                discover.expand(bad)

    def test_expand_refuses_link_local_reserved_and_public(self):
        for bad, why in ((["169.254.169.254"], "link-local"), (["169.254.0.0/24"], "link-local"),
                         (["240.0.0.1"], "reserved"), (["8.8.8.0/30"], "public"), (["10.0.0.1", "1.1.1.1"], "public")):
            with self.subTest(bad), self.assertRaisesRegex(ValueError, why):
                discover.expand(bad)
        self.assertEqual(discover.expand(["8.8.8.8"], allow_public=True), ["8.8.8.8"])
        with self.assertRaisesRegex(ValueError, "link-local"):
            discover.expand(["169.254.169.254"], allow_public=True)
        self.assertEqual(len(discover.expand(["100.64.0.0/30", "172.16.0.1", "192.168.1.1"])), 4, "CGNAT and private are allowed")

    def test_a_password_is_never_sent_on_first_use(self):
        h = {"ip": "10.0.0.9", "ssh": {"state": "none"}}
        p = {"host": "0.0.0.0", "port": 22, "user": "admin", "auth": "password", "keyFile": "", "engine": "paramiko", "legacy": False}
        with mock.patch.object(discover.Session, "open", side_effect=RuntimeError("stop")) as op:
            discover._identify(h, p, "pw", {}, True, "lab")
            self.assertIsNone(op.call_args.args[2], "with a password, an unknown host key is not trusted")
            discover._identify(h, p, "pw", {"10.0.0.9": "SHA256:abc"}, True, "lab")
            self.assertEqual(op.call_args.args[2], "SHA256:abc", "a fingerprint the user confirmed is used")
            discover._identify(h, p, None, {}, True, "lab")
            self.assertIs(op.call_args.args[2], True, "key login: trust on first use as asked")

    def test_runs_are_limited_over_all_labs(self):
        with mock.patch.dict(discover._running, {"a": "j1", "b": "j2"}), \
                self.assertRaisesRegex(ValueError, "running already"):
            discover.start("c", {"ranges": ["10.0.0.1"]}, collector.new_job, collector.changed)

    def test_crawl_follows_neighbors_and_arp(self):
        f = json.loads((FIX / "ios-switch.facts.json").read_text())
        hosts = {"192.168.10.2": {"ip": "192.168.10.2", "facts": f, "mac": ""}}
        more = dict(discover._more(hosts, {"crawl": True, "subnets": False, "scope": ["192.168.10.0/24"]}, {"192.168.10.2"}))
        self.assertEqual(more.get("192.168.10.1"), "neighbor", "LLDP management address")
        self.assertIn("192.168.10.50", more, "ARP table")
        more = dict(discover._more(hosts, {"crawl": False, "subnets": True, "scope": []}, set()))
        self.assertEqual(len(more), 254, "the /24 of Vlan10")

    def test_adopt_and_off_on_network_bind(self):
        isolate(self)
        discover._save("lab", {"hosts": [{"ip": "192.0.2.1", "facts": {"collected": 1, "driver": "linux", "rawConfig": ""}}, {"ip": "192.0.2.2"}]})
        r = discover.adopt("lab", {"map": {"192.0.2.1": "dev_9", "192.0.2.2": "dev_8"}})
        self.assertEqual(r["facts"], 1)
        self.assertEqual(store.read("lab", "dev_9")["facts"]["driver"], "linux")
        with mock.patch.object(collector.ssh_bridge, "ENABLED", False), self.assertRaises(PermissionError):
            discover.start("lab", {"ranges": ["192.0.2.0/30"]}, collector.new_job, collector.changed)


if __name__ == "__main__":
    unittest.main()
