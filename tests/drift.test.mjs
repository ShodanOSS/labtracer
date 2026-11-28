// Unit tests for the drift report (src/drift.js): the sample lab is the plan, the golden
// facts in tests/collect-fixtures/*.facts.json (made by the Python drivers, checked by
// tests/test_collector.py) are the actual state.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareDevice, normPort, driftCounts, inventoryFacts, collectConf, cable, safePushes } from '../src/drift.js';
import { buildSampleLab } from '../src/sample.js';
import { normalizeLab, linksOfPort, portByName } from '../src/model.js';
import { clone } from '../src/util.js';

const facts = n => JSON.parse(readFileSync(new URL(`./collect-fixtures/${n}.facts.json`, import.meta.url), 'utf8'));
const sample = () => normalizeLab(buildSampleLab());
const dev = (lab, n) => lab.devices.find(d => d.name === n);
const find = (items, re) => items.find(it => re.test(it.text));
/** Run an item's accept on the lab (as the GUI does, with the device looked up again). */
const accept = (lab, d, it) => it.accept.run(lab, lab.devices.find(x => x.id === d.id));

test('normPort treats long and short interface names alike', () => {
  assert.equal(normPort('GigabitEthernet0/1'), normPort('Gi0/1'));
  assert.equal(normPort('gi 0/1'), 'gi0/1');
  assert.equal(normPort('TenGigabitEthernet1/1/1'), normPort('Te1/1/1'));
  assert.equal(normPort('Vlan10'), normPort('vl10'));
  assert.equal(normPort('eth0'), 'eth0');
  assert.equal(normPort('eno1'), 'eno1');
  assert.notEqual(normPort('Gi0/1'), normPort('Gi0/10'));
});

test('no facts, no items; failed facts are ignored', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  assert.deepEqual(compareDevice(lab, d, null), []);
  assert.deepEqual(compareDevice(lab, d, { ...facts('linux-pve'), ok: false }), []);
});

test('a device that matches the model has no items', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  let items = compareDevice(lab, d, facts('linux-pve'));
  for (let i = 0; i < 5 && items.some(it => it.accept); i++) {
    for (const it of items) if (it.accept) accept(lab, d, it);
    items = compareDevice(lab, d, facts('linux-pve'));
  }
  assert.deepEqual(items.map(it => it.text), [], 'accepting everything leaves nothing to report');
});

test('Proxmox host: the address on the bridge is one item', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const items = compareDevice(lab, d, facts('linux-pve'));
  const it = find(items, /bridge vmbr0/);
  assert.ok(it, 'bridge item');
  assert.equal(it.sev, 'error');
  assert.ok(!find(items, /vmbr0 .* is on the device but not in the model/), 'vmbr0 is not reported twice');
  accept(lab, d, it);
  assert.equal(portByName(d, 'eno1').ip, '');
  assert.equal(portByName(d, 'vmbr0').ip, '192.168.20.11/24');
  assert.ok(!find(compareDevice(lab, d, facts('linux-pve')), /vmbr0|192\.168\.20/), 'resolved');
});

test('Proxmox host: guests, services, routes and inventory', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const items = compareDevice(lab, d, facts('linux-pve'));
  assert.ok(find(items, /VM dc01/));
  const before = lab.devices.length;
  accept(lab, d, find(items, /VM dc01/));
  const vm = dev(lab, 'dc01');
  assert.equal(lab.devices.length, before + 1);
  assert.ok(vm.virtual && vm.attrs.some(a => a.k === 'Host' && a.v === 'srv-01'));
  assert.ok(!find(compareDevice(lab, d, facts('linux-pve')), /VM dc01/));

  assert.ok(find(items, /TCP 111/), 'open port not in Services');
  assert.ok(!find(items, /TCP (22|8006)/), 'planned services listen');
  assert.ok(find(items, /Route 10\.50\.0\.0\/16/));
  assert.ok(!find(items, /Route 0\.0\.0\.0\/0/), 'the default route matches');

  const inv = inventoryFacts(items);
  assert.ok(inv.length >= 3 && inv.every(it => it.area === 'inventory'));
  for (const it of inv) accept(lab, d, it);
  assert.equal(d.vendor, 'Supermicro');
  assert.equal(portByName(d, 'eno1').mac, '3c:ec:ef:12:34:56');
});

test('a guest that disappeared can be marked retired', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  accept(lab, d, find(compareDevice(lab, d, facts('linux-pve')), /VM dc01/));
  const f = facts('linux-pve'); f.guests = f.guests.filter(g => g.name !== 'dc01');
  const it = find(compareDevice(lab, d, f), /dc01 should run on this host/);
  assert.ok(it);
  accept(lab, d, it);
  assert.equal(dev(lab, 'dc01').inv.status, 'retired');
});

test('IOS switch: switchports, VLANs and routes', () => {
  const lab = sample(), d = dev(lab, 'rack-switch');
  const items = compareDevice(lab, d, facts('ios-switch'));
  const vl = find(items, /Gi0\/3 is in VLAN 30/);
  assert.ok(vl); accept(lab, d, vl);
  assert.equal(portByName(d, 'Gi0/3').vlan, 30);
  const tr = find(items, /Gi0\/48 carries VLANs/);
  assert.ok(tr); accept(lab, d, tr);
  assert.equal(portByName(d, 'Gi0/48').trunkVlans, '1,10,20,30,40');
  assert.ok(find(items, /VLAN 10 \(mgmt\) is on the device/));
  assert.ok(find(items, /VLAN 50 \(iot\) is not on the device/));
  assert.ok(find(items, /Vlan10 \(192\.168\.10\.2\/24\)/), 'SVI not in the model');
  const it = find(items, /Vlan10/); accept(lab, d, it);
  assert.equal(portByName(d, 'Vlan10').kind, 'svi');
  assert.equal(portByName(d, 'Vlan10').ip, '192.168.10.2/24');
  assert.ok(!find(items, /LLDP/), 'both LLDP neighbors match the cables in the model');
});

test('LLDP neighbor that is not cabled in the model can be cabled', () => {
  const lab = sample(), d = dev(lab, 'rack-switch'), srv = dev(lab, 'srv-01');
  const p = portByName(d, 'Gi0/2');
  lab.links = lab.links.filter(l => !linksOfPort(lab, d.id, p.id).includes(l));
  const it = find(compareDevice(lab, d, facts('ios-switch')), /LLDP\/CDP: Gi0\/2 connects to srv-01:eno1, not in the model/);
  assert.ok(it);
  accept(lab, d, it);
  const l = linksOfPort(lab, d.id, p.id);
  assert.equal(l.length, 1);
  assert.ok([l[0].a.dev, l[0].b.dev].includes(srv.id));
});

test('a cable to another device in the model is an error', () => {
  const lab = sample(), d = dev(lab, 'rack-switch'), srv = dev(lab, 'srv-02');
  const p = portByName(d, 'Gi0/2');
  lab.links = lab.links.filter(l => !linksOfPort(lab, d.id, p.id).includes(l));
  cable(lab, d.id, p.id, srv.id, srv.ports.find(x => x.kind === 'eth').id);
  const it = find(compareDevice(lab, d, facts('ios-switch')), /Gi0\/2 connects to srv-01/);
  assert.equal(it.sev, 'error');
  assert.match(it.text, /the model says srv-02/);
});

test('renamed interface is matched by MAC', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const p = portByName(d, 'eno2'); p.name = 'nic2'; p.mac = '3C:EC:EF:12:34:57';
  const it = find(compareDevice(lab, d, facts('linux-pve')), /nic2 is called eno2 on the device/);
  assert.ok(it);
  accept(lab, d, it);
  assert.equal(p.name, 'eno2');
});

test('ignored items stay listed but are not counted', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const items = compareDevice(lab, d, facts('linux-pve'));
  const it = find(items, /TCP 111/);
  d.collect = { ...collectConf(d), ignore: [it.key] };
  const again = compareDevice(lab, d, facts('linux-pve'));
  assert.ok(find(again, /TCP 111/).ignored);
  assert.equal(driftCounts(again).info, driftCounts(items).info - 1);
});

test('accept works on a copy of the lab (after undo the lab is a new object)', () => {
  const lab = sample(), d = dev(lab, 'rack-switch');
  const it = find(compareDevice(lab, d, facts('ios-switch')), /Gi0\/3 is in VLAN 30/);
  const copy = clone(lab), d2 = dev(copy, 'rack-switch');
  accept(copy, d2, it);
  assert.equal(portByName(d2, 'Gi0/3').vlan, 30);
  assert.equal(portByName(d, 'Gi0/3').vlan, 1, 'the original lab is not changed');
});

test('BusyBox router: extra interfaces and routes', () => {
  const lab = sample(), d = dev(lab, 'edge-router');
  const items = compareDevice(lab, d, facts('busybox'));
  assert.ok(find(items, /The device calls itself DD-WRT/));
  assert.ok(find(items, /Route 10\.8\.0\.0\/16 via 192\.168\.1\.2/));
  assert.ok(!find(items, /\blo\b.*not in the model/), 'loopback is never extra');
});

test('push: operations that make the device match the model', () => {
  const lab = sample(), d = dev(lab, 'rack-switch');
  const items = compareDevice(lab, d, facts('ios-switch'));
  const vl = find(items, /Gi0\/3 is in VLAN 30/);
  assert.deepEqual(vl.push.ops, [{ op: 'sw-access', port: 'GigabitEthernet0/3', vlan: 1 }], 'uses the device interface name and the planned VLAN');
  assert.equal(vl.push.danger, false);
  const tr = find(items, /Gi0\/48 carries VLANs/);
  assert.equal(tr.push.danger, true, 'trunk changes can cut the uplink');
  assert.deepEqual(tr.push.ops[0], { op: 'sw-trunk', port: 'GigabitEthernet0/48', nativeVlan: 1, trunkVlans: '1,20,30,40,50' });
  assert.deepEqual(find(items, /VLAN 50 \(iot\) is not on the device/).push.ops, [{ op: 'vlan-add', id: 50, name: 'iot' }]);
  assert.equal(find(items, /VLAN 10 \(mgmt\) is on the device/).push.danger, true, 'deleting a VLAN is dangerous');
  const def = find(items, /Route 0\.0\.0\.0\/0 via 192\.168\.10\.1 is on the device/);
  assert.equal(def.push.danger, true, 'removing the default route is dangerous');
  assert.ok(!find(items, /Model WS-C2960X/).push, 'inventory facts can not be pushed');
  const safe = safePushes(items);
  assert.ok(safe.length && safe.every(it => !it.push.danger));
});

test('push: changing the address LabTracer connects to is dangerous', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const f = facts('linux-pve');
  f.host = '10.99.0.2';
  portByName(d, 'eno2').ip = '';
  d.ports.push({ ...portByName(d, 'eno2'), id: 'pt_wg', name: 'wg0', kind: 'tunnel', ip: '10.99.0.9/24' });
  const it = find(compareDevice(lab, d, f), /wg0 has 10\.99\.0\.2\/24 on the device/);
  assert.deepEqual(it.push.ops, [{ op: 'iface-ip', port: 'wg0', ip: '10.99.0.9/24', old: ['10.99.0.2/24'] }]);
  assert.equal(it.push.danger, true);
});

test('two device routes for one destination: the model route is found, the other is reported', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const f = facts('linux-pve');
  const def = f.routes.find(r => r.dest === '0.0.0.0/0');
  assert.ok(def, 'the fixture has a default route');
  // a second default route with another metric (a laptop on Wi-Fi and Ethernet)
  const two = { ...f, routes: [...f.routes, { dest: '0.0.0.0/0', via: '192.168.30.1', dev: '' }] };
  let items = compareDevice(lab, d, two);
  assert.ok(!items.some(it => it.key === 'route-via:0.0.0.0/0'), 'the model route exists: no "wrong next hop"');
  const alt = items.find(it => it.key === 'route-alt:0.0.0.0/0:192.168.30.1');
  assert.ok(alt, 'the second route is reported');
  assert.deepEqual(alt.push.ops, [{ op: 'route-del', dest: '0.0.0.0/0', via: '192.168.30.1', dev: '' }]);
  assert.ok(alt.push.danger);
  // the second route listed first: same result (a Map by destination kept only the last one)
  items = compareDevice(lab, d, { ...two, routes: [two.routes.at(-1), ...f.routes] });
  assert.ok(!items.some(it => it.key === 'route-via:0.0.0.0/0'));
  // neither is the model's: every one is deleted before the model's is added
  const other = { ...f, routes: [...f.routes.filter(r => r.dest !== '0.0.0.0/0'), { dest: '0.0.0.0/0', via: '10.9.9.1', dev: '' }, { dest: '0.0.0.0/0', via: '10.9.9.2', dev: '' }] };
  const via = compareDevice(lab, d, other).find(it => it.key === 'route-via:0.0.0.0/0');
  assert.deepEqual(via.push.ops.map(o => `${o.op} ${o.via}`), ['route-del 10.9.9.1', 'route-del 10.9.9.2', `route-add ${def.via}`]);
});

test('a model description missing on the device is reported only when the driver reads descriptions', () => {
  const lab = sample(), d = dev(lab, 'srv-01');
  const f = facts('linux-pve');
  const p = d.ports.find(x => f.interfaces.some(i => normPort(i.name) === normPort(x.name) && !i.desc) && ['eth', 'sfp', 'vport'].includes(x.kind));
  assert.ok(p, 'a matched port without a device description');
  p.desc = 'to the core switch';
  const it = compareDevice(lab, d, { ...f, descriptions: true }).find(x => x.key === `desc:${p.id}`);
  assert.ok(it, 'reported');
  assert.deepEqual(it.push.ops.map(o => o.desc), ['to the core switch']);
  assert.ok(!compareDevice(lab, d, { ...f, descriptions: false }).some(x => x.key === `desc:${p.id}`), 'not read: not reported');
});
