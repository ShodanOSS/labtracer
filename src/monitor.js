// Live status from the LabTracer check agent (agent/labtracer_agent.py).
// LabTracer sends the agent a target list built from the lab, then polls
// its results through server.py (the page itself never talks to the agent).
import { parseCIDR } from './util.js';
import { toast } from './dialogs.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };

export function monitorConf(d) {
  const hasIp = d.ports.some(p => p.enabled && p.ip && parseCIDR(p.ip));
  return Object.assign({ enabled: hasIp && !d.logical && !d.physicalOnly, host: '', ping: true, services: true }, d.monitor || {});
}
export function monitorHost(d) {
  const c = monitorConf(d);
  if (c.host) return c.host.trim();
  const p = d.ports.find(p => p.enabled && p.ip && parseCIDR(p.ip));
  return p ? p.ip.split('/')[0] : '';
}
/** "389,636/tcp, 51880/udp" -> [389, 636] (UDP can not be checked by connect). */
export function tcpPorts(spec) {
  const out = [];
  for (const part of String(spec || '').split(/[,\s]+/)) {
    const m = /^(\d{1,5})(?:\/(tcp|udp))?$/i.exec(part.trim());
    if (m && (!m[2] || m[2].toLowerCase() === 'tcp')) { const n = +m[1]; if (n >= 1 && n <= 65535) out.push(n); }
  }
  return out;
}
export function deviceChecks(d) {
  const c = monitorConf(d), host = monitorHost(d);
  if (!c.enabled || !host) return [];
  const checks = [];
  if (c.ping) checks.push({ type: 'ping', host });
  if (c.services) for (const s of d.services) if (s.enabled !== false) for (const port of tcpPorts(s.port)) checks.push({ type: 'tcp', host, port, label: s.name });
  return checks;
}
export function buildTargets(lab) {
  return lab.devices.map(d => ({ id: d.id, name: d.name, checks: deviceChecks(d) })).filter(t => t.checks.length);
}

export class Monitor {
  constructor(app) {
    this.app = app;
    this.config = { agentUrl: '', hasToken: false };
    this.status = null;
    this.error = '';
    this.live = false;
    this.timer = null;
    this.pushTimer = null;
  }
  get available() { return this.app.store.mode === 'server'; }

  async loadConfig() {
    if (!this.available) return;
    try { this.config = await (await fetch('/api/monitor/config', { cache: 'no-store' })).json(); } catch { /* ignore */ }
  }
  async saveConfig(c) {
    const r = await fetch('/api/monitor/config', { method: 'PUT', headers: HDR, body: JSON.stringify(c) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
    await this.loadConfig();
  }
  async push(quiet = false) {
    const targets = buildTargets(this.app.lab);
    const r = await fetch('/api/monitor/targets', { method: 'POST', headers: HDR, body: JSON.stringify({ targets }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    if (!quiet) toast(`Agent now checks ${j.targets} device(s)`, 'ok');
    return j;
  }
  schedulePush() {
    if (!this.live) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(true).then(() => setTimeout(() => this.poll(), 1500)).catch(e => this.fail(e)), 2500);
  }
  async poll() {
    try {
      const r = await fetch('/api/monitor/status', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      this.status = j; this.error = ''; this.receivedAt = Date.now();
    } catch (e) { this.fail(e, true); }
    this.app.onMonitorStatus();
  }
  fail(e, quiet) { this.error = e.message || String(e); if (!quiet) toast('Monitoring: ' + this.error, 'err', 4000); }

  async start() {
    if (!this.available) { toast('Live status needs server.py (it is not available when index.html is opened directly)', 'warn', 4500); return false; }
    if (!this.config.agentUrl) { toast('Set the agent address first: click empty space, then the Monitoring section', 'warn', 4500); this.app.select(null); return false; }
    try { await this.push(true); } catch (e) { this.fail(e); this.app.onMonitorStatus(); return false; }
    this.live = true;
    await this.poll();
    setTimeout(() => { if (this.live) this.poll(); }, 3000); // first run after new targets takes a moment
    const every = Math.max(5, Math.min(120, this.status?.interval || 30)) * 1000;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.poll(), every);
    return true;
  }
  stop() { this.live = false; clearInterval(this.timer); this.timer = null; this.status = null; this.app.onMonitorStatus(); }

  /** devId -> state, with staleness applied */
  states() {
    const s = this.status; const out = new Map();
    if (!this.live || !s) return out;
    // Age on the agent's own clock (s.now) plus time since we got it, so clock skew between hosts does not matter.
    const age = (s.now ? s.now - s.generated : Date.now() / 1000 - s.generated) + (Date.now() - (this.receivedAt || Date.now())) / 1000;
    const stale = s.generated && age > 3 * (s.interval || 30) + 10;
    for (const [id, v] of Object.entries(s.devices || {})) out.set(id, stale ? 'unknown' : v.state);
    return out;
  }
  device(id) { return this.live && this.status ? this.status.devices?.[id] || null : null; }
}

/** Tiny SVG sparkline of latency history: [[ts, ok, total, ms], ...] */
export function sparkline(hist, w = 300, h = 46) {
  if (!hist || hist.length < 2) return '';
  const ms = hist.map(x => x[3]).filter(x => x !== null);
  const max = Math.max(1, ...ms);
  const step = w / (hist.length - 1);
  let d = ''; let pen = false;
  hist.forEach((x, i) => {
    if (x[3] === null) { pen = false; return; }
    const y = h - 8 - (x[3] / max) * (h - 14);
    d += (pen ? 'L' : 'M') + (i * step).toFixed(1) + ' ' + y.toFixed(1); pen = true;
  });
  const bars = hist.map((x, i) => {
    const c = x[2] === 0 ? '#555' : x[1] === x[2] ? '#38e07a' : x[1] === 0 ? '#ff6b5c' : '#ffb347';
    return `<rect x="${(i * step - step / 2).toFixed(1)}" y="${h - 4}" width="${Math.max(1, step).toFixed(1)}" height="4" fill="${c}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#5ed69a" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${bars}<text x="2" y="10" fill="#84a08c" font-size="9">${max.toFixed(1)} ms</text></svg>`;
}
