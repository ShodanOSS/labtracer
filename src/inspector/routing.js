// SPDX-License-Identifier: Apache-2.0
// Inspector, Routing and Services tabs: static routes, live routing table, ping test,
// VLAN database, wireless SSIDs, and the services that run on the device.
import { h, ap, clear, parseCIDR, ipToInt } from '../util.js';
import { wifiClients, NON_IP } from '../model.js';
import { routeTable, ping } from '../netsim.js';

const SECURITY = [['wpa2', 'WPA2-PSK'], ['wpa3', 'WPA3-SAE'], ['wpa2/3', 'WPA2/WPA3'], ['802.1x', 'WPA2/3 Enterprise'], ['open', 'Open']];

export class RoutingTab {
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
}
