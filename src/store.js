// Persistence. "server" mode talks to server.py (files on disk).
// "local" mode (index.html opened directly) uses browser storage plus
// file import/export.
const HDR = { 'Content-Type': 'application/json', 'X-LabTracer': '1' };
const LS = 'labtracer.';

async function j(r) {
  if (!r.ok) {
    let m = r.statusText, body = null;
    try { body = await r.json(); m = body.error || m; } catch { /* ignore */ }
    // 409 is also "saved by a newer LabTracer" (body.newer): that is not a two-window conflict
    const e = new Error(m); e.conflict = r.status === 409 && !!body?.conflict; e.newer = !!body?.newer; throw e;
  }
  return r.json();
}

export const store = {
  mode: 'local',
  dataPath: '',
  versions: {}, // lab name -> version on disk when this page last loaded or saved it (server mode)
  async init() {
    if (location.protocol.startsWith('http')) {
      try {
        const r = await fetch('/api/ping', { cache: 'no-store' });
        if (r.ok) { const p = await r.json(); this.mode = 'server'; this.dataPath = p.data; return; }
      } catch { /* fall through */ }
    }
    this.mode = 'local';
  },
  async listLabs() {
    if (this.mode === 'server') return j(await fetch('/api/labs', { cache: 'no-store' }));
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(LS + 'lab.')) out.push({ name: k.slice((LS + 'lab.').length), size: (localStorage.getItem(k) || '').length, modified: 0 });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
  async loadLab(name) {
    if (this.mode === 'server') {
      const r = await fetch('/api/labs/' + encodeURIComponent(name), { cache: 'no-store' });
      const lab = await j(r);
      this.versions[name] = r.headers.get('X-LabTracer-Version') || 'new';
      return lab;
    }
    const s = localStorage.getItem(LS + 'lab.' + name);
    if (!s) throw new Error('no such lab');
    return JSON.parse(s);
  },
  /**
   * force: overwrite even if another window saved this lab since we loaded it.
   * keepCopy: keep a copy of the file that is replaced (the first save after a format upgrade).
   * oldVersion: its format version, for the name of the copy in browser storage.
   */
  async saveLab(name, lab, { force = false, keepCopy = false, oldVersion = null } = {}) {
    const body = JSON.stringify(lab);
    if (this.mode === 'server') {
      const headers = { ...HDR, 'X-LabTracer-Base': this.versions[name] || 'new' };
      if (force) headers['X-LabTracer-Force'] = '1';
      if (keepCopy) headers['X-LabTracer-Keep-Copy'] = '1';
      const res = await j(await fetch('/api/labs/' + encodeURIComponent(name), { method: 'PUT', headers, body }));
      if (res.version) this.versions[name] = res.version;
      return res;
    }
    const old = keepCopy ? localStorage.getItem(LS + 'lab.' + name) : null;
    if (old) { // shows in File > Open lab as "<name>.format1-backup"
      try { localStorage.setItem(`${LS}lab.${name}.format${oldVersion || 1}-backup`, old); } catch { throw new Error('Browser storage is full, so the copy of the old format can not be kept. Export the lab to a file.'); }
    }
    try { localStorage.setItem(LS + 'lab.' + name, body); } catch (e) { throw new Error('Browser storage is full. Export the lab to a file.'); }
    return { ok: true };
  },
  async deleteLab(name) {
    if (this.mode === 'server') {
      const res = await j(await fetch('/api/delete/' + encodeURIComponent(name), { method: 'POST', headers: HDR, body: '{}' }));
      delete this.versions[name];
      return res;
    }
    localStorage.removeItem(LS + 'lab.' + name); return { ok: true };
  },
  async loadLibrary() {
    if (this.mode === 'server') return j(await fetch('/api/library', { cache: 'no-store' }));
    try { return JSON.parse(localStorage.getItem(LS + 'library') || '{"templates":[]}'); } catch { return { templates: [] }; }
  },
  /** keepCopy: keep a copy of the library file that is replaced (the first save after a format upgrade). */
  async saveLibrary(lib, { keepCopy = false, oldVersion = null } = {}) {
    const body = JSON.stringify(lib);
    if (this.mode === 'server') return j(await fetch('/api/library', { method: 'PUT', headers: keepCopy ? { ...HDR, 'X-LabTracer-Keep-Copy': '1' } : HDR, body }));
    const old = keepCopy ? localStorage.getItem(LS + 'library') : null;
    try {
      if (old) localStorage.setItem(`${LS}library.format${oldVersion || 1}-backup`, old);
      localStorage.setItem(LS + 'library', body);
    } catch { throw new Error('Browser storage is full (large 3D models?).'); }
    return { ok: true };
  },
  /** files: [{device, name, content}] */
  async exportConfigs(labName, files) {
    if (this.mode === 'server') return j(await fetch('/api/export/' + encodeURIComponent(labName), { method: 'POST', headers: HDR, body: JSON.stringify({ files }) }));
    return null; // caller falls back to a .tar download
  },
  getPref(k, d) { try { const v = localStorage.getItem(LS + 'pref.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  setPref(k, v) { try { localStorage.setItem(LS + 'pref.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/** Minimal ustar writer so local mode can export a folder of configs. */
export function makeTar(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const field = (buf, off, len, str) => { const b = enc.encode(str); buf.set(b.slice(0, len), off); };
  const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0';
  for (const f of files) {
    const data = enc.encode(f.content);
    const h = new Uint8Array(512);
    let name = f.path; let prefix = '';
    if (name.length > 99) { const i = name.lastIndexOf('/', 154); prefix = name.slice(0, i); name = name.slice(i + 1); }
    field(h, 0, 100, name); field(h, 100, 8, oct(0o644, 8)); field(h, 108, 8, oct(0, 8)); field(h, 116, 8, oct(0, 8));
    field(h, 124, 12, oct(data.length, 12)); field(h, 136, 12, oct(Math.floor(Date.now() / 1000), 12));
    field(h, 148, 8, '        '); field(h, 156, 1, '0'); field(h, 257, 6, 'ustar\0'); field(h, 263, 2, '00'); field(h, 345, 155, prefix);
    let sum = 0; for (const x of h) sum += x;
    field(h, 148, 8, oct(sum, 7) + ' ');
    chunks.push(h, data);
    const padN = (512 - (data.length % 512)) % 512; if (padN) chunks.push(new Uint8Array(padN));
  }
  chunks.push(new Uint8Array(1024));
  return new Blob(chunks, { type: 'application/x-tar' });
}
