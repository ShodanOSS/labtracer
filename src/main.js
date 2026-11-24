// LabTracer app shell: state, undo, persistence, tools, keyboard.
import { h, clear, uid, clone, download, pickFile, readFileText, safeName, fmtTime } from './util.js';
import { store, makeTar } from './store.js';
import {
  Library, newLab, normalizeLab, createDevice, devById, portById, linksOfPort, portIsFree, removeDevice, removePort,
  duplicateDevice, uniqueName, makePort, isRack, isFurniture, deviceRoomId, rackFirstFree, LINKABLE, MULTI_LINK,
} from './model.js';
import { Viewport } from './viewport.js';
import { Palette, compressPorts } from './palette.js';
import { Inspector } from './inspector.js';
import { Cli, runningConfig } from './cli.js';
import { buildSampleLab } from './sample.js';
import { modal, toast, promptText, confirmBox, popup, closePopup } from './dialogs.js';
import { MEDIA } from './templates.js';
import { Monitor } from './monitor.js';

const DEFAULT_SETTINGS = {
  antialias: true, pixelCap: 1.25, labels: true, portLabels: true, cables: true, powerLinks: true,
  rackLabels: false, snap: true, autosave: true, lockLayout: false, portAnchors: true, gridColor: '#2b4a35', bgColor: '#0c130e',
};

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
    this.undoStack = []; this.redoStack = [];
    this.snap = null;
    this.dirty = false;
    this.roomId = null;
  }

  async init() {
    await store.init();
    try { this.library.setCustom((await store.loadLibrary()).templates); } catch (e) { toast('Could not load the custom library: ' + e.message, 'err'); }
    this.viewport = new Viewport(document.getElementById('viewport'), this);
    this.palette = new Palette(document.getElementById('palette'), this);
    this.inspector = new Inspector(document.getElementById('inspector'), this);
    this.cli = new Cli(this);
    this.monitor = new Monitor(this);
    await this.monitor.loadConfig();
    this.bindToolbar();
    this.bindKeys();
    this.palette.render();

    let labs = [];
    try { labs = await store.listLabs(); } catch { /* none */ }
    const last = store.getPref('lastLab', null);
    const pick = labs.find(l => l.name === last) || labs[0];
    if (pick) await this.openLab(pick.name);
    else { this.loadLab(buildSampleLab(), 'example-lab'); await this.save(true); toast('Created an example lab. Edit it, or start a new one from File > New lab.', 'info', 5000); }

    setInterval(() => { if (this.dirty && this.settings.autosave && store.mode === 'server') this.save(true); }, 30000);
    window.addEventListener('beforeunload', e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    this.updateStatus();
    document.getElementById('mode-badge').textContent = store.mode === 'server' ? 'Saved to disk' : 'Browser storage';
    document.getElementById('mode-badge').title = store.mode === 'server' ? `Data folder: ${store.dataPath}` : 'Opened without server.py: labs live in this browser. Use File > Export to keep copies.';
  }

  // ---------------------------------------------------------------- lab lifecycle
  loadLab(lab, name) {
    this.lab = normalizeLab(lab);
    this.labName = safeName(name || lab.name || 'lab');
    this.lab.name = this.labName;
    this.roomId = this.lab.view.roomId && this.lab.rooms.some(r => r.id === this.lab.view.roomId) ? this.lab.view.roomId : (this.lab.rooms[0]?.id || null);
    this.selection = null;
    this.undoStack = []; this.redoStack = [];
    this.snap = JSON.stringify(this.lab);
    this.dirty = false;
    this.cancelTools();
    this.viewport.camState = {};
    this.viewport.mode = this.lab.view.mode === 'room' ? 'room' : 'topo';
    this.syncModeButtons();
    this.viewport.rebuildAll();
    this.viewport.fit();
    this.inspector.render();
    this.renderRoomSelect();
    store.setPref('lastLab', this.labName);
    if (this.monitor?.live) this.monitor.schedulePush();
    document.getElementById('lab-name').textContent = this.labName;
    document.title = `${this.labName} · LabTracer`;
    this.updateStatus();
  }
  async openLab(name) {
    try { this.loadLab(await store.loadLab(name), name); }
    catch (e) { toast(`Could not open ${name}: ${e.message}`, 'err'); }
  }
  async save(quiet = false) {
    if (!this.lab) return;
    const ae = document.activeElement;
    if (!quiet && ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && !ae.classList.contains('term-in')) ae.dispatchEvent(new Event('change'));
    try {
      this.lab.view.mode = this.viewport.mode; this.lab.view.roomId = this.roomId;
      await store.saveLab(this.labName, this.lab);
      this.dirty = false; this.lastSaved = Date.now(); this.updateStatus();
      if (!quiet) toast(store.mode === 'server' ? `Saved ${this.labName}` : `Saved ${this.labName} in this browser`, 'ok');
    } catch (e) { toast('Save failed: ' + e.message, 'err', 5000); }
  }
  async saveLibrary() {
    try { await store.saveLibrary({ templates: this.library.custom }); }
    catch (e) { toast('Library save failed: ' + e.message, 'err', 5000); }
  }

  // ---------------------------------------------------------------- change tracking
  /** Call after mutating this.lab. scope: 'all' | 'links' | 'none' | {dev: id} */
  commit(label, scope = 'all') {
    const now = JSON.stringify(this.lab);
    if (now === this.snap) { this.inspector.render(); return; }
    this.undoStack.push({ s: this.snap, label });
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
    this.snap = now;
    this.dirty = true;
    if (scope === 'all') this.viewport.rebuildAll();
    else if (scope === 'links') this.viewport.refreshLinks();
    else if (scope && scope.dev) this.viewport.refreshDevice(scope.dev);
    if (this.selection && !this.selectionExists()) this.selection = null;
    this.inspector.render();
    this.renderRoomSelect();
    this.updateStatus(label);
    if (this.monitor?.live) this.monitor.schedulePush();
  }
  selectionExists() {
    const s = this.selection;
    return s && (s.type === 'device' ? !!devById(this.lab, s.id) : this.lab.links.some(l => l.id === s.id));
  }
  undo() {
    const e = this.undoStack.pop(); if (!e) return toast('Nothing to undo', 'warn', 1200);
    this.redoStack.push({ s: this.snap, label: e.label });
    this.restore(e.s); toast('Undo: ' + e.label, 'info', 1400);
  }
  redo() {
    const e = this.redoStack.pop(); if (!e) return;
    this.undoStack.push({ s: this.snap, label: e.label });
    this.restore(e.s); toast('Redo: ' + e.label, 'info', 1400);
  }
  restore(s) {
    this.lab = JSON.parse(s); this.snap = s; this.dirty = true;
    if (!this.selectionExists()) this.selection = null;
    if (!this.lab.rooms.some(r => r.id === this.roomId)) this.roomId = this.lab.rooms[0]?.id || null;
    this.viewport.rebuildAll(); this.inspector.render(); this.renderRoomSelect(); this.updateStatus();
  }

  // ---------------------------------------------------------------- selection and tools
  select(sel) {
    this.selection = sel;
    this.viewport.setSelection(sel);
    if (sel && sel.type === 'device' && this.inspector.tab === 'physical') { /* keep tab */ }
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
  startPlacing(tid) {
    if (this.placingTpl === tid) { this.setTool('select'); return; }
    this.setTool('place');
    this.placingTpl = tid;
    this.palette.render();
    this.updateStatus();
  }
  placeAt(point) { if (this.placingTpl) this.placeTemplate(this.placingTpl, point); }
  placeTemplate(tid, point) {
    const tpl = this.library.get(tid); if (!tpl) return;
    const lab = this.lab;
    const mode = this.viewport.mode;
    if (mode === 'topo' && tpl.physicalOnly) { toast(`${tpl.name} is a room object. Switch to the room view to place it.`, 'warn'); return; }
    if (mode === 'room' && (tpl.virtual || tpl.logical)) { toast(`${tpl.name} is logical only. Place it in the topology view.`, 'warn'); return; }
    if (mode === 'room' && !this.roomId) { toast('Add a room first (Lab panel)', 'warn'); return; }
    const d = createDevice(tpl, { name: uniqueName(lab, defaultName(tpl)) });
    const snapv = v => this.viewport.snap(v);
    if (mode === 'topo') { d.topo.x = snapv(point.x); d.topo.z = snapv(point.z); }
    else {
      d.phys.roomId = this.roomId; d.phys.x = snapv(point.x); d.phys.z = snapv(point.z);
      // logical position: near the centre of existing devices
      const xs = lab.devices.filter(x => !x.physicalOnly);
      d.topo.x = xs.length ? Math.round(xs.reduce((a, x) => a + x.topo.x, 0) / xs.length) + 2 : 0;
      d.topo.z = xs.length ? Math.max(...xs.map(x => x.topo.z)) + 2 : 0;
      if (!this.autoRack(d)) this.autoElevate(d);
    }
    lab.devices.push(d);
    this.selection = { type: 'device', id: d.id };
    this.commit('Add ' + d.name, 'all');
    if (!this.placeMulti) this.setTool('select');
  }
  placeInRoom(d) {
    const r = this.currentRoom(); if (!r) return;
    Object.assign(d.phys, { roomId: r.id, mount: 'floor', rackId: null, rackU: null, x: r.w / 2, z: r.d / 2 });
    this.autoElevate(d);
    this.commit('Place ' + d.name, 'all');
    if (this.viewport.mode !== 'room') this.setMode('room');
  }

  /** After a drag in the viewport (model already updated). */
  afterDrag(d) {
    if (this.viewport.mode === 'room' && !isRack(d) && !isFurniture(d)) {
      if (this.autoRack(d)) { this.commit('Mount ' + d.name, 'all'); return; }
      this.autoElevate(d);
    }
    this.commit('Move ' + d.name, { dev: d.id });
  }
  furnitureUnder(d) {
    const rid = deviceRoomId(this.lab, d);
    for (const f of this.lab.devices) {
      if (!isFurniture(f) || f.phys.roomId !== rid || f.id === d.id) continue;
      const rot = ((f.phys.rot || 0) % 180 + 180) % 180;
      const hw = (rot === 90 ? f.dims.d : f.dims.w) / 2, hd = (rot === 90 ? f.dims.w : f.dims.d) / 2;
      if (Math.abs(d.phys.x - f.phys.x) <= hw && Math.abs(d.phys.z - f.phys.z) <= hd) return f;
    }
    return null;
  }
  /** Dropped on a rack in the room view: mount it in the first free slot. */
  autoRack(d) {
    if (!(d.uHeight > 0) || isRack(d) || d.phys.mount === 'rack') return false;
    for (const r of this.lab.devices) {
      if (!isRack(r) || r.phys.roomId !== d.phys.roomId) continue;
      const rot = ((r.phys.rot || 0) % 180 + 180) % 180;
      const hw = (rot === 90 ? r.dims.d : r.dims.w) / 2, hd = (rot === 90 ? r.dims.w : r.dims.d) / 2;
      if (Math.abs(d.phys.x - r.phys.x) > hw || Math.abs(d.phys.z - r.phys.z) > hd) continue;
      const u = rackFirstFree(this.lab, r, d);
      if (!u) { toast(`${r.name} is full`, 'warn'); return false; }
      Object.assign(d.phys, { mount: 'rack', rackId: r.id, rackU: u });
      toast(`Mounted ${d.name} in ${r.name} at U${u}`, 'ok', 1800);
      return true;
    }
    return false;
  }
  autoElevate(d) {
    if (!d.phys.elevAuto || isRack(d) || isFurniture(d) || d.phys.mount === 'rack') return;
    const f = this.furnitureUnder(d);
    if (!f || !f.levels?.length) { d.phys.elev = 0; return; }
    const lv = f.levels;
    d.phys.elev = lv.includes(d.phys.elev) ? d.phys.elev : lv[lv.length === 1 ? 0 : Math.min(1, lv.length - 1)];
  }

  // ---------------------------------------------------------------- linking
  linkClick(devId, x, y) {
    const lab = this.lab, d = devById(lab, devId);
    if (this.linkStart && this.linkStart.dev === devId) { this.cancelLink(); return; }
    const choose = portId => {
      if (!this.linkStart) {
        this.linkStart = { dev: devId, port: portId };
        this.viewport.setLinkSource(devId);
        this.updateStatus();
      } else {
        const a = this.linkStart, b = { dev: devId, port: portId };
        const pa = portById(devById(lab, a.dev), a.port), pb = portById(d, portId);
        if ((pa.kind === 'power') !== (pb.kind === 'power')) { toast('Power ports only connect to power ports', 'err'); return; }
        const medium = this.linkMedium !== 'auto' ? this.linkMedium : autoMedium(pa, pb);
        lab.links.push({ id: uid('ln'), a, b, medium, label: '', notes: '' });
        this.linkStart = null; this.viewport.setLinkSource(null);
        this.commit(`Link ${d.name}`, 'all');
        toast(`Linked ${devById(lab, a.dev).name}:${pa.name} ↔ ${d.name}:${pb.name}`, 'ok', 1800);
      }
    };
    const ports = d.ports.filter(p => LINKABLE.has(p.kind));
    const free = ports.filter(p => portIsFree(lab, d, p));
    const items = [];
    if (free.length) items.push({ label: 'First free port', sub: free[0].name, cls: 'accent', onClick: () => choose(free[0].id) }, '-');
    for (const p of ports) {
      const used = linksOfPort(lab, d.id, p.id);
      const ok = portIsFree(lab, d, p);
      items.push({ label: p.name, sub: `${p.kind}${p.speed ? ' ' + p.speed : ''}${used.length ? (MULTI_LINK.has(p.kind) ? ` · ${used.length} peer(s)` : ' · in use') : ''}`, disabled: !ok, onClick: () => choose(p.id) });
    }
    items.push('-', { label: 'New port…', sub: 'add a port to this device', onClick: async () => {
      const name = await promptText('New port', `Port name on ${d.name}`, nextPortName(d));
      if (!name) return;
      const np = makePort({ name, kind: name.startsWith('wg') ? 'tunnel' : (name.startsWith('wl') ? 'wifi' : (d.virtual ? 'vport' : 'eth')), mode: d.l2 ? 'access' : 'routed' });
      d.ports.push(np); choose(np.id);
    } });
    popup(x, y, this.linkStart ? `To ${d.name}` : `From ${d.name}`, items);
  }
  cancelLink() { this.linkStart = null; this.viewport.setLinkSource(null); this.updateStatus(); }

  removePortRaw(dev, portId) { removePort(this.lab, dev, portId); }

  // ---------------------------------------------------------------- edits
  deleteSelection() {
    const s = this.selection; if (!s) return;
    if (s.type === 'device') { const d = devById(this.lab, s.id); removeDevice(this.lab, s.id); this.selection = null; this.commit('Delete ' + (d?.name || 'device'), 'all'); }
    else { this.lab.links = this.lab.links.filter(l => l.id !== s.id); this.selection = null; this.commit('Delete link', 'all'); }
  }
  duplicateSelected() {
    const s = this.selection; if (!s || s.type !== 'device') return;
    const c = duplicateDevice(this.lab, devById(this.lab, s.id));
    this.selection = { type: 'device', id: c.id };
    this.commit('Duplicate', 'all');
  }
  rotateSelected(deg = 90) {
    const s = this.selection; if (!s || s.type !== 'device') return;
    let d = devById(this.lab, s.id);
    if (d.phys.mount === 'rack') d = devById(this.lab, d.phys.rackId) || d;
    d.phys.rot = (((d.phys.rot || 0) + deg) % 360 + 360) % 360;
    this.commit('Rotate', 'all');
  }
  applyTemplateToDevices(t) {
    let n = 0;
    for (const d of this.lab.devices) if (d.templateId === t.id) {
      Object.assign(d, { shape: t.shape, face: t.face, bays: t.bays || 0, dims: { ...t.dims }, color: t.color, uHeight: t.uHeight || 0 }); n++;
    }
    if (n) this.commit(`Update ${n} device(s) from template`, 'all');
  }
  async saveDeviceAsTemplate(d) {
    const name = await promptText('Save as custom object', 'Template name', [d.vendor, d.model].filter(Boolean).join(' ') || d.name);
    if (!name) return;
    const t = {
      id: 'cus_' + uid('t').slice(3), name, category: d.category === 'Custom' ? 'Custom' : d.category, shape: d.shape, face: d.face, bays: d.bays,
      dims: { ...d.dims }, uHeight: d.uHeight, rackUnits: d.rackUnits, levels: d.levels, color: d.color, l2: d.l2, l3: d.l3,
      virtual: d.virtual, physicalOnly: d.physicalOnly, logical: d.logical, passthrough: d.passthrough, vendor: d.vendor, model: d.model,
      ports: d.ports.filter(p => !['svi', 'sub', 'loop'].includes(p.kind)).map(p => ({ name: p.name, kind: p.kind, speed: p.speed, mode: p.mode })),
      attrs: Object.fromEntries(d.attrs.filter(a => a.k).map(a => [a.k, ''])),
    };
    const src = this.library.get(d.templateId); if (src?.modelData) t.modelData = src.modelData;
    t.portRows = compressPorts(t.ports);
    this.library.custom.push(t); await this.saveLibrary(); this.palette.render();
    toast(`Added "${name}" to the library`, 'ok');
  }

  // ---------------------------------------------------------------- views
  setMode(mode) {
    if (mode === this.viewport.mode) return;
    this.cancelTools();
    this.viewport.setMode(mode);
    this.lab.view.mode = mode;
    this.syncModeButtons();
    this.updateStatus();
  }
  syncModeButtons() {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === this.viewport.mode));
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
  openConsole(id) { this.selection = { type: 'device', id }; this.inspector.tab = 'console'; this.viewport.setSelection(this.selection); this.inspector.render(); }

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

  animatePing(r) {
    if (!r) return;
    const steps = [];
    for (const hp of r.fwd?.hops || []) steps.push(...hp.path);
    if (r.ok && r.back) for (const hp of r.back.hops) steps.push(...hp.path);
    this.viewport.animatePacket(steps, r.ok, () => { if (!r.ok && r.fwd?.at) this.viewport.flashDevice(r.fwd.at.id); });
    if (!r.ok && r.back?.at) this.viewport.flashDevice(r.back.at.id);
    if (!r.ok && !steps.length && r.fwd?.at) this.viewport.flashDevice(r.fwd.at.id);
  }

  // ---------------------------------------------------------------- file menu
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
      { label: 'Export inventory (.csv)', onClick: () => this.exportCsv() },
      '-',
      { label: 'Load example lab…', onClick: async () => { if (await confirmBox('Example lab', 'Open the example lab as a new lab called "example-lab"?')) { this.loadLab(buildSampleLab(), 'example-lab'); this.dirty = true; this.updateStatus(); } } },
      { label: 'Delete this lab…', cls: 'danger', onClick: () => this.deleteLab() },
      '-',
      { label: 'Settings…', onClick: () => this.settingsDialog() },
      { label: 'Keyboard and help…', sub: '?', onClick: () => this.helpDialog() },
    ]);
  }
  async newLabDialog() {
    if (this.dirty && !await confirmBox('Unsaved changes', 'Discard unsaved changes to the current lab?', 'Discard', true)) return;
    const name = await promptText('New lab', 'Lab name', 'new-lab', 'Create'); if (!name) return;
    this.loadLab(newLab(safeName(name)), name); await this.save(true);
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
    const name = await promptText('Save as', 'New lab name', this.labName + '-copy', 'Save'); if (!name) return;
    this.labName = safeName(name); this.lab.name = this.labName;
    document.getElementById('lab-name').textContent = this.labName;
    store.setPref('lastLab', this.labName);
    await this.save();
  }
  async importLab() {
    const f = await pickFile('.json,application/json'); if (!f) return;
    try {
      const lab = JSON.parse(await readFileText(f));
      if (!lab.devices) throw new Error('not a LabTracer lab');
      const name = safeName(lab.name || f.name.replace(/\..*$/, ''));
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
    for (const d of devices) {
      if (d.physicalOnly) continue;
      files.push({ device: d.name, name: 'running-config.txt', content: runningConfig(this.lab, d) });
      for (const f of d.files) files.push({ device: d.name, name: f.name, content: f.content });
    }
    if (!files.length) return toast('No configs to export', 'warn');
    try {
      const r = await store.exportConfigs(this.labName, files);
      if (r) { toast(`Wrote ${r.files.length} file(s) to ${r.folder}`, 'ok', 5000); return; }
    } catch (e) { toast('Export failed: ' + e.message, 'err'); return; }
    download(`${this.labName}-configs.tar`, makeTar(files.map(f => ({ path: `${this.labName}/${safeName(f.device)}/${safeName(f.name)}`, content: f.content }))));
  }
  exportCsv() {
    const rows = [['name', 'category', 'vendor', 'model', 'serial', 'room', 'rack', 'U', 'addresses', 'notes']];
    for (const d of this.lab.devices) {
      const room = this.lab.rooms.find(r => r.id === deviceRoomId(this.lab, d))?.name || '';
      const rack = d.phys.mount === 'rack' ? devById(this.lab, d.phys.rackId)?.name || '' : '';
      rows.push([d.name, d.category, d.vendor, d.model, d.serial, room, rack, d.phys.rackU || '', d.ports.filter(p => p.ip).map(p => `${p.name}=${p.ip}`).join(' '), d.notes]);
    }
    download(`${this.labName}-inventory.csv`, rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  }
  settingsDialog() {
    const s = this.settings;
    const chk = (k, label, hint) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s[k], onchange: e => { s[k] = e.target.checked; this.applySettings(); } }), label, hint ? h('small', { class: 'muted' }, ' ' + hint) : null);
    modal('Settings', h('div', { class: 'settings' },
      h('h4', null, 'Performance'),
      chk('antialias', 'Smooth edges (antialiasing)', 'needs reload; turn off on slow PCs'),
      h('label', { class: 'fld' }, h('span', null, 'Render resolution cap'), h('select', { class: 'inp', onchange: e => { s.pixelCap = +e.target.value; this.applySettings(); } },
        [[0.75, '0.75× (fastest)'], [1, '1×'], [1.25, '1.25× (default)'], [1.5, '1.5×'], [2, '2× (sharpest)']].map(([v, l]) => h('option', { value: v, selected: s.pixelCap === v ? 'selected' : null }, l))), h('small', null, 'needs reload')),
      h('h4', null, 'Display'),
      h('div', { class: 'row2' },
        h('label', { class: 'fld' }, h('span', null, 'Grid colour'), h('div', { class: 'btnrow tight' },
          h('input', { class: 'inp color', type: 'color', value: s.gridColor, oninput: e => { s.gridColor = e.target.value; this.applyColors(); } }),
          h('button', { class: 'btn small', onclick: e => { s.gridColor = DEFAULT_SETTINGS.gridColor; e.target.previousSibling.value = s.gridColor; this.applyColors(); } }, 'Reset'))),
        h('label', { class: 'fld' }, h('span', null, '3D background'), h('div', { class: 'btnrow tight' },
          h('input', { class: 'inp color', type: 'color', value: s.bgColor, oninput: e => { s.bgColor = e.target.value; this.applyColors(); } }),
          h('button', { class: 'btn small', onclick: e => { s.bgColor = DEFAULT_SETTINGS.bgColor; e.target.previousSibling.value = s.bgColor; this.applyColors(); } }, 'Reset')))),
      chk('labels', 'Device labels'), chk('portLabels', 'Port names on links (topology)'), chk('powerLinks', 'Power links (topology)'),
      chk('cables', 'Cables (room)'), chk('portAnchors', 'Cables plug into their real port position', 'off = cables meet at the device centre'), chk('rackLabels', 'Labels for rack-mounted devices (room)'),
      h('h4', null, 'Editing'),
      chk('snap', 'Snap to grid'), chk('lockLayout', 'Lock layout (no dragging)'),
      chk('autosave', 'Autosave every 30 s', store.mode === 'server' ? '' : '(server mode only)')),
    [{ label: 'Reload now', onClick: () => { location.reload(); } }, { label: 'Done', primary: true }]);
  }
  applySettings() {
    store.setPref('settings', this.settings);
    this.syncToggles();
    this.viewport.rebuildAll();
  }
  applyColors() {
    store.setPref('settings', this.settings);
    this.viewport.rebuildEnv();
  }
  syncToggles() {
    const map = { 'tg-labels': 'labels', 'tg-ports': 'portLabels', 'tg-cables': 'cables', 'tg-snap': 'snap' };
    for (const [id, k] of Object.entries(map)) document.getElementById(id)?.classList.toggle('on', !!this.settings[k]);
  }
  helpDialog() {
    const rows = [['V', 'Select / move tool'], ['L', 'Link tool (click device, pick port, click second device)'], ['Esc', 'Cancel tool or close popup'],
      ['Del / Backspace', 'Delete selection'], ['Ctrl+D', 'Duplicate device'], ['R / Shift+R', 'Rotate in room view'], ['F', 'Fit view'], ['T', 'Top-down view'],
      ['1 / 2', 'Topology / room view'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S', 'Save'], ['Double-click', 'Open device console'],
      ['Left drag', 'Orbit (or move a device)'], ['Right drag', 'Pan'], ['Wheel', 'Zoom']];
    modal('Keyboard and mouse', h('div', null,
      h('table', { class: 'keys' }, rows.map(([k, v]) => h('tr', null, h('td', null, h('kbd', null, k)), h('td', null, v)))),
      h('p', { class: 'muted small' }, 'Console: type ? in a device console for commands. "write memory" keeps a dated startup-config snapshot.')), [{ label: 'Close' }]);
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
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); return; }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); this.openDialog(); return; }
      if (typing || document.querySelector('.modal-back')) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSelected(); return; }
      if (mod) return;
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
        case '?': this.helpDialog(); break;
      }
    });
  }
  updateStatus(msg) {
    const st = document.getElementById('status-left');
    let hint = '';
    if (this.tool === 'place') hint = `Placing ${this.library.get(this.placingTpl)?.name || ''}: click on the floor. Esc to stop.`;
    else if (this.tool === 'link') hint = this.linkStart ? 'Click the second device.' : 'Link tool: click the first device. Esc to stop.';
    else hint = this.viewport?.mode === 'room' ? 'Room view · drag to move · R rotates · racks: select one, see Physical tab' : 'Topology view · drag to move · double-click for console';
    if (st) st.textContent = hint;
    const sr = document.getElementById('status-right');
    if (sr && this.lab) sr.textContent = `${this.dirty ? '● unsaved' : (this.lastSaved ? 'saved ' + new Date(this.lastSaved).toLocaleTimeString() : 'saved')}${msg ? ' · ' + msg : ''}`;
    document.getElementById('btn-save')?.classList.toggle('dirty', !!this.dirty);
  }
}

function autoMedium(a, b) {
  const k = new Set([a.kind, b.kind]);
  if (k.has('power')) return 'power';
  if (k.has('tunnel')) return 'tunnel';
  if (k.has('console') || k.has('usb')) return 'console';
  if (k.has('wifi')) return 'wireless';
  if (k.has('vport')) return 'virtual';
  if (k.has('sfp')) return 'fiber';
  return 'copper';
}
function defaultName(t) {
  const m = { Network: 'net', Compute: 'host', Storage: 'nas', Virtual: 'vm', Endpoints: 'client', Power: 'ups', WAN: 'wan', Infrastructure: t.shape };
  if (t.shape === 'rack') return 'Rack';
  if (t.shape === 'desk') return 'Desk';
  if (t.shape === 'shelf') return 'Shelf';
  return (m[t.category] || 'dev') + '-01';
}
function nextPortName(d) { let n = d.ports.length; while (d.ports.some(p => p.name === 'eth' + n)) n++; return 'eth' + n; }

const app = new App();
window.labtracer = app; // handy for debugging in the browser console
app.init().catch(e => { console.error(e); toast('Startup failed: ' + e.message, 'err', 10000); });
