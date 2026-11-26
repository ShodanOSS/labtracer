"""Collector: read the actual state of devices over SSH for the drift report, and push
reviewed changes back (remediation).

    GUI --POST /api/collect/<lab>--> server.py --> job (thread pool) --SSH--> devices
        <--GET /api/collect/jobs/<id>  or /api/events (job and facts events)
                                                    --> data/observed/<lab>/<dev>.json
    GUI --POST /api/remediate/<lab>/plan  {device, ops}  --> {planId, commands}
        --POST /api/remediate/apply       {planId, save} --> job: apply, then collect again

Runs in server.py on the PC, not in the check agent: the agent promises that it never
logs in to devices. Same rules as the SSH console: off on a non-loopback bind, passwords
are used for one run and never stored, unknown host keys need the user's confirmation
(state 'hostkey' with the fingerprint; run again with trust).

Remediation never takes command text from the browser: it takes operations (ops.py),
the driver renders the commands, the user reviews exactly those, and apply runs only a
plan id. A plan is used once and expires after PLAN_TTL seconds.
"""

import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import ssh_bridge

from . import drivers, ops, store
from .conn import HostKeyUnknown, Session

MAX_WORKERS = 4
MAX_DEVICES = 300
JOB_TTL = 3600
PLAN_TTL = 600
FINAL = ("done", "error", "hostkey")

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
            "apply": [n for n, m in drivers.REGISTRY.items() if hasattr(m, "apply")]}


def _check_enabled():
    if not ssh_bridge.ENABLED:
        raise PermissionError("collection is off because server.py listens on a network address")


def _new_job(lab, kind):
    job = {"id": secrets.token_urlsafe(12), "kind": kind, "lab": store.safe(lab), "created": time.time(), "done": False, "devices": {}}
    with _lock:
        now = time.time()
        for k in [k for k, j in _jobs.items() if now - j["created"] > JOB_TTL]:
            del _jobs[k]
        for k in [k for k, p in _plans.items() if now - p["created"] > PLAN_TTL]:
            del _plans[k]
        _jobs[job["id"]] = job
    return job


def _changed(job):
    with _lock:
        job["done"] = all(i["state"] in FINAL for i in job["devices"].values())
    snap = snapshot(job["id"])
    if snap:
        _emit({"type": "job", "job": snap})


def _params(d):
    driver = d.get("driver") or "auto"
    if driver not in drivers.ALL:
        raise ValueError(f"unknown driver: {driver}")
    return ssh_bridge.validate({**d, "engine": "paramiko"}), driver


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
    job = _new_job(lab, "collect")
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


def _collect(job, dev_id, sess, driver):
    drv = drivers.detect(sess) if driver == "auto" else drivers.get(driver)
    job["devices"][dev_id]["driver"] = drv.NAME
    facts = drv.collect(sess)
    facts["host"] = sess.host
    store.save(job["lab"], dev_id, facts)
    _emit({"type": "facts", "lab": job["lab"], "dev": dev_id, "collected": facts["collected"]})
    return facts


def _collect_one(job, dev_id, p, driver, password, trust):
    item = job["devices"][dev_id]
    item["state"] = "running"
    _changed(job)
    sess = None
    try:
        sess = Session.open(p, password, trust or None)
        password = None
        facts = _collect(job, dev_id, sess, driver)
        item.update(state="done", collected=facts["collected"], errors=facts["errors"])
    except HostKeyUnknown as exc:
        item.update(state="hostkey", host=exc.host, keytype=exc.keytype, fingerprint=exc.fingerprint)
    except Exception as exc:  # noqa: BLE001
        item.update(state="error", error=ssh_bridge._err_text(exc))
    finally:
        password = None
        if sess:
            sess.close()
        _changed(job)


# ---------------------------------------------------------------- remediation
def plan(lab, body):
    """Render the commands for a list of operations. body: {device: {id, name, host, ...}, ops: [...]}.
    The driver is the one that read the device last (stored facts) unless body.device.driver names one."""
    _check_enabled()
    if not isinstance(body, dict) or not isinstance(body.get("device"), dict) or not body["device"].get("id"):
        raise ValueError("device missing")
    d = body["device"]
    dev_id = store.safe(str(d["id"]))
    driver = d.get("driver") or "auto"
    if driver not in drivers.ALL:
        raise ValueError(f"unknown driver: {driver}")
    try:  # needed only to apply; "Send to console" works without paramiko
        p, why = ssh_bridge.validate({**d, "engine": "paramiko"}), ""
    except ValueError as exc:
        p, why = None, str(exc)
    if driver == "auto":
        doc = store.read(store.safe(lab), dev_id)
        driver = (doc or {}).get("facts", {}).get("driver") or ""
        if not driver:
            raise ValueError("collect the device first, so LabTracer knows its platform")
    drv = drivers.get(driver)
    if not hasattr(drv, "render"):
        raise ValueError(f"the {driver} driver can not render changes yet")
    clean = ops.validate(body.get("ops"))
    commands, notes = drv.render(clean)
    plan_id = secrets.token_urlsafe(16)
    with _lock:
        _plans[plan_id] = {"lab": store.safe(lab), "dev": dev_id, "name": str(d.get("name") or dev_id)[:80],
                           "params": p, "driver": driver, "commands": commands, "created": time.time()}
    if hasattr(drv, "apply") and p is None:
        notes = [f"Apply is not available: {why}", *notes]
    return {"planId": plan_id, "driver": driver, "commands": commands, "notes": notes, "canApply": hasattr(drv, "apply") and p is not None}


def apply(body):
    """Run a plan from plan(). body: {planId, save?, password?, trust?}. Returns the job snapshot."""
    _check_enabled()
    if not isinstance(body, dict):
        raise ValueError("bad request")
    with _lock:
        pl = _plans.pop(str(body.get("planId") or ""), None)
    if not pl or time.time() - pl["created"] > PLAN_TTL:
        raise ValueError("this plan expired or was used. Review the commands again.")
    drv = drivers.get(pl["driver"])
    if not hasattr(drv, "apply"):
        raise ValueError(f"the {pl['driver']} driver can not apply changes: send them to the console")
    p = pl["params"]
    if p is None:
        raise ValueError("this device can not be reached for apply (check paramiko and the SSH settings)")
    password = body.get("password") if isinstance(body.get("password"), str) and p["auth"] == "password" else None
    job = _new_job(pl["lab"], "apply")
    job["devices"][pl["dev"]] = {"state": "queued", "name": pl["name"], "host": p["host"], "driver": pl["driver"]}
    _pool.submit(_apply_one, job, pl, password, str(body.get("trust") or ""), bool(body.get("save")))
    password = None  # noqa: F841
    return snapshot(job["id"])


def _apply_one(job, pl, password, trust, save):
    item = job["devices"][pl["dev"]]
    item["state"] = "running"
    _changed(job)
    sess = None
    try:
        sess = Session.open(pl["params"], password, trust or None)
        drv = drivers.get(pl["driver"])
        ok, transcript = drv.apply(sess, pl["commands"], save)
        item.update(applied=ok, transcript=transcript)
        _changed(job)
        sess.close()
        # read the device again on a new connection: the drift report shows the result
        sess = Session.open(pl["params"], password, None)
        password = None
        facts = _collect(job, pl["dev"], sess, pl["driver"])
        item.update(state="done" if ok else "error", collected=facts["collected"],
                    error="" if ok else "the device refused a command: see the transcript")
    except HostKeyUnknown as exc:
        item.update(state="hostkey", host=exc.host, keytype=exc.keytype, fingerprint=exc.fingerprint)
    except Exception as exc:  # noqa: BLE001
        item.update(state="error", error=ssh_bridge._err_text(exc))
    finally:
        password = None
        if sess:
            sess.close()
        _changed(job)


def snapshot(job_id):
    with _lock:
        j = _jobs.get(job_id)
        if not j:
            return None
        return {"id": j["id"], "kind": j["kind"], "lab": j["lab"], "done": j["done"],
                "devices": {k: dict(v) for k, v in j["devices"].items()}}
