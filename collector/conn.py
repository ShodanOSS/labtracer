"""SSH connections for the collector: run commands and read their output.

Uses ssh_bridge.open_client, so the collector and the console use the same
algorithms, keys and known_hosts files. Rules:
  * An unknown host key is never trusted silently. The job reports the
    fingerprint; the user confirms it in the GUI and the run is repeated
    with that fingerprint (trust=...). A changed host key is always refused.
  * Passwords are used for one connect and never written anywhere.
"""

import re
import time

import ssh_bridge

MAX_OUTPUT = 4 * 1024 * 1024  # bytes per command; a running-config is far smaller
CMD_TIMEOUT = 30


class HostKeyUnknown(Exception):
    def __init__(self, host, keytype, fp):
        super().__init__(f"unknown host key for {host}")
        self.host, self.keytype, self.fingerprint = host, keytype, fp


def _policy(trust_fp):
    pm = ssh_bridge.paramiko

    class TrustOnce(pm.MissingHostKeyPolicy):
        def missing_host_key(self, client, hostname, key):
            fp = ssh_bridge.fingerprint(key)
            if trust_fp and trust_fp == fp:
                ssh_bridge.remember_host_key(client, hostname, key)
                return
            raise HostKeyUnknown(hostname, key.get_name(), fp)
    return TrustOnce()


class Session:
    """One SSH connection to a device."""

    def __init__(self, client):
        self.client = client
        self._shell = None

    @classmethod
    def open(cls, p, password=None, trust=None):
        if ssh_bridge.load_paramiko() is None:
            raise ValueError("paramiko is not installed. Run: pip install paramiko")
        return cls(ssh_bridge.open_client(p, password, _policy(trust)))

    def run(self, cmd, timeout=CMD_TIMEOUT):
        """Run one command (exec channel, no pty). Returns (exit status, stdout, stderr) as text."""
        chan = self.client.get_transport().open_session(timeout=10)
        chan.settimeout(timeout)
        chan.exec_command(cmd)
        out, err = bytearray(), bytearray()
        end = time.time() + timeout
        while True:
            if chan.recv_ready():
                out += chan.recv(65536)
            if chan.recv_stderr_ready():
                err += chan.recv_stderr(65536)
            if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
                break
            if len(out) > MAX_OUTPUT:
                chan.close()
                raise ValueError(f"too much output from: {cmd[:40]}")
            if time.time() > end:
                chan.close()
                raise TimeoutError(f"no answer within {timeout} s: {cmd[:40]}")
            time.sleep(0.02)
        st = chan.recv_exit_status()
        chan.close()
        return st, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")

    def shell(self):
        """An interactive CLI (network devices whose exec channel is limited)."""
        if self._shell is None:
            self._shell = Shell(self.client.invoke_shell(term="vt100", width=511, height=1000))
        return self._shell

    def close(self):
        try:
            self.client.close()
        except Exception:  # noqa: BLE001
            pass


PROMPT_RE = re.compile(r"(?m)^([A-Za-z0-9_.\-:/()@]{1,63}[>#$%])\s*$")
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][A-Za-z0-9]|\r")
MORE_RE = re.compile(r"\s*-+\s*More\s*-+\s*$|<--- More --->\s*$", re.I)


class Shell:
    """Line-mode CLI over an interactive channel. Finds the prompt, then runs one
    command at a time and returns its output without the echo and the prompt."""

    def __init__(self, chan):
        self.chan = chan
        self.chan.settimeout(0.2)
        self.prompt = ""
        self.buf = ""
        self._wait_prompt(initial=True)

    def _recv(self):
        try:
            data = self.chan.recv(65536)
        except Exception:  # noqa: BLE001  (socket.timeout)
            return None
        if data == b"":
            raise ConnectionError("the device closed the session")
        return ANSI_RE.sub("", data.decode("utf-8", "replace"))

    def _wait_prompt(self, initial=False, timeout=CMD_TIMEOUT):
        end = time.time() + timeout
        text = ""
        quiet_since = time.time()
        if initial:
            self.chan.send("\n")
        while time.time() < end:
            chunk = self._recv()
            if chunk:
                text += chunk
                quiet_since = time.time()
                if len(text) > MAX_OUTPUT:
                    raise ValueError("too much output")
                if MORE_RE.search(text):  # pager is on: ask for the next page
                    text = MORE_RE.sub("", text)
                    self.chan.send(" ")
                    continue
            tail = text.rstrip(" ").rsplit("\n", 1)[-1]
            if initial:
                m = PROMPT_RE.search(tail)
                if m and time.time() - quiet_since > 0.3:
                    self.prompt = m.group(1)
                    return text
            elif self.prompt and tail.strip() == self.prompt:
                return text
            elif self.prompt and tail.strip().startswith(self.base) and tail.strip()[-1:] in ">#" and time.time() - quiet_since > 0.5:
                self.prompt = tail.strip()  # mode change, for example config mode
                return text
        if initial:
            raise TimeoutError("no CLI prompt from the device")
        raise TimeoutError("the command did not finish")

    @property
    def base(self):
        return re.split(r"[(>#$%]", self.prompt, maxsplit=1)[0]

    @property
    def privileged(self):
        return self.prompt.endswith("#")

    def cmd(self, command, timeout=CMD_TIMEOUT):
        self.chan.send(command + "\n")
        text = self._wait_prompt(timeout=timeout)
        lines = text.split("\n")
        if lines and command.strip() and command.strip() in lines[0]:
            lines = lines[1:]  # echo
        if lines and lines[-1].strip() == self.prompt:
            lines = lines[:-1]
        return "\n".join(lines).strip("\n")
