# SPDX-License-Identifier: Apache-2.0
"""Collector: read the actual state of devices over SSH for the drift report, and push
reviewed changes back (remediation), with backups, rollback timers and an audit log.

    GUI --POST /api/collect/<lab>--> server.py --> job (thread pool) --SSH--> devices
        <--GET /api/collect/jobs/<id>  or /api/events (job and facts events)
                                                    --> data/observed/<lab>/<dev>.json
    GUI --POST /api/remediate/<lab>/plan  {device, ops}  --> {planId, commands}
        --POST /api/remediate/apply       {planId, save, rollback} --> job (one device)
    GUI --/api/changes/<lab>/...: staged change sets over many devices (changes.py),
        reviewed as a whole and applied in order --> job (one device after the other)

Every push runs the same steps (push()): backup -> rollback timer -> apply -> connect again
-> confirm (or restore) -> save -> collect again. Each step goes into the audit log
(audit.py); the config before the change is kept in data/backups (backups.py).

Runs in server.py on the PC, not in the check agent: the agent promises that it never
logs in to devices. Same rules as the SSH console: off on a non-loopback bind, passwords
are used for one run and never stored, unknown host keys need the user's confirmation
(state 'hostkey' with the fingerprint; run again with trust).

Remediation never takes command text from the browser: it takes operations (ops.py),
the driver renders the commands, the user reviews exactly those, and apply runs only a
plan id (or a change set whose digest matches what the user reviewed). A plan is used
once and expires after PLAN_TTL seconds.
"""

import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import ssh_bridge

from . import audit, backups, changes, drivers, ops, store
from .conn import HostKeyUnknown, Session

MAX_WORKERS = 4
MAX_DEVICES = 300
JOB_TTL = 3600
PLAN_TTL = 600
ROLLBACK_MAX = 60  # minutes
FINAL = ("done", "error", "hostkey", "skipped", "pending")

_jobs = {}
_plans = {}
_lock = threading.Lock()
_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="collect")
listeners = []  # functions that get event dicts: {"type": "job", "job": snapshot} and {"type": "facts", ...}


def _emit(event):
    for fn in list(listeners):
        try:
            fn(event)
        except Exception:  # noqa: BLE001  (a listener must never break a job)
            pass


def caps():
    ssh_bridge.load_paramiko()
    return {"enabled": ssh_bridge.ENABLED, "paramiko": ssh_bridge.paramiko is not None,
            "drivers": list(drivers.ALL), "supported": ["auto", *drivers.REGISTRY],
            "apply": [n for n, m in drivers.REGISTRY.items() if hasattr(m, "apply")],
            "safety": {n: drivers.safety(m) for n, m in drivers.REGISTRY.items()}}


def _check_enabled():
    if not ssh_bridge.ENABLED:
        raise PermissionError("collection is off because server.py listens on a network address")


def new_job(lab, kind):
    job = {"id": secrets.token_urlsafe(12), "kind": kind, "lab": store.safe(lab), "created": time.time(), "done": False, "devices": {}}
    with _lock:
        now = time.time()
        for k in [k for k, j in _jobs.items() if now - j["created"] > JOB_TTL]:
            del _jobs[k]
        for k in [k for k, p in _plans.items() if now - p["created"] > PLAN_TTL]:
            del _plans[k]
        _jobs[job["id"]] = job
    return job


def changed(job):
    with _lock:  # "busy": the job still has work after its devices (a change set writes its status)
        job["done"] = not job.get("busy") and all(i["state"] in FINAL for i in job["devices"].values())
    snap = snapshot(job["id"])
    if snap:
        _emit({"type": "job", "job": snap})


def _params(d):
    driver = d.get("driver") or "auto"
    if driver not in drivers.ALL:
        raise ValueError(f"unknown driver: {driver}")
    return ssh_bridge.validate({**d, "engine": "paramiko"}), driver


def _on_trust(lab, dev, via):
    """Audit callback for Session.open: a host key confirmed by the user was saved."""
    return lambda host, keytype, fp: audit.record(lab, "hostkey-trusted", dev=dev, host=host, keytype=keytype,
                                                  fingerprint=fp, via=via)


# ---------------------------------------------------------------- collect
def start(lab, body):
    """Start a collect job. body: {devices:[{id, name, host, port, user, auth, keyFile, legacy, driver}],
    password?, trust?: {device id: fingerprint}}. Returns the job snapshot."""
    _check_enabled()
    if not isinstance(body, dict) or not isinstance(body.get("devices"), list):
        raise ValueError("devices must be a list")
    if len(body["devices"]) > MAX_DEVICES:
        raise ValueError(f"at most {MAX_DEVICES} devices per run")
    password = body.get("password") if isinstance(body.get("password"), str) else None
    trust = body.get("trust") if isinstance(body.get("trust"), dict) else {}
    job = new_job(lab, "collect")
    tasks = []
    for d in body["devices"]:
        if not isinstance(d, dict) or not d.get("id"):
            continue
        dev_id = store.safe(str(d["id"]))
        item = {"state": "queued", "name": str(d.get("name") or dev_id)[:80]}
        job["devices"][dev_id] = item
        try:
            p, driver = _params(d)
        except ValueError as exc:
            item.update(state="error", error=str(exc))
            continue
        item["host"] = p["host"]
        tasks.append((dev_id, p, driver, password if p["auth"] == "password" else None, str(trust.get(d["id"]) or "")))
    if not tasks:
        job["done"] = True
    for t in tasks:
        _pool.submit(_collect_one, job, *t)
    password = None  # noqa: F841
    return snapshot(job["id"])


def collect_with(job, dev_id, sess, driver):
    drv = drivers.detect(sess) if driver == "auto" else drivers.get(driver)
    if dev_id in job["devices"]:
        job["devices"][dev_id]["driver"] = drv.NAME
    facts = drv.collect(sess)
    facts["host"] = sess.host
    store.save(job["lab"], dev_id, facts)
    _emit({"type": "facts", "lab": job["lab"], "dev": dev_id, "collected": facts["collected"]})
    return facts


def _audit_collect_end(job):
    """One audit entry per collect run, written by the device that finishes last
    (scheduled collects run every few minutes: one entry per device would flood the log)."""
    with _lock:
        if job.get("audited") or any(d.get("state") in ("queued", "running") for d in job["devices"].values()):
            return
        job["audited"] = True
        devs = {k: {"state": d.get("state"), "host": d.get("host"), **({"error": d["error"][:200]} if d.get("error") else {})}
                for k, d in job["devices"].items()}
    audit.record(job["lab"], "collect", job=job["id"], devices=devs)


def _collect_one(job, dev_id, p, driver, password, trust):
    item = job["devices"][dev_id]
    item["state"] = "running"
    changed(job)
    sess = None
    try:
        sess = Session.open(p, password, trust or None, on_trust=_on_trust(job["lab"], dev_id, "collect"))
        password = None
        facts = collect_with(job, dev_id, sess, driver)
        item.update(state="done", collected=facts["collected"], errors=facts["errors"])
    except HostKeyUnknown as exc:
        item.update(state="hostkey", host=exc.host, keytype=exc.keytype, fingerprint=exc.fingerprint)
    except Exception as exc:  # noqa: BLE001
        item.update(state="error", error=ssh_bridge._err_text(exc))
    finally:
        password = None
        if sess:
            sess.close()
        _audit_collect_end(job)
        changed(job)


# ---------------------------------------------------------------- plans (one device, reviewed now)
def resolve_driver(lab, dev_id, driver):
    """The driver of a device: as given, or the one that read it last. Returns (driver name, facts)."""
    doc = store.read(store.safe(lab), dev_id) or {}
    facts = doc.get("facts")
    if driver == "auto":
        driver = (facts or {}).get("driver") or ""
        if not driver:
            raise ValueError("collect the device first, so LabTracer knows its platform")
    return driver, facts


def render_for(lab, d, raw_ops):
    """Render the operations for device params d. Returns a dict for a plan or a change set item."""
    dev_id = store.safe(str(d["id"]))
    driver = d.get("driver") or "auto"
    if driver not in drivers.ALL:
        raise ValueError(f"unknown driver: {driver}")
    try:  # needed only to apply; "Send to console" works without paramiko
        p, why = ssh_bridge.validate({**d, "engine": "paramiko"}), ""
    except ValueError as exc:
        p, why = None, str(exc)
    driver, facts = resolve_driver(lab, dev_id, driver)
    drv = drivers.get(driver)
    if not hasattr(drv, "render"):
        raise ValueError(f"the {driver} driver can not render changes yet")
    clean = ops.validate(raw_ops)
    commands, notes, extra = drivers.render(drv, clean, facts)
    can = bool(hasattr(drv, "apply") and p is not None and extra.get("canApply"))
    if hasattr(drv, "apply") and p is None:
        notes = [f"Apply is not available: {why}", *notes]
    return {"dev": dev_id, "name": str(d.get("name") or dev_id)[:80], "params": p, "driver": driver, "ops": clean,
            "commands": commands, "notes": notes, "extra": extra, "canApply": can, "safety": drivers.safety(drv)}


def _public(item):
    """What the browser sees of a rendered item (no SSH params, files with old and new text)."""
    ex = item.get("extra") or {}
    return {"dev": item["dev"], "name": item["name"], "driver": item["driver"], "commands": item["commands"], "notes": item["notes"],
            "files": [{"path": f["path"], "old": f["old"], "content": f["content"]} for f in ex.get("files") or []],
            "canApply": item["canApply"], "safety": item["safety"], "ops": item.get("ops"), "labels": item.get("labels")}


changes.render_for = render_for


def plan(lab, body):
    """Render the commands for a list of operations. body: {device: {id, name, host, ...}, ops: [...]}.
    The driver is the one that read the device last (stored facts) unless body.device.driver names one."""
    _check_enabled()
    if not isinstance(body, dict) or not isinstance(body.get("device"), dict) or not body["device"].get("id"):
        raise ValueError("device missing")
    item = render_for(lab, body["device"], body.get("ops"))
    plan_id = secrets.token_urlsafe(16)
    with _lock:
        _plans[plan_id] = {**item, "lab": store.safe(lab), "created": time.time()}
    return {"planId": plan_id, **_public(item)}


def _opts(body):
    try:
        minutes = int(body.get("rollback") or 0)
    except (TypeError, ValueError):
        minutes = 0
    return {"save": bool(body.get("save")), "rollback": max(0, min(ROLLBACK_MAX, minutes)),
            "onError": "stop" if body.get("onError") == "stop" else "restore"}


def apply(body):
    """Run a plan from plan(). body: {planId, save?, rollback?: minutes, onError?, password?, trust?}."""
    _check_enabled()
    if not isinstance(body, dict):
        raise ValueError("bad request")
    with _lock:
        pl = _plans.pop(str(body.get("planId") or ""), None)
    if not pl or time.time() - pl["created"] > PLAN_TTL:
        raise ValueError("this plan expired or was used. Review the commands again.")
    drv = drivers.get(pl["driver"])
    if not hasattr(drv, "apply") or not pl["canApply"]:
        raise ValueError(f"the {pl['driver']} driver can not apply these changes: send them to the console")
    p = pl["params"]
    password = body.get("password") if isinstance(body.get("password"), str) and p["auth"] == "password" else None
    job = new_job(pl["lab"], "apply")
    job["devices"][pl["dev"]] = {"state": "queued", "name": pl["name"], "host": p["host"], "driver": pl["driver"]}
    opts = _opts(body)

    def run(pw):  # the password is an argument: a closure would see the None set below
        push(job, pl, pw, str(body.get("trust") or ""), opts)
        changed(job)
    _pool.submit(run, password)
    password = None  # noqa: F841
    return snapshot(job["id"])


# ---------------------------------------------------------------- the push itself
def push(job, it, password, trust, opts, change_id=None):
    """Apply one rendered item (plan or change set item) to its device. Updates job["devices"][dev].
    Returns True when the change is on the device and confirmed."""
    lab, dev = job["lab"], it["dev"]
    item = job["devices"][dev]
    item.update(state="running", phase="connect")
    changed(job)
    drv = drivers.get(it["driver"])
    facts = (store.read(lab, dev) or {}).get("facts")
    log = []
    ctx = {"dev": dev, "name": it["name"], "host": it["params"]["host"], "driver": it["driver"], "change": change_id}
    sess = None

    def step(title, text):
        log.append(f"===== {title}")
        if text:
            log.append(text.rstrip())
        item["transcript"] = "\n".join(log)

    def phase(name):
        item["phase"] = name
        changed(job)

    try:
        sess = Session.open(it["params"], password, trust or None, on_trust=_on_trust(lab, dev, "push"))
        backup_doc = None
        if hasattr(drv, "backup"):
            phase("backup")
            bid = backups.new_id()
            doc = drivers.call(drv.backup, sess, bid, facts=facts)
            backup_doc = {"id": bid, "ts": time.time(), "name": it["name"], "host": ctx["host"], "driver": it["driver"],
                          "change": change_id, **doc}
            backups.save(lab, dev, backup_doc)
            item["backup"] = bid
            step("backup", f"# config kept by LabTracer as backup {bid}" + (f"; copy on the device: {doc['onDevice']}" if doc.get("onDevice") else "; no copy on the device"))
            audit.record(lab, "backup", **ctx, backup=bid, onDevice=doc.get("onDevice") or "")
        token = None
        if opts["rollback"] and hasattr(drv, "arm") and backup_doc:
            phase("arm")
            token, text = drivers.call(drv.arm, sess, backup_doc, opts["rollback"], extra=it.get("extra"), facts=facts)
            step("rollback timer", text)
            audit.record(lab, "rollback-armed" if token else "rollback-unavailable", **ctx, minutes=opts["rollback"], transcript=text)
        phase("apply")
        ok, text = drivers.call(drv.apply, sess, it["commands"], save=opts["save"] and not token and not hasattr(drv, "persist"),
                                armed=token, extra=it.get("extra"), facts=facts)
        step("apply", text)
        item["applied"] = ok
        audit.record(lab, "apply", **ctx, ok=ok, commands=it["commands"], files=[f["path"] for f in (it.get("extra") or {}).get("files") or []],
                     transcript=text, backup=item.get("backup"))
        sess.close()
        sess = None
        phase("verify")
        try:
            sess = Session.open(it["params"], password, None)
        except Exception as exc:  # noqa: BLE001
            why = ssh_bridge._err_text(exc)
            if token:
                item.update(state="pending", rollbackPending=True,
                            error=f"LabTracer can not reach the device after the change ({why}). It rolls back by itself within {opts['rollback']} min.")
            else:
                item.update(state="error", error=f"LabTracer can not reach the device after the change ({why}). Reach it another way; backup {item.get('backup') or '(none)'} has the old config.")
            step("verify", "! " + item["error"])
            audit.record(lab, "unreachable", **ctx, rollbackPending=bool(token), error=why)
            return False
        step("verify", "# reached the device again")
        if not ok and opts["onError"] == "restore" and backup_doc and hasattr(drv, "restore"):
            phase("restore")
            r_ok, text = drivers.call(drv.restore, sess, backup_doc, facts=facts)
            step("restore (the change failed)", text)
            item["rolledBack"] = r_ok
            audit.record(lab, "rollback", **ctx, ok=r_ok, reason="a command failed", backup=backup_doc["id"], transcript=text)
            if token and r_ok:
                c_ok, text = drivers.call(drv.confirm, sess, token, facts=facts)
                step("stop the rollback timer (restored already)", text)
        elif token:
            phase("confirm")
            if ok:
                c_ok, text = drivers.call(drv.confirm, sess, token, facts=facts)
                step("confirm", text)
                audit.record(lab, "confirm", **ctx, ok=c_ok, transcript=text)
                if not c_ok:
                    ok = False
                    item["rollbackPending"] = True
                    item["error"] = f"The rollback timer could not be stopped: the device rolls back within {opts['rollback']} min."
            else:
                item["rollbackPending"] = True
                step("confirm", f"# not confirmed: the change failed, the device rolls back within {opts['rollback']} min")
        if ok and opts["save"] and hasattr(drv, "persist"):
            phase("save")
            s_ok, text = drivers.call(drv.persist, sess, facts=facts)
            step("save", text)
            audit.record(lab, "save", **ctx, ok=s_ok, transcript=text)
            ok = ok and s_ok
        phase("collect")
        try:
            facts2 = collect_with(job, dev, sess, it["driver"])
            item["collected"] = facts2["collected"]
        except Exception as exc:  # noqa: BLE001
            step("collect", "! " + ssh_bridge._err_text(exc))
        if ok:
            item.update(state="done", error="")
        else:
            item.update(state="error", error=item.get("error") or (
                "the change failed and was rolled back" if item.get("rolledBack") else "the device refused a command: see the transcript"))
        return ok
    except HostKeyUnknown as exc:
        item.update(state="hostkey", host=exc.host, keytype=exc.keytype, fingerprint=exc.fingerprint)
        return False
    except Exception as exc:  # noqa: BLE001
        item.update(state="error", error=ssh_bridge._err_text(exc))
        step("error", "! " + item["error"])
        audit.record(lab, "error", **ctx, error=item["error"])
        return False
    finally:
        password = None
        item.pop("phase", None)
        if sess:
            sess.close()


# ---------------------------------------------------------------- change sets (many devices, staged)
def change_apply(lab, change_id, body):
    """Apply a staged change set. body: {digest, save?, rollback?, onError?, stopOnError?, password?, trust?: {dev: fp}}.
    The digest must match: the user applies exactly what they reviewed."""
    _check_enabled()
    if not isinstance(body, dict):
        raise ValueError("bad request")
    doc = changes.begin_apply(lab, change_id, str(body.get("digest") or ""))
    password = body.get("password") if isinstance(body.get("password"), str) else None
    trust = body.get("trust") if isinstance(body.get("trust"), dict) else {}
    opts = _opts(body)
    stop = body.get("stopOnError", True) is not False
    job = new_job(lab, "change")
    job["change"] = doc["id"]
    job["busy"] = True
    for it in doc["items"]:
        job["devices"][it["dev"]] = {"state": "queued", "name": it["name"], "host": (it.get("params") or {}).get("host", ""), "driver": it["driver"]}
    audit.record(lab, "change-apply", change=doc["id"], title=doc["title"], devices=[it["dev"] for it in doc["items"]],
                 digest=doc["digest"], options=opts)

    def run(password):  # an argument, not the closure: the caller drops its reference below
        results, failed = {}, False
        for it in doc["items"]:
            item = job["devices"][it["dev"]]
            if failed and stop:
                item.update(state="skipped", error="not applied: an earlier device failed")
            elif not it.get("canApply"):
                item.update(state="skipped", error="this item can not be applied automatically: send it to the console")
            else:
                pw = password if it["params"]["auth"] == "password" else None
                ok = push(job, it, pw, str(trust.get(it["dev"]) or ""), opts, change_id=doc["id"])
                failed = failed or not ok
            results[it["dev"]] = {k: item.get(k) for k in ("state", "error", "backup", "applied", "rolledBack", "rollbackPending", "transcript")}
            changed(job)
        try:
            status = changes.finish_apply(lab, doc["id"], results)
            audit.record(lab, "change-finished", change=doc["id"], status=status,
                         results={k: v.get("state") for k, v in results.items()})
        finally:
            job["busy"] = False
            changed(job)
    _pool.submit(run, password)
    password = None  # noqa: F841
    return snapshot(job["id"])


# ---------------------------------------------------------------- restore a backup by hand
def restore(lab, body):
    """body: {device: params, backup: id, password?, trust?}. Puts the backup back, then collects again."""
    _check_enabled()
    if not isinstance(body, dict) or not isinstance(body.get("device"), dict) or not body["device"].get("id"):
        raise ValueError("device missing")
    d = body["device"]
    dev = store.safe(str(d["id"]))
    doc = backups.read(lab, dev, body.get("backup"))
    if not doc:
        raise ValueError("no such backup")
    drv = drivers.get(doc["driver"])
    if not hasattr(drv, "restore"):
        raise ValueError(f"the {doc['driver']} driver can not restore a backup: open it and paste what you need in the console")
    p = ssh_bridge.validate({**d, "engine": "paramiko"})
    if doc.get("host") and p["host"].lower() != str(doc["host"]).lower():
        audit.record(lab, "restore-refused", dev=dev, backup=doc["id"], host=p["host"], backupHost=doc["host"],
                     reason="the target is not the host the backup was taken from")
        raise ValueError(f"backup {doc['id']} was taken from {doc['host']}, not {p['host']}. "
                         "A backup is only restored to the host it came from.")
    password = body.get("password") if isinstance(body.get("password"), str) and p["auth"] == "password" else None
    job = new_job(lab, "restore")
    job["devices"][dev] = {"state": "queued", "name": str(d.get("name") or dev)[:80], "host": p["host"], "driver": doc["driver"]}
    trust = str(body.get("trust") or "")

    def run():
        item = job["devices"][dev]
        item["state"] = "running"
        changed(job)
        sess = None
        ctx = {"dev": dev, "name": item["name"], "host": p["host"], "driver": doc["driver"], "backup": doc["id"]}
        try:
            sess = Session.open(p, password, trust or None, on_trust=_on_trust(lab, dev, "restore"))
            facts = (store.read(lab, dev) or {}).get("facts")
            ok, text = drivers.call(drv.restore, sess, doc, facts=facts)
            item.update(transcript=text, applied=ok)
            audit.record(lab, "restore", **ctx, ok=ok, transcript=text)
            try:
                if doc["driver"] != "routeros":  # RouterOS reboots to load a backup
                    collect_with(job, dev, sess, doc["driver"])
            except Exception:  # noqa: BLE001
                pass
            item.update(state="done" if ok else "error", error="" if ok else "the restore did not finish: see the transcript")
        except HostKeyUnknown as exc:
            item.update(state="hostkey", host=exc.host, keytype=exc.keytype, fingerprint=exc.fingerprint)
        except Exception as exc:  # noqa: BLE001
            item.update(state="error", error=ssh_bridge._err_text(exc))
            audit.record(lab, "error", **ctx, error=item["error"])
        finally:
            if sess:
                sess.close()
            changed(job)
    _pool.submit(run)
    return snapshot(job["id"])


def snapshot(job_id):
    with _lock:
        j = _jobs.get(job_id)
        if not j:
            return None
        out = {"id": j["id"], "kind": j["kind"], "lab": j["lab"], "done": j["done"],
               "devices": {k: dict(v) for k, v in j["devices"].items()}}
        for k in ("change", "discovery"):
            if k in j:
                out[k] = j[k]
        return out


def get_job(job_id):
    with _lock:
        return _jobs.get(job_id)
