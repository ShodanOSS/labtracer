"""Cisco IOS / IOS-XE driver (also fits many IOS-like CLIs). Read-only.

Runs show commands in an interactive CLI. The running-config is the main source
(interfaces, switchport, addresses, static routes); show ip interface brief adds
the line state, show vlan brief the VLAN database, LLDP or CDP the neighbors.
show running-config needs privilege 15: with a '>' prompt the report says so.
"""

import re

from ..facts import cidr, iface, new_facts, norm_dest, norm_mac

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
        out.append({"localPort": li.group(1), "remoteName": name.group(1) if name else "",
                    "remotePort": port.group(1) if port else "", "remoteMac": norm_mac(chassis.group(1)) if chassis else ""})
    return out


def _cdp(text):
    out = []
    for block in re.split(r"(?m)^(?=Device ID:)", text):
        dev = re.search(r"Device ID:\s*(\S+)", block)
        intf = re.search(r"Interface:\s*([^,\s]+),\s*Port ID \(outgoing port\):\s*(\S+)", block)
        if dev and intf:
            out.append({"localPort": intf.group(1), "remoteName": dev.group(1), "remotePort": intf.group(2), "remoteMac": ""})
    return out
