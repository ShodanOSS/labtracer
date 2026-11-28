// SPDX-License-Identifier: Apache-2.0
// Staged changes over many devices, backups and the audit log (server side: collector/changes.py,
// backups.py, audit.py).
//
//   Drift tab "stage"  --POST /api/changes/<lab>/<id>/items {device, ops}--> the server renders the commands
//   Review             <-- every device's commands and file changes, the order, the options
//   Apply              --POST .../apply {digest}--> one device after the other: backup, rollback timer,
//                         apply, connect again, confirm or restore, save, collect again
// The digest makes the server apply exactly the version that was reviewed. Everything is in the audit log.
import { h, fmtTime, download, safeName } from './util.js';
import { devById } from './model.js';
import { modal, toast, confirmBox, promptText } from './dialogs.js';
import { sshConf, sshHost, askPassword } from './sshterm.js';
import { lineDiff } from './diff.js';

const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
export const OPTION_DEFAULTS = { save: true, rollback: 5, onError: 'restore', stopOnError: true };
const STATUS = { draft: 'staged', applying: 'applying…', applied: 'applied', failed: 'failed', partial: 'partly applied', discarded: 'discarded' };
const EVENT_TEXT = {
  'change-created': 'change set created', 'change-staged': 'staged', 'change-edited': 'change set edited', 'change-discarded': 'change set discarded',
  'change-apply': 'change set apply started', 'change-finished': 'change set finished', backup: 'backup', 'rollback-armed': 'rollback timer started',
  'rollback-unavailable': 'no rollback timer', apply: 'apply', unreachable: 'unreachable after change', confirm: 'change confirmed',
  rollback: 'rolled back', save: 'saved to startup', restore: 'backup restored', error: 'error', 'discover-start': 'discovery started',
  'discover-finish': 'discovery finished', 'discover-error': 'discovery failed', 'discover-adopt': 'devices added from discovery',
  'remote-open': 'remote session opened', 'remote-close': 'remote session closed', 'remote-failed': 'remote session failed',
};

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: HDR, cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

/** One diff view for a file change. */
export function fileDiff(f) {
  const d = lineDiff(f.old, f.content).filter((x, i, a) => x.t !== ' ' || a.slice(Math.max(0, i - 2), i + 3).some(y => y.t !== ' '));
  return h('div', null, h('div', { class: 'small mono' }, f.path),
    h('pre', { class: 'diff' }, d.map(x => h('div', { class: x.t === '+' ? 'add' : x.t === '-' ? 'del' : '' }, `${x.t} ${x.s}`))));
}

export class ChangeManager {
  constructor(app) {
    this.app = app;
    this.list = [];      // summaries of the lab's change sets
    this.current = null; // the open draft (public doc)
    this.opts = { ...OPTION_DEFAULTS };
  }
  get available() { return this.app.store.mode === 'server'; }
  base() { return `/api/changes/${encodeURIComponent(this.app.labName)}`; }
  prefKey() { return `draft:${this.app.labName}`; }

  async load() {
    this.list = []; this.current = null;
    if (!this.available) return;
    const lab = this.app.labName;
    try {
      const j = await api('GET', this.base());
      if (lab !== this.app.labName) return;
      this.list = j.changes || [];
      const want = this.app.store.getPref(this.prefKey(), null);
      const draft = this.list.find(c => c.id === want && c.status === 'draft') || this.list.find(c => c.status === 'draft');
      if (draft) this.current = await api('GET', `${this.base()}/${draft.id}`);
    } catch { /* nothing staged yet */ }
    this.changed();
  }
  changed() { this.app.inspector?.render(); }
  staged(devId) { return this.current?.items.find(it => it.dev === devId) || null; }

  /** Add drift items (their push operations) for a device to the open change set. */
  async stage(d, items) {
    items = items.filter(it => it.push && !it.ignored);
    if (!items.length) return;
    try {
      if (!this.current) {
        const title = `Change ${new Date().toLocaleString()}`;
        this.current = await api('POST', this.base(), { title });
        this.app.store.setPref(this.prefKey(), this.current.id);
      }
      this.current = await api('POST', `${this.base()}/${this.current.id}/items`, {
        items: [{ device: this.app.collect.params(d), ops: items.flatMap(it => it.push.ops), labels: items.map(it => (it.push.danger ? '⚠ ' : '') + it.push.label) }] });
      this.changed();
      await this.refreshList();
      toast(`Staged ${items.length} change(s) for ${d.name} · ${this.current.items.length} device(s) in "${this.current.title}"`, 'ok', 3500);
    } catch (e) { toast('Stage: ' + e.message, 'err', 6000); }
    this.changed();
  }
  async refreshList() { try { this.list = (await api('GET', this.base())).changes || []; } catch { /* keep */ } }
  async edit(body) {
    try { this.current = await api('POST', `${this.base()}/${this.current.id}/edit`, body); } catch (e) { toast(e.message, 'err', 5000); }
    this.changed();
    return this.current;
  }
  async newDraft() {
    const title = await promptText('New change set', 'Title', `Change ${new Date().toLocaleDateString()}`, 'Create');
    if (title === null) return;
    try { this.current = await api('POST', this.base(), { title }); this.app.store.setPref(this.prefKey(), this.current.id); await this.refreshList(); }
    catch (e) { toast(e.message, 'err'); }
    this.changed();
  }

  // ---------------------------------------------------------------- review and apply
  review(doc = this.current) {
    if (!doc) return;
    const ro = doc.status !== 'draft';
    const o = this.opts;
    const save = h('input', { type: 'checkbox', checked: o.save });
    const rb = h('input', { class: 'inp', type: 'number', min: 0, max: 60, step: 1, value: o.rollback, style: { width: '5em' } });
    const onErr = h('select', { class: 'inp' }, h('option', { value: 'restore', selected: o.onError === 'restore' ? 'selected' : null }, 'restore the backup'),
      h('option', { value: 'stop', selected: o.onError === 'stop' ? 'selected' : null }, 'stop and leave it'));
    const stop = h('input', { type: 'checkbox', checked: o.stopOnError });
    const danger = doc.items.some(it => (it.labels || []).some(l => l.startsWith('⚠')));
    const res = doc.results || {};
    let m;
    const reopen = async body => { m.close(); const nd = await this.edit(body); if (nd) this.review(nd); };
    const items = doc.items.map((it, i) => {
      const d = devById(this.app.lab, it.dev);
      const r = res[it.dev];
      return h('div', { class: 'chg-item' + (r ? ' st-' + r.state : '') },
        h('div', { class: 'chg-head' },
          h('b', null, `${i + 1}. ${it.name}`), h('span', { class: 'muted small' }, ` ${it.driver}${it.canApply ? '' : ' · console only'}`),
          r ? h('span', { class: 'stbadge ' + (r.state === 'done' ? 'st-up' : r.state === 'skipped' ? 'st-unknown' : 'st-down') }, r.state === 'done' ? 'applied' : r.state) : null,
          h('span', { class: 'grow' }),
          !ro && i > 0 ? h('button', { class: 'mini', title: 'Apply earlier', onclick: () => reopen({ move: it.dev, by: -1 }) }, '↑') : null,
          !ro && i < doc.items.length - 1 ? h('button', { class: 'mini', title: 'Apply later', onclick: () => reopen({ move: it.dev, by: 1 }) }, '↓') : null,
          !ro ? h('button', { class: 'mini', title: 'Remove this device from the change set', onclick: () => reopen({ remove: it.dev }) }, '×') : null),
        h('ul', { class: 'small push-items' }, (it.labels || []).map((l, k) => h('li', { class: l.startsWith('⚠') ? 'warn' : '' }, l,
          !ro ? h('button', { class: 'mini txt', title: 'Remove this change', onclick: () => reopen({ dropOp: [it.dev, k] }) }, 'remove') : null))),
        it.notes.map(n => h('div', { class: 'muted small' }, n)),
        h('details', { open: doc.items.length <= 3 ? true : null }, h('summary', { class: 'small' }, `Commands (${it.commands.length})${it.files.length ? ` and ${it.files.length} file change(s)` : ''}`),
          h('pre', { class: 'mono-box' }, it.commands.join('\n') || '(nothing to run)'), it.files.map(fileDiff)),
        d ? null : h('div', { class: 'warn small' }, 'This device is no longer in the lab.'),
        r?.error ? h('div', { class: 'warn small' }, r.error) : null,
        r?.backup ? h('div', { class: 'muted small' }, `Backup before the change: ${r.backup}`) : null,
        r?.transcript ? h('details', null, h('summary', { class: 'small' }, 'Transcript'), h('pre', { class: 'mono-box tall' }, r.transcript)) : null,
        !it.canApply && !ro ? h('button', { class: 'mini txt', onclick: () => { if (d) this.app.collect.sendToConsole(d, it.commands.filter(c => !c.startsWith('@')).join('\n')); } }, 'send to console') : null);
    });
    const body = h('div', null,
      h('p', { class: 'small' }, `${STATUS[doc.status] || doc.status} · ${doc.items.length} device(s) · by ${doc.user || '?'} · ${fmtTime(doc.created * 1000)}`, doc.applied ? ` · applied ${fmtTime(doc.applied * 1000)}` : ''),
      !ro ? h('label', { class: 'fld' }, h('span', null, 'Title'), h('input', { class: 'inp', value: doc.title, onchange: e => this.edit({ title: e.target.value }) })) : h('h4', null, doc.title),
      !ro ? h('label', { class: 'fld' }, h('span', null, 'Note (why, ticket, maintenance window)'), h('textarea', { class: 'inp', rows: 2, onchange: e => this.edit({ note: e.target.value }) }, doc.note || '')) : (doc.note ? h('p', { class: 'small' }, doc.note) : null),
      doc.items.length ? items : h('p', { class: 'muted small' }, 'Nothing staged yet. In the Drift tab of a device, click "stage" on a difference to add the change here.'),
      !ro && doc.items.length ? h('div', { class: 'chg-opts' },
        h('h4', null, 'How to apply'),
        h('p', { class: 'small' }, 'For each device, in this order: a backup of its config, the rollback timer, the commands, a new connection to check the device can still be reached, then the confirmation. LabTracer reads the device again at the end.'),
        h('label', { class: 'chk' }, rb, ' minutes: rollback timer (0 = off). If LabTracer can not reach the device after the change, the device goes back to its old config by itself.'),
        h('label', { class: 'fld' }, h('span', null, 'When a device refuses a command'), onErr),
        h('label', { class: 'chk' }, stop, 'Stop at the first device that fails (the next devices are not changed)'),
        h('label', { class: 'chk' }, save, 'Save to the startup config after the confirmation (Cisco IOS: write memory; Linux and RouterOS keep changes at once)'),
        danger ? h('div', { class: 'warn small' }, '⚠ Some changes can cut the connection to a device. Keep the rollback timer on, and have another way in (console cable, second address).') : null) : null);
    const buttons = [{ label: 'Close' }];
    if (!ro) {
      buttons.unshift({ label: 'Discard', danger: true, onClick: async () => {
        if (!await confirmBox('Discard change set', `Discard "${doc.title}"? It stays in the history as discarded.`, 'Discard', true)) return true;
        try { await api('POST', `${this.base()}/${doc.id}/discard`); this.current = null; await this.refreshList(); this.changed(); } catch (e) { toast(e.message, 'err'); }
      } });
      if (doc.items.some(it => it.canApply)) buttons.push({ label: `Apply to ${doc.items.filter(it => it.canApply).length} device(s)`, primary: true, danger, onClick: () => {
        this.opts = { save: save.checked, rollback: Math.max(0, Math.min(60, Math.round(+rb.value || 0))), onError: onErr.value, stopOnError: stop.checked };
        this.apply(doc, this.opts);
      } });
    }
    m = modal(ro ? `Change set (${STATUS[doc.status] || doc.status})` : 'Review staged changes', body, buttons, { wide: true });
  }

  async apply(doc, opts) {
    let password = null;
    const pw = doc.items.filter(it => { const d = devById(this.app.lab, it.dev); return d && it.canApply && sshConf(d).auth === 'password'; });
    if (pw.length) {
      password = await askPassword(`${pw.length} device(s) with password login`, 'The password goes to server.py for this change only. It is not saved.');
      if (password === null) return;
    }
    toast(`Applying "${doc.title}"…`, 'info', 3000);
    let job;
    try {
      job = await api('POST', `${this.base()}/${doc.id}/apply`, { digest: doc.digest, ...opts, password });
      password = null;
      this.current = null; this.changed();
      job = await this.app.collect.follow(job);
    } catch (e) { toast('Apply: ' + e.message, 'err', 8000); await this.load(); return; }
    const host = Object.entries(job.devices).filter(([, v]) => v.state === 'hostkey');
    await this.refreshList();
    try { this.review(await api('GET', `${this.base()}/${doc.id}`)); } catch { /* list shows it */ }
    if (host.length) toast(`Host key not trusted for ${host.map(([, v]) => v.name).join(', ')}: collect the device once to confirm it, then stage again.`, 'warn', 9000);
    this.changed();
  }

  async history() {
    await this.refreshList();
    const rows = this.list.map(c => h('button', { class: 'iprow chg-row', onclick: async () => { try { this.review(await api('GET', `${this.base()}/${c.id}`)); } catch (e) { toast(e.message, 'err'); } } },
      h('span', null, fmtTime(c.created * 1000)), h('span', null, c.title), h('span', { class: 'st-' + c.status }, STATUS[c.status] || c.status),
      h('span', { class: 'muted' }, c.devices.join(', '))));
    modal('Change sets', h('div', { class: 'ipplan' }, rows.length ? rows : h('p', { class: 'muted small' }, 'No change sets yet.')), [{ label: 'Close' }], { wide: true });
  }

  // ---------------------------------------------------------------- audit log
  async audit(device = null) {
    let j;
    try { j = await api('GET', `/api/audit/${encodeURIComponent(this.app.labName)}?limit=1000${device ? '&device=' + encodeURIComponent(device) : ''}`); }
    catch (e) { toast('Audit log: ' + e.message, 'err'); return; }
    const v = j.verify;
    const nameOf = e => e.name || devById(this.app.lab, e.dev)?.name || e.dev || '';
    const rows = j.entries.map(e => {
      const fail = e.ok === false || /error|failed|unreachable/.test(e.event);
      const detail = { ...e }; for (const k of ['prev', 'hash']) delete detail[k];
      return h('details', { class: 'audit-row' + (fail ? ' bad' : '') },
        h('summary', null, h('span', { class: 'mono' }, `#${e.seq}`), h('span', null, fmtTime(e.ts * 1000)), h('span', null, EVENT_TEXT[e.event] || e.event),
          h('span', null, nameOf(e)), h('span', { class: 'muted' }, e.user || ''), h('span', { class: fail ? 'err' : 'ok' }, e.ok === undefined ? '' : e.ok ? 'ok' : 'failed')),
        e.commands ? h('pre', { class: 'mono-box' }, e.commands.join('\n')) : null,
        e.transcript ? h('pre', { class: 'mono-box' }, e.transcript) : null,
        h('pre', { class: 'mono-box small' }, JSON.stringify(Object.fromEntries(Object.entries(detail).filter(([k]) => !['commands', 'transcript'].includes(k))), null, 1)));
    });
    modal(device ? `Audit log: ${devById(this.app.lab, device)?.name || device}` : 'Audit log', h('div', null,
      h('p', { class: 'small ' + (v.ok ? 'ok' : 'err') }, v.ok ? `✓ ${v.entries} entries, chain intact (no entry was changed or removed).` : `✗ ${v.why}`),
      h('div', { class: 'audit' }, rows.length ? rows : h('p', { class: 'muted small' }, 'Nothing logged yet.')),
      h('p', { class: 'muted small' }, `The log is data/audit/${this.app.labName}.jsonl. Each entry holds the hash of the one before it, so a changed or removed line shows here.`)),
    [{ label: 'Export', onClick: () => { download(`audit-${safeName(this.app.labName)}${device ? '-' + safeName(device) : ''}.jsonl`, j.entries.slice().reverse().map(e => JSON.stringify(e)).join('\n') + '\n'); return true; } },
      { label: 'Close', primary: true }], { wide: true });
  }

  // ---------------------------------------------------------------- backups
  async backups(d) {
    let list;
    try { list = (await api('GET', `/api/backups/${encodeURIComponent(this.app.labName)}/${encodeURIComponent(d.id)}`)).backups; }
    catch (e) { toast(e.message, 'err'); return; }
    const view = async b => {
      try {
        const doc = await api('GET', `/api/backups/${encodeURIComponent(this.app.labName)}/${encodeURIComponent(d.id)}/${b.id}`);
        modal(`Backup ${b.id}`, h('div', null, h('p', { class: 'small' }, `${fmtTime(doc.ts * 1000)} · ${doc.driver} · ${doc.host}${doc.onDevice ? ' · copy on the device: ' + doc.onDevice : ''}`),
          h('pre', { class: 'mono-box tall' }, doc.config || '(empty)')),
        [{ label: 'Download', onClick: () => { download(`${safeName(d.name)}-${b.id}.txt`, doc.config || ''); return true; } }, { label: 'Close', primary: true }], { wide: true });
      } catch (e) { toast(e.message, 'err'); }
    };
    modal(`Backups of ${d.name}`, h('div', null,
      list.length ? h('div', { class: 'ipplan' }, list.map(b => h('div', { class: 'iprow chg-row' },
        h('span', null, fmtTime(b.ts * 1000)), h('span', { class: 'mono small' }, b.id), h('span', { class: 'muted small' }, b.onDevice ? 'copy on device' : 'LabTracer only'),
        h('span', { class: 'btnrow tight' }, h('button', { class: 'mini txt', onclick: () => view(b) }, 'view'),
          h('button', { class: 'mini txt danger', onclick: () => this.restore(d, b) }, 'restore')))))
        : h('p', { class: 'muted small' }, 'No backups yet. LabTracer takes one before each change it applies.'),
      h('p', { class: 'muted small' }, 'Restore: Linux puts the network config files back and reloads them; Cisco IOS runs configure replace with the copy on the device; RouterOS loads its backup and reboots.')),
    [{ label: 'Close' }], { wide: true });
  }

  async restore(d, b) {
    if (!await confirmBox('Restore backup', `Put the config of ${fmtTime(b.ts * 1000)} back on ${d.name}? This changes the device now.`, 'Restore', true)) return;
    let password = null;
    if (sshConf(d).auth === 'password') { password = await askPassword(`${sshHost(d)}`, 'The password goes to server.py for this restore only.'); if (password === null) return; }
    toast(`Restoring ${d.name}…`, 'info', 2500);
    let job;
    try {
      job = await api('POST', `/api/backups/${encodeURIComponent(this.app.labName)}/${encodeURIComponent(d.id)}/${b.id}/restore`, { device: this.app.collect.params(d), password });
      password = null;
      job = await this.app.collect.follow(job);
    } catch (e) { toast('Restore: ' + e.message, 'err', 7000); return; }
    const r = Object.values(job.devices)[0] || {};
    modal(r.state === 'done' ? `Restored ${d.name}` : `Restore of ${d.name} did not finish`, h('div', null,
      r.error ? h('div', { class: 'warn small' }, r.error) : null, r.transcript ? h('pre', { class: 'mono-box tall' }, r.transcript) : null), [{ label: 'Close' }], { wide: true });
  }
}
