"""Cisco IOS / IOS-XE driver (also fits many IOS-like CLIs). Read-only.

Runs show commands in an interactive CLI. The running-config is the main source
(interfaces, switchport, addresses, static routes); show ip interface brief adds
the line state, show vlan brief the VLAN database, LLDP or CDP the neighbors.
show running-config needs privilege 15: with a '>' prompt the report says so.
"""

import re

from ..facts import cidr, iface, ip_only, neighbor, new_facts, norm_dest, norm_mac

NAME = "ios"
INVALID = re.compile(r"^\s*% ?(Invalid input|Incomplete command|Ambiguous command|Unknown command)|is not enabled|not running", re.I | re.M)
VOLATILE = re.compile(r"^(?:Building configuration|Current configuration :|! Last configuration change|! NVRAM config last updated|ntp clock-period).*\n?", re.M)


def collect(sess):
    sh = sess.shell()
    sh.cmd("terminal length 0")
    sh.cmd("terminal width 511")
    out = {"prompt": sh.prompt, "privileged": sh.privileged}
    for key, cmd, t in (("version", "show version", 30), ("inventory", "show inventory", 30),
                        ("run", "show running-config", 90), ("brief", "show ip interface brief", 30),
                        ("vlan", "show vlan brief", 30), ("lldp", "show lldp neighbors detail", 30)):
        out[key] = sh.cmd(cmd, timeout=t)
    if bad(out["lldp"]) or not out["lldp"].strip():
        out["cdp"] = sh.cmd("show cdp neighbors detail")
    out["arp"] = sh.cmd("show ip arp", timeout=30)
    out["mac"] = sh.cmd("show mac address-table dynamic", timeout=30)
    if bad(out["mac"]):
        out["mac"] = sh.cmd("show mac-address-table dynamic", timeout=30)
    return parse(out)


def bad(text):
    return bool(INVALID.search(text or ""))


def parse(o):
    f = new_facts(NAME)
    s = f["system"]
    s["vendor"] = "Cisco"
    run = o.get("run", "")
    have_run = bool(run) and not bad(run) and "interface " in run
    if not have_run:
        f["errors"].append("show running-config gave no config. The login needs privilege 15 (the prompt must end with #)."
                           if not o.get("privileged", True) else "show running-config gave no config.")
    m = re.search(r"(?m)^hostname (\S+)", run)
    s["hostname"] = m.group(1) if m else re.split(r"[>#(]", o.get("prompt", ""), maxsplit=1)[0]
    _system(o, s)
    is_switch = not bad(o.get("vlan", "")) and bool(re.search(r"(?m)^\d+\s+\S+\s+(active|act/)", o.get("vlan", "")))
    if have_run:
        f["rawConfig"] = VOLATILE.sub("", run).strip("\n") + "\n"
        f["rawConfig"] = re.sub(r"\n{2,}", "\n", f["rawConfig"]).lstrip("\n")
        f["interfaces"] = _interfaces(run, is_switch)
        f["routes"] = _routes(run)
    _apply_brief(f["interfaces"], o.get("brief", ""), have_run)
    if is_switch:
        f["vlans"] = [{"id": int(v), "name": n} for v, n in re.findall(r"(?m)^(\d{1,4})\s+(\S+)\s+(?:active|act/\S+|suspended)", o["vlan"])
                      if not 1002 <= int(v) <= 1005]
    lldp = o.get("lldp", "")
    if lldp.strip() and not bad(lldp):
        f["neighbors"] = _lldp(lldp)
    elif o.get("cdp", "").strip() and not bad(o.get("cdp", "")):
        f["neighbors"] = _cdp(o["cdp"])
    if o.get("arp", "").strip() and not bad(o["arp"]):
        f["arp"] = _arp(o["arp"])
    if is_switch and o.get("mac", "").strip() and not bad(o["mac"]):
        f["macTable"] = _mac_table(o["mac"])
    return f


def _system(o, s):
    ver, inv = o.get("version", ""), o.get("inventory", "")
    pid = re.search(r"PID:\s*([^\s,]+)\s*,.*?SN:\s*([^\s,]*)", inv)
    if pid:
        s["model"], s["serial"] = pid.group(1), pid.group(2)
    if not s["model"]:
        m = re.search(r"(?mi)^Model number\s*:\s*(\S+)", ver) or re.search(r"(?mi)^cisco (\S+) .*?processor", ver)
        if m:
            s["model"] = m.group(1)
    if not s["serial"]:
        m = re.search(r"(?mi)^System serial number\s*:\s*(\S+)", ver) or re.search(r"Processor board ID (\S+)", ver)
        if m:
            s["serial"] = m.group(1)
    v = re.search(r"Version ([^,\s]+)", ver)
    s["osVersion"] = v.group(1) if v else ""
    s["os"] = "Cisco IOS-XE" if "IOS-XE" in ver or "IOS XE" in ver else ("Cisco IOS" if ver and not bad(ver) else "")


def _kind(name):
    n = name.lower()
    if n.startswith("vlan"):
        return "svi"
    if n.startswith("loopback"):
        return "loop"
    if n.startswith("tunnel"):
        return "tunnel"
    if "." in n:
        return "sub"
    if n.startswith(("tengig", "twentyfive", "fortyg", "hundredg", "te", "fo", "hu")):
        return "sfp"
    return "eth"


def _interfaces(run, is_switch):
    out = []
    for m in re.finditer(r"(?m)^interface (\S+)[^\n]*\n((?:[ \t][^\n]*\n?)*)", run):
        name, body = m.group(1), m.group(2)
        lines = [ln.strip() for ln in body.splitlines()]
        kind = _kind(name)
        i = iface(name, kind=kind, adminUp="shutdown" not in lines)
        trunk_allowed = None
        mode = None
        for ln in lines:
            if ln.startswith("description "):
                i["desc"] = ln[len("description "):]
            elif ln.startswith("ip address dhcp"):
                i["dhcp"] = True
            elif ln.startswith("ip address "):
                p = ln.split()
                if len(p) >= 4:
                    c = cidr(p[2], p[3])
                    if c:
                        i["ips"].append(c)
            elif ln.startswith("mac-address "):
                i["mac"] = norm_mac(ln.split()[1])
            elif ln.startswith("mtu "):
                i["mtu"] = int(ln.split()[1]) if ln.split()[1].isdigit() else None
            elif ln == "switchport mode trunk":
                mode = "trunk"
            elif ln == "switchport mode access":
                mode = "access"
            elif ln == "no switchport":
                mode = "routed"
            elif ln.startswith("switchport access vlan "):
                i["vlan"] = _int(ln.split()[-1])
            elif ln.startswith("switchport trunk native vlan "):
                i["nativeVlan"] = _int(ln.split()[-1])
            elif ln.startswith("switchport trunk allowed vlan add "):
                trunk_allowed = (trunk_allowed + "," if trunk_allowed else "") + ln.split()[-1]
            elif ln.startswith("switchport trunk allowed vlan "):
                trunk_allowed = ln.split()[-1]
            elif ln.startswith("encapsulation dot1q ") or ln.startswith("encapsulation dot1Q "):
                i["vlan"] = _int(ln.split()[2])
        if kind in ("svi", "loop", "tunnel", "sub"):
            mode = "routed"
        elif mode is None:
            mode = "access" if is_switch else ("routed" if i["ips"] or i["dhcp"] else None)
        i["mode"] = mode
        if mode == "access" and i["vlan"] is None:
            i["vlan"] = 1
        if mode == "trunk":
            i["nativeVlan"] = i["nativeVlan"] or 1
            i["trunkVlans"] = _norm_vlans(trunk_allowed)
        out.append(i)
    return out


def _norm_vlans(spec):
    if not spec or spec in ("all", "1-4094", "1-4095"):
        return "all"
    if spec == "none":
        return "none"
    return spec


def _int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


BRIEF = re.compile(r"(?m)^(\S+)\s+(\S+)\s+(?:YES|NO)\s+\S+\s+(administratively down|up|down|deleted)\s+(up|down)")


def _apply_brief(ifs, text, have_run):
    by = {i["name"].lower(): i for i in ifs}
    for name, ip, status, proto in BRIEF.findall(text or ""):
        i = by.get(name.lower())
        if i is None:
            if have_run:
                continue
            i = iface(name, kind=_kind(name), adminUp=status != "administratively down")
            ifs.append(i)
            by[name.lower()] = i
        i["operUp"] = proto == "up"


def _routes(run):
    out = []
    for line in re.findall(r"(?m)^ip route (?!vrf )(.+)$", run):
        p = line.split()
        if len(p) < 3:
            continue
        dest = "0.0.0.0/0" if p[0] == "0.0.0.0" and p[1] == "0.0.0.0" else norm_dest(cidr(p[0], p[1]))
        rest = p[2:]
        via, dev = "", ""
        if re.match(r"^\d+\.\d+\.\d+\.\d+$", rest[0]):
            via = rest[0]
        else:
            dev = rest[0]
            if len(rest) > 1 and re.match(r"^\d+\.\d+\.\d+\.\d+$", rest[1]):
                via, dev = rest[1], ""
        out.append({"dest": dest, "via": via, "dev": dev})
    gw = re.search(r"(?m)^ip default-gateway (\S+)", run)
    if gw and not any(r["dest"] == "0.0.0.0/0" for r in out):
        out.append({"dest": "0.0.0.0/0", "via": gw.group(1), "dev": ""})
    return out


def _lldp(text):
    out = []
    for block in re.split(r"(?m)^(?=Local Intf:)", text):
        li = re.search(r"Local Intf:\s*(\S+)", block)
        if not li:
            continue
        name = re.search(r"System Name:\s*(\S+)", block)
        port = re.search(r"Port id:\s*(\S+)", block)
        chassis = re.search(r"Chassis id:\s*(\S+)", block)
        mgmt = re.search(r"Management Addresses:\s*\n\s*IP(?:v4)?:\s*(\S+)", block)
        out.append(neighbor(li.group(1), name.group(1) if name else "", port.group(1) if port else "",
                            chassis.group(1) if chassis else "", mgmt.group(1) if mgmt else ""))
    return out


def _cdp(text):
    out = []
    for block in re.split(r"(?m)^(?=Device ID:)", text):
        dev = re.search(r"Device ID:\s*(\S+)", block)
        intf = re.search(r"Interface:\s*([^,\s]+),\s*Port ID \(outgoing port\):\s*(\S+)", block)
        ip = re.search(r"IP(?:v4)? address:\s*(\S+)", block)
        if dev and intf:
            out.append(neighbor(intf.group(1), dev.group(1), intf.group(2), "", ip.group(1) if ip else ""))
    return out


def _arp(text):
    out = []
    for ip, mac, dev in re.findall(r"(?m)^Internet\s+(\S+)\s+\S+\s+([0-9a-fA-F.]{14})\s+\S+\s*(\S*)", text):
        ip, mac = ip_only(ip), norm_mac(mac)
        if ip and mac:
            out.append({"ip": ip, "mac": mac, "dev": dev})
    return out


def _mac_table(text):
    """show mac address-table dynamic: '  10    0011.2233.4455    DYNAMIC     Gi0/3'."""
    out = []
    for vlan, mac, port in re.findall(r"(?mi)^\s*\*?\s*(\d{1,4})\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+dynamic\s+(?:\S+\s+)*?([A-Za-z][\w/.:-]*\d)\s*$", text):
        if norm_mac(mac):
            out.append({"mac": norm_mac(mac), "vlan": int(vlan), "port": port})
    return out


# ---------------------------------------------------------------- remediation
def _mask(prefix_cidr):
    import ipaddress
    n = ipaddress.IPv4Interface(prefix_cidr)
    return str(n.ip), str(n.netmask)


def _route_cmd(o):
    import ipaddress
    net = ipaddress.IPv4Network(o["dest"])
    return f"ip route {net.network_address} {net.netmask} " + (o["via"] if o["via"] else o["dev"])


def render(ops):
    """Validated operations (collector/ops.py) -> (IOS commands, notes)."""
    cmds, notes = ["configure terminal"], []
    for o in ops:
        if o["op"] in ("vlan-add", "vlan-name"):
            cmds += [f"vlan {o['id']}", f" name {o['name']}", "exit"]
        elif o["op"] == "vlan-del":
            cmds.append(f"no vlan {o['id']}")
    ports = []
    for o in ops:
        if "port" in o and o["port"] not in ports:
            ports.append(o["port"])
    for port in ports:
        lines = []
        for o in ops:
            if o.get("port") != port:
                continue
            op = o["op"]
            if op == "iface-desc":
                d = o["desc"].replace("?", "")  # '?' asks the IOS CLI for help
                lines.append(f" description {d}" if d else " no description")
            elif op == "iface-enable":
                lines.append(" no shutdown" if o["enabled"] else " shutdown")
            elif op == "iface-ip":
                if o["ip"] == "dhcp":
                    lines.append(" ip address dhcp")
                elif o["ip"]:
                    lines.append(" ip address %s %s" % _mask(o["ip"]))
                else:
                    lines.append(" no ip address")
            elif op == "sw-access":
                lines += [" switchport mode access", f" switchport access vlan {o['vlan']}"]
            elif op == "sw-trunk":
                lines += [" switchport mode trunk", f" switchport trunk native vlan {o['nativeVlan']}",
                          f" switchport trunk allowed vlan {o['trunkVlans']}"]
                notes.append("Some switches need \"switchport trunk encapsulation dot1q\" before \"switchport mode trunk\". "
                             "If the device refuses the mode, add that line in the console.")
            elif op == "sw-routed":
                lines.append(" no switchport")
        cmds += [f"interface {port}", *lines, "exit"]
    for o in ops:
        if o["op"] == "route-del":
            cmds.append("no " + _route_cmd(o))
    for o in ops:
        if o["op"] == "route-add":
            cmds.append(_route_cmd(o))
    for o in ops:
        if o["op"] == "hostname":
            cmds.append(f"hostname {o['name']}")
    cmds.append("end")
    return cmds, sorted(set(notes))


def apply(sess, cmds, save=False, armed=None, extra=None, facts=None):
    """Run reviewed commands one by one. Stops at the first command the device refuses.
    armed: the token of arm(); with a revert timer, "configure terminal" starts it.
    Returns (ok, transcript)."""
    sh = sess.shell()
    sh.cmd("terminal length 0")
    if not sh.privileged:
        return False, f"{sh.prompt}\n! The login has no privilege 15 (the prompt must end with #). Nothing was changed."
    if armed and armed.get("mode") == "revert":
        cmds = [f"configure terminal revert timer {armed['minutes']}" if c.strip() == "configure terminal" else c for c in cmds]
    log, ok = [], True
    for c in cmds:
        before = sh.prompt
        out = sh.cmd(c.strip(), timeout=60)
        log.append(f"{before}{c.strip()}")
        if out.strip():
            log.append(out.rstrip())
        if bad(out):
            ok = False
            log.append("! Stopped: the device refused this command. The commands before it are applied (running-config only).")
            if c.strip() != "end":
                sh.cmd("end")
            break
    if ok and save:
        before = sh.prompt
        out = sh.cmd("write memory", timeout=120)
        log += [f"{before}write memory", out.rstrip()]
        if bad(out) or "OK" not in out:
            ok = False
            log.append("! write memory did not report OK.")
    return ok, "\n".join(x for x in log if x is not None)


# ---------------------------------------------------------------- backup, rollback timer, restore
# Before a change: the running-config is read (kept by LabTracer) and copied to flash:
# (or bootflash:) as lt-<backup id>.cfg, so "configure replace" can restore it on the device.
# Rollback timer, when the device has the archive feature: "configure terminal revert timer N"
# reverts the change by itself unless "configure confirm" follows. Without archive: "reload in N"
# (the device reboots into its startup-config, which LabTracer does not change before the
# confirmation) unless "reload cancel" follows.
ROLLBACK = "configure revert timer (archive) or reload in N, cancelled when LabTracer reaches the device again"
COPY_ANSWERS = [(r"Destination filename \[[^\]]*\]\?", "\n"), (r"\[confirm\]", "\n"), (r"Do you want to over ?write\?", "y\n")]


def backup(sess, backup_id, facts=None):
    sh = sess.shell()
    sh.cmd("terminal length 0")
    run = sh.cmd("show running-config", timeout=90)
    if bad(run) or "interface " not in run:
        raise ValueError("could not read the running-config for the backup (privilege 15 needed). Nothing was changed.")
    config = re.sub(r"\n{2,}", "\n", VOLATILE.sub("", run).strip("\n")) + "\n"
    on_dev = ""
    for fs in ("flash:", "bootflash:"):
        name = f"{fs}lt-{backup_id}.cfg"
        out = sh.cmd(f"copy running-config {name}", timeout=90, answers=COPY_ANSWERS)
        if not bad(out) and not re.search(r"(?i)%?\s*error|invalid|not (found|supported)|no space", out):
            on_dev = name
            break
    return {"config": config, "files": {}, "archive": "", "onDevice": on_dev}


def arm(sess, backup_doc, minutes, extra=None, facts=None):
    """Returns (token, transcript). token: {"mode": "revert" | "reload", "minutes"}."""
    sh = sess.shell()
    minutes = max(2, min(60, int(minutes)))
    arch = sh.cmd("show archive", timeout=30)
    if not bad(arch) and re.search(r"(?i)archive configurations|There are currently", arch) and not re.search(r"(?i)not (enabled|configured)", arch):
        return {"mode": "revert", "minutes": minutes}, f"# archive found: configure terminal revert timer {minutes}"
    out = sh.cmd(f"reload in {minutes}", timeout=30, answers=[(r"(?i)save\?\s*\[yes/no\]:?", "no\n"), (r"\[confirm\]", "\n")])
    if bad(out):
        return None, f"reload in {minutes}\n{out}\n! No rollback timer: the device refused \"reload in\"."
    return {"mode": "reload", "minutes": minutes}, f"reload in {minutes}\n{out}\n# no archive: the device reloads into its startup-config in {minutes} min unless confirmed"


def confirm(sess, token, facts=None):
    sh = sess.shell()
    sh.cmd("terminal length 0")
    cmd = "configure confirm" if token.get("mode") == "revert" else "reload cancel"
    out = sh.cmd(cmd, timeout=30)
    return not bad(out), f"{cmd}\n{out}".rstrip()


def persist(sess, facts=None):
    sh = sess.shell()
    out = sh.cmd("write memory", timeout=120)
    ok = not bad(out) and "OK" in out
    return ok, f"write memory\n{out}" + ("" if ok else "\n! write memory did not report OK.")


def restore(sess, backup_doc, facts=None):
    """configure replace with the copy on the device. Without one, the config must be pasted by hand."""
    name = backup_doc.get("onDevice") or ""
    if not re.fullmatch(r"(flash|bootflash):lt-[0-9]{8}-[0-9]{6}-[A-Za-z0-9]{4,12}\.cfg", name):
        return False, ("This backup has no copy on the device, so configure replace is not possible. "
                       "Open the backup and paste the lines you need in the SSH console.")
    sh = sess.shell()
    sh.cmd("terminal length 0")
    if not sh.privileged:
        return False, "The login has no privilege 15. Nothing was changed."
    out = sh.cmd(f"configure replace {name} force", timeout=180)
    ok = not bad(out) and ("Rollback Done" in out or "rollback" in out.lower() and "fail" not in out.lower())
    return ok, f"configure replace {name} force\n{out}".rstrip()
