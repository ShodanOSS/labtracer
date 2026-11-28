// SPDX-License-Identifier: Apache-2.0
// Three.js viewport with two modes: logical topology and physical room.
// Renders on demand only (no idle GPU/CPU use).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildModel, disposeTree, topoScale, RACK_U } from './models3d.js';
import { devById, linkedPortIds, showsInTopology, showsInRoom, deviceRoomId, isRack, isFurniture, isDeployed } from './model.js';
import { parseCIDR, esc, mixin } from './util.js';
import { Environment } from './viewport/environment.js';
import { Cables } from './viewport/cables.js';
import { Effects } from './viewport/effects.js';
import { Pointer } from './viewport/pointer.js';

export class Viewport {
  constructor(container, app) {
    this.app = app;
    this.el = container;
    this.mode = 'topo';
    this.tool = 'select';
    this.objs = new Map();
    this.layouts = new Map();
    this.statusMap = new Map();
    this.linkObjs = new Map();
    this.camState = {};
    this.selection = null;
    this.pending = false;

    const s = app.settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: !!s.antialias, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelCap || 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    // zIndex 1: its own stacking context, so the per-label z-indexes of CSS2DRenderer stay inside it
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1' });
    this.labels.domElement.classList.add('lbl-layer');
    container.appendChild(this.labels.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(app.settings.bgColor || '#0c130e');
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.02, 600);
    this.camera.position.set(10, 12, 16);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.addEventListener('change', () => this.requestRender());

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x354a3b, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(6, 12, 8); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc8f0d6, 0.5); fill.position.set(-8, 5, -6); this.scene.add(fill);

    this.env = new THREE.Group(); this.devGroup = new THREE.Group(); this.linkGroup = new THREE.Group(); this.fx = new THREE.Group();
    this.scene.add(this.env, this.devGroup, this.linkGroup, this.fx);

    this.selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffc857);
    this.selBox.visible = false; this.fx.add(this.selBox);
    this.band = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0xffc857, dashSize: 0.2, gapSize: 0.12 }));
    this.band.visible = false; this.fx.add(this.band);

    this.ray = new THREE.Raycaster();
    this.ray.params.Line.threshold = 0.12;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    new ResizeObserver(() => this.resize()).observe(container);
    this.bindPointer();
    this.resize();
  }

  // ---------------------------------------------------------------- render loop
  requestRender() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.render(); });
  }
  render() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h); this.labels.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  // ---------------------------------------------------------------- modes
  setMode(mode) {
    this.camState[this.mode] = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.mode = mode;
    this.rebuildAll();
    const st = this.camState[mode];
    if (st) { this.camera.position.copy(st.pos); this.controls.target.copy(st.target); this.controls.update(); }
    else this.fit();
  }

  visible(d) {
    if (!isDeployed(d) && !this.app.settings.showStored) return false; // spare, on order, retired: inventory only
    if (this.mode === 'topo') return showsInTopology(d);
    return showsInRoom(d) && deviceRoomId(this.app.lab, d) === this.app.roomId;
  }

  // ---------------------------------------------------------------- build
  clearGroup(g) {
    for (const c of [...g.children]) this.dropObject(g, c);
  }
  /** Remove one object from a group and free its GPU data and label elements. */
  dropObject(g, c) {
    g.remove(c); disposeTree(c); c.traverse(o => { if (o.isCSS2DObject) o.element.remove(); });
  }
  rebuildAll() {
    this.clearGroup(this.env); this.clearGroup(this.devGroup); this.clearGroup(this.linkGroup);
    this.objs.clear(); this.linkObjs.clear();
    this.buildEnv();
    this.layouts = new Map();
    for (const d of this.app.lab.devices) if (this.visible(d)) this.addDevice(d);
    this.scene.updateMatrixWorld(true);
    for (const l of this.app.lab.links) this.addLink(l);
    this.setSelection(this.selection);
    this.requestRender();
  }

  /** Many custom models can finish loading at once: refresh their cables once per frame, not once per model. */
  asyncModelReady(id) {
    (this.asyncIds ||= new Set()).add(id);
    if (this.asyncPending) return;
    this.asyncPending = true;
    requestAnimationFrame(() => {
      const ids = this.asyncIds; this.asyncIds = null; this.asyncPending = false;
      this.updateSelBox(); this.refreshLinksOf(ids);
    });
  }

  makeLabel(html, cls = 'lbl') {
    const div = document.createElement('div'); div.className = cls; div.innerHTML = html;
    return new CSS2DObject(div);
  }

  deviceLabelHtml(d) {
    const ips = d.ports.filter(p => p.ip && p.enabled && parseCIDR(p.ip)).map(p => p.ip.split('/')[0]);
    const ip = ips.length ? `<span>${esc(ips[0])}${ips.length > 1 ? ' +' + (ips.length - 1) : ''}</span>` : '';
    return `<b>${esc(d.name)}</b>${this.mode === 'topo' ? ip : ''}`;
  }

  addDevice(d) {
    const lab = this.app.lab;
    const root = new THREE.Group();
    root.userData.devId = d.id;
    const model = buildModel(d, this.app.library.get(d.templateId), linkedPortIds(lab, d.id), () => {
      root.traverse(o => { o.userData.devId = d.id; }); this.asyncModelReady(d.id);
    });
    let s = 1;
    if (this.mode === 'topo') { s = topoScale(d); model.scale.setScalar(s); }
    root.add(model);
    root.traverse(o => { o.userData.devId = d.id; });
    const label = this.makeLabel(this.deviceLabelHtml(d), this.mode === 'topo' ? 'lbl' : 'lbl small');
    label.visible = this.app.settings.labels && !(this.mode === 'room' && (isFurniture(d)));
    label.position.y = d.dims.h * s + (this.mode === 'topo' ? 0.35 : 0.06) + (d.shape === 'router' && this.mode === 'topo' ? 0.4 : 0);
    if (this.mode === 'room' && d.phys.mount === 'rack') { label.position.set(-d.dims.w / 2 - 0.05, d.dims.h / 2, 0); label.element.classList.add('side'); label.visible = this.app.settings.labels && this.app.settings.rackLabels; label.userData.rack = true; }
    root.add(label);
    this.devGroup.add(root);
    this.objs.set(d.id, { root, label, scale: s, rackLabel: !!label.userData.rack });
    this.place(d);
    this.setStatus(d.id);
  }

  place(d) {
    const o = this.objs.get(d.id); if (!o) return;
    const r = o.root;
    if (this.mode === 'topo') { r.position.set(d.topo.x, 0, d.topo.z); r.rotation.y = 0; return; }
    if (d.phys.mount === 'rack' && d.phys.rackId) {
      const rack = devById(this.app.lab, d.phys.rackId);
      if (rack) {
        const rad = (rack.phys.rot || 0) * Math.PI / 180;
        const local = new THREE.Vector3(0, 0.06 + ((d.phys.rackU || 1) - 1) * RACK_U, rack.dims.d / 2 - 0.05 - d.dims.d / 2);
        local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rad);
        r.position.set(rack.phys.x + local.x, local.y + (rack.phys.elev || 0), rack.phys.z + local.z);
        r.rotation.y = rad;
        return;
      }
    }
    r.position.set(d.phys.x, d.phys.elev || 0, d.phys.z);
    r.rotation.y = (d.phys.rot || 0) * Math.PI / 180;
  }

  /** Rebuild one device (a rack in the room view: with what is mounted in it) and its cables. */
  refreshDevice(id) {
    this.refreshLinksOf(this.rebuildDevice(id));
    this.setSelection(this.selection);
  }
  /** Rebuild the 3D object of a device. Returns the ids of all devices rebuilt. */
  rebuildDevice(id, ids = new Set()) {
    ids.add(id);
    const d = devById(this.app.lab, id);
    const old = this.objs.get(id);
    if (old) { this.devGroup.remove(old.root); disposeTree(old.root); old.label.element.remove(); this.objs.delete(id); }
    this.layouts.delete(id);
    if (d && this.visible(d)) this.addDevice(d);
    if (d && isRack(d) && this.mode === 'room') for (const x of this.app.lab.devices) if (x.phys.rackId === d.id) this.rebuildDevice(x.id, ids);
    return ids;
  }

  // ---------------------------------------------------------------- selection
  setSelection(sel) {
    this.selection = sel;
    for (const [id, lo] of this.linkObjs) {
      const on = sel && sel.type === 'link' && sel.id === id;
      if (lo.line.material.emissiveIntensity !== undefined) lo.line.material.emissiveIntensity = on ? 1.0 : 0.25;
      else lo.line.material.opacity = 1;
      lo.line.scale.setScalar(1);
    }
    this.updateSelBox();
    for (const [id, o] of this.objs) {
      const on = !!sel && sel.type === 'device' && sel.id === id;
      o.label.element.classList.toggle('sel', on);
      if (o.rackLabel) o.label.visible = this.app.settings.labels && (this.app.settings.rackLabels || on);
    }
    this.requestRender();
  }
  updateSelBox() {
    const sel = this.selection;
    const o = sel && sel.type === 'device' ? this.objs.get(sel.id) : null;
    if (o) { o.root.updateMatrixWorld(true); this.selBox.setFromObject(o.root.children[0]); this.selBox.visible = true; } else this.selBox.visible = false;
  }

  // ---------------------------------------------------------------- camera
  fit() {
    this.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    if (this.mode === 'room') {
      const r = this.app.currentRoom();
      if (r) box.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(r.w, r.h, r.d));
    }
    for (const o of this.objs.values()) box.expandByObject(o.root.children[0]);
    if (box.isEmpty()) box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.z, size.y * 1.5) * 0.5 + 0.5;
    const tv = Math.tan((this.camera.fov * Math.PI / 180) / 2);
    const dist = Math.max(r / tv, r / (tv * Math.max(0.3, this.camera.aspect))) * 1.02;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (dir.lengthSq() < 0.5 || dir.y < 0.2) dir.set(0.45, 0.75, 0.9).normalize();
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir, dist);
    this.controls.update(); this.requestRender();
  }
  top() {
    const t = this.controls.target;
    const h = Math.max(6, this.camera.position.distanceTo(t));
    this.camera.position.set(t.x, t.y + h, t.z + 0.001);
    this.controls.update(); this.requestRender();
  }

  /** Thumbnail-free mini renderer for the template editor preview. */
  static preview(canvas, dev, tpl) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true });
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#121a15');
    sc.add(new THREE.HemisphereLight(0xffffff, 0x354a3b, 1.6));
    const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(3, 6, 5); sc.add(l);
    const cam = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.01, 100);
    let model = null;
    const draw = (d, t) => {
      if (model) { sc.remove(model); disposeTree(model); }
      model = buildModel(d, t, new Set(), () => r.render(sc, cam));
      const s = topoScale(d); model.scale.setScalar(s); sc.add(model);
      const hgt = d.dims.h * s;
      cam.position.set(2.2, 1.4 + hgt * 0.6, 2.8); cam.lookAt(0, hgt * 0.4, 0);
      r.render(sc, cam);
    };
    draw(dev, tpl);
    return { draw, dispose: () => { if (model) disposeTree(model); r.dispose(); } };
  }
}

mixin(Viewport, Environment, Cables, Effects, Pointer);
