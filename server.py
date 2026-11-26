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

import ssh_bridge

ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "app"
DATA_DIR = ROOT / "data"
LAB_DIR = DATA_DIR / "labs"
HISTORY_DIR = LAB_DIR / ".history"
EXPORT_DIR = DATA_DIR / "export"
LIBRARY_FILE = DATA_DIR / "library.json"
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
                version, doc = lab_version(f), json.loads(f.read_text("utf-8"))
            return self._json(doc, headers={"X-LabTracer-Version": version})
        if path == "/api/library":
            if LIBRARY_FILE.exists():
                return self._json(json.loads(LIBRARY_FILE.read_text("utf-8")))
            return self._json({"templates": []})
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
        if path.startswith("/api/"):
            return self._error(HTTPStatus.NOT_FOUND, "unknown endpoint")
        return super().do_GET()

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
            base = self.headers.get("X-LabTracer-Base")
            force = self.headers.get("X-LabTracer-Force") == "1"
            with _lock:
                current = lab_version(target)
                if base is not None and not force and base != current:
                    return self._json({"error": "the lab was changed by another window", "conflict": True,
                                       "version": current}, HTTPStatus.CONFLICT)
                rotate_history(name, target, force=force)
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
