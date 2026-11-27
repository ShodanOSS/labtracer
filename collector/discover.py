"""Discovery: find the devices of a network that LabTracer does not know yet.

    GUI --POST /api/discover/<lab> {ranges, ssh, ...}--> job "discover"
        <-- /api/events: progress;  GET /api/discover/<lab>: the last result
        --POST /api/discover/<lab>/adopt {map: {ip: device id}} --> facts into data/observed

Steps, until nothing new turns up (or MAX_HOSTS):
  1. sweep: TCP connect to a few common ports. An answer, or a refused connection, means a host
     is there (no raw sockets, no root). Live hosts get a longer port list.
  2. names and MACs: reverse DNS; this PC's ARP cache (same subnet only).
  3. identify: hosts with SSH open are read with the collector drivers (Linux, IOS, RouterOS),
     with the SSH user and key given for the run.
  4. crawl (optional): management addresses of LLDP/CDP neighbors, addresses in the ARP tables of
     the devices read, and (optional) their connected subnets, are swept too.
The browser builds the lab from the result (src/discover.js): devices, ports, addresses, cables
from LLDP/CDP and from switch MAC tables.

Read-only like Collect. It only connects to the ranges you give (and, with crawl, to the
addresses the devices themselves report). Off on a non-loopback bind.
"""

import errno
import ipaddress
import json
import os
import re
import socket
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait
from pathlib import Path

import ssh_bridge

from . import audit, drivers, store
from .conn import HostKeyUnknown, Session

DISC_DIR = Path(__file__).resolve().parent.parent / "data" / "discovery"
MAX_HOSTS = 4096           # addresses swept in one run
MAX_SUBNET_PREFIX = 22     # a connected subnet larger than /22 is not swept (crawl)
SWEEP = (22, 80, 443, 445, 3389, 53, 23, 8006, 8291, 8080)
DETAIL = (21, 25, 139, 161, 515, 554, 631, 1883, 3306, 5000, 5001, 5432, 5900, 8123, 8443, 8883, 9090, 9100)
TIMEOUT = 0.6
SCAN_WORKERS = 96
SSH_WORKERS = 4
REFUSED = {errno.ECONNREFUSED, 10061}  # 10061: WSAECONNREFUSED (Windows)
_running = {}
_lock = threading.Lock()


# ---------------------------------------------------------------- input
def expand(ranges, limit=MAX_HOSTS):
    """'192.168.1.0/24', '10.0.0.5-10.0.0.40', '10.0.0.5-40', '10.0.0.7' -> [ip strings]."""
    out, seen = [], set()
    for raw in ranges or []:
        r = str(raw).strip()
        if not r:
            continue
        try:
            if "/" in r:
                net = ipaddress.IPv4Network(r, strict=False)
                if net.num_addresses > limit:
                    raise ValueError(f"{r} has {net.num_addresses} addresses; at most {limit} per run")
                ips = list(net.hosts()) if net.prefixlen < 31 else list(net)
            elif "-" in r:
                a, b = r.split("-", 1)
                first = ipaddress.IPv4Address(a.strip())
                b = b.strip()
                last = ipaddress.IPv4Address(b if "." in b else a.strip().rsplit(".", 1)[0] + "." + b)
                if int(last) < int(first) or int(last) - int(first) >= limit:
                    raise ValueError(f"bad range {r}")
                ips = [ipaddress.IPv4Address(i) for i in range(int(first), int(last) + 1)]
            else:
                ips = [ipaddress.IPv4Address(r)]
        except ValueError as exc:
            raise ValueError(str(exc) if "addresses" in str(exc) or "range" in str(exc) else f"not an address, range or subnet: {r[:40]}") from None
        for ip in ips:
            if ip.is_multicast or ip.is_unspecified or ip.is_loopback:
                continue
            s = str(ip)
            if s not in seen:
                seen.add(s)
                out.append(s)
            if len(out) > limit:
                raise ValueError(f"more than {limit} addresses: use smaller ranges")
    return out


# ---------------------------------------------------------------- sweep
def probe(ip, port, timeout=TIMEOUT):
    """'open', 'closed' (refused: the host is there) or None (no answer)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        rc = s.connect_ex((ip, port))
    except OSError:
        return None
    finally:
        s.close()
    if rc == 0:
        return "open"
    return "closed" if rc in REFUSED else None


def _sweep_one(ip, ports):
    alive, open_ = False, []
    for port in ports:
        r = probe(ip, port)
        if r == "open":
            alive = True
            open_.append(port)
        elif r == "closed":
            alive = True
    return alive, open_


def ping(ip):
    """One ICMP echo with the system ping (no raw sockets needed). True when the host answered."""
    if os.name == "nt":
        argv = ["ping", "-n", "1", "-w", "800", ip]
    elif os.uname().sysname == "Darwin":
        argv = ["ping", "-c", "1", "-t", "1", ip]
    else:
        argv = ["ping", "-c", "1", "-W", "1", ip]
    try:
        r = subprocess.run(argv, capture_output=True, text=True, timeout=5)  # noqa: S603,S607 (fixed argv; ip is validated)
    except (OSError, subprocess.SubprocessError):
        return False
    return r.returncode == 0 and "ttl=" in r.stdout.lower()


def local_arp():
    """IP -> MAC from this PC's ARP cache (arp -a: Windows, Linux, macOS)."""
    try:
        out = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=10).stdout  # noqa: S603,S607
    except (OSError, subprocess.SubprocessError):
        return {}
    res = {}
    for m in re.finditer(r"(\d{1,3}(?:\.\d{1,3}){3})\)?\s+(?:at\s+)?([0-9A-Fa-f]{1,2}(?:[:-][0-9A-Fa-f]{1,2}){5})", out):
        mac = ":".join(x.zfill(2) for x in re.split("[:-]", m.group(2).lower()))
        if mac not in ("ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00") and not mac.startswith("01:00:5e"):
            res[m.group(1)] = mac
    return res


def _rdns(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except (OSError, UnicodeError):
        return ""


# ---------------------------------------------------------------- run
def start(lab, body, new_job, changed):
    """Start a discovery job (new_job, changed: from collector/__init__.py). Returns the job."""
    if not ssh_bridge.ENABLED:
        raise PermissionError("discovery is off because server.py listens on a network address")
    if not isinstance(body, dict):
        raise ValueError("bad request")
    lab = store.safe(lab)
    with _lock:
        if _running.get(lab):
            raise ValueError("a discovery is already running for this lab")
    targets = expand(body.get("ranges"))
    if not targets and not body.get("only"):
        raise ValueError("give at least one address, range or subnet")
    ssh = body.get("ssh") if isinstance(body.get("ssh"), dict) else {}
    p = None
    if ssh.get("user") or ssh.get("keyFile") or ssh.get("auth") == "password":
        p = ssh_bridge.validate({"host": "0.0.0.0", **{k: ssh.get(k) for k in ("user", "port", "auth", "keyFile", "legacy")}, "engine": "paramiko"})
    opts = {"ranges": [str(r).strip()[:60] for r in body.get("ranges") or []][:64], "crawl": bool(body.get("crawl")), "subnets": bool(body.get("subnets")), "tofu": bool(body.get("tofu")),
            "scope": [str(n) for n in (ipaddress.IPv4Network(r, strict=False) for r in body.get("ranges") or [] if "/" in str(r))]}
    password = body.get("password") if isinstance(body.get("password"), str) and p and p["auth"] == "password" else None
    trust = body.get("trust") if isinstance(body.get("trust"), dict) else {}
    job = new_job(lab, "discover")
    job["discovery"] = {"phase": "sweep", "total": len(targets), "swept": 0, "alive": 0, "identified": 0, "hosts": 0}
    job["devices"]["discovery"] = {"state": "running", "name": "discovery"}  # the job is done when this is
    with _lock:
        _running[lab] = job["id"]
    only = [x for x in body.get("only") or [] if isinstance(x, str)]
    threading.Thread(target=_run, args=(job, lab, targets, p, password, trust, opts, only, changed), daemon=True,
                     name="discover").start()
    audit.record(lab, "discover-start", ranges=[str(r)[:60] for r in body.get("ranges") or []], addresses=len(targets),
                 ssh=bool(p), crawl=opts["crawl"], subnets=opts["subnets"], tofu=opts["tofu"])
    password = None  # noqa: F841
    return job


def _run(job, lab, targets, p, password, trust, opts, only, changed):
    prog = job["discovery"]
    prev = read(lab) if only else None
    hosts = {h["ip"]: h for h in (prev or {}).get("hosts", [])} if prev else {}
    swept = set(hosts)
    try:
        with ThreadPoolExecutor(max_workers=SCAN_WORKERS, thread_name_prefix="sweep") as pool:
            queue = [(ip, "scan") for ip in targets]
            rounds = 0
            while (queue or rounds == 0) and rounds < 4:  # one pass even with no new addresses (re-identify)
                rounds += 1
                batch = [(ip, via) for ip, via in queue if ip not in swept][:MAX_HOSTS - len(swept)]
                queue = []
                for ip, _via in batch:
                    swept.add(ip)
                prog.update(phase="sweep", total=prog["swept"] + len(batch))
                changed(job)
                futs = {pool.submit(_sweep_one, ip, SWEEP): (ip, via) for ip, via in batch}
                for f in futs:
                    ip, via = futs[f]
                    alive, open_ = f.result()
                    prog["swept"] += 1
                    known = via in ("arp", "neighbor")  # a device reported it: it exists even if it answers nothing
                    if alive or known:
                        hosts[ip] = {"ip": ip, "via": via, "alive": alive, "ports": open_, "rdns": "", "mac": "", "ssh": {"state": "none"}}
                    if prog["swept"] % 32 == 0:
                        prog["alive"] = len(hosts)
                        changed(job)
                # no port answered: ICMP, then this PC's ARP cache (filled by the sweep on a local subnet)
                silent = [ip for ip, _v in batch if ip not in hosts]
                prog["phase"] = "ping"
                changed(job)
                arp_now = {}
                for ip, ok in zip(silent, pool.map(ping, silent)) if silent else ():
                    if ok:
                        hosts[ip] = {"ip": ip, "via": dict(batch)[ip], "alive": True, "ports": [], "rdns": "", "mac": "", "ssh": {"state": "none"}}
                if silent:
                    arp_now = local_arp()
                for ip in silent:
                    if ip not in hosts and ip in arp_now:
                        hosts[ip] = {"ip": ip, "via": dict(batch)[ip], "alive": True, "ports": [], "rdns": "", "mac": arp_now[ip],
                                     "macFrom": "this PC", "ssh": {"state": "none"}}
                new = [h for h in hosts.values() if h["ip"] in dict(batch) and h["alive"]]
                for h, (_a, extra) in zip(new, pool.map(lambda h: _sweep_one(h["ip"], DETAIL), new)):
                    h["ports"] = sorted(set(h["ports"]) | set(extra))
                prog.update(alive=len(hosts), phase="names")
                changed(job)
                todo = [h for h in hosts.values() if not h["rdns"]]
                fut = {pool.submit(_rdns, h["ip"]): h for h in todo}
                wait(fut, timeout=10)
                for f, h in fut.items():
                    if f.done():
                        h["rdns"] = f.result()
                arp = local_arp()
                for h in hosts.values():
                    if not h["mac"] and h["ip"] in arp:
                        h["mac"], h["macFrom"] = arp[h["ip"]], "this PC"
                if p:
                    prog["phase"] = "identify"
                    changed(job)
                    ids = [h for h in hosts.values() if (22 in h["ports"] or p["port"] in h["ports"])
                           and (h["ip"] in only if only else h["ssh"]["state"] in ("none", "hostkey"))]
                    with ThreadPoolExecutor(max_workers=SSH_WORKERS, thread_name_prefix="identify") as sp:
                        list(sp.map(lambda h: _identify(h, p, password, trust, opts["tofu"]), ids))
                    prog["identified"] = sum(1 for h in hosts.values() if h.get("facts"))
                if opts["crawl"] or opts["subnets"]:
                    queue = _more(hosts, opts, swept)
            password = None
        _correlate(hosts)
        result = {"lab": lab, "finished": time.time(), "hosts": sorted(hosts.values(), key=lambda h: ipaddress.IPv4Address(h["ip"])),
                  "swept": len(swept), "ranges": opts["ranges"] or (prev or {}).get("ranges", [])}
        _save(lab, result)
        prog.update(phase="done", hosts=len(hosts))
        job["devices"]["discovery"] = {"state": "done", "name": "discovery"}
        audit.record(lab, "discover-finish", hosts=len(hosts), identified=prog["identified"], swept=len(swept))
    except Exception as exc:  # noqa: BLE001
        prog["phase"] = "error"
        job["devices"]["discovery"] = {"state": "error", "name": "discovery", "error": str(exc) or type(exc).__name__}
        audit.record(lab, "discover-error", error=str(exc))
    finally:
        with _lock:
            _running.pop(lab, None)
        changed(job)


def _identify(h, p, password, trust, tofu):
    sess = None
    try:
        sess = Session.open({**p, "host": h["ip"]}, password, True if tofu else (trust.get(h["ip"]) or None))
        drv = drivers.detect(sess)
        facts = drv.collect(sess)
        facts["host"] = h["ip"]
        h.update(facts=facts, driver=drv.NAME, ssh={"state": "done"})
    except HostKeyUnknown as exc:
        h["ssh"] = {"state": "hostkey", "keytype": exc.keytype, "fingerprint": exc.fingerprint}
    except Exception as exc:  # noqa: BLE001
        text = ssh_bridge._err_text(exc)
        h["ssh"] = {"state": "auth" if "uthentication" in text else "error", "error": text[:300]}
    finally:
        if sess:
            sess.close()


def _private(ip):
    try:
        a = ipaddress.IPv4Address(ip)
    except ValueError:
        return False
    return a.is_private and not a.is_loopback and not a.is_link_local


def _in_scope(ip, scope):
    a = ipaddress.IPv4Address(ip)
    return any(a in ipaddress.IPv4Network(n) for n in scope)


def _more(hosts, opts, swept):
    """New addresses to sweep, from what the identified devices report."""
    out = []
    for h in list(hosts.values()):
        f = h.get("facts") or {}
        if opts["crawl"]:
            for nb in f.get("neighbors") or []:
                ip = nb.get("remoteIp")
                if ip and _private(ip) and ip not in swept:
                    out.append((ip, "neighbor"))
            for a in f.get("arp") or []:
                ip = a.get("ip")
                if ip and _private(ip) and ip not in swept and (not opts["scope"] or _in_scope(ip, opts["scope"])):
                    out.append((ip, "arp"))
                elif ip and ip not in swept and opts["subnets"] and _private(ip):
                    out.append((ip, "arp"))
        if opts["subnets"]:
            for i in f.get("interfaces") or []:
                for c in i.get("ips") or []:
                    try:
                        net = ipaddress.IPv4Interface(c).network
                    except ValueError:
                        continue
                    if net.prefixlen >= MAX_SUBNET_PREFIX and net.is_private and not net.is_loopback:
                        out += [(str(x), "subnet") for x in net.hosts() if str(x) not in swept]
    seen, uniq = set(), []
    for ip, via in out:
        if ip not in seen:
            seen.add(ip)
            uniq.append((ip, via))
    return uniq


def _correlate(hosts):
    """MACs from the ARP tables of the devices read; which host is which identified device."""
    arp = {}
    for h in hosts.values():
        for a in (h.get("facts") or {}).get("arp") or []:
            arp.setdefault(a["ip"], (a["mac"], (h.get("facts") or {}).get("system", {}).get("hostname") or h["ip"]))
    own = {}
    for h in hosts.values():
        for i in (h.get("facts") or {}).get("interfaces") or []:
            for c in i.get("ips") or []:
                own[c.split("/")[0]] = h["ip"]
    for h in hosts.values():
        if not h["mac"] and h["ip"] in arp:
            h["mac"], h["macFrom"] = arp[h["ip"]][0], arp[h["ip"]][1]
        if h["ip"] in own and own[h["ip"]] != h["ip"]:
            h["sameAs"] = own[h["ip"]]  # a second address of a device that was read


# ---------------------------------------------------------------- storage
def _path(lab):
    return DISC_DIR / f"{store.safe(lab)}.json"


def _save(lab, doc):
    p = _path(lab)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc), "utf-8")
    os.replace(tmp, p)


def read(lab):
    try:
        return json.loads(_path(lab).read_text("utf-8"))
    except (OSError, ValueError):
        return None


def running(lab):
    with _lock:
        return _running.get(store.safe(lab))


def adopt(lab, body):
    """body: {map: {ip: device id}}: the facts of these hosts become the observed facts of the
    devices the browser made from them, so their Drift tab works at once."""
    doc = read(lab)
    if not doc:
        raise ValueError("no discovery result for this lab")
    m = body.get("map") if isinstance(body, dict) else None
    if not isinstance(m, dict):
        raise ValueError("map must be an object")
    by_ip = {h["ip"]: h for h in doc.get("hosts", [])}
    n = 0
    for ip, dev in m.items():
        h = by_ip.get(ip)
        if h and h.get("facts") and isinstance(dev, str) and dev:
            store.save(lab, store.safe(dev), h["facts"])
            n += 1
    audit.record(lab, "discover-adopt", devices=[store.safe(str(d)) for d in m.values()][:500], withFacts=n)
    return {"ok": True, "facts": n}
