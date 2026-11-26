"""Collector: read the actual state of devices over SSH (read-only) for the drift report.

    GUI --POST /api/collect/<lab>--> server.py --> job (thread pool) --SSH--> devices
        <--GET /api/collect/jobs/<id>--          --> data/observed/<lab>/<dev>.json

Runs in server.py on the PC, not in the check agent: the agent promises that it
never logs in to devices. Same rules as the SSH console: off on a non-loopback
bind, passwords are used for one run and never stored, unknown host keys need the
user's confirmation (state 'hostkey' with the fingerprint; run again with trust).
"""

import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import ssh_bridge

from . import drivers, store
from .conn import HostKeyUnknown, Session

MAX_WORKERS = 4
MAX_DEVICES = 300
JOB_TTL = 3600
FINAL = ("done", "error", "hostkey")

_jobs = {}
_lock = threading.Lock()
_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="collect")


def caps():
    ssh_bridge.load_paramiko()
    return {"enabled": ssh_bridge.ENABLED, "paramiko": ssh_bridge.paramiko is not None,
            "drivers": list(drivers.ALL), "supported": ["auto", *drivers.REGISTRY]}


def start(lab, body):
    """Start a job. body: {devices:[{id, name, host, port, user, auth, keyFile, legacy, driver}],
    password?, trust?: {device id: fingerprint}}. Returns the job snapshot."""
    if not ssh_bridge.ENABLED:
        raise PermissionError("collection is off because server.py listens on a network address")
    if not isinstance(body, dict) or not isinstance(body.get("devices"), list):
        raise ValueError("devices must be a list")
    if len(body["devices"]) > MAX_DEVICES:
        raise ValueError(f"at most {MAX_DEVICES} devices per run")
    password = body.get("password") if isinstance(body.get("password"), str) else None
    trust = body.get("trust") if isinstance(body.get("trust"), dict) else {}
    job = {"id": secrets.token_urlsafe(12), "lab": store.safe(lab), "created": time.time(), "done": False, "devices": {}}
    tasks = []
    for d in body["devices"]:
        if not isinstance(d, dict) or not d.get("id"):
            continue
        dev_id = store.safe(str(d["id"]))
        item = {"state": "queued", "name": str(d.get("name") or dev_id)[:80]}
        job["devices"][dev_id] = item
        driver = d.get("driver") or "auto"
        try:
            if driver not in drivers.ALL:
                raise ValueError(f"unknown driver: {driver}")
            p = ssh_bridge.validate({**d, "engine": "paramiko"})
        except ValueError as exc:
            item.update(state="error", error=str(exc))
            continue
        item["host"] = p["host"]
        tasks.append((dev_id, p, driver, password if p["auth"] == "password" else None, str(trust.get(d["id"]) or "")))
    with _lock:
        now = time.time()
        for k in [k for k, j in _jobs.items() if now - j["created"] > JOB_TTL]:
            del _jobs[k]
        _jobs[job["id"]] = job
    if not tasks:
        job["done"] = True
    for t in tasks:
        _pool.submit(_run_one, job, *t)
    password = None  # noqa: F841
    return snapshot(job["id"])


def _run_one(job, dev_id, p, driver, password, trust):
    item = job["devices"][dev_id]
    item["state"] = "running"
    sess = None
    try:
        sess = Session.open(p, password, trust or None)
        password = None
        drv = drivers.detect(sess) if driver == "auto" else drivers.get(driver)
        item["driver"] = drv.NAME
        facts = drv.collect(sess)
        facts["host"] = p["host"]
        store.save(job["lab"], dev_id, facts)
        item.update(state="done", collected=facts["collected"], errors=facts["errors"])
    except HostKeyUnknown as exc:
        item.update(state="hostkey", host=exc.host, keytype=exc.keytype, fingerprint=exc.fingerprint)
    except Exception as exc:  # noqa: BLE001
        item.update(state="error", error=ssh_bridge._err_text(exc))
    finally:
        password = None
        if sess:
            sess.close()
        with _lock:
            job["done"] = all(i["state"] in FINAL for i in job["devices"].values())


def snapshot(job_id):
    with _lock:
        j = _jobs.get(job_id)
        if not j:
            return None
        return {"id": j["id"], "lab": j["lab"], "done": j["done"], "devices": {k: dict(v) for k, v in j["devices"].items()}}
