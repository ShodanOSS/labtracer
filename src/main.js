// SPDX-License-Identifier: Apache-2.0
/*! LabTracer | Copyright 2026 The LabTracer Authors | @license Apache-2.0
 * Bundled third-party code and licenses: NOTICE and THIRD_PARTY_NOTICES.md */
// LabTracer app shell: state, undo, persistence, tools, keyboard.
import { h, clear, mixin, safeName } from './util.js';
import { store } from './store.js';
import { Library, newLab, normalizeLab, devById } from './model.js';
import { InventoryView } from './inventory.js';
import { Viewport } from './viewport.js';
import { Palette } from './palette.js';
import { Inspector } from './inspector.js';
import { Cli } from './cli.js';
import { buildSampleLab } from './sample.js';
import { toast, confirmBox, closePopup } from './dialogs.js';
import { MEDIA } from './templates.js';
import { Monitor } from './monitor.js';
import { SshManager } from './sshterm.js';
import { Collector } from './collect.js';
import { ChangeManager } from './changes.js';
import { Discovery } from './discover.js';
import { RemoteManager } from './remote.js';
import { Events } from './events.js';
import { History } from './history.js';
import { Panels } from './panels.js';
import { migrateLab, migrateLibrary, LIBRARY_VERSION } from './migrations.js';
import { Placement } from './main/placement.js';
import { Linking } from './main/linking.js';
import { Edits } from './main/edits.js';
import { LabFiles } from './main/files.js';
import { SettingsUi, DEFAULT_SETTINGS } from './main/settings.js';

const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'color', 'range', 'file']);

class App {
  constructor() {
    this.store = store;
    this.library = new Library();
    this.settings = { ...DEFAULT_SETTINGS, ...store.getPref('settings', {}) };
    this.lab = null;
    this.labName = null;
    this.selection = null;
    this.tool = 'select';
    this.placingTpl = null;
    this.linkMedium = 'auto';
    this.linkStart = null;
    this.history = new History(); // undo / redo: only the changes of each step
    this.rev = 0;                 // counts committed changes; a save knows if the lab changed while it ran
    this.dirty = false;
    this.roomId = null;
    this.inventoryOn = false;   // inventory table shown instead of the 3D view
    this.viewportStale = false; // lab changed while the 3D view was hidden
  }

  async init() {
    await store.init();
    this.panels = new Panels(document.querySelector('main'), store);
    await this.loadLibrary();
    this.viewport = new Viewport(document.getElementById('viewport'), this);
    this.palette = new Palette(document.getElementById('palette'), this);
    this.inspector = new Inspector(document.getElementById('inspector'), this);
    this.cli = new Cli(this);
    this.events = new Events();
    this.monitor = new Monitor(this);
    this.ssh = new SshManager(this);
    this.collect = new Collector(this);
    this.changes = new ChangeManager(this);
    this.discover = new Discovery(this);
    this.remote = new RemoteManager(this);
    const invEl = h('div', { class: 'inv', hidden: true });
    document.getElementById('viewport').appendChild(invEl);
    this.inventory = new InventoryView(invEl, this);
    await this.monitor.loadConfig();
    this.events.start();
    this.bindToolbar();
    this.bindKeys();
    this.palette.render();

    let labs = [];
    try { labs = await store.listLabs(); } catch { /* none */ }
    const last = store.getPref('lastLab', null);
    // the last lab first, then the others: a damaged file must not leave the app without a lab
    const order = [...labs.filter(l => l.name === last), ...labs.filter(l => l.name !== last)];
    let opened = false;
    for (const l of order) if ((opened = await this.openLab(l.name))) break;
    if (!labs.length) { this.loadLab(buildSampleLab(), 'example-lab'); await this.save(true); toast('Created an example lab. Edit it, or start a new one from File > New lab.', 'info', 5000); }
    else if (!opened) this.loadLab(newLab('new-lab'), await this.freeLabName('new-lab'));

    setInterval(() => { if (this.dirty && !this.conflict && !this.saveBlocked && this.settings.autosave && store.mode === 'server') this.save(true); }, 30000);
    setInterval(() => this.collect.tick(), 60000); // scheduled collection (lab panel, Drift)
    window.addEventListener('beforeunload', e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    this.updateStatus();
    document.getElementById('mode-badge').textContent = store.mode === 'server' ? 'Saved to disk' : 'Browser storage';
    document.getElementById('mode-badge').title = store.mode === 'server' ? `Data folder: ${store.dataPath}` : 'Opened without server.py: labs live in this browser. Use File > Export to keep copies.';
  }

  // ---------------------------------------------------------------- lab lifecycle
  /** Throws (and changes nothing) if the lab is from a newer LabTracer or has a bad format version. */
  loadLab(lab, name) {
    const m = migrateLab(lab);
    this.ssh?.prune(true); // sessions belong to the devices of the old lab
    this.remote?.prune(true);
    this.lab = normalizeLab(lab);
    this.migratedFrom = m.from < m.to ? m.from : null; // the next save keeps a copy of the old file
    this.labName = safeName(name || lab.name || 'lab');
    this.lab.name = this.labName;
    this.roomId = this.lab.view.roomId && this.lab.rooms.some(r => r.id === this.lab.view.roomId) ? this.lab.view.roomId : (this.lab.rooms[0]?.id || null);
    this.selection = null;
    this.history.reset(this.lab);
    this.rev++;
    this.dirty = false;
    this.conflict = false;
    this.saveBlocked = false; // a newer LabTracer wrote this lab on disk: autosave is off
    this.cancelTools();
    this.viewport.camState = {};
    this.viewport.mode = (this.lab.view.mode3d || this.lab.view.mode) === 'room' ? 'room' : 'topo';
    this.inventoryOn = this.lab.view.mode === 'inventory';
    this.syncModeButtons();
    this.viewport.rebuildAll(); this.viewportStale = false;
    this.viewport.fit();
    this.inventory.show(this.inventoryOn);
    this.inspector.render();
    this.renderRoomSelect();
    store.setPref('lastLab', this.labName);
    if (this.monitor?.live) this.monitor.schedulePush();
    this.collect?.load(); // facts read from the devices of this lab (drift)
    this.changes?.load(); // staged change set of this lab
    this.discover?.load(); // last discovery result of this lab
    document.getElementById('lab-name').textContent = this.labName;
    document.title = `${this.labName} · LabTracer`;
    this.updateStatus();
    if (this.migratedFrom) toast(`Upgraded "${this.labName}" from format ${m.from} to ${m.to}. The next save keeps a copy of the old file${store.mode === 'server' ? ' in data/labs/.history' : ''}.`, 'info', 7000);
  }
  /** true if the lab was opened. */
  async openLab(name) {
    try { this.loadLab(await store.loadLab(name), name); return true; }
    catch (e) { toast(`Could not open ${name}: ${e.message}`, 'err', 8000); return false; }
  }
  /** Saves run one after another, so autosave and Ctrl+S never send the same base version twice.
   *  opts.force: overwrite a lab that another window saved after this one loaded it. */
  save(quiet = false, opts = {}) {
    const run = () => this.doSave(quiet, opts);
    this.saveChain = (this.saveChain || Promise.resolve()).then(run, run);
    return this.saveChain;
  }
  async doSave(quiet, { force = false } = {}) {
    if (!this.lab) return;
    const ae = document.activeElement;
    if (!quiet && ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && !ae.classList.contains('term-in')) ae.dispatchEvent(new Event('change'));
    try {
      this.lab.view.mode = this.inventoryOn ? 'inventory' : this.viewport.mode;
      this.lab.view.mode3d = this.viewport.mode; this.lab.view.roomId = this.roomId;
      const rev = this.rev, name = this.labName, keepCopy = !!this.migratedFrom;
      await store.saveLab(name, this.lab, { force, keepCopy, oldVersion: this.migratedFrom });
      if (this.rev === rev && this.labName === name) this.dirty = false;
      if (keepCopy && this.labName === name) this.migratedFrom = null;
      this.conflict = false; this.saveBlocked = false; this.lastSaved = Date.now(); this.updateStatus();
      if (!quiet) toast(store.mode === 'server' ? `Saved ${this.labName}` : `Saved ${this.labName} in this browser`, 'ok');
    } catch (e) {
      if (e.conflict) this.onSaveConflict(quiet); // not awaited: it may call save() again
      else if (e.newer) { if (!this.saveBlocked || !quiet) toast('Not saved: ' + e.message, 'err', 12000); this.saveBlocked = true; } // autosave stops
      else toast('Save failed: ' + e.message, 'err', 5000);
    }
  }
  /** Another window or tab saved this lab after this window loaded it. */
  async onSaveConflict(quiet) {
    const first = !this.conflict;
    this.conflict = true; this.updateStatus();
    if (quiet) { // autosave: stop and tell once; the next Ctrl+S asks what to keep
      if (first) toast(`Autosave paused: another window saved "${this.labName}". Press Ctrl+S to choose which version to keep.`, 'warn', 9000);
      return;
    }
    const name = this.labName;
    if (await confirmBox('Lab changed in another window',
      `Another window or tab saved "${name}" after this window opened it. Replace that version with the version in this window? The other version stays in data/labs/.history.`,
      'Replace', true)) {
      if (this.labName === name) this.save(false, { force: true });
    } else toast('Not saved. To keep both, use File > Save as… here. To get the other version, open the lab again (File > Open lab).', 'info', 9000);
  }
  async labExists(name) {
    try { return (await store.listLabs()).some(l => l.name === name); } catch { return false; }
  }
  /** base, base-2, base-3 … : the first name not used by a saved lab. */
  async freeLabName(base) {
    let names;
    try { names = new Set((await store.listLabs()).map(l => l.name)); } catch { return base; }
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  async confirmOverwrite(name) {
    return !(await this.labExists(name)) || confirmBox('Lab exists', `A lab called "${name}" exists. Replace it? (A copy stays in data/labs/.history in server mode.)`, 'Replace', true);
  }
  confirmDiscard() {
    return !this.dirty || confirmBox('Unsaved changes', 'Discard unsaved changes to the current lab?', 'Discard', true);
  }
  /** The custom object library. A library from a newer LabTracer is not used and never saved over. */
  async loadLibrary() {
    this.libraryLocked = false; this.libraryMigratedFrom = null;
    try {
      const m = migrateLibrary(await store.loadLibrary());
      this.library.setCustom(m.doc.templates);
      if (m.from < m.to) this.libraryMigratedFrom = m.from;
    } catch (e) {
      if (e.newer) this.libraryLocked = true;
      toast(`Could not load the custom library: ${e.message}.${this.libraryLocked ? ' Custom objects are off, and LabTracer does not change the library file.' : ''}`, 'err', 10000);
    }
  }
  async saveLibrary() {
    if (this.libraryLocked) { toast('The custom library is from a newer LabTracer, so it is not saved. Update LabTracer.', 'err', 6000); return; }
    try {
      await store.saveLibrary({ version: LIBRARY_VERSION, templates: this.library.custom }, { keepCopy: !!this.libraryMigratedFrom, oldVersion: this.libraryMigratedFrom });
      this.libraryMigratedFrom = null;
    } catch (e) { toast('Library save failed: ' + e.message, 'err', 5000); }
  }

  // ---------------------------------------------------------------- change tracking
  /** Call after mutating this.lab. scope: 'all' | 'links' | 'none' | {dev: id} */
  commit(label, scope = 'all') {
    if (!this.history.record(this.lab, label)) { this.inspector.render(); return; }
    this.rev++;
    this.dirty = true;
    if (this.inventoryOn) this.viewportStale = scope !== 'none' || this.viewportStale; // rebuild when the 3D view comes back
    else if (scope === 'all') this.viewport.rebuildAll();
    else if (scope === 'links') this.viewport.refreshLinks();
    else if (scope && scope.dev) this.viewport.refreshDevice(scope.dev);
    if (this.selection && !this.selectionExists()) this.selection = null;
    this.ssh.prune(); // close sessions of deleted devices
    this.remote.prune();
    if (this.inventoryOn) this.inventory.render();
    this.inspector.render();
    this.renderRoomSelect();
    this.updateStatus(label);
    this.refreshDrift();
    if (this.monitor?.live) this.monitor.schedulePush();
  }
  selectionExists() {
    const s = this.selection;
    return s && (s.type === 'device' ? !!devById(this.lab, s.id) : this.lab.links.some(l => l.id === s.id));
  }
  undo() {
    const r = this.history.undo(); if (!r) return toast('Nothing to undo', 'warn', 1200);
    this.restore(r.lab); toast('Undo: ' + r.label, 'info', 1400);
  }
  redo() {
    const r = this.history.redo(); if (!r) return;
    this.restore(r.lab); toast('Redo: ' + r.label, 'info', 1400);
  }
  /** Show a lab state from the history. Uncommitted edits are dropped. */
  restore(lab) {
    this.lab = lab; this.rev++; this.dirty = true;
    if (!this.selectionExists()) this.selection = null;
    if (!this.lab.rooms.some(r => r.id === this.roomId)) this.roomId = this.lab.rooms[0]?.id || null;
    this.ssh.prune();
    this.remote.prune();
    if (this.inventoryOn) { this.viewportStale = true; this.inventory.render(); } else this.viewport.rebuildAll();
    this.inspector.render(); this.renderRoomSelect(); this.updateStatus();
    this.refreshDrift();
    if (this.monitor?.live) this.monitor.schedulePush();
  }

  // ---------------------------------------------------------------- selection and tools
  select(sel) {
    this.selection = sel;
    this.viewport.setSelection(sel);
    if (this.inventoryOn) this.inventory.renderBody();
    this.inspector.render();
  }
  setTool(tool) {
    this.cancelTools(tool);
    this.tool = tool;
    this.viewport.tool = tool;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
    this.updateStatus();
  }
  cancelTools(keep) {
    if (keep !== 'place') { this.placingTpl = null; this.palette && this.palette.render(); }
    this.linkStart = null;
    this.viewport && this.viewport.setLinkSource(null);
    closePopup();
    if (!keep) { this.tool = 'select'; if (this.viewport) this.viewport.tool = 'select'; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === 'select')); }
  }

  // ---------------------------------------------------------------- views
  /** mode: 'topo' | 'room' (3D views) | 'inventory' (table; the 3D view keeps its own mode underneath). */
  setMode(mode) {
    const inv = mode === 'inventory';
    if (inv ? this.inventoryOn : (!this.inventoryOn && mode === this.viewport.mode)) return;
    this.cancelTools();
    this.inventoryOn = inv;
    this.inventory.show(inv);
    if (!inv) {
      if (mode !== this.viewport.mode) this.viewport.setMode(mode); // rebuilds
      else if (this.viewportStale) this.viewport.rebuildAll();
      else this.viewport.requestRender();
      this.viewportStale = false;
    }
    this.lab.view.mode = mode;
    this.syncModeButtons();
    this.updateStatus();
  }
  syncModeButtons() {
    const cur = this.inventoryOn ? 'inventory' : this.viewport.mode;
    document.body.classList.toggle('inv-mode', this.inventoryOn);
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === cur));
    document.getElementById('room-select').style.display = this.viewport.mode === 'room' ? '' : 'none';
    document.getElementById('tg-cables').style.display = this.viewport.mode === 'room' ? '' : 'none';
    document.getElementById('tg-ports').style.display = this.viewport.mode === 'topo' ? '' : 'none';
  }
  currentRoom() { return this.lab.rooms.find(r => r.id === this.roomId) || null; }
  setRoom(id) {
    this.roomId = id; this.lab.view.roomId = id; this.renderRoomSelect();
    if (this.viewport.mode !== 'room') this.setMode('room'); else { this.viewport.rebuildAll(); this.viewport.fit(); }
    this.inspector.render();
  }
  renderRoomSelect() {
    const sel = document.getElementById('room-select');
    clear(sel);
    for (const r of this.lab.rooms) sel.appendChild(h('option', { value: r.id, selected: r.id === this.roomId ? 'selected' : null }, r.name));
    if (!this.lab.rooms.length) sel.appendChild(h('option', { value: '' }, '(no rooms)'));
  }
  openConsole(id) {
    const d = devById(this.lab, id);
    this.selection = { type: 'device', id };
    this.viewport.setSelection(this.selection);
    this.panels.show('right'); // a double-click asks for the panel: show it even if it is hidden
    if (d?.physicalOnly) { // rack, desk, shelf: double-click renames instead
      this.inspector.tab = 'general'; this.inspector.render();
      const inp = document.querySelector('#inspector [data-k="name"]'); if (inp) { inp.focus(); inp.select(); }
      return;
    }
    this.inspector.tab = 'console'; this.inspector.render();
  }

  async toggleLive() {
    if (this.monitor.live) this.monitor.stop();
    else if (await this.monitor.start()) toast('Live status on', 'ok', 1500);
    this.onMonitorStatus();
  }
  onMonitorStatus() {
    const m = this.monitor;
    this.viewport.applyStatus(m.states());
    const btn = document.getElementById('tg-live');
    btn.classList.toggle('on', m.live);
    btn.classList.toggle('err', m.live && !!m.error);
    let txt = 'Live';
    if (m.live && m.status) {
      const c = { up: 0, degraded: 0, down: 0 };
      for (const st of m.states().values()) if (st in c) c[st]++;
      txt = `Live ${c.up}↑` + (c.degraded ? ` ${c.degraded}!` : '') + (c.down ? ` ${c.down}↓` : '');
      btn.title = m.error ? 'Agent error: ' + m.error : `Agent ${m.status.host}: ${c.up} up, ${c.degraded} degraded, ${c.down} down`;
    } else btn.title = 'Live status from the check agent';
    btn.textContent = txt;
    const ae = document.activeElement;
    const typing = ae && document.getElementById('inspector').contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (!typing) this.inspector.render();
  }

  /** New facts or a collection step: drift badges, inspector and inventory. */
  onDriftChanged() {
    this.refreshDrift();
    if (this.inventoryOn) this.inventory.renderBody();
    const ae = document.activeElement;
    const typing = ae && document.getElementById('inspector').contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (!typing) this.inspector.render();
  }
  refreshDrift() { if (this.collect && this.viewport) this.viewport.applyDrift(this.collect.summary()); }

  animatePing(r) {
    if (!r) return;
    const steps = [];
    for (const hp of r.fwd?.hops || []) steps.push(...hp.path);
    if (r.ok && r.back) for (const hp of r.back.hops) steps.push(...hp.path);
    this.viewport.animatePacket(steps, r.ok, () => { if (!r.ok && r.fwd?.at) this.viewport.flashDevice(r.fwd.at.id); });
    if (!r.ok && r.back?.at) this.viewport.flashDevice(r.back.at.id);
    if (!r.ok && !steps.length && r.fwd?.at) this.viewport.flashDevice(r.fwd.at.id);
  }

  // ---------------------------------------------------------------- chrome
  bindToolbar() {
    const $ = id => document.getElementById(id);
    $('btn-file').onclick = e => this.fileMenu(e.currentTarget);
    $('btn-save').onclick = () => this.save();
    $('btn-undo').onclick = () => this.undo();
    $('btn-redo').onclick = () => this.redo();
    $('btn-fit').onclick = () => this.viewport.fit();
    $('btn-top').onclick = () => this.viewport.top();
    $('btn-help').onclick = () => this.helpDialog();
    $('tg-live').onclick = () => this.toggleLive();
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => this.setMode(b.dataset.mode));
    document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => this.setTool(b.dataset.tool));
    $('room-select').onchange = e => this.setRoom(e.target.value);
    const med = $('link-medium');
    for (const [k, l] of MEDIA) med.appendChild(h('option', { value: k }, l));
    med.onchange = e => { this.linkMedium = e.target.value; if (this.tool !== 'link') this.setTool('link'); };
    const tg = (id, k) => { $(id).onclick = () => { this.settings[k] = !this.settings[k]; this.applySettings(); }; };
    tg('tg-labels', 'labels'); tg('tg-ports', 'portLabels'); tg('tg-cables', 'cables'); tg('tg-snap', 'snap');
    this.syncToggles();
  }
  bindKeys() {
    document.addEventListener('keydown', e => {
      const ae = document.activeElement;
      if (ae && ae.closest && ae.closest('.xterm')) return; // keys belong to the SSH terminal (Ctrl+S, Ctrl+O too)
      const typing = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable || (ae.tagName === 'INPUT' && !NOT_TEXT.has(ae.type)));
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); return; }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); this.openDialog(); return; }
      if (typing || document.querySelector('.modal-back')) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSelected(); return; }
      if (mod) return;
      if (this.inventoryOn && 'vVlLfFtTrR'.includes(e.key)) return; // 3D tools do nothing in the table
      switch (e.key) {
        case 'Escape': if (this.tool !== 'select' || this.linkStart) this.setTool('select'); else this.select(null); break;
        case 'Delete': case 'Backspace': e.preventDefault(); this.deleteSelection(); break;
        case 'v': case 'V': this.setTool('select'); break;
        case 'l': case 'L': this.setTool('link'); break;
        case 'f': case 'F': this.viewport.fit(); break;
        case 't': case 'T': this.viewport.top(); break;
        case 'r': this.rotateSelected(90); break;
        case 'R': this.rotateSelected(-90); break;
        case '1': this.setMode('topo'); break;
        case '2': this.setMode('room'); break;
        case '3': this.setMode('inventory'); break;
        case '?': this.helpDialog(); break;
        case '[': this.panels.toggle('left'); break;
        case ']': this.panels.toggle('right'); break;
      }
    });
  }
  updateStatus(msg) {
    const st = document.getElementById('status-left');
    let hint = '';
    if (this.tool === 'place') hint = `Placing ${this.library.get(this.placingTpl)?.name || ''}: click on the floor. Esc to stop.`;
    else if (this.tool === 'link') hint = this.linkStart ? 'Click the second device.' : 'Link tool: click the first device. Esc to stop.';
    else if (this.inventoryOn) hint = 'Inventory · click a row to edit it on the right · double-click to show it in 3D · click a column name to sort';
    else hint = this.viewport?.mode === 'room' ? 'Room view · drag to move · R rotates · racks: select one, see Physical tab' : 'Topology view · drag to move · double-click for console';
    if (st) st.textContent = hint;
    const sr = document.getElementById('status-right');
    if (sr && this.lab) sr.textContent = `${this.conflict ? '⚠ not saved: changed in another window · ' : ''}${this.dirty ? '● unsaved' :(this.lastSaved ? 'saved ' + new Date(this.lastSaved).toLocaleTimeString() : 'saved')}${msg ? ' · ' + msg : ''}`;
    document.getElementById('btn-save')?.classList.toggle('dirty', !!this.dirty);
  }
}

mixin(App, Placement, Linking, Edits, LabFiles, SettingsUi);

const app = new App();
window.labtracer = app; // handy for debugging in the browser console
app.init().catch(e => { console.error(e); toast('Startup failed: ' + e.message, 'err', 10000); });
