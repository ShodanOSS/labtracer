# SPDX-License-Identifier: Apache-2.0
"""MikroTik RouterOS driver (v6 and v7): collect, push, backup, rollback timer, restore.

RouterOS answers SSH exec commands, so each read is one exec call ("print terse": one item
per line, key=value). The config (/export terse) is the source for static routes and VLAN
interfaces; the print commands give the running state.

Changes are persistent as soon as RouterOS accepts them (there is no running/startup split).
Before a change, a binary backup is saved on the router (/system backup save). The rollback
timer is a script that waits, then loads that backup (the router reboots into the old config);
LabTracer removes the script when it reaches the router again after the change.
Tested on recorded and simulated output only: check the commands on your router first.
"""

import re

from ..facts import cidr, iface, ip_only, neighbor, new_facts, norm_dest, norm_mac

NAME = "routeros"
ROLLBACK = "a script on the router loads the pre-change backup (and reboots) unless LabTracer confirms the change"
KV_RE = re.compile(r'([A-Za-z][\w.-]*)=("(?:[^"\\]|\\.)*"|\S*)')
ROW_RE = re.compile(r"^\s*(\d+)\s+([A-Z ]*?)\s*(?=[a-z][\w.-]*=)(.*)$")
ERROR_RE = re.compile(r"(?im)^\s*(failure:|bad command name|syntax error|expected |no such item|invalid value|"
                      r"input does not match|ambiguous value|already have|value of \S+ out of range|not enough permissions)")
UNSAFE = re.compile(r'["\\$\[\]{};?]')
READS = (("identity", "/system identity print"), ("resource", "/system resource print"),
         ("routerboard", "/system routerboard print"), ("export", "/export terse"),
         ("ifaces", "/interface print terse"), ("addrs", "/ip address print terse"),
         ("neighbors", "/ip neighbor print terse"), ("arp", "/ip arp print terse"),
         ("hosts", "/interface bridge host print terse"), ("services", "/ip service print terse"))


def collect(sess):
    out = {}
    for key, cmd in READS:
        try:
            _st, text, err = sess.run(cmd, timeout=60)
            out[key] = text + err
        except Exception as exc:  # noqa: BLE001  (one missing menu only empties its part)
            out[key] = f"failure: {exc}"
    return parse(out)


def _rows(text):
    """print terse -> [(flags, {key: value})]."""
    out = []
    for line in (text or "").splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        kv = {k: v[1:-1].replace('\\"', '"') if v.startswith('"') else v for k, v in KV_RE.findall(m.group(3))}
        out.append((m.group(2).replace(" ", ""), kv))
    return out


def _lines(text):
    """'  name: value' lines (print without terse)."""
    out = {}
    for line in (text or "").splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip()
    return out


def _export(text, menu):
    """Lines of /export terse for one menu ('/ip route add ...') -> [{key: value}]."""
    out = []
    for line in (text or "").splitlines():
        if line.startswith(menu + " add ") or line.startswith(menu + " set "):
            out.append({k: v[1:-1] if v.startswith('"') else v for k, v in KV_RE.findall(line[len(menu) + 5:])})
    return out


def _bad(text):
    return bool(ERROR_RE.search(text or ""))


def parse(o):
    f = new_facts(NAME)
    s = f["system"]
    s["vendor"] = "MikroTik"
    s["hostname"] = _lines(o.get("identity")).get("name", "")
    res, rb = _lines(o.get("resource")), _lines(o.get("routerboard"))
    s["model"] = rb.get("model") or res.get("board-name", "")
    s["serial"] = rb.get("serial-number", "")
    s["os"] = "RouterOS" if res else ""
    s["osVersion"] = (res.get("version") or "").split(" ")[0]
    export = o.get("export", "")
    if export and not _bad(export):
        f["rawConfig"] = "\n".join(ln for ln in export.splitlines() if not re.match(r"^# \S+ \d", ln)).strip("\n") + "\n"
    vlans = {v.get("name"): v for v in _export(export, "/interface vlan")}
    bridge_ports = {p.get("interface"): p for p in _export(export, "/interface bridge port")}
    ifs = {}
    for flags, kv in _rows(o.get("ifaces")):
        name = kv.get("name")
        if not name:
            continue
        typ = kv.get("type", "")
        kind = {"ether": "eth", "sfp": "sfp", "wlan": "wifi", "wifi": "wifi", "vlan": "sub", "bridge": "eth", "loopback": "loop",
                "wg": "tunnel", "pppoe-out": "tunnel", "gre-tunnel": "tunnel", "eoip": "tunnel", "ovpn-client": "tunnel"}.get(typ, "eth")
        if name.startswith("sfp"):
            kind = "sfp"
        i = iface(name, mac=norm_mac(kv.get("mac-address")), adminUp="X" not in flags, operUp="R" in flags, kind=kind,
                  desc=kv.get("comment", ""), master=(bridge_ports.get(name) or {}).get("bridge", ""))
        mtu = kv.get("actual-mtu") or kv.get("mtu")
        i["mtu"] = int(mtu) if (mtu or "").isdigit() else None
        if name in vlans:
            i["vlan"] = int(vlans[name].get("vlan-id") or 0) or None
        ifs[name] = i
    for flags, kv in _rows(o.get("addrs")):
        i = ifs.get(kv.get("interface") or kv.get("actual-interface"))
        c = cidr(*(kv.get("address", "") + "/32").split("/")[:2]) if kv.get("address") else ""
        if i is not None and c and "X" not in flags:
            i["ips"].append(c)
            if "D" in flags:
                i["dhcp"] = True
    f["interfaces"] = list(ifs.values())
    routes = []
    for r in _export(export, "/ip route"):
        if r.get("disabled") == "yes" or r.get("routing-table", "main") != "main":
            continue
        gw = r.get("gateway", "")
        via = gw if ip_only(gw) == gw and gw else ""
        routes.append({"dest": norm_dest(r.get("dst-address") or "0.0.0.0/0"), "via": via, "dev": "" if via else gw})
    f["routes"] = routes
    nb = o.get("neighbors", "")
    if nb.strip() and not _bad(nb):
        f["neighbors"] = [neighbor(kv.get("interface", "").split(",")[0], kv.get("identity", ""), kv.get("interface-name", ""),
                                   kv.get("mac-address", ""), kv.get("address4") or kv.get("address", ""))
                          for _fl, kv in _rows(nb) if kv.get("interface")]
    arp = o.get("arp", "")
    if arp.strip() and not _bad(arp):
        f["arp"] = [{"ip": ip_only(kv.get("address")), "mac": norm_mac(kv.get("mac-address")), "dev": kv.get("interface", "")}
                    for _fl, kv in _rows(arp) if ip_only(kv.get("address")) and norm_mac(kv.get("mac-address"))]
    hosts = o.get("hosts", "")
    if hosts.strip() and not _bad(hosts):
        f["macTable"] = [{"mac": norm_mac(kv.get("mac-address")), "vlan": int(kv["vid"]) if (kv.get("vid") or "").isdigit() else None,
                          "port": kv.get("on-interface") or kv.get("interface", "")}
                         for fl, kv in _rows(hosts) if "L" not in fl and norm_mac(kv.get("mac-address"))]
    svc = o.get("services", "")
    if svc.strip() and not _bad(svc):
        f["listening"] = sorted(({"port": int(kv["port"]), "proto": "tcp"} for fl, kv in _rows(svc)
                                 if "X" not in fl and (kv.get("port") or "").isdigit()), key=lambda x: x["port"])
    if not f["interfaces"]:
        f["errors"].append("no interfaces found (/interface print gave no output)")
    return f


# ---------------------------------------------------------------- remediation
def _find(menu, **kw):
    cond = " and ".join(f'{k}="{v}"' for k, v in kw.items())
    return f"[find {cond}]"


def render(ops, facts=None):
    cmds, notes = [], []
    for o in ops:
        op = o["op"]
        port = o.get("port", "")
        if op == "hostname":
            cmds.append(f"/system identity set name={o['name']}")
        elif op == "iface-enable":
            cmds.append(f"/interface set {_find('/interface', name=port)} disabled={'no' if o['enabled'] else 'yes'}")
        elif op == "iface-desc":
            desc = UNSAFE.sub("", o["desc"])
            cmds.append(f'/interface set {_find("/interface", name=port)} comment="{desc}"')
        elif op == "iface-ip":
            for a in o["old"]:
                cmds.append(f"/ip address remove {_find('/ip address', address=a, interface=port)}")
            if o["ip"] == "dhcp":
                cmds.append(f"/ip dhcp-client add interface={port} disabled=no")
            else:
                cmds.append(f"/ip dhcp-client remove {_find('/ip dhcp-client', interface=port)}")
                if o["ip"]:
                    cmds.append(f"/ip address add address={o['ip']} interface={port}")
        elif op == "route-add":
            cmds.append(f"/ip route add dst-address={o['dest']} gateway={o['via'] or o['dev']}")
        elif op == "route-del":
            cmds.append(f"/ip route remove {_find('/ip route', **{'dst-address': o['dest'], 'gateway': o['via'] or o['dev']})}")
        else:
            notes.append(f"{op}: switch port and VLAN changes on RouterOS (bridge VLAN filtering) are not rendered. "
                         "Make them in the SSH console or WinBox.")
    notes.append("RouterOS keeps each change as soon as it accepts it (no separate save).")
    return cmds, sorted(set(notes), key=notes.index)


def apply(sess, cmds, save=False, armed=None, extra=None, facts=None):
    log = []
    for c in cmds:
        st, out, err = sess.run(c, timeout=60)
        text = (out + err).strip()
        log.append("> " + c)
        if text:
            log.append(text)
        if st not in (0, None) or _bad(text):
            log.append("! Stopped: the router refused this command. The commands before it are applied (and kept).")
            return False, "\n".join(log)
    return True, "\n".join(log)


def backup(sess, backup_id, facts=None):
    _st, export, err = sess.run("/export terse", timeout=90)
    if _bad(export + err) or not export.strip():
        raise ValueError("could not read the config (/export) for the backup. Nothing was changed.")
    name = f"lt-{backup_id}"
    _st, out, err = sess.run(f"/system backup save name={name} dont-encrypt=yes", timeout=90)
    on_dev = "" if _bad(out + err) else f"{name}.backup"
    config = "\n".join(ln for ln in export.splitlines() if not re.match(r"^# \S+ \d", ln)).strip("\n") + "\n"
    return {"config": config, "files": {}, "archive": "", "onDevice": on_dev}


def _script(backup_id):
    return f"lt-rollback-{backup_id}"


def arm(sess, backup_doc, minutes, extra=None, facts=None):
    if not backup_doc.get("onDevice"):
        return None, "# No backup on the router: no rollback timer."
    minutes = max(2, min(60, int(minutes)))
    name = _script(backup_doc["id"])
    src = f':delay {minutes}m; /system backup load name={backup_doc["onDevice"]} password=\\"\\"'
    log = []
    for c in (f'/system script add name={name} dont-require-permissions=yes source="{src}"',
              f'/execute script="/system script run {name}"'):
        _st, out, err = sess.run(c, timeout=30)
        log += ["> " + c, (out + err).strip()]
        if _bad(out + err):
            return None, "\n".join(log + ["! The rollback timer could not be started."])
    return {"script": name}, "\n".join(x for x in log if x) + f"\n# the router loads the backup in {minutes} min unless confirmed"


def confirm(sess, token, facts=None):
    name = token["script"]
    log, ok = [], True
    for c in (f'/system script job remove [find script="{name}"]', f'/system script remove [find name="{name}"]'):
        _st, out, err = sess.run(c, timeout=30)
        log += ["> " + c, (out + err).strip()]
        ok = ok and not _bad(out + err)
    return ok, "\n".join(x for x in log if x)


def restore(sess, backup_doc, facts=None):
    """Load the binary backup kept on the router. The router reboots."""
    name = backup_doc.get("onDevice") or ""
    if not re.fullmatch(r"lt-[0-9]{8}-[0-9]{6}-[A-Za-z0-9]{4,12}\.backup", name):
        return False, "This backup has no copy on the router. Open it and paste the lines you need in the SSH console."
    script = f"lt-restore-{backup_doc['id']}"
    log = []
    for c in (f'/system script add name={script} dont-require-permissions=yes source=":delay 2s; /system backup load name={name} password=\\"\\""',
              f'/execute script="/system script run {script}"'):
        _st, out, err = sess.run(c, timeout=30)
        log += ["> " + c, (out + err).strip()]
        if _bad(out + err):
            return False, "\n".join(x for x in log if x)
    return True, "\n".join(x for x in log if x) + "\n# the router loads the backup and reboots now"
