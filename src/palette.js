// SPDX-License-Identifier: Apache-2.0
// Left panel: device library + custom object editor.
import { h, clear, uid, clone, readFileDataURL, pickFile, readFileText, download } from './util.js';
import { CATEGORY_ORDER, SHAPES, FACES, PORT_KINDS, P } from './templates.js';
import { createDevice } from './model.js';
import { modal, toast, confirmBox } from './dialogs.js';
import { Viewport } from './viewport.js';
import { forgetModel } from './models3d.js';
import { libraryFromFile, LIBRARY_VERSION } from './migrations.js';

const LOCKED = 'The custom library is from a newer LabTracer. Update LabTracer to change custom objects.';

const ICONS = {
  rackmount: '<rect x="2" y="9" width="20" height="6" rx="1"/><path d="M5 12h2M9 12h2M13 12h2"/>',
  box: '<rect x="4" y="8" width="16" height="8" rx="1.5"/>',
  router: '<rect x="3" y="12" width="18" height="6" rx="1.5"/><path d="M6 12V5M12 12V4M18 12V5"/>',
  ap: '<ellipse cx="12" cy="13" rx="9" ry="4"/><path d="M8 8a6 6 0 0 1 8 0"/>',
  tower: '<rect x="7" y="3" width="10" height="18" rx="1.5"/><circle cx="12" cy="8" r="1.5"/>',
  nas: '<rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M9.5 7v10M14.5 7v10"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M2 19h20"/>',
  phone: '<rect x="8" y="3" width="8" height="18" rx="2"/>',
  sbc: '<rect x="3" y="7" width="18" height="10" rx="1"/><rect x="7" y="10" width="4" height="4"/><path d="M15 9h4v6h-4"/>',
  camera: '<rect x="3" y="8" width="14" height="7" rx="3"/><path d="M17 11l4-2v6l-4-2"/>',
  printer: '<rect x="4" y="9" width="16" height="8" rx="1"/><path d="M7 9V4h10v5M7 17v3h10v-3"/>',
  cloud: '<path d="M7 18a4 4 0 0 1 0-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 18 18z"/>',
  vm: '<rect x="5" y="5" width="14" height="14" rx="1" stroke-dasharray="3 2"/>',
  cylinder: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5V6"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M9 20h6M12 16v4"/>',
  rack: '<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M8 6h8M8 9h8M8 12h8M8 15h8"/>',
  desk: '<path d="M3 9h18M5 9v10M19 9v10"/>',
  shelf: '<path d="M5 3v18M19 3v18M5 7h14M5 12h14M5 17h14"/>',
};
export function iconSvg(shape, color) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${color || 'currentColor'}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[shape] || ICONS.box}</svg>`;
}

export class Palette {
  constructor(el, app) { this.el = el; this.app = app; this.filter = ''; this.collapsed = new Set(app.store.getPref('collapsed', [])); }

  render() {
    const app = this.app;
    clear(this.el);
    const search = h('input', { class: 'inp search', placeholder: 'Search devices…', value: this.filter, oninput: e => { this.filter = e.target.value; this.renderList(list); } });
    const list = h('div', { class: 'pal-list' });
    this.el.append(
      h('div', { class: 'pal-head' }, search),
      h('div', { class: 'pal-actions' },
        h('button', { class: 'btn small primary', onclick: () => this.editTemplate(null), title: 'Make a new device type' }, '+ Custom object'),
        h('button', { class: 'btn small', onclick: () => this.importTemplates(), title: 'Import templates from a .json file' }, 'Import'),
        h('button', { class: 'btn small', onclick: () => this.exportTemplates(), title: 'Export your custom templates' }, 'Export')),
      list,
      h('div', { class: 'pal-hint' }, 'Drag onto the canvas, or click then click a spot.'));
    this.renderList(list);
  }

  renderList(list) {
    clear(list);
    const q = this.filter.trim().toLowerCase();
    const all = this.app.library.all().filter(t => !q || (t.name + ' ' + t.category + ' ' + (t.vendor || '') + ' ' + (t.model || '')).toLowerCase().includes(q));
    const cats = [...new Set([...CATEGORY_ORDER, ...all.map(t => t.category)])];
    for (const cat of cats) {
      const items = all.filter(t => t.category === cat);
      if (!items.length) continue;
      const open = q || !this.collapsed.has(cat);
      const head = h('button', { class: 'pal-cat' + (open ? ' open' : ''), onclick: () => {
        if (this.collapsed.has(cat)) this.collapsed.delete(cat); else this.collapsed.add(cat);
        this.app.store.setPref('collapsed', [...this.collapsed]); this.renderList(list);
      } }, h('span', { class: 'chev' }, '▸'), cat, h('small', null, items.length));
      list.appendChild(head);
      if (!open) continue;
      for (const t of items) {
        const custom = this.app.library.isCustom(t.id);
        const active = this.app.placingTpl === t.id;
        const item = h('div', {
          class: 'pal-item' + (active ? ' active' : ''), draggable: 'true', title: t.name,
          onclick: () => this.app.startPlacing(t.id),
          ondragstart: e => { e.dataTransfer.setData('text/x-labtracer-template', t.id); e.dataTransfer.effectAllowed = 'copy'; },
        },
        h('span', { class: 'ico', html: iconSvg(t.shape, t.color && t.color.toLowerCase() !== '#1d1f24' ? lighten(t.color) : null) }),
        h('span', { class: 'nm' }, t.name),
        custom ? h('span', { class: 'badge' }, 'custom') : null,
        custom ? h('button', { class: 'mini', title: 'Edit', onclick: e => { e.stopPropagation(); this.editTemplate(t); } }, '✎') : null,
        custom ? h('button', { class: 'mini', title: 'Delete', onclick: async e => { e.stopPropagation(); if (await confirmBox('Delete template', `Delete "${t.name}"? Devices already placed keep their settings.`, 'Delete', true)) { this.app.library.setCustom(this.app.library.custom.filter(x => x.id !== t.id)); await this.app.saveLibrary(); this.render(); } } }, '×') : null,
        !custom ? h('button', { class: 'mini', title: 'Copy into a new custom object', onclick: e => { e.stopPropagation(); const c = clone(t); delete c.id; c.name = t.name + ' (custom)'; this.editTemplate(c, true); } }, '⧉') : null);
        list.appendChild(item);
      }
    }
  }

  async importTemplates() {
    if (this.app.libraryLocked) return toast(LOCKED, 'err', 6000);
    const f = await pickFile('.json,application/json'); if (!f) return;
    try {
      const list = libraryFromFile(JSON.parse(await readFileText(f))).templates; // older files are migrated; newer ones refused
      let n = 0, upd = 0;
      const lib = this.app.library;
      for (const t of list) {
        if (!t || typeof t !== 'object' || !t.name || !t.shape) continue;
        if (typeof t.color !== 'string') delete t.color;
        t.dims = { w: +t.dims?.w || 0.3, h: +t.dims?.h || 0.1, d: +t.dims?.d || 0.3 };
        // keep the id, so devices in a shared lab find their template (and its 3D model)
        const i = typeof t.id === 'string' && t.id.startsWith('cus_') ? lib.custom.findIndex(x => x.id === t.id) : -1;
        if (i >= 0) { lib.custom[i] = t; forgetModel(t.id); upd++; continue; }
        if (typeof t.id !== 'string' || !t.id.startsWith('cus_') || lib.get(t.id)) t.id = 'cus_' + uid('t').slice(2);
        lib.custom.push(t); n++;
      }
      await this.app.saveLibrary(); this.render(); this.app.viewport.rebuildAll();
      toast(`Imported ${n} template(s)${upd ? `, updated ${upd}` : ''}`, 'ok');
    } catch (e) { toast('Import failed: ' + e.message, 'err'); }
  }
  exportTemplates() {
    if (!this.app.library.custom.length) return toast('No custom templates yet', 'warn');
    download('labtracer-templates.json', JSON.stringify({ version: LIBRARY_VERSION, templates: this.app.library.custom }, null, 1), 'application/json');
  }

  // ---------------------------------------------------------------- custom object editor
  editTemplate(tpl, isCopy = false) {
    if (this.app.libraryLocked) return toast(LOCKED, 'err', 6000);
    const isNew = !tpl || isCopy;
    const t = tpl ? clone(tpl) : {
      name: 'New device', category: 'Custom', shape: 'box', face: 'plain', dims: { w: 0.3, h: 0.06, d: 0.25 },
      color: '#4b5563', l2: false, l3: false, ports: P('eth', 0, 1), attrs: {},
    };
    t.portRows ||= compressPorts(t.ports || []);
    t.attrs ||= {};
    const cats = [...new Set([...CATEGORY_ORDER, 'Custom', ...this.app.library.all().map(x => x.category)])];

    const fld = (label, input, hint) => h('label', { class: 'fld' }, h('span', null, label), input, hint ? h('small', null, hint) : null);
    const num = (v, step, on) => h('input', { class: 'inp', type: 'number', step, min: 0, value: v, oninput: e => { on(parseFloat(e.target.value) || 0); redraw(); } });
    const sel = (opts, v, on) => h('select', { class: 'inp', onchange: e => { on(e.target.value); redraw(); } }, opts.map(([k, l]) => h('option', { value: k, selected: k === v ? 'selected' : null }, l)));

    const canvas = h('canvas', { width: 300, height: 200, class: 'preview' });
    let pv = null;
    const ptpl = {}; // preview-only model key: never shares the cache of a saved template
    const redraw = () => {
      t.ports = expandPorts(t.portRows);
      const d = createDevice({ ...t, id: t.id || 'preview' });
      ptpl.modelData = t.modelData;
      try { pv ? pv.draw(d, ptpl) : (pv = Viewport.preview(canvas, d, ptpl)); } catch (e) { /* preview optional */ }
      portSummary.textContent = `${t.ports.length} port(s): ` + t.ports.slice(0, 12).map(p => p.name).join(', ') + (t.ports.length > 12 ? '…' : '');
    };
    const portSummary = h('div', { class: 'muted small' });

    const rowsEl = h('div', { class: 'port-rows' });
    const renderRows = () => {
      clear(rowsEl);
      rowsEl.appendChild(h('div', { class: 'pr head' }, h('span', null, 'Prefix / name'), h('span', null, 'Start'), h('span', null, 'Count'), h('span', null, 'Kind'), h('span', null, 'Speed'), h('span')));
      t.portRows.forEach((r, i) => rowsEl.appendChild(h('div', { class: 'pr' },
        h('input', { class: 'inp', value: r.prefix, oninput: e => { r.prefix = e.target.value; redraw(); } }),
        h('input', { class: 'inp', type: 'number', min: 0, value: r.start ?? '', placeholder: '—', oninput: e => { r.start = e.target.value === '' ? null : +e.target.value; redraw(); } }),
        h('input', { class: 'inp', type: 'number', min: 1, value: r.count, oninput: e => { r.count = Math.max(1, +e.target.value || 1); redraw(); } }),
        h('select', { class: 'inp', onchange: e => { r.kind = e.target.value; redraw(); } }, PORT_KINDS.map(k => h('option', { value: k, selected: k === r.kind ? 'selected' : null }, k))),
        h('input', { class: 'inp', value: r.speed || '', oninput: e => { r.speed = e.target.value; } }),
        h('button', { class: 'mini', onclick: () => { t.portRows.splice(i, 1); renderRows(); redraw(); } }, '×'))));
      rowsEl.appendChild(h('button', { class: 'btn small', onclick: () => { t.portRows.push({ prefix: 'eth', start: t.portRows.length, count: 1, kind: 'eth', speed: '1G' }); renderRows(); redraw(); } }, '+ Port group'));
    };
    renderRows();

    const attrsEl = h('textarea', { class: 'inp mono', rows: 4, placeholder: 'One per line: Key: value', oninput: e => {
      t.attrs = {}; for (const line of e.target.value.split('\n')) { const i = line.indexOf(':'); if (i > 0) t.attrs[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
    } }, Object.entries(t.attrs).map(([k, v]) => `${k}: ${v}`).join('\n'));

    const modelInfo = h('span', { class: 'muted small' }, t.modelData ? `3D model loaded (${Math.round(t.modelData.length / 1024)} KB)` : 'Using the built-in shape.');
    const presets = [['', 'Size presets…'], ['1u', '1U rack (0.44 × 0.044 × 0.5)'], ['2u', '2U rack (0.44 × 0.089 × 0.6)'], ['4u', '4U rack (0.44 × 0.178 × 0.65)'], ['desk', 'Desktop box (0.25 × 0.05 × 0.2)'], ['mini', 'Mini PC (0.18 × 0.035 × 0.18)'], ['tower', 'Tower (0.2 × 0.45 × 0.45)']];
    const PRE = { '1u': [0.44, 0.0445, 0.5, 1], '2u': [0.44, 0.089, 0.6, 2], '4u': [0.44, 0.178, 0.65, 4], desk: [0.25, 0.05, 0.2, 0], mini: [0.18, 0.035, 0.18, 0], tower: [0.2, 0.45, 0.45, 0] };
    const wI = num(t.dims.w, 0.01, v => t.dims.w = v), hI = num(t.dims.h, 0.001, v => t.dims.h = v), dI = num(t.dims.d, 0.01, v => t.dims.d = v), uI = num(t.uHeight || 0, 1, v => t.uHeight = Math.round(v));

    const body = h('div', { class: 'tpl-editor' },
      h('div', { class: 'col' },
        fld('Name', h('input', { class: 'inp', value: t.name, oninput: e => { t.name = e.target.value; } })),
        h('div', { class: 'row2' },
          fld('Category', h('input', { class: 'inp', list: 'catlist', value: t.category, oninput: e => { t.category = e.target.value || 'Custom'; } }), 'Pick one or type a new one'),
          fld('Colour', h('input', { class: 'inp color', type: 'color', value: t.color, oninput: e => { t.color = e.target.value; redraw(); } }))),
        h('datalist', { id: 'catlist' }, cats.map(c => h('option', { value: c }))),
        h('div', { class: 'row2' },
          fld('Vendor', h('input', { class: 'inp', value: t.vendor || '', oninput: e => { t.vendor = e.target.value; } })),
          fld('Model', h('input', { class: 'inp', value: t.model || '', oninput: e => { t.model = e.target.value; } }))),
        h('div', { class: 'row2' },
          fld('Base shape', sel(SHAPES, t.shape, v => { t.shape = v; })),
          fld('Front panel', sel(FACES, t.face, v => { t.face = v; }))),
        h('div', { class: 'row4' }, fld('Width m', wI), fld('Height m', hI), fld('Depth m', dI), fld('Rack U', uI, '0 = not rack-mount')),
        h('select', { class: 'inp', onchange: e => { const p = PRE[e.target.value]; if (!p) return; [t.dims.w, t.dims.h, t.dims.d, t.uHeight] = p; wI.value = p[0]; hI.value = p[1]; dI.value = p[2]; uI.value = p[3]; if (p[3] && t.shape !== 'rackmount') { t.shape = 'rackmount'; } redraw(); } }, presets.map(([k, l]) => h('option', { value: k }, l))),
        h('div', { class: 'row4' },
          fld('Drive bays', num(t.bays || 0, 1, v => t.bays = Math.round(v))),
          fld('Rack units', num(t.rackUnits || 0, 1, v => t.rackUnits = Math.round(v)), 'racks only'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: t.l2, onchange: e => { t.l2 = e.target.checked; } }), 'Bridges L2'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: t.l3, onchange: e => { t.l3 = e.target.checked; } }), 'Routes IP')),
        h('div', { class: 'row4' },
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: t.virtual, onchange: e => { t.virtual = e.target.checked; } }), 'Virtual (topology only)'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: t.physicalOnly, onchange: e => { t.physicalOnly = e.target.checked; } }), 'Room only'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: t.passthrough, onchange: e => { t.passthrough = e.target.checked; } }), 'Patch pass-through'),
          fld('Surface heights m', h('input', { class: 'inp', value: (t.levels || []).join(', '), placeholder: 'e.g. 0.75', oninput: e => { const v = e.target.value.split(',').map(x => parseFloat(x)).filter(Number.isFinite); t.levels = v.length ? v : null; } }))),
        h('h4', null, 'Ports'), rowsEl, portSummary,
        h('h4', null, 'Default attributes'), attrsEl),
      h('div', { class: 'col side' },
        canvas,
        h('div', { class: 'btnrow' },
          h('button', { class: 'btn small', onclick: async () => {
            const f = await pickFile('.glb,.gltf'); if (!f) return;
            if (f.size > 8 * 1024 * 1024) toast('Large model: this may slow down saving and old PCs.', 'warn', 4000);
            t.modelData = await readFileDataURL(f); forgetModel(ptpl);
            modelInfo.textContent = `3D model loaded (${Math.round(f.size / 1024)} KB)`; redraw();
          } }, 'Import .glb model'),
          h('button', { class: 'btn small', onclick: () => { delete t.modelData; forgetModel(ptpl); modelInfo.textContent = 'Using the built-in shape.'; redraw(); } }, 'Remove model')),
        modelInfo,
        h('p', { class: 'muted small' }, 'A .glb model is scaled to fit the width, height and depth. Use a single-file .glb (not .gltf with separate files). Keep it low-poly for older PCs.'),
        !isNew ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'applyExisting' }), 'Also update shape, size and colour of devices already placed from this template') : null));

    const m = modal(isNew ? 'New custom object' : 'Edit custom object', body, [
      { label: 'Cancel' },
      { label: isNew ? 'Add to library' : 'Save', primary: true, onClick: async () => {
        t.ports = expandPorts(t.portRows);
        if (!t.name.trim()) { toast('Name is required', 'err'); return true; }
        if (isNew) { t.id = 'cus_' + uid('t').slice(3); this.app.library.custom.push(t); }
        else {
          const i = this.app.library.custom.findIndex(x => x.id === t.id);
          this.app.library.custom[i] = t; forgetModel(t.id);
          if (m.el.querySelector('#applyExisting')?.checked) this.app.applyTemplateToDevices(t);
        }
        await this.app.saveLibrary(); this.render();
        this.app.viewport.rebuildAll();
        toast(`Saved "${t.name}"`, 'ok');
      } },
    ], { wide: true, onClose: () => pv && pv.dispose() });
    setTimeout(redraw, 30);
  }
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const L = (r + g + b) / 3; if (L < 110) { const f = 110 / Math.max(L, 1); r = Math.min(255, r * f + 40); g = Math.min(255, g * f + 40); b = Math.min(255, b * f + 40); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** Turn port groups into a port list. start null = use prefix as the literal name. */
export function expandPorts(rows) {
  const out = [];
  for (const r of rows || []) {
    const n = Math.max(1, r.count || 1);
    if (r.start === null || r.start === undefined || r.start === '') {
      for (let i = 0; i < n; i++) out.push({ name: n > 1 ? `${r.prefix}${i}` : r.prefix, kind: r.kind, speed: r.speed || '' });
    } else out.push(...P(r.prefix, +r.start, n, r.kind, r.speed || ''));
  }
  return out;
}
/** Best-effort grouping of an existing port list back into rows. */
export function compressPorts(ports) {
  const rows = [];
  for (const p of ports) {
    const m = /^(.*?)(\d+)$/.exec(p.name);
    const last = rows[rows.length - 1];
    if (m && last && last.start !== null && last.prefix === m[1] && last.kind === p.kind && (last.speed || '') === (p.speed || '') && +m[2] === last.start + last.count) { last.count++; continue; }
    if (m) rows.push({ prefix: m[1], start: +m[2], count: 1, kind: p.kind, speed: p.speed || '' });
    else rows.push({ prefix: p.name, start: null, count: 1, kind: p.kind, speed: p.speed || '' });
  }
  return rows;
}
