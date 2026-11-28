// SPDX-License-Identifier: Apache-2.0
// Right panel: properties for the selected device, link, or the lab.
import { h, ap, clear, mixin } from './util.js';
import { devById, linkById } from './model.js';
import { toast } from './dialogs.js';
import { GeneralTab } from './inspector/general.js';
import { PhysicalTab } from './inspector/physical.js';
import { PortsTab } from './inspector/ports.js';
import { RoutingTab } from './inspector/routing.js';
import { FilesTab } from './inspector/files.js';
import { ConsoleTab } from './inspector/console.js';
import { MonitorPanels } from './inspector/monitor.js';
import { DriftTab } from './inspector/drift.js';
import { NagiosPanel } from './inspector/nagios.js';
import { LinkPanel } from './inspector/link.js';
import { LabPanel } from './inspector/lab.js';

const TABS = [['general', 'General'], ['physical', 'Physical'], ['ports', 'Ports'], ['routing', 'Routing'], ['services', 'Services'], ['files', 'Configs'], ['console', 'Console'], ['monitor', 'Monitor'], ['drift', 'Drift']];
const ROOM_TABS = TABS.slice(0, 2); // racks, desks, shelves: no ports, configs or console

export class Inspector {
  constructor(el, app) {
    this.el = el; this.app = app;
    this.tab = 'general';
    this.expanded = new Set();
    this.fileSel = new Map();
    this.term = new Map();
    this.hist = new Map();
    this.conMode = new Map(); // device id -> 'sim' | 'ssh'
  }

  // ---------------------------------------------------------------- helpers
  commit(label, scope) { this.app.commit(label, scope); }
  /** Bound input. kind: text|number|check|select|color|area */
  inp(obj, key, label, scope, o = {}) {
    const k = o.k || key;
    let el;
    const set = v => {
      if (o.validate) { const msg = o.validate(v); if (msg) { toast(msg, 'err'); el.classList.add('bad'); } else el.classList.remove('bad'); }
      const before = obj[key];
      obj[key] = v;
      if (o.after) o.after(v, before);
      this.commit(o.label || `Edit ${label || key}`, scope);
    };
    if (o.type === 'check') el = h('input', { type: 'checkbox', checked: !!obj[key], 'data-k': k, onchange: e => set(e.target.checked) });
    else if (o.type === 'select') el = h('select', { class: 'inp', 'data-k': k, onchange: e => set(o.num ? Number(e.target.value) : e.target.value) },
      o.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(obj[key] ?? '') ? 'selected' : null }, l)));
    else if (o.type === 'area') el = h('textarea', { class: 'inp' + (o.mono ? ' mono' : ''), rows: o.rows || 3, 'data-k': k, placeholder: o.ph || '', onchange: e => set(e.target.value) }, obj[key] || '');
    else if (o.type === 'number') el = h('input', { class: 'inp', type: 'number', step: o.step || 'any', min: o.min, max: o.max, value: obj[key] ?? '', 'data-k': k, placeholder: o.ph || '', onchange: e => set(e.target.value === '' ? (o.empty ?? 0) : Number(e.target.value)) });
    else if (o.type === 'date') el = h('input', { class: 'inp', type: 'date', value: obj[key] || '', 'data-k': k, onchange: e => set(e.target.value) });
    else if (o.type === 'color') el = h('input', { class: 'inp color', type: 'color', value: obj[key] || '#888888', 'data-k': k, onchange: e => set(e.target.value) });
    else el = h('input', { class: 'inp' + (o.mono ? ' mono' : ''), value: obj[key] ?? '', 'data-k': k, placeholder: o.ph || '', list: o.list, onchange: e => set(o.trim === false ? e.target.value : e.target.value.trim()) });
    if (o.title) el.title = o.title;
    if (o.validate && obj[key] && o.validate(obj[key])) el.classList.add('bad');
    if (o.type === 'check') return label ? h('label', { class: 'chk' }, el, label) : el;
    return label ? h('label', { class: 'fld' }, h('span', null, label), el, o.hint ? h('small', null, o.hint) : null) : el;
  }

  render() {
    const ae = document.activeElement;
    const key = ae && this.el.contains(ae) ? ae.getAttribute('data-k') : null;
    const scrollEls = [...this.el.querySelectorAll('[data-scroll]')].map(e => [e.getAttribute('data-scroll'), e.scrollTop]);
    clear(this.el);
    const sel = this.app.selection;
    const lab = this.app.lab;
    if (sel && sel.type === 'device' && devById(lab, sel.id)) this.renderDevice(devById(lab, sel.id));
    else if (sel && sel.type === 'link' && linkById(lab, sel.id)) this.renderLink(linkById(lab, sel.id));
    else this.renderLab();
    for (const [k, top] of scrollEls) { const e = this.el.querySelector(`[data-scroll="${k}"]`); if (e) e.scrollTop = top; }
    if (key) { const e = this.el.querySelector(`[data-k="${CSS.escape(key)}"]`); if (e) { e.focus(); } }
    const term = this.el.querySelector('.term-out'); if (term) term.scrollTop = term.scrollHeight;
  }

  // ---------------------------------------------------------------- device
  renderDevice(d) {
    const app = this.app;
    const tpl = app.library.get(d.templateId);
    const head = h('div', { class: 'insp-head' },
      h('span', { class: 'swatch', style: { background: d.color } }),
      h('div', { class: 'grow' }, h('div', { class: 'title' }, d.name), h('div', { class: 'muted small' }, [d.vendor, d.model].filter(Boolean).join(' ') || (tpl ? tpl.name : d.category))),
      h('button', { class: 'icon-btn', title: 'Duplicate (Ctrl+D)', onclick: () => app.duplicateSelected() }, '⧉'),
      h('button', { class: 'icon-btn danger', title: 'Delete (Del)', onclick: () => app.deleteSelection() }, '🗑'));
    const list = d.physicalOnly ? ROOM_TABS : TABS;
    const cur = list.some(([t]) => t === this.tab) ? this.tab : 'general'; // keep the chosen tab for other devices
    const tabs = h('div', { class: 'tabs' }, list.map(([t, l]) =>
      h('button', { class: 'tab' + (cur === t ? ' on' : ''), onclick: () => { this.tab = t; this.render(); } }, l)));
    const body = h('div', { class: 'insp-body', 'data-scroll': 'body' });
    ap(this.el, head, tabs, body);
    const f = this['tab_' + cur] || this.tab_general;
    f.call(this, d, body);
  }
}

mixin(Inspector, GeneralTab, PhysicalTab, PortsTab, RoutingTab, FilesTab, ConsoleTab, MonitorPanels, DriftTab, NagiosPanel, LinkPanel, LabPanel);
