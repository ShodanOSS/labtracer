// SPDX-License-Identifier: Apache-2.0
// Inspector: the lab panel shown when nothing is selected. Rooms, cable routing,
// monitoring agent, drift, unplaced devices and the address plan.
import { h, ap, uid, intToIp } from '../util.js';
import { deviceRoomId, isDeployed } from '../model.js';
import { l3Ifaces, duplicateIps } from '../netsim.js';
import { confirmBox, toast } from '../dialogs.js';
import { CABLE_ROUTES } from '../viewport/cables.js';

export class LabPanel {
  changesSection() {
    const ch = this.app.changes;
    if (!ch.available) return h('p', { class: 'muted small' }, 'Changes need server.py.');
    const cur = ch.current;
    return h('div', null,
      cur ? h('p', { class: 'small' }, h('b', null, cur.title), ` · ${cur.items.length} device(s), ${cur.items.reduce((n, it) => n + (it.labels || []).length, 0)} change(s) staged`)
        : h('p', { class: 'muted small' }, 'Nothing staged. In the Drift tab of a device, "stage" adds a change here, so you can review and apply changes on many devices together.'),
      h('div', { class: 'btnrow' },
        cur ? h('button', { class: 'btn small primary', onclick: () => ch.review() }, 'Review and apply') : h('button', { class: 'btn small', onclick: () => ch.newDraft() }, 'New change set'),
        h('button', { class: 'btn small', onclick: () => ch.history() }, 'History'),
        h('button', { class: 'btn small', onclick: () => ch.audit() }, 'Audit log')));
  }

  remoteSection() {
    const app = this.app, rm = app.remote;
    if (!rm.available) return h('p', { class: 'muted small' }, 'Remote access needs server.py.');
    const addr = h('input', { class: 'inp mono', 'data-k': 'guacd', value: rm.config?.guacd || '127.0.0.1:4822', placeholder: '127.0.0.1:4822' });
    const tls = h('input', { type: 'checkbox', checked: rm.config?.tls });
    if (!rm.config) fetch('/api/remote/config', { cache: 'no-store' }).then(r => r.json()).then(c => { rm.config = c; addr.value = c.guacd; tls.checked = c.tls; }).catch(() => {});
    const save = async () => {
      const r = await fetch('/api/remote/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-LabTracer': '1' }, body: JSON.stringify({ guacd: addr.value.trim(), tls: tls.checked }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); rm.config = j;
    };
    return h('div', null,
      h('label', { class: 'fld' }, h('span', null, 'guacd address'), addr, h('small', null, 'Apache Guacamole server daemon. For example: docker run -d -p 127.0.0.1:4822:4822 guacamole/guacd')),
      h('label', { class: 'chk' }, tls, 'guacd uses TLS (guacd -C / -K)'),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small', onclick: async () => { try { await save(); toast('Saved', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Save'),
        h('button', { class: 'btn small', onclick: async () => {
          try { await save(); const r = await fetch('/api/remote/test', { method: 'POST', headers: { 'X-LabTracer': '1' } }); const j = await r.json();
            toast(j.ok ? `guacd answers (${j.version || 'version ?'})` : 'guacd: ' + j.error, j.ok ? 'ok' : 'err', 6000); } catch (e) { toast(e.message, 'err'); }
        } }, 'Test')),
      h('p', { class: 'muted small' }, 'Open a session in the Console tab of a device › Remote: RDP, VNC, SSH or Telnet in a window you can move and resize. No Guacamole web app or database is needed.'));
  }

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
    ap(body, h('h4', null, 'Monitoring'), this.monitorSection());
    ap(body, h('h4', null, 'Discover network'), app.discover.section());
    ap(body, h('h4', null, 'Drift: model vs devices'), this.driftSection());
    ap(body, h('h4', null, 'Changes and audit'), this.changesSection());
    ap(body, h('h4', null, 'Nagios'), this.nagiosSection());
    ap(body, h('h4', null, 'Remote access (Guacamole)'), this.remoteSection());

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
