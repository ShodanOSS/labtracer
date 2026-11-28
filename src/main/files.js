// SPDX-License-Identifier: Apache-2.0
// App: the File menu. New, open, save as, import, export, delete, and the help dialog.
import { h, download, pickFile, readFileText, safeName, fmtTime } from '../util.js';
import { store, makeTar } from '../store.js';
import { newLab } from '../model.js';
import { exportInventoryCsv, inventoryItems } from '../inventory.js';
import { runningConfig } from '../cli.js';
import { buildSampleLab } from '../sample.js';
import { modal, toast, promptText, confirmBox, popup } from '../dialogs.js';

export class LabFiles {
  fileMenu(btn) {
    const r = btn.getBoundingClientRect();
    popup(r.left - 6, r.bottom - 2, null, [
      { label: 'New lab…', sub: 'empty', onClick: () => this.newLabDialog() },
      { label: 'Open lab…', sub: 'Ctrl+O', onClick: () => this.openDialog() },
      { label: 'Save', sub: 'Ctrl+S', onClick: () => this.save() },
      { label: 'Save as…', onClick: () => this.saveAs() },
      '-',
      { label: 'Import lab (.json)…', onClick: () => this.importLab() },
      { label: 'Export lab (.json)', onClick: () => download(`${this.labName}.labtracer.json`, JSON.stringify(this.lab, null, 1), 'application/json') },
      { label: 'Export all configs', sub: store.mode === 'server' ? 'to data/export/' : '.tar download', onClick: () => this.exportConfigs(this.lab.devices) },
      { label: 'Export inventory (.csv)', sub: 'all items', onClick: () => exportInventoryCsv(this.lab, inventoryItems(this.lab), `${this.labName}-inventory.csv`) },
      { label: 'Import inventory (.csv)…', sub: 'add or update items', onClick: () => this.inventory.importCsv() },
      '-',
      { label: 'Load example lab…', onClick: async () => {
        if (!await this.confirmDiscard()) return;
        const name = await this.freeLabName('example-lab');
        if (await confirmBox('Example lab', `Open the example lab as a new lab called "${name}"?`)) { this.loadLab(buildSampleLab(), name); this.dirty = true; this.updateStatus(); }
      } },
      { label: 'Delete this lab…', cls: 'danger', onClick: () => this.deleteLab() },
      '-',
      { label: 'Settings…', onClick: () => this.settingsDialog() },
      { label: 'Keyboard and help…', sub: '?', onClick: () => this.helpDialog() },
    ]);
  }
  async newLabDialog() {
    if (!await this.confirmDiscard()) return;
    const name = await promptText('New lab', 'Lab name', await this.freeLabName('new-lab'), 'Create'); if (!name) return;
    if (!await this.confirmOverwrite(safeName(name))) return;
    this.loadLab(newLab(safeName(name)), name); await this.save(true, { force: true }); // replace was confirmed
  }
  async openDialog() {
    let labs = [];
    try { labs = await store.listLabs(); } catch (e) { return toast(e.message, 'err'); }
    const list = h('div', { class: 'lab-list' }, labs.length ? labs.map(l => h('button', { class: 'lab-item' + (l.name === this.labName ? ' on' : ''), onclick: async () => {
      if (this.dirty && l.name !== this.labName && !await confirmBox('Unsaved changes', 'Discard unsaved changes to the current lab?', 'Discard', true)) return;
      m.close(); await this.openLab(l.name);
    } }, h('b', null, l.name), h('small', null, `${Math.round(l.size / 1024)} KB${l.modified ? ' · ' + fmtTime(l.modified * 1000) : ''}`))) : h('p', { class: 'muted' }, 'No labs saved yet.'));
    const m = modal('Open lab', list, [{ label: 'Close' }]);
  }
  async saveAs() {
    const name = await promptText('Save as', 'New lab name', await this.freeLabName(this.labName + '-copy'), 'Save'); if (!name) return;
    if (safeName(name) !== this.labName && !await this.confirmOverwrite(safeName(name))) return;
    this.labName = safeName(name); this.lab.name = this.labName; this.conflict = false;
    document.getElementById('lab-name').textContent = this.labName;
    store.setPref('lastLab', this.labName);
    await this.save(false, { force: true }); // the name is free, or replacing it was confirmed
  }
  async importLab() {
    if (!await this.confirmDiscard()) return;
    const f = await pickFile('.json,application/json'); if (!f) return;
    try {
      const lab = JSON.parse(await readFileText(f));
      if (!lab.devices) throw new Error('not a LabTracer lab');
      const name = await this.freeLabName(safeName(lab.name || f.name.replace(/\..*$/, ''))); // never autosave over an existing lab
      this.loadLab(lab, name); this.dirty = true; this.updateStatus();
      toast(`Imported ${name}. Press Ctrl+S to save it.`, 'ok', 4000);
    } catch (e) { toast('Import failed: ' + e.message, 'err'); }
  }
  async deleteLab() {
    if (!await confirmBox('Delete lab', `Delete "${this.labName}"? ${store.mode === 'server' ? 'A copy stays in data/labs/.history.' : 'This cannot be undone.'}`, 'Delete', true)) return;
    await store.deleteLab(this.labName);
    const labs = await store.listLabs();
    if (labs[0]) await this.openLab(labs[0].name); else { this.loadLab(newLab('new-lab'), 'new-lab'); }
  }
  async exportConfigs(devices) {
    const files = [];
    const uniq = (used, n) => { const dot = n.lastIndexOf('.'); const [b, x] = dot > 0 ? [n.slice(0, dot), n.slice(dot)] : [n, '']; let r = n; for (let i = 2; used.has(r.toLowerCase()); i++) r = `${b}-${i}${x}`; used.add(r.toLowerCase()); return r; };
    const usedDev = new Set();
    for (const d of devices) {
      if (d.physicalOnly) continue;
      const dev = uniq(usedDev, safeName(d.name, 'device')), usedFile = new Set(); // "sw 1" and "sw-1" must not share a folder
      files.push({ device: dev, name: uniq(usedFile, 'running-config.txt'), content: runningConfig(this.lab, d) });
      for (const f of d.files) files.push({ device: dev, name: uniq(usedFile, safeName(f.name, 'config.txt')), content: f.content });
    }
    if (!files.length) return toast('No configs to export', 'warn');
    try {
      const r = await store.exportConfigs(this.labName, files);
      if (r) { toast(`Wrote ${r.files.length} file(s) to ${r.folder}`, 'ok', 5000); return; }
    } catch (e) { toast('Export failed: ' + e.message, 'err'); return; }
    download(`${this.labName}-configs.tar`, makeTar(files.map(f => ({ path: `${this.labName}/${safeName(f.device)}/${safeName(f.name)}`, content: f.content }))));
  }

  helpDialog() {
    const rows = [['V', 'Select / move tool'], ['L', 'Link tool (click device, pick port, click second device)'], ['Esc', 'Cancel tool or close popup'],
      ['Del / Backspace', 'Delete selection'], ['Ctrl+D', 'Duplicate device'], ['R / Shift+R', 'Rotate in room view'], ['F', 'Fit view'], ['T', 'Top-down view'],
      ['1 / 2 / 3', 'Topology / room view / inventory'], ['[ / ]', 'Hide or show the left / right panel (or click the bar beside it; drag the bar to resize)'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S', 'Save'], ['Double-click', 'Open device console'],
      ['Left drag', 'Orbit (or move a device)'], ['Right drag', 'Pan'], ['Wheel', 'Zoom']];
    modal('Keyboard and mouse', h('div', null,
      h('table', { class: 'keys' }, rows.map(([k, v]) => h('tr', null, h('td', null, h('kbd', null, k)), h('td', null, v)))),
      h('p', { class: 'muted small' }, 'Console: type ? in a device console for commands. "write memory" keeps a dated startup-config snapshot.')), [{ label: 'Close' }]);
  }
}
