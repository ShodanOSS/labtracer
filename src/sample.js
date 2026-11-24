// Example lab shown on first start. All names and addresses are generic
// placeholders (private RFC 1918 ranges). Replace them with your own.
import { BUILTIN } from './templates.js';
import { createDevice, makePort, newLab, portByName, RACK_U } from './model.js';
import { uid } from './util.js';

const T = id => BUILTIN.find(t => t.id === id);

export function buildSampleLab() {
  const lab = newLab('example-lab');
  lab.notes = 'Example lab. Every name and address is a placeholder. Edit the devices, or start a new lab from File > New lab.';
  const room = lab.rooms[0];
  room.name = 'Lab room'; room.w = 4; room.d = 3.5; room.h = 2.4;
  const R = room.id;
  const add = (tid, name, o = {}) => {
    const d = createDevice(T(tid), { name, x: o.x ?? 0, z: o.z ?? 0 });
    if (o.vendor) d.vendor = o.vendor;
    if (o.model) d.model = o.model;
    if (o.notes) d.notes = o.notes;
    if (o.attrs) d.attrs = Object.entries(o.attrs).map(([k, v]) => ({ k, v }));
    if (o.phys) Object.assign(d.phys, { roomId: R }, o.phys);
    lab.devices.push(d);
    return d;
  };
  const port = (d, name) => portByName(d, name);
  const ip = (d, name, v) => { port(d, name).ip = v; };
  const link = (a, ap, b, bp, medium = 'copper', label = '') => {
    lab.links.push({ id: uid('ln'), a: { dev: a.id, port: port(a, ap).id }, b: { dev: b.id, port: port(b, bp).id }, medium, label, notes: '' });
  };
  const VL = [[1, 'mgmt'], [20, 'servers'], [30, 'storage'], [40, 'wifi'], [50, 'iot']];
  const TRUNK = '1,20,30,40,50';

  // ---- furniture and rack
  const rack = add('inf-rack-42', 'rack-01', { phys: { x: 0.6, z: 0.6 } });
  add('inf-desk', 'desk', { phys: { x: 2.6, z: 0.42 } });
  add('inf-shelf', 'shelf', { phys: { x: 3.72, z: 2.4, rot: -90 } });

  // ---- WAN edge
  const inet = add('wan-internet', 'internet', { x: 0, z: -11.5 });
  const isp = add('net-gateway', 'isp-gateway', { x: 0, z: -7.5, notes: 'ISP modem or ONT. The edge router uses its LAN side.', phys: { x: 3.72, z: 2.1, elev: 1.05, rot: -90 } });
  isp.ports.push(makePort({ name: 'lan', kind: 'svi', vlan: 1, ip: '192.168.1.1/24' }));

  const edge = add('net-router-home', 'edge-router', {
    x: 0, z: -4, notes: 'Edge router: WAN, inter-VLAN routing, VPN endpoint.',
    attrs: { Firmware: '', Firewall: '' }, phys: { x: 2.95, z: 0.38, elev: 0.75 },
  });
  Object.assign(port(edge, 'lan1'), { mode: 'trunk', nativeVlan: 1, trunkVlans: 'all', desc: 'trunk to core-switch p1' });
  Object.assign(port(edge, 'lan3'), { mode: 'trunk', nativeVlan: 1, trunkVlans: 'all', desc: 'trunk to rack-switch Gi0/48' });
  port(edge, 'wan').ip = '192.168.1.2/24';
  edge.routes.push({ dest: '0.0.0.0/0', via: '192.168.1.1', dev: '' });
  edge.vlans = VL.map(([id, name]) => ({ id, name }));
  const svi = (name, vlan, addr) => edge.ports.push(makePort({ name, kind: 'svi', vlan, ip: addr }));
  svi('br0', 1, '192.168.10.1/24'); svi('vlan20', 20, '192.168.20.1/24'); svi('vlan30', 30, '192.168.30.1/24');
  svi('vlan40', 40, '192.168.40.1/24'); svi('vlan50', 50, '192.168.50.1/24');
  edge.ports.push(makePort({ name: 'wg0', kind: 'tunnel', ip: '10.99.0.1/24', desc: 'WireGuard' }));
  edge.services = [
    { name: 'wireguard', port: '51820/udp', enabled: true, notes: '' },
    { name: 'dns-forwarder', port: '53', enabled: true, notes: '' },
  ];

  // ---- core switching
  const core = add('net-switch-8', 'core-switch', { x: 0, z: -1, phys: { x: 3.72, z: 2.4, elev: 0.6, rot: -90 } });
  core.vlans = VL.map(([id, name]) => ({ id, name }));
  Object.assign(port(core, 'p1'), { mode: 'trunk', nativeVlan: 1, trunkVlans: TRUNK, desc: 'uplink from edge-router' });
  Object.assign(port(core, 'p3'), { mode: 'trunk', nativeVlan: 1, trunkVlans: TRUNK, desc: 'ap-01' });
  Object.assign(port(core, 'p4'), { vlan: 30 }); Object.assign(port(core, 'p5'), { vlan: 30 });
  core.ports.push(makePort({ name: 'vlan1', kind: 'svi', vlan: 1, ip: '192.168.10.2/24', desc: 'management' }));
  core.routes.push({ dest: '0.0.0.0/0', via: '192.168.10.1', dev: '' });

  const ap = add('net-ap', 'ap-01', { x: 4.5, z: 1.5, notes: 'Ceiling mounted.', phys: { x: 2.0, z: 1.9, elev: 2.36, elevAuto: false } });
  Object.assign(port(ap, 'wlan0'), { vlan: 40, desc: 'main SSID (VLAN 40)' });
  ap.ports.push(makePort({ name: 'wlan1', kind: 'wifi', vlan: 50, desc: 'IoT SSID (VLAN 50)' }));

  // ---- servers and endpoints
  const dc = add('cmp-sbc', 'dc-01', {
    x: -4.5, z: 2, notes: 'Directory, DNS and NTP.', attrs: { OS: '', Role: 'DC, DNS, NTP' }, phys: { x: 2.25, z: 0.35, elev: 0.75 },
  });
  ip(dc, 'eth0', '192.168.10.10/24'); dc.routes.push({ dest: '0.0.0.0/0', via: '192.168.10.1', dev: '' });
  dc.services = [
    { name: 'ldap', port: '389,636', enabled: true, notes: '' },
    { name: 'kerberos', port: '88', enabled: true, notes: '' },
    { name: 'dns', port: '53', enabled: true, notes: '' },
    { name: 'ntp', port: '123/udp', enabled: true, notes: '' },
  ];

  const nas = add('sto-nas2', 'nas-01', { x: -2, z: 4, attrs: { OS: '', Drives: '' }, phys: { x: 3.72, z: 2.6, elev: 0.15, rot: -90 } });
  ip(nas, 'eth0', '192.168.30.10/24'); ip(nas, 'eth1', '192.168.30.11/24');
  nas.routes.push({ dest: '0.0.0.0/0', via: '192.168.30.1', dev: '' });
  nas.services = [{ name: 'smb', port: '445', enabled: true, notes: '' }];

  const desk = add('cmp-tower', 'desktop-01', { x: 1.5, z: 4, attrs: { OS: '', CPU: '', RAM: '', GPU: '' }, phys: { x: 1.45, z: 0.5 } });
  ip(desk, 'eth0', '192.168.10.20/24'); desk.routes.push({ dest: '0.0.0.0/0', via: '192.168.10.1', dev: '' });

  const laptop = add('cmp-laptop', 'laptop-01', { x: 6, z: -4, notes: 'Roaming client on the VPN.' });
  ip(laptop, 'wg0', '10.99.0.10/32'); laptop.routes.push({ dest: '0.0.0.0/0', via: '', dev: 'wg0' });

  // ---- rack
  const mount = (d, u) => Object.assign(d.phys, { roomId: R, mount: 'rack', rackId: rack.id, rackU: u });
  const rsw = add('net-switch-l3-48', 'rack-switch', { x: 4, z: 6 });
  rsw.vlans = VL.map(([id, name]) => ({ id, name }));
  Object.assign(port(rsw, 'Gi0/48'), { mode: 'trunk', nativeVlan: 1, trunkVlans: TRUNK, desc: 'to edge-router lan3' });
  Object.assign(port(rsw, 'Gi0/2'), { vlan: 20, desc: 'srv-01 eno1' });
  mount(rsw, 36);

  const servers = ['srv-01', 'srv-02', 'srv-03', 'srv-04'].map((n, i) => {
    const d = add('cmp-1u', n, { x: -3.75 + i * 2.5, z: 9.5 });
    mount(d, 10 + i);
    return d;
  });
  const hv = servers[0];
  hv.attrs = [{ k: 'OS', v: 'hypervisor' }, ...hv.attrs.filter(a => a.k !== 'OS')];
  ip(hv, 'eno1', '192.168.20.10/24'); hv.routes.push({ dest: '0.0.0.0/0', via: '192.168.20.1', dev: '' });
  hv.services = [{ name: 'ssh', port: '22', enabled: true, notes: '' }, { name: 'web-ui', port: '8006', enabled: true, notes: '' }];

  const pp = add('net-patch-24', 'patch-01', { x: -7, z: 2 }); mount(pp, 38);
  const ups = add('pwr-ups-rack', 'rack-ups', { x: -7, z: 5 }); mount(ups, 1);
  for (const s of servers) {
    const pIn = s.ports.find(p => p.name === 'psu1');
    const out = ups.ports.find(p => p.kind === 'power' && /^out/.test(p.name) && !lab.links.some(l => l.a.port === p.id || l.b.port === p.id));
    if (pIn && out) lab.links.push({ id: uid('ln'), a: { dev: ups.id, port: out.id }, b: { dev: s.id, port: pIn.id }, medium: 'power', label: '', notes: '' });
  }

  // ---- links
  link(inet, 'wan1', isp, 'pon', 'fiber');
  link(isp, 'lan1', edge, 'wan', 'copper');
  link(edge, 'lan1', core, 'p1', 'copper', 'trunk');
  link(core, 'p2', dc, 'eth0');
  link(core, 'p3', ap, 'eth0');
  link(core, 'p4', nas, 'eth0');
  link(core, 'p5', nas, 'eth1');
  link(core, 'p6', desk, 'eth0');
  link(edge, 'lan3', rsw, 'Gi0/48', 'copper', 'trunk');
  link(rsw, 'Gi0/2', hv, 'eno1');
  link(edge, 'wg0', laptop, 'wg0', 'tunnel', 'WireGuard');
  return lab;
}
export { RACK_U };
