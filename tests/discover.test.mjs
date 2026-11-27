// Discovery to lab (src/discover.js): the recorded facts of a switch and a Proxmox host, plus
// hosts that were only found by the sweep, become devices with ports, addresses and cables.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFromDiscovery, classify, hostName, findInLab } from '../src/discover.js';
import { newLab, linksOfPort, devById, portById } from '../src/model.js';

const facts = n => JSON.parse(readFileSync(new URL(`./collect-fixtures/${n}.facts.json`, import.meta.url), 'utf8'));
const result = () => ({
  ranges: ['192.168.10.0/24', '192.168.20.0/24'],
  hosts: [
    { ip: '192.168.10.2', via: 'scan', ports: [22], mac: '', ssh: { state: 'done' }, driver: 'ios', facts: { ...facts('ios-switch'), host: '192.168.10.2' } },
    { ip: '192.168.20.11', via: 'scan', ports: [22, 8006], mac: '', ssh: { state: 'done' }, driver: 'linux', facts: { ...facts('linux-pve'), host: '192.168.20.11' } },
    // two clients behind Gi0/3 of the switch (its MAC table has both): an unmanaged switch is assumed
    { ip: '192.168.10.50', via: 'scan', ports: [9100, 631], mac: 'a4:bb:6d:11:22:33', ssh: { state: 'none' }, rdns: 'printer.lab.local' },
    { ip: '192.168.10.51', via: 'arp', ports: [], mac: 'a4:bb:6d:11:44:55', ssh: { state: 'none' } },
    { ip: '192.168.10.99', via: 'scan', ports: [3389, 445], mac: '', ssh: { state: 'none' } },
  ],
});
const all = r => ({ ssh: { user: 'admin', auth: 'key' }, hosts: r.hosts.map(x => ({ ip: x.ip })) });

test('classify picks a template from facts or open ports', () => {
  const r = result();
  assert.equal(classify(r.hosts[0]), 'net-switch-24');
  assert.equal(classify(r.hosts[1]), 'cmp-2u', 'a Proxmox host with guests');
  assert.equal(classify(r.hosts[2]), 'end-printer');
  assert.equal(classify(r.hosts[3]), 'end-iot');
  assert.equal(classify(r.hosts[4]), 'cmp-tower');
  assert.equal(classify({ ip: '1.2.3.4', ports: [8291] }), 'net-router-rack');
});

test('names come from the hostname, then reverse DNS, then the address', () => {
  const r = result();
  assert.equal(hostName(r.hosts[0]), 'rack-switch');
  assert.equal(hostName(r.hosts[2]), 'printer');
  assert.equal(hostName(r.hosts[3]), 'host-10-51');
});

test('devices get ports, addresses, VLANs, services, VMs and SSH settings', () => {
  const lab = newLab('t'), r = result();
  const out = buildFromDiscovery(lab, r, all(r));
  assert.equal(out.added, 5);
  const sw = devById(lab, out.map['192.168.10.2']);
  assert.equal(sw.name, 'rack-switch');
  assert.ok(sw.l2);
  assert.ok(sw.ports.some(p => p.name === 'GigabitEthernet0/48' && p.mode === 'trunk'), 'trunk port from the facts');
  assert.ok(sw.ports.some(p => p.name === 'Vlan10' && p.ip === '192.168.10.2/24'));
  assert.ok(sw.vlans.some(v => v.id === 20 && v.name === 'servers'), 'VLANs from the facts');
  assert.ok(!sw.ports.some(p => p.name === 'p1'), 'template data ports are replaced by the real ones');
  assert.equal(sw.ssh.host, '192.168.10.2');
  assert.equal(sw.ssh.user, 'admin');
  assert.equal(sw.collect.driver, 'ios');
  const pve = devById(lab, out.map['192.168.20.11']);
  assert.equal(pve.name, 'srv-01');
  assert.ok(pve.ports.some(p => p.name === 'vmbr0' && p.ip === '192.168.20.11/24'));
  assert.ok(lab.devices.some(d => d.name === 'dc01' && d.virtual), 'VMs of the hypervisor are added');
  const pr = devById(lab, out.map['192.168.10.50']);
  assert.equal(pr.ports[0].ip, '192.168.10.50/24', 'prefix from the switch subnet');
  assert.equal(pr.ports[0].mac, 'a4:bb:6d:11:22:33');
  assert.ok(pr.services.some(s => s.port === '9100'));
});

test('cables from LLDP and from the switch MAC table', () => {
  const lab = newLab('t'), r = result();
  const out = buildFromDiscovery(lab, r, all(r));
  const sw = devById(lab, out.map['192.168.10.2']), pve = devById(lab, out.map['192.168.20.11']);
  const gi2 = sw.ports.find(p => p.name === 'GigabitEthernet0/2');
  const l = linksOfPort(lab, sw.id, gi2.id);
  assert.equal(l.length, 1, 'LLDP: Gi0/2 goes to srv-01');
  const other = l[0].a.dev === sw.id ? l[0].b : l[0].a;
  assert.equal(other.dev, pve.id);
  assert.equal(portById(pve, other.port).name, 'eno1');
  const gi3 = sw.ports.find(p => p.name === 'GigabitEthernet0/3');
  const l3 = linksOfPort(lab, sw.id, gi3.id);
  assert.equal(l3.length, 1);
  const us = devById(lab, l3[0].a.dev === sw.id ? l3[0].b.dev : l3[0].a.dev);
  assert.match(us.name, /^unmanaged-/, 'two known MACs behind Gi0/3: an unmanaged switch');
  for (const ip of ['192.168.10.50', '192.168.10.51']) {
    const d = devById(lab, out.map[ip]);
    assert.equal(linksOfPort(lab, d.id, d.ports[0].id).length, 1, `${ip} is cabled to the unmanaged switch`);
  }
  assert.equal(out.unmanaged, 1);
  const gi48 = sw.ports.find(p => p.name === 'GigabitEthernet0/48');
  assert.equal(linksOfPort(lab, sw.id, gi48.id).length, 0, 'no MAC-table cable on a trunk');
});

test('hosts already in the lab are found, and a second address of a device is skipped', () => {
  const lab = newLab('t'), r = result();
  const out = buildFromDiscovery(lab, r, all(r));
  for (const x of r.hosts) assert.ok(findInLab(lab, x), `${x.ip} is in the lab now`);
  const before = lab.devices.length;
  const r2 = { ...r, hosts: [...r.hosts, { ip: '10.99.0.2', sameAs: '192.168.20.11', ports: [], ssh: { state: 'none' } }] };
  const out2 = buildFromDiscovery(lab, r2, { ssh: {}, hosts: [{ ip: '10.99.0.2' }] });
  assert.equal(out2.added, 0);
  assert.equal(lab.devices.length, before);
  assert.ok(out.map['192.168.10.2']);
});
