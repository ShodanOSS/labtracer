"""Driver registry. A driver is a module with NAME and collect(session) -> facts.

Phase 1 reads Linux (incl. Proxmox and BusyBox/DD-WRT) and Cisco IOS.
The other names are known so the GUI can offer them; they report "not yet supported".
"""

from . import ios, linux

REGISTRY = {linux.NAME: linux, ios.NAME: ios}
PLANNED = ("routeros", "windows", "opnsense", "unifi")
ALL = ("auto",) + tuple(REGISTRY) + PLANNED


def detect(sess):
    """Find the driver for a device: an exec 'uname -s' answers on Unix-like systems;
    an IOS-style CLI answers with '% Invalid input'."""
    try:
        _st, out, err = sess.run("uname -s", timeout=15)
    except Exception:  # noqa: BLE001  (some devices refuse exec channels)
        out, err = "", ""
    text = (out + err).strip()
    first = text.splitlines()[0].strip() if text else ""
    if first == "Linux":
        return linux
    if first == "FreeBSD":
        raise ValueError("this looks like FreeBSD (OPNsense or pfSense). That driver is not supported yet.")
    if "Invalid input" in text or "% Unknown command" in text or "% Ambiguous" in text:
        return ios
    if "bad command name" in text or "expected end of command" in text:
        raise ValueError("this looks like MikroTik RouterOS. That driver is not supported yet.")
    if "is not recognized as an internal or external command" in text:
        raise ValueError("this looks like Windows. That driver is not supported yet.")
    try:
        sh = sess.shell()
        ans = sh.cmd("show version", timeout=15)
        if "Cisco" in ans or "IOS" in ans:
            return ios
    except Exception:  # noqa: BLE001
        pass
    raise ValueError("could not detect the platform. Select the driver in the Drift tab.")


def get(name):
    if name in REGISTRY:
        return REGISTRY[name]
    if name in PLANNED:
        raise ValueError(f"the {name} driver is not supported yet")
    raise ValueError(f"unknown driver: {name}")
