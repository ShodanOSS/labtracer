// SPDX-License-Identifier: Apache-2.0
// Viewport: mouse input. Picking, dragging devices, clicks for the place and link tools,
// drag and drop from the palette.
import * as THREE from 'three';
import { devById, isRack } from '../model.js';

export class Pointer {
  ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  pick(e) {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hits = this.ray.intersectObjects([this.devGroup, this.linkGroup], true);
    for (const h of hits) {
      if (h.object.isCSS2DObject) continue;
      let o = h.object;
      while (o && o.userData.devId === undefined && o.userData.linkId === undefined) o = o.parent;
      if (!o) continue;
      if (o.userData.devId !== undefined) return { type: 'device', id: o.userData.devId, point: h.point };
      if (o.userData.linkId !== undefined) return { type: 'link', id: o.userData.linkId, point: h.point };
    }
    return null;
  }
  ground(e, y = 0) {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    this.groundPlane.constant = -y;
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.groundPlane, p) ? p : null;
  }
  snap(v) {
    if (!this.app.settings.snap) return v;
    const step = this.mode === 'topo' ? 0.5 : 0.05;
    return Math.round(v / step) * step;
  }

  bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      this.down = { x: e.clientX, y: e.clientY };
      if (this.tool !== 'select') return;
      const hit = this.pick(e);
      if (hit && hit.type === 'device') {
        const lab = this.app.lab;
        let d = devById(lab, hit.id);
        if (this.mode === 'room' && d.phys.mount === 'rack' && d.phys.rackId) d = devById(lab, d.phys.rackId) || d;
        const g = this.ground(e);
        if (!g || this.app.settings.lockLayout) return;
        const pos = this.mode === 'topo' ? d.topo : d.phys;
        this.drag = { dev: d, clickId: hit.id, off: { x: pos.x - g.x, z: pos.z - g.z }, moved: false };
        this.controls.enabled = false;
        el.setPointerCapture(e.pointerId);
      }
    });
    el.addEventListener('pointermove', e => {
      if (this.drag) {
        if (!this.drag.moved && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 4) return;
        this.drag.moved = true;
        const g = this.ground(e); if (!g) return;
        const d = this.drag.dev, pos = this.mode === 'topo' ? d.topo : d.phys;
        pos.x = this.snap(g.x + this.drag.off.x); pos.z = this.snap(g.z + this.drag.off.z);
        const moved = this.drag.ids ||= new Set([d.id, ...(this.mode === 'room' && isRack(d) ? this.app.lab.devices.filter(x => x.phys.rackId === d.id).map(x => x.id) : [])]);
        for (const id of moved) { const x = id === d.id ? d : devById(this.app.lab, id); if (x) this.place(x); }
        this.refreshLinksOf(moved); this.updateSelBox(); this.requestRender();
        return;
      }
      if (this.tool === 'link' && this.linkFrom) {
        const a = this.anchor(this.linkFrom); const g = this.ground(e, a ? a.y : 0);
        if (a && g) { this.band.geometry.setFromPoints([a, g]); this.band.computeLineDistances(); this.band.visible = true; this.requestRender(); }
      }
      if (!this.hoverPending) {
        this.hoverPending = true;
        requestAnimationFrame(() => {
          this.hoverPending = false;
          const hit = this.pick(e);
          el.style.cursor = this.tool === 'place' ? 'copy' : (hit ? (this.tool === 'link' ? 'crosshair' : 'pointer') : (this.tool === 'link' ? 'crosshair' : 'default'));
        });
      }
    });
    el.addEventListener('pointerup', e => {
      if (e.button !== 0) return;
      const wasClick = this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 4;
      if (this.drag) {
        const dr = this.drag; this.drag = null; this.controls.enabled = true;
        if (dr.moved) { this.app.afterDrag(dr.dev); return; }
        this.app.select({ type: 'device', id: dr.clickId });
        return;
      }
      if (!wasClick) return;
      if (this.tool === 'place') { const g = this.ground(e); if (g) this.app.placeAt(g); return; }
      const hit = this.pick(e);
      if (this.tool === 'link') {
        if (hit && hit.type === 'device') this.app.linkClick(hit.id, e.clientX, e.clientY);
        else this.app.cancelLink();
        return;
      }
      this.app.select(hit ? { type: hit.type, id: hit.id } : null);
    });
    el.addEventListener('dblclick', e => {
      const hit = this.pick(e);
      if (hit && hit.type === 'device') this.app.openConsole(hit.id);
    });
    this.el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/x-labtracer-template')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.el.addEventListener('drop', e => {
      const tid = e.dataTransfer.getData('text/x-labtracer-template');
      if (!tid) return;
      e.preventDefault();
      const g = this.ground(e); if (g) this.app.placeTemplate(tid, g);
    });
  }

  setLinkSource(devId) { this.linkFrom = devId; if (!devId) { this.band.visible = false; this.requestRender(); } }
}
