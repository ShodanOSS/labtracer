// SPDX-License-Identifier: Apache-2.0
// Inspector, Console tab: the simulated IOS-style console and the SSH console form.
import { h, ap } from '../util.js';
import { monitorHost } from '../monitor.js';
import { SSH_DEFAULTS, sshConf } from '../sshterm.js';
import { PROTOCOLS, REMOTE_DEFAULTS, remoteConf, remoteHost, defaultPort } from '../remote.js';

export class ConsoleTab {
  tab_console(d, el) {
    const app = this.app;
    const mode = this.conMode.get(d.id) || (app.ssh.isOpen(d.id) ? 'ssh' : 'sim');
    const setMode = m => { this.conMode.set(d.id, m); this.render(); };
    ap(el, h('div', { class: 'seg con-mode' },
      h('button', { class: 'tb' + (mode === 'sim' ? ' on' : ''), title: 'IOS-style commands that edit the model', onclick: () => setMode('sim') }, 'Simulated'),
      h('button', { class: 'tb' + (mode === 'ssh' ? ' on' : ''), title: 'A real SSH session to the device', onclick: () => setMode('ssh') }, 'SSH' + (app.ssh.isOpen(d.id) ? ' ●' : '')),
      h('button', { class: 'tb' + (mode === 'remote' ? ' on' : ''), title: 'Remote desktop or terminal over Apache Guacamole (RDP, VNC, SSH, Telnet)', onclick: () => setMode('remote') }, 'Remote' + (app.remote.isOpen(d.id) ? ' ●' : ''))));
    if (mode === 'ssh') return this.sshConsole(d, el);
    if (mode === 'remote') return this.remoteForm(d, el);
    if (!this.term.has(d.id)) this.term.set(d.id, [{ c: 'muted', s: `${d.name} console. Type ? for help. Changes apply to the model at once.` }]);
    const buf = this.term.get(d.id);
    const hist = this.hist.get(d.id) || []; this.hist.set(d.id, hist);
    let hi = hist.length;
    const outEl = h('div', { class: 'term-out' }, buf.map(l => h('div', { class: l.c || '' }, l.s)));
    const input = h('input', { class: 'term-in', 'data-k': `term-${d.id}`, spellcheck: 'false', autocomplete: 'off' });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) input.value = hist[++hi]; else { hi = hist.length; input.value = ''; } }
      else if (e.key === 'Enter') {
        const cmd = input.value; input.value = '';
        if (cmd.trim()) { hist.push(cmd); if (hist.length > 200) hist.shift(); }
        buf.push({ c: 'cmd', s: app.cli.prompt(d) + ' ' + cmd });
        const r = app.cli.exec(d, cmd);
        if (r.clear) buf.length = 0;
        if (r.out) buf.push({ c: /^%/.test(r.out) ? 'err' : '', s: r.out });
        if (buf.length > 600) buf.splice(0, buf.length - 600);
        if (r.changed) app.commit('CLI: ' + cmd.trim(), r.renamed ? 'all' : { dev: d.id });
        else this.render();
        if (r.save) app.save();
        if (r.anim) app.animatePing(r.anim);
      }
    });
    const termBox = h('div', { class: 'term', onclick: e => { if (e.target === termBox || e.target === outEl) input.focus(); } },
      outEl, h('div', { class: 'term-line' }, h('span', { class: 'prompt' }, app.cli.prompt(d)), input));
    ap(el, termBox);
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) input.focus(); }, 0);
  }

  remoteForm(d, el) {
    const app = this.app, rm = app.remote;
    if (!rm.available) { ap(el, h('p', { class: 'muted small' }, 'Remote access needs server.py.')); return; }
    if (!d.remote) d.remote = { ...REMOTE_DEFAULTS }; // saved with the next change; holds no secrets
    Object.assign(d.remote, { ...REMOTE_DEFAULTS, ...d.remote });
    const c = remoteConf(d), S = { dev: d.id };
    const open = rm.isOpen(d.id);
    ap(el,
      h('div', { class: 'row2' },
        this.inp(d.remote, 'protocol', 'Protocol', S, { k: 'rem-proto', type: 'select', options: PROTOCOLS.map(([v, l]) => [v, l]) }),
        this.inp(d.remote, 'port', 'Port', S, { k: 'rem-port', type: 'number', min: 0, max: 65535, step: 1, empty: 0, ph: String(defaultPort(c.protocol)), hint: `0 = ${defaultPort(c.protocol)}` })),
      this.inp(d.remote, 'host', 'Host', S, { k: 'rem-host', mono: true, ph: remoteHost({ ...d, remote: { ...c, host: '' } }) || 'IP address or DNS name', hint: 'Empty = the SSH host, the monitor address or the first IP.' }),
      h('div', { class: 'row2' },
        this.inp(d.remote, 'user', 'User', S, { k: 'rem-user', mono: true }),
        c.protocol === 'rdp' ? this.inp(d.remote, 'domain', 'Domain', S, { k: 'rem-domain', mono: true }) : h('span')),
      c.protocol === 'rdp' ? h('div', { class: 'row2' },
        this.inp(d.remote, 'security', 'Security', S, { k: 'rem-sec', type: 'select', options: [['any', 'Negotiate'], ['nla', 'NLA'], ['tls', 'TLS'], ['rdp', 'RDP (legacy)'], ['vmconnect', 'Hyper-V console']] }),
        this.inp(d.remote, 'layout', 'Keyboard', S, { k: 'rem-layout', type: 'select', options: [['en-us-qwerty', 'English (US)'], ['en-gb-qwerty', 'English (UK)'], ['de-de-qwertz', 'German'], ['fr-fr-azerty', 'French'], ['es-es-qwerty', 'Spanish'], ['it-it-qwerty', 'Italian'], ['sv-se-qwerty', 'Swedish'], ['ja-jp-qwerty', 'Japanese'], ['failsafe', 'Failsafe (Unicode)']] })) : null,
      c.protocol === 'rdp' ? this.inp(d.remote, 'ignoreCert', 'Accept the server certificate without checking it (self-signed)', S, { type: 'check', k: 'rem-cert' }) : null,
      c.protocol === 'rdp' ? this.inp(d.remote, 'console', 'Connect to the console session (admin)', S, { type: 'check', k: 'rem-console' }) : null,
      this.inp(d.remote, 'readOnly', 'View only (no keyboard or mouse input)', S, { type: 'check', k: 'rem-ro' }),
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn small primary', onclick: () => rm.open(d) }, open ? 'Show window' : 'Connect'),
        open ? h('button', { class: 'btn small', onclick: () => rm.disconnect(d.id) }, 'Disconnect') : null),
      h('p', { class: 'muted small' }, 'Needs guacd (Apache Guacamole server daemon). Set its address in the lab panel (click empty space) › Remote access. The password is asked at each connect and never saved.'));
  }

  sshConsole(d, el) {
    const app = this.app, ssh = app.ssh;
    if (!d.ssh) d.ssh = { ...SSH_DEFAULTS }; // saved with the next change; holds no secrets
    Object.assign(d.ssh, { ...SSH_DEFAULTS, ...d.ssh });
    const c = sshConf(d), S = { dev: d.id };
    const def = app.settings.sshEngine || 'paramiko';
    const form = h('details', { class: 'ssh-form', open: ssh.isOpen(d.id) ? null : true },
      h('summary', null, `${c.user ? c.user + '@' : ''}${c.host || monitorHost(d) || '(no host)'}:${c.port || 22} · ${ssh.engineOf(d)}${c.auth === 'password' ? ' · password' : ''}${c.legacy ? ' · legacy' : ''}`),
      h('div', { class: 'row2' },
        this.inp(d.ssh, 'host', 'Host', S, { k: 'ssh-host', mono: true, ph: monitorHost(d) || 'IP address or DNS name', hint: 'Empty = the monitor address / first IP.' }),
        this.inp(d.ssh, 'port', 'Port', S, { k: 'ssh-port', type: 'number', min: 1, max: 65535, step: 1, empty: 22 })),
      h('div', { class: 'row2' },
        this.inp(d.ssh, 'user', 'User', S, { k: 'ssh-user', mono: true, ph: 'your local user name' }),
        this.inp(d.ssh, 'engine', 'Engine', S, { k: 'ssh-engine', type: 'select', options: [['', `Default (${def})`], ['paramiko', 'paramiko'], ['system', 'System ssh (OpenSSH)']] })),
      this.inp(d.ssh, 'keyFile', 'Key file (optional)', S, { k: 'ssh-key', mono: true, ph: '~/.ssh/id_ed25519', hint: 'A path on this PC. Empty = ssh-agent and the default keys in ~/.ssh.' }),
      this.inp(d.ssh, 'auth', 'Login', S, { k: 'ssh-auth', type: 'select', options: [['key', 'Key / ssh-agent (recommended)'], ['password', 'Password (not recommended)']] }),
      c.auth === 'password' ? h('div', { class: 'warn small' }, 'Password login is not recommended. Use it only for legacy devices without key-based login. LabTracer never stores the password: paramiko asks for it in a dialog, System ssh asks in the terminal.') : null,
      this.inp(d.ssh, 'legacy', 'Allow legacy algorithms (ssh-rsa, SHA-1 key exchange, CBC ciphers) for old devices', S, { type: 'check', k: 'ssh-legacy' }),
      c.legacy && ssh.engineOf(d) === 'paramiko' && ssh.caps && ssh.caps.paramiko && !ssh.caps.paramikoLegacy
        ? h('div', { class: 'warn small' }, `paramiko ${ssh.caps.paramikoVersion} has no legacy algorithms. Select the System ssh engine for this device.`) : null);
    const miss = ssh.missing(d);
    ap(el, form, miss ? h('div', { class: 'warn small' }, miss) : null, ssh.view(d));
    if (!ssh.caps && ssh.available) ssh.loadCaps().then(x => { if (x && ssh.missing(d)) this.render(); });
  }
}
