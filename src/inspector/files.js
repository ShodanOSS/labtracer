// SPDX-License-Identifier: Apache-2.0
// Inspector, Configs tab: generated running-config, config files, snapshots and diffs.
import { h, ap, uid, download, pickFile, readFileText, fmtTime, safeName } from '../util.js';
import { runningConfig } from '../cli.js';
import { lineDiff } from '../diff.js';
import { modal, toast, confirmBox, promptText } from '../dialogs.js';

export class FilesTab {
  tab_files(d, el) {
    const app = this.app;
    const cur = this.fileSel.get(d.id) || '__run';
    const list = h('div', { class: 'file-list' },
      h('button', { class: 'file' + (cur === '__run' ? ' on' : ''), onclick: () => { this.fileSel.set(d.id, '__run'); this.render(); } }, 'running-config', h('small', null, 'live')),
      d.files.map(f => h('button', { class: 'file' + (cur === f.id ? ' on' : ''), onclick: () => { this.fileSel.set(d.id, f.id); this.render(); } }, f.name, h('small', null, f.snapshots.length ? `${f.snapshots.length} snap` : ''))));
    const acts = h('div', { class: 'btnrow' },
      h('button', { class: 'btn small', onclick: async () => {
        const name = await promptText('New config file', 'File name (for example wg0.conf, netplan.yaml, smb.conf)', 'config.txt');
        if (!name) return;
        const f = { id: uid('file'), name, content: '', snapshots: [] }; d.files.push(f); this.fileSel.set(d.id, f.id); this.commit('New file', 'none');
      } }, '+ New'),
      h('button', { class: 'btn small', onclick: async () => {
        const file = await pickFile(); if (!file) return;
        if (file.size > 2 * 1024 * 1024) return toast('Text files up to 2 MB only', 'err');
        const content = await readFileText(file);
        const f = { id: uid('file'), name: file.name, content, snapshots: [{ ts: Date.now(), note: 'imported', content }] };
        d.files.push(f); this.fileSel.set(d.id, f.id); this.commit('Import file', 'none'); toast(`Imported ${file.name}`, 'ok');
      } }, 'Import'),
      h('button', { class: 'btn small', onclick: () => app.exportConfigs([d]) }, 'Export all'));
    ap(el, h('div', { class: 'files' }, h('div', { class: 'files-side' }, list, acts), this.fileView(d, cur)));
  }

  fileView(d, cur) {
    const app = this.app;
    if (cur === '__run') {
      const txt = runningConfig(app.lab, d);
      return h('div', { class: 'file-main' },
        h('div', { class: 'muted small' }, 'Generated from the device model. Edit the device (or use the console) to change it.'),
        h('pre', { class: 'mono-box tall' }, txt),
        h('div', { class: 'btnrow' },
          h('button', { class: 'btn small primary', onclick: () => { const r = app.cli.exec(d, 'write memory'); if (r.changed) { this.fileSel.set(d.id, d.files.find(f => f.name === 'startup-config').id); this.commit('write memory', 'none'); toast('Saved snapshot to startup-config', 'ok'); } } }, 'Save as startup-config'),
          h('button', { class: 'btn small', onclick: () => download(`${safeName(d.name)}-running-config.txt`, txt) }, 'Download')));
    }
    const f = d.files.find(x => x.id === cur);
    if (!f) { this.fileSel.delete(d.id); return h('div'); }
    const area = h('textarea', { class: 'inp mono editor', 'data-k': `file-${f.id}`, spellcheck: 'false', onchange: e => { f.content = e.target.value; this.commit('Edit ' + f.name, 'none'); } }, f.content);
    area.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = area.selectionStart; area.setRangeText('  ', s, area.selectionEnd, 'end'); } });
    const changed = f.snapshots.length && f.snapshots[0].content !== f.content;
    return h('div', { class: 'file-main' },
      h('div', { class: 'row2' },
        this.inp(f, 'name', null, 'none', { k: `fname-${f.id}` }),
        h('div', { class: 'btnrow right' },
          h('button', { class: 'btn small primary', title: 'Keep a dated copy of this version', onclick: async () => {
            area.dispatchEvent(new Event('change'));
            const note = await promptText('Save snapshot', 'Note (what changed?)', '', 'Save');
            if (note === null) return;
            f.content = area.value; f.snapshots.unshift({ ts: Date.now(), note, content: f.content }); this.commit('Snapshot ' + f.name, 'none'); toast('Snapshot saved', 'ok');
          } }, 'Snapshot'),
          h('button', { class: 'btn small', onclick: () => download(safeName(f.name, 'config.txt'), area.value) }, 'Download'),
          h('button', { class: 'btn small danger', onclick: async () => { if (await confirmBox('Delete file', `Delete ${f.name} and its ${f.snapshots.length} snapshot(s)?`, 'Delete', true)) { d.files = d.files.filter(x => x !== f); this.commit('Delete file', 'none'); } } }, 'Delete'))),
      area,
      changed ? h('div', { class: 'warn small' }, 'Changed since the last snapshot.') : null,
      h('h4', null, `Snapshots (${f.snapshots.length})`),
      h('div', { class: 'snaps', 'data-scroll': 'snaps' }, f.snapshots.length ? f.snapshots.map((s, i) => h('div', { class: 'snap' },
        h('div', { class: 'grow' }, h('b', null, fmtTime(s.ts)), ' ', h('span', { class: 'muted' }, s.note || '')),
        h('button', { class: 'mini txt', onclick: () => this.showDiff(s.content, f.content, `${f.name}: ${fmtTime(s.ts)} → current`) }, 'diff'),
        i + 1 < f.snapshots.length ? h('button', { class: 'mini txt', onclick: () => this.showDiff(f.snapshots[i + 1].content, s.content, `${f.name}: previous → ${fmtTime(s.ts)}`) }, 'vs prev') : null,
        h('button', { class: 'mini txt', onclick: async () => { if (await confirmBox('Restore', `Replace the current text with the snapshot from ${fmtTime(s.ts)}?`, 'Restore')) { f.content = s.content; this.commit('Restore snapshot', 'none'); } } }, 'restore'),
        h('button', { class: 'mini', onclick: () => { f.snapshots.splice(i, 1); this.commit('Delete snapshot', 'none'); } }, '×'))) : h('p', { class: 'muted small' }, 'No snapshots yet.')));
  }

  showDiff(a, b, title) {
    const d = lineDiff(a, b);
    const adds = d.filter(x => x.t === '+').length, dels = d.filter(x => x.t === '-').length;
    modal(title, h('div', null, h('p', { class: 'muted small' }, `+${adds}  −${dels}`),
      h('pre', { class: 'diff' }, d.map(x => h('div', { class: x.t === '+' ? 'add' : x.t === '-' ? 'del' : '' }, `${x.t} ${x.s}`)))), [{ label: 'Close' }], { wide: true });
  }
}
