// SPDX-License-Identifier: Apache-2.0
// App: the link tool. Pick a port on each device and connect them.
import { uid } from '../util.js';
import { devById, portById, linksOfPort, portIsFree, removePort, portFamily, makePort, LINKABLE, MULTI_LINK } from '../model.js';
import { toast, promptText, popup } from '../dialogs.js';

function autoMedium(a, b) {
  const k = new Set([a.kind, b.kind]);
  if (k.has('power')) return 'power';
  if (k.has('tunnel')) return 'tunnel';
  if (k.has('video')) return 'video';
  if (k.has('console') || k.has('usb')) return 'console';
  if (k.has('wifi')) return 'wireless';
  if (k.has('vport')) return 'virtual';
  if (k.has('sfp')) return 'fiber';
  return 'copper';
}

function nextPortName(d) { let n = d.ports.length; while (d.ports.some(p => p.name === 'eth' + n)) n++; return 'eth' + n; }

export class Linking {
  linkClick(devId, x, y) {
    const lab = this.lab, d = devById(lab, devId);
    if (this.linkStart && this.linkStart.dev === devId) { this.cancelLink(); return; }
    const choose = portId => {
      if (!this.linkStart) {
        this.linkStart = { dev: devId, port: portId };
        this.viewport.setLinkSource(devId);
        this.updateStatus();
      } else {
        const a = this.linkStart, b = { dev: devId, port: portId };
        const pa = portById(devById(lab, a.dev), a.port), pb = portById(d, portId);
        if (portFamily(pa) !== portFamily(pb)) { toast(`${portFamily(pa) === 'data' ? pb.kind : pa.kind} ports only connect to ${portFamily(pa) === 'data' ? pb.kind : pa.kind} ports`, 'err'); return; }
        const medium = this.linkMedium !== 'auto' ? this.linkMedium : autoMedium(pa, pb);
        lab.links.push({ id: uid('ln'), a, b, medium, label: '', notes: '' });
        if (pa.kind === 'wifi' && pb.kind === 'wifi') { // client joins the AP's first SSID if it has none yet
          const da = devById(lab, a.dev);
          const [apDev, client] = da.ssids?.length ? [da, pb] : (d.ssids?.length ? [d, pa] : []);
          if (apDev && !client.ssid) client.ssid = apDev.ssids[0].name;
        }
        this.linkStart = null; this.viewport.setLinkSource(null);
        this.commit(`Link ${d.name}`, 'all');
        toast(`Linked ${devById(lab, a.dev).name}:${pa.name} ↔ ${d.name}:${pb.name}`, 'ok', 1800);
      }
    };
    if (d.physicalOnly) { toast(`${d.name} is a room object: cables go to the devices in it`, 'warn'); return; }
    const ports = d.ports.filter(p => LINKABLE.has(p.kind));
    const free = ports.filter(p => portIsFree(lab, d, p));
    const items = [];
    if (free.length) items.push({ label: 'First free port', sub: free[0].name, cls: 'accent', onClick: () => choose(free[0].id) }, '-');
    for (const p of ports) {
      const used = linksOfPort(lab, d.id, p.id);
      const ok = portIsFree(lab, d, p);
      items.push({ label: p.name, sub: `${p.kind}${p.speed ? ' ' + p.speed : ''}${used.length ? (MULTI_LINK.has(p.kind) ? ` · ${used.length} peer(s)` : ' · in use') : ''}`, disabled: !ok, onClick: () => choose(p.id) });
    }
    items.push('-', { label: 'New port…', sub: 'add a port to this device', onClick: async () => {
      const name = await promptText('New port', `Port name on ${d.name}`, nextPortName(d));
      if (!name) return;
      const np = makePort({ name, kind: name.startsWith('wg') ? 'tunnel' : (name.startsWith('wl') ? 'wifi' : (d.virtual ? 'vport' : 'eth')), mode: d.l2 ? 'access' : 'routed' });
      d.ports.push(np); choose(np.id);
    } });
    popup(x, y, this.linkStart ? `To ${d.name}` : `From ${d.name}`, items);
  }
  cancelLink() { this.linkStart = null; this.viewport.setLinkSource(null); this.updateStatus(); }

  removePortRaw(dev, portId) { removePort(this.lab, dev, portId); }
}
