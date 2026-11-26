// Inspector: properties of the selected link (cable), and moving either end.
import { h, ap } from '../util.js';
import { MEDIA } from '../templates.js';
import { devById, portById, linksOfPort, LINKABLE, MULTI_LINK, portIsFree, portFamily } from '../model.js';
import { toast } from '../dialogs.js';
import { MEDIUM_COLORS, CABLE_ROUTES } from '../viewport/cables.js';

const DASHED_MEDIA = new Set(['wireless', 'tunnel', 'virtual']);

export class LinkPanel {
  renderLink(l) {
    const app = this.app, lab = app.lab;
    const da = devById(lab, l.a.dev), db = devById(lab, l.b.dev);
    const pa = portById(da, l.a.port), pb = portById(db, l.b.port);
    const endSel = (end, dev, other) => {
      const curPort = portById(dev, end.port);
      const fits = (d, p) => portIsFree(lab, d, p) && portFamily(p) === portFamily(curPort);
      const devOpts = lab.devices.filter(x => !x.physicalOnly && x.id !== other.dev).sort((a, b) => a.name.localeCompare(b.name));
      const moveTo = id => {
        const nd = devById(lab, id);
        const free = nd.ports.find(p => fits(nd, p));
        if (!free) { toast(`${nd.name} has no free ${portFamily(curPort) === 'data' ? '' : curPort.kind + ' '}port. Add one in its Ports tab, then try again.`, 'err', 4000); this.render(); return; }
        const from = dev.name;
        end.dev = nd.id; end.port = free.id;
        this.commit(`Move cable from ${from} to ${nd.name}`, 'all');
        toast(`Cable moved to ${nd.name}:${free.name}. Pick another port below if needed.`, 'ok', 3000);
      };
      return h('div', { class: 'row2' },
        h('label', { class: 'fld' }, h('span', null, 'Device'),
          h('div', { class: 'btnrow tight' },
            h('select', { class: 'inp', 'data-k': 'endd-' + end.dev, title: 'Move this end of the cable to another device', onchange: e => moveTo(e.target.value) },
              devOpts.map(x => h('option', { value: x.id, selected: x.id === dev.id ? 'selected' : null }, x.name))),
            h('button', { class: 'mini', title: `Select ${dev.name}`, onclick: () => app.select({ type: 'device', id: dev.id }) }, '→'))),
        h('label', { class: 'fld' }, h('span', null, 'Port'), h('select', { class: 'inp', 'data-k': 'endp-' + end.dev, onchange: e => { end.port = e.target.value; this.commit('Move cable to another port', 'all'); } },
          dev.ports.filter(p => LINKABLE.has(p.kind)).map(p => {
            const used = !MULTI_LINK.has(p.kind) && linksOfPort(lab, dev.id, p.id).some(x => x.id !== l.id);
            return h('option', { value: p.id, selected: p.id === end.port ? 'selected' : null, disabled: used ? 'disabled' : null }, p.name + (used ? ' (in use)' : ''));
          }))));
    };
    const up = pa?.enabled && pb?.enabled;
    ap(this.el, 
      h('div', { class: 'insp-head' }, h('span', { class: 'swatch line', style: { background: l.color || MEDIUM_COLORS[l.medium] || '#999' } }),
        h('div', { class: 'grow' }, h('div', { class: 'title' }, `${da.name} ↔ ${db.name}`), h('div', { class: 'muted small' }, `${pa?.name} ↔ ${pb?.name} · ${up ? 'up' : 'down (a port is shut)'}`)),
        h('button', { class: 'icon-btn danger', title: 'Delete link (Del)', onclick: () => app.deleteSelection() }, '🗑')),
      h('div', { class: 'insp-body' },
        this.inp(l, 'medium', 'Medium', 'all', { type: 'select', options: MEDIA.filter(m => m[0] !== 'auto') }),
        this.inp(l, 'label', 'Label', 'all', { ph: 'e.g. trunk, DMZ, LACP-1' }),
        this.ssidPicker(da, pa, db, pb),
        DASHED_MEDIA.has(l.medium) ? null : h('div', { class: 'row2' },
          this.inp(l, 'route', 'Cable route (room view)', 'all', { type: 'select', options: [['', 'Lab default'], ...CABLE_ROUTES] }),
          h('label', { class: 'fld' }, h('span', null, 'Length'), h('span', { class: 'mono small' }, (len => len ? `≈ ${len.toFixed(1)} m as drawn` : 'open the room view')(app.viewport.cableLength(l.id))))),
        h('div', { class: 'row2' }, this.inp(l, 'color', 'Colour override', 'all', { type: 'color' }),
          h('label', { class: 'fld' }, h('span', null, ' '), h('button', { class: 'btn small', onclick: () => { delete l.color; this.commit('Reset colour', 'all'); } }, 'Use medium colour'))),
        h('p', { class: 'muted small' }, 'To move this cable, change the device or port on either end. The other end stays plugged in.'),
        h('h4', null, 'End A'), endSel(l.a, da, l.b),
        h('h4', null, 'End B'), endSel(l.b, db, l.a),
        this.inp(l, 'notes', 'Notes (cable ID, length, patch path…)', 'none', { type: 'area', rows: 3, trim: false })));
  }

  /** Wireless link between an AP with SSIDs and a client: pick the client's SSID here. */
  ssidPicker(da, pa, db, pb) {
    if (pa?.kind !== 'wifi' || pb?.kind !== 'wifi') return null;
    const [apDev, client] = da.ssids.length ? [da, pb] : (db.ssids.length ? [db, pa] : []);
    if (!apDev) return null;
    const opts = [['', '— not joined —'], ...apDev.ssids.map(s => [s.name, `${s.name} (VLAN ${s.vlan || 1})`])];
    if (client.ssid && !apDev.ssids.some(s => s.name === client.ssid)) opts.push([client.ssid, `${client.ssid} (not on ${apDev.name})`]);
    return this.inp(client, 'ssid', `SSID on ${apDev.name}`, 'all', { type: 'select', options: opts });
  }
}
