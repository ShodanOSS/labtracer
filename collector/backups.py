# SPDX-License-Identifier: Apache-2.0
"""Pre-change backups: data/backups/<lab>/<device id>/<backup id>.json.

Before LabTracer applies a change to a device it reads the device's config and keeps it
here (and, where the platform allows, a copy on the device itself, for a rollback that
works without LabTracer). A backup is never overwritten; the newest KEEP per device stay.

{id, ts, dev, name, host, driver, change, config: text, files: {path: text},
 archive: base64 tar of the files (Linux), onDevice: name of the copy on the device or ""}
"""

import json
import os
import re
import secrets
import threading
import time
from pathlib import Path

BACKUP_DIR = Path(__file__).resolve().parent.parent / "data" / "backups"
KEEP = 30
ID_RE = re.compile(r"^[0-9]{8}-[0-9]{6}-[A-Za-z0-9_-]{4,12}$")
NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_lock = threading.Lock()


def _safe(name):
    return NAME_RE.sub("-", (name or "").strip()).strip(".-")[:120] or "x"


def new_id():
    return time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_urlsafe(6).replace("-", "x").replace("_", "y")


def _folder(lab, dev):
    return BACKUP_DIR / _safe(lab) / _safe(dev)


def save(lab, dev, doc):
    """Write a backup (doc must have "id"). Returns the summary."""
    if not ID_RE.match(str(doc.get("id", ""))):
        raise ValueError("bad backup id")
    folder = _folder(lab, dev)
    with _lock:
        folder.mkdir(parents=True, exist_ok=True)
        p = folder / f"{doc['id']}.json"
        tmp = p.with_suffix(".json.tmp")
        tmp.write_text(json.dumps({**doc, "dev": _safe(dev)}, indent=1), "utf-8")
        os.replace(tmp, p)
        for old in sorted(folder.glob("*.json"))[:-KEEP]:
            old.unlink(missing_ok=True)
    return summary(json.loads(p.read_text("utf-8")))


def summary(doc):
    out = {k: doc.get(k) for k in ("id", "ts", "dev", "name", "host", "driver", "change", "onDevice", "note")}
    out.update(files=sorted((doc.get("files") or {}).keys()), size=len(doc.get("config") or ""))
    return out


def list_for(lab, dev):
    folder = _folder(lab, dev)
    out = []
    for p in sorted(folder.glob("*.json"), reverse=True) if folder.is_dir() else []:
        try:
            out.append(summary(json.loads(p.read_text("utf-8"))))
        except (OSError, ValueError):
            continue
    return out


def read(lab, dev, backup_id):
    if not ID_RE.match(str(backup_id or "")):
        return None
    try:
        return json.loads((_folder(lab, dev) / f"{backup_id}.json").read_text("utf-8"))
    except (OSError, ValueError):
        return None
