// Procedural low-poly device models. One canvas texture per device face
// keeps draw calls low (good for integrated GPUs). Units are metres.
// Model origin: bottom centre. Front faces +Z.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RACK_U } from './templates.js';

const mats = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
  return mats.get(key);
}
function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}
const geoBox = new THREE.BoxGeometry(1, 1, 1);
const geoCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const geoSph = new THREE.SphereGeometry(0.5, 16, 12);

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geoBox, material);
  m.scale.set(w, h, d); m.position.set(x, y + h / 2, z);
  return m;
}

// ---------------------------------------------------------------- front panel textures
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }


// ---------------------------------------------------------------- port layout
// Each physical port gets a rectangle on the front or back face, in canvas
// pixels. The same layout drives the textures and the 3D cable anchors, so
// a cable always plugs into the port you see.
const BOXY = new Set(['rackmount', 'box', 'tower', 'nas', 'router', 'printer', 'screen']);
const WIRED = new Set(['eth', 'sfp', 'console', 'usb', 'video', 'power']);
export function faceSize(dev) {
  const { w, h } = dev.dims;
  const base = dev.shape === 'rackmount' ? 1024 : 512;
  return [base, Math.max(24, Math.min(1024, Math.round(base * h / w)))];
}
function grid(list, x0, y0, x1, y1, out, side, aspect = 1.25) {
  const n = list.length; if (!n) return;
  const RW = x1 - x0, RH = y1 - y0;
  const rows = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect * RH / RW)) || 1));
  const cols = Math.ceil(n / rows);
  const cw = RW / cols, ch = RH / rows;
  let pw = cw * 0.8, ph = ch * 0.7;
  if (pw > ph * aspect * 1.3) pw = ph * aspect * 1.3; else if (ph > pw / aspect) ph = pw / aspect;
  list.forEach((p, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    out.set(p.id, { side, x: x0 + c * cw + (cw - pw) / 2, y: y0 + r * ch + (ch - ph) / 2, pw, ph });
  });
}
export function portLayout(dev) {
  const [W, H] = faceSize(dev);
  const map = new Map();
  const ports = dev.ports;
  if (!BOXY.has(dev.shape)) {
    const list = ports.filter(p => WIRED.has(p.kind));
    list.forEach((p, i) => map.set(p.id, { side: 'front', u: (i + 1) / (list.length + 1), v: 0.5 }));
  } else {
    const face = dev.face || 'plain';
    const frontData = face === 'switch' || face === 'firewall' || face === 'patch';
    const front = [], backData = [], backPower = [], frontPower = [], patchRear = [];
    for (const p of ports) {
      if (!WIRED.has(p.kind)) continue;
      if (p.kind === 'power') (face === 'pdu' && !/^in/i.test(p.name) ? frontPower : backPower).push(p);
      else if (frontData && (p.kind === 'eth' || p.kind === 'sfp')) (face === 'patch' && /R$/i.test(p.name) ? patchRear : front).push(p);
      else backData.push(p);
    }
    if (front.length) {
      const eth = front.filter(p => p.kind === 'eth'), sfp = front.filter(p => p.kind === 'sfp');
      const left = W * (face === 'firewall' ? 0.3 : 0.16), right = W * 0.97 - (sfp.length ? sfp.length * W * 0.045 + W * 0.02 : 0);
      const rows = eth.length > 12 ? 2 : 1;
      const perRow = Math.ceil(eth.length / rows) || 1;
      const cell = Math.min((right - left) / perRow, H * 0.9);
      const ph = Math.min(H * (rows === 2 ? 0.36 : 0.5), cell * 0.85);
      eth.forEach((p, i) => {
        const r = Math.floor(i / perRow), col = i % perRow;
        const y = rows === 2 ? (r === 0 ? H * 0.1 : H * 0.54) : (H - ph) / 2;
        map.set(p.id, { side: 'front', x: left + col * cell + cell * 0.1, y, pw: cell * 0.8, ph });
      });
      sfp.forEach((p, i) => map.set(p.id, { side: 'front', x: right + W * 0.02 + i * W * 0.045, y: H * 0.3, pw: W * 0.038, ph: H * 0.4 }));
    }
    // patch panel rear jacks sit directly behind their front jack
    for (const p of patchRear) {
      const f = ports.find(q => q.name.toUpperCase() === p.name.toUpperCase().replace(/R$/, 'F'));
      const fe = f && map.get(f.id);
      if (fe) map.set(p.id, { side: 'back', x: W - fe.x - fe.pw, y: fe.y, pw: fe.pw, ph: fe.ph });
      else backData.push(p);
    }
    if (frontPower.length) {
      const n = frontPower.length;
      frontPower.forEach((p, i) => map.set(p.id, { side: 'front', x: W * 0.15 + i * (W * 0.75 / n), y: H * 0.2, pw: W * 0.05, ph: H * 0.6 }));
    }
    const tall = dev.dims.h > dev.dims.w * 0.8;
    if (tall) {
      grid(backData, W * 0.15, H * 0.06, W * 0.85, H * 0.42, map, 'back');
      grid(backPower, W * 0.3, H * 0.78, W * 0.7, H * 0.95, map, 'back', 1.4);
    } else {
      grid(backData, W * 0.05, H * 0.12, backPower.length ? W * 0.76 : W * 0.95, H * 0.88, map, 'back');
      grid(backPower, W * 0.79, H * 0.15, W * 0.97, H * 0.85, map, 'back', 1.4);
    }
    for (const e of map.values()) if (e.x !== undefined) { e.u = (e.x + e.pw / 2) / W; e.v = (e.y + e.ph / 2) / H; }
  }
  return { W, H, map };
}

/** Local anchor point and outward normal for a port (model space, metres). */
export function portAnchor(dev, port, layout) {
  const { w, h, d } = dev.dims;
  if (!port || port.kind === 'wifi') return { pos: new THREE.Vector3(0, h, 0), normal: new THREE.Vector3(0, 1, 0) };
  const e = layout.map.get(port.id);
  if (!e) return { pos: new THREE.Vector3(0, h / 2, 0), normal: null }; // tunnel, vport, virtual: from the centre
  const y = (1 - e.v) * h;
  if (e.side === 'back') return { pos: new THREE.Vector3(-(e.u - 0.5) * w, y, -d / 2 - 0.001), normal: new THREE.Vector3(0, 0, -1) };
  return { pos: new THREE.Vector3((e.u - 0.5) * w, y, d / 2 + 0.001), normal: new THREE.Vector3(0, 0, 1) };
}

function drawPort(g, p, e, linked, showName) {
  const { x, y, pw, ph } = e;
  const led = !p.enabled ? '#e0a030' : (linked.has(p.id) ? '#38e07a' : '#33403a');
  if (p.kind === 'power') {
    g.fillStyle = '#0a0a0a'; rr(g, x, y, pw, ph, Math.min(pw, ph) * 0.2); g.fill();
    g.fillStyle = linked.has(p.id) ? '#d8b04a' : '#3a3a3a';
    for (const fx of [0.3, 0.5, 0.7]) g.fillRect(x + pw * fx - pw * 0.04, y + ph * (fx === 0.5 ? 0.25 : 0.45), pw * 0.08, ph * 0.3);
  } else if (p.kind === 'sfp') {
    g.fillStyle = '#0d0f12'; rr(g, x, y, pw, ph, 2); g.fill();
    g.strokeStyle = '#4b525c'; g.lineWidth = 1; g.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
    g.fillStyle = led; g.fillRect(x + pw * 0.15, y - ph * 0.25, pw * 0.3, ph * 0.15);
  } else if (p.kind === 'usb') {
    g.fillStyle = '#0d0f12'; g.fillRect(x, y + ph * 0.25, pw, ph * 0.5);
    g.fillStyle = '#2e6bd1'; g.fillRect(x + pw * 0.1, y + ph * 0.35, pw * 0.8, ph * 0.12);
  } else {
    g.fillStyle = p.kind === 'console' ? '#16384f' : '#121418';
    rr(g, x, y, pw, ph, 2); g.fill();
    g.fillStyle = '#2a2e35'; g.fillRect(x + pw * 0.28, y + ph * 0.72, pw * 0.44, ph * 0.18);
    g.fillStyle = led; g.fillRect(x + pw * 0.05, y + ph * 0.06, pw * 0.18, ph * 0.12);
    g.fillStyle = led === '#33403a' ? '#33403a' : '#e0c040'; g.fillRect(x + pw * 0.77, y + ph * 0.06, pw * 0.18, ph * 0.12);
  }
  if (showName) {
    const size = Math.max(8, Math.min(ph * 0.32, 15));
    g.fillStyle = 'rgba(230,235,240,0.85)'; g.font = `600 ${size}px system-ui, sans-serif`; g.textBaseline = 'top';
    const tw = g.measureText(p.name).width;
    g.fillText(p.name, x + pw / 2 - tw / 2, y + ph + 2);
  }
}

function drawBack(dev, linked, layout) {
  const { W, H, map } = layout;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = shade(dev.color, 0.8); g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = W * 0.02; x < W * 0.98; x += W * 0.02) g.fillRect(x, H * 0.04, W * 0.006, H * 0.06);
  const back = dev.ports.filter(p => map.get(p.id)?.side === 'back');
  for (const p of back) { const e = map.get(p.id); drawPort(g, p, e, linked, e.ph < H * 0.3 || H >= 160); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 2;
  return back.length ? tex : (tex.dispose(), null);
}

function drawFace(dev, linked, layout) {
  const { W, H } = layout;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const base = dev.color;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, shade(base, 1.25)); grad.addColorStop(1, shade(base, 0.85));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = Math.max(1, H * 0.04); g.strokeRect(1, 1, W - 2, H - 2);
  const physPorts = dev.ports.filter(p => p.kind === 'eth' || p.kind === 'sfp');
  const led = (p) => !p.enabled ? '#e0a030' : (linked.has(p.id) ? '#38e07a' : '#33403a');
  const label = (txt, x, y, size, color = 'rgba(255,255,255,0.75)') => {
    g.fillStyle = color; g.font = `600 ${size}px system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillText(txt, x, y);
  };
  const face = dev.face || 'plain';

  if (face === 'switch' || face === 'firewall' || face === 'patch') {
    let n = 0;
    for (const p of dev.ports) {
      const e = layout.map.get(p.id);
      if (!e || e.side !== 'front') continue;
      n++;
      if (face === 'patch') {
        g.fillStyle = '#0b0c0e'; rr(g, e.x, e.y, e.pw, e.ph, 2); g.fill();
        label(p.name.replace(/F$/i, ''), e.x + e.pw * 0.25, e.y < H * 0.3 ? e.y + e.ph + Math.max(5, e.ph * 0.18) : e.y - Math.max(5, e.ph * 0.18), Math.max(8, e.ph * 0.28), '#c9ccd1');
      } else drawPort(g, p, e, linked, false);
    }
    label(dev.name, W * 0.02, H * 0.3, Math.max(9, Math.min(H * 0.28, 22)));
    if (face === 'firewall') { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(W * 0.02, H * 0.55, W * 0.24, H * 0.25); }
  } else if (face === 'server') {
    const bays = dev.bays || 8;
    const rows = dev.uHeight >= 2 ? (bays >= 12 ? 3 : 2) : 1;
    const per = Math.ceil(bays / rows);
    const x0 = W * 0.18, x1 = W * 0.86, bw = (x1 - x0) / per, bh = (H * 0.84) / rows;
    for (let i = 0; i < bays; i++) {
      const r = Math.floor(i / per), col = i % per;
      const x = x0 + col * bw, y = H * 0.08 + r * bh;
      g.fillStyle = '#1a1c20'; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      g.fillStyle = '#3c4048'; g.fillRect(x + bw * 0.08, y + bh * 0.2, bw * 0.84, bh * 0.25);
      g.fillStyle = i % 3 === 0 ? '#38e07a' : '#2ea8ff'; g.fillRect(x + bw * 0.8, y + bh * 0.62, bw * 0.1, bh * 0.18);
    }
    label(dev.name, W * 0.015, H * 0.35, Math.max(9, Math.min(H * 0.3, 22)));
    g.fillStyle = '#2ea8ff'; g.beginPath(); g.arc(W * 0.93, H * 0.5, Math.min(H * 0.18, 10), 0, 7); g.fill();
  } else if (face === 'router' || face === 'plain' || face === 'vents') {
    if (face === 'vents') { g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = W * 0.1; x < W * 0.9; x += W * 0.03) g.fillRect(x, H * 0.25, W * 0.012, H * 0.5); }
    if (face === 'router') {
      const n = Math.min(8, Math.max(4, physPorts.length + 2));
      for (let i = 0; i < n; i++) {
        const p = physPorts[i];
        g.fillStyle = p ? led(p) : '#38e07a';
        g.beginPath(); g.arc(W * (0.2 + i * 0.6 / n), H * 0.5, Math.min(H * 0.12, 8), 0, 7); g.fill();
      }
    }
    if (H > 40) label(dev.name, W * 0.04, H * (face === 'router' ? 0.2 : 0.5), Math.min(H * 0.18, 28));
  } else if (face === 'tower') {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(W * 0.12, H * 0.06, W * 0.76, H * 0.08); g.fillRect(W * 0.12, H * 0.16, W * 0.76, H * 0.08);
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = H * 0.5; y < H * 0.95; y += H * 0.025) g.fillRect(W * 0.15, y, W * 0.7, H * 0.008);
    g.fillStyle = '#2ea8ff'; g.beginPath(); g.arc(W * 0.5, H * 0.33, W * 0.06, 0, 7); g.fill();
    label(dev.name, W * 0.1, H * 0.42, Math.min(W * 0.09, 40));
  } else if (face === 'nas') {
    const bays = dev.bays || 2;
    const x0 = W * 0.08, bw = (W * 0.84) / bays;
    for (let i = 0; i < bays; i++) {
      g.fillStyle = '#16181b'; g.fillRect(x0 + i * bw + 3, H * 0.08, bw - 6, H * 0.72);
      g.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = H * 0.12; y < H * 0.76; y += H * 0.04) g.fillRect(x0 + i * bw + bw * 0.2, y, bw * 0.6, H * 0.012);
      g.fillStyle = '#38e07a'; g.fillRect(x0 + i * bw + bw * 0.45, H * 0.84, bw * 0.1, H * 0.03);
    }
    label(dev.name, W * 0.08, H * 0.93, Math.min(W * 0.08, 30));
  } else if (face === 'ups') {
    g.fillStyle = '#0d2a3a'; rr(g, W * 0.3, H * 0.2, W * 0.4, H * 0.3, 4); g.fill();
    g.fillStyle = '#5fd0ff'; g.font = `${Math.max(8, H * 0.12)}px monospace`; g.textBaseline = 'middle'; g.fillText('100%', W * 0.36, H * 0.35);
    g.fillStyle = '#38e07a'; g.beginPath(); g.arc(W * 0.2, H * 0.35, Math.min(H * 0.08, 10), 0, 7); g.fill();
    label(dev.name, W * 0.05, H * 0.8, Math.max(9, Math.min(H * 0.14, 26)));
  } else if (face === 'pdu') {
    for (const p of dev.ports) { const e = layout.map.get(p.id); if (e && e.side === 'front') drawPort(g, p, e, linked, false); }
    label(dev.name, W * 0.015, H * 0.5, Math.max(9, H * 0.25));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

function texturedBox(dev, linked, w, h, d) {
  const side = mat(shade(dev.color, 0.9));
  const top = mat(shade(dev.color, 1.05));
  const layout = portLayout(dev);
  const front = new THREE.MeshLambertMaterial({ map: drawFace(dev, linked, layout) });
  const backTex = drawBack(dev, linked, layout);
  const back = backTex ? new THREE.MeshLambertMaterial({ map: backTex }) : side;
  const m = new THREE.Mesh(geoBox, [side, side, top, side, front, back]);
  m.userData.ownMaterial = front;
  if (backTex) m.userData.ownMaterial2 = back;
  m.scale.set(w, h, d); m.position.y = h / 2;
  return m;
}

// ---------------------------------------------------------------- builders
const builders = {
  rackmount(dev, L) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    g.add(texturedBox(dev, L, w, h, d));
    const ear = mat(shade(dev.color, 0.7));
    g.add(box(0.025, h * 0.96, 0.004, ear, -w / 2 - 0.0125, h * 0.02, d / 2 - 0.002));
    g.add(box(0.025, h * 0.96, 0.004, ear, w / 2 + 0.0125, h * 0.02, d / 2 - 0.002));
    return g;
  },
  box(dev, L) { const g = new THREE.Group(); const { w, h, d } = dev.dims; g.add(texturedBox(dev, L, w, h, d)); return g; },
  tower(dev, L) { return builders.box(dev, L); },
  nas(dev, L) { return builders.box(dev, L); },
  router(dev, L) {
    const g = builders.box(dev, L); const { w, h, d } = dev.dims;
    const am = mat('#1b1d21');
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Mesh(geoCyl, am);
      a.scale.set(0.012, h * 2.6, 0.012);
      a.position.set(-w * 0.38 + i * w * 0.253, h + h * 1.2, -d * 0.42);
      a.rotation.z = (i - 1.5) * 0.12;
      g.add(a);
    }
    return g;
  },
  ap(dev) {
    const g = new THREE.Group(); const { w, h } = dev.dims;
    const disc = new THREE.Mesh(geoCyl, mat(dev.color)); disc.scale.set(w, h, w); disc.position.y = h / 2; g.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.32, w * 0.025, 6, 32), mat('#2ea8ff', { emissive: '#1477c9' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = h + 0.001; g.add(ring);
    return g;
  },
  /** TV or monitor: panel on a small stand (no stand when wall mounted). Ports are on the back. */
  screen(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const body = mat(dev.color);
    const stand = dev.wall ? 0 : Math.min(0.12, h * 0.15);
    if (stand) { g.add(box(w * 0.32, 0.012, Math.max(d * 3, 0.18), body)); g.add(box(0.05, stand, 0.025, body, 0, 0, -d * 0.1)); }
    g.add(box(w, h - stand, d, body, 0, stand, 0));
    g.add(box(w * 0.96, (h - stand) * 0.93, 0.002, mat('#0d1117', { emissive: '#0a1626' }), 0, stand + (h - stand) * 0.035, d / 2 + 0.001));
    return g;
  },
  laptop(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    g.add(box(w, h, d, mat(dev.color)));
    g.add(box(w * 0.9, 0.002, d * 0.5, mat('#22252a'), 0, h, d * 0.05));
    const lid = new THREE.Group(); lid.position.set(0, h, -d / 2);
    lid.add(box(w, d * 0.95, 0.008, mat(dev.color), 0, 0, 0));
    lid.add(box(w * 0.9, d * 0.82, 0.002, mat('#2b5c8a', { emissive: '#10263a' }), 0, d * 0.06, 0.005));
    lid.rotation.x = -0.25; g.add(lid);
    return g;
  },
  phone(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    g.add(box(w, h, d, mat(dev.color)));
    g.add(box(w * 0.9, h * 0.92, 0.001, mat('#2b5c8a', { emissive: '#10263a' }), 0, h * 0.04, d / 2));
    return g;
  },
  sbc(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    g.add(box(w, h * 0.12, d, mat(dev.color)));
    g.add(box(w * 0.18, h * 0.15, d * 0.25, mat('#b8bcc2'), -w * 0.1, h * 0.12, 0));
    g.add(box(w * 0.2, h * 0.5, d * 0.28, mat('#c7ccd2'), w * 0.38, h * 0.12, -d * 0.25));
    g.add(box(w * 0.2, h * 0.55, d * 0.3, mat('#c7ccd2'), w * 0.38, h * 0.12, d * 0.2));
    g.add(box(w * 0.2, h * 0.4, d * 0.2, mat('#d8a54a'), w * 0.15, h * 0.12, d * 0.3));
    return g;
  },
  camera(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const body = new THREE.Mesh(geoCyl, mat(dev.color)); body.scale.set(w * 0.8, d, w * 0.8); body.rotation.x = Math.PI / 2; body.position.set(0, h * 0.6, 0); g.add(body);
    g.add(box(w * 0.3, h * 0.4, w * 0.3, mat('#9aa0a6'), 0, 0, -d * 0.2));
    const lens = new THREE.Mesh(geoCyl, mat('#0b0c0e')); lens.scale.set(w * 0.4, 0.01, w * 0.4); lens.rotation.x = Math.PI / 2; lens.position.set(0, h * 0.6, d / 2); g.add(lens);
    return g;
  },
  printer(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    g.add(box(w, h, d, mat(dev.color)));
    g.add(box(w * 0.6, 0.01, d * 0.35, mat('#f5f5f5'), 0, h * 0.35, d * 0.6));
    g.add(box(w * 0.25, 0.02, d * 0.15, mat('#26292e'), w * 0.25, h, d * 0.3));
    return g;
  },
  cloud(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const m = mat(dev.color);
    [[0, 0.45, 0, 0.55], [-0.3, 0.35, 0.05, 0.42], [0.32, 0.33, 0, 0.45], [0.08, 0.62, -0.05, 0.42], [-0.12, 0.3, -0.2, 0.4]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(geoSph, m); s.scale.set(w * r, h * r * 1.4, d * r); s.position.set(x * w, y * h, z * d); g.add(s);
    });
    return g;
  },
  vm(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const fill = new THREE.Mesh(geoBox, new THREE.MeshLambertMaterial({ color: dev.color, transparent: true, opacity: 0.35, depthWrite: false }));
    fill.scale.set(w, h, d); fill.position.y = h / 2; fill.userData.ownMaterial = fill.material; g.add(fill);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: dev.color }));
    edges.position.y = h / 2; edges.userData.ownGeometry = true; g.add(edges);
    return g;
  },
  cylinder(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const c = new THREE.Mesh(geoCyl, mat(dev.color)); c.scale.set(w, h, d); c.position.y = h / 2; g.add(c);
    return g;
  },
  rack(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const frame = mat(dev.color), panel = mat(shade(dev.color, 1.3));
    const t = 0.03;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(t, h, t, frame, sx * (w / 2 - t / 2), 0, sz * (d / 2 - t / 2)));
    g.add(box(w, t, d, panel, 0, h - t, 0));
    g.add(box(w, 0.06, d, frame, 0, 0, 0));
    g.add(box(0.008, h - 0.1, d - 2 * t, panel, -w / 2 + 0.004, 0.06, 0));
    g.add(box(0.008, h - 0.1, d - 2 * t, panel, w / 2 - 0.004, 0.06, 0));
    // front rails with U marks
    const units = dev.rackUnits || 42;
    const rail = mat('#3d434c');
    for (const sx of [-1, 1]) g.add(box(0.018, units * RACK_U, 0.015, rail, sx * 0.2413, 0.06, d / 2 - 0.06));
    return g;
  },
  desk(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    g.add(box(w, 0.03, d, mat(dev.color), 0, h - 0.03, 0));
    const leg = mat('#3a3a3a');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, h - 0.03, 0.04, leg, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05)));
    return g;
  },
  shelf(dev) {
    const g = new THREE.Group(); const { w, h, d } = dev.dims;
    const m = mat(dev.color);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.02, h, 0.02, m, sx * (w / 2 - 0.01), 0, sz * (d / 2 - 0.01)));
    for (const lv of (dev.levels || [0.4, 0.9, 1.4])) g.add(box(w, 0.015, d, m, 0, lv - 0.015, 0));
    return g;
  },
};

// ---------------------------------------------------------------- custom glTF models
// Saved templates are cached by id; editor previews by their template object.
// Entry: { p: Promise<Object3D>, scene: Object3D once loaded }
const gltfById = new Map(), gltfByObj = new WeakMap();
const cacheOf = tpl => (tpl.id ? [gltfById, tpl.id] : [gltfByObj, tpl]);
let loader = null;
function loadGltf(tpl) {
  if (!tpl?.modelData) return null;
  const [c, k] = cacheOf(tpl);
  if (!c.has(k)) {
    loader ||= new GLTFLoader();
    const e = {};
    e.p = new Promise((res, rej) => loader.load(tpl.modelData, gltf => { e.scene = gltf.scene; res(gltf.scene); }, undefined, rej));
    e.p.catch(() => {});
    c.set(k, e);
  }
  return c.get(k);
}
/** key: a template id, or the template object used for an editor preview */
export function forgetModel(key) { if (typeof key === 'object') gltfByObj.delete(key); else gltfById.delete(key); }

/** Fit an object into w*h*d with its base at y=0. */
function fitInto(obj, w, h, d) {
  const b = new THREE.Box3().setFromObject(obj);
  const size = b.getSize(new THREE.Vector3());
  const s = Math.min(w / (size.x || 1), h / (size.y || 1), d / (size.z || 1));
  obj.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  return obj;
}

/**
 * Build a model for a device. `tpl` is its template (for custom glTF models),
 * `linked` is a Set of port ids that have links (drives port LEDs),
 * `onAsync` is called once an async model has replaced the placeholder.
 */
export function buildModel(dev, tpl, linked, onAsync) {
  const root = new THREE.Group();
  const e = tpl && tpl.modelData ? loadGltf(tpl) : null;
  if (e?.scene) { root.add(fitInto(e.scene.clone(true), dev.dims.w, dev.dims.h, dev.dims.d)); return root; } // cached: no placeholder, no async rebuild
  const fn = builders[dev.shape] || builders.box;
  const placeholder = fn(dev, linked || new Set());
  root.add(placeholder);
  if (e) {
    e.p.then(scene => {
      const obj = fitInto(scene.clone(true), dev.dims.w, dev.dims.h, dev.dims.d);
      root.remove(placeholder); disposeTree(placeholder);
      root.add(obj); onAsync && onAsync();
    }).catch(() => {});
  }
  return root;
}

export function disposeTree(obj) {
  obj.traverse(o => {
    for (const k of ['ownMaterial', 'ownMaterial2']) if (o.userData[k]) { o.userData[k].map?.dispose(); o.userData[k].dispose(); }
    if (o.userData.ownGeometry) o.geometry.dispose();
  });
}

/** Scale used in the topology view so tiny and huge devices both read well. */
export function topoScale(dev) {
  const { w, h, d } = dev.dims;
  let s = 1.4 / Math.max(w, d, 0.01);
  if (h * s > 1.5) s = 1.5 / h;
  return s;
}

export { RACK_U };
