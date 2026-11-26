#!/usr/bin/env python3
"""LabTracer local server.

Standard library only. Serves the web UI from ./app and stores labs,
the custom object library, and exported configs under ./data.

Security posture:
  * Binds to 127.0.0.1 by default (local only).
  * Rejects requests whose Host header is not localhost (DNS rebinding guard).
  * Write requests must carry the X-LabTracer header, so a web page on
    another origin cannot post to the API (custom headers force a CORS
    preflight, which this server never approves).
  * All names are sanitised; paths can not leave ./data.
  * SSH console (ssh_bridge.py): off on a non-loopback bind; a WebSocket
    needs a one-time id from a header-guarded POST and a same-origin Origin.
  * Collector (collector/): reads devices over SSH for the drift report, and
    applies reviewed changes. Off on a non-loopback bind, never stores passwords.
    The browser sends operations, never command text (collector/ops.py).
  * Events (/api/events): one WebSocket per window for live updates; same
    Origin check as the SSH console. It carries no secrets.
"""

import argparse
import json
import ssl
import urllib.error
import urllib.request
import os
import re
import shutil
import sys
import threading
import time
import webbrowser
import ipaddress
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import collector
import ssh_bridge
from collector import store as observed

ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "app"
DATA_DIR = ROOT / "data"
LAB_DIR = DATA_DIR / "labs"
HISTORY_DIR = LAB_DIR / ".history"
EXPORT_DIR = DATA_DIR / "export"
LIBRARY_FILE = DATA_DIR / "library.json"
LIBRARY_HISTORY_DIR = DATA_DIR / ".history"  # copies of library.json before a format upgrade
MONITOR_FILE = DATA_DIR / "monitor.json"  # agent URL + token; keep out of git

MAX_BODY = 64 * 1024 * 1024  # 64 MB (custom GLB models are stored inline)
HISTORY_KEEP = 40
HISTORY_EVERY = 600  # seconds between history copies
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data: blob:; connect-src 'self' data: blob: ws://127.0.0.1:* ws://localhost:*; "
       "object-src 'none'; "
       "base-uri 'none'; frame-ancestors 'none'")
NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_lock = threading.Lock()


def safe_name(name: str, fallback: str = "untitled") -> str:
    name = NAME_RE.sub("-", (name or "").strip()).strip(".-")
    return name[:80] or fallback


def lab_version(path: Path) -> str:
    """Version of a lab file for save conflict checks: its mtime in ns, or "new"."""
    try:
        return str(path.stat().st_mtime_ns)
    except FileNotFoundError:
        return "new"


def read_json(path: Path):
    """Parse a JSON file. ValueError (with the reason) if it is not valid JSON or not UTF-8."""
    try:
        return json.loads(path.read_text("utf-8"))
    except UnicodeDecodeError as exc:
        raise ValueError("not UTF-8 text") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"not valid JSON (line {exc.lineno}, column {exc.colno})") from exc


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "wb") as fh:
        fh.write(data)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def _history_of(lab: str):
    """History copies of exactly this lab (lab "a" must not match lab "a.b")."""
    pat = re.compile(re.escape(lab) + r"\.\d{8}-\d{6}\.json")
    return sorted(f for f in HISTORY_DIR.glob(f"{lab}.*.json") if pat.fullmatch(f.name))


_versions = {}  # path -> (mtime_ns, size, format version): no full parse of a big lab on each save


def format_version(path: Path):
    """Format version of a saved lab or library ("version", 1 if missing), or None if there is no
    readable file. A newer app writes a higher number; an older app must not overwrite that file."""
    try:
        st = path.stat()
    except FileNotFoundError:
        return None
    key = (st.st_mtime_ns, st.st_size)
    hit = _versions.get(str(path))
    if hit and hit[0] == key:
        return hit[1]
    try:
        v = read_json(path).get("version", 1)
    except (ValueError, AttributeError):
        v = None  # damaged: saving over it is allowed (the history keeps a copy)
    v = v if isinstance(v, int) and not isinstance(v, bool) else None
    _versions[str(path)] = (key, v)
    return v


def downgrade_error(path: Path, data: dict):
    """Message if data has an older format than the file it would replace, else None."""
    on_disk, incoming = format_version(path), data.get("version", 1)
    if not isinstance(incoming, int) or isinstance(incoming, bool):
        incoming = 1
    if on_disk is not None and incoming < on_disk:
        return (f"{path.name} has format {on_disk}, written by a newer LabTracer. This page uses format "
                f"{incoming} and would lose data. Reload the page to use the new version.")
    return None


def keep_library_copy() -> None:
    if LIBRARY_FILE.exists():
        LIBRARY_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(LIBRARY_FILE, LIBRARY_HISTORY_DIR / f"library.{time.strftime('%Y%m%d-%H%M%S')}.json")


def rotate_history(lab: str, current: Path, force: bool = False) -> None:
    """Copy the current lab file into .history before it is overwritten."""
    if not current.exists():
        return
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    old = _history_of(lab)
    if not force and old and time.time() - old[-1].stat().st_mtime < HISTORY_EVERY:
        return  # autosave: keep at most one copy per HISTORY_EVERY seconds
    stamp = time.strftime("%Y%m%d-%H%M%S")
    shutil.copy2(current, HISTORY_DIR / f"{lab}.{stamp}.json")
    old = _history_of(lab)
    for extra in old[:-HISTORY_KEEP]:
        extra.unlink(missing_ok=True)


# ---------------------------------------------------------------- monitoring agent proxy
def monitor_cfg():
    try:
        return json.loads(MONITOR_FILE.read_text("utf-8"))
    except Exception:  # noqa: BLE001
        return {"agentUrl": "", "token": "", "cafile": "", "insecure": False}


def agent_call(method, path, body=None, timeout=6):
    cfg = monitor_cfg()
    url = (cfg.get("agentUrl") or "").rstrip("/")
    if not url.startswith(("http://", "https://")):
        raise ValueError("no agent configured")
    req = urllib.request.Request(url + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type", "application/json")
    if cfg.get("token"):
        req.add_header("Authorization", "Bearer " + cfg["token"])
    ctx = None
    if url.startswith("https://"):
        ctx = ssl.create_default_context(cafile=cfg.get("cafile") or None)
        if cfg.get("insecure"):
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:  # noqa: S310 (URL set by the local user)
        return json.loads(r.read().decode("utf-8"))


# ---------------------------------------------------------------- live events
class EventHub:
    """Pushes live updates to every open LabTracer window over /api/events:
    monitor status (one agent poll for all windows), collect and apply jobs, new facts.
    Browser -> server messages: {"type": "subscribe", "monitor": bool}, {"type": "poll"}."""
    MAX_CLIENTS = 16

    def __init__(self):
        self.clients = {}  # WebSocket -> {"monitor": bool}
        self.lock = threading.Lock()
        self.wake = threading.Event()
        self.thread = None

    def add(self, ws):
        with self.lock:
            if len(self.clients) >= self.MAX_CLIENTS:
                return False
            self.clients[ws] = {"monitor": False}
            if self.thread is None:
                self.thread = threading.Thread(target=self._poller, name="agent-poller", daemon=True)
                self.thread.start()
        return True

    def remove(self, ws):
        with self.lock:
            self.clients.pop(ws, None)

    def broadcast(self, event, only=None):
        with self.lock:
            targets = [ws for ws, c in self.clients.items() if not only or c.get(only)]
        for ws in targets:
            if ws.closed:
                self.remove(ws)
            else:
                ws.send_json(event)

    def message(self, ws, m):
        t = m.get("type") if isinstance(m, dict) else None
        if t == "subscribe":
            with self.lock:
                if ws in self.clients:
                    self.clients[ws]["monitor"] = bool(m.get("monitor"))
            if m.get("monitor"):
                self.wake.set()
        elif t == "poll":
            self.wake.set()

    def _poller(self):
        interval = 30
        while True:
            self.wake.wait(timeout=interval)
            self.wake.clear()
            with self.lock:
                wanted = any(c["monitor"] for c in self.clients.values())
            if not wanted:
                interval = 30
                continue
            try:
                st = agent_call("GET", "/status")
                interval = max(5, min(120, int(st.get("interval") or 30)))
                self.broadcast({"type": "monitor", "status": st}, only="monitor")
            except urllib.error.HTTPError as exc:
                self.broadcast({"type": "monitor", "error": f"agent said {exc.code} {exc.reason}"}, only="monitor")
                interval = 30
            except Exception as exc:  # noqa: BLE001
                self.broadcast({"type": "monitor", "error": str(getattr(exc, "reason", exc))}, only="monitor")
                interval = 30


hub = EventHub()
collector.listeners.append(hub.broadcast)


class Handler(SimpleHTTPRequestHandler):
    server_version = "LabTracer/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    # quieter log: one line per API call, nothing for static files
    def log_message(self, fmt, *args):
        if getattr(self, "path", "").startswith("/api/"):
            sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    # ---- guards -------------------------------------------------------
    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").strip().lower()
        if host.startswith("["):  # [::1]:8765
            host = host[1:host.find("]")] if "]" in host else ""
        elif host.count(":") == 1:  # name:port
            host = host.split(":")[0]
        return host in ("127.0.0.1", "localhost", "::1") or host == self.server.allowed_host

    def _write_ok(self) -> bool:
        return self.headers.get("X-LabTracer") == "1"

    def _json(self, obj, status=HTTPStatus.OK, headers=None):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, msg):
        self._json({"error": msg}, status)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length < 0 or length > MAX_BODY:
            raise ValueError("request body too large")
        raw = self.rfile.read(length) if length else b""
        return json.loads(raw.decode("utf-8")) if raw else None

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", CSP)
        super().end_headers()

    # ---- routing ------------------------------------------------------
    def do_GET(self):
        if not self._host_ok():
            return self._error(HTTPStatus.FORBIDDEN, "bad host")
        path = urlparse(self.path).path
        if path == "/api/ping":
            return self._json({"ok": True, "app": "labtracer", "data": str(DATA_DIR)})
        if path == "/api/labs":
            labs = []
            for f in sorted(LAB_DIR.glob("*.json")):
                st = f.stat()
                labs.append({"name": f.stem, "size": st.st_size, "modified": int(st.st_mtime)})
            return self._json(labs)
        if path.startswith("/api/labs/"):
            name = safe_name(unquote(path[len("/api/labs/"):]))
            f = LAB_DIR / f"{name}.json"
            with _lock:  # file and version must match
                if not f.exists():
                    return self._error(HTTPStatus.NOT_FOUND, "no such lab")
                version = lab_version(f)
                try:
                    doc = read_json(f)
                except ValueError as exc:
                    return self._error(HTTPStatus.UNPROCESSABLE_ENTITY, f"{f.name} is damaged: {exc}. "
                                       f"Older copies are in {HISTORY_DIR.relative_to(ROOT)}.")
            return self._json(doc, headers={"X-LabTracer-Version": version})
        if path == "/api/library":
            if not LIBRARY_FILE.exists():
                return self._json({"templates": []})
            try:
                return self._json(read_json(LIBRARY_FILE))
            except ValueError as exc:
                return self._error(HTTPStatus.UNPROCESSABLE_ENTITY, f"{LIBRARY_FILE.name} is damaged: {exc}")
        if path == "/api/monitor/config":
            c = monitor_cfg()
            return self._json({"agentUrl": c.get("agentUrl", ""), "hasToken": bool(c.get("token")),
                               "cafile": c.get("cafile", ""), "insecure": bool(c.get("insecure"))})
        if path == "/api/monitor/status":
            try:
                return self._json(agent_call("GET", "/status"))
            except urllib.error.HTTPError as exc:
                return self._error(HTTPStatus.BAD_GATEWAY, f"agent said {exc.code} {exc.reason}")
            except Exception as exc:  # noqa: BLE001
                return self._error(HTTPStatus.BAD_GATEWAY, str(getattr(exc, "reason", exc)))
        if path == "/api/ssh/caps":
            return self._json(ssh_bridge.caps())
        if path == "/api/ssh/ws":
            return self._ssh_ws()
        if path == "/api/events":
            return self._events_ws()
        if path == "/api/collect/caps":
            return self._json(collector.caps())
        if path.startswith("/api/collect/jobs/"):
            snap = collector.snapshot(unquote(path[len("/api/collect/jobs/"):]))
            return self._json(snap) if snap else self._error(HTTPStatus.NOT_FOUND, "no such job")
        if path.startswith("/api/observed/"):
            parts = [unquote(x) for x in path[len("/api/observed/"):].split("/")]
            if len(parts) == 1:
                return self._json({"devices": observed.read_all(safe_name(parts[0]))})
            if len(parts) == 2:
                doc = observed.read(safe_name(parts[0]), parts[1])
                return self._json(doc) if doc else self._error(HTTPStatus.NOT_FOUND, "nothing collected yet")
            return self._error(HTTPStatus.NOT_FOUND, "unknown endpoint")
        if path.startswith("/api/"):
            return self._error(HTTPStatus.NOT_FOUND, "unknown endpoint")
        return super().do_GET()

    def _upgrade(self):
        """Answer a same-origin WebSocket upgrade. Returns the WebSocket, or None after an error reply."""
        host = self.headers.get("Host") or ""
        if self.headers.get("Origin") != f"http://{host}":
            self._error(HTTPStatus.FORBIDDEN, "bad origin")
            return None
        if (self.headers.get("Upgrade") or "").lower() != "websocket" or not self.headers.get("Sec-WebSocket-Key"):
            self._error(HTTPStatus.BAD_REQUEST, "WebSocket upgrade expected")
            return None
        self.send_response(HTTPStatus.SWITCHING_PROTOCOLS)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", ssh_bridge.ws_accept(self.headers["Sec-WebSocket-Key"].strip()))
        self.end_headers()
        self.wfile.flush()
        self.close_connection = True
        self.connection.settimeout(None)
        return ssh_bridge.WebSocket(self.rfile, self.wfile, self.connection)

    def _events_ws(self):
        """Live updates for one window (see EventHub)."""
        ws = self._upgrade()
        if ws is None:
            return None
        if not hub.add(ws):
            ws.close(1013)
            return None
        try:
            ws.send_json({"type": "hello"})
            while True:
                op, msg = ws.recv()
                if op is None:
                    break
                if op == 0x1:
                    try:
                        hub.message(ws, json.loads(msg.decode("utf-8")))
                    except ValueError:
                        pass
        except OSError:
            pass
        finally:
            hub.remove(ws)
            ws.close()
        return None

    def _ssh_ws(self):
        """WebSocket for one SSH session. Needs a one-time id from POST /api/ssh/session
        (that POST needs the X-LabTracer header) and an Origin of this server."""
        host = self.headers.get("Host") or ""
        if self.headers.get("Origin") != f"http://{host}":
            return self._error(HTTPStatus.FORBIDDEN, "bad origin")
        if (self.headers.get("Upgrade") or "").lower() != "websocket" or not self.headers.get("Sec-WebSocket-Key"):
            return self._error(HTTPStatus.BAD_REQUEST, "WebSocket upgrade expected")
        params = ssh_bridge.take_session(parse_qs(urlparse(self.path).query).get("sid", [""])[0])
        if params is None:
            return self._error(HTTPStatus.FORBIDDEN, "unknown or expired session id")
        self.send_response(HTTPStatus.SWITCHING_PROTOCOLS)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", ssh_bridge.ws_accept(self.headers["Sec-WebSocket-Key"].strip()))
        self.end_headers()
        self.wfile.flush()
        self.close_connection = True
        self.connection.settimeout(None)
        ssh_bridge.run(ssh_bridge.WebSocket(self.rfile, self.wfile, self.connection), params)
        return None

    def do_PUT(self):
        if not self._host_ok() or not self._write_ok():
            return self._error(HTTPStatus.FORBIDDEN, "forbidden")
        path = urlparse(self.path).path
        try:
            data = self._body()
        except Exception as exc:  # noqa: BLE001
            return self._error(HTTPStatus.BAD_REQUEST, str(exc))
        if path.startswith("/api/labs/"):
            name = safe_name(unquote(path[len("/api/labs/"):]))
            if not isinstance(data, dict) or "devices" not in data:
                return self._error(HTTPStatus.BAD_REQUEST, "not a lab document")
            target = LAB_DIR / f"{name}.json"
            # X-LabTracer-Base: the version the page loaded ("new" = expects no file).
            # A different version on disk means another window saved first: refuse.
            # X-LabTracer-Force: 1 overwrites anyway and always keeps a history copy.
            # X-LabTracer-Keep-Copy: 1 always keeps a history copy (first save after a format upgrade).
            base = self.headers.get("X-LabTracer-Base")
            force = self.headers.get("X-LabTracer-Force") == "1"
            keep = force or self.headers.get("X-LabTracer-Keep-Copy") == "1"
            with _lock:
                current = lab_version(target)
                newer = downgrade_error(target, data)  # refused even with force: it would lose data
                if newer:
                    return self._json({"error": newer, "newer": True}, HTTPStatus.CONFLICT)
                if base is not None and not force and base != current:
                    return self._json({"error": "the lab was changed by another window", "conflict": True,
                                       "version": current}, HTTPStatus.CONFLICT)
                rotate_history(name, target, force=keep)
                atomic_write(target, json.dumps(data, indent=1).encode("utf-8"))
                version = lab_version(target)
            return self._json({"ok": True, "name": name, "saved": int(time.time()), "version": version})
        if path == "/api/monitor/config":
            if not isinstance(data, dict):
                return self._error(HTTPStatus.BAD_REQUEST, "bad config")
            c = monitor_cfg()
            url = str(data.get("agentUrl", c.get("agentUrl", ""))).strip()
            if url and not url.startswith(("http://", "https://")):
                return self._error(HTTPStatus.BAD_REQUEST, "agent URL must start with http:// or https://")
            c["agentUrl"] = url
            if "token" in data and data["token"] is not None:
                c["token"] = str(data["token"]).strip()
            c["cafile"] = str(data.get("cafile", c.get("cafile", ""))).strip()
            c["insecure"] = bool(data.get("insecure", c.get("insecure", False)))
            with _lock:
                atomic_write(MONITOR_FILE, json.dumps(c, indent=1).encode("utf-8"))
                try:
                    os.chmod(MONITOR_FILE, 0o600)
                except OSError:
                    pass
            return self._json({"ok": True})
        if path == "/api/library":
            if not isinstance(data, dict) or "templates" not in data:
                return self._error(HTTPStatus.BAD_REQUEST, "not a library document")
            with _lock:
                newer = downgrade_error(LIBRARY_FILE, data)
                if newer:
                    return self._json({"error": newer, "newer": True}, HTTPStatus.CONFLICT)
                if self.headers.get("X-LabTracer-Keep-Copy") == "1":
                    keep_library_copy()
                atomic_write(LIBRARY_FILE, json.dumps(data, indent=1).encode("utf-8"))
            return self._json({"ok": True})
        return self._error(HTTPStatus.NOT_FOUND, "unknown endpoint")

    def do_POST(self):
        if not self._host_ok() or not self._write_ok():
            return self._error(HTTPStatus.FORBIDDEN, "forbidden")
        path = urlparse(self.path).path
        try:
            data = self._body()
        except Exception as exc:  # noqa: BLE001
            return self._error(HTTPStatus.BAD_REQUEST, str(exc))
        if path.startswith("/api/export/"):
            # body: {"files": [{"device": "...", "name": "...", "content": "..."}]}
            lab = safe_name(unquote(path[len("/api/export/"):]))
            files = data.get("files") if isinstance(data, dict) else None
            if not isinstance(files, list):
                return self._error(HTTPStatus.BAD_REQUEST, "files must be a list")
            base = EXPORT_DIR / lab
            written = []
            with _lock:
                for item in files:
                    if not isinstance(item, dict):
                        continue
                    dev = safe_name(item.get("device"), "device")
                    fname = safe_name(item.get("name"), "config.txt")
                    target = (base / dev / fname).resolve()
                    if EXPORT_DIR.resolve() not in target.parents:
                        continue
                    atomic_write(target, str(item.get("content", "")).encode("utf-8"))
                    written.append(str(target.relative_to(ROOT)))
            return self._json({"ok": True, "folder": str(base), "files": written})
        if path == "/api/monitor/targets":
            try:
                return self._json(agent_call("PUT", "/targets", (data or {}).get("targets", [])))
            except urllib.error.HTTPError as exc:
                return self._error(HTTPStatus.BAD_GATEWAY, f"agent said {exc.code} {exc.reason}")
            except Exception as exc:  # noqa: BLE001
                return self._error(HTTPStatus.BAD_GATEWAY, str(getattr(exc, "reason", exc)))
        if path == "/api/ssh/session":
            try:
                return self._json(ssh_bridge.new_session(data))
            except PermissionError as exc:
                return self._error(HTTPStatus.FORBIDDEN, str(exc))
            except ValueError as exc:
                return self._error(HTTPStatus.BAD_REQUEST, str(exc))
        if path == "/api/remediate/apply" or (path.startswith("/api/remediate/") and path.endswith("/plan")):
            try:
                if path == "/api/remediate/apply":
                    return self._json(collector.apply(data))
                return self._json(collector.plan(safe_name(unquote(path[len("/api/remediate/"):-len("/plan")])), data))
            except PermissionError as exc:
                return self._error(HTTPStatus.FORBIDDEN, str(exc))
            except ValueError as exc:
                return self._error(HTTPStatus.BAD_REQUEST, str(exc))
        if path.startswith("/api/collect/"):
            try:
                return self._json(collector.start(safe_name(unquote(path[len("/api/collect/"):])), data))
            except PermissionError as exc:
                return self._error(HTTPStatus.FORBIDDEN, str(exc))
            except ValueError as exc:
                return self._error(HTTPStatus.BAD_REQUEST, str(exc))
        if path.startswith("/api/delete/"):
            name = safe_name(unquote(path[len("/api/delete/"):]))
            f = LAB_DIR / f"{name}.json"
            with _lock:
                rotate_history(name, f, force=True)  # keep a copy in .history
                f.unlink(missing_ok=True)
            return self._json({"ok": True})
        return self._error(HTTPStatus.NOT_FOUND, "unknown endpoint")

    def do_OPTIONS(self):  # never approve cross-origin preflights
        self.send_response(HTTPStatus.FORBIDDEN)
        self.end_headers()


def _is_loopback(host: str) -> bool:
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host.strip("[]")).is_loopback
    except ValueError:
        return False


def main():
    ap = argparse.ArgumentParser(description="LabTracer local server")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1",
                    help="bind address (default 127.0.0.1, local only)")
    ap.add_argument("--no-browser", action="store_true", help="do not open a browser tab")
    args = ap.parse_args()

    for d in (LAB_DIR, EXPORT_DIR):
        d.mkdir(parents=True, exist_ok=True)

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    httpd.allowed_host = args.host.lower()
    ssh_bridge.ENABLED = _is_loopback(args.host)
    if not ssh_bridge.ENABLED:
        print("SSH console is off: the server listens on a network address.")
    url = f"http://127.0.0.1:{args.port}/"
    print(f"LabTracer running at {url}  (data: {DATA_DIR})")
    print("Press Ctrl+C to stop.")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
