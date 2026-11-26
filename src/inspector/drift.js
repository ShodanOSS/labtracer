// Inspector: the Drift tab of a device (planned model vs what the device reports) and the
// drift section of the lab panel. Facts come from the collector (src/collect.js).
import { h, ap, uid, fmtTime } from '../util.js';
import { devById } from '../model.js';
import { confirmBox, toast } from '../dialogs.js';
import { runningConfig } from '../cli.js';
import { sshConf, sshHost } from '../sshterm.js';
import { AREAS, DRIVERS, collectConf, labCollectConf, driftCounts, safePushes } from '../drift.js';

const SHOW = 8; // items per area before "show more"
const COLLECTED_FILE = 'running-config (device)';

export class DriftTab {
  tab_drift(d, el) {
    const app = this.app, col = app.collect;
    this.driftMore ||= new Set();
    if (!col.available) { ap(el, h('p', { class: 'muted small' }, 'Drift needs server.py: LabTracer reads the device over SSH. It is not available when index.html is opened directly.')); return; }
    const c = collectConf(d), f = col.facts.get(d.id), st = col.state.get(d.id);
    const set = (k, v) => { d.collect = { ...collectConf(d), [k]: v }; this.commit('Collect settings', { dev: d.id }); };
    const sc = sshConf(d), host = sshHost(d);
    const busy = st && (st.state === 'queued' || st.state === 'running');
    ap(el,
      h('div', { class: 'row2' },
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: c.enabled, 'data-k': 'col-enabled', onchange: e => set('enabled', e.target.checked) }), 'Include in "Collect all"'),
        h('label', { class: 'fld' }, h('span', null, 'Driver'), h('select', { class: 'inp', 'data-k': 'col-driver', onchange: e => set('driver', e.target.value) },
          DRIVERS.map(([v, l]) => h('option', { value: v, selected: v === c.driver ? 'selected' : null }, l))))),
      h('div', { class: 'muted small' }, 'Connects with the SSH settings of the Console tab: ',
        h('span', { class: 'mono' }, host ? `${sc.user ? sc.user + '@' : ''}${host}:${sc.port || 22}${sc.auth === 'password' ? ' (password)' : ''}` : '(no address)'), ' · ',
        h('button', { class: 'mini txt', onclick: () => { this.conMode.set(d.id, 'ssh'); this.tab = 'console'; this.render(); } }, 'edit')),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small primary', disabled: col.running || !host ? true : null, onclick: () => col.run([d]) }, busy ? 'Collecting…' : 'Collect now'),
        f?.rawConfig ? h('button', { class: 'btn small', title: 'The config LabTracer generates from the model, next to the config read from the device', onclick: () => this.showDiff(runningConfig(app.lab, d), f.rawConfig, `${d.name}: generated from the model → read from the device`) }, 'Compare config') : null,
        f?.rawConfig ? h('button', { class: 'btn small', title: `Keep a dated copy in the Configs tab (${COLLECTED_FILE})`, onclick: () => this.keepCollectedConfig(d, f) }, 'Save config to Configs') : null));
    if (st?.state === 'error') ap(el, h('div', { class: 'warn small' }, 'Last run failed: ' + st.error));
    if (st?.state === 'hostkey') ap(el, h('div', { class: 'warn small' }, `Host key of ${st.host} was not trusted. Collect again to compare the fingerprint.`));
    if (!f) {
      ap(el, h('p', { class: 'muted small' }, busy ? 'Reading the device…' : 'Nothing collected yet. Collect reads the device over SSH (read-only: show commands, ip, ss, lldpctl) and lists how it differs from the model.'));
      return;
    }
    ap(el, h('p', { class: 'muted small' }, `Collected ${fmtTime(f.collected * 1000)} from ${f.host || '?'} · driver ${f.driver}`),
      (f.errors || []).map(e => h('div', { class: 'warn small' }, e)));

    const items = col.items(d);
    const shown = items.filter(it => !it.ignored), ignored = items.filter(it => it.ignored);
    const n = driftCounts(items);
    const acceptable = shown.filter(it => it.accept);
    const pushable = safePushes(items);
    ap(el, h('div', { class: 'stline' },
      shown.length ? [n.error ? h('span', { class: 'stbadge sev-error' }, `${n.error} error`) : null, n.warn ? h('span', { class: 'stbadge sev-warn' }, `${n.warn} warning`) : null, n.info ? h('span', { class: 'stbadge sev-info' }, `${n.info} info`) : null]
        : h('span', { class: 'stbadge st-up' }, 'matches the model'),
      acceptable.length > 1 ? h('button', { class: 'mini txt', title: 'Change the model to match the device for every item below', onclick: async () => {
        if (await confirmBox('Accept all', `Change the model to match the device for ${acceptable.length} item(s)? You can undo this (Ctrl+Z).`, 'Accept all')) col.accept(d, acceptable);
      } }, `accept all (${acceptable.length})`) : null,
      pushable.length > 1 ? h('button', { class: 'mini txt', title: 'Make the device match the model for every item below that can not cut the connection. You review the commands first.', onclick: () => col.reviewPush(d, pushable) }, `push all (${pushable.length})`) : null));

    for (const [area, label] of AREAS) {
      const list = shown.filter(it => it.area === area);
      if (!list.length) continue;
      const k = `${d.id}:${area}`, more = this.driftMore.has(k);
      ap(el, h('h4', null, `${label} (${list.length})`),
        h('div', { class: 'drift' }, (more ? list : list.slice(0, SHOW)).map(it => this.driftRow(d, it)),
          list.length > SHOW ? h('button', { class: 'mini txt', onclick: () => { if (more) this.driftMore.delete(k); else this.driftMore.add(k); this.render(); } }, more ? 'show less' : `show ${list.length - SHOW} more`) : null));
    }
    if (ignored.length) ap(el, h('details', { class: 'drift-ign' }, h('summary', { class: 'muted small' }, `Ignored (${ignored.length})`),
      h('div', { class: 'drift' }, ignored.map(it => this.driftRow(d, it)))));
    const shownFacts = { ...f }; delete shownFacts.rawConfig;
    ap(el, h('details', { class: 'drift-raw' }, h('summary', { class: 'muted small' }, 'What the device reported'),
      h('pre', { class: 'mono-box tall' }, JSON.stringify(shownFacts, null, 1))),
    h('p', { class: 'muted small' }, 'Accept changes the model to match the device (Ctrl+Z undoes it). Push changes the device to match the model: you see the commands first, then apply them (Cisco IOS) or send them to the SSH console. ⚠ marks a push that can cut the connection. Ignore (×) hides a difference you expect.'));
  }

  driftRow(d, it) {
    const col = this.app.collect;
    return h('div', { class: `drow sev-${it.sev}${it.ignored ? ' ign' : ''}`, title: it.planned || it.actual ? `model: ${it.planned || '—'}\ndevice: ${it.actual || '—'}` : null },
      h('span', { class: 'dot' }),
      h('span', { class: 'dtext' }, it.text),
      h('span', { class: 'btnrow tight' },
        it.accept && !it.ignored ? h('button', { class: 'mini txt', title: 'Change the model to match the device', onclick: () => col.accept(d, [it]) }, it.accept.label) : null,
        it.push && !it.ignored ? h('button', { class: 'mini txt push' + (it.push.danger ? ' danger' : ''), title: `Change the device to match the model: ${it.push.label}${it.push.danger ? '. This can cut the connection to the device.' : ''}`, onclick: () => col.reviewPush(d, [it]) }, (it.push.danger ? '⚠ ' : '') + 'push') : null,
        h('button', { class: 'mini', title: it.ignored ? 'Show this difference again' : 'Ignore: an expected difference', onclick: () => col.setIgnored(d, it.key, !it.ignored) }, it.ignored ? '↺' : '×')));
  }

  keepCollectedConfig(d, f) {
    let file = d.files.find(x => x.name === COLLECTED_FILE);
    if (!file) { file = { id: uid('file'), name: COLLECTED_FILE, content: '', snapshots: [] }; d.files.push(file); }
    if (file.snapshots[0]?.content === f.rawConfig) { toast('This config is already the latest snapshot', 'info'); return; }
    file.content = f.rawConfig;
    file.snapshots.unshift({ ts: f.collected * 1000, note: `collected from ${f.host || 'the device'}`, content: f.rawConfig });
    this.fileSel.set(d.id, file.id);
    this.commit('Save collected config', 'none');
    toast(`Saved to Configs › ${COLLECTED_FILE}`, 'ok');
  }

  driftSection() {
    const app = this.app, col = app.collect, lab = app.lab;
    if (!col.available) return h('p', { class: 'muted small' }, 'Drift needs server.py. It is not available when index.html is opened directly.');
    const cands = col.candidates();
    const sum = col.summary();
    const lc = labCollectConf(lab);
    const rows = [...sum].map(([id, c]) => ({ d: devById(lab, id), c })).filter(r => r.d)
      .sort((a, b) => (b.c.error - a.c.error) || (b.c.warn - a.c.warn) || a.d.name.localeCompare(b.d.name));
    const failed = [...col.state].filter(([, v]) => v.state === 'error' || v.state === 'hostkey').map(([id, v]) => ({ d: devById(lab, id), v })).filter(r => r.d);
    const running = [...col.state.values()].filter(v => v.state === 'queued' || v.state === 'running').length;
    const open = id => { this.tab = 'drift'; app.select({ type: 'device', id }); };
    return h('div', null,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: lc.autoAcceptInventory, 'data-k': 'col-auto', onchange: e => { lab.collect = { ...labCollectConf(lab), autoAcceptInventory: e.target.checked }; this.commit('Collect settings', 'none'); } }),
        'Fill in inventory facts automatically (serial, model, vendor, MAC, OS)'),
      h('label', { class: 'fld' }, h('span', null, 'Collect again every … minutes (0 = off)'),
        h('input', { class: 'inp', type: 'number', min: 0, max: 1440, step: 5, value: lc.interval || 0, 'data-k': 'col-interval', onchange: e => {
          lab.collect = { ...labCollectConf(lab), interval: Math.max(0, Math.min(1440, Math.round(+e.target.value || 0))) }; this.commit('Collect settings', 'none');
        } }),
        h('small', null, 'Devices with key login only, while LabTracer is open. Unknown host keys wait for a manual Collect.')),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small primary', disabled: col.running || !cands.length ? true : null, title: cands.map(d => d.name).join(', '), onclick: () => col.run(cands) },
          col.running ? `Collecting… (${running} left)` : `Collect all (${cands.length})`)),
      rows.length ? h('div', { class: 'chips' }, rows.map(({ d, c }) => h('span', { class: 'chip' + (c.error ? ' st-down' : c.warn ? ' st-degraded' : '') },
        h('button', { class: 'chip-name', title: `${c.error} error, ${c.warn} warning, ${c.info} info`, onclick: () => open(d.id) },
          d.name, c.error || c.warn ? ` · ${c.error + c.warn}` : ' ✓')))) : null,
      failed.length ? h('div', { class: 'warn small' }, 'Failed: ', failed.map(({ d, v }, i) => [i ? ', ' : '', h('button', { class: 'mini txt', title: v.error || 'host key not trusted', onclick: () => open(d.id) }, d.name)])) : null,
      h('p', { class: 'muted small' }, cands.length
        ? 'Collect reads each device over SSH (read-only) and compares it with the model. Devices with SSH settings are included; change this in the Drift tab of a device.'
        : 'No device to collect yet. Set up SSH in the Console tab of a device (or turn it on in its Drift tab).'));
  }
}
