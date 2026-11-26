"""Linux driver: servers, Proxmox VE, Raspberry Pi, and BusyBox systems such as DD-WRT.

Read-only. One exec call runs a POSIX sh script; each part prints a '@@name' marker
so a missing tool only empties its own part. JSON output (ip -j, lldpctl -f json,
pvesh) is used when present, with text fallbacks for BusyBox and old iproute2.
"""

import json
import re

from ..facts import cidr, iface, new_facts, norm_dest, norm_mac, sections

NAME = "linux"

SCRIPT = r"""
echo @@uname; uname -s 2>/dev/null
echo @@hostname; hostname 2>/dev/null || cat /proc/sys/kernel/hostname 2>/dev/null
echo @@osrelease; cat /etc/os-release 2>/dev/null
echo @@pveversion; command -v pveversion >/dev/null 2>&1 && pveversion 2>/dev/null
echo @@ipaddr; ip -j addr show 2>/dev/null
echo @@iproute; ip -j route show 2>/dev/null
echo @@ipaddrtxt; ip -j addr show >/dev/null 2>&1 || ip addr show 2>/dev/null || ifconfig -a 2>/dev/null
echo @@iproutetxt; ip -j route show >/dev/null 2>&1 || ip route show 2>/dev/null || route -n 2>/dev/null
echo @@listen; ss -Hltn 2>/dev/null || netstat -ltn 2>/dev/null
echo @@lldp; lldpctl -f json 2>/dev/null
echo @@dmi; for f in sys_vendor product_name product_serial; do printf '%s=' $f; cat /sys/class/dmi/id/$f 2>/dev/null || echo; done
echo @@devicetree; cat /proc/device-tree/model 2>/dev/null; echo
echo @@pve; command -v pvesh >/dev/null 2>&1 && pvesh get /cluster/resources --type vm --output-format json 2>/dev/null
echo @@nvram; command -v nvram >/dev/null 2>&1 && nvram get DD_BOARD 2>/dev/null
echo @@end
"""

DYNAMIC_PROTOS = {"dhcp", "ra", "redirect", "bird", "zebra", "bgp", "ospf", "isis", "rip", "babel", "eigrp"}
LOOPBACK_ADDR = re.compile(r"^(127\.|\[?::1\]?$|localhost)")


def collect(sess):
    _st, out, _err = sess.run(SCRIPT)
    return parse(sections(out))


def parse(sec):
    f = new_facts(NAME)
    sysf = f["system"]
    sysf["hostname"] = (sec.get("hostname") or "").strip().splitlines()[0] if sec.get("hostname", "").strip() else ""
    osr = _kv(sec.get("osrelease", ""))
    sysf["os"] = osr.get("PRETTY_NAME") or osr.get("NAME") or (sec.get("uname") or "").strip()
    sysf["osVersion"] = osr.get("VERSION_ID", "")
    pve = re.search(r"pve-manager/(\S+?)/", sec.get("pveversion", ""))
    if pve:
        sysf["os"] = f"Proxmox VE {pve.group(1)}"
        sysf["osVersion"] = pve.group(1)
    dmi = _kv(sec.get("dmi", ""), sep="=")
    sysf["vendor"] = _clean_dmi(dmi.get("sys_vendor", ""))
    sysf["model"] = _clean_dmi(dmi.get("product_name", ""))
    sysf["serial"] = _clean_dmi(dmi.get("product_serial", ""))
    dt = (sec.get("devicetree") or "").replace("\x00", "").strip()
    if dt and not sysf["model"]:
        sysf["model"] = dt  # Raspberry Pi and other boards
    board = (sec.get("nvram") or "").strip()
    if board:
        sysf["model"] = sysf["model"] or board
        if not osr:
            sysf["os"] = "DD-WRT"

    ifs = _parse_ip_json(sec.get("ipaddr", ""))
    if ifs is None:
        txt = sec.get("ipaddrtxt", "")
        ifs = _parse_ifconfig(txt) if "Link encap" in txt or "HWaddr" in txt else _parse_ip_text(txt)
    f["interfaces"] = ifs

    routes = _parse_route_json(sec.get("iproute", ""))
    if routes is None:
        routes = _parse_route_text(sec.get("iproutetxt", ""))
    f["routes"] = routes

    if sec.get("listen", "").strip():
        f["listening"] = _parse_listen(sec["listen"])
    if sec.get("lldp", "").strip():
        f["neighbors"] = _parse_lldp(sec["lldp"])
    if sec.get("pve", "").strip():
        f["guests"] = _parse_pve(sec["pve"], sysf["hostname"])
    if not ifs:
        f["errors"].append("no interfaces found (ip and ifconfig gave no output)")
    return f


# ---------------------------------------------------------------- helpers
def _kv(text, sep="="):
    out = {}
    for line in text.splitlines():
        if sep in line:
            k, v = line.split(sep, 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def _clean_dmi(v):
    v = (v or "").strip()
    junk = {"", "to be filled by o.e.m.", "default string", "system product name", "system manufacturer",
            "not specified", "none", "0", "0123456789", "123456789"}
    return "" if v.lower() in junk else v


def _kind(name, link_type="", has_link=False):
    if link_type == "loopback" or name == "lo":
        return "loop"
    if "." in name:
        return "sub"
    if link_type == "none" or name.startswith(("wg", "tun", "tailscale", "zt")):
        return "tunnel"
    if re.match(r"^(wl|ath\d|ra\d)", name):
        return "wifi"
    if name.startswith(("veth", "tap", "vnet", "fwpr", "fwln")):
        return "vport"
    return "eth"


def _sub_vlan(name):
    m = re.search(r"\.(\d{1,4})$", name)
    return int(m.group(1)) if m else None


def _parse_ip_json(text):
    text = (text or "").strip()
    if not text.startswith("["):
        return None
    try:
        data = json.loads(text)
    except ValueError:
        return None
    out = []
    for i in data:
        name = i.get("ifname") or ""
        if not name:
            continue
        flags = i.get("flags") or []
        oper = i.get("operstate") or ""
        inet = [a for a in i.get("addr_info") or [] if a.get("family") == "inet"]
        out.append(iface(
            name,
            mac=norm_mac(i.get("address")) if i.get("link_type") == "ether" else "",
            mtu=i.get("mtu"),
            adminUp="UP" in flags,
            operUp=oper == "UP" or (oper == "UNKNOWN" and "LOWER_UP" in flags),
            ips=[c for c in (cidr(a.get("local"), a.get("prefixlen")) for a in inet) if c],
            dhcp=any(a.get("dynamic") for a in inet),
            kind=_kind(name, i.get("link_type", ""), bool(i.get("link"))),
            vlan=_sub_vlan(name),
            master=i.get("master") or "",
        ))
    return out


IP_HEAD = re.compile(r"^\d+:\s+([^:@\s]+)(?:@\S+)?:\s+<([^>]*)>(.*)$")


def _parse_ip_text(text):
    out, cur = [], None
    for line in (text or "").splitlines():
        m = IP_HEAD.match(line)
        if m:
            flags = m.group(2).split(",")
            rest = m.group(3)
            mtu = re.search(r"mtu (\d+)", rest)
            st = re.search(r"state (\S+)", rest)
            master = re.search(r"master (\S+)", rest)
            oper = st.group(1) if st else ""
            cur = iface(m.group(1), mtu=int(mtu.group(1)) if mtu else None, adminUp="UP" in flags,
                        operUp=oper == "UP" or (oper in ("UNKNOWN", "") and "LOWER_UP" in flags),
                        kind=_kind(m.group(1)), vlan=_sub_vlan(m.group(1)), master=master.group(1) if master else "")
            out.append(cur)
            continue
        if cur is None:
            continue
        s = line.strip()
        if s.startswith("link/ether"):
            cur["mac"] = norm_mac(s.split()[1])
        elif s.startswith("link/loopback"):
            cur["kind"] = "loop"
        elif s.startswith("inet "):
            parts = s.split()
            ip, _, pre = parts[1].partition("/")
            c = cidr(ip, pre or 32)
            if c:
                cur["ips"].append(c)
            if "dynamic" in parts:
                cur["dhcp"] = True
    return out


def _parse_ifconfig(text):
    """BusyBox / net-tools ifconfig -a."""
    out, cur = [], None
    for line in (text or "").splitlines():
        if line and not line[0].isspace():
            name = line.split()[0].rstrip(":")
            cur = iface(name, kind=_kind(name), vlan=_sub_vlan(name), adminUp=False, operUp=False)
            hw = re.search(r"HWaddr\s+(\S+)", line)
            if hw:
                cur["mac"] = norm_mac(hw.group(1))
            if "Loopback" in line:
                cur["kind"] = "loop"
            out.append(cur)
            continue
        if cur is None:
            continue
        m = re.search(r"inet addr:(\S+).*?Mask:(\S+)", line)
        if m:
            c = cidr(m.group(1), m.group(2))
            if c:
                cur["ips"].append(c)
        if re.search(r"\bUP\b", line) and "MTU" in line.upper():
            cur["adminUp"] = True
            cur["operUp"] = "RUNNING" in line
            mtu = re.search(r"MTU:(\d+)", line)
            if mtu:
                cur["mtu"] = int(mtu.group(1))
    return out


def _parse_route_json(text):
    text = (text or "").strip()
    if not text.startswith("["):
        return None
    try:
        data = json.loads(text)
    except ValueError:
        return None
    out = []
    for r in data:
        proto = r.get("protocol") or ""
        gw = r.get("gateway") or ""
        if proto in DYNAMIC_PROTOS:
            continue
        if not gw and proto not in ("boot", "static"):
            continue  # connected routes
        out.append({"dest": norm_dest(r.get("dst")), "via": gw, "dev": "" if gw else (r.get("dev") or "")})
    return out


def _parse_route_text(text):
    out = []
    for line in (text or "").splitlines():
        p = line.split()
        if not p:
            continue
        if p[0] in ("Kernel", "Destination"):
            continue
        if len(p) >= 8 and re.match(r"^\d+\.\d+\.\d+\.\d+$", p[0]) and "G" in p[3]:  # route -n
            out.append({"dest": norm_dest(cidr(p[0], p[2]) if p[0] != "0.0.0.0" else "default"), "via": p[1], "dev": ""})
            continue
        if "proto" in p:
            proto = p[p.index("proto") + 1] if p.index("proto") + 1 < len(p) else ""
            if proto in DYNAMIC_PROTOS:
                continue
        else:
            proto = ""
        via = p[p.index("via") + 1] if "via" in p else ""
        dev = p[p.index("dev") + 1] if "dev" in p else ""
        if not via and proto not in ("boot", "static"):
            continue
        out.append({"dest": norm_dest(p[0]), "via": via, "dev": "" if via else dev})
    return out


def _parse_listen(text):
    ports = set()
    for line in text.splitlines():
        tok = [t for t in line.split() if ":" in t]
        if not tok:
            continue
        local = tok[0]
        addr, _, port = local.rpartition(":")
        if not port.isdigit() or LOOPBACK_ADDR.match(addr.split("%")[0]):
            continue
        ports.add(int(port))
    return [{"port": p, "proto": "tcp"} for p in sorted(ports)]


def _parse_lldp(text):
    try:
        data = json.loads(text)
    except ValueError:
        return None
    ifs = (data.get("lldp") or {}).get("interface") or []
    if isinstance(ifs, dict):
        ifs = [{k: v} for k, v in ifs.items()]
    out = []
    for entry in ifs:
        for local, info in entry.items():
            chassis = info.get("chassis") or {}
            name, mac = "", ""
            if len(chassis) == 1 and "id" not in chassis:
                name, ch = next(iter(chassis.items()))
            else:
                ch = chassis
            cid = (ch or {}).get("id") or {}
            if isinstance(cid, dict) and cid.get("type") == "mac":
                mac = norm_mac(cid.get("value"))
            port = info.get("port") or {}
            pid = port.get("id") or {}
            rport = pid.get("value", "") if isinstance(pid, dict) else str(pid)
            if isinstance(pid, dict) and pid.get("type") == "mac":
                rport = port.get("descr") or rport
            out.append({"localPort": local, "remoteName": name, "remotePort": rport, "remoteMac": mac})
    return out


def _parse_pve(text, hostname):
    try:
        data = json.loads(text)
    except ValueError:
        return None
    short = hostname.split(".")[0].lower()
    out = []
    for g in data:
        if g.get("type") not in ("qemu", "lxc"):
            continue
        if short and str(g.get("node", "")).lower() != short:
            continue
        out.append({"name": g.get("name") or f"{g.get('type')}-{g.get('vmid')}", "vmid": g.get("vmid"),
                    "kind": "vm" if g.get("type") == "qemu" else "ct", "state": g.get("status", "")})
    return out


# ---------------------------------------------------------------- remediation
# No automatic apply on Linux: ip and hostnamectl change the running system only, and the
# persistent config lives in different places (ifupdown, netplan, NetworkManager, Proxmox).
# The commands are sent to the SSH console for the user to check and run.
PERSIST_NOTE = ("These commands change the running system only. Also change the persistent config: "
                "/etc/network/interfaces (Proxmox, Debian ifupdown), /etc/netplan/*.yaml, or NetworkManager (nmcli).")


def render(ops):
    import shlex
    cmds, notes = [], [PERSIST_NOTE]
    for o in ops:
        op = o["op"]
        dev = shlex.quote(o["port"]) if "port" in o else ""
        if op == "hostname":
            cmds.append(f"sudo hostnamectl set-hostname {shlex.quote(o['name'])}")
        elif op == "iface-enable":
            cmds.append(f"sudo ip link set dev {dev} {'up' if o['enabled'] else 'down'}")
        elif op == "iface-desc":
            cmds.append(f"sudo ip link set dev {dev} alias {shlex.quote(o['desc'])}" if o["desc"] else f"sudo ip link set dev {dev} alias ''")
        elif op == "iface-ip":
            for old in o["old"]:
                cmds.append(f"sudo ip addr del {old} dev {dev}")
            if o["ip"] == "dhcp":
                notes.append(f"{o['port']}: start the DHCP client the system uses (for example: sudo dhclient {o['port']}, or networkctl).")
            elif o["ip"]:
                cmds.append(f"sudo ip addr add {o['ip']} dev {dev}")
        elif op == "route-del":
            cmds.append(f"sudo ip route del {o['dest']}" + (f" via {o['via']}" if o["via"] else f" dev {shlex.quote(o['dev'])}"))
        elif op == "route-add":
            cmds.append(f"sudo ip route add {o['dest']}" + (f" via {o['via']}" if o["via"] else f" dev {shlex.quote(o['dev'])}"))
        else:
            notes.append(f"{op} does not apply to a Linux host; skipped.")
    return cmds, sorted(set(notes), key=notes.index)
