"""SSH bridge for the LabTracer console.

The browser can not open SSH connections, so server.py relays a terminal:

    xterm.js  <-- WebSocket -->  server.py (this module)  <-- SSH -->  device

Two engines:
  * "paramiko" (default): the paramiko library (pip install paramiko).
  * "system": the OpenSSH client of the OS in a pseudo terminal
    (POSIX pty, or pywinpty on Windows: pip install pywinpty).

Rules:
  * Nothing secret is stored. A password (only with the per-device
    "password" override) is used for one connect and then dropped.
  * New host keys must be confirmed by the user. A changed host key is
    always refused.
  * Off when server.py listens on a non-loopback address.
  * No shell is used. ssh is started with an argument list, and host,
    user and key path are validated first.
"""

import base64
import hashlib
import json
import os
import queue
import re
import secrets
import shutil
import struct
import sys
import threading
import time
from pathlib import Path

paramiko = None  # optional; loaded on first SSH use (it adds ~35 MB to an idle server)
_pm_lock = threading.Lock()
_pm_tried = False


def load_paramiko():
    """Import paramiko once, when the SSH console is first used. None if not installed."""
    global paramiko, _pm_tried
    with _pm_lock:
        if not _pm_tried:
            _pm_tried = True
            try:
                import paramiko as _pm  # type: ignore
                paramiko = _pm
            except Exception:  # noqa: BLE001
                paramiko = None
    return paramiko

ENABLED = True  # server.py turns this off for a non-loopback bind
DATA_DIR = Path(__file__).resolve().parent / "data"
KNOWN_HOSTS = DATA_DIR / "ssh" / "known_hosts"
HOME_SSH = Path.home() / ".ssh"

MAX_SESSIONS = 8
SID_TTL = 30            # seconds to open the WebSocket after POST /api/ssh/session
IDLE_LIMIT = 30 * 60    # close a session after 30 minutes without I/O
TRUST_WAIT = 120        # seconds to answer a host key question
MAX_FRAME = 1024 * 1024
HOST_RE = re.compile(r"^[A-Za-z0-9.\-:]{1,253}$")
USER_RE = re.compile(r"^[A-Za-z0-9._@\\-]{1,64}$")
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
LEGACY_KEX = "diffie-hellman-group14-sha1,diffie-hellman-group1-sha1,diffie-hellman-group-exchange-sha1"
LEGACY_CIPHERS = "aes128-cbc,aes256-cbc,3des-cbc"
SHA1_KEX = ["diffie-hellman-group1-sha1", "diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1"]

_lock = threading.Lock()
_pending = {}  # sid -> (params, expires)
_live = set()


# ---------------------------------------------------------------- capabilities
def system_ssh():
    if os.name == "nt":  # prefer the Windows OpenSSH client over others on PATH (Git, MSYS)
        p = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32" / "OpenSSH" / "ssh.exe"
        if p.is_file():
            return str(p)
    return shutil.which("ssh")


def pty_support():
    if os.name == "nt":
        try:
            import winpty  # type: ignore  # noqa: F401
            return True, ""
        except Exception:  # noqa: BLE001
            return False, "The system engine on Windows needs pywinpty: pip install pywinpty"
    try:
        import pty  # noqa: F401
        return True, ""
    except Exception:  # noqa: BLE001
        return False, "This system has no pseudo terminal support."


def paramiko_legacy():
    """paramiko 5 removed SHA-1 key exchange and ssh-rsa signatures."""
    if paramiko is None:
        return False
    t = paramiko.Transport
    return "diffie-hellman-group14-sha1" in getattr(t, "_kex_info", {}) and "ssh-rsa" in getattr(t, "_preferred_keys", ())


def default_keys():
    names = ("id_ed25519", "id_ecdsa", "id_rsa", "id_dsa")
    return [n for n in names if (HOME_SSH / n).is_file()]


def agent_keys():
    if paramiko is None:
        return 0
    try:
        a = paramiko.Agent()
        n = len(a.get_keys())
        a.close()
        return n
    except Exception:  # noqa: BLE001
        return 0


def known_hosts_files():
    return [str(p) for p in (HOME_SSH / "known_hosts", KNOWN_HOSTS) if p.is_file()]


def caps():
    load_paramiko()
    pty_ok, pty_hint = pty_support()
    return {
        "enabled": ENABLED,
        "paramiko": paramiko is not None,
        "paramikoVersion": getattr(paramiko, "__version__", "") if paramiko else "",
        "paramikoLegacy": paramiko_legacy(),
        "system": bool(system_ssh()),
        "pty": pty_ok,
        "ptyHint": pty_hint,
        "keysFound": default_keys(),
        "agentKeys": agent_keys(),
        "knownHosts": known_hosts_files(),
        "trustFile": str(KNOWN_HOSTS),
        "live": len(_live),
        "max": MAX_SESSIONS,
    }


# ---------------------------------------------------------------- validation and session ids
def validate(p):
    if not isinstance(p, dict):
        raise ValueError("bad request")
    load_paramiko()
    host =str(p.get("host") or "").strip()
    if not host or host.startswith("-") or not HOST_RE.match(host):
        raise ValueError("host must be an IP address or a DNS name")
    user = str(p.get("user") or "").strip()
    if user and (user.startswith("-") or not USER_RE.match(user)):
        raise ValueError("user name has characters that are not allowed")
    try:
        port = int(p.get("port") or 22)
    except (TypeError, ValueError):
        raise ValueError("port must be a number") from None
    if not 1 <= port <= 65535:
        raise ValueError("port must be 1 to 65535")
    engine = p.get("engine") or "paramiko"
    if engine not in ("paramiko", "system"):
        raise ValueError("engine must be paramiko or system")
    auth = p.get("auth") or "key"
    if auth not in ("key", "password"):
        raise ValueError("auth must be key or password")
    key = str(p.get("keyFile") or "").strip()
    if key:
        key = os.path.expanduser(key)
        if key.startswith("-") or not os.path.isfile(key):
            raise ValueError(f"key file not found: {key}")
    if engine == "paramiko" and paramiko is None:
        raise ValueError("paramiko is not installed. Run: pip install paramiko  (or select the System ssh engine)")
    if engine == "system":
        if not system_ssh():
            raise ValueError("the ssh client was not found on this computer")
        ok, hint = pty_support()
        if not ok:
            raise ValueError(hint)
    return {"host": host, "user": user, "port": port, "engine": engine, "auth": auth,
            "keyFile": key, "legacy": bool(p.get("legacy"))}


def notices(p):
    """Hints shown in the terminal before the connection starts."""
    out = []
    if p["engine"] != "paramiko":
        return out
    if p["legacy"] and not paramiko_legacy():
        out.append(f"paramiko {paramiko.__version__} has no SHA-1 key exchange and no ssh-rsa, so it can not reach "
                   "old devices that need them. Select the System ssh engine for this device.")
    if p["auth"] == "key" and not p["keyFile"] and not default_keys() and not agent_keys():
        out.append("paramiko found no SSH keys (~/.ssh/id_*) and no keys in ssh-agent. Set a key file "
                   "for this device, or select the System ssh engine.")
    if not known_hosts_files():
        out.append("paramiko found no known_hosts file. You must confirm the host key of each device. "
                   "The System ssh engine uses your OpenSSH known_hosts and ~/.ssh/config.")
    return out


def new_session(p):
    if not ENABLED:
        raise PermissionError("the SSH console is off because server.py listens on a network address")
    p = validate(p)
    now = time.time()
    with _lock:
        for k in [k for k, (_, exp) in _pending.items() if exp < now]:
            del _pending[k]
        if len(_live) + len(_pending) >= MAX_SESSIONS:
            raise PermissionError(f"too many SSH sessions (at most {MAX_SESSIONS})")
        sid = secrets.token_urlsafe(32)
        _pending[sid] = (p, now + SID_TTL)
    return {"sid": sid, "notices": notices(p)}


def take_session(sid):
    with _lock:
        item = _pending.pop(sid or "", None)
    if not item or item[1] < time.time():
        return None
    return item[0]


# ---------------------------------------------------------------- WebSocket (RFC 6455, server side)
def ws_accept(key: str) -> str:
    return base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()


class WebSocket:
    def __init__(self, rfile, wfile, sock):
        self.r, self.w, self.sock = rfile, wfile, sock
        self.wlock = threading.Lock()
        self.closed = False

    def _read(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.r.read(n - len(buf))
            if not chunk:
                raise EOFError
            buf += chunk
        return buf

    def recv(self):
        """Return (opcode, payload) of the next data message; (None, None) at close."""
        msg, op0 = b"", None
        while True:
            try:
                b1, b2 = self._read(2)
                fin, op = b1 & 0x80, b1 & 0x0F
                n = b2 & 0x7F
                if n == 126:
                    n = struct.unpack("!H", self._read(2))[0]
                elif n == 127:
                    n = struct.unpack("!Q", self._read(8))[0]
                if n > MAX_FRAME or not b2 & 0x80:  # clients must mask
                    self.close(1009 if n > MAX_FRAME else 1002)
                    return None, None
                mask = self._read(4)
                data = bytearray(self._read(n))
            except (EOFError, OSError, ValueError):
                self.closed = True
                return None, None
            for i in range(len(data)):
                data[i] ^= mask[i & 3]
            data = bytes(data)
            if op == 0x8:
                self.close()
                return None, None
            if op == 0x9:
                self._send(0xA, data)
                continue
            if op == 0xA:
                continue
            if op in (0x1, 0x2):
                op0, msg = op, data
            elif op == 0x0 and op0:
                msg += data
                if len(msg) > MAX_FRAME:
                    self.close(1009)
                    return None, None
            if fin and op0:
                return op0, msg

    def _send(self, op, data: bytes):
        n = len(data)
        if n < 126:
            hdr = struct.pack("!BB", 0x80 | op, n)
        elif n < 65536:
            hdr = struct.pack("!BBH", 0x80 | op, 126, n)
        else:
            hdr = struct.pack("!BBQ", 0x80 | op, 127, n)
        with self.wlock:
            if self.closed and op != 0x8:
                return
            try:
                self.w.write(hdr + data)
                self.w.flush()
            except OSError:
                self.closed = True

    def send_bin(self, data: bytes):
        self._send(0x2, data)

    def send_json(self, obj):
        self._send(0x1, json.dumps(obj).encode("utf-8"))

    def close(self, code=1000):
        if self.closed:
            return
        self._send(0x8, struct.pack("!H", code))
        self.closed = True
        try:
            self.sock.shutdown(2)
        except OSError:
            pass


# ---------------------------------------------------------------- engines
class ParamikoEngine:
    def __init__(self, p, ws, trust_q):
        self.p, self.ws, self.trust_q = p, ws, trust_q
        self.client = None
        self.chan = None

    def _policy(self):
        ws, trust_q = self.ws, self.trust_q

        class AskUser(paramiko.MissingHostKeyPolicy):
            def missing_host_key(self, client, hostname, key):
                fp = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip("=")
                ws.send_json({"type": "hostkey", "host": hostname, "keytype": key.get_name(), "fingerprint": "SHA256:" + fp})
                try:
                    ok = trust_q.get(timeout=TRUST_WAIT)
                except queue.Empty:
                    ok = False
                if not ok:
                    raise paramiko.SSHException("host key not trusted")
                client.get_host_keys().add(hostname, key.get_name(), key)
                KNOWN_HOSTS.parent.mkdir(parents=True, exist_ok=True)
                with open(KNOWN_HOSTS, "a", encoding="utf-8") as fh:
                    fh.write(f"{hostname} {key.get_name()} {key.get_base64()}\n")
                ws.send_json({"type": "status", "text": f"Host key saved in {KNOWN_HOSTS}"})
        return AskUser()

    def connect(self, cols, rows, password=None):
        p = self.p
        c = paramiko.SSHClient()
        self.client = c
        try:
            c.load_system_host_keys()
        except Exception:  # noqa: BLE001
            pass
        if KNOWN_HOSTS.is_file():
            c.load_host_keys(str(KNOWN_HOSTS))
        c.set_missing_host_key_policy(self._policy())
        if p["legacy"]:
            # old servers: no rsa-sha2 signatures, so sign with plain ssh-rsa
            disabled = {"pubkeys": ["rsa-sha2-512", "rsa-sha2-256"]}
        else:
            # like current OpenSSH: no SHA-1 key exchange, no ssh-rsa signatures
            t = paramiko.Transport
            disabled = {"kex": [k for k in SHA1_KEX if k in getattr(t, "_kex_info", {})],
                        "keys": [k for k in ("ssh-rsa",) if k in getattr(t, "_preferred_keys", ())],
                        "pubkeys": [k for k in ("ssh-rsa",) if k in getattr(t, "_preferred_pubkeys", ())]}
        kw = dict(hostname=p["host"], port=p["port"], username=p["user"] or None, timeout=10,
                  banner_timeout=15, auth_timeout=30, disabled_algorithms=disabled)
        if p["auth"] == "password":
            kw.update(password=password or "", look_for_keys=False, allow_agent=False)
        else:
            kw.update(key_filename=p["keyFile"] or None, look_for_keys=True, allow_agent=True)
        try:
            c.connect(**kw)
        finally:
            kw.pop("password", None)
        self.chan = c.invoke_shell(term="xterm-256color", width=cols, height=rows)

    def read(self):
        return self.chan.recv(32768)

    def write(self, data: bytes):
        self.chan.sendall(data)

    def resize(self, cols, rows):
        self.chan.resize_pty(width=cols, height=rows)

    def exit_status(self):
        return self.chan.recv_exit_status() if self.chan and self.chan.exit_status_ready() else None

    def close(self):
        for x in (self.chan, self.client):
            try:
                if x:
                    x.close()
            except Exception:  # noqa: BLE001
                pass


class SystemEngine:
    def __init__(self, p, ws, trust_q):
        self.p, self.ws = p, ws
        self.proc = None  # winpty PtyProcess on Windows
        self.pid = None
        self.fd = None

    def argv(self):
        p = self.p
        a = [system_ssh(), "-tt", "-p", str(p["port"]), "-o", "ServerAliveInterval=30"]
        if p["keyFile"]:
            a += ["-i", p["keyFile"]]
        if p["auth"] == "password":
            a += ["-o", "PreferredAuthentications=password,keyboard-interactive", "-o", "PubkeyAuthentication=no"]
        else:
            a += ["-o", "PasswordAuthentication=no", "-o", "KbdInteractiveAuthentication=no"]
        if p["legacy"]:
            a += ["-o", "KexAlgorithms=+" + LEGACY_KEX, "-o", "HostKeyAlgorithms=+ssh-rsa",
                  "-o", "PubkeyAcceptedAlgorithms=+ssh-rsa", "-o", "Ciphers=+" + LEGACY_CIPHERS]
        a += ["--", f"{p['user']}@{p['host']}" if p["user"] else p["host"]]
        return a

    def connect(self, cols, rows, password=None):
        argv = self.argv()
        self.ws.send_json({"type": "status", "text": "Running: " + " ".join(argv[1:])})
        if os.name == "nt":
            from winpty import PtyProcess  # type: ignore
            import subprocess
            self.proc = PtyProcess.spawn(subprocess.list2cmdline(argv), dimensions=(rows, cols))
        else:
            import pty
            pid, fd = pty.fork()
            if pid == 0:  # child
                try:
                    os.execv(argv[0], argv)
                finally:
                    os._exit(127)
            self.pid, self.fd = pid, fd
            self.resize(cols, rows)

    def read(self):
        if self.proc is not None:
            try:
                s = self.proc.read(32768)
            except EOFError:
                return b""
            if not s and not self.proc.isalive():
                return b""
            return s.encode("utf-8", "replace") if isinstance(s, str) else s
        try:
            return os.read(self.fd, 32768)
        except OSError:  # EIO when the child exits
            return b""

    def write(self, data: bytes):
        if self.proc is not None:
            self.proc.write(data.decode("utf-8", "replace"))
        else:
            os.write(self.fd, data)

    def resize(self, cols, rows):
        if self.proc is not None:
            self.proc.setwinsize(rows, cols)
        elif self.fd is not None:
            import fcntl
            import termios
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

    def exit_status(self):
        if self.proc is not None:
            return self.proc.exitstatus
        return None

    def close(self):
        if self.proc is not None:
            try:
                if self.proc.isalive():
                    self.proc.terminate(force=True)
            except Exception:  # noqa: BLE001
                pass
            return
        if self.pid:
            import signal
            try:
                os.kill(self.pid, signal.SIGTERM)
                for _ in range(20):
                    if os.waitpid(self.pid, os.WNOHANG)[0]:
                        break
                    time.sleep(0.05)
                else:
                    os.kill(self.pid, signal.SIGKILL)
                    os.waitpid(self.pid, 0)
            except (OSError, ChildProcessError):
                pass
            self.pid = None
        if self.fd is not None:
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None


def _clamp(v, lo, hi, dflt):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return dflt


def _err_text(exc):
    if paramiko is not None:
        if isinstance(exc, paramiko.BadHostKeyException):
            return (f"HOST KEY CHANGED for {exc.hostname}. The connection was refused. If the change is expected, "
                    f"remove the old entry from ~/.ssh/known_hosts or {KNOWN_HOSTS}.")
        if isinstance(exc, paramiko.AuthenticationException):
            return "Authentication failed: " + (str(exc) or "the device did not accept the key or password")
        if isinstance(exc, paramiko.SSHException) and "No authentication methods available" in str(exc):
            return ("No key to try: set a key file for this device, add a key to ssh-agent, "
                    "or select the System ssh engine.")
        if "Incompatible ssh peer" in str(exc) or "no acceptable" in str(exc).lower():
            return (f"{exc}. The device may use old algorithms. Turn on \"Allow legacy algorithms\" and "
                    "select the System ssh engine.")
    return str(exc) or type(exc).__name__


# ---------------------------------------------------------------- one session over one WebSocket
def run(ws: WebSocket, p):
    """Blocks until the session ends. Called on the HTTP handler thread."""
    trust_q = queue.Queue()
    eng = (ParamikoEngine if p["engine"] == "paramiko" else SystemEngine)(p, ws, trust_q)
    state = {"up": False, "last": time.time(), "done": False}
    with _lock:
        _live.add(id(ws))

    def finish(reason=None, error=None):
        if state["done"]:
            return
        state["done"] = True
        if error:
            ws.send_json({"type": "error", "text": error})
        ws.send_json({"type": "closed", "text": reason or "Connection closed."})
        eng.close()
        ws.close()

    def pump(cols, rows, password):
        try:
            ws.send_json({"type": "status", "text": f"Connecting to {p['host']}:{p['port']} ({p['engine']})…"})
            eng.connect(cols, rows, password)
        except Exception as exc:  # noqa: BLE001
            return finish("Not connected.", _err_text(exc))
        finally:
            password = None  # noqa: F841 (drop the reference)
        state["up"] = True
        ws.send_json({"type": "connected"})
        try:
            while not state["done"]:
                data = eng.read()
                if not data:
                    break
                state["last"] = time.time()
                ws.send_bin(data)
        except Exception as exc:  # noqa: BLE001
            if not state["done"]:
                return finish("Connection lost.", _err_text(exc))
        st = eng.exit_status()
        finish("Connection closed." + (f" Exit status {st}." if st not in (None, 0) else ""))

    def watchdog():
        while not state["done"]:
            time.sleep(15)
            if time.time() - state["last"] > IDLE_LIMIT:
                finish("Closed after 30 minutes without activity.")

    started = False
    threading.Thread(target=watchdog, daemon=True).start()
    try:
        while not state["done"]:
            op, msg = ws.recv()
            if op is None:
                break
            state["last"] = time.time()
            if op == 0x2:
                if state["up"]:
                    try:
                        eng.write(msg)
                    except Exception as exc:  # noqa: BLE001
                        finish("Connection lost.", _err_text(exc))
                continue
            try:
                m = json.loads(msg.decode("utf-8"))
            except Exception:  # noqa: BLE001
                continue
            t = m.get("type") if isinstance(m, dict) else None
            if t == "init" and not started:
                started = True
                cols, rows = _clamp(m.get("cols"), 10, 500, 80), _clamp(m.get("rows"), 3, 300, 24)
                pw = m.get("password") if p["auth"] == "password" and p["engine"] == "paramiko" else None
                m = None
                threading.Thread(target=pump, args=(cols, rows, pw), daemon=True).start()
                pw = None
            elif t == "resize" and state["up"]:
                try:
                    eng.resize(_clamp(m.get("cols"), 10, 500, 80), _clamp(m.get("rows"), 3, 300, 24))
                except Exception:  # noqa: BLE001
                    pass
            elif t == "trust":
                trust_q.put(bool(m.get("accept")))
    finally:
        trust_q.put(False)  # free a waiting host key question
        state["done"] = True
        eng.close()
        ws.close()
        with _lock:
            _live.discard(id(ws))


if __name__ == "__main__":
    json.dump(caps(), sys.stdout, indent=1)
    print()
