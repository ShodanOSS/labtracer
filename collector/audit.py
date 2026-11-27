"""Audit log: data/audit/<lab>.jsonl. One JSON object per line, append only.

Every change LabTracer makes to a real device, and every step around it, is written here:
staged and discarded change sets, backups, apply (commands and transcript), rollback
timers, confirmations, restores, discovery runs and remote sessions.

Each entry has the hash of the entry before it ("prev") and its own hash ("hash"), so an
edited or deleted line breaks the chain and verify() shows where. This shows tampering;
it does not prevent it (anyone who can write the file can rebuild the chain).
"""

import getpass
import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

AUDIT_DIR = Path(__file__).resolve().parent.parent / "data" / "audit"
MAX_TEXT = 64 * 1024  # a transcript longer than this is cut (the backup keeps the full config)
NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
GENESIS = "0" * 64
_lock = threading.Lock()
_last = {}  # lab -> (seq, hash): no full read of the file on each record


def _safe(name):
    return NAME_RE.sub("-", (name or "").strip()).strip(".-")[:120] or "x"


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
            return entry
    except Exception as exc:  # noqa: BLE001
        print(f"audit: could not write {event} for {lab}: {exc}")
        return None


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
    p = _path(_safe(lab))
    if not p.is_file():
        return {"ok": True, "entries": 0, "broken": None, "why": ""}
    prev, n = GENESIS, 0
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
            prev, n = e["hash"], n + 1
    return {"ok": True, "entries": n, "broken": None, "why": ""}


def reset_cache():
    """Tests: forget cached tails (after the folder changes)."""
    with _lock:
        _last.clear()
