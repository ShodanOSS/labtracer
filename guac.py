# SPDX-License-Identifier: Apache-2.0
"""Remote access over Apache Guacamole: RDP, VNC, SSH and Telnet in the browser.

    browser (guacamole-common-js) <-- WebSocket "guacamole" --> server.py (this module)
        <-- Guacamole protocol, TCP 4822 --> guacd <-- RDP / VNC / SSH / Telnet --> device

Only guacd is needed (docker run -d -p 127.0.0.1:4822:4822 guacamole/guacd, or the guacd
package): no Tomcat, no Guacamole web app, no database. server.py does the handshake with guacd
and relays instructions both ways.

Rules (the same as the SSH console):
  * Off when server.py listens on a network address.
  * A session starts with a header-guarded POST that returns a one-time id (30 s). The WebSocket
    must give it and come from the LabTracer page (Origin check).
  * Connection parameters come from a fixed list, checked one by one. Drive mapping, printing,
    recording and SFTP (which write files on the guacd host) can not be turned on.
  * The browser may only send input and display instructions (key, mouse, size, clipboard...).
  * Passwords are used for one connect and never stored. Each session goes into the audit log.
"""

import codecs
import json
import os
import re
import secrets
import socket
import ssl
import threading
import time
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"
CONFIG_FILE = DATA_DIR / "remote.json"
ENABLED = True  # server.py turns this off for a non-loopback bind
MAX_SESSIONS = 8
SID_TTL = 30
PROTOCOLS = {"rdp": 3389, "vnc": 5900, "ssh": 22, "telnet": 23}
SECURITY = ("any", "nla", "nla-ext", "tls", "rdp", "vmconnect")
CLIENT_OPCODES = {"ack", "blob", "clipboard", "disconnect", "end", "key", "mouse", "nop", "size", "sync", "touch"}
HOST_RE = re.compile(r"^[A-Za-z0-9.\-:]{1,253}$")
USER_RE = re.compile(r"^[\w.@\\ -]{0,64}$")
DOMAIN_RE = re.compile(r"^[\w.-]{0,64}$")
GUACD_RE = re.compile(r"^[A-Za-z0-9.\-]{1,253}:\d{1,5}$")
MAX_BUF = 8 * 1024 * 1024

_lock = threading.Lock()
_pending = {}  # sid -> (params, expires)
_live = {}     # id -> {device, protocol, started}
audit_hook = None  # set by server.py: fn(lab, event, **fields)


# ---------------------------------------------------------------- config
def config():
    try:
        c = json.loads(CONFIG_FILE.read_text("utf-8"))
    except (OSError, ValueError):
        c = {}
    return {"guacd": c.get("guacd") or "127.0.0.1:4822", "tls": bool(c.get("tls")), "cafile": c.get("cafile") or "",
            "insecure": bool(c.get("insecure"))}


def save_config(data):
    if not isinstance(data, dict):
        raise ValueError("bad config")
    c = config()
    g = str(data.get("guacd", c["guacd"])).strip()
    if not GUACD_RE.match(g) or not 1 <= int(g.rsplit(":", 1)[1]) <= 65535:
        raise ValueError("guacd address must be host:port, for example 127.0.0.1:4822")
    c.update(guacd=g, tls=bool(data.get("tls", c["tls"])), cafile=str(data.get("cafile", c["cafile"])).strip(),
             insecure=bool(data.get("insecure", c["insecure"])))
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONFIG_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(c, indent=1), "utf-8")
    os.replace(tmp, CONFIG_FILE)
    return c


def caps():
    return {"enabled": ENABLED, "guacd": config()["guacd"], "live": len(_live), "max": MAX_SESSIONS, "protocols": PROTOCOLS}


# ---------------------------------------------------------------- protocol
def instr(*elements):
    """Encode one instruction: lengths count Unicode code points."""
    return ",".join(f"{len(str(e))}.{e}" for e in elements) + ";"


def parse(buf):
    """Split complete instructions off the front of buf. Returns ([[opcode, args...]], rest, consumed text)."""
    out, pos = [], 0
    n = len(buf)
    while pos < n:
        elems, i = [], pos
        while True:
            dot = buf.find(".", i)
            if dot < 0 or dot - i > 10:
                if dot < 0 and n - i <= 10:
                    return out, buf[pos:], buf[:pos]  # length not complete yet
                raise ValueError("bad instruction from the peer")
            ln = buf[i:dot]
            if not ln.isdigit():
                raise ValueError("bad instruction length")
            end = dot + 1 + int(ln)
            if end >= n:
                return out, buf[pos:], buf[:pos]
            elems.append(buf[dot + 1:end])
            term = buf[end]
            i = end + 1
            if term == ";":
                break
            if term != ",":
                raise ValueError("bad instruction terminator")
        out.append(elems)
        pos = i
    return out, "", buf


class Guacd:
    """One connection to guacd."""

    def __init__(self, cfg):
        host, port = cfg["guacd"].rsplit(":", 1)
        s = socket.create_connection((host, int(port)), timeout=10)
        if cfg["tls"]:
            ctx = ssl.create_default_context(cafile=cfg["cafile"] or None)
            if cfg["insecure"]:
                ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
            s = ctx.wrap_socket(s, server_hostname=host)
        self.sock = s
        self.dec = codecs.getincrementaldecoder("utf-8")("replace")
        self.buf = ""

    def send(self, text):
        self.sock.sendall(text.encode("utf-8"))

    def read(self):
        """Complete instructions as raw text (may be several), or None at the end."""
        while True:
            data = self.sock.recv(65536)
            if not data:
                return None
            self.buf += self.dec.decode(data)
            if len(self.buf) > MAX_BUF:
                raise ValueError("instruction too large")
            _ins, rest, done = parse(self.buf)
            if done:
                self.buf = rest
                return done

    def expect(self, opcode):
        """Read one instruction during the handshake."""
        while True:
            ins, rest, _done = parse(self.buf)
            if ins:
                first = ins[0]
                self.buf = "".join(instr(*x) for x in ins[1:]) + rest  # keep what came after it
                if first[0] == "error":
                    raise ConnectionError(f"guacd: {first[1] if len(first) > 1 else 'error'}")
                if first[0] != opcode:
                    raise ConnectionError(f"guacd sent {first[0]}, expected {opcode}")
                return first[1:]
            data = self.sock.recv(65536)
            if not data:
                raise ConnectionError("guacd closed the connection during the handshake")
            self.buf += self.dec.decode(data)

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


def connect_params(p):
    """Guacamole connection parameters from validated session params (a fixed list)."""
    out = {"hostname": p["host"], "port": str(p["port"]), "username": p["user"], "password": p["password"]}
    if p["protocol"] == "rdp":
        out.update({"domain": p["domain"], "security": p["security"], "ignore-cert": "true" if p["ignoreCert"] else "",
                    "resize-method": "display-update", "disable-audio": "true", "enable-drive": "", "enable-printing": "",
                    "enable-wallpaper": "", "server-layout": p["layout"], "console": "true" if p["console"] else ""})
    if p["protocol"] in ("ssh", "telnet"):
        out.update({"font-size": "11", "color-scheme": "gray-black", "scrollback": "2000", "enable-sftp": ""})
    if p["readOnly"]:
        out["read-only"] = "true"
    return out


def handshake(g, p):
    g.send(instr("select", p["protocol"]))
    args = g.expect("args")
    g.send(instr("size", p["width"], p["height"], p["dpi"]))
    g.send(instr("audio"))
    g.send(instr("video"))
    g.send(instr("image", "image/png", "image/jpeg", "image/webp"))
    g.send(instr("timezone", p["timezone"]))
    values = connect_params(p)
    g.send(instr("connect", *[("VERSION_1_5_0" if a.startswith("VERSION_") else values.get(a, "")) for a in args]))
    p["password"] = ""
    return g.expect("ready")


# ---------------------------------------------------------------- sessions
def validate(b):
    if not isinstance(b, dict):
        raise ValueError("bad request")
    proto = str(b.get("protocol") or "")
    if proto not in PROTOCOLS:
        raise ValueError("protocol must be rdp, vnc, ssh or telnet")
    host = str(b.get("host") or "").strip()
    if not host or host.startswith("-") or not HOST_RE.match(host):
        raise ValueError("host must be an IP address or a DNS name")
    try:
        port = int(b.get("port") or PROTOCOLS[proto])
    except (TypeError, ValueError):
        raise ValueError("port must be a number") from None
    if not 1 <= port <= 65535:
        raise ValueError("port must be 1 to 65535")
    user, domain = str(b.get("user") or "").strip(), str(b.get("domain") or "").strip()
    if not USER_RE.match(user):
        raise ValueError("user name has characters that are not allowed")
    if not DOMAIN_RE.match(domain):
        raise ValueError("domain has characters that are not allowed")
    pw = b.get("password") if isinstance(b.get("password"), str) else ""
    if len(pw) > 256 or "\x00" in pw:
        raise ValueError("bad password")
    sec = str(b.get("security") or "any")
    if sec not in SECURITY:
        raise ValueError("bad RDP security mode")
    layout = str(b.get("layout") or "en-us-qwerty")
    if not re.fullmatch(r"[a-z]{2}-[a-z]{2}-[a-z]+|failsafe", layout):
        raise ValueError("bad keyboard layout")
    tz = str(b.get("timezone") or "UTC")
    if not re.fullmatch(r"[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}", tz):
        tz = "UTC"

    def clamp(v, lo, hi, d):
        try:
            return max(lo, min(hi, int(v)))
        except (TypeError, ValueError):
            return d
    return {"protocol": proto, "host": host, "port": port, "user": user, "domain": domain, "password": pw, "security": sec,
            "ignoreCert": bool(b.get("ignoreCert")), "console": bool(b.get("console")), "readOnly": bool(b.get("readOnly")),
            "layout": layout, "timezone": tz, "width": clamp(b.get("width"), 320, 7680, 1280), "height": clamp(b.get("height"), 200, 4320, 800),
            "dpi": clamp(b.get("dpi"), 48, 300, 96), "lab": str(b.get("lab") or "")[:120], "device": str(b.get("device") or "")[:120],
            "name": str(b.get("name") or "")[:80]}


def new_session(body):
    if not ENABLED:
        raise PermissionError("remote access is off because server.py listens on a network address")
    p = validate(body)
    now = time.time()
    with _lock:
        for k in [k for k, (_, exp) in _pending.items() if exp < now]:
            del _pending[k]
        if len(_live) + len(_pending) >= MAX_SESSIONS:
            raise PermissionError(f"too many remote sessions (at most {MAX_SESSIONS})")
        sid = secrets.token_urlsafe(32)
        _pending[sid] = (p, now + SID_TTL)
    return {"sid": sid}


def take_session(sid):
    with _lock:
        item = _pending.pop(sid or "", None)
    if not item or item[1] < time.time():
        return None
    return item[0]


def _audit(p, event, **kw):
    if audit_hook:
        try:
            audit_hook(p.get("lab") or "", event, dev=p["device"] or None, name=p["name"] or None, host=p["host"], protocol=p["protocol"],
                       login=p["user"] or None, **kw)  # "user" in the audit log is who ran LabTracer
        except Exception:  # noqa: BLE001
            pass


def run(ws, p):
    """Relay one session. ws: ssh_bridge.WebSocket (text frames). Blocks until it ends."""
    sid = uuid.uuid4().hex
    g = None
    started = time.time()
    state = {"done": False}

    def close_all(code=1000, reason=""):
        if state["done"]:
            return
        state["done"] = True
        if g:
            g.close()
        if reason:
            try:
                ws.send_text(instr("error", reason, "519"))
            except Exception:  # noqa: BLE001
                pass
        ws.close(code)

    try:
        g = Guacd(config())
        conn_id = handshake(g, p)
    except Exception as exc:  # noqa: BLE001
        msg = f"guacd at {config()['guacd']} is not reachable ({exc}). Start guacd, or set its address in the lab panel." \
            if isinstance(exc, OSError) else str(exc)
        _audit(p, "remote-failed", error=msg[:300])
        ws.send_text(instr("", sid))
        close_all(1000, msg)
        return
    with _lock:
        _live[sid] = {"device": p["device"], "protocol": p["protocol"], "started": started}
    _audit(p, "remote-open", connection=(conn_id or [""])[0])
    ws.send_text(instr("", sid))  # the tunnel UUID: guacamole-common-js marks the tunnel open
    if g.buf:
        _ins, rest, done = parse(g.buf)
        if done:
            g.buf = rest
            ws.send_text(done)

    def pump():
        try:
            while not state["done"]:
                text = g.read()
                if text is None:
                    break
                ws.send_text(text)
        except Exception:  # noqa: BLE001
            pass
        close_all()

    threading.Thread(target=pump, daemon=True, name="guac-pump").start()
    pending = ""
    try:
        while not state["done"]:
            op, msg = ws.recv()
            if op is None:
                break
            if op != 0x1:
                continue
            pending += msg.decode("utf-8", "replace")
            ins, pending, done = parse(pending)
            forward = []
            for e in ins:
                if e[0] == "":  # internal: the tunnel ping is answered by this server
                    if len(e) > 1 and e[1] == "ping":
                        ws.send_text(instr(*e))
                    continue
                if e[0] not in CLIENT_OPCODES:
                    raise ValueError(f"instruction {e[0][:20]!r} is not allowed from the browser")
                forward.append(instr(*e))
            if forward:
                g.send("".join(forward))
    except Exception:  # noqa: BLE001
        pass
    finally:
        close_all()
        with _lock:
            _live.pop(sid, None)
        _audit(p, "remote-close", seconds=round(time.time() - started))


def test():
    """Can server.py reach guacd? Asks for the arguments of an SSH connection (no device is contacted)."""
    g = None
    try:
        g = Guacd(config())
        g.send(instr("select", "ssh"))
        args = g.expect("args")
        return {"ok": True, "version": args[0] if args and args[0].startswith("VERSION_") else "", "guacd": config()["guacd"]}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc) or type(exc).__name__, "guacd": config()["guacd"]}
    finally:
        if g:
            g.close()
