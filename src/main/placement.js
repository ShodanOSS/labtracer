// App: put devices into the lab: place from the palette, add inventory items, drag,
// mount in racks, sit on furniture, snap to walls.
import {
  createDevice, uniqueName, isRack, isFurniture, deviceRoomId, rackFirstFree, isDeployed, showsInTopology,
  showsInRoom,
} from '../model.js';
import { toast } from '../dialogs.js';

function defaultName(t) {
  const m = { Network: 'net', Compute: 'host', Storage: 'nas', Virtual: 'vm', Endpoints: 'client', IoT: 'iot', Power: 'ups', WAN: 'wan', Infrastructure: t.shape, Parts: 'part' };
  if (t.shape === 'rack') return 'Rack';
  if (t.shape === 'desk') return 'Desk';
  if (t.shape === 'shelf') return 'Shelf';
  return (m[t.category] || 'dev') + '-01';
}

export class Placement {
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
}
