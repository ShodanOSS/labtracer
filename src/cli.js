// IOS-flavoured command line for any device. Commands edit the same
// device model that the properties panel edits.
import { parseCIDR, intToIp, prefixToMask, maskToPrefix, ipToInt, uid } from './util.js';
import { makePort, portByName, portById, linksOfPort, otherEnd, devById, L3_KINDS, ssidVlan, wifiClients, NON_IP } from './model.js';
import { routeTable, ping, trace } from './netsim.js';


export function maskOf(cidr) { const c = parseCIDR(cidr); return c ? intToIp(prefixToMask(c.prefix)) : ''; }

export function runningConfig(lab, dev) {
  const L = [];
  const isSw = p => dev.l2 && !['svi', 'sub', 'loop', 'tunnel'].includes(p.kind) && p.mode !== 'routed';
  L.push('! LabTracer running-config');
  L.push(`! ${dev.name}${dev.vendor || dev.model ? '  (' + [dev.vendor, dev.model].filter(Boolean).join(' ') + ')' : ''}`);
  for (const a of dev.attrs) if (a.k) L.push(`! ${a.k}: ${a.v}`);
  L.push('!', `hostname ${dev.name}`, '!');
  if (dev.l3) L.push('ip routing', '!');
  for (const v of [...dev.vlans].sort((a, b) => a.id - b.id)) { L.push(`vlan ${v.id}`); if (v.name) L.push(` name ${v.name}`); L.push('!'); }
  for (const s of dev.ssids || []) L.push(`wlan ssid ${s.name}`, ` vlan ${s.vlan || 1}`, ` security ${s.security || 'wpa2'}`, '!');
  for (const p of dev.ports) {
    if (NON_IP.has(p.kind) && !p.desc) continue;
    L.push(`interface ${p.name}`);
    if (p.desc) L.push(` description ${p.desc}`);
    if (p.kind === 'sub') { const par = portById(dev, p.parent); L.push(` ! parent ${par ? par.name : '?'}`, ` encapsulation dot1q ${p.vlan}`); }
    if (p.kind === 'svi') L.push(` ! vlan interface for VLAN ${p.vlan}`);
    if (p.kind === 'tunnel') L.push(' ! tunnel interface');
    if (p.speed && !NON_IP.has(p.kind)) L.push(` speed ${p.speed}`);
    if (p.mac) L.push(` mac-address ${p.mac}`);
    if (p.kind === 'wifi' && p.ssid) L.push(` ssid ${p.ssid}`);
    if (!NON_IP.has(p.kind)) {
      if (isSw(p)) {
        if (p.mode === 'trunk') {
          L.push(' switchport mode trunk', ` switchport trunk native vlan ${p.nativeVlan || 1}`);
          if (p.trunkVlans && p.trunkVlans !== 'all') L.push(` switchport trunk allowed vlan ${p.trunkVlans}`);
        } else L.push(' switchport mode access', ` switchport access vlan ${p.vlan || 1}`);
      } else if (dev.l2 && p.mode === 'routed' && L3_KINDS.has(p.kind) && !['svi', 'sub', 'loop', 'tunnel'].includes(p.kind)) L.push(' no switchport');
      if (p.ip) {
        const c = parseCIDR(p.ip);
        L.push(c ? ` ip address ${intToIp(c.ip)} ${intToIp(prefixToMask(c.prefix))}` : ` ip address ${p.ip}`);
      } else if (!isSw(p) && L3_KINDS.has(p.kind)) L.push(' no ip address');
    }
    L.push(p.enabled ? ' no shutdown' : ' shutdown', '!');
  }
  for (const r of dev.routes) {
    const c = parseCIDR(r.dest);
    const d = c ? `${intToIp(c.net)} ${intToIp(prefixToMask(c.prefix))}` : r.dest;
    L.push(`ip route ${d} ${r.via || r.dev}`);
  }
  if (dev.routes.length) L.push('!');
  for (const s of dev.services) L.push(`service ${s.name}${s.port ? ' ' + s.port : ''}${s.enabled === false ? ' disabled' : ''}`);
  if (dev.services.length) L.push('!');
  L.push('end');
  return L.join('\n');
}

const pad = (s, n) => String(s).padEnd(n);

export class Cli {
  constructor(app) { this.app = app; this.state = new Map(); }
  st(dev) { if (!this.state.has(dev.id)) this.state.set(dev.id, { mode: 'exec', iface: null }); return this.state.get(dev.id); }
  prompt(dev) {
    const s = this.st(dev);
    if (s.iface) return `${dev.name}(config-if)#`;
    if (s.mode === 'config') return `${dev.name}(config)#`;
    return `${dev.name}#`;
  }

  /** Run one line. Returns {out, changed, save, anim}. */
  exec(dev, line) {
    const lab = this.app.lab;
    const s = this.st(dev);
    const raw = line.trim();
    const res = { out: '', changed: false };
    if (!raw || raw.startsWith('!')) return res;
    let t = raw.split(/\s+/);
    const w = i => (t[i] || '').toLowerCase();
    const is = (tok, full, min = 2) => !!tok && full.startsWith(tok.toLowerCase()) && tok.length >= Math.min(min, full.length);
    const out = x => { res.out += (res.out ? '\n' : '') + x; };
    const err = x => out('% ' + x);
    const cur = s.iface ? portById(dev, s.iface) : null;
    if (s.iface && !cur) s.iface = null;

    // ---- global helpers
    if (raw === '?' || is(w(0), 'help', 1)) { out(HELP); return res; }
    if (is(w(0), 'clear', 3)) { res.clear = true; return res; }
    if (is(w(0), 'end', 3)) { s.iface = null; s.mode = 'exec'; return res; }
    if (is(w(0), 'exit', 2) || is(w(0), 'quit', 2)) { if (s.iface) s.iface = null; else s.mode = 'exec'; return res; }
    if (is(w(0), 'configure', 4)) { s.mode = 'config'; out('Enter configuration commands, one per line.  End with END.'); return res; }
    if (is(w(0), 'enable', 2) || is(w(0), 'disable', 4)) return res;
    if (w(0) === 'do') { t = t.slice(1); return this.exec(dev, t.join(' ')); }

    // ---- show
    if (is(w(0), 'show', 2)) {
      const a = w(1), b = w(2);
      if (is(a, 'running-config', 3)) { out(runningConfig(lab, dev)); return res; }
      if (is(a, 'startup-config', 3)) {
        const f = dev.files.find(f => f.name === 'startup-config');
        out(f ? f.content : '% startup-config is not present (use "write memory")'); return res;
      }
      if (is(a, 'ip', 2) && is(b, 'interface', 3)) { out(this.ifBrief(lab, dev)); return res; }
      if (is(a, 'interfaces', 3)) { out(this.ifBrief(lab, dev, true)); return res; }
      if (is(a, 'ip', 2) && is(b, 'route', 2)) { out(this.routes(dev)); return res; }
      if (is(a, 'route', 2)) { out(this.routes(dev)); return res; }
      if (is(a, 'vlan', 2)) { out(this.vlans(dev)); return res; }
      if (is(a, 'wlan', 2) || is(a, 'ssid', 2)) { out(this.wlan(lab, dev)); return res; }
      if (is(a, 'cdp', 2) || is(a, 'lldp', 2) || is(a, 'neighbors', 3)) { out(this.neighbors(lab, dev)); return res; }
      if (is(a, 'services', 3)) { out(dev.services.length ? dev.services.map(x => `${pad(x.name, 22)} ${pad(x.port || '', 8)} ${x.enabled === false ? 'disabled' : 'enabled'}  ${x.notes || ''}`).join('\n') : 'No services defined.'); return res; }
      if (is(a, 'attributes', 2) || is(a, 'inventory', 3) || is(a, 'version', 3)) {
        out([`${dev.name}  ${dev.vendor} ${dev.model}`.trim(), dev.serial ? `Serial: ${dev.serial}` : null,
          ...dev.attrs.filter(x => x.k).map(x => `${x.k}: ${x.v}`)].filter(Boolean).join('\n') || 'No attributes.'); return res;
      }
      err('Unknown show command. Try: show running-config | interfaces | ip interface brief | ip route | vlan | neighbors | services | inventory');
      return res;
    }

    // ---- test tools
    if (is(w(0), 'ping', 2)) {
      if (!t[1]) { err('usage: ping A.B.C.D'); return res; }
      const r = ping(lab, dev, t[1]);
      out(`Sending 5, 100-byte ICMP Echos to ${t[1]}:`);
      out(r.ok ? '!!!!!' : '.....');
      out(`Success rate is ${r.ok ? 100 : 0} percent (${r.ok ? 5 : 0}/5)`);
      if (r.ok && !r.local) out('path: ' + [dev.name, ...r.fwd.hops.map(h => h.to.name)].join(' -> '));
      if (r.local) out('(local address)');
      if (!r.ok) out('reason: ' + r.reason);
      res.anim = r; return res;
    }
    if (is(w(0), 'traceroute', 4) || w(0) === 'tracert') {
      if (!t[1]) { err('usage: traceroute A.B.C.D'); return res; }
      const r = trace(lab, dev, t[1]);
      out(`Tracing the route to ${t[1]}`);
      r.hops.forEach((hp, i) => out(`  ${i + 1}  ${pad(hp.to.name, 18)} ${(hp.ip || '').split('/')[0]}  (via ${hp.egress} -> ${hp.ingress})`));
      if (!r.ok) out(`  ${r.hops.length + 1}  * * *   ${r.reason}`);
      res.anim = { ok: r.ok, fwd: r, reason: r.reason }; return res;
    }

    // ---- save
    if ((is(w(0), 'write', 2) && (!w(1) || is(w(1), 'memory', 3))) || (is(w(0), 'copy', 2) && is(w(1), 'running-config', 3))) {
      const content = runningConfig(lab, dev);
      let f = dev.files.find(f => f.name === 'startup-config');
      if (!f) { f = { id: uid('file'), name: 'startup-config', content: '', snapshots: [] }; dev.files.unshift(f); }
      f.content = content;
      f.snapshots.unshift({ ts: Date.now(), note: 'write memory', content });
      out('Building configuration...\n[OK]');
      res.changed = true; res.save = true; return res;
    }

    // ---- interface context commands
    const neg = w(0) === 'no';
    const c0 = neg ? w(1) : w(0);
    const args = neg ? t.slice(2) : t.slice(1);
    const lw = i => (args[i] || '').toLowerCase();

    if (cur && !is(c0, 'interface', 3) && !is(c0, 'hostname', 4) && !is(c0, 'vlan', 4)) {
      if (is(c0, 'ip', 2) && is(lw(0), 'address', 2)) {
        if (neg) { cur.ip = ''; res.changed = true; return res; }
        let v;
        if (lw(1) === 'dhcp') v = 'dhcp';
        else if (args[2]) { const pfx = maskToPrefix(args[2]); if (pfx === null || ipToInt(args[1]) === null) { err('Invalid address or mask'); return res; } v = `${args[1]}/${pfx}`; }
        else v = args[1];
        if (v !== 'dhcp' && !parseCIDR(v)) { err('Invalid address. Use A.B.C.D/NN or A.B.C.D M.M.M.M'); return res; }
        cur.ip = v; res.changed = true; return res;
      }
      if (is(c0, 'shutdown', 2)) { cur.enabled = neg; res.changed = true; return res; }
      if (is(c0, 'description', 4)) { cur.desc = neg ? '' : args.join(' '); res.changed = true; return res; }
      if (is(c0, 'speed', 2)) { cur.speed = neg ? '' : args[0] || ''; res.changed = true; return res; }
      if (is(c0, 'mac-address', 3)) { cur.mac = neg ? '' : args[0] || ''; res.changed = true; return res; }
      if (is(c0, 'encapsulation', 3)) { const n = parseInt(args[1] ?? args[0], 10); if (!n) { err('usage: encapsulation dot1q N'); return res; } cur.vlan = n; res.changed = true; return res; }
      if (is(c0, 'switchport', 3)) {
        if (neg && !args.length) { cur.mode = 'routed'; res.changed = true; return res; }
        if (is(lw(0), 'mode', 2)) {
          const m = lw(1);
          if (!['access', 'trunk', 'routed'].includes(m)) { err('mode must be access, trunk or routed'); return res; }
          cur.mode = m; res.changed = true; return res;
        }
        if (is(lw(0), 'access', 2) && is(lw(1), 'vlan', 2)) { const n = parseInt(args[2], 10); if (!n) { err('VLAN id required'); return res; } cur.vlan = n; if (cur.mode === 'routed') cur.mode = 'access'; res.changed = true; return res; }
        if (is(lw(0), 'trunk', 2) && is(lw(1), 'native', 2)) { cur.nativeVlan = parseInt(args[3] ?? args[2], 10) || 1; res.changed = true; return res; }
        if (is(lw(0), 'trunk', 2) && is(lw(1), 'allowed', 2)) {
          let list = args.slice(3).join('') || args.slice(2).join('');
          list = list.replace(/^vlan/i, '');
          cur.trunkVlans = neg ? 'all' : (list || 'all'); res.changed = true; return res;
        }
        err('usage: switchport mode access|trunk | switchport access vlan N | switchport trunk native vlan N | switchport trunk allowed vlan LIST');
        return res;
      }
      if (is(c0, 'ssid', 2) && cur.kind === 'wifi' && !dev.ssids?.length) { cur.ssid = neg ? '' : args.join(' '); res.changed = true; return res; }
      if (is(c0, 'vlan', 2) && (cur.kind === 'svi' || cur.kind === 'sub')) { cur.vlan = parseInt(args[0], 10) || 1; res.changed = true; return res; }
    }

    if (is(c0, 'interface', 3)) {
      let name = args.join('');
      if (!name) { err('usage: interface NAME'); return res; }
      if (/^vlan\d+$/i.test(name)) name = 'vlan' + name.slice(4);
      if (neg) {
        const p = portByName(dev, name);
        if (!p) { err('No such interface'); return res; }
        if (!['svi', 'sub', 'loop', 'tunnel'].includes(p.kind)) { err('Only virtual interfaces can be removed here (use the Ports tab for physical ports)'); return res; }
        this.app.removePortRaw(dev, p.id); res.changed = true; return res;
      }
      let p = portByName(dev, name);
      if (!p) {
        let m;
        if ((m = /^vlan(\d+)$/i.exec(name))) p = makePort({ name: 'vlan' + m[1], kind: 'svi', vlan: +m[1] });
        else if ((m = /^(.+)\.(\d+)$/.exec(name)) && portByName(dev, m[1])) p = makePort({ name, kind: 'sub', parent: portByName(dev, m[1]).id, vlan: +m[2] });
        else if (/^(lo|loopback)\d*$/i.test(name)) p = makePort({ name, kind: 'loop' });
        else if (/^(wg|tun|tunnel|oet|ipsec)\d*$/i.test(name)) p = makePort({ name, kind: 'tunnel' });
        else if (/^(br|bridge)\d*$/i.test(name)) p = makePort({ name, kind: 'svi', vlan: 1 });
        else { err(`No interface ${name}. Add physical ports in the Ports tab (here: vlanN, NAME.N, loN, wgN, brN).`); return res; }
        dev.ports.push(p);
        out(`% Created ${p.kind} interface ${p.name}`);
        res.changed = true;
      }
      s.mode = 'config'; s.iface = p.id;
      return res;
    }

    if (is(c0, 'hostname', 4)) {
      if (!args[0]) { err('usage: hostname NAME'); return res; }
      dev.name = args[0]; res.changed = true; res.renamed = true; return res;
    }

    if (is(c0, 'vlan', 4)) {
      const id = parseInt(args[0], 10);
      if (!id || id < 1 || id > 4094) { err('VLAN id 1-4094'); return res; }
      if (neg) { dev.vlans = dev.vlans.filter(v => v.id !== id); res.changed = true; return res; }
      let v = dev.vlans.find(v => v.id === id);
      if (!v) { v = { id, name: '' }; dev.vlans.push(v); }
      if (is(lw(1), 'name', 2)) v.name = args.slice(2).join(' ');
      res.changed = true; return res;
    }

    if (is(c0, 'wlan', 2) && is(lw(0), 'ssid', 2)) {
      // wlan ssid NAME [vlan N] [security X]   (NAME may contain spaces)
      const rest = args.slice(1);
      const iv = rest.findIndex(x => /^(vlan|security)$/i.test(x));
      const name = (iv < 0 ? rest : rest.slice(0, iv)).join(' ');
      if (!name) { err('usage: wlan ssid NAME [vlan N] [security wpa2|wpa3|wpa2/3|802.1x|open]'); return res; }
      dev.ssids ||= [];
      if (neg) { dev.ssids = dev.ssids.filter(s => s.name !== name); res.changed = true; return res; }
      if (!dev.l2 || !dev.ports.some(p => p.kind === 'wifi')) { err('This device needs a wifi port and "Bridges L2" to broadcast SSIDs'); return res; }
      let s = dev.ssids.find(x => x.name === name);
      if (!s) { s = { name, vlan: 1, security: 'wpa2' }; dev.ssids.push(s); }
      for (let i = iv; i >= 0 && i < rest.length; i += 2) {
        const k = rest[i].toLowerCase(), v = rest[i + 1];
        if (k === 'vlan') { const n = parseInt(v, 10); if (!(n >= 1 && n <= 4094)) { err('VLAN id 1-4094'); return res; } s.vlan = n; }
        else if (k === 'security') s.security = (v || 'wpa2').toLowerCase();
        else { err(`Unknown option ${rest[i]}`); return res; }
      }
      res.changed = true; return res;
    }
    if (is(c0, 'ip', 2) && is(lw(0), 'routing', 3)) { dev.l3 = !neg; res.changed = true; return res; }
    if (is(c0, 'ip', 2) && is(lw(0), 'default-gateway', 3)) {
      dev.routes = dev.routes.filter(r => r.dest !== '0.0.0.0/0');
      if (!neg) { if (ipToInt(args[1]) === null) { err('Invalid gateway'); return res; } dev.routes.push({ dest: '0.0.0.0/0', via: args[1], dev: '' }); }
      res.changed = true; return res;
    }
    if (is(c0, 'ip', 2) && is(lw(0), 'route', 3)) {
      // ip route DEST MASK NEXTHOP|IFACE   or   ip route DEST/NN NEXTHOP|IFACE
      let dest, hop;
      if (args[1] && args[1].includes('/')) { dest = args[1]; hop = args[2]; }
      else { const pfx = maskToPrefix(args[2] || ''); if (pfx === null) { err('usage: ip route DEST MASK NEXTHOP|IFACE'); return res; } dest = `${args[1]}/${pfx}`; hop = args[3]; }
      const c = parseCIDR(dest);
      if (!c) { err('Invalid destination'); return res; }
      dest = intToIp(c.net) + '/' + c.prefix;
      if (neg) { dev.routes = dev.routes.filter(r => !(r.dest === dest && (!hop || r.via === hop || r.dev === hop))); res.changed = true; return res; }
      if (!hop) { err('Next hop or interface required'); return res; }
      const r = ipToInt(hop) !== null ? { dest, via: hop, dev: '' } : { dest, via: '', dev: hop };
      if (!r.via && !portByName(dev, hop)) { err(`No interface ${hop}`); return res; }
      dev.routes.push(r); res.changed = true; return res;
    }
    if (is(c0, 'service', 3)) {
      if (!args[0]) { err('usage: service NAME [PORT]'); return res; }
      const nm = args[0];
      if (neg) { dev.services = dev.services.filter(x => x.name !== nm); res.changed = true; return res; }
      let sv = dev.services.find(x => x.name === nm);
      if (!sv) { sv = { name: nm, port: '', enabled: true, notes: '' }; dev.services.push(sv); }
      if (args[1]) sv.port = args[1];
      res.changed = true; return res;
    }
    if (is(c0, 'set', 3)) {
      if (!args[0]) { err('usage: set ATTRIBUTE VALUE'); return res; }
      const k = args[0]; const v = args.slice(1).join(' ');
      if (neg) dev.attrs = dev.attrs.filter(a => a.k !== k);
      else { const a = dev.attrs.find(a => a.k.toLowerCase() === k.toLowerCase()); if (a) a.v = v; else dev.attrs.push({ k, v }); }
      res.changed = true; return res;
    }

    err(`Unknown command "${raw}". Type ? for help.`);
    return res;
  }

  ifBrief(lab, dev, detail = false) {
    const rows = [pad('Interface', 14) + pad('Kind', 7) + pad('IP-Address', 20) + pad('L2', 18) + pad('Status', 9) + 'Link'];
    for (const p of dev.ports) {
      if (!detail && NON_IP.has(p.kind)) continue;
      const links = linksOfPort(lab, dev.id, p.id);
      const peer = links.map(l => { const e = otherEnd(l, dev.id, p.id); const d = devById(lab, e.dev); return `${d?.name}:${portById(d, e.port)?.name}`; }).join(', ');
      let l2 = '';
      if (p.kind === 'svi') l2 = `vlan ${p.vlan}`;
      else if (p.kind === 'sub') l2 = `dot1q ${p.vlan}`;
      else if (dev.l2 && p.mode === 'trunk') l2 = `trunk n${p.nativeVlan || 1} ${p.trunkVlans || 'all'}`;
      else if (dev.l2 && p.mode !== 'routed') l2 = `access ${p.vlan || 1}`;
      else if (dev.l2) l2 = 'routed';
      const status = !p.enabled ? 'admin-dn' : (links.length || ['svi', 'sub', 'loop'].includes(p.kind) ? 'up' : 'down');
      rows.push(pad(p.name, 14) + pad(p.kind, 7) + pad(p.ip || 'unassigned', 20) + pad(l2, 18) + pad(status, 9) + peer);
      if (detail && p.desc) rows.push('  description: ' + p.desc);
    }
    return rows.join('\n');
  }
  routes(dev) {
    const rows = routeTable(dev);
    if (!rows.length) return 'Routing table is empty.';
    return ['Codes: C - connected, S - static', ...rows.map(r => `${r.type}    ${pad(r.dest, 20)} ${r.via ? 'via ' + r.via : ''}${r.dev ? (r.via ? ', ' : 'is directly connected, ') + r.dev : ''}`)].join('\n') + (dev.l3 ? '' : '\n(IP forwarding is off on this device: it will not route for others)');
  }
  vlans(dev) {
    if (!dev.l2) return '% This device does not bridge (enable "Bridges L2" to use VLANs).';
    const rows = [pad('VLAN', 6) + pad('Name', 20) + 'Ports'];
    const ids = new Set([...dev.vlans.map(v => v.id), ...dev.ports.filter(p => p.mode === 'access' && !NON_IP.has(p.kind)).map(p => p.vlan || 1)]);
    for (const id of [...ids].sort((a, b) => a - b)) {
      const v = dev.vlans.find(v => v.id === id);
      const ports = dev.ports.filter(p => p.mode === 'access' && !NON_IP.has(p.kind) && !['svi', 'sub', 'loop', 'tunnel'].includes(p.kind) && (p.vlan || 1) === id).map(p => p.name);
      rows.push(pad(id, 6) + pad(v ? v.name || '' : '(not in database)', 20) + ports.join(', '));
    }
    const trunks = dev.ports.filter(p => p.mode === 'trunk');
    if (trunks.length) rows.push('', 'Trunks: ' + trunks.map(p => `${p.name} (native ${p.nativeVlan || 1}, allowed ${p.trunkVlans || 'all'})`).join('; '));
    return rows.join('\n');
  }
  wlan(lab, dev) {
    if (!dev.ssids?.length) {
      const w = dev.ports.filter(p => p.kind === 'wifi');
      return w.length ? w.map(p => `${p.name}: ${p.ssid ? 'joined SSID ' + p.ssid : 'no SSID'}`).join('\n') : '% No wireless interfaces.';
    }
    const cl = wifiClients(lab, dev);
    const rows = [pad('SSID', 22) + pad('VLAN', 6) + pad('Security', 12) + 'Clients',
      ...dev.ssids.map(s => pad(s.name, 22) + pad(s.vlan || 1, 6) + pad(s.security || 'wpa2', 12) + (cl.filter(c => c.port.ssid === s.name).map(c => c.dev.name).join(', ') || '-'))];
    const lost = cl.filter(c => ssidVlan(dev, c.port.ssid) === null);
    if (lost.length) rows.push('', 'Not associated: ' + lost.map(c => `${c.dev.name} (${c.port.ssid || 'no SSID'})`).join(', '));
    return rows.join('\n');
  }
  neighbors(lab, dev) {
    const rows = [pad('Local', 12) + pad('Neighbor', 20) + pad('Remote', 12) + 'Medium'];
    for (const l of lab.links) {
      let me, them;
      if (l.a.dev === dev.id) { me = l.a; them = l.b; } else if (l.b.dev === dev.id) { me = l.b; them = l.a; } else continue;
      const d = devById(lab, them.dev);
      rows.push(pad(portById(dev, me.port)?.name, 12) + pad(d?.name, 20) + pad(portById(d, them.port)?.name, 12) + l.medium);
    }
    return rows.length > 1 ? rows.join('\n') : 'No neighbors.';
  }
}

const HELP = `Exec:
  show running-config | startup-config | interfaces | ip interface brief
  show ip route | vlan | wlan | neighbors | services | inventory
  ping A.B.C.D        traceroute A.B.C.D
  write memory        (saves a startup-config snapshot)
  clear  configure terminal  end  exit
Global config:
  hostname NAME
  interface NAME      (vlanN = SVI, NAME.N = subinterface, loN, wgN, brN)
  no interface NAME   (virtual interfaces only)
  vlan N [name TEXT]  |  no vlan N
  ip route DEST MASK NEXTHOP|IFACE   (or DEST/NN)
  ip default-gateway A.B.C.D
  ip routing | no ip routing
  wlan ssid NAME [vlan N] [security wpa2|wpa3|open]   (access point)
  service NAME [PORT] | no service NAME
  set ATTRIBUTE VALUE | no set ATTRIBUTE
Interface config:
  ip address A.B.C.D/NN | A.B.C.D M.M.M.M | dhcp   (no ip address)
  shutdown | no shutdown       description TEXT
  switchport mode access|trunk|routed   (no switchport = routed)
  switchport access vlan N
  switchport trunk native vlan N
  switchport trunk allowed vlan 10,20-30|all
  encapsulation dot1q N   speed X   mac-address X
  ssid NAME | no ssid          (wifi client: join an SSID)
Abbreviations work: sh run, sh ip int br, int, conf t, no sh, wr`;
