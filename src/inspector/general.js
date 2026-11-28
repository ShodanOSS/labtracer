// SPDX-License-Identifier: Apache-2.0
// Inspector, General tab: name, vendor, inventory fields, attributes, notes.
import { h, ap } from '../util.js';
import { INV_STATUS, isDeployed, warrantyState } from '../model.js';

export class GeneralTab {
  tab_general(d, el) {
    const S = { dev: d.id };
    ap(el, 
      this.inp(d, 'name', d.physicalOnly ? 'Name' : 'Name / hostname', 'all', { validate: v => v ? '' : 'Name is required' }),
      h('div', { class: 'row2' }, this.inp(d, 'vendor', 'Vendor', S), this.inp(d, 'model', 'Model', S)),
      h('div', { class: 'row2' }, this.inp(d, 'serial', 'Serial', S), this.inp(d, 'color', 'Colour', S, { type: 'color' })),
      d.physicalOnly ? null : h('div', { class: 'row2' },
        this.inp(d, 'l2', 'Bridges L2 (switch / bridge)', S, { type: 'check' }),
        this.inp(d, 'l3', 'Routes IP (forwarding)', S, { type: 'check' })),
      this.inventorySection(d),
      h('h4', null, 'Attributes'),
      this.kvTable(d),
      this.inp(d, 'notes', 'Notes', 'none', { type: 'area', rows: 4, trim: false }),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small', onclick: () => this.app.saveDeviceAsTemplate(d) }, 'Save as custom object'),
        d.physicalOnly ? null : h('button', { class: 'btn small', onclick: () => { this.tab = 'console'; this.render(); } }, 'Open console')),
      h('p', { class: 'muted small' }, `Category: ${d.category} · Template: ${this.app.library.get(d.templateId)?.name || d.templateId + ' (missing)'} · ID ${d.id}`));
  }

  inventorySection(d) {
    const inv = d.inv, S = { dev: d.id };
    const ws = warrantyState(d);
    const costOk = v => (v === '' || Number.isFinite(Number(v)) ? '' : 'Cost must be a number');
    return h('div', null,
      h('h4', null, 'Inventory'),
      h('div', { class: 'row2' },
        this.inp(inv, 'status', 'Status', 'all', { k: 'inv-status', type: 'select', options: INV_STATUS, label: 'Change status',
          hint: isDeployed(d) ? '' : 'Not drawn in the 3D views and not monitored.' }),
        this.inp(inv, 'assetTag', 'Asset tag', S, { k: 'inv-tag' })),
      this.inp(inv, 'location', 'Storage location', S, { k: 'inv-loc', ph: 'e.g. garage shelf, box 3', hint: 'Where it is kept when it is not in a room or rack.' }),
      h('div', { class: 'row2' },
        this.inp(inv, 'purchased', 'Purchased', S, { k: 'inv-buy', type: 'date' }),
        this.inp(inv, 'supplier', 'Supplier', S, { k: 'inv-sup' })),
      h('div', { class: 'row2' },
        this.inp(inv, 'cost', 'Cost', S, { k: 'inv-cost', ph: '0.00', validate: costOk }),
        this.inp(inv, 'warranty', 'Warranty until', S, { k: 'inv-war', type: 'date',
          hint: ws === 'expired' ? 'Expired.' : ws === 'soon' ? 'Ends within 90 days.' : '' })));
  }

  kvTable(d) {
    const box = h('div', { class: 'kv' });
    d.attrs.forEach((a, i) => ap(box, h('div', { class: 'kv-row' },
      this.inp(a, 'k', null, 'none', { k: `attr-k-${i}`, ph: 'Key' }),
      this.inp(a, 'v', null, 'none', { k: `attr-v-${i}`, ph: 'Value' }),
      h('button', { class: 'mini', title: 'Remove', onclick: () => { d.attrs.splice(i, 1); this.commit('Remove attribute', 'none'); } }, '×'))));
    ap(box, h('button', { class: 'btn small', onclick: () => { d.attrs.push({ k: '', v: '' }); this.commit('Add attribute', 'none'); } }, '+ Attribute'));
    return box;
  }
}
