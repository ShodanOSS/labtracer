# SPDX-License-Identifier: Apache-2.0
"""Linux driver: servers, Proxmox VE, Raspberry Pi, and BusyBox systems such as DD-WRT.

Read-only. One exec call runs a POSIX sh script; each part prints a '@@name' marker
so a missing tool only empties its own part. JSON output (ip -j, lldpctl -f json,
pvesh) is used when present, with text fallbacks for BusyBox and old iproute2.
"""

import base64
import json
import re

from ..facts import cidr, iface, ip_only, neighbor, new_facts, norm_dest, norm_mac, sections

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
echo @@neigh; ip -j neigh show 2>/dev/null || cat /proc/net/arp 2>/dev/null
echo @@fdb; command -v bridge >/dev/null 2>&1 && bridge -j fdb show 2>/dev/null
echo @@uid; id -u 2>/dev/null
echo @@netcfg; command -v nmcli >/dev/null 2>&1 && echo nm=$(nmcli -t -f RUNNING general 2>/dev/null | head -n 1); [ -f /etc/network/interfaces ] && echo ifupdown=1; command -v ifreload >/dev/null 2>&1 && echo ifreload=1; ls /etc/netplan/*.yaml >/dev/null 2>&1 && echo netplan=1; command -v netplan >/dev/null 2>&1 && echo netplancmd=1; command -v systemd-run >/dev/null 2>&1 && echo systemdrun=1; command -v sudo >/dev/null 2>&1 && echo sudo=1; command -v hostnamectl >/dev/null 2>&1 && echo hostnamectl=1
echo @@nmdev; command -v nmcli >/dev/null 2>&1 && nmcli -t -f DEVICE,STATE,CONNECTION device 2>/dev/null
echo @@ifupdown; cat /etc/network/interfaces 2>/dev/null
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
    if sec.get("neigh", "").strip():
        f["arp"] = _parse_neigh(sec["neigh"])
    if sec.get("fdb", "").strip():
        f["macTable"] = _parse_fdb(sec["fdb"], {i["name"] for i in ifs})
    if "uid" in sec or "netcfg" in sec:
        f["platform"] = _platform(sec)
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
            mgmt = (ch or {}).get("mgmt-ip") or ""
            if isinstance(mgmt, list):
                mgmt = next((m for m in mgmt if ip_only(m)), "")
            out.append(neighbor(local, name, rport, mac, mgmt))
    return out


def _parse_neigh(text):
    """ip -j neigh, or /proc/net/arp (BusyBox)."""
    out, seen = [], set()
    t = text.strip()
    if t.startswith("["):
        try:
            rows = [(n.get("dst"), n.get("lladdr"), n.get("dev"), n.get("state") or []) for n in json.loads(t)]
        except ValueError:
            rows = []
    else:
        rows = []
        for line in t.splitlines()[1:]:
            p = line.split()
            if len(p) >= 6:
                rows.append((p[0], p[3], p[5], [] if p[2] != "0x0" else ["FAILED"]))
    for ip, mac, dev, state in rows:
        ip, mac = ip_only(ip), norm_mac(mac)
        if ip and mac and "FAILED" not in state and "INCOMPLETE" not in state and ip not in seen:
            seen.add(ip)
            out.append({"ip": ip, "mac": mac, "dev": dev or ""})
    return out


def _parse_fdb(text, ifnames):
    """bridge -j fdb show: MACs learned on bridge ports (no local or static entries)."""
    try:
        data = json.loads(text)
    except ValueError:
        return None
    out = []
    for e in data:
        if not e.get("master") or e.get("state") in ("permanent", "static") or "self" in (e.get("flags") or []):
            continue
        mac, port = norm_mac(e.get("mac")), e.get("ifname") or ""
        if mac and port and not mac.startswith("33:33") and not mac.startswith("01:00:5e"):
            out.append({"mac": mac, "vlan": e.get("vlan"), "port": port})
    return out


def _platform(sec):
    """How this host keeps its network config, for a persistent push (see remediation below)."""
    flags = _kv(sec.get("netcfg", ""), sep="=")
    nm = {}
    if flags.get("nm") == "running":
        for line in sec.get("nmdev", "").splitlines():
            p = line.split(":")
            if len(p) >= 3 and p[2] and p[1].startswith("connected"):
                nm[p[0]] = ":".join(p[2:]).replace("\\:", ":")
    text = sec.get("ifupdown", "")
    uid = (sec.get("uid") or "").strip()
    return {"uid": int(uid) if uid.isdigit() else None, "sudo": flags.get("sudo") == "1",
            "ifupdown": flags.get("ifupdown") == "1", "ifreload": flags.get("ifreload") == "1",
            "netplan": flags.get("netplan") == "1" and flags.get("netplancmd") == "1", "nm": nm,
            "systemdRun": flags.get("systemdrun") == "1", "hostnamectl": flags.get("hostnamectl") == "1",
            "interfacesFile": text + "\n" if text and not text.endswith("\n") else text}


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
# A push changes the running system AND the config that survives a reboot. Per interface,
# the config system that owns it (from the facts of the last collect, facts.platform):
#   ifupdown  a stanza in /etc/network/interfaces (Debian, Proxmox). LabTracer edits the file;
#             ifupdown2 applies it with "ifreload -a", classic ifupdown also gets ip commands.
#   netplan   /etc/netplan/*.yaml: "netplan set", then "netplan apply" (netplan 0.101 or later).
#   nm        a NetworkManager connection: "nmcli connection modify", then reapply / up / down.
#   runtime   none of these: ip commands only, lost at the next reboot (a note says so).
# Commands: "#" lines are comments; "@write <path>" writes the new file shown for review
# (extra.files); every other line runs as is over SSH, in order, stopping at the first error.
# Root, or sudo without a password (sudo -n), is needed.
BACKUP_PATHS = ("etc/network/interfaces", "etc/network/interfaces.d", "etc/netplan",
                "etc/NetworkManager/system-connections", "etc/hostname", "etc/hosts")
DEVICE_BACKUPS = "/var/backups/labtracer"
ROLLBACK = "systemd timer: the device restores the backup by itself unless LabTracer confirms the change"
RUNTIME_NOTE = ("{0}: no persistent network config found (no ifupdown stanza, netplan or NetworkManager "
                "connection). The change is made with ip commands only and is lost at the next reboot.")
STANZA_RE = re.compile(r"^(auto|allow-[\w-]+|iface|mapping|source|source-directory|rename|no-auto-down|no-scripts)\b")


def _q(v):
    import shlex
    return shlex.quote(str(v))


def _sudo(plat):
    return "" if (plat or {}).get("uid") == 0 else "sudo -n "


def _iface_for(facts, via):
    """The interface whose subnet holds the next hop."""
    import ipaddress
    try:
        hop = ipaddress.IPv4Address(via)
    except ValueError:
        return ""
    for i in (facts or {}).get("interfaces") or []:
        for a in i.get("ips") or []:
            try:
                if hop in ipaddress.IPv4Interface(a).network:
                    return i["name"]
            except ValueError:
                continue
    return ""


class Ifaces:
    """A small editor for /etc/network/interfaces that keeps every line it does not change."""

    def __init__(self, text):
        self.lines = (text or "").replace("\r\n", "\n").split("\n")
        while self.lines and not self.lines[-1].strip():
            self.lines.pop()

    def text(self):
        return "\n".join(self.lines) + "\n" if self.lines else ""

    def stanza(self, name):
        """(first line, end line exclusive, method) of 'iface <name> inet <method>', or None."""
        for i, ln in enumerate(self.lines):
            m = re.match(r"^iface\s+(\S+)\s+inet\s+(\S+)", ln)
            if m and m.group(1) == name:
                j = i + 1
                while j < len(self.lines) and not STANZA_RE.match(self.lines[j]):
                    j += 1
                while j > i + 1 and (not self.lines[j - 1].strip() or self.lines[j - 1].lstrip().startswith("#")):
                    j -= 1  # blank lines and comments before the next stanza belong to it
                return i, j, m.group(2)
        return None

    def _indent(self, name):
        st = self.stanza(name)
        if st:
            for ln in self.lines[st[0] + 1:st[1]]:
                if ln.strip():
                    return ln[:len(ln) - len(ln.lstrip())] or "    "
        return "    "

    def ensure(self, name, method):
        if not self.stanza(name):
            self.lines += ["", f"auto {name}", f"iface {name} inet {method}"]

    def set_method(self, name, method):
        self.ensure(name, method)
        i = self.stanza(name)[0]
        self.lines[i] = re.sub(r"(\binet\s+)\S+", r"\g<1>" + method, self.lines[i], count=1)

    def remove(self, name, test):
        """Remove the option lines of the stanza for which test(words) is true. Returns how many."""
        st = self.stanza(name)
        if not st:
            return 0
        i, j, _m = st
        keep = [ln for ln in self.lines[i + 1:j] if not (ln.split() and test(ln.split()))]
        n = (j - i - 1) - len(keep)
        self.lines[i + 1:j] = keep
        return n

    def add(self, name, option, first=False):
        i, j, _m = self.stanza(name)
        self.lines.insert(i + 1 if first else j, self._indent(name) + option)

    def set_auto(self, name, on):
        found = False
        for k, ln in enumerate(self.lines):
            w = ln.split()
            if w and w[0] in ("auto", "allow-hotplug") and name in w[1:]:
                found = True
                if not on:
                    rest = [x for x in w[1:] if x != name]
                    self.lines[k] = (w[0] + " " + " ".join(rest)) if rest else None
        self.lines = [x for x in self.lines if x is not None]
        if on and not found:
            st = self.stanza(name)
            self.lines.insert(st[0] if st else len(self.lines), f"auto {name}")


def _owner(plat, ifaces, name):
    if plat.get("ifupdown") and ifaces.stanza(name):
        return "ifupdown"
    if plat.get("netplan"):
        return "netplan"
    if name in (plat.get("nm") or {}):
        return "nm"
    return "runtime"


def _netplan_section(facts, name):
    ifs = (facts or {}).get("interfaces") or []
    if any(i.get("master") == name for i in ifs) or name.startswith(("br", "vmbr")):
        return "bridges"
    if name.startswith("bond"):
        return "bonds"
    if "." in name or name.startswith("vlan"):
        return "vlans"
    if next((i.get("kind") for i in ifs if i.get("name") == name), "") == "wifi":
        return "wifis"
    return "ethernets"


def _route_txt(o):
    return o["dest"] + (f" via {o['via']}" if o["via"] else f" dev {o['dev']}")


def render(ops, facts=None):
    """Validated operations -> (commands, notes, extra). extra: {files: [{path, old, content}],
    undo: [shell commands for the rollback script], canApply: bool}."""
    plat = (facts or {}).get("platform") or {}
    known = bool(plat) and plat.get("uid") is not None
    P = _sudo(plat) if known else "sudo "
    ifaces = Ifaces(plat.get("interfacesFile", ""))
    orig_ifaces = ifaces.text()
    cmds, notes, undo = [], [], []
    runtime, nm_cmds, nm_after, np_cmds = [], [], [], []
    np_routes = {}
    file_touched = False
    if not known:
        notes.append("Collect the device again: LabTracer needs to know how this host keeps its network config "
                     "before it can apply a change. Until then, send the commands to the console. They change "
                     "the running system only.")

    def rt(cmd, back=None):
        runtime.append(P + cmd)
        if back:
            undo.append(P + back + " || true")

    for o in ops:
        op = o["op"]
        port = o.get("port", "")
        own = _owner(plat, ifaces, port) if port else ""
        if op == "hostname":
            old = ((facts or {}).get("system") or {}).get("hostname", "")
            if plat.get("hostnamectl") or not known:
                cmds.append(f"{P}hostnamectl set-hostname {_q(o['name'])}")
                if old:
                    undo.append(f"{P}hostnamectl set-hostname {_q(old)} || true")
            else:
                cmds.append(f"{P}sh -c {_q('echo ' + o['name'] + ' > /etc/hostname && hostname ' + o['name'])}")
        elif op == "iface-ip":
            old = o["old"]
            if own == "ifupdown":
                file_touched = True
                ifaces.remove(port, lambda w: w[0] in ("address", "netmask"))
                if o["ip"] == "dhcp":
                    ifaces.set_method(port, "dhcp")
                    ifaces.remove(port, lambda w: w[0] == "gateway")
                elif o["ip"]:
                    ifaces.set_method(port, "static")
                    ifaces.add(port, f"address {o['ip']}", first=True)
                else:
                    ifaces.set_method(port, "manual")
                    ifaces.remove(port, lambda w: w[0] == "gateway")
                if not plat.get("ifreload"):
                    for a in old:
                        rt(f"ip addr del {a} dev {_q(port)}", f"ip addr add {a} dev {_q(port)}")
                    if o["ip"] not in ("", "dhcp"):
                        rt(f"ip addr add {o['ip']} dev {_q(port)}", f"ip addr del {o['ip']} dev {_q(port)}")
            elif own == "netplan":
                if "." in port:
                    notes.append(f"{port}: netplan set can not name an interface with a dot; change it in /etc/netplan by hand.")
                    continue
                sec = f"{_netplan_section(facts, port)}.{port}"
                if o["ip"] == "dhcp":
                    np_cmds += [f"{P}netplan set {_q(sec + '.addresses=null')}", f"{P}netplan set {_q(sec + '.dhcp4=true')}"]
                elif o["ip"]:
                    np_cmds += [f"{P}netplan set {_q(sec + '.addresses=[' + o['ip'] + ']')}", f"{P}netplan set {_q(sec + '.dhcp4=false')}"]
                else:
                    np_cmds += [f"{P}netplan set {_q(sec + '.addresses=null')}", f"{P}netplan set {_q(sec + '.dhcp4=false')}"]
            elif own == "nm":
                c = _q(plat["nm"][port])
                if o["ip"] == "dhcp":
                    nm_cmds.append(f"{P}nmcli connection modify {c} ipv4.method auto ipv4.addresses ''")
                elif o["ip"]:
                    nm_cmds.append(f"{P}nmcli connection modify {c} ipv4.method manual ipv4.addresses {o['ip']}")
                else:
                    nm_cmds.append(f"{P}nmcli connection modify {c} ipv4.gateway '' ipv4.addresses '' ipv4.method disabled")
                nm_after.append(f"{P}nmcli device reapply {_q(port)}")
                undo.append(f"{P}nmcli connection up {c} || true")
            else:
                for a in old:
                    rt(f"ip addr del {a} dev {_q(port)}", f"ip addr add {a} dev {_q(port)}")
                if o["ip"] == "dhcp":
                    notes.append(f"{port}: start the DHCP client the system uses (for example: dhclient {port}, or networkctl).")
                elif o["ip"]:
                    rt(f"ip addr add {o['ip']} dev {_q(port)}", f"ip addr del {o['ip']} dev {_q(port)}")
                if known:
                    notes.append(RUNTIME_NOTE.format(port))
        elif op == "iface-enable":
            on = o["enabled"]
            rt(f"ip link set dev {_q(port)} {'up' if on else 'down'}", f"ip link set dev {_q(port)} {'down' if on else 'up'}")
            if own == "ifupdown":
                file_touched = True
                ifaces.set_auto(port, on)
            elif own == "nm":
                c = _q(plat["nm"][port])
                nm_cmds.append(f"{P}nmcli connection modify {c} connection.autoconnect {'yes' if on else 'no'}")
                nm_after.append(f"{P}nmcli connection {'up' if on else 'down'} {c}")
            elif known:
                notes.append(f"{port}: {'enabled' if on else 'disabled'} until the next reboot only ({own} has no setting LabTracer changes for this).")
        elif op == "iface-desc":
            rt(f"ip link set dev {_q(port)} alias {_q(o['desc'])}")
            if own == "ifupdown" and plat.get("ifreload"):
                file_touched = True
                ifaces.remove(port, lambda w: w[0] == "alias")
                if o["desc"]:
                    ifaces.add(port, f"alias {o['desc']}")
        elif op in ("route-add", "route-del"):
            add = op == "route-add"
            dev = o["dev"] or _iface_for(facts, o["via"])
            back = f"ip route {'del' if add else 'add'} {_route_txt(o)}"
            own = _owner(plat, ifaces, dev) if dev else "runtime"
            default = o["dest"] == "0.0.0.0/0"
            if own == "ifupdown":
                file_touched = True
                if default and o["via"]:
                    ifaces.remove(dev, lambda w: w[0] == "gateway")
                    if add:
                        ifaces.add(dev, f"gateway {o['via']}")
                else:
                    ifaces.remove(dev, lambda w: w[0] in ("up", "post-up") and " ".join(w[1:]).startswith(f"ip route add {o['dest']} "))
                    if add:
                        ifaces.add(dev, f"up ip route add {_route_txt(o)}")
                if not plat.get("ifreload"):
                    rt(f"ip route {'add' if add else 'del'} {_route_txt(o)}", back)
            elif own == "netplan" and "." not in dev:
                sec = f"{_netplan_section(facts, dev)}.{dev}"
                cur = np_routes.setdefault(sec, [{"dest": r["dest"], "via": r.get("via", "")} for r in (facts or {}).get("routes") or []
                                                 if r.get("via") and _iface_for(facts, r["via"]) == dev])
                cur[:] = [r for r in cur if r["dest"] != o["dest"]]
                if add and o["via"]:
                    cur.append({"dest": o["dest"], "via": o["via"]})
            elif own == "nm":
                c = _q(plat["nm"][dev])
                if default and o["via"]:
                    nm_cmds.append(f"{P}nmcli connection modify {c} ipv4.gateway {o['via'] if add else _q('')}")
                else:
                    nm_cmds.append(f"{P}nmcli connection modify {c} {'+' if add else '-'}ipv4.routes {_q(o['dest'] + (' ' + o['via'] if o['via'] else ''))}")
                nm_after.append(f"{P}nmcli device reapply {_q(dev)}")
                undo.append(f"{P}nmcli connection up {c} || true")
            else:
                rt(f"ip route {'add' if add else 'del'} {_route_txt(o)}", back)
                if known:
                    notes.append(RUNTIME_NOTE.format(dev or o["dest"]))
        else:
            notes.append(f"{op} does not apply to a Linux host; skipped.")
    files = []
    if file_touched and ifaces.text() != orig_ifaces:
        files.append({"path": "/etc/network/interfaces", "old": orig_ifaces, "content": ifaces.text()})
        cmds.append("@write /etc/network/interfaces")
        if plat.get("ifreload"):
            cmds.append(f"{P}ifreload -a")
        else:
            notes.append("Classic ifupdown: the file is changed for the next boot, and ip commands change the running system.")
    for sec, routes in np_routes.items():
        val = "[" + ", ".join("{to: %s, via: %s}" % ("default" if r["dest"] == "0.0.0.0/0" else r["dest"], r["via"]) for r in routes) + "]"
        np_cmds.append(f"{P}netplan set {_q(sec + '.routes=' + (val if routes else 'null'))}")
    if np_cmds:
        cmds += np_cmds + [f"{P}netplan apply"]
        notes.append("netplan set needs netplan 0.101 or later (Ubuntu 22.04, Debian 12). An older netplan refuses it, "
                     "and nothing after that command runs.")
    cmds += nm_cmds + list(dict.fromkeys(nm_after)) + runtime
    return cmds, sorted(set(notes), key=notes.index), {"files": files, "undo": list(dict.fromkeys(undo)), "canApply": known}


def _run(sess, cmd, log, timeout=60, stdin=None, quiet=False):
    st, out, err = sess.run(cmd, timeout=timeout, stdin=stdin)
    log.append("$ " + cmd)
    text = (err if quiet else out + err).rstrip()
    if text:
        log.append(text)
    if st != 0:
        log.append(f"! exit status {st}")
    return st, out


def _need_root(sess, P, log):
    if not P:
        return True
    st, _out = _run(sess, "sudo -n true", log, timeout=15)
    if st != 0:
        log.append("! This needs root, or sudo without a password for this user (sudo -n). Nothing was changed.")
    return st == 0


def backup(sess, backup_id, facts=None):
    """Network config files as a tar archive: kept by LabTracer, and on the device in
    /var/backups/labtracer/<id>.tgz for the rollback timer."""
    import base64
    import io
    import tarfile
    P = _sudo((facts or {}).get("platform"))
    paths = " ".join(BACKUP_PATHS)
    on_dev = f"{DEVICE_BACKUPS}/{backup_id}.tgz"
    inner = f"mkdir -p {DEVICE_BACKUPS} && chmod 700 {DEVICE_BACKUPS} && cd / && tar -czf {on_dev} $(ls -d {paths} 2>/dev/null) && base64 {on_dev}"
    st, out, _err = sess.run(f"{P}sh -c {_q(inner)}", timeout=60)
    if st != 0:  # no root: what a normal user can read, nothing kept on the device
        on_dev = ""
        st, out, _err = sess.run(f"cd / && tar -czf - $(ls -d {paths} 2>/dev/null) 2>/dev/null | base64", timeout=60)
    raw = base64.b64decode("".join(out.split()) or b"")
    files = {}
    if raw:
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
            for m in tar.getmembers():
                if m.isfile() and m.size <= 1024 * 1024 and _backed_up_path(m.name):
                    files["/" + _member_path(m.name)] = tar.extractfile(m).read().decode("utf-8", "replace")
    config = "\n".join(f"### {p}\n{t.rstrip()}\n" for p, t in sorted(files.items()))
    return {"config": config, "files": files, "archive": base64.b64encode(raw).decode() if raw else "", "onDevice": on_dev}


NETPLAN_FILE_RE = re.compile(r"^/etc/netplan/[A-Za-z0-9._-]+\.ya?ml$")


def _member_path(name):
    """A tar member name as a path relative to /, without "./" or a leading "/"."""
    name = str(name).replace("\\", "/")
    while name.startswith(("./", "/")):
        name = name[2:] if name.startswith("./") else name[1:]
    return name.rstrip("/")


def _backed_up_path(name):
    """True when a member name is one of BACKUP_PATHS or inside one, with no ".." part."""
    rel = _member_path(name)
    if not rel or ".." in rel.split("/"):
        return False
    return any(rel == b or rel.startswith(b + "/") for b in BACKUP_PATHS)


def _archive_problem(raw):
    """Why a backup archive must not be unpacked as root on a device, or None when it is safe.
    The archive comes from the device, or from data/backups: both can be changed by someone else."""
    import io
    import tarfile
    try:
        with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
            for m in tar.getmembers():
                if not _backed_up_path(m.name):
                    if _member_path(m.name) in ("", "etc", "etc/network", "etc/NetworkManager"):
                        if m.isdir():
                            continue
                    return f"the archive has a file outside the network config folders: {str(m.name)[:80]}"
                if m.isfile() or m.isdir():
                    continue
                if m.issym():
                    target = str(m.linkname)
                    if target.startswith("/") or ".." in target.replace("\\", "/").split("/"):
                        return f"the archive has a link that points outside its folder: {str(m.name)[:80]}"
                    continue
                if m.islnk():
                    if not _backed_up_path(m.linkname):
                        return f"the archive has a hard link to a file outside the network config folders: {str(m.name)[:80]}"
                    continue
                return f"the archive has a device file or pipe: {str(m.name)[:80]}"
    except (tarfile.TarError, OSError, EOFError) as exc:
        return f"the archive can not be read ({exc})"
    return None


def _restore_lines(backup_doc, archive):
    """Shell lines that put the backed-up files back. netplan files added since are removed.
    The file names come from the device: only plain netplan names are used, each quoted."""
    keep = sorted(p for p in (backup_doc.get("files") or {}) if NETPLAN_FILE_RE.match(p))
    if keep:
        prune = (f"for f in /etc/netplan/*.yaml; do case \"$f\" in {'|'.join(_q(p) for p in keep)}) ;; "
                 "*) [ -f \"$f\" ] && rm -f \"$f\";; esac; done; true")
    else:
        prune = "for f in /etc/netplan/*.yaml; do [ -f \"$f\" ] && rm -f \"$f\"; done; true"
    return [f"cd / && tar -xzf {_q(archive)}", prune]


RELOAD = ["command -v ifreload >/dev/null 2>&1 && ifreload -a; true",
          "ls /etc/netplan/*.yaml >/dev/null 2>&1 && command -v netplan >/dev/null 2>&1 && netplan apply; true",
          "command -v nmcli >/dev/null 2>&1 && nmcli connection reload; true"]


def arm(sess, backup_doc, minutes, extra=None, facts=None):
    """Start a systemd timer on the device that restores the backup after `minutes`, unless
    confirm() stops it first. Returns (token, transcript); token None = not armed."""
    plat = (facts or {}).get("platform") or {}
    if not plat.get("systemdRun"):
        return None, "# No systemd-run on this device: no rollback timer."
    if not backup_doc.get("onDevice"):
        return None, "# The backup could not be kept on the device (root needed): no rollback timer."
    if backup_doc.get("archive"):
        problem = _archive_problem(base64.b64decode(backup_doc["archive"]))
        if problem:
            return None, f"# No rollback timer: {problem}."
    P = _sudo(plat)
    log = []
    unit = "labtracer-rollback-" + backup_doc["id"]
    undo = [c[len(P):] if P and c.startswith(P) else c for c in (extra or {}).get("undo") or []]
    script = "\n".join(["#!/bin/sh", "# LabTracer rollback for backup " + backup_doc["id"],
                        *_restore_lines(backup_doc, backup_doc["onDevice"]), *undo, *RELOAD,
                        "command -v nmcli >/dev/null 2>&1 && nmcli networking off && nmcli networking on; true", ""])
    path = f"{DEVICE_BACKUPS}/{backup_doc['id']}.rollback.sh"
    st, _ = _run(sess, f"{P}tee {path} >/dev/null", log, stdin=script)
    if st == 0:
        st, _ = _run(sess, f"{P}systemd-run --unit={unit} --on-active={int(minutes)}m /bin/sh {path}", log)
    if st != 0:
        return None, "\n".join(log + ["! The rollback timer could not be started."])
    return unit, "\n".join(log + [f"# rollback in {int(minutes)} min unless confirmed"])


def confirm(sess, token, facts=None):
    P = _sudo((facts or {}).get("platform"))
    log = []
    st, _ = _run(sess, f"{P}systemctl stop {token}.timer", log)
    return st == 0, "\n".join(log)


def apply(sess, cmds, save=False, armed=None, extra=None, facts=None):
    """Run reviewed commands. Stops at the first one that fails. Returns (ok, transcript)."""
    P = _sudo((facts or {}).get("platform"))
    log = []
    if not _need_root(sess, P, log):
        return False, "\n".join(log)
    files = {f["path"]: f for f in (extra or {}).get("files") or []}
    for c in cmds:
        if not c.strip() or c.startswith("#"):
            continue
        if c.startswith("@write "):
            path = c[len("@write "):].strip()
            f = files.get(path)
            if not f:
                return False, "\n".join(log + [f"! No content for {path}. Nothing more was run."])
            st, now = _run(sess, f"{P}cat {_q(path)}", log, quiet=True)
            if st != 0 or now.strip("\n") != f["old"].strip("\n"):
                return False, "\n".join(log + [f"! {path} changed on the device since the last collect. "
                                                 "Collect again and review the change. Nothing more was run."])
            st, _ = _run(sess, f"{P}tee {_q(path)} >/dev/null", log, stdin=f["content"])
            if st != 0:
                return False, "\n".join(log + [f"! Could not write {path}."])
            log.append(f"# wrote {path} ({len(f['content'].splitlines())} lines)")
            continue
        st, _ = _run(sess, c, log, timeout=120)
        if st != 0:
            log.append("! Stopped: this command failed. The commands before it are applied.")
            return False, "\n".join(log)
    return True, "\n".join(log)


def restore(sess, backup_doc, facts=None):
    """Put the backed-up network files back and reload the network config."""
    import base64
    P = _sudo((facts or {}).get("platform"))
    log = []
    if not backup_doc.get("archive"):
        return False, "This backup has no files to restore."
    try:
        raw = base64.b64decode(backup_doc["archive"], validate=True)
    except ValueError:
        return False, "This backup is damaged: its archive is not valid base64. Nothing was changed."
    problem = _archive_problem(raw)
    if problem:
        return False, f"This backup was not restored: {problem}. Nothing was changed."
    if not _need_root(sess, P, log):
        return False, "\n".join(log)
    tmp = f"{DEVICE_BACKUPS}/restore-{backup_doc['id']}.tgz"
    st, _ = _run(sess, f"{P}sh -c {_q(f'mkdir -p {DEVICE_BACKUPS} && cat > {tmp}')}", log, stdin=raw)
    for line in ([] if st else _restore_lines(backup_doc, tmp)):
        st, _ = _run(sess, f"{P}sh -c {_q(line)}", log)
        if st != 0:
            break
    if st == 0:
        for line in RELOAD:
            _run(sess, f"{P}sh -c {_q(line)}", log, timeout=120)
    return st == 0, "\n".join(log)
