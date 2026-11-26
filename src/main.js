// LabTracer app shell: state, undo, persistence, tools, keyboard.
import { h, clear, uid, clone, download, pickFile, readFileText, safeName, fmtTime } from './util.js';
import { store, makeTar } from './store.js';
import {
  Library, newLab, normalizeLab, createDevice, devById, portById, linksOfPort, portIsFree, removeDevice, removePort, portFamily,
  duplicateDevice, uniqueName, makePort, isRack, isFurniture, deviceRoomId, rackFirstFree, LINKABLE, MULTI_LINK,
  isDeployed, showsInTopology, showsInRoom,
} from './model.js';
import { InventoryView, exportInventoryCsv, inventoryItems } from './inventory.js';
import { Viewport } from './viewport.js';
import { Palette, compressPorts } from './palette.js';
import { Inspector } from './inspector.js';
import { Cli, runningConfig } from './cli.js';
import { buildSampleLab } from './sample.js';
import { modal, toast, promptText, confirmBox, popup, closePopup } from './dialogs.js';
import { MEDIA } from './templates.js';
import { Monitor } from './monitor.js';
import { SshManager } from './sshterm.js';

const DEFAULT_SETTINGS = {
  antialias: true, pixelCap: 1.25, labels: true, portLabels: true, cables: true, powerLinks: true,
  rackLabels: false, snap: true, autosave: true, lockLayout: false, portAnchors: true, gridColor: '#2b4a35', bgColor: '#0c130e',
  sshEngine: 'paramiko', showStored: false,
};

const UNDO_CHARS = 24e6; // cap undo memory (~50 MB) for big labs with config snapshots
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
    this.undoStack = []; this.redoStack = [];
    this.snap = null;
    this.dirty = false;
    this.roomId = null;
    this.inventoryOn = false;   // inventory table shown instead of the 3D view
    this.viewportStale = false; // lab changed while the 3D view was hidden
  }

  async init() {
    await store.init();
    try { this.library.setCustom((await store.loadLibrary()).templates); } catch (e) { toast('Could not load the custom library: ' + e.message, 'err'); }
    this.viewport = new Viewport(document.getElementById('viewport'), this);
    this.palette = new Palette(document.getElementById('palette'), this);
    this.inspector = new Inspector(document.getElementById('inspector'), this);
    this.cli = new Cli(this);
    this.monitor = new Monitor(this);
    this.ssh = new SshManager(this);
    const invEl = h('div', { class: 'inv', hidden: true });
    document.getElementById('viewport').appendChild(invEl);
    this.inventory = new InventoryView(invEl, this);
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

    setInterval(() => { if (this.dirty && !this.conflict && this.settings.autosave && store.mode === 'server') this.save(true); }, 30000);
    window.addEventListener('beforeunload', e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
    this.updateStatus();
    document.getElementById('mode-badge').textContent = store.mode === 'server' ? 'Saved to disk' : 'Browser storage';
    document.getElementById('mode-badge').title = store.mode === 'server' ? `Data folder: ${store.dataPath}` : 'Opened without server.py: labs live in this browser. Use File > Export to keep copies.';
  }

  // ---------------------------------------------------------------- lab lifecycle
  loadLab(lab, name) {
    this.ssh?.prune(true); // sessions belong to the devices of the old lab
    this.lab = normalizeLab(lab);
    this.labName = safeName(name || lab.name || 'lab');
    this.lab.name = this.labName;
    this.roomId = this.lab.view.roomId && this.lab.rooms.some(r => r.id === this.lab.view.roomId) ? this.lab.view.roomId : (this.lab.rooms[0]?.id || null);
    this.selection = null;
    this.undoStack = []; this.redoStack = [];
    this.snap = JSON.stringify(this.lab);
    this.dirty = false;
    this.conflict = false;
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
    document.getElementById('lab-name').textContent = this.labName;
    document.title = `${this.labName} · LabTracer`;
    this.updateStatus();
  }
  async openLab(name) {
    try { this.loadLab(await store.loadLab(name), name); }
    catch (e) { toast(`Could not open ${name}: ${e.message}`, 'err'); }
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
      const snap = this.snap, name = this.labName;
      await store.saveLab(name, this.lab, { force });
      if (this.snap === snap && this.labName === name) this.dirty = false;
      this.conflict = false; this.lastSaved = Date.now(); this.updateStatus();
      if (!quiet) toast(store.mode === 'server' ? `Saved ${this.labName}` : `Saved ${this.labName} in this browser`, 'ok');
    } catch (e) {
      if (e.conflict) this.onSaveConflict(quiet); // not awaited: it may call save() again
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
    let bytes = 0; for (const e of this.undoStack) bytes += e.s.length;
    while (this.undoStack.length > 1 && (this.undoStack.length > 80 || bytes > UNDO_CHARS)) bytes -= this.undoStack.shift().s.length;
    this.redoStack = [];
    this.snap = now;
    this.dirty = true;
    if (this.inventoryOn) this.viewportStale = scope !== 'none' || this.viewportStale; // rebuild when the 3D view comes back
    else if (scope === 'all') this.viewport.rebuildAll();
    else if (scope === 'links') this.viewport.refreshLinks();
    else if (scope && scope.dev) this.viewport.refreshDevice(scope.dev);
    if (this.selection && !this.selectionExists()) this.selection = null;
    this.ssh.prune(); // close sessions of deleted devices
    if (this.inventoryOn) this.inventory.render();
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
    this.ssh.prune();
    if (this.inventoryOn) { this.viewportStale = true; this.inventory.render(); } else this.viewport.rebuildAll();
    this.inspector.render(); this.renderRoomSelect(); this.updateStatus();
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
  startPlacing(tid) {
    if (this.inventoryOn) { this.addItem(tid); return; } // no 3D view to click in: add it straight away
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
      if (d.wall) this.snapToWall(d);
      else if (!this.autoRack(d)) this.autoElevate(d);
    }
    lab.devices.push(d);
    this.selection = { type: 'device', id: d.id };
    this.commit('Add ' + d.name, 'all');
    if (!this.placeMulti) this.setTool('select');
  }
  /** Inventory: add an item that is not placed anywhere yet. */
  addItem(tid, { name = '', status = 'active' } = {}) {
    const tpl = this.library.get(tid); if (!tpl || tpl.logical) return null;
    const lab = this.lab;
    const d = createDevice(tpl, { name: uniqueName(lab, name || defaultName(tpl)) });
    d.inv.status = status;
    const xs = lab.devices.filter(showsInTopology); // logical position: below the others
    d.topo.x = xs.length ? Math.round(xs.reduce((a, x) => a + x.topo.x, 0) / xs.length) : 0;
    d.topo.z = xs.length ? Math.max(...xs.map(x => x.topo.z)) + 2 : 0;
    lab.devices.push(d);
    this.selection = { type: 'device', id: d.id };
    this.commit('Add ' + d.name, 'all');
    this.inspector.tab = 'general'; this.inspector.render();
    return d;
  }
  /** Inventory double-click: show the item in the 3D view it is drawn in. */
  showInView(d) {
    if (!isDeployed(d) && !this.settings.showStored) {
      toast(`${d.name} is ${d.inv.status === 'ordered' ? 'on order' : d.inv.status}, so it is not drawn. Change its status, or turn on File > Settings > "Show spare, on-order and retired items".`, 'info', 6000);
      return;
    }
    const rid = showsInRoom(d) ? deviceRoomId(this.lab, d) : null;
    if (!showsInTopology(d) && !rid) { toast(`${d.name} is not in a room yet. Set its room in the Physical tab.`, 'info', 4000); return; }
    this.selection = { type: 'device', id: d.id };
    if (rid && (!showsInTopology(d) || this.viewport.mode === 'room')) {
      if (rid !== this.roomId) { this.roomId = rid; this.lab.view.roomId = rid; this.renderRoomSelect(); this.viewportStale = true; }
      this.setMode('room');
    } else this.setMode('topo');
    this.viewport.setSelection(this.selection);
    this.inspector.render();
  }
  placeInRoom(d) {
    const r = this.currentRoom(); if (!r) return;
    Object.assign(d.phys, { roomId: r.id, mount: 'floor', rackId: null, rackU: null, x: r.w / 2, z: r.d / 2 });
    if (d.wall) this.snapToWall(d); else this.autoElevate(d);
    this.commit('Place ' + d.name, 'all');
    if (this.viewport.mode !== 'room') this.setMode('room');
  }

  /** After a drag in the viewport (model already updated). */
  afterDrag(d) {
    if (this.viewport.mode === 'room' && d.wall) { this.snapToWall(d); this.commit('Move ' + d.name, { dev: d.id }); return; }
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
  /** Wall-mounted device: move it onto the nearest wall of its room, facing into the room. */
  snapToWall(d) {
    const r = this.lab.rooms.find(x => x.id === d.phys.roomId); if (!r) return;
    const p = d.phys, half = d.dims.d / 2 + 0.005, hw = d.dims.w / 2;
    const cx = Math.min(r.w - hw, Math.max(hw, p.x)), cz = Math.min(r.d - hw, Math.max(hw, p.z));
    const dist = [p.z, r.w - p.x, r.d - p.z, p.x]; // walls z=0, x=w, z=d, x=0; the model front is +Z
    [p.x, p.z, p.rot] = [[cx, half, 0], [r.w - half, cz, 270], [cx, r.d - half, 180], [half, cz, 90]][dist.indexOf(Math.min(...dist))];
    if (!p.elev) p.elev = d.dims.h < 0.3 ? 0.3 : 1.0;
    p.elevAuto = false;
  }
  autoElevate(d) {
    if (d.wall || !d.phys.elevAuto || isRack(d) || isFurniture(d) || d.phys.mount === 'rack') return;
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
        if (portFamily(pa) !== portFamily(pb)) { toast(`${portFamily(pa) === 'data' ? pb.kind : pa.kind} ports only connect to ${portFamily(pa) === 'data' ? pb.kind : pa.kind} ports`, 'err'); return; }
        const medium = this.linkMedium !== 'auto' ? this.linkMedium : autoMedium(pa, pb);
        lab.links.push({ id: uid('ln'), a, b, medium, label: '', notes: '' });
        if (pa.kind === 'wifi' && pb.kind === 'wifi') { // client joins the AP's first SSID if it has none yet
          const da = devById(lab, a.dev);
          const [apDev, client] = da.ssids?.length ? [da, pb] : (d.ssids?.length ? [d, pa] : []);
          if (apDev && !client.ssid) client.ssid = apDev.ssids[0].name;
        }
        this.linkStart = null; this.viewport.setLinkSource(null);
        this.commit(`Link ${d.name}`, 'all');
        toast(`Linked ${devById(lab, a.dev).name}:${pa.name} ↔ ${d.name}:${pb.name}`, 'ok', 1800);
      }
    };
    if (d.physicalOnly) { toast(`${d.name} is a room object: cables go to the devices in it`, 'warn'); return; }
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
      ssids: d.ssids, wall: d.wall, virtual: d.virtual, physicalOnly: d.physicalOnly, logical: d.logical, passthrough: d.passthrough, vendor: d.vendor, model: d.model,
      ports: d.ports.filter(p => !['svi', 'sub', 'loop'].includes(p.kind)).map(p => ({ name: p.name, kind: p.kind, speed: p.speed, mode: p.mode })),
      attrs: Object.fromEntries(d.attrs.filter(a => a.k).map(a => [a.k, ''])),
    };
    const src = this.library.get(d.templateId); if (src?.modelData) t.modelData = src.modelData;
    t.portRows = compressPorts(t.ports);
    this.library.custom.push(t); await this.saveLibrary(); this.palette.render();
    toast(`Added "${name}" to the library`, 'ok');
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
      chk('showStored', 'Show spare, on-order and retired items in the 3D views', 'off = they are only in the inventory'),
      h('h4', null, 'Editing'),
      chk('snap', 'Snap to grid'), chk('lockLayout', 'Lock layout (no dragging)'),
      chk('autosave', 'Autosave every 30 s', store.mode === 'server' ? '' : '(server mode only)'),
      h('h4', null, 'SSH console'),
      h('label', { class: 'fld' }, h('span', null, 'Default SSH engine'), h('select', { class: 'inp', onchange: e => { s.sshEngine = e.target.value; store.setPref('settings', s); } },
        [['paramiko', 'paramiko (pip install paramiko)'], ['system', 'System ssh (OpenSSH; uses ~/.ssh/config)']].map(([v, l]) => h('option', { value: v, selected: s.sshEngine === v ? 'selected' : null }, l))),
        h('small', null, 'A device can override this in its Console tab.'))),
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
      ['1 / 2 / 3', 'Topology / room view / inventory'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+S', 'Save'], ['Double-click', 'Open device console'],
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

function autoMedium(a, b) {
  const k = new Set([a.kind, b.kind]);
  if (k.has('power')) return 'power';
  if (k.has('tunnel')) return 'tunnel';
  if (k.has('video')) return 'video';
  if (k.has('console') || k.has('usb')) return 'console';
  if (k.has('wifi')) return 'wireless';
  if (k.has('vport')) return 'virtual';
  if (k.has('sfp')) return 'fiber';
  return 'copper';
}
function defaultName(t) {
  const m = { Network: 'net', Compute: 'host', Storage: 'nas', Virtual: 'vm', Endpoints: 'client', IoT: 'iot', Power: 'ups', WAN: 'wan', Infrastructure: t.shape, Parts: 'part' };
  if (t.shape === 'rack') return 'Rack';
  if (t.shape === 'desk') return 'Desk';
  if (t.shape === 'shelf') return 'Shelf';
  return (m[t.category] || 'dev') + '-01';
}
function nextPortName(d) { let n = d.ports.length; while (d.ports.some(p => p.name === 'eth' + n)) n++; return 'eth' + n; }

const app = new App();
window.labtracer = app; // handy for debugging in the browser console
app.init().catch(e => { console.error(e); toast('Startup failed: ' + e.message, 'err', 10000); });
