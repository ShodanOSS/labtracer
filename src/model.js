// Lab document model and helpers.
import { BUILTIN, RACK_U } from './templates.js';
import { uid, clone } from './util.js';
import { LAB_VERSION, migrateLab } from './migrations.js';

export { LAB_VERSION };
export const LINKABLE = new Set(['eth', 'sfp', 'wifi', 'vport', 'tunnel', 'console', 'usb', 'video', 'power']);
export const NON_IP = new Set(['power', 'console', 'usb', 'video']); // ports outside the IP network
/** Power only plugs into power, video only into video, everything else is data. */
export const portFamily = p => (p?.kind === 'power' || p?.kind === 'video' ? p.kind : 'data');
export const MULTI_LINK = new Set(['wifi', 'tunnel']); // one radio / tunnel serves many peers
export const L3_KINDS = new Set(['eth', 'sfp', 'wifi', 'vport', 'tunnel', 'svi', 'sub', 'loop']);

// ---------------------------------------------------------------- inventory
/** Lifecycle status. Only "deployed" statuses are drawn in the 3D views and monitored. */
export const INV_STATUS = [['active', 'In service'], ['faulty', 'Faulty / in repair'], ['spare', 'Spare'], ['ordered', 'On order'], ['retired', 'Retired']];
const DEPLOYED = new Set(['active', 'faulty']);
export const invDefaults = () => ({ status: 'active', assetTag: '', location: '', purchased: '', supplier: '', cost: '', warranty: '' });
export const isDeployed = d => DEPLOYED.has(d.inv?.status || 'active');
export const statusLabel = s => (INV_STATUS.find(x => x[0] === s) || INV_STATUS[0])[1];
/** Warranty end date vs today: 'expired' | 'soon' (90 days) | 'ok' | '' (no date). */
export function warrantyState(d, now = new Date()) {
  const w = d.inv?.warranty; if (!/^\d{4}-\d{2}-\d{2}$/.test(w || '')) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [y, m, day] = w.split('-').map(Number), end = new Date(y, m - 1, day).getTime();
  if (end < today) return 'expired';
  return end - today <= 90 * 864e5 ? 'soon' : 'ok';
}

export function newLab(name = 'new-lab') {
  return {
    version: LAB_VERSION, name, notes: '',
    rooms: [{ id: uid('room'), name: 'Lab room', w: 4, d: 3.5, h: 2.4 }],
    devices: [], links: [],
    view: {},
  };
}

export function makePort(spec = {}) {
  return {
    id: uid('pt'),
    name: spec.name || 'eth0',
    kind: spec.kind || 'eth',
    speed: spec.speed || '',
    mode: spec.mode || 'access',
    vlan: spec.vlan ?? 1,
    nativeVlan: spec.nativeVlan ?? 1,
    trunkVlans: spec.trunkVlans || 'all',
    ip: spec.ip || '',
    mac: spec.mac || '',
    enabled: spec.enabled !== false,
    desc: spec.desc || '',
    parent: spec.parent || null,
  };
}

/** Copy template data into a self-contained device. */
export function createDevice(tpl, opts = {}) {
  const dev = {
    id: uid('dev'),
    name: opts.name || tpl.name,
    templateId: tpl.id,
    category: tpl.category,
    shape: tpl.shape, face: tpl.face || 'plain', bays: tpl.bays || 0,
    dims: { ...tpl.dims },
    uHeight: tpl.uHeight || 0,
    rackUnits: tpl.rackUnits || 0,
    levels: tpl.levels ? [...tpl.levels] : null,
    color: tpl.color || '#555b66',
    virtual: !!tpl.virtual, logical: !!tpl.logical, physicalOnly: !!tpl.physicalOnly,
    passthrough: !!tpl.passthrough, wall: !!tpl.wall,
    l2: !!tpl.l2, l3: !!tpl.l3,
    vendor: tpl.vendor || '', model: tpl.model || '', serial: '', notes: '',
    inv: invDefaults(),
    topo: { x: opts.x ?? 0, z: opts.z ?? 0 },
    phys: { roomId: opts.roomId ?? null, x: opts.px ?? 0, z: opts.pz ?? 0, rot: 0, elev: 0, elevAuto: true, mount: 'floor', rackId: null, rackU: null },
    attrs: Object.entries(tpl.attrs || {}).map(([k, v]) => ({ k, v })),
    ports: (tpl.ports || []).map(p => makePort(p)),
    routes: [],
    vlans: tpl.l2 ? [{ id: 1, name: 'default' }] : [],
    ssids: (tpl.ssids || []).map(s => ({ ...s })), // access point: [{name, vlan, security}]
    services: [],
    files: [],
  };
  return dev;
}

export class Library {
  constructor() { this.custom = []; }
  setCustom(list) { this.custom = Array.isArray(list) ? list : []; }
  all() { return [...BUILTIN, ...this.custom]; }
  get(id) { return this.custom.find(t => t.id === id) || BUILTIN.find(t => t.id === id) || null; }
  isCustom(id) { return this.custom.some(t => t.id === id); }
}

// ---------------------------------------------------------------- lookups
export const devById = (lab, id) => lab.devices.find(d => d.id === id) || null;
export const portById = (dev, id) => dev?.ports.find(p => p.id === id) || null;
export const portByName = (dev, name) => dev?.ports.find(p => p.name.toLowerCase() === String(name).toLowerCase()) || null;
export const linkById = (lab, id) => lab.links.find(l => l.id === id) || null;

export function linksOfPort(lab, devId, portId) {
  return lab.links.filter(l => (l.a.dev === devId && l.a.port === portId) || (l.b.dev === devId && l.b.port === portId));
}
export function linksOfDevice(lab, devId) {
  return lab.links.filter(l => l.a.dev === devId || l.b.dev === devId);
}
export function otherEnd(link, devId, portId) {
  if (link.a.dev === devId && (portId === undefined || link.a.port === portId)) return link.b;
  return link.a;
}
export function linkedPortIds(lab, devId) {
  const s = new Set();
  for (const l of lab.links) {
    if (l.a.dev === devId) s.add(l.a.port);
    if (l.b.dev === devId) s.add(l.b.port);
  }
  return s;
}
export function portIsFree(lab, dev, port) {
  if (!LINKABLE.has(port.kind)) return false;
  if (MULTI_LINK.has(port.kind)) return true;
  return linksOfPort(lab, dev.id, port.id).length === 0;
}
export function endLabel(lab, end) {
  const d = devById(lab, end.dev); const p = portById(d, end.port);
  return `${d ? d.name : '?'}:${p ? p.name : '?'}`;
}

/** VLAN of an SSID on an access point, or null if the AP does not broadcast it. */
export function ssidVlan(ap, name) {
  const s = name ? (ap.ssids || []).find(x => x.name === name && x.enabled !== false) : null;
  return s ? (s.vlan || 1) : null;
}
/** Wireless clients of an access point: [{dev, port, link}] on the far end of its wifi ports. */
export function wifiClients(lab, ap) {
  const out = [];
  for (const l of lab.links) for (const [me, them] of [[l.a, l.b], [l.b, l.a]]) {
    if (me.dev !== ap.id || portById(ap, me.port)?.kind !== 'wifi') continue;
    const d = devById(lab, them.dev), p = portById(d, them.port);
    if (p?.kind === 'wifi') out.push({ dev: d, port: p, link: l });
  }
  return out;
}

export const isRack = d => d.shape === 'rack';
export const isFurniture = d => d.shape === 'desk' || d.shape === 'shelf';
export const showsInTopology = d => !d.physicalOnly;
export const showsInRoom = d => !d.virtual && !d.logical;

/** Room a device is physically in (rack-mounted devices follow their rack). */
export function deviceRoomId(lab, d) {
  if (d.phys.mount === 'rack' && d.phys.rackId) {
    const r = devById(lab, d.phys.rackId);
    return r ? r.phys.roomId : null;
  }
  return d.phys.roomId;
}

export function uniqueName(lab, base) {
  const names = new Set(lab.devices.map(d => d.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  const m = /^(.*?)(\d+)$/.exec(base);
  if (m) {
    const w = m[2].length;
    for (let i = +m[2] + 1; ; i++) { const n = m[1] + String(i).padStart(w, '0'); if (!names.has(n.toLowerCase())) return n; }
  }
  for (let i = 2; ; i++) { const n = `${base}-${i}`; if (!names.has(n.toLowerCase())) return n; }
}

export function removeDevice(lab, id) {
  lab.links = lab.links.filter(l => l.a.dev !== id && l.b.dev !== id);
  for (const d of lab.devices) if (d.phys.rackId === id) { d.phys.mount = 'floor'; d.phys.rackId = null; d.phys.rackU = null; d.phys.roomId = null; }
  lab.devices = lab.devices.filter(d => d.id !== id);
}

export function removePort(lab, dev, portId) {
  lab.links = lab.links.filter(l => !((l.a.dev === dev.id && l.a.port === portId) || (l.b.dev === dev.id && l.b.port === portId)));
  for (const p of dev.ports) if (p.parent === portId) p.parent = null;
  dev.ports = dev.ports.filter(p => p.id !== portId);
}

export function duplicateDevice(lab, dev) {
  const c = clone(dev);
  c.id = uid('dev');
  c.name = uniqueName(lab, dev.name);
  const map = {};
  for (const p of c.ports) { const n = uid('pt'); map[p.id] = n; p.id = n; p.ip = ''; }
  for (const p of c.ports) if (p.parent) p.parent = map[p.parent] || null;
  c.topo.x += 1.5; c.topo.z += 1.0;
  c.phys.x += 0.3; c.phys.z += 0.3;
  if (c.phys.mount === 'rack') { c.phys.mount = 'floor'; c.phys.roomId = deviceRoomId(lab, dev); c.phys.rackId = null; c.phys.rackU = null; }
  lab.devices.push(c);
  return c;
}

// ---------------------------------------------------------------- racks
export function rackOccupancy(lab, rack) {
  const occ = new Map(); // U -> device
  for (const d of lab.devices) {
    if (d.phys.mount === 'rack' && d.phys.rackId === rack.id && d.phys.rackU) {
      for (let u = d.phys.rackU; u < d.phys.rackU + Math.max(1, d.uHeight || 1); u++) occ.set(u, d);
    }
  }
  return occ;
}
export function rackFits(lab, rack, dev, bottomU) {
  const h = Math.max(1, dev.uHeight || 1);
  if (bottomU < 1 || bottomU + h - 1 > rack.rackUnits) return false;
  const occ = rackOccupancy(lab, rack);
  for (let u = bottomU; u < bottomU + h; u++) { const o = occ.get(u); if (o && o.id !== dev.id) return false; }
  return true;
}
export function rackFirstFree(lab, rack, dev) {
  for (let u = rack.rackUnits - Math.max(1, dev.uHeight || 1) + 1; u >= 1; u--) if (rackFits(lab, rack, dev, u)) return u;
  return null;
}
export { RACK_U };

/**
 * Bring older or hand-edited lab files up to the current shape: run the format migrations
 * (src/migrations.js), then fill in missing fields. Throws for a lab from a newer LabTracer.
 */
export function normalizeLab(lab) {
  migrateLab(lab);
  lab.rooms ||= [];
  lab.devices ||= [];
  lab.links ||= [];
  lab.view ||= {};
  for (const r of lab.rooms) { r.w = +r.w || 4; r.d = +r.d || 3; r.h = +r.h || 2.4; r.name = String(r.name ?? 'Room'); }
  for (const d of lab.devices) {
    d.topo ||= { x: 0, z: 0 };
    d.phys = Object.assign({ roomId: null, x: 0, z: 0, rot: 0, elev: 0, elevAuto: true, mount: 'floor', rackId: null, rackU: null }, d.phys || {});
    d.dims ||= { w: 0.3, h: 0.1, d: 0.3 };
    d.ports = (d.ports || []).map(p => Object.assign(makePort(p), p));
    d.inv = Object.assign(invDefaults(), d.inv || {});
    if (!INV_STATUS.some(s => s[0] === d.inv.status)) d.inv.status = 'active';
    d.attrs ||= []; d.routes ||= []; d.vlans ||= []; d.ssids ||= []; d.services ||= []; d.files ||= [];
    for (const f of d.files) f.snapshots ||= [];
    if (d.ssh) { // SSH console target (no secrets: never a password)
      d.ssh = Object.assign({ host: '', port: 22, user: '', engine: '', auth: 'key', keyFile: '', legacy: false }, d.ssh);
      delete d.ssh.password;
    }
    if (d.collect) { // drift collection settings (src/drift.js collectConf)
      d.collect = Object.assign({ enabled: true, driver: 'auto', ignore: [] }, d.collect);
      if (!Array.isArray(d.collect.ignore)) d.collect.ignore = [];
    }
  }
  for (const d of lab.devices) if (isRack(d) || isFurniture(d)) d.ports = []; // room objects take no cables
  const ids = new Set(lab.devices.map(d => d.id));
  const hasPort = end => portById(lab.devices.find(d => d.id === end?.dev), end.port);
  lab.links = lab.links.filter(l => ids.has(l.a?.dev) && ids.has(l.b?.dev) && hasPort(l.a) && hasPort(l.b));
  return lab;
}
