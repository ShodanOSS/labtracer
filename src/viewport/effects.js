// SPDX-License-Identifier: Apache-2.0
// Viewport: live status rings and labels, the ping packet animation, failure flashes.
import * as THREE from 'three';
import { devById } from '../model.js';

const smat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
const STATUS_MATS = { up: smat(0x38e07a), degraded: smat(0xffb347), down: smat(0xff5c5c), unknown: smat(0x6b7686) };

export class Effects {
  applyStatus(map) {
    this.statusMap = map || new Map();
    for (const id of this.objs.keys()) this.setStatus(id);
    this.requestRender();
  }
  /** Drift badges on labels: map device id -> {error, warn, info}. */
  applyDrift(map) {
    this.driftMap = map || new Map();
    for (const id of this.objs.keys()) this.setStatus(id);
    this.requestRender();
  }
  setStatus(id) {
    const o = this.objs.get(id); if (!o) return;
    const st = this.statusMap.get(id);
    const el = o.label.element;
    for (const c of ['st-up', 'st-down', 'st-degraded', 'st-unknown']) el.classList.remove(c);
    if (st) el.classList.add('st-' + st);
    const dr = this.driftMap?.get(id);
    const n = dr ? dr.error + dr.warn : 0;
    el.classList.toggle('drift-err', !!dr?.error); el.classList.toggle('drift-warn', !dr?.error && !!dr?.warn);
    if (n) el.setAttribute('data-drift', `Δ${n}`); else el.removeAttribute('data-drift');
    if (o.ring) { o.root.remove(o.ring); o.ring.geometry.dispose(); o.ring = null; }
    const d = devById(this.app.lab, id);
    if (!st || !d || (this.mode === 'room' && d.phys.mount === 'rack')) return;
    const r = Math.max(d.dims.w, d.dims.d) * o.scale * 0.62 + (this.mode === 'topo' ? 0.08 : 0.02);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + (this.mode === 'topo' ? 0.09 : 0.025), 40), STATUS_MATS[st] || STATUS_MATS.unknown);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
    ring.raycast = () => {}; ring.userData.ownGeometry = true;
    o.root.add(ring); o.ring = ring;
  }

  animatePacket(steps, ok, onDone) {
    const segs = steps.map(([lid, from]) => {
      const lo = this.linkObjs.get(lid); const l = this.app.lab.links.find(x => x.id === lid);
      if (!lo || !l) return null;
      return { curve: lo.curve, rev: l.a.dev !== from };
    }).filter(Boolean);
    if (this.anim) { this.fx.remove(this.anim.mesh); }
    const size = this.mode === 'topo' ? 0.16 : 0.04;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color: ok ? 0x5cff9d : 0xff5c5c }));
    mesh.userData.ownGeometry = true;
    this.fx.add(mesh);
    const per = 380; const total = Math.max(1, segs.length) * per;
    const start = performance.now();
    const anim = this.anim = { mesh };
    const tick = now => {
      if (this.anim !== anim) return;
      const t = Math.max(0, now - start);
      if (segs.length) {
        const i = Math.min(segs.length - 1, Math.floor(t / per));
        let f = Math.min(1, (t - i * per) / per); if (segs[i].rev) f = 1 - f;
        mesh.position.copy(segs[i].curve.getPoint(f));
      } else mesh.visible = false;
      this.render();
      if (t < total) requestAnimationFrame(tick);
      else setTimeout(() => { if (this.anim === anim) { this.fx.remove(mesh); mesh.geometry.dispose(); this.anim = null; this.requestRender(); onDone && onDone(); } }, ok ? 250 : 900);
    };
    requestAnimationFrame(tick);
  }

  flashDevice(id, cls = 'fail') {
    const o = this.objs.get(id); if (!o) return;
    o.label.element.classList.add(cls);
    setTimeout(() => o.label.element.classList.remove(cls), 2200);
  }
}
