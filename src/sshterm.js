// SPDX-License-Identifier: Apache-2.0
// Real SSH console. server.py relays a terminal between xterm.js (here)
// and the device: browser <-WebSocket-> server.py <-SSH-> device.
// Nothing secret is kept: a password (only with the per-device override)
// is sent once to server.py for one connect.
/*! xterm.js 5.5.0 and @xterm/addon-fit 0.10.0
 * Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)
 * Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)
 * Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)
 * @license MIT: full text in THIRD_PARTY_NOTICES.md */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { h } from './util.js';
import { devById } from './model.js';
import { store } from './store.js';
import { modal, toast } from './dialogs.js';
import { monitorHost } from './monitor.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
export const SSH_DEFAULTS = { host: '', port: 22, user: '', engine: '', auth: 'key', keyFile: '', legacy: false };
export const sshConf = d => Object.assign({}, SSH_DEFAULTS, d.ssh || {});
export const sshHost = d => (sshConf(d).host || monitorHost(d) || '').trim();

const enc = new TextEncoder();

export class SshManager {
  constructor(app) { this.app = app; this.sessions = new Map(); this.caps = null; }

  get available() { return store.mode === 'server'; }
  engineOf(d) { return sshConf(d).engine || this.app.settings.sshEngine || 'paramiko'; }

  async loadCaps(force = false) {
    if (!this.available) return null;
    if (this.caps && !force) return this.caps;
    try { const r = await fetch('/api/ssh/caps', { cache: 'no-store' }); if (r.ok) this.caps = await r.json(); } catch { /* keep old */ }
    return this.caps;
  }

  /** What is missing for this device's engine, or '' when it can run. */
  missing(d) {
    const c = this.caps;
    if (!this.available) return 'The SSH console needs server.py. Start LabTracer with start.bat or start.sh.';
    if (!c) return '';
    if (!c.enabled) return 'The SSH console is off because server.py listens on a network address (--host). Use the default 127.0.0.1.';
    const eng = this.engineOf(d);
    if (eng === 'paramiko' && !c.paramiko) return 'paramiko is not installed. Run "pip install paramiko" and restart server.py, or select the System ssh engine.';
    if (eng === 'system' && !c.system) return 'The ssh client was not found on this computer.';
    if (eng === 'system' && !c.pty) return c.ptyHint || 'No pseudo terminal support.';
    return '';
  }

  session(id) { return this.sessions.get(id) || null; }
  isOpen(id) { const s = this.sessions.get(id); return !!(s && s.ws && s.ws.readyState <= 1); }

  /** The persistent element for a device: toolbar + terminal. Survives inspector re-renders. */
  view(d) {
    let s = this.sessions.get(d.id);
    if (!s) {
      const term = new Terminal({
        cursorBlink: true, fontSize: 12, scrollback: 5000, convertEol: false,
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace',
        theme: { background: '#060a07', foreground: '#d5e4d9', cursor: '#5ed69a', selectionBackground: '#2c5a3d' },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      const status = h('span', { class: 'ssh-status muted small' }, 'Not connected.');
      const btnC = h('button', { class: 'btn small primary', onclick: () => this.connect(d.id) }, 'Connect');
      const btnD = h('button', { class: 'btn small', onclick: () => this.disconnect(d.id), disabled: true }, 'Disconnect');
      const box = h('div', { class: 'ssh-term' });
      const el = h('div', { class: 'ssh-wrap' }, h('div', { class: 'ssh-bar' }, btnC, btnD, status), box);
      s = { id: d.id, term, fit, el, box, status, btnC, btnD, ws: null, opened: false };
      term.onData(x => { if (s.ws && s.ws.readyState === 1 && s.up) s.ws.send(enc.encode(x)); });
      term.onBinary(x => { if (s.ws && s.ws.readyState === 1 && s.up) s.ws.send(Uint8Array.from(x, c => c.charCodeAt(0) & 255)); });
      term.onResize(({ cols, rows }) => this.sendJson(s, { type: 'resize', cols, rows }));
      s.ro = new ResizeObserver(() => this.refit(s));
      this.sessions.set(d.id, s);
    }
    setTimeout(() => this.mount(s), 0);
    return s.el;
  }
  mount(s) {
    if (!s.el.isConnected) return;
    if (!s.opened) { s.term.open(s.box); s.opened = true; s.ro.observe(s.box); s.term.writeln('\x1b[2mPress Connect to open an SSH session.\x1b[0m'); }
    this.refit(s);
  }
  refit(s) { if (s.opened && s.box.isConnected && s.box.clientWidth > 0) { try { s.fit.fit(); } catch { /* hidden */ } } }
  setStatus(s, text, cls = '') { s.status.textContent = text; s.status.className = 'ssh-status small ' + (cls || 'muted'); }
  sendJson(s, obj) { if (s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(obj)); }
  setButtons(s, busy) { s.btnC.disabled = busy; s.btnD.disabled = !busy; }

  async connect(id) {
    const d = devById(this.app.lab, id);
    const s = this.sessions.get(id);
    if (!d || !s) return;
    if (this.isOpen(id)) { s.term.focus(); return; }
    await this.loadCaps(true);
    const miss = this.missing(d);
    if (miss) { this.setStatus(s, miss, 'err'); toast(miss, 'err', 6000); return; }
    const c = sshConf(d);
    const engine = this.engineOf(d);
    const host = sshHost(d);
    if (!host) { this.setStatus(s, 'Set the SSH host, or add an IP address in the Ports tab.', 'err'); return; }
    let password = null;
    if (c.auth === 'password' && engine === 'paramiko') {
      password = await askPassword(`${c.user ? c.user + '@' : ''}${host}`);
      if (password === null) return;
    }
    this.setButtons(s, true);
    this.setStatus(s, `Connecting to ${host}…`);
    let sid, notes;
    try {
      const r = await fetch('/api/ssh/session', { method: 'POST', headers: HDR, body: JSON.stringify({ host, port: c.port, user: c.user, engine, auth: c.auth, keyFile: c.keyFile, legacy: c.legacy, lab: this.app.labName || '', device: d.id, name: d.name }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      sid = j.sid; notes = j.notices || [];
    } catch (e) {
      password = null;
      this.setButtons(s, false); this.setStatus(s, e.message, 'err'); toast('SSH: ' + e.message, 'err', 6000); return;
    }
    for (const n of notes) { s.term.writeln(`\r\n\x1b[33m! ${n}\x1b[0m`); toast(n, 'info', 7000); }
    if (c.auth === 'password') s.term.writeln('\x1b[33m! Password login (not recommended). Use a key when the device supports it.\x1b[0m');
    const ws = new WebSocket(`ws://${location.host}/api/ssh/ws?sid=${encodeURIComponent(sid)}`);
    ws.binaryType = 'arraybuffer';
    s.ws = ws; s.up = false;
    ws.onopen = () => {
      this.refit(s);
      ws.send(JSON.stringify({ type: 'init', cols: s.term.cols, rows: s.term.rows, password }));
      password = null;
    };
    ws.onmessage = ev => {
      if (typeof ev.data !== 'string') { s.term.write(new Uint8Array(ev.data)); return; }
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'status') { this.setStatus(s, m.text); s.term.writeln(`\x1b[2m${m.text}\x1b[0m`); }
      else if (m.type === 'notice') { s.term.writeln(`\x1b[33m! ${m.text}\x1b[0m`); toast(m.text, 'info', 7000); }
      else if (m.type === 'connected') {
        s.up = true; this.setStatus(s, `Connected to ${host} (${engine})`, 'ok'); s.term.focus(); this.sendJson(s, { type: 'resize', cols: s.term.cols, rows: s.term.rows });
        if (s.pending) setTimeout(() => { if (s.up && s.pending) { s.term.paste(s.pending); s.pending = null; s.term.focus(); } }, 1500); // after the login banner and prompt
      }
      else if (m.type === 'hostkey') this.askTrust(s, m);
      else if (m.type === 'error') { s.term.writeln(`\r\n\x1b[31m% ${m.text}\x1b[0m`); this.setStatus(s, m.text, 'err'); toast('SSH: ' + m.text, 'err', 7000); }
      else if (m.type === 'closed') { s.term.writeln(`\r\n\x1b[2m${m.text}\x1b[0m`); s.closedText = m.text; }
    };
    ws.onclose = () => {
      if (s.ws !== ws) return;
      s.ws = null; s.up = false; this.setButtons(s, false);
      if (!/err/.test(s.status.className)) this.setStatus(s, s.closedText || 'Disconnected.');
      s.closedText = '';
    };
    ws.onerror = () => { if (!s.up) this.setStatus(s, 'The WebSocket to server.py failed.', 'err'); };
  }

  /** Type text into the device's SSH console without pressing Enter at the end (connects first if needed).
   *  Shells with bracketed paste (bash, zsh) keep the whole text in the line editor until Enter. */
  paste(id, text) {
    const s = this.sessions.get(id);
    const t = String(text || '').replace(/\s+$/, '');
    if (!s || !t) return;
    if (s.up && this.isOpen(id)) { s.term.paste(t); s.term.focus(); return; }
    s.pending = t;
    s.term.writeln('\r\n\x1b[33m! The commands are pasted after the connection opens. Check them, then press Enter.\x1b[0m');
    this.connect(id);
  }

  askTrust(s, m) {
    let answered = false;
    const answer = ok => { if (answered) return; answered = true; this.sendJson(s, { type: 'trust', accept: ok }); };
    modal('Unknown host key', h('div', null,
      h('p', null, `LabTracer has not seen the host key of ${m.host} before.`),
      h('div', { class: 'mono-box' }, `${m.keytype}\n${m.fingerprint}`),
      h('p', { class: 'muted small' }, 'Compare the fingerprint with the one on the device (for example "ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub" or "show crypto key mypubkey"). Trust it only if they match. The key is then kept in data/ssh/known_hosts.')),
    [{ label: 'Cancel', onClick: () => answer(false) }, { label: 'Trust and connect', primary: true, onClick: () => answer(true) }],
    { onClose: () => answer(false) });
  }

  disconnect(id) {
    const s = this.sessions.get(id);
    if (s && s.ws) { try { s.ws.close(); } catch { /* ignore */ } }
  }
  /** Close sessions of devices that are no longer in the lab (or all of them). */
  prune(all = false) {
    for (const [id, s] of this.sessions) {
      if (!all && this.app.lab && devById(this.app.lab, id)) continue;
      if (s.ws) { try { s.ws.close(); } catch { /* ignore */ } }
      s.ro.disconnect(); s.term.dispose();
      this.sessions.delete(id);
    }
  }
}

export function askPassword(target, note = 'The password goes to server.py for this one connection. It is not saved.') {
  return new Promise(res => {
    let done = false;
    const inp = h('input', { class: 'inp', type: 'password', autocomplete: 'off', onkeydown: e => { if (e.key === 'Enter') { done = true; res(inp.value); m.close(); } } });
    const m = modal('SSH password', h('div', null,
      h('div', { class: 'warn small' }, 'Password login is not recommended. Use it only for legacy devices that have no key-based login.'),
      h('label', { class: 'fld' }, h('span', null, `Password for ${target}`), inp),
      h('p', { class: 'muted small' }, note)),
    [{ label: 'Cancel' }, { label: 'Connect', primary: true, onClick: () => { done = true; res(inp.value); } }],
    { onClose: () => { inp.value = ''; if (!done) res(null); } });
  });
}
