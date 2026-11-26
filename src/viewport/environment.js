// Viewport: the scene around the devices. Topology grid, room floor, walls and room label.
import * as THREE from 'three';
import { esc } from '../util.js';

/** [major line, minor line, room floor fill] from the grid colour setting. */
export function gridColors(settings) {
  const major = new THREE.Color(settings.gridColor || '#2b4a35');
  const bg = new THREE.Color(settings.bgColor || '#0c130e');
  const minor = bg.clone().lerp(major, 0.55);
  const floor = bg.clone().lerp(new THREE.Color('#1f2e24'), 0.7); // floor stays dark; only the lines take the grid colour
  return ['#' + major.getHexString(), '#' + minor.getHexString(), '#' + floor.getHexString()];
}

export class Environment {
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
    const lbl = this.makeLabel(`<b>${esc(room.name)}</b><span>${esc(w)} m × ${esc(d)} m × ${esc(h)} m</span>`, 'lbl room');
    lbl.position.set(w / 2, 0.02, d + 0.35); this.env.add(lbl);
  }
}
