// SPDX-License-Identifier: Apache-2.0
// Inventory view: a sortable, filterable table of every item in the lab,
// plus CSV export and CSV import (new items and updates by name or serial).
import { h, clear, download, pickFile, readFileText, parseCIDR, clone, fmtTime } from './util.js';
import {
  INV_STATUS, statusLabel, isDeployed, warrantyState, deviceRoomId, devById, isRack, createDevice, uniqueName,
  makePort, portByName, rackFits, rackFirstFree, showsInRoom, L3_KINDS, RACK_U,
} from './model.js';
import { modal, toast } from './dialogs.js';
import { CATEGORY_ORDER } from './templates.js';

// ---------------------------------------------------------------- shared helpers
const money = v => (v === '' || v == null || !Number.isFinite(Number(v)) ? '' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const roomName = (lab, id) => lab.rooms.find(r => r.id === id)?.name || '';

/** Where an item is, as text: "Room › Rack U12", "Room", the storage location, or "". */
export function whereIs(lab, d) {
  const room = roomName(lab, deviceRoomId(lab, d));
  if (d.phys.mount === 'rack' && d.phys.rackId) {
    const rack = devById(lab, d.phys.rackId);
    return [room, `${rack?.name || '?'} U${d.phys.rackU || '?'}`].filter(Boolean).join(' › ');
  }
  if (room && showsInRoom(d)) return room;
  if (d.inv.location) return d.inv.location;
  if (d.virtual) return 'virtual' + (attr(d, 'host') ? ` on ${attr(d, 'host')}` : '');
  return '';
}
const attr = (d, k) => d.attrs.find(a => String(a.k || '').toLowerCase() === k)?.v || '';
const firstIp = d => d.ports.find(p => p.ip && parseCIDR(p.ip))?.ip.split('/')[0] || '';
const ipSort = ip => { const c = parseCIDR(ip); return c ? c.ip : Infinity; };

/** Items that belong in an inventory: everything except logical objects (the Internet cloud). */
export const inventoryItems = lab => lab.devices.filter(d => !d.logical);

// ---------------------------------------------------------------- CSV export
export function csvRows(lab, devices) {
  const attrKeys = new Map(); // one column per attribute key, first-seen spelling, case-insensitive
  for (const d of devices) for (const a of d.attrs) { const k = String(a.k || '').trim(); if (k && !attrKeys.has(k.toLowerCase())) attrKeys.set(k.toLowerCase(), k); }
  const head = ['name', 'status', 'category', 'vendor', 'model', 'serial', 'asset tag', 'storage location', 'room', 'rack', 'U',
    'purchased', 'supplier', 'cost', 'warranty until', 'addresses', 'macs', 'services', ...attrKeys.values(), 'notes'];
  const rows = [head];
  for (const d of devices) {
    const rack = d.phys.mount === 'rack' ? devById(lab, d.phys.rackId) : null;
    const a = new Map(d.attrs.filter(x => String(x.k || '').trim()).map(x => [String(x.k).trim().toLowerCase(), x.v ?? '']));
    rows.push([d.name, statusLabel(d.inv.status), d.category, d.vendor, d.model, d.serial, d.inv.assetTag, d.inv.location,
      showsInRoom(d) ? roomName(lab, deviceRoomId(lab, d)) : '', rack?.name || '', rack ? d.phys.rackU || '' : '',
      d.inv.purchased, d.inv.supplier, d.inv.cost, d.inv.warranty,
      d.ports.filter(p => p.ip).map(p => `${p.name}=${p.ip}`).join(' '),
      d.ports.filter(p => p.mac).map(p => `${p.name}=${p.mac}`).join(' '),
      d.services.filter(s => s.name || s.port).map(s => [s.name, s.port].filter(Boolean).join(':')).join('; '),
      ...[...attrKeys.keys()].map(k => a.get(k) ?? ''), d.notes]);
  }
  return rows;
}
// A cell that starts with = + - @ (or tab / CR) is a formula in Excel and LibreOffice, even in
// quotes: device facts and DNS names reach these cells, so such a cell gets a leading ' (shown as
// text). parseCSV() takes that ' off again, so an export imports back unchanged.
const FORMULA = /^[=+\-@\t\r]/;
export const csvCell = c => { const s = String(c ?? ''); return `"${(FORMULA.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };
export function exportInventoryCsv(lab, devices, filename) {
  // BOM so Excel reads UTF-8; CRLF line ends as RFC 4180 asks
  download(filename, '﻿' + csvRows(lab, devices).map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
}

// ---------------------------------------------------------------- CSV import
/** RFC 4180 parser. Separator: comma, semicolon or tab, whichever the header line uses most. */
export function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      continue;
    }
    if (c === '"' && f === '') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== '')).map(r => r.map(x => (x[0] === "'" && FORMULA.test(x.slice(1)) ? x.slice(1) : x)));
}

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = {
  name: ['name', 'hostname', 'device', 'devicename', 'item'],
  status: ['status', 'state', 'lifecycle'],
  category: ['category', 'type'],
  vendor: ['vendor', 'manufacturer', 'make', 'brand'],
  model: ['model', 'modelnumber'],
  serial: ['serial', 'serialnumber', 'sn', 'serialno'],
  assetTag: ['assettag', 'asset', 'tag', 'assetid', 'assetnumber'],
  location: ['storagelocation', 'location', 'storedat', 'storage'],
  room: ['room'], rack: ['rack'], u: ['u', 'racku', 'rackposition'],
  purchased: ['purchased', 'purchasedate', 'purchasedon', 'bought', 'dateofpurchase', 'acquired'],
  supplier: ['supplier', 'seller', 'store', 'shop', 'boughtfrom', 'retailer'],
  cost: ['cost', 'price', 'purchaseprice'],
  warranty: ['warranty', 'warrantyuntil', 'warrantyend', 'warrantyexpires', 'warrantyexpiry', 'warrantyexpiration'],
  addresses: ['addresses', 'address', 'ip', 'ips', 'ipaddress', 'ipaddresses'],
  macs: ['macs', 'mac', 'macaddress', 'macaddresses'],
  services: ['services', 'service'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
  template: ['template', 'templateid'],
};
const FIELD_OF = new Map(Object.entries(ALIASES).flatMap(([f, list]) => list.map(a => [a, f])));
/** Header cell -> field name, or {attr: 'Original header'} for unknown columns. */
const fieldFor = hd => FIELD_OF.get(norm(hd)) || (String(hd).trim() ? { attr: String(hd).trim() } : null);

const STATUS_WORDS = {
  active: ['active', 'inservice', 'inuse', 'deployed', 'production', 'live', 'online', 'used'],
  faulty: ['faulty', 'faultyinrepair', 'broken', 'repair', 'inrepair', 'rma', 'defective'],
  spare: ['spare', 'stock', 'instock', 'stored', 'storage', 'unused'],
  ordered: ['ordered', 'onorder', 'backorder', 'backordered', 'pending', 'incoming'],
  retired: ['retired', 'decommissioned', 'sold', 'disposed', 'dead', 'scrapped', 'ewaste'],
};
const STATUS_OF = new Map(Object.entries(STATUS_WORDS).flatMap(([s, list]) => list.map(w => [w, s])));

/** "2024-03-05", "2024/3/5", "2024-03-05T10:00" -> "2024-03-05"; null if not a valid year-first date. */
function isoDate(s) {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number), dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** "$1,234.50", "1.234,50 €", "12,5" -> "1234.5"; null if not a number. */
function parseCost(s) {
  let t = s.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(t)) return null;
  if (t.includes('.') && t.includes(',')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (/^-?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? String(n) : null;
}

const GENERIC_CATS = new Set(['network', 'compute', 'storage', 'endpoints', 'iot', 'power']);
function pickTemplate(rec, library) {
  const all = library.all();
  if (rec.template) {
    const t = library.get(rec.template) || all.find(x => x.name.toLowerCase() === rec.template.toLowerCase());
    if (t && !t.logical) return t;
  }
  if (rec.model) { // a custom object for exactly this model
    const t = all.find(x => x.model && x.model.toLowerCase() === rec.model.toLowerCase() && !x.logical);
    if (t) return t;
  }
  const cat = (rec.category || '').toLowerCase();
  if (cat === 'virtual') return library.get('vir-vm');
  const part = library.get('part-item');
  if (GENERIC_CATS.has(cat)) { // a networked device: generic box with one port
    return { ...part, physicalOnly: false, category: CATEGORY_ORDER.find(c => c.toLowerCase() === cat), ports: [{ name: 'eth0', kind: 'eth' }] };
  }
  return part; // parts, cables, anything else: inventory only, no ports
}

/** Port for "name=value" or a bare value; creates a named port if needed. null if the item takes no ports. */
function targetPort(d, name, wantIp) {
  if (d.physicalOnly) return null;
  if (name) {
    let p = portByName(d, name);
    if (!p) {
      const kind = /^vlan\d+$/i.test(name) ? 'svi' : d.virtual ? 'vport' : 'eth';
      p = makePort({ name, kind, mode: d.l2 && kind !== 'svi' ? 'access' : 'routed' }); d.ports.push(p);
    }
    return p;
  }
  let p = d.ports.find(x => L3_KINDS.has(x.kind) && (wantIp ? !x.ip : !x.mac));
  if (!p) { let n = 0; while (portByName(d, 'eth' + n)) n++; p = makePort({ name: 'eth' + n, kind: d.virtual ? 'vport' : 'eth', mode: 'routed' }); d.ports.push(p); }
  return p;
}

/**
 * Apply CSV rows to a lab (mutates it). Empty cells leave existing values alone.
 * Rows match existing items by name, then by serial. Returns counts and warnings.
 */
export function applyImport(lab, header, rows, { update = true, library }) {
  const fields = header.map(fieldFor);
  const warn = [];
  const st = { added: 0, updated: 0, same: 0, skipped: 0 };
  const byName = new Map(lab.devices.map(d => [d.name.toLowerCase(), d]));
  const bySerial = new Map(lab.devices.filter(d => d.serial).map(d => [d.serial.toLowerCase(), d]));
  const seen = new Set(), perRoom = new Map();
  const topo = lab.devices.filter(x => !x.physicalOnly);
  let topoX = topo.length ? Math.min(...topo.map(x => x.topo.x)) : 0, topoZ = topo.length ? Math.max(...topo.map(x => x.topo.z)) + 3 : 0, topoN = 0;

  rows.forEach((cells, i) => {
    const line = i + 2, rec = {}, attrs = [];
    fields.forEach((f, c) => {
      const v = String(cells[c] ?? '').trim();
      if (!f || !v) return;
      if (f.attr) attrs.push([f.attr, v]); else rec[f] = v;
    });
    if (!Object.keys(rec).length && !attrs.length) return;
    let d = (rec.name && byName.get(rec.name.toLowerCase())) || (!rec.name && rec.serial && bySerial.get(rec.serial.toLowerCase())) || null;
    if (d && !update) { st.skipped++; return; }
    if (d && seen.has(d.id)) warn.push(`Line ${line}: "${d.name}" is in the file more than once. The last line wins.`);
    const before = d ? JSON.stringify(d) : null;
    if (!d) {
      const tpl = pickTemplate(rec, library);
      d = createDevice(tpl, { name: uniqueName(lab, rec.name || rec.model || tpl.name) });
      if (!d.physicalOnly) { d.topo.x = topoX + (topoN % 8) * 2; d.topo.z = topoZ + Math.floor(topoN / 8) * 2; topoN++; }
      if (rec.rack && !(d.uHeight > 0) && !d.virtual && !isRack(d)) { // generic item for a rack: make it 1U rack equipment
        Object.assign(d, { uHeight: 1, shape: 'rackmount', dims: { w: 0.44, h: RACK_U, d: 0.5 } });
      }
      lab.devices.push(d); byName.set(d.name.toLowerCase(), d); st.added++;
    }
    seen.add(d.id);
    const W = msg => warn.push(`Line ${line} (${d.name}): ${msg}`);

    if (rec.category) rec.category = CATEGORY_ORDER.find(c => c.toLowerCase() === rec.category.toLowerCase()) || rec.category; // "network" -> "Network"
    for (const k of ['vendor', 'model', 'serial', 'category', 'notes']) if (rec[k] !== undefined) d[k] = rec[k];
    for (const k of ['assetTag', 'location', 'supplier']) if (rec[k] !== undefined) d.inv[k] = rec[k];
    if (rec.status) { const s = STATUS_OF.get(norm(rec.status)); if (s) d.inv.status = s; else W(`unknown status "${rec.status}", kept "${statusLabel(d.inv.status)}".`); }
    for (const k of ['purchased', 'warranty']) if (rec[k]) { const v = isoDate(rec[k]); if (v) d.inv[k] = v; else W(`"${rec[k]}" is not a year-first date (YYYY-MM-DD), so ${k === 'warranty' ? 'warranty until' : k} was not set.`); }
    if (rec.cost) { const v = parseCost(rec.cost); if (v !== null) d.inv.cost = v; else W(`"${rec.cost}" is not a number, so cost was not set.`); }
    for (const [k, v] of attrs) {
      const a = d.attrs.find(x => String(x.k || '').toLowerCase() === k.toLowerCase());
      if (a) a.v = v; else d.attrs.push({ k, v });
    }

    // addresses / MACs: "eth0=10.0.0.5/24 eth1=..." or a bare value
    for (const [key, prop] of [['addresses', 'ip'], ['macs', 'mac']]) {
      if (!rec[key]) continue;
      for (const tok of rec[key].split(/[\s,;]+/).filter(Boolean)) {
        const eq = tok.indexOf('=');
        const [pname, val] = eq > 0 ? [tok.slice(0, eq), tok.slice(eq + 1)] : ['', tok];
        if (prop === 'ip' && !parseCIDR(val)) { W(`"${val}" is not an IPv4 address.`); continue; }
        if (prop === 'mac' && !/^[0-9a-f]{2}([:-]?[0-9a-f]{2}){5}$/i.test(val)) { W(`"${val}" is not a MAC address.`); continue; }
        const bare = v => String(v || '').split('/')[0].replace(/-/g, ':').toLowerCase(); // compare address only, any MAC style
        if (!pname && d.ports.some(p => p[prop] && bare(p[prop]) === bare(val))) continue; // already there
        const p = targetPort(d, pname, prop === 'ip');
        if (!p) { W(`a ${d.category} item takes no ports, so "${tok}" was not set.`); break; }
        p[prop] = val;
      }
    }
    if (rec.services) {
      if (d.physicalOnly) W('a room object takes no services.');
      else for (const tok of rec.services.split(rec.services.includes(';') ? ';' : /\s+/).map(s => s.trim()).filter(Boolean)) {
        const c = tok.lastIndexOf(':');
        const [name, port] = c > 0 ? [tok.slice(0, c).trim(), tok.slice(c + 1).trim()] : (/^\d/.test(tok) ? [tok, tok] : [tok, '']);
        const s = d.services.find(x => x.name.toLowerCase() === name.toLowerCase());
        if (s) { if (port) s.port = port; } else d.services.push({ name, port, enabled: true, notes: '' });
      }
    }

    // physical place: rack (and U) wins over room
    if (rec.rack || rec.room || rec.u) {
      if (d.virtual) W('a virtual item has no physical place.');
      else if (rec.rack) {
        const rack = lab.devices.find(x => isRack(x) && x.name.toLowerCase() === rec.rack.toLowerCase());
        const u = rec.u ? parseInt(rec.u, 10) : null;
        if (!rack) W(`there is no rack called "${rec.rack}".`);
        else if (!(d.uHeight > 0)) W(`it is not rack equipment (Rack U is 0), so it was not mounted in ${rack.name}.`);
        else if (!(d.phys.mount === 'rack' && d.phys.rackId === rack.id && (!u || d.phys.rackU === u))) {
          let at = u && rackFits(lab, rack, d, u) ? u : null;
          if (!at) {
            at = rackFirstFree(lab, rack, d);
            if (u) W(at ? `U${u} in ${rack.name} is not free, so it went to U${at}.` : `U${u} in ${rack.name} is not free and the rack is full.`);
            else if (!at) W(`${rack.name} is full.`);
          }
          if (at) Object.assign(d.phys, { mount: 'rack', rackId: rack.id, rackU: at, roomId: rack.phys.roomId });
        }
      } else if (rec.room) {
        const room = lab.rooms.find(r => r.name.toLowerCase() === rec.room.toLowerCase());
        if (!room) W(`there is no room called "${rec.room}".`);
        else if (deviceRoomId(lab, d) !== room.id || d.phys.mount === 'rack') {
          const k = perRoom.get(room.id) || 0; perRoom.set(room.id, k + 1);
          const cols = Math.max(1, Math.floor((room.w - 0.4) / 0.4));
          Object.assign(d.phys, { roomId: room.id, mount: 'floor', rackId: null, rackU: null,
            x: Math.min(room.w - 0.2, 0.3 + (k % cols) * 0.4), z: Math.min(room.d - 0.2, 0.3 + Math.floor(k / cols) * 0.4) });
        }
      } else W('a U position needs a rack column.');
    }
    if (before !== null) { if (JSON.stringify(d) === before) st.same++; else st.updated++; }
  });
  return { ...st, warn };
}

// ---------------------------------------------------------------- the view
// cell(d, lab) draws the cell; opt(d) marks a column that is hidden when it is empty for every row shown
let observed = new Map(); // device id -> facts read from the device (src/collect.js), set on each render
const COLS = [
  { key: 'name', label: 'Name', val: d => d.name.toLowerCase(),
    cell: d => h('td', null, h('span', { class: 'swatch dot', style: { background: d.color } }), d.name) },
  { key: 'status', label: 'Status', val: d => INV_STATUS.findIndex(s => s[0] === d.inv.status),
    cell: d => h('td', null, h('span', { class: 'st st-' + d.inv.status }, statusLabel(d.inv.status))) },
  { key: 'category', label: 'Category', val: d => d.category.toLowerCase(), cell: d => h('td', null, d.category) },
  { key: 'model', label: 'Vendor · model', val: d => `${d.vendor} ${d.model}`.trim().toLowerCase(), opt: d => d.vendor || d.model,
    cell: d => h('td', null, [d.vendor, d.model].filter(Boolean).join(' ')) },
  { key: 'serial', label: 'Serial', val: d => d.serial.toLowerCase(), opt: d => d.serial, cell: d => h('td', { class: 'mono' }, d.serial) },
  { key: 'tag', label: 'Asset tag', val: d => d.inv.assetTag.toLowerCase(), opt: d => d.inv.assetTag, cell: d => h('td', { class: 'mono' }, d.inv.assetTag) },
  { key: 'where', label: 'Location', val: (d, lab) => whereIs(lab, d).toLowerCase(),
    cell: (d, lab) => { const w = whereIs(lab, d); return h('td', { class: w ? '' : 'muted' }, w || '—'); } },
  { key: 'ip', label: 'Address', val: d => ipSort(firstIp(d)), opt: firstIp, cell: d => h('td', { class: 'mono' }, firstIp(d)) },
  { key: 'purchased', label: 'Purchased', val: d => d.inv.purchased || '~', opt: d => d.inv.purchased, cell: d => h('td', { class: 'mono' }, d.inv.purchased) },
  { key: 'warranty', label: 'Warranty', val: d => d.inv.warranty || '~', opt: d => d.inv.warranty,
    cell: d => { const w = warrantyState(d); return h('td', { class: 'mono w-' + w, title: w === 'expired' ? 'Expired' : w === 'soon' ? 'Ends within 90 days' : '' }, d.inv.warranty); } },
  { key: 'cost', label: 'Cost', num: true, val: d => (d.inv.cost === '' ? -Infinity : Number(d.inv.cost) || 0), opt: d => d.inv.cost !== '',
    cell: d => h('td', { class: 'num' }, money(d.inv.cost)) },
  { key: 'verified', label: 'Verified', val: d => observed.get(d.id)?.collected || 0, opt: d => observed.has(d.id),
    cell: d => {
      const f = observed.get(d.id); if (!f) return h('td', { class: 'muted' }, '—');
      const s = f.system?.serial || '', same = s && d.serial && s.toLowerCase() === d.serial.toLowerCase(), differs = s && d.serial && !same;
      return h('td', { class: 'mono' + (differs ? ' w-expired' : ''), title: differs ? `The device reports serial ${s}` : same ? 'The serial matches the device' : 'Last read from the device (Drift tab)' },
        fmtTime(f.collected * 1000).slice(0, 10), same ? ' ✓' : differs ? ' ≠' : '');
    } },
];

export class InventoryView {
  constructor(el, app) {
    this.el = el; this.app = app;
    const p = app.store.getPref('inventory', {});
    this.q = ''; this.status = p.status || 'all'; this.cat = 'all'; this.room = 'all';
    this.sort = p.sort || { key: 'name', dir: 1 };
    this.search = h('input', { class: 'inp search', placeholder: 'Search name, serial, tag, address, notes…', oninput: e => { this.q = e.target.value; this.renderBody(); } });
    this.filters = h('span', { class: 'inv-filters' });
    this.body = h('div', { class: 'inv-body' });
    const bar = h('div', { class: 'inv-bar' }, h('div', { class: 'inv-search' }, this.search), this.filters,
      h('span', { class: 'grow' }),
      h('button', { class: 'btn small primary', onclick: () => this.addDialog() }, '+ Add item'),
      h('button', { class: 'btn small', onclick: () => this.importCsv() }, 'Import CSV…'),
      h('button', { class: 'btn small', title: 'Export the items shown', onclick: () => exportInventoryCsv(app.lab, this.rows(), `${app.labName}-inventory.csv`) }, 'Export CSV'));
    el.append(bar, this.body);
  }
  savePrefs() { this.app.store.setPref('inventory', { status: this.status, sort: this.sort }); }
  show(on) { this.el.hidden = !on; if (on) this.render(); }
  render() { this.renderFilters(); this.renderBody(); }

  renderFilters() {
    const lab = this.app.lab;
    const cats = [...new Set(inventoryItems(lab).map(d => d.category))].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    if (this.cat !== 'all' && !cats.includes(this.cat)) this.cat = 'all';
    if (this.room !== 'all' && this.room !== 'none' && !lab.rooms.some(r => r.id === this.room)) this.room = 'all';
    const sel = (value, opts, on) => h('select', { class: 'tb-select', onchange: e => { on(e.target.value); this.renderBody(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: v === value ? 'selected' : null }, l)));
    clear(this.filters).append(
      sel(this.status, [['all', 'All statuses'], ['deployed', 'In use (in service, faulty)'], ['stored', 'Not in use (spare, on order, retired)'], ...INV_STATUS,
        ['w-expired', 'Warranty expired'], ['w-soon', 'Warranty ends ≤ 90 days']], v => { this.status = v; this.savePrefs(); }),
      sel(this.cat, [['all', 'All categories'], ...cats.map(c => [c, c])], v => { this.cat = v; }),
      sel(this.room, [['all', 'All places'], ...lab.rooms.map(r => [r.id, r.name]), ['none', 'Not in a room']], v => { this.room = v; }));
  }

  rows() {
    const lab = this.app.lab, q = this.q.trim().toLowerCase();
    const out = inventoryItems(lab).filter(d => {
      const s = d.inv.status;
      if (this.status === 'deployed' && !isDeployed(d)) return false;
      if (this.status === 'stored' && isDeployed(d)) return false;
      if (this.status === 'w-expired' && warrantyState(d) !== 'expired') return false;
      if (this.status === 'w-soon' && warrantyState(d) !== 'soon') return false;
      if (INV_STATUS.some(x => x[0] === this.status) && s !== this.status) return false;
      if (this.cat !== 'all' && d.category !== this.cat) return false;
      if (this.room !== 'all') {
        const rid = showsInRoom(d) ? deviceRoomId(lab, d) : null;
        if (this.room === 'none' ? !!rid : rid !== this.room) return false;
      }
      if (q) {
        const hay = [d.name, d.category, d.vendor, d.model, d.serial, d.notes, d.inv.assetTag, d.inv.location, d.inv.supplier, whereIs(lab, d),
          ...d.ports.map(p => `${p.ip} ${p.mac}`), ...d.attrs.map(a => `${a.k} ${a.v}`)].join(' ').toLowerCase();
        if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
      }
      return true;
    });
    observed = this.app.collect?.facts || new Map();
    const col = COLS.find(c => c.key === this.sort.key) || COLS[0];
    const vals = new Map(out.map(d => [d, col.val(d, lab)]));
    return out.sort((a, b) => {
      const x = vals.get(a), y = vals.get(b);
      return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * this.sort.dir;
    });
  }

  renderBody() {
    if (this.el.hidden) return;
    const app = this.app, lab = app.lab;
    const scroll = this.body.querySelector('.inv-scroll')?.scrollTop || 0;
    const rows = this.rows(), all = inventoryItems(lab);
    const selId = app.selection?.type === 'device' ? app.selection.id : null;

    // summary of what is shown
    const by = new Map(INV_STATUS.map(([s]) => [s, 0]));
    let total = 0, priced = 0, expired = 0, soon = 0;
    for (const d of rows) {
      by.set(d.inv.status, by.get(d.inv.status) + 1);
      if (d.inv.cost !== '' && Number.isFinite(Number(d.inv.cost))) { total += Number(d.inv.cost); priced++; }
      const w = warrantyState(d); if (w === 'expired') expired++; else if (w === 'soon') soon++;
    }
    const chip = (label, n, filter, cls = '') => n ? h('button', { class: 'chip inv-chip ' + cls, title: 'Show only these', onclick: () => { this.status = filter; this.savePrefs(); this.render(); } }, `${n} ${label}`) : null;
    const summary = h('div', { class: 'inv-sum' },
      h('span', null, rows.length === all.length ? `${all.length} items` : `${rows.length} of ${all.length} items`),
      INV_STATUS.map(([s, l]) => chip(l.toLowerCase(), by.get(s), s, 'st-' + s)),
      priced ? h('span', { class: 'muted' }, `· total cost ${money(total)}${priced < rows.length ? ` (${priced} priced)` : ''}`) : null,
      chip('warranty expired', expired, 'w-expired', 'w-expired'), chip('warranty ends soon', soon, 'w-soon', 'w-soon'),
      this.status !== 'all' || this.cat !== 'all' || this.room !== 'all' || this.q ? h('button', { class: 'mini txt', onclick: () => {
        this.status = 'all'; this.cat = 'all'; this.room = 'all'; this.q = ''; this.search.value = ''; this.savePrefs(); this.render();
      } }, 'clear filters') : null);

    const th = c => h('th', { class: (c.num ? 'num ' : '') + (this.sort.key === c.key ? 'sorted' : ''), onclick: () => {
      this.sort = this.sort.key === c.key ? { key: c.key, dir: -this.sort.dir } : { key: c.key, dir: 1 }; this.savePrefs(); this.renderBody();
    } }, c.label, this.sort.key === c.key ? (this.sort.dir > 0 ? ' ▴' : ' ▾') : '');
    const cols = COLS.filter(c => !c.opt || rows.some(c.opt));
    const tr = d => h('tr', { class: (d.id === selId ? 'on ' : '') + (isDeployed(d) ? '' : 'stored'), 'data-id': d.id,
      onclick: () => app.select({ type: 'device', id: d.id }), ondblclick: () => app.showInView(d) }, cols.map(c => c.cell(d, lab)));
    const table = rows.length
      ? h('table', { class: 'inv-table' }, h('thead', null, h('tr', null, cols.map(th))), h('tbody', null, rows.map(tr)))
      : h('p', { class: 'muted inv-empty' }, all.length ? 'No items match the filters.' : 'No items yet. Click "+ Add item", import a CSV file, or add devices in the 3D views.');
    clear(this.body).append(summary, h('div', { class: 'inv-scroll' }, table));
    this.body.querySelector('.inv-scroll').scrollTop = scroll;
  }

  addDialog() {
    const app = this.app;
    const tpls = app.library.all().filter(t => !t.logical);
    const cats = [...new Set([...CATEGORY_ORDER, ...tpls.map(t => t.category)])].filter(c => tpls.some(t => t.category === c));
    const tplSel = h('select', { class: 'inp' }, cats.map(c => h('optgroup', { label: c }, tpls.filter(t => t.category === c).map(t =>
      h('option', { value: t.id, selected: t.id === 'part-item' ? 'selected' : null }, t.name)))));
    const name = h('input', { class: 'inp', placeholder: 'leave empty for an automatic name' });
    const status = h('select', { class: 'inp' }, INV_STATUS.map(([v, l]) => h('option', { value: v }, l)));
    modal('Add item', h('div', null,
      h('label', { class: 'fld' }, h('span', null, 'Type'), tplSel),
      h('div', { class: 'row2' }, h('label', { class: 'fld' }, h('span', null, 'Name'), name), h('label', { class: 'fld' }, h('span', null, 'Status'), status)),
      h('p', { class: 'muted small' }, 'Spare, on-order and retired items are not drawn in the 3D views. Set the other fields in the panel on the right.')),
    [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: () => { app.addItem(tplSel.value, { name: name.value.trim(), status: status.value }); } }]);
  }

  async importCsv() {
    const app = this.app;
    const f = await pickFile('.csv,.tsv,.txt,text/csv'); if (!f) return;
    let table;
    try { table = parseCSV(await readFileText(f)); } catch (e) { toast('Could not read the file: ' + e.message, 'err'); return; }
    if (table.length < 2) { toast('The file has no data rows (the first row must be the column names).', 'err', 5000); return; }
    const [header, ...rows] = table;
    if (!header.some(c => ['name', 'serial'].includes(fieldFor(c)))) { toast('The file needs a "name" or "serial" column.', 'err', 5000); return; }
    let update = true, result, trial;
    const run = () => { trial = clone(app.lab); result = applyImport(trial, header, rows, { update, library: app.library }); };
    run();
    const known = header.filter(c => typeof fieldFor(c) === 'string'), extra = header.filter(c => fieldFor(c)?.attr);
    const info = h('div');
    const draw = () => clear(info).append(...[
      h('p', null, h('b', null, `${result.added} new`), `, ${result.updated} updated, ${result.same} unchanged` + (result.skipped ? `, ${result.skipped} skipped (already in the lab)` : '') + '.'),
      result.warn.length ? h('div', { class: 'warn small' }, h('b', null, `${result.warn.length} warning(s):`),
        h('ul', { class: 'inv-warn' }, result.warn.slice(0, 30).map(w => h('li', null, w)), result.warn.length > 30 ? h('li', null, `… and ${result.warn.length - 30} more`) : null)) : null].filter(Boolean));
    draw();
    modal(`Import ${f.name}`, h('div', null,
      h('p', { class: 'small' }, `${rows.length} row(s). Columns used: ${known.join(', ') || 'none'}.`),
      extra.length ? h('p', { class: 'small muted' }, `Other columns become attributes: ${extra.join(', ')}.`) : null,
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: true, onchange: e => { update = e.target.checked; run(); draw(); } }),
        'Update items that already exist (same name, or same serial when the name is empty)'),
      h('p', { class: 'muted small' }, 'Empty cells do not change existing values. Ctrl+Z undoes the import.'),
      info),
    [{ label: 'Cancel' }, { label: 'Import', primary: true, onClick: () => {
      app.lab = trial;
      app.commit(`Import ${result.added} new, ${result.updated} updated`, 'all');
      toast(`Imported: ${result.added} new, ${result.updated} updated`, 'ok', 3500);
    } }], { wide: true });
  }
}
