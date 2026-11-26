// Inspector, Physical tab: room, position, rack mounting, size, rack elevation.
import { h, ap } from '../util.js';
import { devById, isRack, isFurniture, rackOccupancy, rackFits, rackFirstFree } from '../model.js';
import { toast, popup } from '../dialogs.js';

export class PhysicalTab {
  tab_physical(d, el) {
    const app = this.app, lab = app.lab, S = { dev: d.id };
    if (d.virtual || d.logical) {
      ap(el, h('p', { class: 'muted' }, d.virtual ? 'Virtual device: it lives on a host, so it is not drawn in the room view. Use the Host attribute to record where it runs.' : 'Logical object (for example the Internet): shown only in the topology view.'));
      return;
    }
    const rooms = [['', '— Not placed —'], ...lab.rooms.map(r => [r.id, r.name])];
    const racks = lab.devices.filter(x => isRack(x) && x.id !== d.id);
    const canRack = d.uHeight > 0 && racks.length > 0;
    const p = d.phys;
    if (p.mount === 'rack') {
      const rack = devById(lab, p.rackId);
      ap(el, 
        this.inp(p, 'mount', 'Mounting', 'all', { type: 'select', options: [['floor', 'Free standing'], ['rack', 'In a rack']], after: v => { if (v === 'floor') { p.roomId = rack ? rack.phys.roomId : p.roomId; p.x = rack ? rack.phys.x + 0.8 : p.x; p.z = rack ? rack.phys.z : p.z; p.rackId = null; p.rackU = null; } } }),
        this.inp(p, 'rackId', 'Rack', 'all', { type: 'select', options: racks.map(r => [r.id, r.name]), after: v => { const r = devById(lab, v); p.rackU = rackFirstFree(lab, r, d); if (!p.rackU) toast('That rack is full', 'err'); } }),
        this.inp(p, 'rackU', `Bottom U (${d.uHeight || 1}U tall)`, 'all', { type: 'number', min: 1, max: rack?.rackUnits, step: 1, validate: v => rack && !rackFits(lab, rack, d, v) ? 'Those rack units are taken or out of range' : '' }),
        h('p', { class: 'muted small' }, rack ? `Occupies U${p.rackU}${d.uHeight > 1 ? '–U' + (p.rackU + d.uHeight - 1) : ''} in ${rack.name} (${lab.rooms.find(r => r.id === rack.phys.roomId)?.name || 'not placed'}).` : 'Rack missing.'));
    } else {
      ap(el, 
        this.inp(p, 'roomId', 'Room', 'all', { type: 'select', options: rooms, after: (v, old) => {
          p.roomId = v || null;
          if (v && v !== old) { const r = lab.rooms.find(r => r.id === v); p.x = r.w / 2; p.z = r.d / 2; }
        } }),
        canRack ? this.inp(p, 'mount', 'Mounting', 'all', { type: 'select', options: [['floor', 'Free standing'], ['rack', 'In a rack']], after: v => {
          if (v === 'rack') { const r = racks[0]; p.rackId = r.id; p.rackU = rackFirstFree(lab, r, d); if (!p.rackU) { toast('Rack is full', 'err'); p.mount = 'floor'; p.rackId = null; } }
        } }) : null,
        p.roomId ? h('div', { class: 'row4' },
          this.inp(p, 'x', 'X m', S, { type: 'number', step: 0.05 }),
          this.inp(p, 'z', 'Z m', S, { type: 'number', step: 0.05 }),
          this.inp(p, 'rot', 'Rotate °', S, { type: 'number', step: 90 }),
          this.inp(p, 'elev', 'Height m', S, { type: 'number', step: 0.05, after: () => { p.elevAuto = false; } })) : null,
        p.roomId && !isRack(d) && !isFurniture(d) ? this.inp(p, 'elevAuto', 'Sit on furniture automatically when moved', 'none', { type: 'check' }) : null,
        p.roomId && !isRack(d) && !isFurniture(d) ? this.inp(d, 'wall', 'Mounted on a wall (snaps to the nearest wall)', 'all', { type: 'check', after: v => { if (v) app.snapToWall(d); } }) : null,
        p.roomId ? this.levelButtons(d) : null,
        p.roomId ? h('p', { class: 'muted small' }, 'Tip: drag in the room view. R rotates 90°.') : null);
    }
    ap(el, h('h4', null, 'Size'),
      h('div', { class: 'row4' },
        this.inp(d.dims, 'w', 'Width m', S, { type: 'number', step: 0.01, k: 'dw' }),
        this.inp(d.dims, 'h', 'Height m', S, { type: 'number', step: 0.001, k: 'dh' }),
        this.inp(d.dims, 'd', 'Depth m', S, { type: 'number', step: 0.01, k: 'dd' }),
        isRack(d) ? this.inp(d, 'rackUnits', 'Rack units', 'all', { type: 'number', step: 1, min: 1 }) : this.inp(d, 'uHeight', 'Rack U', 'all', { type: 'number', step: 1, min: 0 })));
    if (isFurniture(d)) ap(el, h('label', { class: 'fld' }, h('span', null, 'Surface heights (m, comma separated)'),
      h('input', { class: 'inp', 'data-k': 'levels', value: (d.levels || []).join(', '), onchange: e => { d.levels = e.target.value.split(',').map(Number).filter(Number.isFinite); this.commit('Edit surfaces', 'all'); } })));
    if (isRack(d)) ap(el, h('h4', null, 'Rack elevation'), this.rackElevation(d));
  }

  levelButtons(d) {
    const f = this.app.furnitureUnder(d);
    if (!f || !f.levels?.length) return null;
    return h('div', { class: 'btnrow' }, h('span', { class: 'muted small' }, `On ${f.name}:`),
      f.levels.map((lv, i) => h('button', { class: 'btn small', onclick: () => { d.phys.elev = lv; d.phys.elevAuto = true; this.commit('Set shelf', { dev: d.id }); } }, `Level ${i + 1} (${lv} m)`)));
  }

  rackElevation(rack) {
    const lab = this.app.lab;
    const occ = rackOccupancy(lab, rack);
    const box = h('div', { class: 'rack-el', 'data-scroll': 'rack' });
    for (let u = rack.rackUnits; u >= 1; u--) {
      const d = occ.get(u);
      if (d && d.phys.rackU + Math.max(1, d.uHeight) - 1 !== u) continue; // draw multi-U once at its top
      const span = d ? Math.max(1, d.uHeight) : 1;
      const row = h('div', { class: 'ru' + (d ? ' used' : ''), style: { height: (span * 18) + 'px' } },
        h('span', { class: 'un' }, d && span > 1 ? `${u - span + 1}–${u}` : String(u)),
        d ? h('button', { class: 'ru-dev', style: { borderLeftColor: d.color }, onclick: () => this.app.select({ type: 'device', id: d.id }) }, d.name, h('small', null, d.model || ''))
          : h('button', { class: 'ru-empty', onclick: e => this.mountMenu(rack, u, e) }, '+'));
      ap(box, row);
    }
    return box;
  }
  mountMenu(rack, u, e) {
    const lab = this.app.lab;
    const cands = lab.devices.filter(x => x.uHeight > 0 && !isRack(x) && !(x.phys.mount === 'rack' && x.phys.rackId === rack.id));
    popup(e.clientX, e.clientY, `Mount at U${u}`, cands.length ? cands.map(x => ({
      label: x.name, sub: `${x.uHeight}U${x.phys.mount === 'rack' ? ' · in ' + (devById(lab, x.phys.rackId)?.name || 'rack') : ''}`,
      disabled: !rackFits(lab, rack, x, u),
      onClick: () => { Object.assign(x.phys, { mount: 'rack', rackId: rack.id, rackU: u }); this.commit('Mount in rack', 'all'); },
    })) : [{ label: 'No rack-mount devices (Rack U > 0)', disabled: true }]);
  }
}
