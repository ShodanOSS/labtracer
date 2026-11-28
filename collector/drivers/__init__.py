# SPDX-License-Identifier: Apache-2.0
"""Driver registry.

A driver is a module with:
  NAME                                  "linux", "ios", "routeros"
  collect(sess) -> facts                read-only (facts.py)
  render(ops, facts=None)               validated operations (ops.py) -> (commands, notes[, extra])
Optional, for pushing changes:
  apply(sess, cmds, save, armed, extra, facts) -> (ok, transcript)
  backup(sess, backup_id, facts) -> {config, files, archive, onDevice}   before every apply
  ROLLBACK                              text: how the device rolls back by itself
  arm(sess, backup, minutes, extra, facts) -> (token | None, transcript) start the rollback timer
  confirm(sess, token, facts) -> (ok, transcript)                        stop it: the change stays
  persist(sess, facts) -> (ok, transcript)   save to startup config (IOS); others keep changes at once
  restore(sess, backup, facts) -> (ok, transcript)                       put a backup back

Windows, OPNsense and UniFi are known so the GUI can name them; they report "not yet supported".
"""

import inspect

from . import ios, linux, routeros

REGISTRY = {linux.NAME: linux, ios.NAME: ios, routeros.NAME: routeros}
PLANNED = ("windows", "opnsense", "unifi")
ALL = ("auto",) + tuple(REGISTRY) + PLANNED


def detect(sess):
    """Find the driver for a device: an exec 'uname -s' answers on Unix-like systems;
    an IOS-style CLI answers with '% Invalid input'; RouterOS with 'bad command name'."""
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
        return routeros
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


def render(drv, ops, facts=None):
    """(commands, notes, extra) for any driver. extra: {files, undo, canApply}."""
    takes_facts = "facts" in inspect.signature(drv.render).parameters
    r = drv.render(ops, facts) if takes_facts else drv.render(ops)
    cmds, notes = r[0], r[1]
    extra = dict(r[2]) if len(r) > 2 else {}
    extra.setdefault("files", [])
    extra.setdefault("undo", [])
    extra.setdefault("canApply", hasattr(drv, "apply"))
    return cmds, notes, extra


def safety(drv):
    """What this driver can do around a change, for the review dialog."""
    return {"backup": hasattr(drv, "backup"), "rollback": getattr(drv, "ROLLBACK", "") if hasattr(drv, "arm") else "",
            "restore": hasattr(drv, "restore"), "save": hasattr(drv, "persist")}


def call(fn, *args, **kw):
    """Call a driver function with only the keyword arguments it takes (older drivers take fewer)."""
    params = inspect.signature(fn).parameters
    if any(p.kind == p.VAR_KEYWORD for p in params.values()):
        return fn(*args, **kw)
    return fn(*args, **{k: v for k, v in kw.items() if k in params})
