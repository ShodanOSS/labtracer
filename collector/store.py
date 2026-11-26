"""Observed state: data/observed/<lab>/<device id>.json.

Kept apart from the lab file: facts change all the time, and the lab file is the
plan (it has undo, history copies and format migrations). Each file holds the
latest facts plus the last few distinct device configs.
"""

import json
import os
import re
import threading
from pathlib import Path

OBS_DIR = Path(__file__).resolve().parent.parent / "data" / "observed"
KEEP_CONFIGS = 5
NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_lock = threading.Lock()


def safe(name, fallback="x"):
    return NAME_RE.sub("-", (name or "").strip()).strip(".-")[:120] or fallback


def _path(lab, dev):
    return OBS_DIR / safe(lab) / f"{safe(dev)}.json"


def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def save(lab, dev, facts):
    p = _path(lab, dev)
    with _lock:
        old = read(lab, dev) or {}
        configs = old.get("configs") or []
        raw = facts.get("rawConfig") or ""
        if raw and (not configs or configs[0]["text"] != raw):
            configs = [{"ts": facts["collected"], "text": raw}] + configs
        _write(p, json.dumps({"facts": facts, "configs": configs[:KEEP_CONFIGS]}, indent=1).encode("utf-8"))


def read(lab, dev):
    try:
        return json.loads(_path(lab, dev).read_text("utf-8"))
    except (OSError, ValueError):
        return None


def read_all(lab):
    """{device id: facts} for one lab (no config history: keeps the answer small)."""
    out = {}
    folder = OBS_DIR / safe(lab)
    if not folder.is_dir():
        return out
    for f in folder.glob("*.json"):
        try:
            out[f.stem] = json.loads(f.read_text("utf-8"))["facts"]
        except (OSError, ValueError, KeyError):
            continue
    return out


def forget(lab, dev):
    with _lock:
        _path(lab, dev).unlink(missing_ok=True)
