// Small shared helpers: DOM building, ids, IP math.

export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function clone(o) { return JSON.parse(JSON.stringify(o)); }

/** h('div', {class:'x', onclick:fn}, child, 'text', [more]) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  appendKids(el, children);
  return el;
}
function appendKids(el, kids) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendKids(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function download(filename, text, type = 'text/plain') {
  const blob = text instanceof Blob ? text : new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    if (accept) inp.accept = accept;
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

export function readFileText(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
}
export function readFileDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}

export function safeName(s, fb = 'untitled') {
  return (String(s || '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 80)) || fb;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- IPv4 math
export function ipToInt(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s).trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(p => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}
export function intToIp(n) {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}
export function maskToPrefix(mask) {
  const n = ipToInt(mask);
  if (n === null) return null;
  let p = 0, seenZero = false;
  for (let i = 31; i >= 0; i--) {
    const bit = (n >>> i) & 1;
    if (bit && seenZero) return null;
    if (bit) p++; else seenZero = true;
  }
  return p;
}
export function prefixToMask(p) { return p === 0 ? 0 : ((0xffffffff << (32 - p)) >>> 0); }

/** Parse "10.0.0.1/24", "10.0.0.1 255.255.255.0" or "10.0.0.1" (/32). */
export function parseCIDR(s) {
  if (!s) return null;
  s = String(s).trim();
  let ip, prefix;
  if (s.includes('/')) {
    const m = /^([^/\s]+)\/(\d{1,2})$/.exec(s); // "10.0.0.1/" or "1.2.3.4/24/5" is not valid
    if (!m) return null;
    ip = ipToInt(m[1]); prefix = Number(m[2]);
  } else if (/\s/.test(s)) {
    const [a, b] = s.split(/\s+/);
    ip = ipToInt(a); prefix = maskToPrefix(b);
  } else { ip = ipToInt(s); prefix = 32; }
  if (ip === null || prefix === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefixToMask(prefix);
  return { ip, prefix, mask, net: (ip & mask) >>> 0 };
}
export function inSubnet(ipInt, cidr) {
  return ((ipInt & cidr.mask) >>> 0) === cidr.net;
}
export function cidrString(c) { return intToIp(c.net) + '/' + c.prefix; }

/** "1,10-12,20" or "all" -> predicate */
export function vlanSet(spec) {
  const s = String(spec ?? 'all').trim().toLowerCase();
  if (!s || s === 'all') return () => true;
  if (s === 'none') return () => false;
  const ranges = [];
  for (const part of s.split(',')) {
    const [a, b] = part.split('-').map(x => parseInt(x, 10));
    if (Number.isFinite(a)) ranges.push([a, Number.isFinite(b) ? b : a]);
  }
  return v => ranges.some(([a, b]) => v >= a && v <= b);
}
