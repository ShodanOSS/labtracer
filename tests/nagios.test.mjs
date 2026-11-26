// Unit tests for the Nagios export (src/nagios.js). Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nagiosConfig, nagiosDrift, nagName, serviceCheck } from '../src/nagios.js';
import { buildSampleLab } from '../src/sample.js';
import { normalizeLab, isDeployed, createDevice } from '../src/model.js';
import { BUILTIN } from '../src/templates.js';
import { uid } from '../src/util.js';

const sample = () => normalizeLab(buildSampleLab());
const dev = (lab, n) => lab.devices.find(d => d.name === n);
const host = (r, n) => r.hosts.find(x => x.name === n);
const NOW = new Date(Date.UTC(2026, 0, 1));

// The same table is in tests/test_server.py (agent nag_name): the agent finds devices by these names.
export const NAMES = [['srv-01', 'srv-01'], ['nas 01', 'nas-01'], ['a;b(c)', 'a-b-c'], ['  x  ', 'x'], ['!!!', 'unnamed'], ["o'neil\"s pc", 'o-neil-s-pc']];

test('nagName makes legal object names', () => {
  for (const [a, b] of NAMES) assert.equal(nagName(a), b);
});

test('service checks', () => {
  assert.equal(serviceCheck(22), 'check_ssh');
  assert.equal(serviceCheck(443), 'check_http!-S');
  assert.equal(serviceCheck(8006), 'check_tcp!8006');
});

test('parents follow the cables from the Nagios server', () => {
  const lab = sample();
  const r = nagiosConfig(lab, { root: dev(lab, 'dc-01').id, now: NOW });
  assert.deepEqual(host(r, 'dc-01').parents, [], 'the Nagios server has no parents');
  assert.deepEqual(host(r, 'core-switch').parents, [], 'next to the Nagios server: no parents');
  assert.deepEqual(host(r, 'desktop-01').parents, ['core-switch']);
  assert.deepEqual(host(r, 'edge-router').parents, ['core-switch']);
  assert.deepEqual(host(r, 'srv-01').parents, ['edge-router'], 'rack-switch has no address, so it is passed through');
  assert.deepEqual(host(r, 'plug-01').parents, ['core-switch'], 'over Wi-Fi through the access point');
  assert.deepEqual(r.unconnected, []);
});

test('redundant uplinks give two parents', () => {
  const lab = sample();
  const desk = dev(lab, 'desktop-01'), edge = dev(lab, 'edge-router'), root = dev(lab, 'dc-01');
  const r0 = nagiosConfig(lab, { root: root.id, now: NOW });
  assert.deepEqual(host(r0, 'srv-01').parents, ['edge-router']);
  // a second path from the server: dc-01 -> desktop-01 -> rack-switch -> srv-01, as long as the first
  const p1 = { id: uid('pt'), name: 'eth9', kind: 'eth' }, p2 = { id: uid('pt'), name: 'eth8', kind: 'eth' };
  desk.ports.push({ ...p1, enabled: true }); root.ports.push({ ...p2, enabled: true });
  const rs = dev(lab, 'rack-switch'), rp = rs.ports.find(p => p.name === 'Gi0/47');
  lab.links.push({ id: uid('ln'), a: { dev: desk.id, port: p1.id }, b: { dev: rs.id, port: rp.id }, medium: 'copper' });
  const r = nagiosConfig(lab, { root: root.id, now: NOW });
  assert.ok(host(r, 'srv-01').parents.includes('desktop-01'), `got ${host(r, 'srv-01').parents}`);
  assert.ok(edge);
});

test('a VM without cables hangs off its Host', () => {
  const lab = sample();
  const vm = createDevice(BUILTIN.find(t => t.id === 'vir-vm'), { name: 'vm-web' });
  vm.attrs = [{ k: 'Host', v: 'srv-01' }];
  vm.ports[0].ip = '192.168.20.50/24';
  lab.devices.push(vm);
  const r = nagiosConfig(lab, { root: dev(lab, 'dc-01').id, now: NOW });
  assert.deepEqual(host(r, 'vm-web').parents, ['srv-01']);
});

test('without a Nagios server there are no parents', () => {
  const lab = sample();
  const r = nagiosConfig(lab, { root: '', now: NOW });
  assert.ok(r.hosts.every(x => !x.parents.length));
  assert.match(r.text, /no Nagios server set/);
});

test('hosts: the same devices the agent checks', () => {
  const lab = sample();
  const r = nagiosConfig(lab, { root: dev(lab, 'dc-01').id, now: NOW });
  for (const x of r.hosts) {
    const d = lab.devices.find(y => y.id === x.id);
    assert.ok(isDeployed(d) && !d.physicalOnly);
    assert.match(r.text, new RegExp(`_LABTRACER_ID\\s+${x.id}`));
  }
  const nas = dev(lab, 'nas-01'); nas.inv.status = 'spare';
  assert.ok(!host(nagiosConfig(lab, { now: NOW }), 'nas-01'), 'spares are not monitored');
  const desk = dev(lab, 'desktop-01'); desk.monitor = { enabled: true, ping: false, services: true, host: '' };
  let r2 = nagiosConfig(lab, { now: NOW });
  assert.ok(r2.skipped.some(s => s.name === 'desktop-01'), 'ping off and no ports: nothing to check');
  desk.services = [{ name: 'rdp', port: '3389', enabled: true }];
  r2 = nagiosConfig(lab, { now: NOW });
  assert.match(r2.text, /host_name\s+desktop-01[\s\S]*?check_command\s+check_tcp!3389/, 'host check by TCP when ping is off');
});

test('services, hostgroups and safe values', () => {
  const lab = sample();
  const srv = dev(lab, 'srv-01');
  srv.services.push({ name: 'web; ui', port: '443, 8443/tcp, 51820/udp', enabled: true });
  lab.name = 'my lab; x';
  const r = nagiosConfig(lab, { root: dev(lab, 'dc-01').id, now: NOW });
  assert.match(r.text, /service_description\s+ssh-22\n\s+check_command\s+check_ssh/);
  assert.match(r.text, /service_description\s+web-ui-443\n\s+check_command\s+check_http!-S/);
  assert.match(r.text, /check_tcp!8443/);
  assert.ok(!/51820/.test(r.text), 'UDP is not checked');
  assert.match(r.text, /hostgroup_name\s+lt-net-192\.168\.20\.0_24/);
  assert.match(r.text, /hostgroup_name\s+lt-compute/);
  for (const line of r.text.split('\n')) if (!line.startsWith('#')) assert.ok(!line.includes(';'), `no ';' in values: ${line}`);
  const opens = (r.text.match(/^define /gm) || []).length, closes = (r.text.match(/^}$/gm) || []).length;
  assert.equal(opens, closes);
  assert.equal(nagiosConfig(lab, { root: dev(lab, 'dc-01').id, now: NOW }).text, r.text, 'the same lab gives the same file');
});

test('Nagios vs the lab', () => {
  const lab = sample();
  const names = nagiosConfig(lab).hosts.map(x => x.name);
  const d = nagiosDrift(lab, [...names.slice(1), 'old-printer', 'localhost']);
  assert.deepEqual(d.missing, [names[0]]);
  assert.deepEqual(d.extra, ['old-printer'], 'localhost (the Nagios server itself) is not reported');
});
