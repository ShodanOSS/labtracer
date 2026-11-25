// Three.js viewport with two modes: logical topology and physical room.
// Renders on demand only (no idle GPU/CPU use).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { buildModel, disposeTree, topoScale, portLayout, portAnchor, RACK_U } from './models3d.js';
import { devById, portById, linkedPortIds, showsInTopology, showsInRoom, deviceRoomId, isRack, isFurniture } from './model.js';
import { parseCIDR } from './util.js';

export const MEDIUM_COLORS = {
  copper: '#4cc2ff', fiber: '#ff9f43', wireless: '#b28dff', tunnel: '#ff5ea8', virtual: '#8a93a6', console: '#7bd88f', video: '#5eead4', power: '#ffd166',
};
const DASHED = new Set(['wireless', 'tunnel', 'virtual']);
export const CABLE_ROUTES = [['hang', 'Hanging (gravity)'], ['floor', 'Along the floor'], ['wall', 'Clipped to walls'], ['ceiling', 'Ceiling tray']];

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
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
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
    if (this.mode === 'topo') return showsInTopology(d);
    return showsInRoom(d) && deviceRoomId(this.app.lab, d) === this.app.roomId;
  }

  // ---------------------------------------------------------------- build
  clearGroup(g) {
    for (const c of [...g.children]) { g.remove(c); disposeTree(c); c.traverse(o => { if (o.isCSS2DObject) o.element.remove(); }); }
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

  /** Rebuild only the grid / room shell (used by the colour settings). */
  rebuildEnv() {
    this.clearGroup(this.env);
    this.scene.background.set(this.app.settings.bgColor || '#0c130e');
    this.buildEnv();
    this.requestRender();
  }

  buildEnv() {
    if (this.mode === 'topo') {
      const [major, minor] = gridColors(this.app.settings);
      const grid = new THREE.GridHelper(120, 120, major, minor);
      grid.userData.ownGeometry = true; grid.userData.ownMaterial = grid.material;
      grid.position.y = -0.001; this.env.add(grid);
      return;
    }
    const room = this.app.currentRoom();
    if (!room) return;
    const { w, d, h } = room;
    // floor with 0.5 m grid
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const [major, , floorFill] = gridColors(this.app.settings);
    const g = c.getContext('2d'); g.fillStyle = floorFill; g.fillRect(0, 0, 128, 128);
    g.globalAlpha = 0.8; g.strokeStyle = major; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(w / 0.5, d / 0.5);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const floorMat = new THREE.MeshLambertMaterial({ map: tex });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(w / 2, 0, d / 2);
    floor.userData.ownMaterial = floorMat; floor.userData.ownGeometry = true;
    this.env.add(floor);
    const wallMat = new THREE.MeshLambertMaterial({ color: '#7fa58b', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
    const t = 0.06;
    const walls = [[w / 2, d + t / 2, w + 2 * t, t], [w / 2, -t / 2, w + 2 * t, t], [-t / 2, d / 2, t, d], [w + t / 2, d / 2, t, d]];
    for (const [x, z, sx, sz] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), wallMat); m.position.set(x, h / 2, z); m.userData.ownGeometry = true; this.env.add(m);
    }
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: '#4a6b54' }));
    outline.position.set(w / 2, h / 2, d / 2); outline.userData.ownGeometry = true; this.env.add(outline);
    const lbl = this.makeLabel(`<b>${escapeHtml(room.name)}</b><span>${escapeHtml(w)} m × ${escapeHtml(d)} m × ${escapeHtml(h)} m</span>`, 'lbl room');
    lbl.position.set(w / 2, 0.02, d + 0.35); this.env.add(lbl);
  }

  /** Many custom models can finish loading at once: refresh cables once per frame, not once per model. */
  asyncModelReady() {
    if (this.asyncPending) return;
    this.asyncPending = true;
    requestAnimationFrame(() => { this.asyncPending = false; this.updateSelBox(); this.refreshLinks(); });
  }

  makeLabel(html, cls = 'lbl') {
    const div = document.createElement('div'); div.className = cls; div.innerHTML = html;
    return new CSS2DObject(div);
  }

  deviceLabelHtml(d) {
    const ips = d.ports.filter(p => p.ip && p.enabled && parseCIDR(p.ip)).map(p => p.ip.split('/')[0]);
    const ip = ips.length ? `<span>${escapeHtml(ips[0])}${ips.length > 1 ? ' +' + (ips.length - 1) : ''}</span>` : '';
    return `<b>${escapeHtml(d.name)}</b>${this.mode === 'topo' ? ip : ''}`;
  }

  addDevice(d) {
    const lab = this.app.lab;
    const root = new THREE.Group();
    root.userData.devId = d.id;
    const model = buildModel(d, this.app.library.get(d.templateId), linkedPortIds(lab, d.id), () => {
      root.traverse(o => { o.userData.devId = d.id; }); this.asyncModelReady();
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

  refreshDevice(id) {
    const d = devById(this.app.lab, id);
    const old = this.objs.get(id);
    if (old) { this.devGroup.remove(old.root); disposeTree(old.root); old.label.element.remove(); this.objs.delete(id); }
    this.layouts.delete(id);
    if (d && this.visible(d)) this.addDevice(d);
    if (d && isRack(d) && this.mode === 'room') for (const x of this.app.lab.devices) if (x.phys.rackId === d.id) this.refreshDevice(x.id);
    this.refreshLinks();
    this.setSelection(this.selection);
  }

  // ---------------------------------------------------------------- links
  anchor(devId) {
    const o = this.objs.get(devId); if (!o) return null;
    const d = devById(this.app.lab, devId);
    const p = o.root.position.clone();
    if (this.mode === 'topo') p.y = Math.min(d.dims.h * o.scale * 0.5, 0.45);
    else p.y += d.dims.h * 0.5;
    return p;
  }
  refreshLinks() {
    this.clearGroup(this.linkGroup); this.linkObjs.clear();
    this.scene.updateMatrixWorld(true);
    for (const l of this.app.lab.links) this.addLink(l);
    this.requestRender();
  }
  /** World position and outward direction of a cable end. */
  portEnd(devId, portId) {
    const o = this.objs.get(devId); if (!o) return null;
    const d = devById(this.app.lab, devId);
    if (!this.app.settings.portAnchors) return { pos: this.anchor(devId), normal: null };
    const model = o.root.children[0];
    if (!this.layouts.has(devId)) this.layouts.set(devId, portLayout(d));
    const a = portAnchor(d, portById(d, portId), this.layouts.get(devId));
    const pos = model.localToWorld(a.pos.clone());
    const normal = a.normal ? a.normal.clone().transformDirection(model.matrixWorld) : null;
    return { pos, normal };
  }
  addLink(l) {
    if (this.mode === 'room' && (l.medium === 'tunnel' || l.medium === 'virtual' || !this.app.settings.cables)) return;
    if (this.mode === 'topo' && l.medium === 'power' && !this.app.settings.powerLinks) return;
    const ea = this.portEnd(l.a.dev, l.a.port), eb = this.portEnd(l.b.dev, l.b.port);
    if (!ea || !eb) return;
    const a = ea.pos, b = eb.pos;
    const color = l.color || MEDIUM_COLORS[l.medium] || '#9aa4b2';
    const dist = a.distanceTo(b);
    const topo = this.mode === 'topo';
    // leave each port straight out of its face, then curve toward the other end
    const reach = topo ? Math.min(1.2, Math.max(0.35, dist * 0.22)) : Math.min(0.3, Math.max(0.05, dist * 0.25));
    const dirTo = (from, to) => { const v = to.clone().sub(from); v.y = 0; return v.lengthSq() > 1e-6 ? v.normalize() : new THREE.Vector3(0, 1, 0); };
    const c1 = a.clone().addScaledVector(ea.normal || dirTo(a, b), reach);
    const c2 = b.clone().addScaledVector(eb.normal || dirTo(b, a), reach);
    if (topo) {
      const lift = Math.min(2.5, dist * (l.medium === 'tunnel' ? 0.28 : (DASHED.has(l.medium) ? 0.12 : 0.08)));
      c1.y += lift; c2.y += lift;
    } else {
      const sag = Math.min(0.4, dist * 0.12);
      c1.y = Math.max(0.02, c1.y - sag); c2.y = Math.max(0.02, c2.y - sag);
    }
    let curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
    if (!topo) curve = this.cableRoute(l, ea, eb) || curve;
    const group = new THREE.Group(); group.userData.linkId = l.id;
    let line;
    if (DASHED.has(l.medium)) {
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
      line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color, dashSize: this.mode === 'topo' ? 0.25 : 0.06, gapSize: this.mode === 'topo' ? 0.15 : 0.04 }));
      line.computeLineDistances();
      line.userData.ownMaterial = line.material;
    } else {
      const r = topo ? (l.medium === 'power' ? 0.012 : 0.02) : 0.004;
      line = new THREE.Mesh(new THREE.TubeGeometry(curve, curve.type === 'CurvePath' ? Math.min(200, Math.max(24, Math.round(curve.getLength() / 0.04))) : 28, r, 5, false), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
      line.userData.ownMaterial = line.material;
    }
    line.userData.ownGeometry = true; line.userData.linkId = l.id;
    group.add(line);

    if (this.mode === 'topo') {
      const da = devById(this.app.lab, l.a.dev), db = devById(this.app.lab, l.b.dev);
      const pa = portById(da, l.a.port), pb = portById(db, l.b.port);
      const up = pa?.enabled && pb?.enabled;
      for (const [t, p] of [[0, pa], [1, pb]]) {
        const dot = new THREE.Mesh(DOT_GEO, up ? DOT_UP : DOT_DOWN);
        dot.position.copy(curve.getPoint(t)); dot.userData.linkId = l.id; group.add(dot);
        if (this.app.settings.portLabels && p) {
          const pl = this.makeLabel(escapeHtml(p.name), 'plbl');
          pl.position.copy(curve.getPoint(t < 0.5 ? 0.12 : 0.88)); group.add(pl);
        }
      }
      const lt = l.label || (l.medium === 'wireless' ? pa?.ssid || pb?.ssid || '' : '');
      if (lt) { const ll = this.makeLabel(escapeHtml(lt), 'plbl mid'); ll.position.copy(curve.getPoint(0.5)); group.add(ll); }
    }
    this.linkGroup.add(group);
    this.linkObjs.set(l.id, { group, curve, line });
  }

  /** Room view: route a cable along the floor, the walls or a ceiling tray. null = let it hang. */
  cableRoute(l, ea, eb) {
    const lab = this.app.lab, room = this.app.currentRoom();
    const route = l.route || lab.cableRoute || 'hang';
    if (!room || route === 'hang' || DASHED.has(l.medium)) return null;
    const da = devById(lab, l.a.dev), db = devById(lab, l.b.dev);
    if (da?.phys.mount === 'rack' && db?.phys.mount === 'rack' && da.phys.rackId === db.phys.rackId) return null; // patch lead in one rack
    if (Math.hypot(ea.pos.x - eb.pos.x, ea.pos.z - eb.pos.z) < 0.5) return null; // short lead
    return polyPath(cablePoints(route, ea, eb, room, bundleOffset(l.id)));
  }
  /** Cable length in metres as drawn in the room view, or null in the topology view. */
  cableLength(id) {
    const lo = this.linkObjs.get(id);
    return this.mode === 'room' && lo ? lo.curve.getLength() : null;
  }

  // ---------------------------------------------------------------- live status
  applyStatus(map) {
    this.statusMap = map || new Map();
    for (const id of this.objs.keys()) this.setStatus(id);
    this.requestRender();
  }
  setStatus(id) {
    const o = this.objs.get(id); if (!o) return;
    const st = this.statusMap.get(id);
    const el = o.label.element;
    for (const c of ['st-up', 'st-down', 'st-degraded', 'st-unknown']) el.classList.remove(c);
    if (st) el.classList.add('st-' + st);
    if (o.ring) { o.root.remove(o.ring); o.ring.geometry.dispose(); o.ring = null; }
    const d = devById(this.app.lab, id);
    if (!st || !d || (this.mode === 'room' && d.phys.mount === 'rack')) return;
    const r = Math.max(d.dims.w, d.dims.d) * o.scale * 0.62 + (this.mode === 'topo' ? 0.08 : 0.02);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + (this.mode === 'topo' ? 0.09 : 0.025), 40), STATUS_MATS[st] || STATUS_MATS.unknown);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
    ring.raycast = () => {}; ring.userData.ownGeometry = true;
    o.root.add(ring); o.ring = ring;
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
    if (o) { this.scene.updateMatrixWorld(true); this.selBox.setFromObject(o.root.children[0]); this.selBox.visible = true; } else this.selBox.visible = false;
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

  // ---------------------------------------------------------------- picking
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
        this.place(d);
        if (this.mode === 'room' && isRack(d)) for (const x of this.app.lab.devices) if (x.phys.rackId === d.id) this.place(x);
        this.refreshLinks(); this.updateSelBox(); this.requestRender();
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

  // ---------------------------------------------------------------- packet animation
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

// ---------------------------------------------------------------- cable routing
const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** Small, stable offset per cable so parallel runs show as a bundle, not one line. */
function bundleOffset(id) { let s = 0; for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0; return (s % 6) * 0.01; }
function cablePoints(route, ea, eb, room, off) {
  const lead = e => (e.normal ? e.pos.clone().addScaledVector(e.normal, 0.06) : e.pos.clone());
  const a1 = lead(ea), b1 = lead(eb);
  const floor = 0.012 + off * 0.3;
  if (route === 'floor' || route === 'ceiling') {
    const y = route === 'floor' ? floor : room.h - 0.1 - off;
    return [ea.pos, a1, V(a1.x, y, a1.z), V(b1.x, y, a1.z), V(b1.x, y, b1.z), b1, eb.pos];
  }
  // wall: drop to the floor, go to the nearest wall, follow the skirting, come back out
  const ins = 0.02 + off, y = 0.06 + off;
  const wa = wallSpot(a1, room, ins), wb = wallSpot(b1, room, ins);
  return [ea.pos, a1, V(a1.x, floor, a1.z), V(wa.x, floor, wa.z), V(wa.x, y, wa.z), ...perimeter(wa.t, wb.t, room, ins, y),
    V(wb.x, y, wb.z), V(wb.x, floor, wb.z), V(b1.x, floor, b1.z), b1, eb.pos];
}
/** Nearest point on the room walls (inset), with its distance t along the perimeter. */
function wallSpot(p, room, ins) {
  const { w, d } = room;
  const x = Math.min(w - ins, Math.max(ins, p.x)), z = Math.min(d - ins, Math.max(ins, p.z));
  const dist = [p.z, w - p.x, d - p.z, p.x]; // walls z=0, x=w, z=d, x=0
  const k = dist.indexOf(Math.min(...dist));
  if (k === 0) return { x, z: ins, t: x };
  if (k === 1) return { x: w - ins, z, t: w + z };
  if (k === 2) return { x, z: d - ins, t: w + d + (w - x) };
  return { x: ins, z, t: 2 * w + d + (d - z) };
}
/** Room corners passed when walking the perimeter the short way from ta to tb. */
function perimeter(ta, tb, room, ins, y) {
  const { w, d } = room, P = 2 * (w + d);
  const fwd = (tb - ta + P) % P, len = Math.min(fwd, P - fwd), forward = fwd <= P - fwd;
  const out = [];
  for (const [t, x, z] of [[0, ins, ins], [w, w - ins, ins], [w + d, w - ins, d - ins], [2 * w + d, ins, d - ins]]) {
    const dt = forward ? (t - ta + P) % P : (ta - t + P) % P;
    if (dt > 1e-6 && dt < len - 1e-6) out.push([dt, V(x, y, z)]);
  }
  return out.sort((a, b) => a[0] - b[0]).map(e => e[1]);
}
function polyPath(pts) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < pts.length; i++) if (pts[i].distanceToSquared(pts[i - 1]) > 1e-8) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
  return path.curves.length ? path : null;
}

/** [major line, minor line, room floor fill] from the grid colour setting. */
export function gridColors(settings) {
  const major = new THREE.Color(settings.gridColor || '#2b4a35');
  const bg = new THREE.Color(settings.bgColor || '#0c130e');
  const minor = bg.clone().lerp(major, 0.55);
  const floor = bg.clone().lerp(new THREE.Color('#1f2e24'), 0.7); // floor stays dark; only the lines take the grid colour
  return ['#' + major.getHexString(), '#' + minor.getHexString(), '#' + floor.getHexString()];
}

const DOT_GEO = new THREE.SphereGeometry(0.03, 8, 6);
const smat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
const STATUS_MATS = { up: smat(0x38e07a), degraded: smat(0xffb347), down: smat(0xff5c5c), unknown: smat(0x6b7686) };
const DOT_UP = new THREE.MeshBasicMaterial({ color: 0x38e07a });
const DOT_DOWN = new THREE.MeshBasicMaterial({ color: 0xff6b5c });

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
