// SPDX-License-Identifier: Apache-2.0
// Simplified network simulator: VLAN-aware layer 2 flooding plus
// hop-by-hop IPv4 routing. Good enough to catch the classic homelab
// mistakes: wrong VLAN on a port, missing trunk VLAN, missing route,
// missing return route, IP forwarding off, port shut down.
// Not modelled: firewall rules, NAT, ARP timing, STP, tunnel underlay.
import { parseCIDR, inSubnet, ipToInt, intToIp, vlanSet } from './util.js';
import { devById, portById, L3_KINDS, LINKABLE, MULTI_LINK, ssidVlan } from './model.js';

export function l3Ifaces(dev) {
  const out = [];
  for (const p of dev.ports) {
    if (!p.enabled || !p.ip || !L3_KINDS.has(p.kind)) continue;
    if (p.kind === 'sub') { const par = portById(dev, p.parent); if (!par || !par.enabled) continue; }
    const c = parseCIDR(p.ip);
    if (c) out.push({ port: p, cidr: c });
  }
  return out;
}

const portOwns = (p, ipInt) => { if (!p.enabled || !p.ip) return false; const c = parseCIDR(p.ip); return !!c && c.ip === ipInt; };
export const devOwns = (dev, ipInt) => l3Ifaces(dev).some(i => i.cidr.ip === ipInt);

export function findOwner(lab, ipInt) {
  for (const d of lab.devices) for (const i of l3Ifaces(d)) if (i.cidr.ip === ipInt) return { dev: d, port: i.port };
  return null;
}

/** Route table: connected networks plus static routes. */
export function routeTable(dev) {
  const rows = [];
  for (const i of l3Ifaces(dev)) rows.push({ type: 'C', dest: intToIp(i.cidr.net) + '/' + i.cidr.prefix, via: '', dev: i.port.name });
  for (const r of dev.routes) rows.push({ type: 'S', dest: r.dest, via: r.via || '', dev: r.dev || '' });
  return rows;
}

export function lookupRoute(dev, dst) {
  const ifs = l3Ifaces(dev);
  let best = null;
  for (const i of ifs) {
    if (inSubnet(dst, i.cidr) && (!best || i.cidr.prefix > best.prefix)) best = { prefix: i.cidr.prefix, port: i.port, nexthop: dst, type: 'connected' };
  }
  for (const r of dev.routes) {
    const c = parseCIDR(r.dest);
    if (!c || !inSubnet(dst, c)) continue;
    if (best && c.prefix <= best.prefix) continue; // connected wins on a tie
    if (r.via) {
      const v = ipToInt(r.via);
      if (v === null) continue;
      const eg = ifs.filter(i => inSubnet(v, i.cidr)).sort((a, b) => b.cidr.prefix - a.cidr.prefix)[0];
      if (!eg) continue;
      best = { prefix: c.prefix, port: eg.port, nexthop: v, type: 'static', route: r };
    } else if (r.dev) {
      const port = dev.ports.find(p => p.name === r.dev && p.enabled);
      if (!port) continue;
      best = { prefix: c.prefix, port, nexthop: null, type: 'static-dev', route: r };
    }
  }
  return best;
}

function buildIndex(lab) {
  const byEnd = new Map();
  const add = (k, l) => { if (!byEnd.has(k)) byEnd.set(k, []); byEnd.get(k).push(l); };
  for (const l of lab.links) { add(l.a.dev + '|' + l.a.port, l); add(l.b.dev + '|' + l.b.port, l); }
  const devs = new Map(lab.devices.map(d => [d.id, d]));
  return { byEnd, devs };
}

const NOT_SWITCHED = new Set(['power', 'console', 'usb', 'video', 'tunnel']);
const isSwitchport = (dev, p) => dev.l2 && LINKABLE.has(p.kind) && p.mode !== 'routed' && !NOT_SWITCHED.has(p.kind);
const memberVlan = p => (p.mode === 'trunk' ? (p.nativeVlan || 1) : (p.vlan || 1));

/**
 * All layer-3 endpoints in the same broadcast domain as (dev, port).
 * Returns [{dev, port, path: [[linkId, fromDevId], ...]}]
 */
export function l2Reach(lab, dev, port, idx = buildIndex(lab)) {
  const found = new Map();
  const seen = new Set();
  const queue = [];
  const record = (d, p, path) => {
    if (d.id === dev.id && p.id === port.id) return;
    if (!p.enabled || !p.ip) return;
    const k = d.id + '|' + p.id;
    if (!found.has(k)) found.set(k, { dev: d, port: p, path });
  };
  // ssidV: frames leaving an AP radio reach only the clients whose SSID maps to this VLAN
  const wire = (d, p, tag, path, skipLink, ssidV = null) => queue.push({ t: 'wire', d, p, tag, path, skipLink, ssidV });
  const sw = (d, vlan, path, inPort, inLink) => queue.push({ t: 'sw', d, vlan, path, inPort, inLink });

  // inject the first frame
  if (port.kind === 'sub') {
    const par = portById(dev, port.parent);
    if (par && par.enabled) wire(dev, par, port.vlan || null, []);
  } else if (port.kind === 'svi') {
    sw(dev, port.vlan || 1, [], null, null);
  } else if (port.kind === 'loop') {
    // no layer 2
  } else if (isSwitchport(dev, port)) {
    sw(dev, memberVlan(port), [], null, null);
  } else {
    wire(dev, port, null, []);
  }

  let guard = 0;
  while (queue.length && guard++ < 20000) {
    const s = queue.shift();
    if (s.t === 'wire') {
      if (!s.p.enabled) continue;
      for (const link of idx.byEnd.get(s.d.id + '|' + s.p.id) || []) {
        if (link.id === s.skipLink) continue;
        const end = (link.a.dev === s.d.id && link.a.port === s.p.id) ? link.b : link.a;
        const d2 = idx.devs.get(end.dev); const p2 = d2 && portById(d2, end.port);
        if (!p2 || !p2.enabled) continue;
        if (s.ssidV !== null && ssidVlan(s.d, p2.ssid) !== s.ssidV) continue;
        const key = d2.id + '|' + p2.id + '|' + s.tag;
        if (seen.has(key)) continue;
        seen.add(key);
        const path = [...s.path, [link.id, s.d.id]];
        arrive(d2, p2, s.tag, path, link.id, s.p);
      }
    } else {
      const key = s.d.id + '|sw|' + s.vlan;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const p of s.d.ports) {
        if (!p.enabled) continue;
        if (p.kind === 'svi' && (p.vlan || 1) === s.vlan) record(s.d, p, s.path);
        if (!isSwitchport(s.d, p)) continue;
        if (p.ip && memberVlan(p) === s.vlan && p.mode !== 'trunk') record(s.d, p, s.path);
        if (p.id === s.inPort && !MULTI_LINK.has(p.kind)) continue;
        const skip = p.id === s.inPort ? s.inLink : null;
        if (p.kind === 'wifi' && s.d.ssids?.length) {
          if (s.d.ssids.some(x => x.enabled !== false && (x.vlan || 1) === s.vlan)) wire(s.d, p, null, s.path, skip, s.vlan);
          continue;
        }
        if (p.mode === 'trunk') {
          if (vlanSet(p.trunkVlans)(s.vlan)) wire(s.d, p, s.vlan === (p.nativeVlan || 1) ? null : s.vlan, s.path, skip);
        } else if ((p.vlan || 1) === s.vlan) {
          wire(s.d, p, null, s.path, skip);
        }
      }
    }
  }

  function arrive(d2, p2, tag, path, linkId, fromPort) {
    if (d2.passthrough) {
      // patch panel: 12F <-> 12R
      const m = /^(.*?)([FR])$/i.exec(p2.name);
      if (m) {
        const partner = d2.ports.find(q => q.name.toUpperCase() === (m[1] + (m[2].toUpperCase() === 'F' ? 'R' : 'F')).toUpperCase());
        if (partner && partner.enabled) wire(d2, partner, tag, path);
      }
      return;
    }
    if (p2.kind === 'wifi' && d2.ssids?.length && isSwitchport(d2, p2)) {
      const v = ssidVlan(d2, fromPort?.ssid);
      if (v !== null) sw(d2, v, path, p2.id, linkId); // else: client is not on an SSID of this AP
      return;
    }
    if (isSwitchport(d2, p2)) {
      let v;
      if (p2.mode === 'trunk') {
        v = tag === null ? (p2.nativeVlan || 1) : tag;
        if (!vlanSet(p2.trunkVlans)(v)) return;
      } else {
        v = p2.vlan || 1;
        if (tag !== null && tag !== v) return; // tagged frame on an access port: dropped
      }
      sw(d2, v, path, p2.id, linkId);
      return;
    }
    if (tag === null) {
      if (p2.ip && p2.kind !== 'svi' && p2.kind !== 'sub') record(d2, p2, path);
    } else {
      for (const sub of d2.ports) if (sub.kind === 'sub' && sub.parent === p2.id && (sub.vlan || null) === tag) record(d2, sub, path);
    }
  }
  return [...found.values()];
}

/** One-way hop-by-hop trace from a device toward an address. */
export function trace(lab, src, dstStr, maxHops = 16) {
  const dst = typeof dstStr === 'number' ? dstStr : ipToInt(dstStr);
  if (dst === null) return { ok: false, reason: 'invalid IPv4 address', hops: [] };
  const idx = buildIndex(lab);
  const hops = [];
  let cur = src;
  let srcIp = null;
  for (let ttl = 0; ttl < maxHops; ttl++) {
    if (devOwns(cur, dst)) return { ok: true, hops, srcIp, dst: cur };
    if (ttl > 0 && !cur.l3) return { ok: false, hops, srcIp, at: cur, reason: `${cur.name} got the packet but does not route (IP forwarding is off)` };
    const rt = lookupRoute(cur, dst);
    if (!rt) return { ok: false, hops, srcIp, at: cur, reason: `${cur.name}: no route to ${intToIp(dst)}` };
    if (ttl === 0) { const c = parseCIDR(rt.port.ip); srcIp = c ? c.ip : null; }
    const reach = l2Reach(lab, cur, rt.port, idx);
    let target;
    if (rt.nexthop !== null) target = reach.find(e => portOwns(e.port, rt.nexthop));
    else target = reach.find(e => portOwns(e.port, dst)) || reach.find(e => e.dev.l3);
    if (!target) {
      const what = rt.nexthop === null ? 'no peer' : (rt.nexthop === dst ? `host ${intToIp(dst)}` : `next hop ${intToIp(rt.nexthop)}`);
      return { ok: false, hops, srcIp, at: cur, reason: `${cur.name}: ${ssidProblem(lab, cur, rt.port) || `${what} not reachable out ${rt.port.name} (no layer 2 path)`}` };
    }
    hops.push({ from: cur, to: target.dev, egress: rt.port.name, ingress: target.port.name, ip: target.port.ip, path: target.path, via: rt.type });
    cur = target.dev;
  }
  return { ok: false, hops, srcIp, at: cur, reason: 'TTL expired (routing loop)' };
}

/** Explain a wifi client that is not on an SSID of the AP it links to. */
function ssidProblem(lab, dev, port) {
  if (port.kind !== 'wifi') return '';
  for (const l of lab.links) {
    const end = l.a.dev === dev.id && l.a.port === port.id ? l.b : (l.b.dev === dev.id && l.b.port === port.id ? l.a : null);
    const ap = end && lab.devices.find(x => x.id === end.dev);
    if (ap?.ssids?.length && ssidVlan(ap, port.ssid) === null) return port.ssid ? `SSID "${port.ssid}" is not on ${ap.name}` : `${port.name} has not joined an SSID of ${ap.name}`;
  }
  return '';
}

/** Ping = forward trace + return trace from the owner back to our source address. */
export function ping(lab, src, dstStr) {
  const dst = ipToInt(dstStr);
  if (dst === null) return { ok: false, reason: 'invalid IPv4 address', fwd: null };
  const fwd = trace(lab, src, dst);
  if (!fwd.ok) return { ok: false, reason: fwd.reason, fwd };
  if (fwd.hops.length === 0) return { ok: true, fwd, back: null, local: true };
  if (fwd.srcIp === null) return { ok: false, reason: 'no source address', fwd };
  const back = trace(lab, fwd.dst, fwd.srcIp);
  if (!back.ok) return { ok: false, reason: 'reply lost: ' + back.reason, fwd, back };
  return { ok: true, fwd, back };
}

/** Find addresses used more than once. */
export function duplicateIps(lab) {
  const seen = new Map(); const dups = new Set();
  for (const d of lab.devices) for (const i of l3Ifaces(d)) {
    const k = i.cidr.ip;
    if (seen.has(k) && seen.get(k) !== d.id + i.port.id) dups.add(k); else seen.set(k, d.id + i.port.id);
  }
  return dups;
}

export { devById };
