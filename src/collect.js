// Collector client. Asks server.py to read devices over SSH (collector/, read-only on the
// devices) and keeps the facts of the open lab. The drift report (src/drift.js) compares
// those facts with the model.
//
//   GUI --POST /api/collect/<lab>--> server.py --SSH--> devices
//       <--GET /api/collect/jobs/<id>  (progress)
//       <--GET /api/observed/<lab>     (facts, kept in data/observed/<lab>/)
import { h } from './util.js';
import { devById, isDeployed } from './model.js';
import { modal, toast } from './dialogs.js';
import { sshConf, sshHost, askPassword } from './sshterm.js';
import { compareDevice, collectConf, labCollectConf, inventoryFacts, driftCounts } from './drift.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
const POLL_MS = 1000;
const MAX_WAIT_MS = 10 * 60 * 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Collector {
  constructor(app) {
    this.app = app;
    this.facts = new Map();  // device id -> facts
    this.state = new Map();  // device id -> {state, error, errors}: the last run
    this.labName = null;
    this.running = false;
  }
  get available() { return this.app.store.mode === 'server'; }

  /** Load the stored facts of the open lab. */
  async load() {
    const name = this.app.labName;
    this.labName = name; this.facts = new Map(); this.state = new Map();
    if (!this.available) { this.changed(); return; }
    try {
      const r = await fetch(`/api/observed/${encodeURIComponent(name)}`, { cache: 'no-store' });
      const j = await r.json();
      if (this.labName !== name) return; // another lab was opened meanwhile
      for (const [id, f] of Object.entries(j.devices || {})) this.facts.set(id, f);
    } catch { /* nothing collected yet */ }
    this.changed();
  }

  items(d) { return compareDevice(this.app.lab, d, this.facts.get(d.id)); }
  /** device id -> {error, warn, info} for every device with facts. */
  summary() {
    const out = new Map();
    for (const id of this.facts.keys()) { const d = devById(this.app.lab, id); if (d) out.set(id, driftCounts(this.items(d))); }
    return out;
  }
  /** Devices that "Collect all" reads. */
  candidates() {
    return this.app.lab.devices.filter(d => collectConf(d).enabled && sshHost(d) && isDeployed(d) && !d.physicalOnly && !d.logical);
  }
  params(d) {
    const c = sshConf(d);
    return { id: d.id, name: d.name, host: sshHost(d), port: c.port, user: c.user, auth: c.auth, keyFile: c.keyFile, legacy: c.legacy, driver: collectConf(d).driver || 'auto' };
  }

  /** Read devices; resolves when the run (and host key retries) is over. */
  async run(devs, trust = {}) {
    if (!this.available) { toast('Collect needs server.py', 'warn'); return; }
    if (this.running) { toast('A collection is already running', 'warn'); return; }
    const lab = this.labName;
    const noHost = devs.filter(d => !sshHost(d));
    for (const d of noHost) this.state.set(d.id, { state: 'error', error: 'No address: set the SSH host in the Console tab, or an IP in the Ports tab.' });
    devs = devs.filter(d => sshHost(d));
    if (!devs.length) { this.changed(); if (noHost.length) toast('No address to connect to', 'err'); return; }
    let password = null;
    const pwDevs = devs.filter(d => sshConf(d).auth === 'password');
    if (pwDevs.length) {
      password = await askPassword(pwDevs.length === 1 ? `${sshConf(pwDevs[0]).user ? sshConf(pwDevs[0]).user + '@' : ''}${sshHost(pwDevs[0])}` : `${pwDevs.length} devices with password login`,
        'The password goes to server.py for this one collection run. It is not saved.');
      if (password === null) return;
    }
    this.running = true;
    for (const d of devs) this.state.set(d.id, { state: 'queued' });
    this.changed();
    let job;
    try {
      const r = await fetch(`/api/collect/${encodeURIComponent(lab)}`, { method: 'POST', headers: HDR, body: JSON.stringify({ devices: devs.map(d => this.params(d)), password, trust }) });
      password = null;
      job = await r.json();
      if (!r.ok) throw new Error(job.error || r.statusText);
      const end = Date.now() + MAX_WAIT_MS;
      while (!job.done && Date.now() < end) {
        this.absorb(job); this.changed();
        await sleep(POLL_MS);
        const p = await fetch(`/api/collect/jobs/${encodeURIComponent(job.id)}`, { cache: 'no-store' });
        if (!p.ok) throw new Error('the server lost the job (was server.py restarted?)');
        job = await p.json();
      }
    } catch (e) {
      password = null;
      for (const d of devs) if (!['done', 'error'].includes(this.state.get(d.id)?.state)) this.state.set(d.id, { state: 'error', error: e.message });
      this.running = false; this.changed(); toast('Collect: ' + e.message, 'err', 6000); return;
    }
    this.absorb(job);
    const done = Object.entries(job.devices).filter(([, v]) => v.state === 'done').map(([id]) => id);
    await Promise.all(done.map(id => this.fetchFacts(lab, id)));
    this.running = false;
    if (this.labName !== lab) return;
    this.autoAccept(done);
    this.changed();
    const errs = Object.values(job.devices).filter(v => v.state === 'error').length;
    toast(`Collected ${done.length} device(s)${errs ? `, ${errs} failed` : ''}`, errs ? 'warn' : 'ok', 3500);
    // unknown host keys: ask, then read those devices again
    const retry = {}; const again = [];
    for (const [id, v] of Object.entries(job.devices)) {
      if (v.state !== 'hostkey') continue;
      const d = devById(this.app.lab, id);
      if (d && await askHostKey(v)) { retry[id] = v.fingerprint; again.push(d); }
    }
    if (again.length) await this.run(again, retry);
  }

  absorb(job) {
    for (const [id, v] of Object.entries(job.devices || {})) this.state.set(id, v);
  }
  async fetchFacts(lab, id) {
    try {
      const r = await fetch(`/api/observed/${encodeURIComponent(lab)}/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (this.labName === lab) { this.facts.set(id, j.facts); this.configs ||= new Map(); this.configs.set(id, j.configs || []); }
    } catch { /* keep the old facts */ }
  }

  /** Accept the inventory facts (serial, model, vendor, MAC, OS) of devices, when the lab says so. */
  autoAccept(ids) {
    const lab = this.app.lab;
    if (!labCollectConf(lab).autoAcceptInventory) return 0;
    let n = 0;
    for (const id of ids) {
      const d = devById(lab, id); if (!d) continue;
      for (const it of inventoryFacts(this.items(d))) { it.accept.run(lab, d); n++; }
    }
    if (n) { this.app.commit(`Inventory from devices (${n})`, 'all'); toast(`Filled in ${n} inventory field(s) from the devices`, 'ok', 3000); }
    return n;
  }
  accept(d, items) {
    const lab = this.app.lab, dev = devById(lab, d.id);
    if (!dev || !items.length) return;
    for (const it of items) it.accept.run(lab, dev);
    this.app.commit(items.length === 1 ? 'Accept actual: ' + items[0].accept.label : `Accept actual (${items.length})`, 'all');
  }
  setIgnored(d, key, on) {
    const c = collectConf(d);
    const ign = new Set(c.ignore || []);
    if (on) ign.add(key); else ign.delete(key);
    d.collect = { ...c, ignore: [...ign] };
    this.app.commit(on ? 'Ignore drift item' : 'Stop ignoring drift item', { dev: d.id });
  }

  changed() { this.app.onDriftChanged?.(); }
}

function askHostKey(v) {
  return new Promise(res => {
    let done = false;
    const answer = ok => { if (!done) { done = true; res(ok); } };
    modal('Unknown host key', h('div', null,
      h('p', null, `LabTracer has not seen the host key of ${v.host} (${v.name}) before.`),
      h('div', { class: 'mono-box' }, `${v.keytype}\n${v.fingerprint}`),
      h('p', { class: 'muted small' }, 'Compare the fingerprint with the one on the device (for example "ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub" or "show crypto key mypubkey"). Trust it only if they match. The key is then kept in data/ssh/known_hosts.')),
    [{ label: 'Skip', onClick: () => answer(false) }, { label: 'Trust and collect', primary: true, onClick: () => answer(true) }],
    { onClose: () => answer(false) });
  });
}
