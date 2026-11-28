// SPDX-License-Identifier: Apache-2.0
// Inspector, Ports tab: the port table, port details, add and remove ports.
import { h, ap, parseCIDR } from '../util.js';
import { PORT_KINDS } from '../templates.js';
import { linksOfPort, otherEnd, endLabel, makePort, LINKABLE, NON_IP } from '../model.js';

const VIRTUAL_KINDS = new Set(['svi', 'sub', 'loop', 'tunnel']);

export class PortsTab {
  tab_ports(d, el) {
    const app = this.app, lab = app.lab, S = { dev: d.id };
    const L2 = d.l2;
    const table = h('div', { class: 'ports' + (L2 ? ' l2' : '') });
    ap(table, h('div', { class: 'prow head' }, h('span'), h('span', null, 'Name'), h('span', null, 'IP / CIDR'),
      L2 ? h('span', null, 'Mode') : null, L2 ? h('span', null, 'VLAN') : null, h('span', null, 'On'), h('span', null, 'Link')));
    for (const p of d.ports) {
      const links = linksOfPort(lab, d.id, p.id);
      const open = this.expanded.has(p.id);
      const virtual = VIRTUAL_KINDS.has(p.kind);
      const showsMode = L2 && LINKABLE.has(p.kind) && !NON_IP.has(p.kind) && p.kind !== 'tunnel';
      const linkCell = links.length
        ? h('button', { class: 'linkchip', title: links.map(l => endLabel(lab, otherEnd(l, d.id, p.id))).join('\n'), onclick: () => app.select({ type: 'link', id: links[0].id }) },
          links.length > 1 ? `${links.length} peers` : endLabel(lab, otherEnd(links[0], d.id, p.id)))
        : h('span', { class: 'muted small' }, LINKABLE.has(p.kind) ? '—' : 'virtual');
      ap(table, h('div', { class: 'prow' + (p.enabled ? '' : ' off') },
        h('button', { class: 'mini', title: 'More', onclick: () => { open ? this.expanded.delete(p.id) : this.expanded.add(p.id); this.render(); } }, open ? '▾' : '▸'),
        this.inp(p, 'name', null, S, { k: `pn-${p.id}`, after: (v, old) => { for (const r of d.routes) if (r.dev === old) r.dev = v; }, title: `${p.kind}${p.speed ? ' · ' + p.speed : ''}${p.ssid ? ' · SSID ' + p.ssid : ''}${p.desc ? ' · ' + p.desc : ''}` }),
        NON_IP.has(p.kind) ? h('span', { class: 'muted small' }, p.kind) :
          this.inp(p, 'ip', null, 'all', { k: `pi-${p.id}`, ph: 'none', mono: true, validate: v => v && v !== 'dhcp' && !parseCIDR(v) ? `"${v}" is not A.B.C.D/NN` : '' }),
        L2 ? (showsMode ? this.inp(p, 'mode', null, S, { k: `pm-${p.id}`, type: 'select', options: [['access', 'access'], ['trunk', 'trunk'], ['routed', 'routed']] }) : h('span', { class: 'muted small' }, p.kind)) : null,
        L2 ? (p.kind === 'wifi' && d.ssids.length ? h('span', { class: 'muted small', title: 'Clients get the VLAN of their SSID (Routing tab)' }, 'per SSID')
          : showsMode && p.mode === 'access' ? this.inp(p, 'vlan', null, S, { k: `pv-${p.id}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 })
          : showsMode && p.mode === 'trunk' ? h('button', { class: 'linkchip', title: `native ${p.nativeVlan || 1}, allowed ${p.trunkVlans || 'all'} (click to edit)`, onclick: () => { this.expanded.add(p.id); this.render(); } }, `${p.nativeVlan || 1}/${p.trunkVlans || 'all'}`)
            : (p.kind === 'svi' || p.kind === 'sub') ? h('span', { class: 'muted small' }, `v${p.vlan}`) : h('span')) : null,
        this.inp(p, 'enabled', null, { dev: d.id }, { k: `pe-${p.id}`, type: 'check', title: 'Admin up' }),
        linkCell));
      if (open) {
        ap(table, h('div', { class: 'pdetail' },
          h('div', { class: 'row4' },
            this.inp(p, 'kind', 'Kind', S, { k: `pk-${p.id}`, type: 'select', options: PORT_KINDS.map(k => [k, k]) }),
            this.inp(p, 'desc', 'Description', 'none', { k: `pd-${p.id}` }),
            this.inp(p, 'speed', 'Speed', 'none', { k: `ps-${p.id}` }),
            this.inp(p, 'mac', 'MAC', 'none', { k: `pmac-${p.id}`, mono: true })),
          showsMode && p.mode === 'trunk' ? h('div', { class: 'row2' },
            this.inp(p, 'nativeVlan', 'Native VLAN', S, { k: `pnv-${p.id}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 }),
            this.inp(p, 'trunkVlans', 'Allowed VLANs', S, { k: `pat-${p.id}`, ph: 'all or 10,20-30', mono: true })) : null,
          p.kind === 'svi' || p.kind === 'sub' ? h('div', { class: 'row2' },
            this.inp(p, 'vlan', p.kind === 'svi' ? 'VLAN (SVI / bridge)' : '802.1Q tag', 'all', { k: `pvv-${p.id}`, type: 'number', min: 1, max: 4094, step: 1, empty: 1 }),
            p.kind === 'sub' ? this.inp(p, 'parent', 'Parent port', 'all', { k: `ppar-${p.id}`, type: 'select', options: [['', '—'], ...d.ports.filter(x => !VIRTUAL_KINDS.has(x.kind) && x.id !== p.id).map(x => [x.id, x.name])] }) : h('span')) : null,
          p.kind === 'wifi' && !d.ssids.length ? h('div', { class: 'row2' },
            this.inp(p, 'ssid', 'Joins SSID', 'all', { k: `pssid-${p.id}`, ph: 'SSID name', list: 'ssid-list' }), h('span')) : null,
          h('div', { class: 'btnrow' },
            links.length ? h('button', { class: 'btn small', onclick: () => { app.lab.links = app.lab.links.filter(l => !links.includes(l)); this.commit('Disconnect', 'all'); } }, 'Disconnect') : null,
            h('button', { class: 'btn small danger', onclick: () => { app.removePortRaw(d, p.id); this.commit('Remove port', 'all'); } }, 'Remove port'))));
      }
    }
    const kindSel = h('select', { class: 'inp', 'data-k': 'newkind' }, PORT_KINDS.map(k => h('option', { value: k }, k)));
    const ssidList = h('datalist', { id: 'ssid-list' }, [...new Set(lab.devices.flatMap(x => x.ssids.map(s => s.name)))].map(n => h('option', { value: n })));
    ap(el, table, ssidList, h('div', { class: 'btnrow' }, kindSel,
      h('button', { class: 'btn small', onclick: () => {
        const kind = kindSel.value;
        const base = { eth: 'eth', sfp: 'sfp', wifi: 'wlan', vport: 'veth', tunnel: 'wg', svi: 'vlan', sub: 'sub', loop: 'lo', console: 'con', usb: 'usb', video: 'hdmi', power: 'psu' }[kind];
        let n = 0; while (d.ports.some(p => p.name === base + n)) n++;
        const np = makePort({ name: base + n, kind, mode: d.l2 ? 'access' : 'routed' });
        if (kind === 'sub') { const par = d.ports.find(x => !VIRTUAL_KINDS.has(x.kind)); np.parent = par?.id || null; np.vlan = 10; np.name = (par?.name || 'eth0') + '.10'; }
        d.ports.push(np); this.expanded.add(np.id); this.commit('Add port', { dev: d.id });
      } }, '+ Add port')),
      h('p', { class: 'muted small' }, L2
        ? 'This device bridges: access ports carry one VLAN, trunks carry tagged VLANs. Use an svi port (VLAN interface) for its own IP.'
        : 'IP format: 192.168.10.10/24. Turn on "Bridges L2" in General to get switchport modes and VLANs.'));
  }
}
