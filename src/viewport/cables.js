// SPDX-License-Identifier: Apache-2.0
// Viewport: links. Cable ends at the real port positions, curves in the topology view,
// and routes along the floor, walls or a ceiling tray in the room view.
import * as THREE from 'three';
import { portLayout, portAnchor } from '../models3d.js';
import { devById, portById } from '../model.js';
import { esc } from '../util.js';

export const MEDIUM_COLORS = {
  copper: '#4cc2ff', fiber: '#ff9f43', wireless: '#b28dff', tunnel: '#ff5ea8', virtual: '#8a93a6', console: '#7bd88f', video: '#5eead4', power: '#ffd166',
};
const DASHED = new Set(['wireless', 'tunnel', 'virtual']);
export const CABLE_ROUTES = [['hang', 'Hanging (gravity)'], ['floor', 'Along the floor'], ['wall', 'Clipped to walls'], ['ceiling', 'Ceiling tray']];

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

const DOT_GEO = new THREE.SphereGeometry(0.03, 8, 6);

const DOT_UP = new THREE.MeshBasicMaterial({ color: 0x38e07a });
const DOT_DOWN = new THREE.MeshBasicMaterial({ color: 0xff6b5c });

export class Cables {
  anchor(devId) {
    const o = this.objs.get(devId); if (!o) return null;
    const d = devById(this.app.lab, devId);
    const p = o.root.position.clone();
    if (this.mode === 'topo') p.y = Math.min(d.dims.h * o.scale * 0.5, 0.45);
    else p.y += d.dims.h * 0.5;
    return p;
  }
  /** Rebuild all cables. */
  refreshLinks() {
    this.clearGroup(this.linkGroup); this.linkObjs.clear();
    this.scene.updateMatrixWorld(true);
    for (const l of this.app.lab.links) this.addLink(l);
    this.requestRender();
  }
  /**
   * Rebuild only the cables with an end on one of these devices (a drag, a device edit).
   * The ends of a drawn cable are kept with it, so the cables of a deleted or hidden
   * device go away too.
   */
  refreshLinksOf(devIds) {
    const ids = devIds instanceof Set ? devIds : new Set(devIds);
    if (!ids.size) return;
    for (const id of ids) this.objs.get(id)?.root.updateMatrixWorld(true); // the other ends did not move
    for (const [lid, lo] of this.linkObjs) {
      if (ids.has(lo.a) || ids.has(lo.b)) { this.dropObject(this.linkGroup, lo.group); this.linkObjs.delete(lid); }
    }
    let selected = false;
    for (const l of this.app.lab.links) {
      if (!ids.has(l.a.dev) && !ids.has(l.b.dev)) continue;
      this.addLink(l);
      if (this.selection?.type === 'link' && this.selection.id === l.id) selected = true;
    }
    if (selected) this.setSelection(this.selection); // keep the highlight of a selected cable
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
          const pl = this.makeLabel(esc(p.name), 'plbl');
          pl.position.copy(curve.getPoint(t < 0.5 ? 0.12 : 0.88)); group.add(pl);
        }
      }
      const lt = l.label || (l.medium === 'wireless' ? pa?.ssid || pb?.ssid || '' : '');
      if (lt) { const ll = this.makeLabel(esc(lt), 'plbl mid'); ll.position.copy(curve.getPoint(0.5)); group.add(ll); }
    }
    this.linkGroup.add(group);
    this.linkObjs.set(l.id, { group, curve, line, a: l.a.dev, b: l.b.dev });
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
}
