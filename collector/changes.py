# SPDX-License-Identifier: Apache-2.0
"""Staged change sets: data/changes/<lab>/<id>.json.

A change set collects pushes for many devices before anything runs. Each item is one
device with its operations, and the commands its driver rendered from them. The set is
applied as a whole, device after device in the listed order, only with the digest of the
version the user reviewed: a change to the set after the review needs a new review.

Status: draft -> applying -> applied | failed | partial;  draft -> discarded.
A set found "applying" when no apply runs in this process (the server stopped during the
apply) becomes "interrupted": what reached the devices is in the audit log and the backups.
Applied, discarded and interrupted sets stay as a record (with each device's result and backup id).

Each item keeps its operations in groups: one group per staged drift item, with the label the
user reviews ({label, ops}). One drift item can need several operations (a route change is a
delete and an add), so removing a change removes its whole group, never a single operation.
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

from . import audit, ops as opsmod, store

CHANGE_DIR = Path(__file__).resolve().parent.parent / "data" / "changes"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,32}$")
MAX_ITEMS = 100
KEEP = 200
_lock = threading.RLock()  # re-entrant: list_for() can mark an interrupted set while _prune() holds it
_active = set()  # ids of the change sets an apply is running for in this process
TARGET = ("host", "port", "user", "auth", "keyFile", "legacy")  # the connection a digest covers
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
    """What the user reviews and apply checks: per device, where it connects, the driver, the
    commands and the files. The target is included, so a re-staged item with another host or
    user needs a new review even when its commands did not change."""
    body = [(it["dev"], [(it.get("params") or {}).get(k) for k in TARGET], it["driver"], it["commands"],
             [(f["path"], f["content"]) for f in (it.get("extra") or {}).get("files") or []])
            for it in doc.get("items") or []]
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode("utf-8")).hexdigest()[:32]


def _label(v, ops):
    text = str(v or "").strip()[:200]
    return text or ", ".join(o["op"] for o in ops)


def item_groups(it):
    """The {label, ops} groups of a stored item. Items staged before groups existed have
    ops and labels: one label per operation pairs up; otherwise all operations are one group
    (removing it removes them all, never a part of a change)."""
    if isinstance(it.get("groups"), list):
        return it["groups"]
    o, labels = it.get("ops") or [], [str(x) for x in it.get("labels") or []]
    if o and len(labels) == len(o):
        return [{"label": lb, "ops": [x]} for lb, x in zip(labels, o)]
    return [{"label": " + ".join(labels) or _label("", o), "ops": list(o)}] if o else []


def _incoming(x):
    """Groups sent by the browser: {groups: [{label, ops}]}. A page from before groups sends
    {ops, labels}: paired one to one when the counts match, else one group."""
    if isinstance(x.get("groups"), list):
        out = []
        for g in x["groups"]:
            if not isinstance(g, dict):
                raise ValueError("bad change group")
            clean = opsmod.validate(g.get("ops"))
            out.append({"label": _label(g.get("label"), clean), "ops": clean})
        if not out:
            raise ValueError("no operations")
        return out
    clean = opsmod.validate(x.get("ops") if isinstance(x.get("ops"), list) else [])
    labels = [str(s)[:200] for s in (x.get("labels") or []) if isinstance(s, (str, int, float))][:200]
    if len(labels) == len(clean):
        return [{"label": _label(lb, [o]), "ops": [o]} for lb, o in zip(labels, clean)]
    return [{"label": _label(" + ".join(labels), clean), "ops": clean}]


def _flat(groups):
    """The operations of all groups in order, each once (two drift items can need the same one)."""
    out = []
    for g in groups:
        for o in g["ops"]:
            if o not in out:
                out.append(o)
    return out


def _rendered(lab, device, groups):
    item = render_for(lab, device, _flat(groups))
    item["groups"] = [{"label": g["label"], "ops": g["ops"]} for g in groups]
    item["labels"] = [g["label"] for g in groups]
    return item


def _mark_interrupted(lab, doc):
    """A set left "applying" by a server that stopped: a record, no longer a running apply."""
    if doc.get("status") != "applying" or doc.get("id") in _active:
        return doc
    with _lock:
        doc["status"] = "interrupted"
        doc["updated"] = time.time()
        doc.setdefault("results", {})
        _write(lab, doc)
    audit.record(lab, "change-interrupted", change=doc["id"], title=doc.get("title"),
                 reason="the server stopped while the change set was applied: check the devices, the audit log and the backups")
    return doc


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
            out.append(summary(_mark_interrupted(lab, json.loads(p.read_text("utf-8")))))
        except (OSError, ValueError, KeyError):
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
    doc = _mark_interrupted(lab, doc)
    if doc["status"] == "draft":
        doc["digest"] = digest(doc)  # drafts saved by an older version: their digest did not cover the targets
    return doc


def _draft(lab, cid):
    doc = get(lab, cid)
    if doc["status"] != "draft":
        raise ValueError(f"this change set is {doc['status']}: it can not be changed. Start a new one.")
    return doc


def add(lab, cid, body):
    """body: {items: [{device: params, groups: [{label, ops}]}]} (or {device, ops, labels} from an
    older page). Groups for a device already in the set are added to its item (a group with the
    same operations as one there is not added twice), and its commands are rendered again."""
    if not isinstance(body, dict) or not isinstance(body.get("items"), list) or not body["items"]:
        raise ValueError("items must be a list")
    with _lock:
        doc = _draft(lab, cid)
        for x in body["items"]:
            if not isinstance(x, dict) or not isinstance(x.get("device"), dict) or not x["device"].get("id"):
                raise ValueError("each item needs a device")
            dev = store.safe(str(x["device"]["id"]))
            cur = next((it for it in doc["items"] if it["dev"] == dev), None)
            groups = list(item_groups(cur)) if cur else []
            for g in _incoming(x):
                if not any(g["ops"] == h["ops"] for h in groups):
                    groups.append(g)
            item = _rendered(lab, x["device"], groups)
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
                 groups=[[{"label": g["label"], "ops": g["ops"]} for g in _incoming(x)] for x in body["items"]],
                 digest=doc["digest"])
    return public(doc)


def edit(lab, cid, body):
    """body: {title?, note?, remove?: dev, move?: dev, by?: -1|1, dropOp?: [dev, index of the change (group)]}."""
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
            groups = item_groups(it) if it else []
            if it and isinstance(i, int) and not isinstance(i, bool) and 0 <= i < len(groups):
                dropped = groups[i]
                rest = groups[:i] + groups[i + 1:]
                if rest:
                    device = {"id": dev, "name": it["name"], **{k: v for k, v in (it.get("params") or {}).items() if k != "engine"},
                              "driver": it["driver"]}
                    doc["items"][doc["items"].index(it)] = _rendered(lab, device, rest)
                else:
                    doc["items"].remove(it)
                what.append(f"removed \"{dropped['label']}\" from {dev}")
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
        _active.add(doc["id"])
        _write(lab, doc)
    return doc


def abort_apply(lab, cid):
    """The apply could not start (nothing was sent to a device): the set is a draft again."""
    with _lock:
        _active.discard(cid)
        doc = _read(lab, cid)
        if doc and doc["status"] == "applying":
            doc["status"] = "draft"
            doc["updated"] = time.time()
            _write(lab, doc)


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
        _active.discard(cid)
    return doc["status"]
