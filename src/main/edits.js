// App: edits of the selection (delete, duplicate, rotate) and custom object templates.
import { uid } from '../util.js';
import { devById, removeDevice, duplicateDevice } from '../model.js';
import { compressPorts } from '../palette.js';
import { toast, promptText } from '../dialogs.js';

export class Edits {
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
}
