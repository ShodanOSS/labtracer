# SPDX-License-Identifier: Apache-2.0
"""Remediation operations: the planned state, as data, that LabTracer may push to a device.

The browser never sends command text. It sends operations such as
{"op": "sw-access", "port": "Gi0/3", "vlan": 20}; validate() checks every field
against a strict pattern, and the device driver renders the commands itself
(drivers/<name>.py render()). So a lab file or a web page can not make
LabTracer type arbitrary commands on a device.

Operations:
  hostname     {name}
  iface-enable {port, enabled}
  iface-desc   {port, desc}
  iface-ip     {port, ip: "A.B.C.D/NN" | "dhcp" | "", old: ["A.B.C.D/NN", ...]}
  sw-access    {port, vlan}
  sw-trunk     {port, nativeVlan, trunkVlans: "all" | "none" | "1,10,20-30"}
  sw-routed    {port}
  vlan-add     {id, name}    vlan-name {id, name}    vlan-del {id}
  route-add    {dest, via, dev}    route-del {dest, via, dev}
"""

import ipaddress
import re

MAX_OPS = 200
PORT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9/._:@-]{0,47}$")
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$")
VLAN_LIST_RE = re.compile(r"^(all|none|\d{1,4}(-\d{1,4})?(,\d{1,4}(-\d{1,4})?)*)$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
OPS = ("hostname", "iface-enable", "iface-desc", "iface-ip", "sw-access", "sw-trunk", "sw-routed",
       "vlan-add", "vlan-name", "vlan-del", "route-add", "route-del")


def _port(v):
    v = str(v or "").strip()
    if not PORT_RE.match(v):
        raise ValueError(f"bad interface name: {v[:40]!r}")
    return v


def _name(v, what="name"):
    v = str(v or "").strip()
    if not NAME_RE.match(v):
        raise ValueError(f"{what} may only have letters, digits, '.', '_' and '-' (got {v[:40]!r})")
    return v


def _vlan(v):
    try:
        n = int(v)
    except (TypeError, ValueError):
        raise ValueError(f"bad VLAN: {v!r}") from None
    if not 1 <= n <= 4094:
        raise ValueError(f"VLAN must be 1 to 4094 (got {n})")
    return n


def _cidr(v):
    try:
        i = ipaddress.IPv4Interface(str(v).strip())
    except ValueError:
        raise ValueError(f"bad address: {str(v)[:40]!r}") from None
    if "/" not in str(v):
        raise ValueError(f"address needs a prefix length: {v!r}")
    return f"{i.ip}/{i.network.prefixlen}"


def _route(o):
    try:
        dest = str(ipaddress.IPv4Network(str(o.get("dest") or "").replace("default", "0.0.0.0/0"), strict=False))
    except ValueError:
        raise ValueError(f"bad route destination: {o.get('dest')!r}") from None
    via = str(o.get("via") or "").strip()
    if via:
        try:
            via = str(ipaddress.IPv4Address(via))
        except ValueError:
            raise ValueError(f"bad next hop: {via[:40]!r}") from None
    dev = str(o.get("dev") or "").strip()
    if dev:
        dev = _port(dev)
    if not via and not dev:
        raise ValueError(f"route {dest} needs a next hop or an interface")
    return {"dest": dest, "via": via, "dev": dev}


def validate(ops):
    """Clean list of operations, or ValueError. Unknown fields are dropped."""
    if not isinstance(ops, list) or not ops:
        raise ValueError("no operations")
    if len(ops) > MAX_OPS:
        raise ValueError(f"at most {MAX_OPS} operations")
    out = []
    for o in ops:
        if not isinstance(o, dict) or o.get("op") not in OPS:
            raise ValueError(f"unknown operation: {str(o.get('op') if isinstance(o, dict) else o)[:30]!r}")
        op = o["op"]
        if op == "hostname":
            c = {"name": _name(o.get("name"), "hostname")}
        elif op == "iface-enable":
            c = {"port": _port(o.get("port")), "enabled": bool(o.get("enabled"))}
        elif op == "iface-desc":
            desc = CONTROL_RE.sub("", str(o.get("desc") or "")).strip()
            if len(desc) > 200:
                raise ValueError("description longer than 200 characters")
            c = {"port": _port(o.get("port")), "desc": desc}
        elif op == "iface-ip":
            ip = str(o.get("ip") or "").strip()
            old = o.get("old") or []
            if not isinstance(old, list) or len(old) > 8:
                raise ValueError("bad list of old addresses")
            c = {"port": _port(o.get("port")), "ip": ip if ip in ("", "dhcp") else _cidr(ip), "old": [_cidr(x) for x in old]}
        elif op == "sw-access":
            c = {"port": _port(o.get("port")), "vlan": _vlan(o.get("vlan"))}
        elif op == "sw-trunk":
            tv = str(o.get("trunkVlans") or "all").strip().lower().replace(" ", "")
            if not VLAN_LIST_RE.match(tv):
                raise ValueError(f"bad VLAN list: {tv[:40]!r}")
            c = {"port": _port(o.get("port")), "nativeVlan": _vlan(o.get("nativeVlan") or 1), "trunkVlans": tv}
        elif op == "sw-routed":
            c = {"port": _port(o.get("port"))}
        elif op in ("vlan-add", "vlan-name"):
            c = {"id": _vlan(o.get("id")), "name": _name(o.get("name"), "VLAN name")}
        elif op == "vlan-del":
            c = {"id": _vlan(o.get("id"))}
            if c["id"] == 1:
                raise ValueError("VLAN 1 can not be removed")
        else:
            c = _route(o)
        c["op"] = op
        out.append(c)
    return out
