// SPDX-License-Identifier: Apache-2.0
// Collector client. Asks server.py to read devices over SSH (collector/) and keeps the
// facts of the open lab; the drift report (src/drift.js) compares them with the model.
// It also pushes reviewed changes to a device (remediation).
//
//   GUI --POST /api/collect/<lab>--> server.py --SSH--> devices
//       <-- /api/events: job progress and new facts (HTTP polling while the WebSocket is down)
//       <--GET /api/observed/<lab>     (facts, kept in data/observed/<lab>/)
//   GUI --POST /api/remediate/<lab>/plan {device, ops}  -> commands to review
//       --POST /api/remediate/apply {planId, save}      -> job: apply, then collect again
import { h } from './util.js';
import { devById, isDeployed } from './model.js';
import { modal, toast } from './dialogs.js';
import { sshConf, sshHost, askPassword } from './sshterm.js';
import { compareDevice, collectConf, labCollectConf, inventoryFacts, driftCounts } from './drift.js';
import { fileDiff } from './changes.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
const POLL_MS = 1000;        // job polling without the events WebSocket
const SAFETY_POLL_MS = 5000; // with it: an HTTP check now and then, in case an event was missed
const MAX_WAIT_MS = 10 * 60 * 1000;

async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', headers: HDR, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

export class Collector {
  constructor(app) {
    this.app = app;
    this.facts = new Map();   // device id -> facts
    this.state = new Map();   // device id -> {state, error, errors}: the last run
    this.waiters = new Map(); // job id -> fn(snapshot)
    this.labName = null;
    this.running = false;
    this.lastAuto = 0;
    app.events?.on('job', m => this.waiters.get(m.job?.id)?.(m.job));
    app.events?.on('facts', m => { if (m.lab === this.labName) this.fetchFacts(m.lab, m.dev).then(() => this.changed()); });
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
      this.lastAuto = Math.max(0, ...[...this.facts.values()].map(f => (f.collected || 0) * 1000));
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

  /** The next snapshot of a job: from /api/events, or from an HTTP check after a timeout. */
  waitJob(id) {
    return new Promise((resolve, reject) => {
      const done = snap => { clearTimeout(t); this.waiters.delete(id); resolve(snap); };
      const t = setTimeout(async () => {
        this.waiters.delete(id);
        try {
          const r = await fetch(`/api/collect/jobs/${encodeURIComponent(id)}`, { cache: 'no-store' });
          if (!r.ok) throw new Error('the server lost the job (was server.py restarted?)');
          resolve(await r.json());
        } catch (e) { reject(e); }
      }, this.app.events?.connected ? SAFETY_POLL_MS : POLL_MS);
      this.waiters.set(id, done);
    });
  }
  async follow(job) {
    const end = Date.now() + MAX_WAIT_MS;
    while (!job.done) {
      if (Date.now() > end) throw new Error('the job takes too long');
      this.absorb(job); this.changed();
      job = await this.waitJob(job.id);
    }
    this.absorb(job);
    return job;
  }

  /** Read devices; resolves when the run (and host key retries) is over.
   *  opts.auto: a scheduled run (no dialogs; key-login devices only). */
  async run(devs, trust = {}, opts = {}) {
    if (!this.available) { toast('Collect needs server.py', 'warn'); return; }
    if (this.running) { if (!opts.auto) toast('A collection is already running', 'warn'); return; }
    const lab = this.labName;
    const noHost = devs.filter(d => !sshHost(d));
    for (const d of noHost) this.state.set(d.id, { state: 'error', error: 'No address: set the SSH host in the Console tab, or an IP in the Ports tab.' });
    devs = devs.filter(d => sshHost(d));
    if (!devs.length) { this.changed(); if (noHost.length && !opts.auto) toast('No address to connect to', 'err'); return; }
    let password = null;
    const pwDevs = devs.filter(d => sshConf(d).auth === 'password');
    if (pwDevs.length && !opts.auto) {
      password = await askPassword(pwDevs.length === 1 ? `${sshConf(pwDevs[0]).user ? sshConf(pwDevs[0]).user + '@' : ''}${sshHost(pwDevs[0])}` : `${pwDevs.length} devices with password login`,
        'The password goes to server.py for this one collection run. It is not saved.');
      if (password === null) return;
    }
    this.running = true;
    for (const d of devs) this.state.set(d.id, { state: 'queued' });
    this.changed();
    let job;
    try {
      job = await postJson(`/api/collect/${encodeURIComponent(lab)}`, { devices: devs.map(d => this.params(d)), password, trust });
      password = null;
      job = await this.follow(job);
    } catch (e) {
      password = null;
      for (const d of devs) if (!['done', 'error'].includes(this.state.get(d.id)?.state)) this.state.set(d.id, { state: 'error', error: e.message });
      this.running = false; this.changed(); if (!opts.auto) toast('Collect: ' + e.message, 'err', 6000); return;
    }
    const done = Object.entries(job.devices).filter(([, v]) => v.state === 'done').map(([id]) => id);
    await Promise.all(done.map(id => this.fetchFacts(lab, id)));
    this.running = false;
    if (this.labName !== lab) return;
    this.autoAccept(done);
    this.changed();
    const errs = Object.values(job.devices).filter(v => v.state === 'error').length;
    if (!opts.auto || errs) toast(`${opts.auto ? 'Scheduled collect: ' : 'Collected '}${done.length} device(s)${errs ? `, ${errs} failed` : ''}`, errs ? 'warn' : 'ok', 3500);
    if (opts.auto) return; // host key questions wait for a manual run
    const retry = {}; const again = [];
    for (const [id, v] of Object.entries(job.devices)) {
      if (v.state !== 'hostkey') continue;
      const d = devById(this.app.lab, id);
      if (d && await askHostKey(v)) { retry[id] = v.fingerprint; again.push(d); }
    }
    if (again.length) await this.run(again, retry);
  }

  /** Called every minute: the scheduled collection of the lab panel (key-login devices only). */
  tick() {
    if (!this.available || this.running || !this.app.lab) return;
    const every = (+labCollectConf(this.app.lab).interval || 0) * 60000;
    if (every <= 0 || Date.now() - this.lastAuto < every) return;
    this.lastAuto = Date.now();
    const devs = this.candidates().filter(d => sshConf(d).auth !== 'password');
    if (devs.length) this.run(devs, {}, { auto: true });
  }

  absorb(job) {
    if (job.kind && job.kind !== 'collect') return;
    for (const [id, v] of Object.entries(job.devices || {})) this.state.set(id, v);
  }
  async fetchFacts(lab, id) {
    try {
      const r = await fetch(`/api/observed/${encodeURIComponent(lab)}/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (this.labName === lab) this.facts.set(id, j.facts);
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

  // ---------------------------------------------------------------- push the plan to the device
  /** Ask server.py to render the commands for these items, then show them for review. */
  async reviewPush(d, items) {
    items = items.filter(it => it.push);
    if (!items.length) return;
    let plan;
    try { plan = await postJson(`/api/remediate/${encodeURIComponent(this.labName)}/plan`, { device: this.params(d), ops: items.flatMap(it => it.push.ops) }); }
    catch (e) { toast('Push: ' + e.message, 'err', 7000); return; }
    const text = plan.commands.join('\n');
    const consoleText = plan.commands.filter(c => !c.startsWith('@')).join('\n');
    const danger = items.filter(it => it.push.danger);
    const sf = plan.safety || {};
    const save = h('input', { type: 'checkbox', checked: sf.save ? true : null });
    const rb = h('input', { class: 'inp', type: 'number', min: 0, max: 60, step: 1, value: sf.rollback && danger.length ? 5 : 0, style: { width: '5em' } });
    const restore = h('input', { type: 'checkbox', checked: true });
    const buttons = [
      { label: 'Cancel' },
      { label: 'Copy', onClick: async () => { try { await navigator.clipboard.writeText(text); toast('Copied', 'ok', 1200); } catch { toast('The browser did not allow the copy', 'warn'); } return true; } },
      { label: 'Stage', onClick: () => this.app.changes.stage(d, items) },
      { label: 'Send to console', primary: !plan.canApply, onClick: () => this.sendToConsole(d, consoleText) },
    ];
    if (plan.canApply) buttons.push({ label: 'Apply', primary: true, danger: danger.length > 0, onClick: () => {
      this.applyPlan(d, plan, { save: save.checked, rollback: Math.max(0, Math.min(60, Math.round(+rb.value || 0))), onError: restore.checked ? 'restore' : 'stop' });
    } });
    modal(`Push to ${d.name}`, h('div', null,
      h('p', { class: 'small' }, `Makes the device match the model for ${items.length} item(s):`),
      h('ul', { class: 'small push-items' }, items.map(it => h('li', { class: it.push.danger ? 'warn' : '' }, it.push.label, h('span', { class: 'muted' }, ` (${it.text})`)))),
      danger.length ? h('div', { class: 'warn small' }, '⚠ Some changes can cut the connection to the device (addresses, shutdown, trunks, default route). Make sure you can reach it another way (console cable, another address) before you apply them.') : null,
      plan.notes.map(n => h('div', { class: 'muted small' }, n)),
      h('h4', null, `Commands (${plan.driver})`),
      h('pre', { class: 'mono-box tall' }, text || '(nothing to run)'),
      (plan.files || []).map(fileDiff),
      plan.canApply ? h('div', { class: 'chg-opts' },
        sf.backup ? h('p', { class: 'small' }, 'Before the commands, LabTracer keeps a backup of the config (Drift tab › Backups).') : null,
        sf.rollback ? h('label', { class: 'chk' }, rb, ` minutes: rollback timer (0 = off): ${sf.rollback}.`) : null,
        sf.restore ? h('label', { class: 'chk' }, restore, 'If the device refuses a command, put the backup back') : null,
        sf.save ? h('label', { class: 'chk' }, save, 'Save to startup-config (write memory) after the change is confirmed') : null) : null,
      h('p', { class: 'muted small' }, plan.canApply
        ? 'Apply runs exactly these commands over SSH and stops at the first one that fails. Then LabTracer connects again (to check that the device can still be reached), confirms the change and reads the device again. Stage adds the change to a change set, to apply it later together with changes on other devices.'
        : 'This device has no automatic apply. Send to console pastes the commands into the SSH console; check them and press Enter to run them. Stage adds them to a change set.')),
    buttons, { wide: true });
  }

  sendToConsole(d, text) {
    const app = this.app;
    app.inspector.conMode.set(d.id, 'ssh');
    app.inspector.tab = 'console';
    app.select({ type: 'device', id: d.id });
    app.ssh.paste(d.id, text);
  }

  async applyPlan(d, plan, opts) {
    let password = null;
    if (sshConf(d).auth === 'password') {
      password = await askPassword(`${sshConf(d).user ? sshConf(d).user + '@' : ''}${sshHost(d)}`, 'The password goes to server.py to apply these changes. It is not saved.');
      if (password === null) return;
    }
    toast(`Applying to ${d.name}…`, 'info', 2500);
    let job;
    try {
      job = await postJson('/api/remediate/apply', { planId: plan.planId, ...opts, password });
      password = null;
      job = await this.follow(job);
    } catch (e) { toast('Apply: ' + e.message, 'err', 7000); return; }
    const r = Object.values(job.devices)[0] || {};
    await this.fetchFacts(this.labName, d.id);
    this.changed();
    const ok = r.state === 'done' && r.applied;
    modal(ok ? `Applied to ${d.name}` : `Not fully applied to ${d.name}`, h('div', null,
      ok ? h('p', { class: 'ok small' }, 'The device took every command. The drift report shows the device as read after the change.')
        : h('div', { class: 'warn small' }, r.error || 'The apply did not finish.'),
      r.rolledBack ? h('p', { class: 'small' }, 'The backup was put back.') : null,
      r.backup ? h('p', { class: 'muted small' }, `Backup before the change: ${r.backup} (Drift tab › Backups).`) : null,
      r.transcript ? h('pre', { class: 'mono-box tall' }, r.transcript) : null), [{ label: 'Close' }], { wide: true });
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
