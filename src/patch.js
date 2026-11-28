// SPDX-License-Identifier: Apache-2.0
// Structural diff and patch for JSON data (the lab document). Used by the undo history:
// it keeps the small change of each edit instead of a full copy of the lab.
//
// A patch is a list of operations. Paths are lists of segments: an object key (string),
// an array index (number), or {id} for an element of an array whose items all have a
// unique string id (devices, ports, links, rooms...). Ids keep a patch small when items
// are added, removed or reordered: the other items do not shift.
//
//   {p, v}           set the value at p (a copy of v)
//   {p, del: 1}      delete the key at p
//   {p, ids, add}    keyed array at p: new order of ids; items not in the array yet are in add
//   {p, len, tail}   plain array at p: cut or grow to len; tail is the new last items
//
// Values follow JSON rules (what a save writes): undefined properties do not exist.

const isObj = v => v !== null && typeof v === 'object';
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** Deep copy with JSON semantics, so a patch never shares objects with the lab. */
export const copy = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function keyed(arr) {
  const seen = new Set();
  for (const x of arr) {
    if (!isObj(x) || Array.isArray(x) || typeof x.id !== 'string' || seen.has(x.id)) return false;
    seen.add(x.id);
  }
  return true;
}

/** Operations that turn a into b. Neither input is changed. */
export function diff(a, b, path = [], out = []) {
  if (a === b) return out;
  if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) {
    if (Number.isNaN(a) && Number.isNaN(b)) return out;
    out.push({ p: path, v: copy(b) });
    return out;
  }
  if (Array.isArray(a)) {
    if ((a.length || b.length) && keyed(a) && keyed(b)) {
      const old = new Map(a.map(x => [x.id, x]));
      const same = a.length === b.length && b.every((x, i) => x.id === a[i].id);
      if (!same) {
        const add = {};
        for (const x of b) if (!old.has(x.id)) add[x.id] = copy(x);
        out.push({ p: path, ids: b.map(x => x.id), add });
      }
      for (const x of b) if (old.has(x.id)) diff(old.get(x.id), x, [...path, { id: x.id }], out);
      return out;
    }
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) diff(a[i], b[i], [...path, i], out);
    if (a.length !== b.length) out.push({ p: path, len: b.length, tail: copy(b.slice(n)) });
    return out;
  }
  for (const k of Object.keys(b)) {
    if (b[k] === undefined) continue;
    if (a[k] === undefined || !has(a, k)) out.push({ p: [...path, k], v: copy(b[k]) });
    else diff(a[k], b[k], [...path, k], out);
  }
  for (const k of Object.keys(a)) if (a[k] !== undefined && (!has(b, k) || b[k] === undefined)) out.push({ p: [...path, k], del: 1 });
  return out;
}

function step(node, seg) {
  if (isObj(seg)) return node.find(x => x?.id === seg.id);
  return node[seg];
}
/** Own property, also for the key "__proto__" (which plain assignment would treat as the prototype). */
function put(o, k, v) {
  if (k === '__proto__') Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true });
  else o[k] = v;
}

/** Apply a patch to root in place. Returns the root (a new one if the patch replaces it). */
export function apply(root, ops) {
  for (const op of ops) {
    if ('ids' in op || 'len' in op) {
      let arr = root;
      for (const s of op.p) arr = step(arr, s);
      if (!Array.isArray(arr)) throw new Error('patch does not fit: no array at ' + JSON.stringify(op.p));
      if ('ids' in op) {
        const have = new Map(arr.map(x => [x.id, x]));
        arr.splice(0, arr.length, ...op.ids.map(id => (has(op.add, id) ? copy(op.add[id]) : have.get(id))));
      } else {
        arr.length = op.len;
        op.tail.forEach((v, i) => { arr[op.len - op.tail.length + i] = copy(v); });
      }
      continue;
    }
    if (!op.p.length) { root = copy(op.v); continue; }
    let parent = root;
    for (const s of op.p.slice(0, -1)) parent = step(parent, s);
    const last = op.p[op.p.length - 1];
    if (!isObj(parent)) throw new Error('patch does not fit: no parent at ' + JSON.stringify(op.p));
    if (isObj(last)) { // replace a keyed item (diff does not make these, but keep apply total)
      const i = parent.findIndex(x => x?.id === last.id);
      if (op.del) parent.splice(i, 1); else parent[i] = copy(op.v);
    } else if (op.del) delete parent[last];
    else put(parent, last, copy(op.v));
  }
  return root;
}

/** Rough size in characters, to cap the memory of the undo history. */
export const patchSize = ops => JSON.stringify(ops).length;
