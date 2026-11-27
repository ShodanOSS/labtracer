// Remote access over Apache Guacamole: RDP, VNC, SSH and Telnet in a window of the app.
//   browser (Guacamole client, app/guac.js) <-WebSocket-> server.py (guac.py) <-TCP-> guacd <-> device
// app/guac.js loads on the first session only. A session lives in a floating window that
// can be moved, resized (RDP follows the size) and kept open while you work in the app.
// The password goes to server.py once and is never stored.
import { h } from './util.js';
import { store } from './store.js';
import { toast } from './dialogs.js';
import { sshHost, askPassword } from './sshterm.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
export const PROTOCOLS = [['rdp', 'RDP (Windows)', 3389], ['vnc', 'VNC', 5900], ['ssh', 'SSH (in Guacamole)', 22], ['telnet', 'Telnet', 23]];
export const REMOTE_DEFAULTS = { protocol: 'rdp', host: '', port: 0, user: '', domain: '', security: 'any', ignoreCert: false, layout: 'en-us-qwerty', readOnly: false, console: false };
export const remoteConf = d => Object.assign({}, REMOTE_DEFAULTS, d.remote || {});
export const remoteHost = d => (remoteConf(d).host || sshHost(d) || '').trim();
export const defaultPort = proto => (PROTOCOLS.find(p => p[0] === proto) || PROTOCOLS[0])[2];
const STATES = ['idle', 'connecting', 'waiting', 'connected', 'disconnecting', 'disconnected'];
const KEY = { ctrl: 0xffe3, alt: 0xffe9, del: 0xffff, win: 0xffeb };

let libPromise = null;
function loadLib() {
  if (window.Guacamole) return Promise.resolve(window.Guacamole);
  libPromise ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'guac.js';
    s.onload = () => (window.Guacamole ? res(window.Guacamole) : rej(new Error('guac.js did not load')));
    s.onerror = () => { libPromise = null; rej(new Error('could not load guac.js')); };
    document.head.appendChild(s);
  });
  return libPromise;
}

export class RemoteManager {
  constructor(app) { this.app = app; this.sessions = new Map(); this.caps = null; this.z = 50; }
  get available() { return store.mode === 'server'; }
  isOpen(id) { return this.sessions.has(id); }

  async loadCaps() {
    if (!this.available) return null;
    try { const r = await fetch('/api/remote/caps', { cache: 'no-store' }); if (r.ok) this.caps = await r.json(); } catch { /* keep */ }
    return this.caps;
  }

  /** Open (or bring to the front) the remote window of a device. */
  async open(d) {
    if (!this.available) { toast('Remote access needs server.py', 'warn'); return; }
    const old = this.sessions.get(d.id);
    if (old) { this.front(old); return; }
    const c = remoteConf(d), host = remoteHost(d);
    if (!host) { toast('No address: set the host in the Remote form, or an IP in the Ports tab', 'err'); return; }
    const who = `${c.user ? c.user + '@' : ''}${host}`;
    const password = await askPassword(`${who} (${c.protocol.toUpperCase()})`,
      'Sent to server.py for this connection only; it is not saved. Leave it empty to log in on the remote screen' + (c.protocol === 'vnc' ? ' (or for a VNC server without a password).' : '.'));
    if (password === null) return;
    let G;
    try { G = await loadLib(); } catch (e) { toast(e.message, 'err'); return; }
    const win = this.window(d, `${d.name} · ${c.protocol.toUpperCase()} ${who}`);
    const box = win.body.getBoundingClientRect();
    let sid;
    try {
      const r = await fetch('/api/remote/session', { method: 'POST', headers: HDR, body: JSON.stringify({
        protocol: c.protocol, host, port: +c.port || defaultPort(c.protocol), user: c.user, domain: c.domain, security: c.security,
        ignoreCert: c.ignoreCert, readOnly: c.readOnly, console: c.console, layout: c.layout, password,
        width: Math.round(box.width), height: Math.round(box.height), dpi: Math.round(96 * (window.devicePixelRatio || 1)),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, lab: this.app.labName, device: d.id, name: d.name }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      sid = j.sid;
    } catch (e) { win.remove(); toast('Remote: ' + e.message, 'err', 6000); return; }
    const client = new G.Client(new G.WebSocketTunnel('/api/remote/ws'));
    const s = { id: d.id, win, client, G, state: 'connecting', fit: true };
    this.sessions.set(d.id, s);
    const display = client.getDisplay();
    win.body.appendChild(display.getElement());
    display.onresize = () => this.scale(s);
    client.onstatechange = st => { s.state = STATES[st] || String(st); win.status.textContent = s.state; if (st === 5) this.closed(s); this.app.inspector?.render(); };
    client.onerror = st => { win.status.textContent = 'error'; toast(`Remote ${d.name}: ${st.message || 'error ' + st.code}`, 'err', 7000); };
    client.onclipboard = (stream, mime) => {
      if (!/^text\//.test(mime)) return;
      const rd = new G.StringReader(stream); let text = '';
      rd.ontext = t => { text += t; };
      rd.onend = () => { s.clip = text; navigator.clipboard?.writeText(text).catch(() => {}); };
    };
    const mouse = new G.Mouse(display.getElement());
    mouse.onEach(['mousedown', 'mouseup', 'mousemove'], e => { win.focus.focus({ preventScroll: true }); client.sendMouseState(e.state, true); });
    const kb = new G.Keyboard(win.focus);
    kb.onkeydown = k => { client.sendKeyEvent(1, k); return false; };
    kb.onkeyup = k => client.sendKeyEvent(0, k);
    s.kb = kb;
    new ResizeObserver(() => { const b = win.body.getBoundingClientRect(); if (s.state === 'connected' && b.width > 50) { clearTimeout(s.rt); s.rt = setTimeout(() => client.sendSize(Math.round(b.width), Math.round(b.height)), 300); } this.scale(s); }).observe(win.body);
    client.connect('sid=' + encodeURIComponent(sid));
    win.focus.focus();
  }

  scale(s) {
    const d = s.client.getDisplay(), b = s.win.body.getBoundingClientRect();
    if (!d.getWidth() || !d.getHeight()) return;
    d.scale(s.fit ? Math.min(b.width / d.getWidth(), b.height / d.getHeight(), 1) : 1);
  }

  keys(s, ...syms) { for (const k of syms) s.client.sendKeyEvent(1, k); for (const k of syms.reverse()) s.client.sendKeyEvent(0, k); }

  sendClipboard(s, text) {
    const w = new s.G.StringWriter(s.client.createClipboardStream('text/plain'));
    w.sendText(text); w.sendEnd();
  }

  closed(s) {
    if (s.gone) return;
    s.gone = true;
    s.kb?.reset?.();
    this.sessions.delete(s.id);
    s.win.status.textContent = 'disconnected';
    s.win.el.classList.add('ended');
    this.app.inspector?.render();
  }
  disconnect(id) { const s = this.sessions.get(id); if (s) { try { s.client.disconnect(); } catch { /* closed */ } this.closed(s); } }
  /** Close sessions of devices that are gone (another lab opened, device deleted). */
  prune(all = false) { for (const id of [...this.sessions.keys()]) if (all || !this.app.lab.devices.some(d => d.id === id)) { this.disconnect(id); this.sessions.get(id)?.win.remove(); } }
  front(s) { s.win.el.style.zIndex = ++this.z; s.win.focus.focus(); }

  window(d, title) {
    const status = h('span', { class: 'rwin-st muted small' }, 'connecting');
    const body = h('div', { class: 'rwin-body' });
    const focus = h('div', { class: 'rwin-focus', tabindex: 0, title: 'Click the screen to type into the remote session' }, body);
    const btn = (label, title, fn) => h('button', { class: 'mini txt', title, onclick: e => { e.stopPropagation(); const s = this.sessions.get(d.id); if (s) fn(s); } }, label);
    const el = h('div', { class: 'rwin', style: { zIndex: ++this.z } },
      h('div', { class: 'rwin-head' }, h('span', { class: 'rwin-title' }, title), status,
        btn('Ctrl+Alt+Del', 'Send Ctrl+Alt+Del', s => this.keys(s, KEY.ctrl, KEY.alt, KEY.del)),
        btn('Win', 'Send the Windows key', s => this.keys(s, KEY.win)),
        btn('Paste…', 'Send text to the remote clipboard', async s => {
          let t = ''; try { t = await navigator.clipboard.readText(); } catch { t = prompt('Text for the remote clipboard') || ''; }
          if (t) { this.sendClipboard(s, t); toast('Sent to the remote clipboard', 'ok', 1500); }
        }),
        btn('Fit', 'Scale the screen to the window, or show it at 100%', s => { s.fit = !s.fit; this.scale(s); }),
        h('button', { class: 'mini', title: 'Disconnect and close', onclick: () => { this.disconnect(d.id); el.remove(); } }, '×')),
      focus);
    el.addEventListener('mousedown', () => { el.style.zIndex = ++this.z; });
    const head = el.firstChild;
    head.addEventListener('mousedown', e => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = ev => { el.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
      addEventListener('mousemove', move); addEventListener('mouseup', up);
    });
    const n = this.sessions.size;
    el.style.left = `${80 + n * 30}px`; el.style.top = `${70 + n * 30}px`;
    document.body.appendChild(el);
    return { el, body, focus, status, remove: () => el.remove() };
  }
}
