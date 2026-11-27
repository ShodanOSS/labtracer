// Drift: the lab model is the plan; facts read from the device (collector/ in server.py)
// are the actual state. compareDevice() lists every difference as an item. An item can
// have an `accept` action that changes the model to match the device ("accept actual").
// Pure functions (no DOM), so tests/drift.test.mjs runs them in Node.
//
// Accept actions get the lab and device at the time they run (after undo/redo the lab is
// a different object), so they keep ids and values, never object references.
//
// An item can also have a `push`: operations (collector/ops.py) that make the device match
// the model. They are data, not commands: server.py validates them and the device driver
// renders the commands, which the user reviews before anything runs. `danger` marks
// changes that can cut the connection (addresses, shutdowns, trunks, default routes):
// they are never part of "push all".
import { parseCIDR, intToIp, uid } from './util.js';
import { makePort, linksOfPort, otherEnd, devById, portById, removePort, createDevice, uniqueName, L3_KINDS, MULTI_LINK } from './model.js';
import { BUILTIN } from './templates.js';
import { tcpPorts } from './monitor.js';

export const AREAS = [['identity', 'Identity'], ['inventory', 'Inventory'], ['interface', 'Interfaces'], ['ip', 'Addresses'],
  ['switchport', 'Switch ports'], ['vlan', 'VLANs'], ['route', 'Routes'], ['link', 'Cabling (LLDP / CDP)'], ['service', 'Services'], ['guest', 'Guests (VMs / containers)']];
export const SEV_ORDER = { error: 0, warn: 1, info: 2 };
export const DRIVERS = [['auto', 'Detect'], ['linux', 'Linux / Proxmox / DD-WRT'], ['ios', 'Cisco IOS'],
  ['routeros', 'MikroTik RouterOS'], ['windows', 'Windows (later)'], ['opnsense', 'OPNsense (later)'], ['unifi', 'UniFi (later)']];

/** Per-device collection settings (stored only when the user changes them). */
export const collectConf = d => Object.assign({ enabled: !!d.ssh, driver: 'auto', ignore: [] }, d.collect || {});
/** Per-lab collection settings. */
export const labCollectConf = lab => Object.assign({ autoAcceptInventory: false, interval: 0 }, lab.collect || {});

// ---------------------------------------------------------------- names
const PREFIX = {
  gigabitethernet: 'gi', gi: 'gi', gig: 'gi', fastethernet: 'fa', fa: 'fa', tengigabitethernet: 'te', te: 'te', ten: 'te',
  twogigabitethernet: 'tw', tw: 'tw', fivegigabitethernet: 'fi', fi: 'fi', twentyfivegige: 'twe', twe: 'twe',
  fortygigabitethernet: 'fo', fo: 'fo', hundredgige: 'hu', hu: 'hu', 'port-channel': 'po', po: 'po',
  vlan: 'vl', vl: 'vl', loopback: 'lo', lo: 'lo', tunnel: 'tu', tu: 'tu', ethernet: 'eth', eth: 'eth', et: 'eth',
  management: 'mgmt', mgmt: 'mgmt',
};
/** Canonical interface name: "GigabitEthernet0/1", "Gi0/1" and "gi 0/1" are the same port. */
export function normPort(name) {
  const s = String(name ?? '').trim().toLowerCase().replace(/\s+/g, '');
  const m = /^([a-z-]+?)(\d.*)$/.exec(s);
  return m ? (PREFIX[m[1]] ?? m[1]) + m[2] : s;
}
export const normMac = m => { const x = String(m || '').toLowerCase().replace(/[^0-9a-f]/g, ''); return x.length === 12 ? x.match(/../g).join(':') : ''; };
const shortHost = n => String(n || '').split('.')[0].toLowerCase();
const cidrKey = s => { const c = parseCIDR(s); return c ? `${intToIp(c.ip)}/${c.prefix}` : ''; };
const sameNet = (a, b) => { const x = parseCIDR(a), y = parseCIDR(b); return !!x && !!y && x.prefix === y.prefix && x.net === y.net; };
const destKey = s => { const v = String(s || '').trim(); if (!v || v === 'default') return '0.0.0.0/0'; const c = parseCIDR(v); return c ? `${intToIp(c.net)}/${c.prefix}` : v; };
const sameText = (a, b) => { const x = String(a || '').trim().toLowerCase(), y = String(b || '').trim().toLowerCase(); return x === y || (!!x && !!y && (x.includes(y) || y.includes(x))); };
/** "1,10,20-22" -> "1,10,20,21,22"; "all" stays "all". */
function vlanKey(spec) {
  const s = String(spec ?? 'all').trim().toLowerCase();
  if (!s || s === 'all' || s === '1-4094' || s === '1-4095') return 'all';
  const set = new Set();
  for (const part of s.split(',')) {
    const [a, b] = part.split('-').map(x => parseInt(x, 10));
    if (Number.isFinite(a)) for (let v = a; v <= (Number.isFinite(b) ? Math.min(b, a + 4094) : a); v++) set.add(v);
  }
  return [...set].sort((x, y) => x - y).join(',');
}

// Interfaces the OS makes on its own (containers, VM taps, firewall bridges): never "missing from the model".
export const NOISE = /^(lo$|veth|docker\d|br-[0-9a-f]{6,}|tap\d|fwpr|fwln|fwbr|virbr|vnet\d|cali|flannel|cni|kube|tailscale|zt|dummy|ip6tnl|sit\d|gre0|gretap0|erspan0|ip_vti|ifb|nlmon|bonding_masters|nullnull)/i;
// Ports in the model that the OS never shows (out-of-band management).
const OOB = /^(ipmi|bmc|idrac|ilo|imm|oob|mgmt-oob)\d*$/i;
const COMPARED_KINDS = L3_KINDS; // data ports; power, console, USB and video are physical only
const PORT_KINDS = new Set(['eth', 'sfp', 'wifi', 'vport', 'tunnel', 'svi', 'sub', 'loop']);

/** A push: label for the button, operations, and whether it can cut the connection. */
const P = (label, ops, danger = false) => ({ label, ops, danger });

const WELL_KNOWN = { 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http', 88: 'kerberos', 111: 'rpcbind', 139: 'netbios', 389: 'ldap', 443: 'https', 445: 'smb', 636: 'ldaps', 873: 'rsync', 2049: 'nfs', 3000: 'web', 3306: 'mysql', 3389: 'rdp', 5432: 'postgres', 5900: 'vnc', 8006: 'proxmox', 8080: 'http-alt', 8443: 'https-alt', 9090: 'cockpit', 9100: 'node-exporter' };

// ---------------------------------------------------------------- compare
/**
 * Differences between device d in the lab (the plan) and facts (the actual state).
 * Returns [{key, area, sev, text, planned, actual, accept?: {label, run(lab, dev)}, push?: {label, ops, danger}, inv?, ignored}].
 */
export function compareDevice(lab, d, facts) {
  if (!facts || !facts.ok) return [];
  const items = [];
  const add = it => items.push({ planned: '', actual: '', accept: null, push: null, inv: false, ...it });
  const mgmt = String(facts.host || '');
  const isMgmt = addrs => addrs.some(a => String(a).split('/')[0] === mgmt); // the address LabTracer connects to
  const fIfs = (facts.interfaces || []).filter(i => i && i.name);
  const fByName = new Map(fIfs.map(i => [normPort(i.name), i]));

  identity(add, lab, d, facts);
  inventory(add, d, facts);

  // ---- match model ports to device interfaces: by name, then by MAC (a renamed interface)
  const pairs = new Map(); // fact name -> model port id
  const portOf = new Map(); // model port id -> fact iface
  const compared = d.ports.filter(p => COMPARED_KINDS.has(p.kind));
  for (const p of compared) {
    const fi = fByName.get(normPort(p.name));
    if (fi && !pairs.has(fi.name)) { pairs.set(fi.name, p.id); portOf.set(p.id, fi); }
  }
  for (const p of compared) {
    if (portOf.has(p.id) || !normMac(p.mac)) continue;
    const fi = fIfs.find(i => !pairs.has(i.name) && !i.master && i.mac && i.mac === normMac(p.mac) && !NOISE.test(i.name));
    if (!fi) continue;
    pairs.set(fi.name, p.id); portOf.set(p.id, fi);
    add({ key: `iface-name:${p.id}`, area: 'interface', sev: 'warn', text: `${p.name} is called ${fi.name} on the device (same MAC ${fi.mac})`, planned: p.name, actual: fi.name,
      accept: { label: `Rename to ${fi.name}`, run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.name = fi.name; } } });
  }

  const handledIfs = new Set();  // fact iface names already explained by an item
  const handledAddr = new Set(); // actual addresses already explained

  // ---- addresses
  const actualAddr = new Map(); // "ip/prefix" -> fact iface
  for (const fi of fIfs) for (const a of fi.ips || []) { const k = cidrKey(a); if (k && !/^127\./.test(k)) actualAddr.set(k, fi); }
  for (const p of compared) {
    if (!p.enabled || !p.ip || p.ip === 'dhcp') continue;
    const want = cidrKey(p.ip); if (!want) continue;
    const mine = portOf.get(p.id);
    const at = actualAddr.get(want);
    if (at && mine && at.name === mine.name) { handledAddr.add(want); continue; }
    if (at) {
      handledAddr.add(want); handledIfs.add(at.name);
      const bridge = mine && mine.master === at.name;
      const qid = pairs.get(at.name);
      add({ key: `ip-moved:${p.id}`, area: 'ip', sev: 'warn',
        text: bridge ? `${want} is on bridge ${at.name} (${p.name} is a member of ${at.name})` : `${want} is on ${at.name}, not on ${p.name}`,
        planned: `${p.name} ${want}`, actual: `${at.name} ${want}`,
        accept: { label: `Move the address to ${at.name}`, run: (lab, dev) => {
          const from = portById(dev, p.id); if (from) from.ip = '';
          let to = qid ? portById(dev, qid) : null;
          if (!to) to = dev.ports.find(x => normPort(x.name) === normPort(at.name));
          if (!to) { to = portFromFact(dev, at); dev.ports.push(to); }
          to.ip = want;
        } },
        push: bridge || !mine ? null : P(`Move ${want} back to ${mine.name}`, [{ op: 'iface-ip', port: at.name, ip: '', old: [want] }, { op: 'iface-ip', port: mine.name, ip: want, old: [] }], true) });
      continue;
    }
    const other = (mine?.ips || []).map(cidrKey).filter(Boolean);
    const br = mine?.master ? fIfs.find(i => i.name === mine.master) : null;
    const brAddr = br && !pairs.has(br.name) ? (br.ips || []).map(cidrKey).find(a => a && sameNet(a, want)) : null;
    if (!other.length && brAddr) {
      handledAddr.add(brAddr); handledIfs.add(br.name);
      add({ key: `ip-bridge:${p.id}`, area: 'ip', sev: 'error', text: `${want} (${p.name}) is not on the device; bridge ${br.name} (${p.name} is a member) has ${brAddr}`,
        planned: `${p.name} ${want}`, actual: `${br.name} ${brAddr}`,
        accept: { label: `Add ${br.name} with ${brAddr}`, run: (lab, dev) => {
          const from = portById(dev, p.id); if (from) from.ip = '';
          let to = dev.ports.find(x => normPort(x.name) === normPort(br.name));
          if (!to) { to = portFromFact(dev, br); dev.ports.push(to); }
          to.ip = brAddr;
        } } });
    } else if (other.length) {
      other.forEach(x => handledAddr.add(x));
      add({ key: `ip:${p.id}`, area: 'ip', sev: 'error', text: `${p.name} has ${other[0]} on the device, ${want} in the model`, planned: want, actual: other.join(', '),
        accept: { label: `Use ${other[0]}`, run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.ip = other[0]; } },
        push: P(`Set ${want} on ${mine.name}`, [{ op: 'iface-ip', port: mine.name, ip: want, old: other }], isMgmt(other)) });
    } else if (mine?.dhcp) {
      add({ key: `ip:${p.id}`, area: 'ip', sev: 'error', text: `${p.name} uses DHCP on the device, ${want} in the model`, planned: want, actual: 'dhcp',
        accept: { label: 'Set to DHCP', run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.ip = 'dhcp'; } },
        push: P(`Set ${want} on ${mine.name}`, [{ op: 'iface-ip', port: mine.name, ip: want, old: [] }]) });
    } else {
      add({ key: `ip:${p.id}`, area: 'ip', sev: 'error', text: `${want} (${p.name}) is not configured on the device`, planned: want, actual: 'none',
        accept: { label: 'Remove the address from the model', run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.ip = ''; } },
        push: mine ? P(`Add ${want} to ${mine.name}`, [{ op: 'iface-ip', port: mine.name, ip: want, old: [] }]) : null });
    }
  }
  for (const [addr, fi] of actualAddr) {
    if (handledAddr.has(addr)) continue;
    const pid = pairs.get(fi.name); if (!pid) continue; // an extra interface: reported below with its address
    const p = portById(d, pid);
    if (p.ip === 'dhcp') {
      if (!fi.dhcp) add({ key: `ip-static:${p.id}`, area: 'ip', sev: 'info', text: `${p.name} has the static address ${addr}; the model says DHCP`, planned: 'dhcp', actual: addr,
        accept: { label: `Use ${addr}`, run: (lab, dev) => { const q = portById(dev, pid); if (q) q.ip = addr; } },
        push: P(`Set ${fi.name} to DHCP`, [{ op: 'iface-ip', port: fi.name, ip: 'dhcp', old: [addr] }], isMgmt([addr])) });
    } else if (!p.ip) {
      add({ key: `ip-new:${p.id}`, area: 'ip', sev: 'warn', text: `${p.name} has ${addr}${fi.dhcp ? ' (DHCP)' : ''}; the model has no address`, planned: 'none', actual: addr,
        accept: { label: fi.dhcp ? 'Set to DHCP' : `Use ${addr}`, run: (lab, dev) => { const q = portById(dev, pid); if (q) q.ip = fi.dhcp ? 'dhcp' : addr; } },
        push: P(`Remove ${addr} from ${fi.name}`, [{ op: 'iface-ip', port: fi.name, ip: '', old: [addr] }], true) });
    } else {
      add({ key: `ip-extra:${p.id}:${addr}`, area: 'ip', sev: 'info', text: `${p.name} also has ${addr} (the model keeps one address per port)`, actual: addr });
    }
  }
  for (const p of compared) {
    const fi = portOf.get(p.id);
    if (p.enabled && p.ip === 'dhcp' && fi && fi.operUp && !(fi.ips || []).length && !fi.master)
      add({ key: `ip-nodhcp:${p.id}`, area: 'ip', sev: 'warn', text: `${p.name} should get an address by DHCP but has none`, planned: 'dhcp', actual: 'none' });
  }

  // ---- interfaces: state, MAC, description, missing and extra
  for (const p of compared) {
    const fi = portOf.get(p.id);
    if (!fi) {
      if (OOB.test(p.name)) continue;
      const links = linksOfPort(lab, d.id, p.id);
      add({ key: `iface-missing:${p.id}`, area: 'interface', sev: links.length || p.ip ? 'warn' : 'info',
        text: `${p.name} is not on the device` + (links.length ? ' (it has a cable in the model: rename it in the Ports tab to the device\'s name)' : ''),
        planned: p.name, actual: 'missing',
        accept: links.length ? null : { label: 'Remove the port from the model', run: (lab, dev) => removePort(lab, dev, p.id) } });
      continue;
    }
    if (fi.adminUp !== null && fi.adminUp !== undefined && !!p.enabled !== !!fi.adminUp)
      add({ key: `iface-state:${p.id}`, area: 'interface', sev: p.ip || linksOfPort(lab, d.id, p.id).length ? 'warn' : 'info', text: `${p.name} is ${fi.adminUp ? 'enabled' : 'shut down'} on the device, ${p.enabled ? 'enabled' : 'disabled'} in the model`,
        planned: p.enabled ? 'enabled' : 'disabled', actual: fi.adminUp ? 'enabled' : 'shut down',
        accept: { label: fi.adminUp ? 'Enable in the model' : 'Disable in the model', run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.enabled = !!fi.adminUp; } },
        push: P(p.enabled ? `Enable ${fi.name}` : `Shut down ${fi.name}`, [{ op: 'iface-enable', port: fi.name, enabled: !!p.enabled }], !p.enabled) });
    if (fi.mac) {
      const pm = normMac(p.mac);
      if (!pm) add({ key: `mac:${p.id}`, area: 'inventory', sev: 'info', inv: true, text: `${p.name} MAC ${fi.mac} is not in the model`, planned: '', actual: fi.mac,
        accept: { label: 'Fill in the MAC', run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.mac = fi.mac; } } });
      else if (pm !== fi.mac) add({ key: `mac:${p.id}`, area: 'interface', sev: 'warn', text: `${p.name} MAC is ${fi.mac} on the device, ${pm} in the model (replaced hardware?)`, planned: pm, actual: fi.mac,
        accept: { label: 'Use the device MAC', run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.mac = fi.mac; } } });
    }
    if (fi.desc && fi.desc !== p.desc)
      add({ key: `desc:${p.id}`, area: 'interface', sev: 'info', text: `${p.name} description is "${fi.desc}" on the device`, planned: p.desc, actual: fi.desc,
        accept: { label: 'Use the device description', run: (lab, dev) => { const q = portById(dev, p.id); if (q) q.desc = fi.desc; } },
        push: P('Set the model description', [{ op: 'iface-desc', port: fi.name, desc: p.desc || '' }]) });
    if (fi.operUp === false && fi.adminUp !== false && p.enabled && linksOfPort(lab, d.id, p.id).some(l => l.medium !== 'power'))
      add({ key: `down:${p.id}`, area: 'link', sev: 'warn', text: `${p.name} has a cable in the model, but the link is down`, planned: 'up', actual: 'down' });
    switchport(add, d, p, fi);
  }
  for (const fi of fIfs) {
    if (pairs.has(fi.name) || handledIfs.has(fi.name) || NOISE.test(fi.name) || fi.kind === 'loop' && !(fi.ips || []).some(a => !/^127\./.test(a))) continue;
    const ips = (fi.ips || []).filter(a => !/^127\./.test(a));
    if (!ips.length && !(fi.adminUp && fi.operUp && !fi.master)) continue; // unused, or a member of a bridge
    add({ key: `iface-extra:${normPort(fi.name)}`, area: 'interface', sev: ips.length ? 'warn' : 'info',
      text: `${fi.name}${ips.length ? ` (${ips.join(', ')})` : ''} is on the device but not in the model`, planned: 'missing', actual: fi.name,
      accept: { label: 'Add the port to the model', run: (lab, dev) => { if (!dev.ports.some(x => normPort(x.name) === normPort(fi.name))) dev.ports.push(portFromFact(dev, fi)); } } });
  }

  vlans(add, d, facts);
  routes(add, d, facts);
  neighbors(add, lab, d, facts, fByName, pairs);
  services(add, d, facts);
  guests(add, lab, d, facts);

  const ign = new Set(collectConf(d).ignore || []);
  for (const it of items) it.ignored = ign.has(it.key);
  items.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  return items;
}

/** A model port for an interface found on the device. */
export function portFromFact(dev, fi) {
  const kind = PORT_KINDS.has(fi.kind) ? fi.kind : 'eth';
  const p = makePort({ name: fi.name, kind, ip: (fi.ips || []).find(a => !/^127\./.test(a)) || (fi.dhcp ? 'dhcp' : ''), mac: fi.mac || '', enabled: fi.adminUp !== false, desc: fi.desc || '' });
  if (kind === 'sub' || kind === 'svi') p.vlan = fi.vlan || p.vlan;
  if (kind === 'sub') { const base = dev.ports.find(x => normPort(x.name) === normPort(fi.name.split('.')[0])); p.parent = base ? base.id : null; }
  if (fi.mode === 'trunk') Object.assign(p, { mode: 'trunk', nativeVlan: fi.nativeVlan || 1, trunkVlans: fi.trunkVlans || 'all' });
  else if (fi.mode === 'access') Object.assign(p, { mode: 'access', vlan: fi.vlan || 1 });
  else if (fi.mode === 'routed') p.mode = 'routed';
  return p;
}

function identity(add, lab, d, facts) {
  const hn = shortHost(facts.system?.hostname);
  if (!hn || hn === d.name.toLowerCase()) return;
  const real = String(facts.system.hostname).split('.')[0];
  const taken = lab.devices.some(x => x.id !== d.id && x.name.toLowerCase() === hn);
  add({ key: 'hostname', area: 'identity', sev: 'warn', text: `The device calls itself ${real}`, planned: d.name, actual: real,
    accept: taken ? null : { label: `Rename to ${real}`, run: (lab, dev) => { dev.name = real; } },
    push: P(`Set hostname ${d.name}`, [{ op: 'hostname', name: d.name }]) });
}

function inventory(add, d, facts) {
  const s = facts.system || {};
  const field = (key, label, actual, get, set, exact) => {
    if (!actual) return;
    const planned = get(d);
    if (exact ? String(planned).trim().toLowerCase() === String(actual).trim().toLowerCase() : sameText(planned, actual)) return;
    add({ key: `inv-${key}`, area: 'inventory', inv: true, sev: planned ? 'warn' : 'info',
      text: planned ? `${label} is ${actual} on the device, ${planned} in the model` : `${label} ${actual} is not in the model`, planned, actual,
      accept: { label: planned ? `Use ${actual}` : `Fill in the ${label.toLowerCase()}`, run: (lab, dev) => set(dev, actual) } });
  };
  field('vendor', 'Vendor', s.vendor, x => x.vendor, (x, v) => { x.vendor = v; });
  field('model', 'Model', s.model, x => x.model, (x, v) => { x.model = v; });
  field('serial', 'Serial', s.serial, x => x.serial, (x, v) => { x.serial = v; }, true);
  const os = s.os && s.osVersion && !String(s.os).includes(s.osVersion) ? `${s.os} ${s.osVersion}` : s.os;
  const attr = x => (x.attrs || []).find(a => a.k.toLowerCase() === 'os');
  if (os) {
    const cur = attr(d)?.v || '';
    if (!sameText(cur, os)) add({ key: 'inv-os', area: 'inventory', inv: true, sev: 'info', text: cur ? `OS is ${os} on the device, "${cur}" in the model` : `OS ${os} is not in the model`, planned: cur, actual: os,
      accept: { label: cur ? `Use ${os}` : 'Fill in the OS', run: (lab, dev) => { const a = attr(dev); if (a) a.v = os; else (dev.attrs ||= []).push({ k: 'OS', v: os }); } } });
  }
}

function switchport(add, d, p, fi) {
  if (!d.l2 || !fi.mode || !['eth', 'sfp'].includes(p.kind)) return;
  const set = (label, patch) => ({ label, run: (lab, dev) => { const q = portById(dev, p.id); if (q) Object.assign(q, patch); } });
  const port = fi.name;
  const trunk = () => ({ op: 'sw-trunk', port, nativeVlan: +p.nativeVlan || 1, trunkVlans: String(p.trunkVlans || 'all') });
  if ((p.mode || 'access') !== fi.mode) {
    const want = p.mode || 'access';
    const op = want === 'trunk' ? trunk() : want === 'routed' ? { op: 'sw-routed', port } : { op: 'sw-access', port, vlan: +p.vlan || 1 };
    const patch = { mode: fi.mode };
    if (fi.mode === 'access') patch.vlan = fi.vlan || 1;
    if (fi.mode === 'trunk') Object.assign(patch, { nativeVlan: fi.nativeVlan || 1, trunkVlans: fi.trunkVlans || 'all' });
    add({ key: `sw-mode:${p.id}`, area: 'switchport', sev: 'warn', text: `${p.name} is ${fi.mode} on the device, ${p.mode || 'access'} in the model`, planned: p.mode, actual: fi.mode, accept: set(`Make it ${fi.mode}`, patch),
      push: P(`Make it ${want} on the device`, [op], true) });
    return;
  }
  if (fi.mode === 'access' && fi.vlan && +p.vlan !== +fi.vlan)
    add({ key: `sw-vlan:${p.id}`, area: 'switchport', sev: 'warn', text: `${p.name} is in VLAN ${fi.vlan} on the device, VLAN ${p.vlan} in the model`, planned: String(p.vlan), actual: String(fi.vlan), accept: set(`Use VLAN ${fi.vlan}`, { vlan: fi.vlan }),
      push: P(`Set VLAN ${p.vlan}`, [{ op: 'sw-access', port, vlan: +p.vlan || 1 }]) });
  if (fi.mode === 'trunk') {
    if (fi.nativeVlan && +p.nativeVlan !== +fi.nativeVlan)
      add({ key: `sw-native:${p.id}`, area: 'switchport', sev: 'warn', text: `${p.name} native VLAN is ${fi.nativeVlan} on the device, ${p.nativeVlan} in the model`, planned: String(p.nativeVlan), actual: String(fi.nativeVlan), accept: set(`Use native VLAN ${fi.nativeVlan}`, { nativeVlan: fi.nativeVlan }),
        push: P(`Set native VLAN ${p.nativeVlan}`, [trunk()], true) });
    if (fi.trunkVlans && vlanKey(p.trunkVlans) !== vlanKey(fi.trunkVlans))
      add({ key: `sw-trunk:${p.id}`, area: 'switchport', sev: 'warn', text: `${p.name} carries VLANs ${fi.trunkVlans} on the device, ${p.trunkVlans} in the model`, planned: p.trunkVlans, actual: fi.trunkVlans, accept: set('Use the device VLAN list', { trunkVlans: fi.trunkVlans }),
        push: P('Set the model VLAN list', [trunk()], true) });
  }
}

function vlans(add, d, facts) {
  if (!Array.isArray(facts.vlans) || !d.l2) return;
  const act = new Map(facts.vlans.map(v => [+v.id, v.name || '']));
  const plan = new Map((d.vlans || []).map(v => [+v.id, v.name || '']));
  for (const [id, name] of plan) {
    if (!act.has(id)) add({ key: `vlan-missing:${id}`, area: 'vlan', sev: 'warn', text: `VLAN ${id} (${name}) is not on the device`, planned: `${id} ${name}`, actual: 'missing',
      accept: { label: 'Remove the VLAN from the model', run: (lab, dev) => { dev.vlans = dev.vlans.filter(v => +v.id !== id); } },
      push: P(`Create VLAN ${id}`, [{ op: 'vlan-add', id, name: name || `VLAN${id}` }]) });
    else if (id !== 1 && act.get(id) && act.get(id) !== name) add({ key: `vlan-name:${id}`, area: 'vlan', sev: 'info', text: `VLAN ${id} is called ${act.get(id)} on the device, ${name} in the model`, planned: name, actual: act.get(id),
      accept: { label: `Rename to ${act.get(id)}`, run: (lab, dev) => { const v = dev.vlans.find(x => +x.id === id); if (v) v.name = act.get(id); } },
      push: name ? P(`Name it ${name}`, [{ op: 'vlan-name', id, name }]) : null });
  }
  for (const [id, name] of act) if (!plan.has(id)) add({ key: `vlan-extra:${id}`, area: 'vlan', sev: 'warn', text: `VLAN ${id} (${name}) is on the device but not in the model`, planned: 'missing', actual: `${id} ${name}`,
    accept: { label: 'Add the VLAN to the model', run: (lab, dev) => { if (!dev.vlans.some(v => +v.id === id)) { dev.vlans.push({ id, name }); dev.vlans.sort((a, b) => a.id - b.id); } } },
    push: id === 1 ? null : P(`Delete VLAN ${id}`, [{ op: 'vlan-del', id }], true) });
}

function routes(add, d, facts) {
  if (!Array.isArray(facts.routes)) return;
  const act = new Map(facts.routes.map(r => [destKey(r.dest), r]));
  const plan = new Map((d.routes || []).map((r, i) => [destKey(r.dest), { ...r, i }]));
  const hop = r => r.via || (r.dev ? `dev ${r.dev}` : '');
  const rop = (op, dest, r) => ({ op, dest, via: r.via || '', dev: r.via ? '' : (r.dev || '') });
  for (const [dest, r] of plan) {
    const a = act.get(dest);
    if (!a) add({ key: `route-missing:${dest}`, area: 'route', sev: 'warn', text: `Route ${dest} via ${hop(r) || '?'} is not on the device`, planned: `${dest} ${hop(r)}`, actual: 'missing',
      accept: { label: 'Remove the route from the model', run: (lab, dev) => { dev.routes = dev.routes.filter(x => destKey(x.dest) !== dest); } },
      push: hop(r) ? P('Add the route on the device', [rop('route-add', dest, r)]) : null });
    else if ((a.via || '') !== (r.via || '') && !(!r.via && !a.via)) add({ key: `route-via:${dest}`, area: 'route', sev: 'warn', text: `Route ${dest} goes via ${hop(a)} on the device, via ${hop(r)} in the model`, planned: hop(r), actual: hop(a),
      accept: { label: `Use ${hop(a)}`, run: (lab, dev) => { const x = dev.routes.find(y => destKey(y.dest) === dest); if (x) { x.via = a.via || ''; x.dev = a.via ? '' : (a.dev || ''); } } },
      push: hop(r) ? P(`Route via ${hop(r)}`, [rop('route-del', dest, a), rop('route-add', dest, r)], dest === '0.0.0.0/0') : null });
  }
  for (const [dest, a] of act) if (!plan.has(dest)) add({ key: `route-extra:${dest}`, area: 'route', sev: 'warn', text: `Route ${dest} via ${hop(a)} is on the device but not in the model`, planned: 'missing', actual: `${dest} ${hop(a)}`,
    accept: { label: 'Add the route to the model', run: (lab, dev) => { if (!dev.routes.some(x => destKey(x.dest) === dest)) dev.routes.push({ dest, via: a.via || '', dev: a.via ? '' : (a.dev || '') }); } },
    push: P('Delete the route on the device', [rop('route-del', dest, a)], dest === '0.0.0.0/0') });
}

function findRemote(lab, d, nb) {
  const n = shortHost(nb.remoteName);
  let r = n ? lab.devices.find(x => x.id !== d.id && x.name.toLowerCase() === n) : null;
  const mac = normMac(nb.remoteMac);
  if (!r && mac) r = lab.devices.find(x => x.id !== d.id && x.ports.some(p => normMac(p.mac) === mac)) || null;
  if (!r) return { dev: null, port: null };
  let port = nb.remotePort ? r.ports.find(p => normPort(p.name) === normPort(nb.remotePort)) : null;
  if (!port && mac) port = r.ports.find(p => normMac(p.mac) === mac && normMac(nb.remotePort) === mac) || null;
  return { dev: r, port };
}

function neighbors(add, lab, d, facts, fByName, pairs) {
  if (!Array.isArray(facts.neighbors)) return;
  for (const nb of facts.neighbors) {
    const fi = fByName.get(normPort(nb.localPort));
    const pid = fi ? pairs.get(fi.name) : null;
    const p = pid ? portById(d, pid) : d.ports.find(x => normPort(x.name) === normPort(nb.localPort));
    if (!p) continue; // the interface itself is reported as extra
    const { dev: r, port: rp } = findRemote(lab, d, nb);
    const ends = linksOfPort(lab, d.id, p.id).map(l => ({ l, e: otherEnd(l, d.id, p.id) }));
    const there = `${r ? r.name : (nb.remoteName || nb.remoteMac || '?')}:${rp ? rp.name : (nb.remotePort || '?')}`;
    if (r && ends.some(x => x.e.dev === r.id)) {
      const cur = ends.find(x => x.e.dev === r.id);
      if (rp && cur.e.port !== rp.id && !MULTI_LINK.has(p.kind)) {
        const curName = portById(r, cur.e.port)?.name || '?';
        add({ key: `link-port:${p.id}`, area: 'link', sev: 'info', text: `${p.name} goes to ${r.name}:${curName} in the model; LLDP/CDP says ${there}`, planned: `${r.name}:${curName}`, actual: there,
          accept: { label: `Move the cable to ${there}`, run: (lab, dev) => cable(lab, dev.id, p.id, r.id, rp.id) } });
      }
      continue;
    }
    if (MULTI_LINK.has(p.kind)) continue;
    const planned = ends.length ? ends.map(x => { const od = devById(lab, x.e.dev); return `${od?.name || '?'}:${portById(od, x.e.port)?.name || '?'}`; }).join(', ') : 'no cable';
    add({ key: `link:${p.id}`, area: 'link', sev: ends.length ? 'error' : 'warn',
      text: `LLDP/CDP: ${p.name} connects to ${there}` + (ends.length ? `, the model says ${planned}` : ', not in the model') + (r ? (rp ? '' : ` (no port ${nb.remotePort} on ${r.name} in the model)`) : ' (unknown device: add it to the lab to cable it)'),
      planned, actual: there,
      accept: r && rp ? { label: `Cable ${p.name} to ${there}`, run: (lab, dev) => cable(lab, dev.id, p.id, r.id, rp.id) } : null });
  }
}

/** Replace the cables of two ports by one cable between them. */
export function cable(lab, devA, portA, devB, portB) {
  const a = devById(lab, devA), b = devById(lab, devB);
  const pa = portById(a, portA), pb = portById(b, portB);
  if (!pa || !pb) return;
  const drop = (dv, pt) => { if (!MULTI_LINK.has(pt.kind)) lab.links = lab.links.filter(l => !((l.a.dev === dv && l.a.port === pt.id) || (l.b.dev === dv && l.b.port === pt.id))); };
  drop(devA, pa); drop(devB, pb);
  lab.links.push({ id: uid('ln'), a: { dev: devA, port: portA }, b: { dev: devB, port: portB }, medium: pa.kind === 'sfp' || pb.kind === 'sfp' ? 'fiber' : 'copper', label: '', notes: 'From LLDP/CDP' });
}

function services(add, d, facts) {
  if (!Array.isArray(facts.listening)) return;
  const open = new Set(facts.listening.filter(x => (x.proto || 'tcp') === 'tcp').map(x => +x.port));
  const planned = new Set();
  (d.services || []).forEach((s, i) => {
    if (s.enabled === false) return;
    for (const port of tcpPorts(s.port)) {
      planned.add(port);
      if (!open.has(port)) add({ key: `svc-closed:${port}`, area: 'service', sev: 'warn', text: `${s.name || 'Service'} (TCP ${port}) is not listening on the device`, planned: `${port} open`, actual: 'closed',
        accept: { label: 'Turn the service off in the model', run: (lab, dev) => { const x = (dev.services || []).find(y => tcpPorts(y.port).includes(port)); if (x) x.enabled = false; } } });
    }
  });
  for (const port of [...open].filter(p => !planned.has(p)).slice(0, 40)) {
    const name = WELL_KNOWN[port] || `tcp-${port}`;
    add({ key: `svc-open:${port}`, area: 'service', sev: 'info', text: `TCP ${port}${WELL_KNOWN[port] ? ` (${name})` : ''} is open on the device but not in Services`, planned: 'not listed', actual: `${port} open`,
      accept: { label: 'Add to Services', run: (lab, dev) => { (dev.services ||= []).push({ name, port: String(port), enabled: true, notes: 'found by Collect' }); } } });
  }
}

function guests(add, lab, d, facts) {
  if (!Array.isArray(facts.guests)) return;
  const hostOf = x => ((x.attrs || []).find(a => a.k.toLowerCase() === 'host')?.v || '').trim().toLowerCase();
  const mine = lab.devices.filter(x => x.id !== d.id && hostOf(x) && hostOf(x) === d.name.toLowerCase());
  const act = new Map(facts.guests.map(g => [String(g.name).toLowerCase(), g]));
  for (const g of facts.guests) {
    const m = mine.find(x => x.name.toLowerCase() === String(g.name).toLowerCase()) || lab.devices.find(x => x.name.toLowerCase() === String(g.name).toLowerCase() && x.virtual);
    if (m) {
      if (!hostOf(m)) add({ key: `guest-host:${g.name}`, area: 'guest', sev: 'info', text: `${m.name} runs on this host; its Host attribute is empty`, planned: '', actual: d.name,
        accept: { label: `Set Host to ${d.name}`, run: (lab, dev) => { const x = devById(lab, m.id); if (!x) return; const a = (x.attrs ||= []).find(y => y.k.toLowerCase() === 'host'); if (a) a.v = dev.name; else x.attrs.push({ k: 'Host', v: dev.name }); } } });
      continue;
    }
    const kind = g.kind === 'ct' ? 'container' : 'VM';
    add({ key: `guest-extra:${g.name}`, area: 'guest', sev: 'info', text: `${kind} ${g.name} (${g.vmid ?? '?'}, ${g.state || '?'}) runs on this host but is not in the lab`, planned: 'missing', actual: `${g.name} ${g.state || ''}`,
      accept: { label: `Add ${kind} ${g.name}`, run: (lab, dev) => {
        if (lab.devices.some(x => x.name.toLowerCase() === String(g.name).toLowerCase())) return;
        const tpl = BUILTIN.find(t => t.id === (g.kind === 'ct' ? 'vir-ct' : 'vir-vm'));
        const n = lab.devices.filter(x => x.virtual && hostOf(x) === dev.name.toLowerCase()).length;
        const v = createDevice(tpl, { name: uniqueName(lab, String(g.name)), x: dev.topo.x + 1.6 + (n % 4) * 1.4, z: dev.topo.z + 1.6 + Math.floor(n / 4) * 1.4 });
        const a = v.attrs.find(y => y.k === 'Host'); if (a) a.v = dev.name; else v.attrs.push({ k: 'Host', v: dev.name });
        if (g.vmid !== undefined && g.vmid !== null) v.attrs.push({ k: 'VMID', v: String(g.vmid) });
        lab.devices.push(v);
      } } });
  }
  for (const m of mine) if (!act.has(m.name.toLowerCase()) && m.inv?.status !== 'retired')
    add({ key: `guest-missing:${m.id}`, area: 'guest', sev: 'warn', text: `${m.name} should run on this host but was not found`, planned: m.name, actual: 'missing',
      accept: { label: `Mark ${m.name} retired`, run: (lab, dev) => { const x = devById(lab, m.id); if (x) x.inv.status = 'retired'; } } });
}

// ---------------------------------------------------------------- helpers for the GUI
/** {error, warn, info} counts of items that are not ignored. */
export function driftCounts(items) {
  const c = { error: 0, warn: 0, info: 0 };
  for (const it of items) if (!it.ignored) c[it.sev]++;
  return c;
}
/** Items whose accept only fills in inventory facts (serial, model, vendor, MAC, OS). */
/** Items whose push can not cut the connection ("push all"). */
export const safePushes = items => items.filter(it => it.push && !it.push.danger && !it.ignored);
export const inventoryFacts = items => items.filter(it => it.inv && it.accept && !it.ignored);
