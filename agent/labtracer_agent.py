#!/usr/bin/env python3
"""LabTracer check agent.

A small, read-only monitoring agent. Standard library only. Runs checks
(ICMP ping, TCP connect) against the targets LabTracer sends it, and
reports results over HTTP(S).

Design rules (it is meant to be safe to run on a domain controller):
  * Runs as an unprivileged user. No shell commands are built from input.
  * Only two kinds of check exist: ping and TCP connect. Targets can not
    make it run anything else.
  * Every request needs the bearer token when the agent listens on a
    non-loopback address. The agent refuses to start otherwise.
  * Optional TLS with your own certificate (stdlib ssl).
  * No data is written except its own targets file.
"""

import argparse
import hmac
import ipaddress
import json
import os
import random
import re
import socket
import ssl
import struct
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VERSION = "1.0"
MAX_TARGETS = 500
MAX_CHECKS_PER_TARGET = 20
MAX_BODY = 1024 * 1024
HOST_RE = re.compile(r"^[A-Za-z0-9.\-:]{1,253}$")

DEFAULTS = {
    "bind": "127.0.0.1",
    "port": 8766,
    "token": "",
    "interval": 30,
    "timeout": 2.0,
    "workers": 16,
    "history": 120,
    "targets_file": "targets.json",
    "tls_cert": "",
    "tls_key": "",
}


# ---------------------------------------------------------------- checks
def _checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\0"
    s = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    s = (s >> 16) + (s & 0xFFFF)
    s += s >> 16
    return ~s & 0xFFFF


def _icmp_socket_ping(host: str, timeout: float):
    """ICMP echo through a socket. Tries an unprivileged datagram socket
    first (Linux, needs net.ipv4.ping_group_range), then a raw socket."""
    if ":" in host:
        raise PermissionError("IPv6: use the ping binary")
    addr = socket.gethostbyname(host)
    ident = random.randint(0, 0xFFFF)
    payload = struct.pack("!d", time.time()) + b"labtracer"
    for kind in (socket.SOCK_DGRAM, socket.SOCK_RAW):
        try:
            s = socket.socket(socket.AF_INET, kind, socket.IPPROTO_ICMP)
        except (PermissionError, OSError):
            continue
        try:
            s.settimeout(timeout)
            hdr = struct.pack("!BBHHH", 8, 0, 0, ident, 1)
            pkt = struct.pack("!BBHHH", 8, 0, _checksum(hdr + payload), ident, 1) + payload
            t0 = time.perf_counter()
            s.sendto(pkt, (addr, 0))
            while True:
                left = timeout - (time.perf_counter() - t0)
                if left <= 0:
                    return False, None, "timeout"
                s.settimeout(left)
                data, src = s.recvfrom(2048)
                if src[0] != addr:
                    continue
                if kind == socket.SOCK_RAW:
                    data = data[(data[0] & 0x0F) * 4:]
                if len(data) >= 8 and data[0] == 0:  # echo reply
                    if kind == socket.SOCK_RAW and struct.unpack("!H", data[4:6])[0] != ident:
                        continue
                    return True, (time.perf_counter() - t0) * 1000, ""
        except socket.timeout:
            return False, None, "timeout"
        finally:
            s.close()
    raise PermissionError("no ICMP socket")


def _ping_binary(host: str, timeout: float):
    if os.name == "nt":
        cmd = ["ping", "-n", "1", "-w", str(int(timeout * 1000)), host]
    else:
        cmd = ["ping", "-c", "1", "-W", str(max(1, int(round(timeout)))), host]
    t0 = time.perf_counter()
    try:
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=timeout + 2, check=False)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return False, None, type(exc).__name__
    ms = (time.perf_counter() - t0) * 1000
    m = re.search(rb"time[=<]\s*([\d.]+)\s*ms", r.stdout)
    if m:
        ms = float(m.group(1))
    ok = r.returncode == 0
    if ok and os.name == "nt" and ":" not in host and b"TTL=" not in r.stdout.upper():
        # Windows ping exits 0 on "Destination host unreachable" from a router.
        # A real IPv4 echo reply always has TTL= (IPv6 replies have none).
        return False, None, "unreachable"
    return ok, (ms if ok else None), "" if ok else "no reply"


def check_ping(host: str, timeout: float):
    try:
        return _icmp_socket_ping(host, timeout)
    except PermissionError:
        return _ping_binary(host, timeout)
    except socket.gaierror:
        return False, None, "name not resolved"
    except OSError as exc:
        return False, None, exc.strerror or str(exc)


def check_tcp(host: str, port: int, timeout: float):
    t0 = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, (time.perf_counter() - t0) * 1000, ""
    except socket.timeout:
        return False, None, "timeout"
    except ConnectionRefusedError:
        return False, None, "refused"
    except socket.gaierror:
        return False, None, "name not resolved"
    except OSError as exc:
        return False, None, exc.strerror or str(exc)


# ---------------------------------------------------------------- validation
def valid_host(h) -> bool:
    if not isinstance(h, str) or not HOST_RE.match(h) or h.startswith("-"):
        return False
    try:
        ipaddress.ip_address(h)
        return True
    except ValueError:
        return all(part and not part.startswith("-") for part in h.split("."))


def clean_targets(raw):
    """Accept only the fields we know. Everything else is dropped."""
    if not isinstance(raw, list):
        raise ValueError("targets must be a list")
    out = []
    for t in raw[:MAX_TARGETS]:
        if not isinstance(t, dict):
            continue
        tid = str(t.get("id", ""))[:80]
        if not tid:
            continue
        checks = []
        for c in (t.get("checks") or [])[:MAX_CHECKS_PER_TARGET]:
            if not isinstance(c, dict) or not valid_host(c.get("host")):
                continue
            if c.get("type") == "ping":
                checks.append({"type": "ping", "host": c["host"]})
            elif c.get("type") == "tcp":
                try:
                    port = int(c.get("port"))
                except (TypeError, ValueError):
                    continue
                if 1 <= port <= 65535:
                    checks.append({"type": "tcp", "host": c["host"], "port": port, "label": str(c.get("label", ""))[:60]})
        out.append({"id": tid, "name": str(t.get("name", ""))[:80], "checks": checks})
    return out


# ---------------------------------------------------------------- agent state
class Agent:
    def __init__(self, cfg, state_dir: Path):
        self.cfg = cfg
        self.targets_path = state_dir / cfg["targets_file"]
        self.lock = threading.Lock()
        self.targets = []
        self.results = {}   # id -> device status
        self.last_run = 0
        self.wake = threading.Event()
        if self.targets_path.exists():
            try:
                self.targets = clean_targets(json.loads(self.targets_path.read_text("utf-8")))
            except Exception as exc:  # noqa: BLE001
                print("could not read targets:", exc, file=sys.stderr)

    def set_targets(self, targets):
        targets = clean_targets(targets)
        tmp = self.targets_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(targets, indent=1), "utf-8")
        os.replace(tmp, self.targets_path)
        with self.lock:
            self.targets = targets
            keep = {t["id"] for t in targets}
            self.results = {k: v for k, v in self.results.items() if k in keep}
        self.wake.set()
        return len(targets)

    def run_once(self):
        with self.lock:
            targets = list(self.targets)
        jobs = [(t, i, c) for t in targets for i, c in enumerate(t["checks"])]
        to = float(self.cfg["timeout"])

        def do(job):
            t, i, c = job
            if c["type"] == "ping":
                ok, ms, err = check_ping(c["host"], to)
            else:
                ok, ms, err = check_tcp(c["host"], c["port"], to)
            return t["id"], i, ok, ms, err

        out = {}
        with ThreadPoolExecutor(max_workers=int(self.cfg["workers"])) as ex:
            for tid, i, ok, ms, err in ex.map(do, jobs):
                out.setdefault(tid, {})[i] = (ok, ms, err)
        now = int(time.time())
        with self.lock:
            current = {t["id"] for t in self.targets}  # targets may have changed during the run
            for t in targets:
                if t["id"] not in current:
                    continue
                prev = self.results.get(t["id"], {})
                prev_checks = {(_c["type"], _c["host"], _c.get("port")): _c for _c in prev.get("checks", [])}
                checks = []
                for i, c in enumerate(t["checks"]):
                    ok, ms, err = out.get(t["id"], {}).get(i, (False, None, "not run"))
                    old = prev_checks.get((c["type"], c["host"], c.get("port")))
                    since = old["since"] if old and old["ok"] == ok else now
                    checks.append({**c, "ok": ok, "ms": None if ms is None else round(ms, 1), "err": err, "since": since})
                pings = [c for c in checks if c["type"] == "ping"]
                tcps = [c for c in checks if c["type"] == "tcp"]
                oks = [c for c in checks if c["ok"]]
                if not checks:
                    state = "unknown"
                elif len(oks) == len(checks):
                    state = "up"
                elif not oks:
                    state = "down"
                elif pings and all(c["ok"] for c in pings) or tcps and any(c["ok"] for c in tcps):
                    state = "degraded"
                else:
                    state = "down"
                lat = [c["ms"] for c in pings if c["ms"] is not None] or [c["ms"] for c in oks if c["ms"] is not None]
                hist = prev.get("history", [])
                hist.append([now, len(oks), len(checks), round(sum(lat) / len(lat), 1) if lat else None])
                hist = hist[-int(self.cfg["history"]):]
                changed = prev.get("state") != state
                self.results[t["id"]] = {
                    "name": t["name"], "state": state, "checks": checks, "history": hist,
                    "since": now if changed else prev.get("since", now),
                }
            self.last_run = now

    def loop(self):
        while True:
            t0 = time.time()
            try:
                self.run_once()
            except Exception as exc:  # noqa: BLE001
                print("check run failed:", exc, file=sys.stderr)
            self.wake.wait(max(1.0, float(self.cfg["interval"]) - (time.time() - t0)))
            self.wake.clear()

    def snapshot(self):
        with self.lock:
            return {"agent": "labtracer-agent", "version": VERSION, "host": socket.gethostname(),
                    "interval": self.cfg["interval"], "generated": self.last_run, "now": int(time.time()), "targets": len(self.targets),
                    "devices": self.results}


# ---------------------------------------------------------------- HTTP
LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "::1")


class Handler(BaseHTTPRequestHandler):
    server_version = "labtracer-agent/" + VERSION
    timeout = 15  # drop idle or slow clients

    def setup(self):
        super().setup()
        self._bad = False
        if isinstance(self.connection, ssl.SSLSocket):
            try:  # TLS handshake here, in the worker thread, not in accept()
                self.connection.do_handshake()
            except (ssl.SSLError, OSError):
                self._bad = True

    def handle(self):
        if not self._bad:
            super().handle()

    def log_message(self, fmt, *args):  # quiet: only errors and target pushes
        pass

    def _send(self, obj, status=HTTPStatus.OK):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _auth(self) -> bool:
        token = self.server.agent.cfg["token"]
        if not token:
            # No token (loopback only): refuse other Host names, so a web page
            # can not reach the agent through DNS rebinding.
            host = (self.headers.get("Host") or "").strip().lower()
            if host.startswith("["):
                host = host[1:host.find("]")] if "]" in host else ""
            elif host.count(":") == 1:
                host = host.split(":")[0]
            return host in LOOPBACK_HOSTS
        got = self.headers.get("Authorization", "")
        return hmac.compare_digest(got.encode(), ("Bearer " + token).encode())

    def do_GET(self):
        if self.path == "/health":
            return self._send({"ok": True})
        if not self._auth():
            return self._send({"error": "unauthorized"}, HTTPStatus.UNAUTHORIZED)
        if self.path == "/status":
            return self._send(self.server.agent.snapshot())
        return self._send({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_PUT(self):
        if not self._auth():
            return self._send({"error": "unauthorized"}, HTTPStatus.UNAUTHORIZED)
        if self.path != "/targets":
            return self._send({"error": "not found"}, HTTPStatus.NOT_FOUND)
        if not (self.headers.get("Content-Type") or "").lower().startswith("application/json"):
            # browsers can not send this cross-origin without a preflight, which we never approve
            return self._send({"error": "Content-Type must be application/json"}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n < 0 or n > MAX_BODY:
            return self._send({"error": "too large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        try:
            count = self.server.agent.set_targets(json.loads(self.rfile.read(n) or b"[]"))
        except Exception as exc:  # noqa: BLE001
            return self._send({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        print(time.strftime("%H:%M:%S"), f"targets updated from {self.client_address[0]}: {count}", file=sys.stderr)
        return self._send({"ok": True, "targets": count})

    def do_POST(self):
        return self.do_PUT()


def load_config(path):
    cfg = dict(DEFAULTS)
    if path and Path(path).exists():
        cfg.update(json.loads(Path(path).read_text("utf-8")))
    return cfg


def main():
    ap = argparse.ArgumentParser(description="LabTracer check agent")
    ap.add_argument("--config", help="path to agent.json")
    ap.add_argument("--state-dir", default=os.environ.get("STATE_DIRECTORY", "."), help="where targets.json is kept")
    ap.add_argument("--bind"); ap.add_argument("--port", type=int); ap.add_argument("--token")
    ap.add_argument("--once", action="store_true", help="run the checks once, print JSON, exit")
    args = ap.parse_args()

    cfg = load_config(args.config)
    for k in ("bind", "port", "token"):
        if getattr(args, k) is not None:
            cfg[k] = getattr(args, k)
    state_dir = Path(args.state_dir)
    state_dir.mkdir(parents=True, exist_ok=True)
    agent = Agent(cfg, state_dir)

    if args.once:
        agent.run_once()
        print(json.dumps(agent.snapshot(), indent=1))
        return

    loopback = cfg["bind"] in ("127.0.0.1", "::1", "localhost")
    if not loopback and len(cfg["token"]) < 16:
        sys.exit("Refusing to listen on %s without a token of 16+ characters. Set \"token\" in agent.json." % cfg["bind"])

    httpd = ThreadingHTTPServer((cfg["bind"], int(cfg["port"])), Handler)
    httpd.agent = agent
    scheme = "http"
    if cfg["tls_cert"] and cfg["tls_key"]:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(cfg["tls_cert"], cfg["tls_key"])
        # No handshake in accept(): a silent client would block the server.
        # Handler.setup() does it on the worker thread, with Handler.timeout.
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True, do_handshake_on_connect=False)
        scheme = "https"
    threading.Thread(target=agent.loop, daemon=True).start()
    print(f"labtracer-agent {VERSION} on {scheme}://{cfg['bind']}:{cfg['port']}  "
          f"({len(agent.targets)} targets, every {cfg['interval']}s)", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
