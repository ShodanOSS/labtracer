// SPDX-License-Identifier: Apache-2.0
// Discovery: find the devices of an unknown network and add them to the lab.
//   GUI --POST /api/discover/<lab> {ranges, ssh, crawl...}--> server.py (collector/discover.py):
//        sweep, names, SSH read with the collector drivers, crawl LLDP/CDP and ARP tables
//       <-- result: hosts with open ports, MACs, and the facts of the devices it could read
//   buildFromDiscovery(): devices (template from what was found), ports, addresses, VLANs, routes,
//        services, VMs; cables from LLDP/CDP, then from switch MAC tables (a port that learned one
//        known MAC is cabled to it; several known MACs behind one port get an unmanaged switch).
//   --POST /api/discover/<lab>/adopt {map: {ip: device id}}: their facts become drift facts.
// buildFromDiscovery() is pure (no DOM): tests/discover.test.mjs runs it in Node.
import { h, parseCIDR, intToIp } from './util.js';
import { createDevice, makePort, uniqueName, linksOfPort, NON_IP } from './model.js';
import { BUILTIN } from './templates.js';
import { compareDevice, portFromFact, cable, normMac, normPort, NOISE } from './drift.js';
import { modal, toast } from './dialogs.js';
import { l3Ifaces } from './netsim.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
// accept actions of the drift report that fill in a new device (never ones that remove something)
const FILL = /^(inv-|mac:|vlan-extra:|route-extra:|svc-open:|guest-extra:|iface-extra:|ip-new:)/;
const TIER = { 'Network': 1, 'Compute': 2, 'Storage': 2, 'Virtual': 3 };
export const TEMPLATES = [
  ['net-router-rack', 'Router'], ['net-router-home', 'Home router / gateway'], ['net-firewall', 'Firewall'],
  ['net-switch-24', 'Switch 24-port'], ['net-switch-48', 'Switch 48-port'], ['net-switch-l3', 'L3 switch'], ['net-switch-l3-48', 'L3 switch 48-port'],
  ['net-ap', 'Access point'], ['cmp-2u', 'Server / hypervisor'], ['cmp-1u', 'Rack server'], ['cmp-mini', 'Mini PC / Linux host'],
  ['cmp-tower', 'PC (Windows)'], ['cmp-sbc', 'Raspberry Pi'], ['sto-nas4', 'NAS'], ['sto-nas2', 'NAS 2-bay'], ['end-printer', 'Printer'],
  ['end-camera', 'IP camera'], ['iot-hub', 'Smart home hub'], ['end-tv', 'Smart TV'], ['end-phone', 'Phone / tablet'], ['end-iot', 'IoT / other'],
];

/** The template that fits what discovery found on a host. */
export function classify(hst) {
  const f = hst.facts, p = new Set(hst.ports || []);
  if (f) {
    const txt = `${f.system?.os || ''} ${f.system?.model || ''} ${f.system?.vendor || ''}`.toLowerCase();
    const phys = (f.interfaces || []).filter(i => ['eth', 'sfp'].includes(i.kind) && !/\./.test(i.name)).length;
    if (f.driver === 'ios') {
      if (!Array.isArray(f.vlans)) return 'net-router-rack';
      const l3 = (f.routes || []).length > 0 && (f.interfaces || []).filter(i => i.kind === 'svi' && (i.ips || []).length).length > 1;
      return phys > 30 ? (l3 ? 'net-switch-l3-48' : 'net-switch-48') : (l3 ? 'net-switch-l3' : 'net-switch-24');
    }
    if (f.driver === 'routeros') return /crs|css/.test(txt) ? 'net-switch-24' : 'net-router-rack';
    if (Array.isArray(f.guests) || /proxmox/.test(txt)) return 'cmp-2u';
    if (/raspberry/.test(txt)) return 'cmp-sbc';
    if (/dd-wrt|openwrt|edgeos|vyos/.test(txt)) return 'net-router-home';
    if (/synology|truenas|unraid|qnap|openmediavault/.test(txt)) return 'sto-nas4';
    if (/poweredge|proliant|thinksystem|supermicro|sys-\d|primergy/.test(txt)) return 'cmp-1u';
    return 'cmp-mini';
  }
  if (p.has(8006)) return 'cmp-2u';
  if (p.has(8291)) return 'net-router-rack';
  if (p.has(9100) || p.has(631) || p.has(515)) return 'end-printer';
  if (p.has(554)) return 'end-camera';
  if (p.has(5000) || p.has(5001)) return 'sto-nas2';
  if (p.has(3389) || p.has(445) || p.has(139)) return 'cmp-tower';
  if (p.has(1883) || p.has(8123) || p.has(8883)) return 'iot-hub';
  if (p.has(53) && (p.has(80) || p.has(443))) return 'net-router-home';
  if (p.has(22)) return 'cmp-mini';
  return 'end-iot';
}

/** A name for a host: its hostname, its reverse DNS name, or host-<address>. */
export function hostName(hst) {
  const n = String(hst.facts?.system?.hostname || hst.rdns || '').split('.')[0].replace(/[^A-Za-z0-9._-]+/g, '-');
  return n || `host-${hst.ip.split('.').slice(2).join('-')}`;
}

/** The lab device a host already is (same address, MAC or name), or null. */
export function findInLab(lab, hst) {
  const mac = normMac(hst.mac);
  const name = hostName(hst).toLowerCase();
  for (const d of lab.devices) {
    if (d.ports.some(p => p.ip && p.ip.split('/')[0] === hst.ip)) return d;
    if ((d.ssh?.host || d.monitor?.host) === hst.ip) return d;
  }
  if (mac) for (const d of lab.devices) if (d.ports.some(p => normMac(p.mac) === mac)) return d;
  if (hst.facts) return lab.devices.find(d => d.name.toLowerCase() === name) || null;
  return null;
}

function prefixFor(result, ip) {
  for (const hst of result.hosts || []) for (const i of hst.facts?.interfaces || []) for (const a of i.ips || []) {
    const c = parseCIDR(a), t = parseCIDR(ip + '/32');
    if (c && t && c.prefix >= 8 && ((t.ip & c.mask) >>> 0) === c.net) return c.prefix;
  }
  for (const r of result.ranges || []) { const c = parseCIDR(r), t = parseCIDR(ip + '/32'); if (c && t && ((t.ip & c.mask) >>> 0) === c.net) return c.prefix; }
  return 24;
}

/** Make a device from a discovered host and add it to the lab. */
function addHost(lab, result, hst, tplId, name, pos, ssh) {
  const tpl = BUILTIN.find(t => t.id === tplId) || BUILTIN.find(t => t.id === 'end-iot');
  const d = createDevice(tpl, { name: uniqueName(lab, name), x: pos.x, z: pos.z });
  d.ports = d.ports.filter(p => NON_IP.has(p.kind)); // power, console: data ports come from the device
  lab.devices.push(d);
  const f = hst.facts;
  if (f) {
    const ifs = (f.interfaces || []).filter(i => i.name && !NOISE.test(i.name) && i.kind !== 'loop');
    for (const fi of ifs) {
      const phys = ['eth', 'sfp'].includes(fi.kind) && !fi.name.includes('.');
      if (phys || (fi.ips || []).length || (fi.adminUp && fi.operUp && !fi.master)) d.ports.push(portFromFact(d, fi));
    }
    for (const it of compareDevice(lab, d, f)) if (it.accept && FILL.test(it.key)) it.accept.run(lab, d);
    d.ssh = { host: hst.ip, port: ssh.port || 22, user: ssh.user || '', engine: '', auth: ssh.auth || 'key', keyFile: ssh.keyFile || '', legacy: !!ssh.legacy };
    d.collect = { enabled: true, driver: f.driver || 'auto', ignore: [] };
    if (f.driver === 'ios' && Array.isArray(f.vlans)) d.l2 = true;
    if ((f.routes || []).length && (f.driver !== 'linux' || tplId.startsWith('net-'))) d.l3 = true;
  } else {
    d.ports.unshift(makePort({ name: 'eth0', ip: `${hst.ip}/${prefixFor(result, hst.ip)}`, mac: normMac(hst.mac) }));
    for (const port of hst.ports || []) if (port !== 22 || tplId.startsWith('cmp')) d.services.push({ name: SERVICE[port] || `tcp-${port}`, port: String(port), enabled: true, notes: 'found by discovery' });
    if ((hst.ports || []).includes(22)) d.ssh = { host: hst.ip, port: 22, user: ssh.user || '', engine: '', auth: ssh.auth || 'key', keyFile: ssh.keyFile || '', legacy: !!ssh.legacy };
  }
  if (hst.rdns && hst.rdns.split('.')[0] !== d.name) d.attrs.push({ k: 'DNS', v: hst.rdns });
  d.notes = `Found by discovery (${hst.via === 'scan' ? 'sweep' : hst.via}) at ${hst.ip}.`;
  return d;
}
const SERVICE = { 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http', 139: 'netbios', 443: 'https', 445: 'smb', 515: 'lpd', 554: 'rtsp', 631: 'ipp',
  1883: 'mqtt', 3306: 'mysql', 3389: 'rdp', 5000: 'web', 5001: 'web-tls', 5432: 'postgres', 5900: 'vnc', 8006: 'proxmox', 8080: 'http-alt', 8123: 'home-assistant',
  8291: 'winbox', 8443: 'https-alt', 8883: 'mqtts', 9090: 'cockpit', 9100: 'printer' };

/** A free data port of a device whose MAC is mac (or its only data port). */
function portWithMac(lab, d, mac) {
  return d.ports.find(p => normMac(p.mac) === mac && !NON_IP.has(p.kind) && !linksOfPort(lab, d.id, p.id).length) || null;
}

/** Cables from switch MAC tables: a port without a cable that learned MACs of known devices. */
function macCables(lab, devs, facts) {
  let links = 0, unmanaged = 0;
  const byMac = new Map();
  for (const d of lab.devices) for (const p of d.ports) { const m = normMac(p.mac); if (m && !NON_IP.has(p.kind)) byMac.set(m, d); }
  for (const sw of devs) {
    const f = facts.get(sw.id);
    if (!sw.l2 || !Array.isArray(f?.macTable)) continue;
    const per = new Map();
    for (const e of f.macTable) { const k = normPort(e.port); if (!per.has(k)) per.set(k, { name: e.port, macs: new Set() }); per.get(k).macs.add(normMac(e.mac)); }
    for (const { name, macs } of per.values()) {
      const sp = sw.ports.find(p => normPort(p.name) === normPort(name));
      if (!sp || sp.mode === 'trunk' || linksOfPort(lab, sw.id, sp.id).length || macs.size > 8) continue;
      const ends = [...macs].map(m => ({ m, d: byMac.get(m) })).filter(x => x.d && x.d.id !== sw.id)
        .map(x => ({ d: x.d, p: portWithMac(lab, x.d, x.m) })).filter(x => x.p);
      if (!ends.length) continue;
      if (ends.length === 1 && macs.size === 1) { cable(lab, sw.id, sp.id, ends[0].d.id, ends[0].p.id); links++; continue; }
      // several devices behind one port: something unmanaged sits between them
      const tpl = BUILTIN.find(t => t.id === (ends.length > 4 ? 'net-switch-8' : 'net-switch-5'));
      const us = createDevice(tpl, { name: uniqueName(lab, `unmanaged-${sw.name}-${sp.name.replace(/[^A-Za-z0-9]+/g, '')}`), x: sw.topo.x, z: sw.topo.z + 3 });
      us.notes = `Assumed by discovery: ${macs.size} MACs on ${sw.name} ${sp.name} and no LLDP/CDP neighbor.`;
      lab.devices.push(us);
      unmanaged++;
      const free = us.ports.filter(p => !NON_IP.has(p.kind));
      cable(lab, sw.id, sp.id, us.id, free[0].id); links++;
      ends.slice(0, free.length - 1).forEach((x, i) => { cable(lab, us.id, free[i + 1].id, x.d.id, x.p.id); links++; });
    }
  }
  return { links, unmanaged };
}

/**
 * Add the chosen hosts to the lab. choices: {hosts: [{ip, template, name}], ssh: {user, keyFile, auth, port, legacy}}.
 * Returns {map: {ip: device id} (for /adopt), added, links, unmanaged}.
 */
export function buildFromDiscovery(lab, result, choices) {
  const want = new Map((choices.hosts || []).map(c => [c.ip, c]));
  const hosts = (result.hosts || []).filter(x => want.has(x.ip) && !x.sameAs);
  const xs = lab.devices.filter(d => !d.physicalOnly).map(d => d.topo.x);
  const x0 = (xs.length ? Math.max(...xs) + 6 : 0);
  const rows = new Map();
  const map = {}, devs = [], facts = new Map();
  const tierOf = id => { const t = BUILTIN.find(x => x.id === id); return id.startsWith('net-router') || id === 'net-firewall' ? 0 : t ? (TIER[t.category] ?? 4) : 4; };
  const ordered = hosts.map(x => ({ x, c: want.get(x.ip), t: want.get(x.ip).template || classify(x) })).sort((a, b) => tierOf(a.t) - tierOf(b.t) || a.x.ip.localeCompare(b.x.ip, undefined, { numeric: true }));
  for (const { x, c, t } of ordered) {
    const tier = tierOf(t), n = rows.get(tier) || 0;
    rows.set(tier, n + 1);
    const d = addHost(lab, result, x, t, c.name || hostName(x), { x: x0 + (n % 10) * 3, z: -8 + tier * 4 + Math.floor(n / 10) * 2 }, choices.ssh || {});
    map[x.ip] = d.id; devs.push(d);
    if (x.facts) facts.set(d.id, x.facts);
  }
  let links = 0;
  for (const d of devs) {
    const f = facts.get(d.id);
    if (!f) continue;
    for (const it of compareDevice(lab, d, f)) if (it.key.startsWith('link:') && it.sev === 'warn' && it.accept) { it.accept.run(lab, d); links++; }
  }
  const mc = macCables(lab, lab.devices.filter(d => facts.has(d.id)), facts);
  return { map, added: devs.length, links: links + mc.links, unmanaged: mc.unmanaged };
}

// ---------------------------------------------------------------- GUI
export class Discovery {
  constructor(app) {
    this.app = app;
    this.job = null;
    this.result = null;
    this.form = { ranges: '', user: '', keyFile: '', auth: 'key', port: 22, legacy: false, crawl: true, subnets: false, tofu: false, allowPublic: false };
    app.events?.on('job', m => { if (m.job?.kind === 'discover' && m.job.id === this.job?.id) { this.job = m.job; this.app.inspector?.render(); } });
  }
  get available() { return this.app.store.mode === 'server'; }
  get busy() { return !!this.job && !this.job.done; }
  base() { return `/api/discover/${encodeURIComponent(this.app.labName)}`; }

  async load() {
    this.result = null;
    if (!this.available) return;
    try { const j = await (await fetch(this.base(), { cache: 'no-store' })).json(); this.result = j.result; } catch { /* none */ }
  }

  /** Subnets of the lab, as a first guess for the ranges. */
  labSubnets() {
    const nets = new Set();
    for (const d of this.app.lab.devices) for (const i of l3Ifaces(d)) if (i.cidr.prefix >= 16 && i.cidr.prefix < 31) nets.add(`${intToIp(i.cidr.net)}/${Math.max(i.cidr.prefix, 22)}`);
    return [...nets].slice(0, 8).join(', ');
  }

  dialog() {
    if (!this.available) { toast('Discovery needs server.py', 'warn'); return; }
    const f = this.form;
    if (!f.ranges) f.ranges = this.labSubnets() || '192.168.1.0/24';
    const inp = (k, o = {}) => h('input', { class: 'inp' + (o.mono ? ' mono' : ''), type: o.type || 'text', value: f[k], placeholder: o.ph || '', onchange: e => { f[k] = o.type === 'number' ? +e.target.value : e.target.value.trim(); } });
    const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: f[k], onchange: e => { f[k] = e.target.checked; } }), label);
    modal('Discover the network', h('div', null,
      h('label', { class: 'fld' }, h('span', null, 'Addresses to sweep'), inp('ranges', { mono: true, ph: '192.168.1.0/24, 10.0.0.1-50, 10.0.5.7' }),
        h('small', null, 'Subnets, ranges and addresses, separated by commas. At most 4096 addresses. Link-local addresses (169.254.x.x) are never swept.')),
      chk('allowPublic', 'Allow public addresses (only networks you own or are allowed to scan; the run is logged)'),
      h('h4', null, 'SSH login for reading devices (optional)'),
      h('div', { class: 'row2' }, h('label', { class: 'fld' }, h('span', null, 'User'), inp('user', { mono: true, ph: 'admin' })), h('label', { class: 'fld' }, h('span', null, 'Port'), inp('port', { type: 'number' }))),
      h('label', { class: 'fld' }, h('span', null, 'Key file'), inp('keyFile', { mono: true, ph: '~/.ssh/id_ed25519 (empty: ssh-agent and default keys)' })),
      h('label', { class: 'fld' }, h('span', null, 'Login'), h('select', { class: 'inp', onchange: e => { f.auth = e.target.value; } },
        h('option', { value: 'key', selected: f.auth === 'key' ? 'selected' : null }, 'Key / ssh-agent'), h('option', { value: 'password', selected: f.auth === 'password' ? 'selected' : null }, 'Password (asked now, not saved)'))),
      chk('legacy', 'Allow legacy algorithms (old devices)'),
      chk('tofu', 'Trust the host key of devices seen for the first time (it is saved in data/ssh/known_hosts and logged). Key login only: a password is never sent to a host you have not confirmed. Off: you confirm each fingerprint.'),
      h('h4', null, 'Crawl'),
      chk('crawl', 'Follow LLDP/CDP neighbors and ARP tables of the devices read (private addresses only)'),
      chk('subnets', 'Also sweep the connected subnets of the devices read (/22 or smaller)'),
      h('p', { class: 'muted small' }, 'Discovery is read-only: a TCP connect sweep and ping, reverse DNS, and the same SSH reads as Collect. Without an SSH user, LabTracer only finds hosts and open ports.')),
    [{ label: 'Cancel' }, { label: 'Start', primary: true, onClick: () => { this.start(); } }], { wide: true });
  }

  async start(only = null, trust = {}) {
    const f = this.form;
    let password = null;
    if (f.user && f.auth === 'password') { const { askPassword } = await import('./sshterm.js'); password = await askPassword(`${f.user}@ (discovery)`, 'Used for this discovery only. It is not saved.'); if (password === null) return; }
    try {
      const r = await fetch(this.base(), { method: 'POST', headers: HDR, body: JSON.stringify({
        ranges: only ? [] : f.ranges.split(/[,\s]+/).filter(Boolean), only, trust, password, crawl: f.crawl, subnets: f.subnets, tofu: f.tofu, allowPublic: f.allowPublic,
        ssh: f.user || f.keyFile ? { user: f.user, keyFile: f.keyFile, auth: f.auth, port: f.port || 22, legacy: f.legacy } : null }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText);
      password = null;
      this.job = j;
      toast('Discovery started', 'info', 2000);
      this.app.inspector?.render();
      this.job = await this.app.collect.follow(j);
    } catch (e) { toast('Discovery: ' + e.message, 'err', 7000); this.job = null; this.app.inspector?.render(); return; }
    await this.load();
    const err = this.job?.devices?.discovery?.error;
    this.app.inspector?.render();
    if (err) toast('Discovery: ' + err, 'err', 8000);
    else this.results();
  }

  progressText() {
    const p = this.job?.discovery;
    if (!p) return '';
    const what = { sweep: `sweeping ${p.swept}/${p.total}`, ping: 'ping', names: 'names and MACs', identify: `reading devices over SSH (${p.alive} hosts)`, done: 'done', error: 'failed' }[p.phase] || p.phase;
    return `${what} · ${p.alive || p.hosts || 0} found`;
  }

  results() {
    const res = this.result;
    if (!res) { toast('No discovery result yet', 'info'); return; }
    const lab = this.app.lab;
    const rows = (res.hosts || []).filter(x => !x.sameAs).map(x => {
      const there = findInLab(lab, x);
      return { x, there, on: !there, tpl: classify(x), name: hostName(x) };
    });
    const keys = rows.filter(r => r.x.ssh?.state === 'hostkey');
    const sel = h('span', { class: 'small' });
    const count = () => { sel.textContent = `${rows.filter(r => r.on && !r.there).length} new device(s) selected`; };
    const table = h('div', { class: 'disc-table' }, h('div', { class: 'disc-row head' }, h('span'), h('span', null, 'Address'), h('span', null, 'Name'), h('span', null, 'Type'), h('span', null, 'Found')),
      rows.map(r => h('div', { class: 'disc-row' + (r.there ? ' known' : '') },
        h('input', { type: 'checkbox', checked: r.on, disabled: r.there ? true : null, onchange: e => { r.on = e.target.checked; count(); } }),
        h('span', { class: 'mono' }, r.x.ip),
        r.there ? h('span', null, r.there.name, h('span', { class: 'muted' }, ' (in the lab)')) : h('input', { class: 'inp', value: r.name, onchange: e => { r.name = e.target.value.trim() || r.name; } }),
        r.there ? h('span', { class: 'muted small' }, r.there.category) : h('select', { class: 'inp', onchange: e => { r.tpl = e.target.value; } }, TEMPLATES.map(([v, l]) => h('option', { value: v, selected: v === r.tpl ? 'selected' : null }, l))),
        h('span', { class: 'small', title: [r.x.rdns, r.x.mac && `MAC ${r.x.mac} (${r.x.macFrom})`, r.x.ssh?.error].filter(Boolean).join('\n') },
          r.x.facts ? h('b', null, `${r.x.driver} `) : null, (r.x.ports || []).slice(0, 8).join(' '),
          r.x.ssh?.state === 'hostkey' ? h('span', { class: 'warn' }, ' · host key?') : r.x.ssh?.state === 'auth' ? h('span', { class: 'warn' }, ' · login refused') : r.x.ssh?.state === 'error' ? h('span', { class: 'muted' }, ' · ssh error') : null))));
    count();
    const buttons = [{ label: 'Close' }];
    if (keys.length) buttons.unshift({ label: `Trust ${keys.length} host key(s)…`, onClick: () => { this.trustKeys(keys.map(r => r.x)); } });
    buttons.push({ label: 'Add to the lab', primary: true, onClick: () => { this.add(rows); } });
    const done = res.finished ? new Date(res.finished * 1000).toLocaleString() : '';
    modal('Discovered hosts', h('div', null,
      h('p', { class: 'small' }, `${rows.length} host(s), ${rows.filter(r => r.x.facts).length} read over SSH, ${rows.filter(r => r.there).length} already in the lab · ${res.swept} addresses swept · ${done}`),
      table, sel,
      h('p', { class: 'muted small' }, 'Added devices get their ports, addresses, VLANs, routes, services and VMs from what was read, and cables from LLDP/CDP and switch MAC tables. Devices read over SSH are included in Collect, so their Drift tab works at once. Undo (Ctrl+Z) removes them again.')),
    buttons, { wide: true });
  }

  trustKeys(hosts) {
    const trust = {};
    modal('Confirm host keys', h('div', null,
      h('p', { class: 'small' }, 'Compare each fingerprint with the one on the device. Tick only the ones that match.'),
      hosts.map(x => h('label', { class: 'chk mono small' }, h('input', { type: 'checkbox', onchange: e => { if (e.target.checked) trust[x.ip] = x.ssh.fingerprint; else delete trust[x.ip]; } }),
        `${x.ip}  ${x.ssh.keytype}  ${x.ssh.fingerprint}`))),
    [{ label: 'Cancel' }, { label: 'Trust and read again', primary: true, onClick: () => { const ips = Object.keys(trust); if (ips.length) this.start(ips, trust); } }], { wide: true });
  }

  async add(rows) {
    const app = this.app, lab = app.lab;
    const choices = { ssh: { user: this.form.user, keyFile: this.form.keyFile, auth: this.form.auth, port: this.form.port, legacy: this.form.legacy },
      hosts: rows.filter(r => r.on && !r.there).map(r => ({ ip: r.x.ip, template: r.tpl, name: r.name })) };
    const map = {};
    for (const r of rows) if (r.there && r.x.facts && !app.collect.facts.has(r.there.id)) map[r.x.ip] = r.there.id; // read already: use for drift
    if (!choices.hosts.length && !Object.keys(map).length) { toast('Nothing selected', 'info'); return; }
    const res = buildFromDiscovery(lab, this.result, choices);
    Object.assign(map, res.map);
    app.commit(`Discovery: add ${res.added} device(s)`, 'all');
    try {
      await fetch(`${this.base()}/adopt`, { method: 'POST', headers: HDR, body: JSON.stringify({ map }) });
    } catch { /* drift facts come with the next collect */ }
    await app.collect.load();
    app.viewport.fit();
    toast(`Added ${res.added} device(s) and ${res.links} cable(s)${res.unmanaged ? `, ${res.unmanaged} assumed unmanaged switch(es)` : ''}`, 'ok', 6000);
  }

  section() {
    const res = this.result;
    if (!this.available) return h('p', { class: 'muted small' }, 'Discovery needs server.py.');
    return h('div', null,
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small primary', disabled: this.busy ? true : null, onclick: () => this.dialog() }, this.busy ? 'Discovering…' : 'Discover…'),
        res ? h('button', { class: 'btn small', disabled: this.busy ? true : null, onclick: () => this.results() }, `Results (${(res.hosts || []).length})`) : null),
      this.busy ? h('p', { class: 'small' }, this.progressText()) : null,
      h('p', { class: 'muted small' }, 'Sweeps address ranges, reads the devices it can log in to, follows LLDP/CDP and ARP tables, and adds what it finds to the lab with ports, addresses and cables.'));
  }
}
