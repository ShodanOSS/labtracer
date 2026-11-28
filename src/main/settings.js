// SPDX-License-Identifier: Apache-2.0
// App: the Settings dialog and the toolbar toggles that share its values.
import { h } from '../util.js';
import { store } from '../store.js';
import { modal } from '../dialogs.js';

export const DEFAULT_SETTINGS = {
  antialias: true, pixelCap: 1.25, labels: true, portLabels: true, cables: true, powerLinks: true,
  rackLabels: false, snap: true, autosave: true, lockLayout: false, portAnchors: true, gridColor: '#2b4a35', bgColor: '#0c130e',
  sshEngine: 'paramiko', showStored: false,
};

export class SettingsUi {
  settingsDialog() {
    const s = this.settings;
    const chk = (k, label, hint) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s[k], onchange: e => { s[k] = e.target.checked; this.applySettings(); } }), label, hint ? h('small', { class: 'muted' }, ' ' + hint) : null);
    modal('Settings', h('div', { class: 'settings' },
      h('h4', null, 'Performance'),
      chk('antialias', 'Smooth edges (antialiasing)', 'needs reload; turn off on slow PCs'),
      h('label', { class: 'fld' }, h('span', null, 'Render resolution cap'), h('select', { class: 'inp', onchange: e => { s.pixelCap = +e.target.value; this.applySettings(); } },
        [[0.75, '0.75× (fastest)'], [1, '1×'], [1.25, '1.25× (default)'], [1.5, '1.5×'], [2, '2× (sharpest)']].map(([v, l]) => h('option', { value: v, selected: s.pixelCap === v ? 'selected' : null }, l))), h('small', null, 'needs reload')),
      h('h4', null, 'Display'),
      h('div', { class: 'row2' },
        h('label', { class: 'fld' }, h('span', null, 'Grid colour'), h('div', { class: 'btnrow tight' },
          h('input', { class: 'inp color', type: 'color', value: s.gridColor, oninput: e => { s.gridColor = e.target.value; this.applyColors(); } }),
          h('button', { class: 'btn small', onclick: e => { s.gridColor = DEFAULT_SETTINGS.gridColor; e.target.previousSibling.value = s.gridColor; this.applyColors(); } }, 'Reset'))),
        h('label', { class: 'fld' }, h('span', null, '3D background'), h('div', { class: 'btnrow tight' },
          h('input', { class: 'inp color', type: 'color', value: s.bgColor, oninput: e => { s.bgColor = e.target.value; this.applyColors(); } }),
          h('button', { class: 'btn small', onclick: e => { s.bgColor = DEFAULT_SETTINGS.bgColor; e.target.previousSibling.value = s.bgColor; this.applyColors(); } }, 'Reset')))),
      chk('labels', 'Device labels'), chk('portLabels', 'Port names on links (topology)'), chk('powerLinks', 'Power links (topology)'),
      chk('cables', 'Cables (room)'), chk('portAnchors', 'Cables plug into their real port position', 'off = cables meet at the device centre'), chk('rackLabels', 'Labels for rack-mounted devices (room)'),
      chk('showStored', 'Show spare, on-order and retired items in the 3D views', 'off = they are only in the inventory'),
      h('h4', null, 'Editing'),
      chk('snap', 'Snap to grid'), chk('lockLayout', 'Lock layout (no dragging)'),
      chk('autosave', 'Autosave every 30 s', store.mode === 'server' ? '' : '(server mode only)'),
      h('h4', null, 'SSH console'),
      h('label', { class: 'fld' }, h('span', null, 'Default SSH engine'), h('select', { class: 'inp', onchange: e => { s.sshEngine = e.target.value; store.setPref('settings', s); } },
        [['paramiko', 'paramiko (pip install paramiko)'], ['system', 'System ssh (OpenSSH; uses ~/.ssh/config)']].map(([v, l]) => h('option', { value: v, selected: s.sshEngine === v ? 'selected' : null }, l))),
        h('small', null, 'A device can override this in its Console tab.'))),
    [{ label: 'Reload now', onClick: () => { location.reload(); } }, { label: 'Done', primary: true }]);
  }
  applySettings() {
    store.setPref('settings', this.settings);
    this.syncToggles();
    this.viewport.rebuildAll();
  }
  applyColors() {
    store.setPref('settings', this.settings);
    this.viewport.rebuildEnv();
  }
  syncToggles() {
    const map = { 'tg-labels': 'labels', 'tg-ports': 'portLabels', 'tg-cables': 'cables', 'tg-snap': 'snap' };
    for (const [id, k] of Object.entries(map)) document.getElementById(id)?.classList.toggle('on', !!this.settings[k]);
  }
}
