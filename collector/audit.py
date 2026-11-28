# SPDX-License-Identifier: Apache-2.0
"""Audit log: data/audit/<lab>.jsonl. One JSON object per line, append only.

Every change LabTracer makes to a real device, and every step around it, is written here:
staged and discarded change sets, backups, apply (commands and transcript), rollback
timers, confirmations, restores, discovery runs and remote sessions.

Each entry has the hash of the entry before it ("prev") and its own hash ("hash"), so an
edited or deleted line breaks the chain and verify() shows where. This shows tampering;
it does not prevent it (anyone who can write the file can rebuild the chain).

data/audit/.heads.json keeps the number and hash of the last entry of each log, so lines cut
from the end of a log (which leave a valid chain) also show in verify().

Events that belong to no lab (settings of the server, sessions opened without a lab) go to
the server log, data/audit/.server.jsonl: record(SERVER, ...).
"""

import getpass
import hashlib
import json
import os
import re
import shutil
import threading
import time
from pathlib import Path

AUDIT_DIR = Path(__file__).resolve().parent.parent / "data" / "audit"
MAX_TEXT = 64 * 1024  # a transcript longer than this is cut (the backup keeps the full config)
NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
GENESIS = "0" * 64
SERVER = ".server"  # the server-wide log; no lab name can become this (_safe strips the dot)
HEADS = ".heads.json"
_lock = threading.Lock()
_last = {}  # lab -> (seq, hash): no full read of the file on each record


def _safe(name):
    if name == SERVER:
        return SERVER
    return NAME_RE.sub("-", (name or "").strip()).strip(".-")[:120] or "x"


def _heads():
    try:
        with open(AUDIT_DIR / HEADS, encoding="utf-8") as fh:
            d = json.load(fh)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_head(lab, seq, h):
    """Remember the last entry of a log. Written after the entry: a crash in between leaves
    the head one entry behind, which verify() accepts."""
    heads = _heads()
    heads[lab] = {"seq": seq, "hash": h}
    _write_heads(heads)


def _write_heads(heads):
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    tmp = AUDIT_DIR / (HEADS + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(heads, fh, separators=(",", ":"))
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, AUDIT_DIR / HEADS)


def _path(lab):
    return AUDIT_DIR / f"{_safe(lab)}.jsonl"


def _user():
    try:
        return getpass.getuser()
    except Exception:  # noqa: BLE001
        return ""


def _digest(entry):
    body = {k: v for k, v in entry.items() if k != "hash"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _cut(v):
    if isinstance(v, str) and len(v) > MAX_TEXT:
        return v[:MAX_TEXT] + f"\n… ({len(v) - MAX_TEXT} more characters not kept)"
    if isinstance(v, list):
        return [_cut(x) for x in v[:2000]]
    if isinstance(v, dict):
        return {k: _cut(x) for k, x in v.items()}
    return v


def _tail(lab):
    if lab in _last:
        return _last[lab]
    seq, h = 0, GENESIS
    p = _path(lab)
    if p.is_file():
        with open(p, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(0, size - 256 * 1024))
            lines = fh.read().decode("utf-8", "replace").splitlines()
        for line in reversed(lines):
            try:
                e = json.loads(line)
                seq, h = int(e["seq"]), e["hash"]
                break
            except (ValueError, KeyError, TypeError):
                continue
    _last[lab] = (seq, h)
    return seq, h


def record(lab, event, **fields):
    """Append one entry. Returns it. Never raises: an audit failure must not break a change
    that already ran on a device (the error is printed instead)."""
    lab = _safe(lab)
    try:
        with _lock:
            seq, prev = _tail(lab)
            entry = {"seq": seq + 1, "ts": round(time.time(), 3), "event": str(event), "user": _user(),
                     **{k: _cut(v) for k, v in fields.items() if v is not None}, "prev": prev}
            entry["hash"] = _digest(entry)
            p = _path(lab)
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, separators=(",", ":")) + "\n")
                fh.flush()
                os.fsync(fh.fileno())
            _last[lab] = (entry["seq"], entry["hash"])
            _save_head(lab, entry["seq"], entry["hash"])
            return entry
    except Exception as exc:  # noqa: BLE001
        print(f"audit: could not write {event} for {lab}: {exc}")
        return None


def retire(lab, dest_dir):
    """The lab was deleted or replaced: move its log to dest_dir, and forget its head, so a new
    lab with the same name starts a new log (verify() of it is not "the log was deleted").
    Returns (new path or None, the head it had: {seq, hash} or {})."""
    lab = _safe(lab)
    if lab == SERVER:
        raise ValueError("the server log is never retired")
    with _lock:
        p = _path(lab)
        heads = _heads()
        head = heads.pop(lab, None) or {}
        moved = None
        if p.is_file():
            dest_dir.mkdir(parents=True, exist_ok=True)
            moved = dest_dir / p.name
            shutil.move(str(p), str(moved))
        if head:
            _write_heads(heads)
        _last.pop(lab, None)
    return moved, head


def read(lab, device=None, limit=500, before=None):
    """Newest first. device: only entries for this device id. before: entries with seq < before."""
    p = _path(_safe(lab))
    if not p.is_file():
        return []
    out = []
    with open(p, encoding="utf-8") as fh:
        for line in fh:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if device and e.get("dev") != device and device not in (e.get("devices") or []):
                continue
            if before and int(e.get("seq", 0)) >= int(before):
                continue
            out.append(e)
    out.reverse()
    return out[:max(1, min(5000, int(limit or 500)))]


def verify(lab):
    """{ok, entries, broken: seq of the first bad entry or None, why}."""
    lab = _safe(lab)
    p = _path(lab)
    head = _heads().get(lab) or {}
    if not p.is_file():
        if head.get("seq"):
            return {"ok": False, "entries": 0, "broken": 1, "why": f"the log was deleted: it had {head['seq']} entries"}
        return {"ok": True, "entries": 0, "broken": None, "why": ""}
    prev, n, last_seq = GENESIS, 0, 0
    with open(p, encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            try:
                e = json.loads(line)
            except ValueError:
                return {"ok": False, "entries": n, "broken": i, "why": f"line {i} is not valid JSON"}
            if e.get("prev") != prev:
                return {"ok": False, "entries": n, "broken": e.get("seq", i), "why": f"entry {e.get('seq', i)} does not follow the entry before it (a line was removed or changed)"}
            if _digest(e) != e.get("hash"):
                return {"ok": False, "entries": n, "broken": e.get("seq", i), "why": f"entry {e.get('seq', i)} was changed after it was written"}
            prev, n, last_seq = e["hash"], n + 1, int(e.get("seq", 0) or 0)
    want = int(head.get("seq") or 0)
    if want > last_seq:
        return {"ok": False, "entries": n, "broken": last_seq + 1,
                "why": f"entries {last_seq + 1} to {want} were removed from the end of the log"}
    if want and want == last_seq and head.get("hash") != prev:
        return {"ok": False, "entries": n, "broken": last_seq,
                "why": f"entry {last_seq} is not the entry that was written last (the end of the log was replaced)"}
    return {"ok": True, "entries": n, "broken": None, "why": ""}


def reset_cache():
    """Tests: forget cached tails (after the folder changes)."""
    with _lock:
        _last.clear()
