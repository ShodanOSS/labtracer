"""The normalized facts document. Every driver fills this shape; src/drift.js reads it.

{ collected, driver, ok, errors[],
  system:    {hostname, vendor, model, serial, os, osVersion},
  interfaces:[{name, mac, mtu, adminUp, operUp, speed, ips[], dhcp, mode, vlan, nativeVlan, trunkVlans, desc, kind,
               master}]  master: the bridge or bond the interface belongs to (Linux)
  routes:    [{dest, via, dev}]                    static routes only
  vlans:     [{id, name}] | None                   None = the driver does not read VLANs
  neighbors: [{localPort, remoteName, remotePort, remoteMac}] | None
  listening: [{port, proto}] | None
  guests:    [{name, vmid, kind, state}] | None
  rawConfig: "" }
Fields that a driver can not read stay None or "" (drift.js skips them).
"""

import ipaddress
import time

FACTS_VERSION = 1


def new_facts(driver):
    return {
        "factsVersion": FACTS_VERSION, "collected": int(time.time()), "driver": driver, "ok": True, "errors": [],
        "system": {"hostname": "", "vendor": "", "model": "", "serial": "", "os": "", "osVersion": ""},
        "interfaces": [], "routes": [], "vlans": None, "neighbors": None, "listening": None, "guests": None,
        "rawConfig": "",
    }


def iface(name, **kw):
    base = {"name": name, "mac": "", "mtu": None, "adminUp": None, "operUp": None, "speed": "", "ips": [], "dhcp": False,
            "mode": None, "vlan": None, "nativeVlan": None, "trunkVlans": None, "desc": "", "kind": "", "master": ""}
    base.update(kw)
    return base


def cidr(ip, mask_or_prefix):
    """'10.0.0.1', '255.255.255.0' or 24 -> '10.0.0.1/24'. '' when not IPv4."""
    try:
        n = ipaddress.IPv4Interface(f"{ip}/{mask_or_prefix}")
    except ValueError:
        return ""
    return f"{n.ip}/{n.network.prefixlen}"


def norm_dest(dest):
    """'default' or '0.0.0.0 0.0.0.0' -> '0.0.0.0/0'; '10.0.0.0/8' unchanged."""
    d = (dest or "").strip()
    if d in ("default", "0.0.0.0", ""):
        return "0.0.0.0/0"
    if "/" not in d:
        return d + "/32" if d.count(".") == 3 else d
    return d


def norm_mac(m):
    hexes = "".join(c for c in (m or "").lower() if c in "0123456789abcdef")
    if len(hexes) != 12:
        return ""
    return ":".join(hexes[i:i + 2] for i in range(0, 12, 2))


def sections(text, marker="@@"):
    """Split script output on lines '@@name' -> {name: text}."""
    out, cur, buf = {}, None, []
    for line in text.splitlines():
        if line.startswith(marker) and line[len(marker):].strip().isidentifier():
            if cur is not None:
                out[cur] = "\n".join(buf).strip("\n")
            cur, buf = line[len(marker):].strip(), []
        else:
            buf.append(line)
    if cur is not None:
        out[cur] = "\n".join(buf).strip("\n")
    return out
