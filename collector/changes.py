"""Staged change sets: data/changes/<lab>/<id>.json.

A change set collects pushes for many devices before anything runs. Each item is one
device with its operations, and the commands its driver rendered from them. The set is
applied as a whole, device after device in the listed order, only with the digest of the
version the user reviewed: a change to the set after the review needs a new review.

Status: draft -> applying -> applied | failed | partial;  draft -> discarded.
Applied and discarded sets stay as a record (with each device's result and backup id).
"""

import getpass
import hashlib
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path

from . import audit, store

CHANGE_DIR = Path(__file__).resolve().parent.parent / "data" / "changes"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,32}$")
MAX_ITEMS = 100
KEEP = 200
_lock = threading.Lock()
render_for = None  # set by collector/__init__.py (avoids an import cycle)


def _user():
    try:
        return getpass.getuser()
    except Exception:  # noqa: BLE001
        return ""


def _path(lab, cid):
    if not ID_RE.match(str(cid or "")):
        raise ValueError("bad change id")
    return CHANGE_DIR / store.safe(lab) / f"{cid}.json"


def _write(lab, doc):
    p = _path(lab, doc["id"])
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, indent=1), "utf-8")
    os.replace(tmp, p)


def _read(lab, cid):
    try:
        return json.loads(_path(lab, cid).read_text("utf-8"))
    except (OSError, ValueError):
        return None


def digest(doc):
    body = [(it["dev"], it["driver"], it["commands"], [(f["path"], f["content"]) for f in (it.get("extra") or {}).get("files") or []])
            for it in doc.get("items") or []]
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode("utf-8")).hexdigest()[:32]


def public(doc):
    from . import _public  # noqa: PLC0415
    out = {k: doc.get(k) for k in ("id", "title", "note", "status", "created", "user", "updated", "applied", "digest", "results")}
    out["items"] = [_public(it) for it in doc.get("items") or []]
    return out


def summary(doc):
    out = {k: doc.get(k) for k in ("id", "title", "status", "created", "user", "updated", "applied")}
    out["devices"] = [it["name"] for it in doc.get("items") or []]
    return out


def list_for(lab):
    folder = CHANGE_DIR / store.safe(lab)
    out = []
    for p in folder.glob("*.json") if folder.is_dir() else []:
        try:
            out.append(summary(json.loads(p.read_text("utf-8"))))
        except (OSError, ValueError):
            continue
    out.sort(key=lambda d: d.get("created") or 0, reverse=True)
    return out


def _prune(lab):
    folder = CHANGE_DIR / store.safe(lab)
    done = [d for d in list_for(lab) if d["status"] not in ("draft", "applying")]
    for d in done[KEEP:]:
        (folder / f"{d['id']}.json").unlink(missing_ok=True)


def create(lab, body):
    body = body if isinstance(body, dict) else {}
    doc = {"id": secrets.token_urlsafe(12), "title": str(body.get("title") or "Change")[:120], "note": str(body.get("note") or "")[:4000],
           "status": "draft", "created": time.time(), "updated": time.time(), "user": _user(), "items": [], "digest": ""}
    doc["digest"] = digest(doc)
    with _lock:
        _write(lab, doc)
        _prune(lab)
    audit.record(lab, "change-created", change=doc["id"], title=doc["title"])
    return public(doc)


def get(lab, cid):
    doc = _read(lab, cid)
    if not doc:
        raise ValueError("no such change set")
    return doc


def _draft(lab, cid):
    doc = get(lab, cid)
    if doc["status"] != "draft":
        raise ValueError(f"this change set is {doc['status']}: it can not be changed. Start a new one.")
    return doc


def add(lab, cid, body):
    """body: {items: [{device: params, ops: [...], labels: [...]}]}. Ops for a device already in the
    set are added to its item, and its commands are rendered again."""
    if not isinstance(body, dict) or not isinstance(body.get("items"), list) or not body["items"]:
        raise ValueError("items must be a list")
    with _lock:
        doc = _draft(lab, cid)
        for x in body["items"]:
            if not isinstance(x, dict) or not isinstance(x.get("device"), dict) or not x["device"].get("id"):
                raise ValueError("each item needs a device")
            dev = store.safe(str(x["device"]["id"]))
            cur = next((it for it in doc["items"] if it["dev"] == dev), None)
            new_ops = x.get("ops") if isinstance(x.get("ops"), list) else []
            labels = [str(s)[:200] for s in (x.get("labels") or []) if isinstance(s, (str, int, float))][:200]
            all_ops = (cur["ops"] if cur else []) + [o for o in new_ops if not cur or o not in cur["ops"]]
            item = render_for(lab, x["device"], all_ops)
            item["labels"] = ((cur or {}).get("labels") or []) + [s for s in labels if s not in ((cur or {}).get("labels") or [])]
            if cur:
                doc["items"][doc["items"].index(cur)] = item
            else:
                if len(doc["items"]) >= MAX_ITEMS:
                    raise ValueError(f"at most {MAX_ITEMS} devices in one change set")
                doc["items"].append(item)
        doc["updated"] = time.time()
        doc["digest"] = digest(doc)
        _write(lab, doc)
    audit.record(lab, "change-staged", change=cid, devices=[store.safe(str(x["device"]["id"])) for x in body["items"]],
                 ops=[x.get("ops") for x in body["items"]], digest=doc["digest"])
    return public(doc)


def edit(lab, cid, body):
    """body: {title?, note?, remove?: dev, move?: dev, by?: -1|1, dropOp?: [dev, index]}."""
    body = body if isinstance(body, dict) else {}
    with _lock:
        doc = _draft(lab, cid)
        what = []
        if "title" in body:
            doc["title"] = str(body["title"] or "Change")[:120]
            what.append("title")
        if "note" in body:
            doc["note"] = str(body["note"] or "")[:4000]
            what.append("note")
        if body.get("remove"):
            doc["items"] = [it for it in doc["items"] if it["dev"] != body["remove"]]
            what.append(f"removed {body['remove']}")
        if body.get("move"):
            idx = next((i for i, it in enumerate(doc["items"]) if it["dev"] == body["move"]), None)
            to = None if idx is None else idx + (1 if body.get("by") == 1 else -1)
            if to is not None and 0 <= to < len(doc["items"]):
                doc["items"][idx], doc["items"][to] = doc["items"][to], doc["items"][idx]
                what.append(f"moved {body['move']}")
        if isinstance(body.get("dropOp"), list) and len(body["dropOp"]) == 2:
            dev, i = body["dropOp"]
            it = next((x for x in doc["items"] if x["dev"] == dev), None)
            if it and isinstance(i, int) and 0 <= i < len(it["ops"]):
                rest = it["ops"][:i] + it["ops"][i + 1:]
                if rest:
                    new = render_for(lab, {"id": dev, "name": it["name"], **{k: v for k, v in (it.get("params") or {}).items() if k != "engine"},
                                           "driver": it["driver"]}, rest)
                    new["labels"] = [s for k, s in enumerate(it.get("labels") or []) if k != i]
                    doc["items"][doc["items"].index(it)] = new
                else:
                    doc["items"].remove(it)
                what.append(f"dropped an operation on {dev}")
        doc["updated"] = time.time()
        doc["digest"] = digest(doc)
        _write(lab, doc)
    if what:
        audit.record(lab, "change-edited", change=cid, what=what, digest=doc["digest"])
    return public(doc)


def discard(lab, cid):
    with _lock:
        doc = _draft(lab, cid)
        doc["status"] = "discarded"
        doc["updated"] = time.time()
        _write(lab, doc)
    audit.record(lab, "change-discarded", change=cid, title=doc["title"])
    return public(doc)


def begin_apply(lab, cid, reviewed):
    with _lock:
        doc = _draft(lab, cid)
        if not doc["items"]:
            raise ValueError("this change set is empty")
        if reviewed != doc["digest"]:
            raise ValueError("the change set changed since you reviewed it (another window?). Review it again.")
        doc["status"] = "applying"
        doc["updated"] = time.time()
        _write(lab, doc)
    return doc


def finish_apply(lab, cid, results):
    with _lock:
        doc = get(lab, cid)
        states = [r.get("state") for r in results.values()]
        ok = sum(1 for s in states if s == "done")
        doc["status"] = "applied" if ok == len(states) else ("failed" if ok == 0 else "partial")
        doc["results"] = results
        doc["applied"] = time.time()
        doc["updated"] = time.time()
        _write(lab, doc)
    return doc["status"]
