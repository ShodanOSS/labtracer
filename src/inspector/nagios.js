// Inspector: the Nagios section of the lab panel. Export the Nagios config generated from
// the lab (src/nagios.js), and compare it with what Nagios monitors (agent source "nagios").
import { h, download, safeName } from '../util.js';
import { isDeployed } from '../model.js';
import { modal, toast } from '../dialogs.js';
import { monitorHost } from '../monitor.js';
import { nagiosConfig, nagiosDrift, labNagiosConf } from '../nagios.js';

export class NagiosPanel {
  nagiosSection() {
    const app = this.app, lab = app.lab, m = app.monitor;
    const nc = labNagiosConf(lab);
    const servers = lab.devices.filter(d => isDeployed(d) && !d.physicalOnly && monitorHost(d)).sort((a, b) => a.name.localeCompare(b.name));
    const r = nagiosConfig(lab);
    const file = `labtracer-${safeName(app.labName)}.cfg`;
    const fromNagios = m.live && m.status?.source === 'nagios' ? nagiosDrift(lab, m.status.nagiosHosts || []) : null;
    return h('div', null,
      h('label', { class: 'fld' }, h('span', null, 'Nagios runs on'),
        h('select', { class: 'inp', 'data-k': 'nag-host', onchange: e => { lab.nagios = { ...nc, host: e.target.value }; this.commit('Nagios server', 'none'); } },
          h('option', { value: '' }, '(not set: no parents)'),
          servers.map(d => h('option', { value: d.id, selected: d.id === nc.host ? 'selected' : null }, d.name))),
        h('small', null, 'Host parents follow the cables from this device, so Nagios reports a device behind a failed switch as UNREACHABLE.')),
      h('p', { class: 'small' }, `${r.hosts.length} hosts, ${r.services} services`,
        r.unconnected.length ? h('span', { class: 'warn' }, ` · ${r.unconnected.length} not cabled to the Nagios server`) : null,
        r.skipped.length ? h('span', { class: 'muted' }, ` · ${r.skipped.length} skipped`) : null),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small', onclick: () => modal(file, h('div', null,
          r.skipped.length ? h('p', { class: 'muted small' }, 'Skipped: ' + r.skipped.map(s => `${s.name} (${s.why})`).join(', ')) : null,
          r.unconnected.length ? h('p', { class: 'warn small' }, 'Not cabled to the Nagios server in the lab: ' + r.unconnected.join(', ')) : null,
          h('pre', { class: 'mono-box tall' }, r.text)), [{ label: 'Close' }], { wide: true }) }, 'Preview'),
        h('button', { class: 'btn small primary', onclick: () => this.exportNagios(file) }, app.store.mode === 'server' ? 'Export' : 'Download')),
      fromNagios ? h('div', { class: 'small' },
        h('h4', null, 'Nagios vs the lab'),
        !fromNagios.missing.length && !fromNagios.extra.length ? h('p', { class: 'ok' }, 'Nagios monitors the same hosts as the lab.') : null,
        fromNagios.missing.length ? h('p', { class: 'warn' }, `Not in Nagios: ${fromNagios.missing.join(', ')}. Export and reload Nagios.`) : null,
        fromNagios.extra.length ? h('p', { class: 'muted' }, `In Nagios but not in the lab: ${fromNagios.extra.join(', ')}`) : null) : null,
      h('p', { class: 'muted small' }, 'Copy the file into a cfg_dir of Nagios, check it with "nagios -v", then reload Nagios. See agent/README.md to show Nagios results in LabTracer.'));
  }

  async exportNagios(file) {
    const app = this.app, text = nagiosConfig(app.lab).text;
    try {
      const r = await app.store.exportConfigs(app.labName, [{ device: 'nagios', name: file, content: text }]);
      if (r) { toast(`Wrote ${r.files[0] || file} (in ${r.folder})`, 'ok', 6000); return; }
    } catch (e) { toast('Export failed: ' + e.message, 'err'); return; }
    download(file, text);
  }
}
