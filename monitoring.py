"""Monitoring backends for live status. Standard library only.

Every backend answers status(cfg, targets) with the format of the check agent's /status,
so the GUI does not care where the results come from:

  {host, version, source, generated, now, interval, targets, error, monitoredHosts,
   devices: {device id: {name, state: up|degraded|down|unknown, since, checks: [...], history: [...]}}}

  agent       the LabTracer check agent (agent/): its own ping and TCP checks, or the results of
              Nagios / Naemon / Icinga 1 / Checkmk (source "nagios" in agent.json). Unchanged.
  prometheus  Prometheus HTTP API: "up" and "probe_success" (blackbox exporter) per instance.
  zabbix      Zabbix JSON-RPC API (5.4 or later, API token): host availability and open problems.
  icinga2     Icinga 2 REST API (API user): host and service states.
  librenms    LibreNMS API (token): device status and open alerts.

LabTracer devices are matched to monitored hosts by address (the monitor address of the device),
then by name (case-insensitive, without the domain). The backend is read-only: LabTracer never
changes anything in the monitoring system.
"""

import base64
import json
import ssl
import time
import urllib.parse
import urllib.request

BACKENDS = ("agent", "prometheus", "zabbix", "icinga2", "librenms")
LABELS = {"agent": "LabTracer agent (checks or Nagios)", "prometheus": "Prometheus", "zabbix": "Zabbix",
          "icinga2": "Icinga 2", "librenms": "LibreNMS"}
HISTORY = 120
_hist = {}   # (backend, device id) -> [[ts, ok, total, ms]]
_since = {}  # (backend, device id) -> (state, since)


def _ctx(cfg, url):
    if not url.startswith("https://"):
        return None
    ctx = ssl.create_default_context(cafile=cfg.get("cafile") or None)
    if cfg.get("insecure"):
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def http(cfg, method, path, body=None, headers=None, timeout=8):
    base = (cfg.get("url") or "").rstrip("/")
    if not base.startswith(("http://", "https://")):
        raise ValueError("no URL set for the monitoring backend")
    req = urllib.request.Request(base + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout, context=_ctx(cfg, base)) as r:  # noqa: S310 (URL set by the local user)
        return json.loads(r.read().decode("utf-8"))


def _basic(cfg):
    if cfg.get("user"):
        tok = base64.b64encode(f"{cfg['user']}:{cfg.get('secret') or ''}".encode()).decode()
        return {"Authorization": "Basic " + tok}
    return {}


def _short(n):
    return str(n or "").strip().lower().split(".")[0]


class Matcher:
    """Find the LabTracer device for a monitored host: by address, then by name."""

    def __init__(self, targets):
        self.by_addr, self.by_name, self.targets = {}, {}, targets
        for t in targets:
            for c in t.get("checks") or []:
                if c.get("host"):
                    self.by_addr.setdefault(str(c["host"]).lower(), t["id"])
            self.by_name.setdefault(_short(t.get("name")), t["id"])
            self.by_name.setdefault(str(t.get("name") or "").lower().replace(" ", "-"), t["id"])

    def find(self, *keys):
        for k in keys:
            k = str(k or "").strip().lower()
            if not k:
                continue
            host = k.split("://")[-1].split("/")[0]
            if host.count(":") == 1:
                host = host.split(":")[0]
            if host in self.by_addr:
                return self.by_addr[host]
            if _short(host) in self.by_name:
                return self.by_name[_short(host)]
        return None


def _finish(backend, cfg, targets, per_dev, hosts, error="", interval=30):
    """per_dev: {device id: [check, ...]} with check {type, label, ok, state, output, host}."""
    now = time.time()
    devices = {}
    names = {t["id"]: t.get("name", "") for t in targets}
    for dev_id, checks in per_dev.items():
        okn = sum(1 for c in checks if c["ok"])
        host_down = any(c.get("label") == "host" and not c["ok"] for c in checks)
        state = "unknown" if not checks else ("down" if host_down or okn == 0 else "up" if okn == len(checks) else "degraded")
        key = (backend, dev_id)
        prev = _since.get(key)
        if not prev or prev[0] != state:
            _since[key] = (state, now)
        h = _hist.setdefault(key, [])
        h.append([int(now), okn, len(checks), None])
        del h[:-HISTORY]
        devices[dev_id] = {"name": names.get(dev_id, ""), "state": state, "since": _since[key][1], "checks": checks, "history": list(h)}
    return {"host": (cfg.get("url") or "").split("://")[-1].split("/")[0], "version": LABELS[backend], "source": backend,
            "generated": now, "now": now, "interval": interval, "targets": len(targets), "devices": devices,
            "error": error, "monitoredHosts": sorted(set(hosts))}


def _add(per_dev, dev_id, check):
    if dev_id:
        per_dev.setdefault(dev_id, []).append(check)


# ---------------------------------------------------------------- Prometheus
def prometheus(cfg, targets):
    hdr = {"Authorization": "Bearer " + cfg["secret"]} if cfg.get("secret") and not cfg.get("user") else _basic(cfg)
    m = Matcher(targets)
    per_dev, hosts = {}, []
    for query in ("up", "probe_success"):
        r = http(cfg, "GET", "/api/v1/query?" + urllib.parse.urlencode({"query": query}), headers=hdr)
        if r.get("status") != "success":
            raise ValueError(r.get("error") or "Prometheus did not answer the query")
        for s in r.get("data", {}).get("result", []):
            lab = s.get("metric", {})
            inst = lab.get("instance", "")
            hosts.append(inst)
            dev = m.find(inst, lab.get("hostname"), lab.get("nodename"))
            ok = str((s.get("value") or [0, "0"])[1]) == "1"
            _add(per_dev, dev, {"type": "prometheus", "host": inst, "label": f"{lab.get('job', query)} ({query})", "ok": ok,
                                "state": "UP" if ok else "DOWN", "ms": None, "err": "" if ok else "down"})
    return _finish("prometheus", cfg, targets, per_dev, hosts)


# ---------------------------------------------------------------- Zabbix
def _zbx(cfg, method, params):
    body = {"jsonrpc": "2.0", "method": method, "params": params, "id": 1}
    r = http(cfg, "POST", "/api_jsonrpc.php", body, headers={"Authorization": "Bearer " + (cfg.get("secret") or "")})
    if r.get("error") and "auth" in json.dumps(r["error"]).lower() and cfg.get("secret"):
        r = http(cfg, "POST", "/api_jsonrpc.php", {**body, "auth": cfg["secret"]})  # Zabbix before 6.4
    if r.get("error"):
        e = r["error"]
        raise ValueError(f"Zabbix: {e.get('message', '')} {e.get('data', '')}".strip())
    return r.get("result")


def zabbix(cfg, targets):
    m = Matcher(targets)
    hosts = _zbx(cfg, "host.get", {"output": ["hostid", "host", "name", "status"], "selectInterfaces": ["ip", "dns", "available"],
                                   "filter": {"status": 0}})
    problems = _zbx(cfg, "problem.get", {"output": ["objectid", "name", "severity"], "recent": False, "suppressed": False,
                                         "selectHosts": ["hostid"]}) or []
    triggers = {}
    if problems:
        for t in _zbx(cfg, "trigger.get", {"output": ["triggerid"], "triggerids": [p["objectid"] for p in problems],
                                           "selectHosts": ["hostid"]}) or []:
            triggers[t["triggerid"]] = [h["hostid"] for h in t.get("hosts", [])]
    per_dev, names = {}, []
    for h in hosts or []:
        ifs = h.get("interfaces") or []
        names.append(h.get("host") or h.get("name"))
        dev = m.find(*[i.get("ip") for i in ifs], *[i.get("dns") for i in ifs], h.get("host"), h.get("name"))
        avail = {str(i.get("available")) for i in ifs}
        ok = "2" not in avail or "1" in avail
        _add(per_dev, dev, {"type": "zabbix", "host": h.get("host"), "label": "host", "ok": ok,
                            "state": "available" if "1" in avail else ("unavailable" if "2" in avail else "unknown"), "ms": None,
                            "err": "" if ok else "unavailable"})
        for p in problems:
            if h["hostid"] in triggers.get(p["objectid"], []):
                _add(per_dev, dev, {"type": "zabbix", "host": h.get("host"), "label": p.get("name", "problem"), "ok": False,
                                    "state": ["not classified", "information", "warning", "average", "high", "disaster"][int(p.get("severity") or 0) % 6],
                                    "ms": None, "err": "problem"})
    return _finish("zabbix", cfg, targets, per_dev, names)


# ---------------------------------------------------------------- Icinga 2
def icinga2(cfg, targets):
    m = Matcher(targets)
    hdr = _basic(cfg)
    hosts = http(cfg, "GET", "/v1/objects/hosts?attrs=name&attrs=address&attrs=state&attrs=last_check_result&attrs=display_name", headers=hdr)
    svcs = http(cfg, "GET", "/v1/objects/services?attrs=host_name&attrs=display_name&attrs=state&attrs=last_check_result", headers=hdr)
    per_dev, names, dev_of = {}, [], {}
    for h in hosts.get("results", []):
        a = h.get("attrs", {})
        names.append(a.get("name"))
        dev = m.find(a.get("address"), a.get("name"), a.get("display_name"))
        dev_of[a.get("name")] = dev
        ok = int(a.get("state") or 0) == 0
        out = ((a.get("last_check_result") or {}).get("output") or "")[:300]
        _add(per_dev, dev, {"type": "icinga2", "host": a.get("name"), "label": "host", "ok": ok, "state": "UP" if ok else "DOWN",
                            "ms": None, "err": "" if ok else "down", "output": out})
    for s in svcs.get("results", []):
        a = s.get("attrs", {})
        st = int(a.get("state") or 0)
        out = ((a.get("last_check_result") or {}).get("output") or "")[:300]
        _add(per_dev, dev_of.get(a.get("host_name")), {"type": "icinga2", "host": a.get("host_name"), "label": a.get("display_name"),
                                                        "ok": st == 0, "state": ["OK", "WARNING", "CRITICAL", "UNKNOWN"][st % 4],
                                                        "ms": None, "err": "" if st == 0 else "not OK", "output": out})
    return _finish("icinga2", cfg, targets, per_dev, names)


# ---------------------------------------------------------------- LibreNMS
def librenms(cfg, targets):
    m = Matcher(targets)
    hdr = {"X-Auth-Token": cfg.get("secret") or ""}
    devs = http(cfg, "GET", "/api/v0/devices?type=active", headers=hdr).get("devices", [])
    try:
        alerts = http(cfg, "GET", "/api/v0/alerts?state=1", headers=hdr).get("alerts", [])
    except Exception:  # noqa: BLE001  (older LibreNMS, or no permission for alerts)
        alerts = []
    per_dev, names = {}, []
    for d in devs:
        names.append(d.get("hostname"))
        dev = m.find(d.get("ip"), d.get("hostname"), d.get("sysName"), d.get("display"))
        ok = str(d.get("status")) in ("1", "True", "true")
        _add(per_dev, dev, {"type": "librenms", "host": d.get("hostname"), "label": "host", "ok": ok, "state": "up" if ok else "down",
                            "ms": None, "err": "" if ok else (d.get("status_reason") or "down")})
        for a in alerts:
            if str(a.get("device_id")) == str(d.get("device_id")):
                _add(per_dev, dev, {"type": "librenms", "host": d.get("hostname"), "label": a.get("name") or a.get("rule_name") or f"alert {a.get('rule_id')}",
                                    "ok": False, "state": a.get("severity") or "alert", "ms": None, "err": "alert"})
    return _finish("librenms", cfg, targets, per_dev, names)


def status(cfg, targets):
    """Status in the agent format. cfg: monitor.json. targets: what the GUI sent (POST /api/monitor/targets)."""
    backend = cfg.get("backend") or "agent"
    fn = {"prometheus": prometheus, "zabbix": zabbix, "icinga2": icinga2, "librenms": librenms}.get(backend)
    if not fn:
        raise ValueError(f"unknown monitoring backend: {backend}")
    return fn(cfg, targets or [])
