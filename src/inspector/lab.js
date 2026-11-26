// Inspector: the lab panel shown when nothing is selected. Rooms, cable routing,
// monitoring agent, drift, unplaced devices and the address plan.
import { h, ap, uid, intToIp } from '../util.js';
import { deviceRoomId, isDeployed } from '../model.js';
import { l3Ifaces, duplicateIps } from '../netsim.js';
import { confirmBox } from '../dialogs.js';
import { CABLE_ROUTES } from '../viewport/cables.js';

export class LabPanel {
  renderLab() {
    const app = this.app, lab = app.lab;
    const body = h('div', { class: 'insp-body', 'data-scroll': 'lab' });
    ap(this.el, h('div', { class: 'insp-head' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, lab.name), h('div', { class: 'muted small' }, `${lab.devices.length} devices · ${lab.links.length} links · ${lab.rooms.length} rooms`))), body);

    // rooms
    const rooms = h('div', { class: 'routes' }, h('div', { class: 'roomrow head' }, h('span', null, 'Room'), h('span', null, 'W m'), h('span', null, 'D m'), h('span', null, 'H m'), h('span')));
    lab.rooms.forEach((r, i) => ap(rooms, h('div', { class: 'roomrow' + (r.id === app.roomId ? ' on' : '') },
      this.inp(r, 'name', null, 'all', { k: `rn-${i}` }),
      this.inp(r, 'w', null, 'all', { k: `rw-${i}`, type: 'number', step: 0.1, min: 0.5 }),
      this.inp(r, 'd', null, 'all', { k: `rdd-${i}`, type: 'number', step: 0.1, min: 0.5 }),
      this.inp(r, 'h', null, 'all', { k: `rh-${i}`, type: 'number', step: 0.1, min: 1 }),
      h('span', { class: 'btnrow tight' },
        h('button', { class: 'mini txt', title: 'Show this room', onclick: () => app.setRoom(r.id) }, 'view'),
        h('button', { class: 'mini', title: 'Delete room', onclick: async () => {
          if (!await confirmBox('Delete room', `Delete "${r.name}"? Devices in it become unplaced.`, 'Delete', true)) return;
          for (const d of lab.devices) if (d.phys.roomId === r.id) d.phys.roomId = null;
          lab.rooms.splice(i, 1); if (app.roomId === r.id) app.roomId = lab.rooms[0]?.id || null; this.commit('Delete room', 'all');
        } }, '×')))));
    ap(rooms, h('button', { class: 'btn small', onclick: () => { lab.rooms.push({ id: uid('room'), name: `Room ${lab.rooms.length + 1}`, w: 4, d: 3, h: 2.4 }); this.commit('Add room', 'all'); } }, '+ Room'));
    ap(body, this.inp(lab, 'notes', 'Lab notes', 'none', { type: 'area', rows: 3, trim: false }), h('h4', null, 'Rooms'), rooms,
      this.inp(lab, 'cableRoute', 'Cable routing in the room view', 'all', { type: 'select', options: CABLE_ROUTES,
        hint: 'A link can override this. Cables inside one rack and leads under 0.5 m always hang.' }));

    // monitoring
    ap(body, h('h4', null, 'Monitoring agent'), this.monitorSection());
    ap(body, h('h4', null, 'Drift: model vs devices'), this.driftSection());
    ap(body, h('h4', null, 'Nagios'), this.nagiosSection());

    // unplaced
    // deployed kit with no room; spares, parts and items with a storage location are not "missing"
    const unplaced = lab.devices.filter(d => !d.virtual && !d.logical && !deviceRoomId(lab, d) && isDeployed(d) && !d.inv.location && d.category !== 'Parts');
    if (unplaced.length) {
      ap(body, h('h4', null, `Not placed in a room (${unplaced.length})`), h('div', { class: 'chips' }, unplaced.map(d =>
        h('span', { class: 'chip' }, h('button', { class: 'chip-name', onclick: () => app.select({ type: 'device', id: d.id }) }, d.name),
          app.roomId ? h('button', { class: 'chip-act', title: 'Place in the current room', onclick: () => app.placeInRoom(d) }, '＋') : null))));
    }

    // IP plan
    const dups = duplicateIps(lab);
    const rows = [];
    for (const d of lab.devices) for (const i of l3Ifaces(d)) rows.push({ d, p: i.port, c: i.cidr });
    rows.sort((a, b) => a.c.ip - b.c.ip);
    const nets = new Map();
    for (const r of rows) { const k = intToIp(r.c.net) + '/' + r.c.prefix; nets.set(k, (nets.get(k) || 0) + 1); }
    ap(body, h('h4', null, `Address plan (${rows.length})`),
      dups.size ? h('div', { class: 'warn' }, `Duplicate address: ${[...dups].map(intToIp).join(', ')}`) : null,
      h('div', { class: 'ipplan', 'data-scroll': 'ipplan' }, h('div', { class: 'iprow head' }, h('span', null, 'Address'), h('span', null, 'Device'), h('span', null, 'Interface'), h('span', null, 'VLAN')),
        rows.map(r => h('button', { class: 'iprow' + (dups.has(r.c.ip) ? ' dup' : ''), onclick: () => app.select({ type: 'device', id: r.d.id }) },
          h('span', { class: 'mono' }, r.p.ip), h('span', null, r.d.name), h('span', null, r.p.name),
          h('span', null, r.p.kind === 'svi' || r.p.kind === 'sub' ? r.p.vlan : (r.d.l2 && r.p.mode !== 'routed' && !['tunnel', 'loop'].includes(r.p.kind) ? r.p.vlan : ''))))),
      h('h4', null, 'Subnets in use'),
      h('div', { class: 'chips' }, [...nets].sort().map(([k, n]) => h('span', { class: 'chip mono' }, `${k} · ${n}`))),
      h('p', { class: 'muted small' }, 'Click a device or link to see its properties. Double-click a device to open its console.'));
  }
}
