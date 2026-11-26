// Nagios object config generated from the lab (Nagios Core 4, Naemon, Icinga 1).
//
// One host per deployed device that has monitoring on (the same devices and checks the
// LabTracer agent gets, src/monitor.js), with:
//   parents       from the cabling: the nearest monitored devices on the shortest paths
//                 from the Nagios server. So Nagios reports a device behind a failed switch
//                 as UNREACHABLE, not DOWN. Devices without an address (unmanaged switches,
//                 patch panels) are passed through. A VM without cables hangs off its Host.
//   hostgroups    by category, room and subnet
//   services      from the Services tab (check_ssh, check_http, check_tcp)
//   _LABTRACER_ID custom variable, so the agent can map Nagios results back to devices.
// Uses the generic-host and generic-service templates and the commands of the Nagios Core
// sample config (check-host-alive, check_ssh, check_http, check_tcp).
import { isDeployed, devById, deviceRoomId } from './model.js';
import { monitorConf, monitorHost, tcpPorts } from './monitor.js';
import { parseCIDR, intToIp } from './util.js';
import { whereIs } from './inventory.js';

const PHYSICAL_MEDIA = new Set(['power', 'video', 'console', 'usb']); // cables that carry no IP traffic
const ILLEGAL = /[~!$%^&*|'"<>?,()=;\\\s`]+/g; // Nagios illegal_object_name_chars, plus space, ';' and '\'

/** A safe Nagios object name. */
export const nagName = s => String(s ?? '').replace(ILLEGAL, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
/** A value for a directive: one line, no ';' (Nagios reads it as a comment). */
const val = s => String(s ?? '').replace(/[\r\n;]+/g, ' ').trim();
const slug = s => nagName(String(s).toLowerCase());
export const labNagiosConf = lab => Object.assign({ host: '' }, lab.nagios || {});

/** The service check for a TCP port. */
export function serviceCheck(port) {
  if (port === 22) return 'check_ssh';
  if (port === 80) return 'check_http';
  if (port === 443) return 'check_http!-S';
  return `check_tcp!${port}`;
}

/** Undirected device graph over cables that carry data, plus VM -> Host. */
function graph(lab) {
  const adj = new Map(lab.devices.map(d => [d.id, new Set()]));
  const join = (a, b) => { if (a !== b && adj.has(a) && adj.has(b)) { adj.get(a).add(b); adj.get(b).add(a); } };
  for (const l of lab.links) if (!PHYSICAL_MEDIA.has(l.medium)) join(l.a.dev, l.b.dev);
  const byName = new Map(lab.devices.map(d => [d.name.toLowerCase(), d]));
  for (const d of lab.devices) {
    const host = (d.attrs || []).find(a => a.k.toLowerCase() === 'host')?.v?.trim().toLowerCase();
    if (host && byName.has(host) && !adj.get(d.id).size) join(d.id, byName.get(host).id);
  }
  return adj;
}

/** device id -> Set of the device ids one step closer to root on a shortest path. */
function shortestPreds(adj, root) {
  const dist = new Map([[root, 0]]), preds = new Map([[root, new Set()]]);
  const queue = [root];
  while (queue.length) {
    const u = queue.shift();
    for (const v of adj.get(u) || []) {
      if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); preds.set(v, new Set([u])); queue.push(v); }
      else if (dist.get(v) === dist.get(u) + 1) preds.get(v).add(u);
    }
  }
  return preds;
}

/**
 * Generate the config. opts: {root: device id of the Nagios server (else lab.nagios.host), now: Date}.
 * Returns {text, hosts: [{id, name, address, parents}], services, skipped: [{name, why}], unconnected: [names]}.
 */
export function nagiosConfig(lab, opts = {}) {
  const root = opts.root ?? labNagiosConf(lab).host;
  const now = opts.now || new Date();
  const skipped = [], unconnected = [];
  const hosts = [];
  const used = new Set();
  const unique = base => { let n = base, i = 2; while (used.has(n.toLowerCase())) n = `${base}-${i++}`; used.add(n.toLowerCase()); return n; };

  for (const d of lab.devices) {
    if (!isDeployed(d) || d.physicalOnly || d.logical) continue;
    const mc = monitorConf(d);
    if (!mc.enabled) continue;
    const address = monitorHost(d);
    if (!address) { skipped.push({ name: d.name, why: 'no address' }); continue; }
    const ports = mc.services ? [...new Set(d.services.filter(s => s.enabled !== false).flatMap(s => tcpPorts(s.port).map(port => ({ port, name: s.name }))).map(x => JSON.stringify(x)))].map(x => JSON.parse(x)) : [];
    if (!mc.ping && !ports.length) { skipped.push({ name: d.name, why: 'ping is off and there are no TCP service ports' }); continue; }
    hosts.push({ d, id: d.id, name: unique(nagName(d.name)), address, ping: mc.ping, ports, parents: [] });
  }

  // parents: the nearest monitored devices on the shortest paths from the Nagios server
  const byId = new Map(hosts.map(x => [x.id, x]));
  const rootDev = root ? devById(lab, root) : null;
  if (rootDev) {
    const preds = shortestPreds(graph(lab), rootDev.id);
    const nearest = (id, seen = new Set()) => {
      const out = new Set();
      for (const p of preds.get(id) || []) {
        if (p === rootDev.id || seen.has(p)) continue;
        seen.add(p);
        if (byId.has(p)) out.add(byId.get(p).name);
        else for (const x of nearest(p, seen)) out.add(x);
      }
      return out;
    };
    for (const hst of hosts) {
      if (hst.id === rootDev.id) continue;
      if (!preds.has(hst.id)) { unconnected.push(hst.d.name); continue; }
      hst.parents = [...nearest(hst.id)].sort();
    }
  }

  // hostgroups: category, room, subnet
  const groups = new Map(); // name -> alias
  const group = (name, alias) => { groups.set(name, alias); return name; };
  for (const hst of hosts) {
    const d = hst.d, g = [group('labtracer', `LabTracer: ${lab.name}`), group(`lt-${slug(d.category)}`, `LabTracer: ${d.category}`)];
    const room = lab.rooms.find(r => r.id === deviceRoomId(lab, d));
    if (room) g.push(group(`lt-room-${slug(room.name)}`, `LabTracer room: ${room.name}`));
    const port = d.ports.find(p => p.ip && p.ip.split('/')[0] === hst.address);
    const c = port ? parseCIDR(port.ip) : null;
    if (c && c.prefix < 32) g.push(group(`lt-net-${intToIp(c.net)}_${c.prefix}`, `LabTracer subnet ${intToIp(c.net)}/${c.prefix}`));
    hst.groups = g;
  }

  const L = [];
  const block = (type, rows) => {
    const w = Math.max(...rows.filter(Boolean).map(([k]) => k.length));
    L.push(`define ${type} {`, ...rows.filter(Boolean).map(([k, v]) => `    ${k.padEnd(w)}  ${v}`), '}', '');
  };
  L.push(`# Nagios objects for the LabTracer lab "${val(lab.name)}".`,
    `# Generated by LabTracer on ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC. Do not edit: change the lab and export again.`,
    `# ${hosts.length} hosts, ${hosts.reduce((n, x) => n + x.ports.length, 0)} services. Parents from the cabling, seen from ${rootDev ? val(rootDev.name) : '(no Nagios server set: no parents)'}.`,
    '# Needs the generic-host and generic-service templates and the check-host-alive, check_ssh,',
    '# check_http and check_tcp commands of the Nagios Core sample config.');
  if (skipped.length) L.push(`# Skipped: ${skipped.map(s => `${val(s.name)} (${s.why})`).join(', ')}`);
  if (unconnected.length) L.push(`# Not cabled to the Nagios server in the lab (no parents): ${unconnected.map(val).join(', ')}`);
  L.push('');
  block('host', [['name', 'labtracer-host'], ['use', 'generic-host'], ['check_command', 'check-host-alive'], ['max_check_attempts', '3'],
    ['check_interval', '5'], ['retry_interval', '1'], ['check_period', '24x7'], ['notification_period', '24x7'],
    ['notification_interval', '60'], ['notification_options', 'd,u,r'], ['contact_groups', 'admins'], ['register', '0']]);
  block('service', [['name', 'labtracer-service'], ['use', 'generic-service'], ['max_check_attempts', '3'], ['check_interval', '5'], ['retry_interval', '1'], ['register', '0']]);
  for (const [name, alias] of [...groups].sort()) block('hostgroup', [['hostgroup_name', name], ['alias', val(alias)]]);
  let services = 0;
  for (const hst of hosts) {
    const where = whereIs(lab, hst.d);
    block('host', [['use', 'labtracer-host'], ['host_name', hst.name], ['alias', val(where ? `${hst.d.name} (${where})` : hst.d.name)], ['address', hst.address],
      hst.parents.length ? ['parents', hst.parents.join(',')] : null,
      ['hostgroups', hst.groups.join(',')],
      hst.ping ? null : ['check_command', `check_tcp!${hst.ports[0].port}`],
      ['_LABTRACER_ID', hst.id]]);
    const descs = new Set();
    for (const { port, name } of hst.ports) {
      let desc = nagName(name ? `${name}-${port}` : `tcp-${port}`), i = 2;
      while (descs.has(desc)) desc = `${nagName(name || 'tcp')}-${port}-${i++}`;
      descs.add(desc);
      block('service', [['use', 'labtracer-service'], ['host_name', hst.name], ['service_description', desc], ['check_command', serviceCheck(port)]]);
      services++;
    }
  }
  return { text: L.join('\n'), hosts: hosts.map(({ id, name, address, parents }) => ({ id, name, address, parents })), services, skipped, unconnected };
}

/** Hosts in Nagios vs hosts the lab generates. nagiosHosts: names from the agent (source "nagios"). */
export function nagiosDrift(lab, nagiosHosts) {
  const gen = new Set(nagiosConfig(lab).hosts.map(x => x.name.toLowerCase()));
  const have = new Set((nagiosHosts || []).map(x => String(x).toLowerCase()));
  return {
    missing: nagiosConfig(lab).hosts.filter(x => !have.has(x.name.toLowerCase())).map(x => x.name),
    extra: (nagiosHosts || []).filter(x => !gen.has(String(x).toLowerCase()) && String(x).toLowerCase() !== 'localhost'),
  };
}
