// SPDX-License-Identifier: Apache-2.0
// Side panels: the device library (left) and the properties panel (right).
// The splitter between a panel and the view: drag to resize, click to hide or show.
// Keys: [ and ] toggle the panels. A focused splitter: Enter or Space toggles, arrows resize.
// The layout is kept in the browser (preference "panels").

const MIN = 150;           // narrowest panel, px
const HIDE_BELOW = 90;     // dragging a panel narrower than this hides it
const VIEW_MIN = 260;      // the 3D view keeps at least this width
const STEP = 24;           // arrow keys resize by this much
const SIDES = {
  left: { panel: 'palette', prop: '--lw', name: 'device library' },
  right: { panel: 'inspector', prop: '--rw', name: 'properties panel' },
};

export class Panels {
  constructor(main, store) {
    this.main = main; this.store = store;
    const saved = store.getPref('panels', {}) || {};
    this.state = {};
    for (const side of Object.keys(SIDES)) {
      const s = saved[side] || {};
      this.state[side] = { w: Number.isFinite(s.w) && s.w >= MIN ? s.w : null, off: !!s.off }; // w null: the default width
      this.bind(side);
    }
    this.apply();
  }

  splitter(side) { return this.main.querySelector(`.split[data-side="${side}"]`); }
  panel(side) { return document.getElementById(SIDES[side].panel); }
  isOpen(side) { return !this.state[side].off; }
  width(side) { return this.state[side].off ? 0 : this.panel(side).getBoundingClientRect().width; }

  /** Show (on = true), hide (false) or toggle (undefined) a panel. */
  toggle(side, on) {
    const st = this.state[side];
    const off = on === undefined ? !st.off : !on;
    if (off === st.off) return;
    st.off = off;
    this.apply(); this.save();
  }
  show(side) { this.toggle(side, true); }

  /** Set a width in px (clamped). Below HIDE_BELOW the panel hides; its last width is kept. */
  resize(side, w) {
    const st = this.state[side];
    st.off = w < HIDE_BELOW;
    if (!st.off) st.w = Math.round(Math.max(MIN, Math.min(w, this.maxWidth(side))));
    this.apply();
  }
  maxWidth(side) {
    const other = side === 'left' ? 'right' : 'left';
    return Math.max(MIN, window.innerWidth - this.width(other) - VIEW_MIN - 30);
  }

  apply() {
    for (const [side, cfg] of Object.entries(SIDES)) {
      const st = this.state[side], sp = this.splitter(side);
      this.main.classList.toggle(`${side}-off`, st.off);
      // an inline width would beat the "hidden" rule, so only set it while the panel is open
      if (st.w && !st.off) this.main.style.setProperty(cfg.prop, st.w + 'px'); else this.main.style.removeProperty(cfg.prop);
      sp.title = st.off ? `Show the ${cfg.name} (click, or ${side === 'left' ? '[' : ']'})` : `Drag to resize the ${cfg.name}. Click to hide it (${side === 'left' ? '[' : ']'}).`;
      sp.setAttribute('aria-expanded', String(!st.off));
      sp.setAttribute('aria-label', cfg.name);
      this.panel(side).inert = st.off; // no focus or tabbing into a hidden panel
    }
  }
  save() { this.store.setPref('panels', this.state); }

  bind(side) {
    const sp = this.splitter(side), sign = side === 'left' ? 1 : -1;
    sp.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      sp.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w0 = this.width(side);
      let moved = false;
      const move = ev => {
        const dx = ev.clientX - x0;
        if (!moved && Math.abs(dx) < 4) return; // a click, so far
        if (!moved) { moved = true; sp.classList.add('drag'); document.body.classList.add('resizing'); }
        this.resize(side, w0 + sign * dx);
      };
      const end = ev => {
        sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', end); sp.removeEventListener('pointercancel', end);
        if (sp.hasPointerCapture(ev.pointerId)) sp.releasePointerCapture(ev.pointerId);
        sp.classList.remove('drag'); document.body.classList.remove('resizing');
        if (moved) this.save();
        else if (ev.type === 'pointerup') this.toggle(side);
      };
      sp.addEventListener('pointermove', move);
      sp.addEventListener('pointerup', end);
      sp.addEventListener('pointercancel', end);
    });
    sp.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(side); return; }
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      if (this.state[side].off) { if (dir * sign > 0) this.show(side); return; } // a hidden panel opens at its last width
      this.resize(side, this.width(side) + dir * sign * STEP);
      this.save();
    });
  }
}
