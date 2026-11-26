// Right panel: properties for the selected device, link, or the lab.
import { h, clear, uid, parseCIDR, intToIp, ipToInt, download, pickFile, readFileText, fmtTime, safeName } from './util.js';
import { PORT_KINDS, MEDIA } from './templates.js';
import {
  devById, portById, linkById, linksOfPort, otherEnd, endLabel, makePort, isRack, isFurniture, rackOccupancy, rackFits,
  rackFirstFree, deviceRoomId, LINKABLE, MULTI_LINK, portIsFree, wifiClients, NON_IP, portFamily,
  INV_STATUS, isDeployed, warrantyState,
} from './model.js';
import { routeTable, l3Ifaces, duplicateIps, ping } from './netsim.js';
import { runningConfig } from './cli.js';
import { lineDiff } from './diff.js';
import { modal, toast, confirmBox, promptText, popup } from './dialogs.js';
import { MEDIUM_COLORS, CABLE_ROUTES } from './viewport.js';
import { monitorConf, monitorHost, deviceChecks, sparkline } from './monitor.js';
import { SSH_DEFAULTS, sshConf } from './sshterm.js';

const TABS = [['general', 'General'], ['physical', 'Physical'], ['ports', 'Ports'], ['routing', 'Routing'], ['services', 'Services'], ['files', 'Configs'], ['console', 'Console'], ['monitor', 'Monitor']];
const ROOM_TABS = TABS.slice(0, 2); // racks, desks, shelves: no ports, configs or console
const ap = (el, ...k) => { el.append(...k.flat(Infinity).filter(x => x !== null && x !== undefined && x !== false)); return el; };
const VIRTUAL_KINDS = new Set(['svi', 'sub', 'loop', 'tunnel']);
const DASHED_MEDIA = new Set(['wireless', 'tunnel', 'virtual']);
const SECURITY = [['wpa2', 'WPA2-PSK'], ['wpa3', 'WPA3-SAE'], ['wpa2/3', 'WPA2/WPA3'], ['802.1x', 'WPA2/3 Enterprise'], ['open', 'Open']];

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

  tab_ports(d, el) {
    const app = this.app, lab = app.lab, S = { dev: d.id };
    const L2 = d.l2;
    const table = h('div', { class: 'ports' + (L2 ? ' l2' : '') });
    ap(table, h('div', { class: 'prow head' }, h('span'), h('span', null, 'Name'), h('span', null, 'IP / CIDR'),
      L2 ? h('span', null, 'Mode') : null, L2 ? h('span', null, 'VLAN') : null, h('span', null, 'On'), h('span', null, 'Link')));
    for (const p of d.ports) {
      const links = linksOfPort(lab, d.id, p.id);
      const open = this.expanded.has(p.id);
      const virtual = VIRTUAL_KINDS.has(p.kind);
      const showsMode = L2 && LINKABLE.has(p.kind) && !NON_IP.has(p.kind) && p.kind !== 'tunnel';
      const linkCell = links.length
        ? h('button', { class: 'linkchip', title: links.map(l => endLabel(lab, otherEnd(l, d.id, p.id))).join('\n'), onclick: () => app.select({ type: 'link', id: links[0].id }) },
          links.length > 1 ? `${links.length} peers` : endLabel(lab, otherEnd(links[0], d.id, p.id)))
        : h('span', { class: 'muted small' }, LINKABLE.has(p.kind) ? '—' : 'virtual');
      ap(table, h('div', { class: 'prow' + (p.enabled ? '' : ' off') },
        h('button', { class: 'mini', title: 'More', onclick: () => { open ? this.expanded.delete(p.id) : this.expanded.add(p.id); this.render(); } }, open ? '▾' : '▸'),
        this.inp(p, 'name', null, S, { k: `pn-${p.id}`, after: (v, old) => { for (const r of d.routes) if (r.dev === old) r.dev = v; }, title: `${p.kind}${p.speed ? ' · ' + p.speed : ''}${p.ssid ? ' · SSID ' + p.ssid : ''}${p.desc ? ' · ' + p.desc : ''}` }),
        NON_IP.has(p.kind) ? h('span', { class: 'muted small' }, p.kind) :
          this.inp(p, 'ip', null, 'all', { k: `pi-${p.id}`, ph: 'none', mono: true, validate: v => v && v !== 'dhcp' && !parseCIDR(v) ? `"${v}" is not A.B.C.D/NN` : '' }),
        L2 ? (showsMode ? this.inp(p, 'mode', null, S, { k: `pm-${p.id}`, type: 'select', options: [['access', 'access'], ['trunk', 'trunk'], ['routed', 'routed']] }) : h('span', { class: 'muted small' }, p.kind)) : null,
        L2 ? (p.kind === 'wifi' && d.ssids.length ? h('span', { class: 'muted small', title: 'Clients get the VLAN of their SSID (Routing tab)' }, 'per SSID')
          : showsMode && p.mode === 'access' ? this.inp(p, 'vlan', null, S, { k: `pv-${p.id}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 })
          : showsMode && p.mode === 'trunk' ? h('button', { class: 'linkchip', title: `native ${p.nativeVlan || 1}, allowed ${p.trunkVlans || 'all'} (click to edit)`, onclick: () => { this.expanded.add(p.id); this.render(); } }, `${p.nativeVlan || 1}/${p.trunkVlans || 'all'}`)
            : (p.kind === 'svi' || p.kind === 'sub') ? h('span', { class: 'muted small' }, `v${p.vlan}`) : h('span')) : null,
        this.inp(p, 'enabled', null, { dev: d.id }, { k: `pe-${p.id}`, type: 'check', title: 'Admin up' }),
        linkCell));
      if (open) {
        ap(table, h('div', { class: 'pdetail' },
          h('div', { class: 'row4' },
            this.inp(p, 'kind', 'Kind', S, { k: `pk-${p.id}`, type: 'select', options: PORT_KINDS.map(k => [k, k]) }),
            this.inp(p, 'desc', 'Description', 'none', { k: `pd-${p.id}` }),
            this.inp(p, 'speed', 'Speed', 'none', { k: `ps-${p.id}` }),
            this.inp(p, 'mac', 'MAC', 'none', { k: `pmac-${p.id}`, mono: true })),
          showsMode && p.mode === 'trunk' ? h('div', { class: 'row2' },
            this.inp(p, 'nativeVlan', 'Native VLAN', S, { k: `pnv-${p.id}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 }),
            this.inp(p, 'trunkVlans', 'Allowed VLANs', S, { k: `pat-${p.id}`, ph: 'all or 10,20-30', mono: true })) : null,
          p.kind === 'svi' || p.kind === 'sub' ? h('div', { class: 'row2' },
            this.inp(p, 'vlan', p.kind === 'svi' ? 'VLAN (SVI / bridge)' : '802.1Q tag', 'all', { k: `pvv-${p.id}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 }),
            p.kind === 'sub' ? this.inp(p, 'parent', 'Parent port', 'all', { k: `ppar-${p.id}`, type: 'select', options: [['', '—'], ...d.ports.filter(x => !VIRTUAL_KINDS.has(x.kind) && x.id !== p.id).map(x => [x.id, x.name])] }) : h('span')) : null,
          p.kind === 'wifi' && !d.ssids.length ? h('div', { class: 'row2' },
            this.inp(p, 'ssid', 'Joins SSID', 'all', { k: `pssid-${p.id}`, ph: 'SSID name', list: 'ssid-list' }), h('span')) : null,
          h('div', { class: 'btnrow' },
            links.length ? h('button', { class: 'btn small', onclick: () => { app.lab.links = app.lab.links.filter(l => !links.includes(l)); this.commit('Disconnect', 'all'); } }, 'Disconnect') : null,
            h('button', { class: 'btn small danger', onclick: () => { app.removePortRaw(d, p.id); this.commit('Remove port', 'all'); } }, 'Remove port'))));
      }
    }
    const kindSel = h('select', { class: 'inp', 'data-k': 'newkind' }, PORT_KINDS.map(k => h('option', { value: k }, k)));
    const ssidList = h('datalist', { id: 'ssid-list' }, [...new Set(lab.devices.flatMap(x => x.ssids.map(s => s.name)))].map(n => h('option', { value: n })));
    ap(el, table, ssidList, h('div', { class: 'btnrow' }, kindSel,
      h('button', { class: 'btn small', onclick: () => {
        const kind = kindSel.value;
        const base = { eth: 'eth', sfp: 'sfp', wifi: 'wlan', vport: 'veth', tunnel: 'wg', svi: 'vlan', sub: 'sub', loop: 'lo', console: 'con', usb: 'usb', video: 'hdmi', power: 'psu' }[kind];
        let n = 0; while (d.ports.some(p => p.name === base + n)) n++;
        const np = makePort({ name: base + n, kind, mode: d.l2 ? 'access' : 'routed' });
        if (kind === 'sub') { const par = d.ports.find(x => !VIRTUAL_KINDS.has(x.kind)); np.parent = par?.id || null; np.vlan = 10; np.name = (par?.name || 'eth0') + '.10'; }
        d.ports.push(np); this.expanded.add(np.id); this.commit('Add port', { dev: d.id });
      } }, '+ Add port')),
      h('p', { class: 'muted small' }, L2
        ? 'This device bridges: access ports carry one VLAN, trunks carry tagged VLANs. Use an svi port (VLAN interface) for its own IP.'
        : 'IP format: 192.168.10.10/24. Turn on "Bridges L2" in General to get switchport modes and VLANs.'));
  }

  tab_routing(d, el) {
    const S = { dev: d.id };
    const ifNames = [['', '—'], ...d.ports.filter(p => !NON_IP.has(p.kind)).map(p => [p.name, p.name])];
    const rt = h('div', { class: 'routes' }, h('div', { class: 'rrow head' }, h('span', null, 'Destination'), h('span', null, 'Next hop'), h('span', null, 'or interface'), h('span')));
    d.routes.forEach((r, i) => ap(rt, h('div', { class: 'rrow' },
      this.inp(r, 'dest', null, 'none', { k: `rd-${i}`, mono: true, ph: '0.0.0.0/0', validate: v => parseCIDR(v) ? '' : 'Destination must be A.B.C.D/NN' }),
      this.inp(r, 'via', null, 'none', { k: `rv-${i}`, mono: true, ph: '192.168.10.1', validate: v => !v || ipToInt(v) !== null ? '' : 'Next hop must be an IPv4 address' }),
      this.inp(r, 'dev', null, 'none', { k: `rdev-${i}`, type: 'select', options: ifNames }),
      h('button', { class: 'mini', onclick: () => { d.routes.splice(i, 1); this.commit('Remove route', 'none'); } }, '×'))));
    ap(rt, h('div', { class: 'btnrow' },
      h('button', { class: 'btn small', onclick: () => { d.routes.push({ dest: '0.0.0.0/0', via: '', dev: '' }); this.commit('Add route', 'none'); } }, '+ Static route')));
    const table = routeTable(d);
    ap(el, this.inp(d, 'l3', 'Routes IP for other devices (IP forwarding)', S, { type: 'check', k: 'l3b' }),
      h('h4', null, 'Static routes'), rt,
      h('h4', null, 'Routing table (live)'),
      h('pre', { class: 'mono-box' }, table.length ? table.map(r => `${r.type}  ${r.dest.padEnd(19)} ${r.via ? 'via ' + r.via : ''}${r.dev ? (r.via ? ' ' : 'dev ') + r.dev : ''}`).join('\n') : 'empty'));
    // quick test
    const tgt = h('input', { class: 'inp mono', placeholder: 'ping target, e.g. 192.168.10.10', 'data-k': 'pingtgt', value: this.lastPing || '' });
    const out = h('div', { class: 'ping-out' });
    const run = () => {
      this.lastPing = tgt.value.trim();
      const r = ping(this.app.lab, d, this.lastPing);
      ap(clear(out), h('div', { class: r.ok ? 'ok' : 'err' }, r.ok ? `Reply from ${this.lastPing}` : `Failed: ${r.reason}`),
        r.fwd && r.fwd.hops?.length ? h('div', { class: 'muted small' }, 'Path: ' + [d.name, ...r.fwd.hops.map(x => x.to.name)].join(' → ')) : null);
      this.app.animatePing(r);
    };
    tgt.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    ap(el, h('h4', null, 'Test reachability'), h('div', { class: 'btnrow' }, tgt, h('button', { class: 'btn small primary', onclick: run }, 'Ping')), out);
    if (d.l2) {
      const vl = h('div', { class: 'routes' });
      d.vlans.sort((a, b) => a.id - b.id).forEach((v, i) => ap(vl, h('div', { class: 'vrow' },
        this.inp(v, 'id', null, 'none', { k: `vid-${i}`, type: 'number', min: 1, max: 4094, step: 1 }),
        this.inp(v, 'name', null, 'none', { k: `vnm-${i}`, ph: 'name' }),
        h('button', { class: 'mini', onclick: () => { d.vlans.splice(i, 1); this.commit('Remove VLAN', 'none'); } }, '×'))));
      ap(vl, h('button', { class: 'btn small', onclick: () => { const n = Math.max(1, ...d.vlans.map(v => v.id)) + 1; d.vlans.push({ id: n, name: '' }); this.commit('Add VLAN', 'none'); } }, '+ VLAN'));
      ap(el, h('h4', null, 'VLAN database'), vl);
    }
    if (d.l2 && d.ports.some(p => p.kind === 'wifi')) {
      const clients = wifiClients(this.app.lab, d);
      const on = s => clients.filter(c => c.port.ssid === s.name);
      const sl = h('div', { class: 'routes' }, d.ssids.length ? h('div', { class: 'ssrow head' }, h('span', null, 'SSID'), h('span', null, 'VLAN'), h('span', null, 'Security'), h('span', null, 'Clients'), h('span')) : null);
      d.ssids.forEach((s, i) => ap(sl, h('div', { class: 'ssrow' },
        this.inp(s, 'name', null, 'all', { k: `ssn-${i}`, ph: 'SSID', after: (v, old) => { for (const c of clients) if (c.port.ssid === old) c.port.ssid = v; } }),
        this.inp(s, 'vlan', null, 'all', { k: `ssv-${i}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 }),
        this.inp(s, 'security', null, 'none', { k: `sss-${i}`, type: 'select', options: SECURITY }),
        h('span', { class: 'muted small', title: on(s).map(c => c.dev.name).join('\n') }, String(on(s).length)),
        h('button', { class: 'mini', title: 'Remove SSID', onclick: () => { d.ssids.splice(i, 1); this.commit('Remove SSID', 'all'); } }, '×'))));
      ap(sl, h('button', { class: 'btn small', onclick: () => {
        let n = d.ssids.length + 1; while (d.ssids.some(x => x.name === 'ssid' + n)) n++;
        d.ssids.push({ name: 'ssid' + n, vlan: 1, security: 'wpa2' }); this.commit('Add SSID', 'all');
      } }, '+ SSID'));
      ap(el, h('h4', null, 'Wireless SSIDs'), sl, h('p', { class: 'muted small' }, d.ssids.length
        ? 'All radios broadcast these SSIDs. A client joins one in its wifi port (Ports tab) or on the wireless link, and lands on that VLAN. The uplink must carry the VLAN (trunk).'
        : 'No SSIDs: wireless clients use the access VLAN of the radio port. Add SSIDs to put clients on different VLANs.'));
    }
  }

  tab_services(d, el) {
    const t = h('div', { class: 'routes' }, h('div', { class: 'srow head' }, h('span', null, 'Service'), h('span', null, 'Port'), h('span', null, 'On'), h('span', null, 'Notes'), h('span')));
    d.services.forEach((s, i) => ap(t, h('div', { class: 'srow' },
      this.inp(s, 'name', null, 'none', { k: `sn-${i}` }), this.inp(s, 'port', null, 'none', { k: `sp-${i}`, mono: true }),
      this.inp(s, 'enabled', null, 'none', { k: `se-${i}`, type: 'check' }), this.inp(s, 'notes', null, 'none', { k: `so-${i}` }),
      h('button', { class: 'mini', onclick: () => { d.services.splice(i, 1); this.commit('Remove service', 'none'); } }, '×'))));
    ap(t, h('button', { class: 'btn small', onclick: () => { d.services.push({ name: '', port: '', enabled: true, notes: '' }); this.commit('Add service', 'none'); } }, '+ Service'));
    ap(el, h('p', { class: 'muted small' }, 'Record what runs on this device (DNS, AD DC, WireGuard, hypervisor…). Shown by "show services" in the console.'), t);
  }

  // ---------------------------------------------------------------- config files
  tab_files(d, el) {
    const app = this.app;
    const cur = this.fileSel.get(d.id) || '__run';
    const list = h('div', { class: 'file-list' },
      h('button', { class: 'file' + (cur === '__run' ? ' on' : ''), onclick: () => { this.fileSel.set(d.id, '__run'); this.render(); } }, 'running-config', h('small', null, 'live')),
      d.files.map(f => h('button', { class: 'file' + (cur === f.id ? ' on' : ''), onclick: () => { this.fileSel.set(d.id, f.id); this.render(); } }, f.name, h('small', null, f.snapshots.length ? `${f.snapshots.length} snap` : ''))));
    const acts = h('div', { class: 'btnrow' },
      h('button', { class: 'btn small', onclick: async () => {
        const name = await promptText('New config file', 'File name (for example wg0.conf, netplan.yaml, smb.conf)', 'config.txt');
        if (!name) return;
        const f = { id: uid('file'), name, content: '', snapshots: [] }; d.files.push(f); this.fileSel.set(d.id, f.id); this.commit('New file', 'none');
      } }, '+ New'),
      h('button', { class: 'btn small', onclick: async () => {
        const file = await pickFile(); if (!file) return;
        if (file.size > 2 * 1024 * 1024) return toast('Text files up to 2 MB only', 'err');
        const content = await readFileText(file);
        const f = { id: uid('file'), name: file.name, content, snapshots: [{ ts: Date.now(), note: 'imported', content }] };
        d.files.push(f); this.fileSel.set(d.id, f.id); this.commit('Import file', 'none'); toast(`Imported ${file.name}`, 'ok');
      } }, 'Import'),
      h('button', { class: 'btn small', onclick: () => app.exportConfigs([d]) }, 'Export all'));
    ap(el, h('div', { class: 'files' }, h('div', { class: 'files-side' }, list, acts), this.fileView(d, cur)));
  }

  fileView(d, cur) {
    const app = this.app;
    if (cur === '__run') {
      const txt = runningConfig(app.lab, d);
      return h('div', { class: 'file-main' },
        h('div', { class: 'muted small' }, 'Generated from the device model. Edit the device (or use the console) to change it.'),
        h('pre', { class: 'mono-box tall' }, txt),
        h('div', { class: 'btnrow' },
          h('button', { class: 'btn small primary', onclick: () => { const r = app.cli.exec(d, 'write memory'); if (r.changed) { this.fileSel.set(d.id, d.files.find(f => f.name === 'startup-config').id); this.commit('write memory', 'none'); toast('Saved snapshot to startup-config', 'ok'); } } }, 'Save as startup-config'),
          h('button', { class: 'btn small', onclick: () => download(`${safeName(d.name)}-running-config.txt`, txt) }, 'Download')));
    }
    const f = d.files.find(x => x.id === cur);
    if (!f) { this.fileSel.delete(d.id); return h('div'); }
    const area = h('textarea', { class: 'inp mono editor', 'data-k': `file-${f.id}`, spellcheck: 'false', onchange: e => { f.content = e.target.value; this.commit('Edit ' + f.name, 'none'); } }, f.content);
    area.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = area.selectionStart; area.setRangeText('  ', s, area.selectionEnd, 'end'); } });
    const changed = f.snapshots.length && f.snapshots[0].content !== f.content;
    return h('div', { class: 'file-main' },
      h('div', { class: 'row2' },
        this.inp(f, 'name', null, 'none', { k: `fname-${f.id}` }),
        h('div', { class: 'btnrow right' },
          h('button', { class: 'btn small primary', title: 'Keep a dated copy of this version', onclick: async () => {
            area.dispatchEvent(new Event('change'));
            const note = await promptText('Save snapshot', 'Note (what changed?)', '', 'Save');
            if (note === null) return;
            f.content = area.value; f.snapshots.unshift({ ts: Date.now(), note, content: f.content }); this.commit('Snapshot ' + f.name, 'none'); toast('Snapshot saved', 'ok');
          } }, 'Snapshot'),
          h('button', { class: 'btn small', onclick: () => download(safeName(f.name, 'config.txt'), area.value) }, 'Download'),
          h('button', { class: 'btn small danger', onclick: async () => { if (await confirmBox('Delete file', `Delete ${f.name} and its ${f.snapshots.length} snapshot(s)?`, 'Delete', true)) { d.files = d.files.filter(x => x !== f); this.commit('Delete file', 'none'); } } }, 'Delete'))),
      area,
      changed ? h('div', { class: 'warn small' }, 'Changed since the last snapshot.') : null,
      h('h4', null, `Snapshots (${f.snapshots.length})`),
      h('div', { class: 'snaps', 'data-scroll': 'snaps' }, f.snapshots.length ? f.snapshots.map((s, i) => h('div', { class: 'snap' },
        h('div', { class: 'grow' }, h('b', null, fmtTime(s.ts)), ' ', h('span', { class: 'muted' }, s.note || '')),
        h('button', { class: 'mini txt', onclick: () => this.showDiff(s.content, f.content, `${f.name}: ${fmtTime(s.ts)} → current`) }, 'diff'),
        i + 1 < f.snapshots.length ? h('button', { class: 'mini txt', onclick: () => this.showDiff(f.snapshots[i + 1].content, s.content, `${f.name}: previous → ${fmtTime(s.ts)}`) }, 'vs prev') : null,
        h('button', { class: 'mini txt', onclick: async () => { if (await confirmBox('Restore', `Replace the current text with the snapshot from ${fmtTime(s.ts)}?`, 'Restore')) { f.content = s.content; this.commit('Restore snapshot', 'none'); } } }, 'restore'),
        h('button', { class: 'mini', onclick: () => { f.snapshots.splice(i, 1); this.commit('Delete snapshot', 'none'); } }, '×'))) : h('p', { class: 'muted small' }, 'No snapshots yet.')));
  }

  showDiff(a, b, title) {
    const d = lineDiff(a, b);
    const adds = d.filter(x => x.t === '+').length, dels = d.filter(x => x.t === '-').length;
    modal(title, h('div', null, h('p', { class: 'muted small' }, `+${adds}  −${dels}`),
      h('pre', { class: 'diff' }, d.map(x => h('div', { class: x.t === '+' ? 'add' : x.t === '-' ? 'del' : '' }, `${x.t} ${x.s}`)))), [{ label: 'Close' }], { wide: true });
  }

  // ---------------------------------------------------------------- console
  tab_console(d, el) {
    const app = this.app;
    const mode = this.conMode.get(d.id) || (app.ssh.isOpen(d.id) ? 'ssh' : 'sim');
    const setMode = m => { this.conMode.set(d.id, m); this.render(); };
    ap(el, h('div', { class: 'seg con-mode' },
      h('button', { class: 'tb' + (mode === 'sim' ? ' on' : ''), title: 'IOS-style commands that edit the model', onclick: () => setMode('sim') }, 'Simulated'),
      h('button', { class: 'tb' + (mode === 'ssh' ? ' on' : ''), title: 'A real SSH session to the device', onclick: () => setMode('ssh') }, 'SSH' + (app.ssh.isOpen(d.id) ? ' ●' : ''))));
    if (mode === 'ssh') return this.sshConsole(d, el);
    if (!this.term.has(d.id)) this.term.set(d.id, [{ c: 'muted', s: `${d.name} console. Type ? for help. Changes apply to the model at once.` }]);
    const buf = this.term.get(d.id);
    const hist = this.hist.get(d.id) || []; this.hist.set(d.id, hist);
    let hi = hist.length;
    const outEl = h('div', { class: 'term-out' }, buf.map(l => h('div', { class: l.c || '' }, l.s)));
    const input = h('input', { class: 'term-in', 'data-k': `term-${d.id}`, spellcheck: 'false', autocomplete: 'off' });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) input.value = hist[++hi]; else { hi = hist.length; input.value = ''; } }
      else if (e.key === 'Enter') {
        const cmd = input.value; input.value = '';
        if (cmd.trim()) { hist.push(cmd); if (hist.length > 200) hist.shift(); }
        buf.push({ c: 'cmd', s: app.cli.prompt(d) + ' ' + cmd });
        const r = app.cli.exec(d, cmd);
        if (r.clear) buf.length = 0;
        if (r.out) buf.push({ c: /^%/.test(r.out) ? 'err' : '', s: r.out });
        if (buf.length > 600) buf.splice(0, buf.length - 600);
        if (r.changed) app.commit('CLI: ' + cmd.trim(), r.renamed ? 'all' : { dev: d.id });
        else this.render();
        if (r.save) app.save();
        if (r.anim) app.animatePing(r.anim);
      }
    });
    const termBox = h('div', { class: 'term', onclick: e => { if (e.target === termBox || e.target === outEl) input.focus(); } },
      outEl, h('div', { class: 'term-line' }, h('span', { class: 'prompt' }, app.cli.prompt(d)), input));
    ap(el, termBox);
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) input.focus(); }, 0);
  }

  sshConsole(d, el) {
    const app = this.app, ssh = app.ssh;
    if (!d.ssh) d.ssh = { ...SSH_DEFAULTS }; // saved with the next change; holds no secrets
    Object.assign(d.ssh, { ...SSH_DEFAULTS, ...d.ssh });
    const c = sshConf(d), S = { dev: d.id };
    const def = app.settings.sshEngine || 'paramiko';
    const form = h('details', { class: 'ssh-form', open: ssh.isOpen(d.id) ? null : true },
      h('summary', null, `${c.user ? c.user + '@' : ''}${c.host || monitorHost(d) || '(no host)'}:${c.port || 22} · ${ssh.engineOf(d)}${c.auth === 'password' ? ' · password' : ''}${c.legacy ? ' · legacy' : ''}`),
      h('div', { class: 'row2' },
        this.inp(d.ssh, 'host', 'Host', S, { k: 'ssh-host', mono: true, ph: monitorHost(d) || 'IP address or DNS name', hint: 'Empty = the monitor address / first IP.' }),
        this.inp(d.ssh, 'port', 'Port', S, { k: 'ssh-port', type: 'number', min: 1, max: 65535, step: 1, empty: 22 })),
      h('div', { class: 'row2' },
        this.inp(d.ssh, 'user', 'User', S, { k: 'ssh-user', mono: true, ph: 'your local user name' }),
        this.inp(d.ssh, 'engine', 'Engine', S, { k: 'ssh-engine', type: 'select', options: [['', `Default (${def})`], ['paramiko', 'paramiko'], ['system', 'System ssh (OpenSSH)']] })),
      this.inp(d.ssh, 'keyFile', 'Key file (optional)', S, { k: 'ssh-key', mono: true, ph: '~/.ssh/id_ed25519', hint: 'A path on this PC. Empty = ssh-agent and the default keys in ~/.ssh.' }),
      this.inp(d.ssh, 'auth', 'Login', S, { k: 'ssh-auth', type: 'select', options: [['key', 'Key / ssh-agent (recommended)'], ['password', 'Password (not recommended)']] }),
      c.auth === 'password' ? h('div', { class: 'warn small' }, 'Password login is not recommended. Use it only for legacy devices without key-based login. LabTracer never stores the password: paramiko asks for it in a dialog, System ssh asks in the terminal.') : null,
      this.inp(d.ssh, 'legacy', 'Allow legacy algorithms (ssh-rsa, SHA-1 key exchange, CBC ciphers) for old devices', S, { type: 'check', k: 'ssh-legacy' }),
      c.legacy && ssh.engineOf(d) === 'paramiko' && ssh.caps && ssh.caps.paramiko && !ssh.caps.paramikoLegacy
        ? h('div', { class: 'warn small' }, `paramiko ${ssh.caps.paramikoVersion} has no legacy algorithms. Select the System ssh engine for this device.`) : null);
    const miss = ssh.missing(d);
    ap(el, form, miss ? h('div', { class: 'warn small' }, miss) : null, ssh.view(d));
    if (!ssh.caps && ssh.available) ssh.loadCaps().then(x => { if (x && ssh.missing(d)) this.render(); });
  }

  // ---------------------------------------------------------------- monitor
  tab_monitor(d, el) {
    const m = this.app.monitor;
    const c = monitorConf(d);
    const set = (k, v) => { d.monitor = { ...monitorConf(d), [k]: v }; this.commit('Monitor settings', { dev: d.id }); };
    const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: c[k], 'data-k': 'mon-' + k, onchange: e => set(k, e.target.checked) }), label);
    const checks = deviceChecks(d);
    ap(el,
      chk('enabled', 'Monitor this device'),
      h('label', { class: 'fld' }, h('span', null, 'Address to check'),
        h('input', { class: 'inp mono', 'data-k': 'mon-host', value: c.host, placeholder: monitorHost({ ...d, monitor: { ...c, host: '' } }) || 'no IP on this device', onchange: e => set('host', e.target.value.trim()) }),
        h('small', null, 'Empty = first IP in the Ports tab. A DNS name also works.')),
      h('div', { class: 'row2' }, chk('ping', 'Ping'), chk('services', 'TCP connect to service ports')),
      h('h4', null, `Checks sent to the agent (${checks.length})`),
      checks.length ? h('div', { class: 'mono-box' }, checks.map(x => x.type === 'ping' ? `ping  ${x.host}` : `tcp   ${x.host}:${x.port}  ${x.label || ''}`).join('\n'))
        : h('p', { class: 'muted small' }, c.enabled ? 'Nothing to check: add an IP address, or service ports in the Services tab (for example 22, 443, 8006/tcp). UDP ports are skipped.' : 'Monitoring is off for this device.'));
    ap(el, h('h4', null, 'Live status'));
    if (!m.available) { ap(el, h('p', { class: 'muted small' }, 'Live status needs server.py.')); return; }
    if (!m.live) { ap(el, h('p', { class: 'muted small' }, 'Live status is off. Click Live in the toolbar.')); return; }
    if (m.error) ap(el, h('div', { class: 'warn small' }, 'Agent: ' + m.error));
    const st = m.device(d.id);
    if (!st) { ap(el, h('p', { class: 'muted small' }, 'No result yet. The agent gets new targets a few seconds after a change.')); return; }
    const state = m.states().get(d.id) || st.state;
    ap(el,
      h('div', { class: 'stline' }, h('span', { class: 'stbadge st-' + state }, state), h('span', { class: 'muted small' }, `since ${fmtTime(st.since * 1000)}`)),
      h('div', { class: 'checks' }, st.checks.map(x => h('div', { class: 'chkrow' + (x.ok ? '' : ' bad') },
        h('span', { class: 'dot' }), h('span', { class: 'mono' }, x.type === 'ping' ? `ping ${x.host}` : `${x.host}:${x.port}`),
        h('span', { class: 'muted' }, x.label || ''), h('span', { class: 'mono' }, x.ok ? `${x.ms} ms` : x.err)))),
      h('h4', null, `Last ${st.history.length} runs`),
      h('div', { class: 'spark', html: sparkline(st.history) || '<span class="muted small">Needs two runs.</span>' }));
  }

  // ---------------------------------------------------------------- link
  renderLink(l) {
    const app = this.app, lab = app.lab;
    const da = devById(lab, l.a.dev), db = devById(lab, l.b.dev);
    const pa = portById(da, l.a.port), pb = portById(db, l.b.port);
    const endSel = (end, dev, other) => {
      const curPort = portById(dev, end.port);
      const fits = (d, p) => portIsFree(lab, d, p) && portFamily(p) === portFamily(curPort);
      const devOpts = lab.devices.filter(x => !x.physicalOnly && x.id !== other.dev).sort((a, b) => a.name.localeCompare(b.name));
      const moveTo = id => {
        const nd = devById(lab, id);
        const free = nd.ports.find(p => fits(nd, p));
        if (!free) { toast(`${nd.name} has no free ${portFamily(curPort) === 'data' ? '' : curPort.kind + ' '}port. Add one in its Ports tab, then try again.`, 'err', 4000); this.render(); return; }
        const from = dev.name;
        end.dev = nd.id; end.port = free.id;
        this.commit(`Move cable from ${from} to ${nd.name}`, 'all');
        toast(`Cable moved to ${nd.name}:${free.name}. Pick another port below if needed.`, 'ok', 3000);
      };
      return h('div', { class: 'row2' },
        h('label', { class: 'fld' }, h('span', null, 'Device'),
          h('div', { class: 'btnrow tight' },
            h('select', { class: 'inp', 'data-k': 'endd-' + end.dev, title: 'Move this end of the cable to another device', onchange: e => moveTo(e.target.value) },
              devOpts.map(x => h('option', { value: x.id, selected: x.id === dev.id ? 'selected' : null }, x.name))),
            h('button', { class: 'mini', title: `Select ${dev.name}`, onclick: () => app.select({ type: 'device', id: dev.id }) }, '→'))),
        h('label', { class: 'fld' }, h('span', null, 'Port'), h('select', { class: 'inp', 'data-k': 'endp-' + end.dev, onchange: e => { end.port = e.target.value; this.commit('Move cable to another port', 'all'); } },
          dev.ports.filter(p => LINKABLE.has(p.kind)).map(p => {
            const used = !MULTI_LINK.has(p.kind) && linksOfPort(lab, dev.id, p.id).some(x => x.id !== l.id);
            return h('option', { value: p.id, selected: p.id === end.port ? 'selected' : null, disabled: used ? 'disabled' : null }, p.name + (used ? ' (in use)' : ''));
          }))));
    };
    const up = pa?.enabled && pb?.enabled;
    ap(this.el, 
      h('div', { class: 'insp-head' }, h('span', { class: 'swatch line', style: { background: l.color || MEDIUM_COLORS[l.medium] || '#999' } }),
        h('div', { class: 'grow' }, h('div', { class: 'title' }, `${da.name} ↔ ${db.name}`), h('div', { class: 'muted small' }, `${pa?.name} ↔ ${pb?.name} · ${up ? 'up' : 'down (a port is shut)'}`)),
        h('button', { class: 'icon-btn danger', title: 'Delete link (Del)', onclick: () => app.deleteSelection() }, '🗑')),
      h('div', { class: 'insp-body' },
        this.inp(l, 'medium', 'Medium', 'all', { type: 'select', options: MEDIA.filter(m => m[0] !== 'auto') }),
        this.inp(l, 'label', 'Label', 'all', { ph: 'e.g. trunk, DMZ, LACP-1' }),
        this.ssidPicker(da, pa, db, pb),
        DASHED_MEDIA.has(l.medium) ? null : h('div', { class: 'row2' },
          this.inp(l, 'route', 'Cable route (room view)', 'all', { type: 'select', options: [['', 'Lab default'], ...CABLE_ROUTES] }),
          h('label', { class: 'fld' }, h('span', null, 'Length'), h('span', { class: 'mono small' }, (len => len ? `≈ ${len.toFixed(1)} m as drawn` : 'open the room view')(app.viewport.cableLength(l.id))))),
        h('div', { class: 'row2' }, this.inp(l, 'color', 'Colour override', 'all', { type: 'color' }),
          h('label', { class: 'fld' }, h('span', null, ' '), h('button', { class: 'btn small', onclick: () => { delete l.color; this.commit('Reset colour', 'all'); } }, 'Use medium colour'))),
        h('p', { class: 'muted small' }, 'To move this cable, change the device or port on either end. The other end stays plugged in.'),
        h('h4', null, 'End A'), endSel(l.a, da, l.b),
        h('h4', null, 'End B'), endSel(l.b, db, l.a),
        this.inp(l, 'notes', 'Notes (cable ID, length, patch path…)', 'none', { type: 'area', rows: 3, trim: false })));
  }

  /** Wireless link between an AP with SSIDs and a client: pick the client's SSID here. */
  ssidPicker(da, pa, db, pb) {
    if (pa?.kind !== 'wifi' || pb?.kind !== 'wifi') return null;
    const [apDev, client] = da.ssids.length ? [da, pb] : (db.ssids.length ? [db, pa] : []);
    if (!apDev) return null;
    const opts = [['', '— not joined —'], ...apDev.ssids.map(s => [s.name, `${s.name} (VLAN ${s.vlan || 1})`])];
    if (client.ssid && !apDev.ssids.some(s => s.name === client.ssid)) opts.push([client.ssid, `${client.ssid} (not on ${apDev.name})`]);
    return this.inp(client, 'ssid', `SSID on ${apDev.name}`, 'all', { type: 'select', options: opts });
  }

  monitorSection() {
    const app = this.app, m = app.monitor;
    if (!m.available) return h('p', { class: 'muted small' }, 'Live status needs server.py. It is not available when index.html is opened directly.');
    const url = h('input', { class: 'inp mono', 'data-k': 'mon-url', value: m.config.agentUrl || '', placeholder: 'http://192.168.10.10:8766' });
    const tok = h('input', { class: 'inp mono', 'data-k': 'mon-tok', type: 'password', autocomplete: 'off', placeholder: m.config.hasToken ? 'saved (leave empty to keep)' : 'paste the agent token' });
    const ca = h('input', { class: 'inp mono', 'data-k': 'mon-ca', value: m.config.cafile || '', placeholder: 'optional: path to your CA .pem (HTTPS)' });
    const insecure = h('input', { type: 'checkbox', checked: m.config.insecure });
    const save = async () => {
      const body = { agentUrl: url.value.trim(), cafile: ca.value.trim(), insecure: insecure.checked };
      if (tok.value.trim()) body.token = tok.value.trim();
      await m.saveConfig(body); tok.value = '';
    };
    const st = m.status;
    const counts = { up: 0, degraded: 0, down: 0, unknown: 0 };
    for (const v of m.states().values()) counts[v] = (counts[v] || 0) + 1;
    const bad = [...m.states()].filter(([, v]) => v === 'down' || v === 'degraded');
    return h('div', null,
      h('label', { class: 'fld' }, h('span', null, 'Agent address'), url),
      h('div', { class: 'row2' }, h('label', { class: 'fld' }, h('span', null, 'Token'), tok), h('label', { class: 'fld' }, h('span', null, 'CA file (HTTPS)'), ca)),
      h('label', { class: 'chk' }, insecure, 'Skip TLS certificate check (not recommended)'),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small', onclick: async () => { try { await save(); toast('Agent settings saved', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Save'),
        h('button', { class: 'btn small', onclick: async () => {
          try { await save(); const r = await fetch('/api/monitor/status', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); toast(`Connected: ${j.host}, agent ${j.version}, ${j.targets} target(s), every ${j.interval}s`, 'ok', 4000); }
          catch (e) { toast('Test failed: ' + e.message, 'err', 5000); }
        } }, 'Test'),
        h('button', { class: 'btn small', onclick: async () => { try { await save(); await m.push(); } catch (e) { toast('Push failed: ' + e.message, 'err', 5000); } } }, 'Send targets'),
        h('button', { class: 'btn small' + (m.live ? '' : ' primary'), onclick: () => app.toggleLive() }, m.live ? 'Stop live' : 'Start live')),
      m.error ? h('div', { class: 'warn small' }, 'Agent: ' + m.error) : null,
      m.live && st ? h('div', null,
        h('p', { class: 'small' }, h('span', { class: 'ok' }, `${counts.up} up`), ' · ', h('span', { class: 'warn' }, `${counts.degraded} degraded`), ' · ', h('span', { class: 'err' }, `${counts.down} down`),
          h('span', { class: 'muted' }, ` · agent ${st.host}, last run ${st.generated ? new Date(st.generated * 1000).toLocaleTimeString() : 'never'}`)),
        bad.length ? h('div', { class: 'chips' }, bad.map(([id, v]) => { const d = devById(app.lab, id); return d ? h('span', { class: 'chip st-' + v }, h('button', { class: 'chip-name', onclick: () => { this.tab = 'monitor'; app.select({ type: 'device', id }); } }, d.name)) : null; })) : null) : null,
      h('p', { class: 'muted small' }, 'The agent pings each device and connects to TCP service ports. See agent/README.md to install it.'));
  }

  // ---------------------------------------------------------------- lab overview
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
