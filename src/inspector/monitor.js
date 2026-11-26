// Inspector: the Monitor tab of a device, and the monitoring agent section of the lab panel.
import { h, ap, fmtTime } from '../util.js';
import { devById } from '../model.js';
import { ping } from '../netsim.js';
import { toast } from '../dialogs.js';
import { monitorConf, monitorHost, deviceChecks, sparkline } from '../monitor.js';

export class MonitorPanels {
  tab_monitor(d, el) {
    const m = this.app.monitor;
    const c = monitorConf(d);
    const set = (k, v) => { d.monitor = { ...monitorConf(d), [k]: v }; this.commit('Monitor settings', { dev: d.id }); };
    const chk = (k, label) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: c[k], 'data-k': 'mon-' + k, onchange: e => set(k, e.target.checked) }), label);
    const checks = deviceChecks(d);
    ap(el,
      chk('enabled', 'Monitor this device'),
      h('label', { class: 'fld' }, h('span', null, 'Address to check'),
        h('input', { class: 'inp mono', 'data-k': 'mon-host', value: c.host, placeholder: monitorHost({ ...d, monitor: { ...c, host: '' } }) || 'no IP on this device', onchange: e => set('host', e.target.value.trim()) }),
        h('small', null, 'Empty = first IP in the Ports tab. A DNS name also works.')),
      h('div', { class: 'row2' }, chk('ping', 'Ping'), chk('services', 'TCP connect to service ports')),
      h('h4', null, m.status?.source === 'nagios' ? `Checks in the Nagios export (${checks.length})` : `Checks sent to the agent (${checks.length})`),
      checks.length ? h('div', { class: 'mono-box' }, checks.map(x => x.type === 'ping' ? `ping  ${x.host}` : `tcp   ${x.host}:${x.port}  ${x.label || ''}`).join('\n'))
        : h('p', { class: 'muted small' }, c.enabled ? 'Nothing to check: add an IP address, or service ports in the Services tab (for example 22, 443, 8006/tcp). UDP ports are skipped.' : 'Monitoring is off for this device.'));
    ap(el, h('h4', null, 'Live status'));
    if (!m.available) { ap(el, h('p', { class: 'muted small' }, 'Live status needs server.py.')); return; }
    if (!m.live) { ap(el, h('p', { class: 'muted small' }, 'Live status is off. Click Live in the toolbar.')); return; }
    if (m.error) ap(el, h('div', { class: 'warn small' }, 'Agent: ' + m.error));
    if (m.status?.error) ap(el, h('div', { class: 'warn small' }, 'Agent: ' + m.status.error));
    const nagios = m.status?.source === 'nagios';
    if (nagios) ap(el, h('p', { class: 'muted small' }, 'The agent shows the results of Nagios (Nagios runs the checks, not the agent).'));
    const st = m.device(d.id);
    if (!st) { ap(el, h('p', { class: 'muted small' }, 'No result yet. The agent gets new targets a few seconds after a change.')); return; }
    const state = m.states().get(d.id) || st.state;
    ap(el,
      h('div', { class: 'stline' }, h('span', { class: 'stbadge st-' + state }, state),
        st.nagiosState ? h('span', { class: 'small' + (st.nagiosState === 'UP' ? ' ok' : st.nagiosState === 'DOWN' ? ' err' : ' warn') }, `Nagios: ${st.nagiosState}`) : null,
        h('span', { class: 'muted small' }, `since ${fmtTime(st.since * 1000)}`)),
      st.nagiosState === 'UNREACHABLE' ? h('p', { class: 'muted small' }, 'UNREACHABLE: a parent of this host is down, so Nagios can not tell whether this host is up.') : null,
      h('div', { class: 'checks' }, st.checks.map(x => h('div', { class: 'chkrow' + (x.ok ? '' : ' bad'), title: x.output || '' },
        h('span', { class: 'dot' }), h('span', { class: 'mono' }, x.type === 'ping' ? `ping ${x.host}` : x.type === 'nagios' ? x.label : `${x.host}:${x.port}`),
        h('span', { class: 'muted' }, x.type === 'nagios' ? (x.state || '') : (x.label || '')),
        h('span', { class: 'mono' }, x.ok ? (x.ms === null || x.ms === undefined ? 'OK' : `${x.ms} ms`) : x.err)))),
      h('h4', null, `Last ${st.history.length} runs`),
      h('div', { class: 'spark', html: sparkline(st.history) || '<span class="muted small">Needs two runs.</span>' }));
  }

  monitorSection() {
    const app = this.app, m = app.monitor;
    if (!m.available) return h('p', { class: 'muted small' }, 'Live status needs server.py. It is not available when index.html is opened directly.');
    const url = h('input', { class: 'inp mono', 'data-k': 'mon-url', value: m.config.agentUrl || '', placeholder: 'http://192.168.10.10:8766' });
    const tok = h('input', { class: 'inp mono', 'data-k': 'mon-tok', type: 'password', autocomplete: 'off', placeholder: m.config.hasToken ? 'saved (leave empty to keep)' : 'paste the agent token' });
    const ca = h('input', { class: 'inp mono', 'data-k': 'mon-ca', value: m.config.cafile || '', placeholder: 'optional: path to your CA .pem (HTTPS)' });
    const insecure = h('input', { type: 'checkbox', checked: m.config.insecure });
    const save = async () => {
      const body = { agentUrl: url.value.trim(), cafile: ca.value.trim(), insecure: insecure.checked };
      if (tok.value.trim()) body.token = tok.value.trim();
      await m.saveConfig(body); tok.value = '';
    };
    const st = m.status;
    const counts = { up: 0, degraded: 0, down: 0, unknown: 0 };
    for (const v of m.states().values()) counts[v] = (counts[v] || 0) + 1;
    const bad = [...m.states()].filter(([, v]) => v === 'down' || v === 'degraded');
    return h('div', null,
      h('label', { class: 'fld' }, h('span', null, 'Agent address'), url),
      h('div', { class: 'row2' }, h('label', { class: 'fld' }, h('span', null, 'Token'), tok), h('label', { class: 'fld' }, h('span', null, 'CA file (HTTPS)'), ca)),
      h('label', { class: 'chk' }, insecure, 'Skip TLS certificate check (not recommended)'),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small', onclick: async () => { try { await save(); toast('Agent settings saved', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Save'),
        h('button', { class: 'btn small', onclick: async () => {
          try { await save(); const r = await fetch('/api/monitor/status', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); toast(`Connected: ${j.host}, agent ${j.version}, ${j.targets} target(s), every ${j.interval}s`, 'ok', 4000); }
          catch (e) { toast('Test failed: ' + e.message, 'err', 5000); }
        } }, 'Test'),
        h('button', { class: 'btn small', onclick: async () => { try { await save(); await m.push(); } catch (e) { toast('Push failed: ' + e.message, 'err', 5000); } } }, 'Send targets'),
        h('button', { class: 'btn small' + (m.live ? '' : ' primary'), onclick: () => app.toggleLive() }, m.live ? 'Stop live' : 'Start live')),
      m.error ? h('div', { class: 'warn small' }, 'Agent: ' + m.error) : null,
      m.live && m.status?.error ? h('div', { class: 'warn small' }, 'Agent: ' + m.status.error) : null,
      m.live && m.status?.source === 'nagios' ? h('p', { class: 'muted small' }, `Results from Nagios (${(m.status.nagiosHosts || []).length} hosts in Nagios).`) : null,
      m.live && st ? h('div', null,
        h('p', { class: 'small' }, h('span', { class: 'ok' }, `${counts.up} up`), ' · ', h('span', { class: 'warn' }, `${counts.degraded} degraded`), ' · ', h('span', { class: 'err' }, `${counts.down} down`),
          h('span', { class: 'muted' }, ` · agent ${st.host}, last run ${st.generated ? new Date(st.generated * 1000).toLocaleTimeString() : 'never'}`)),
        bad.length ? h('div', { class: 'chips' }, bad.map(([id, v]) => { const d = devById(app.lab, id); return d ? h('span', { class: 'chip st-' + v }, h('button', { class: 'chip-name', onclick: () => { this.tab = 'monitor'; app.select({ type: 'device', id }); } }, d.name)) : null; })) : null) : null,
      h('p', { class: 'muted small' }, 'The agent pings each device and connects to TCP service ports. See agent/README.md to install it.'));
  }
}
