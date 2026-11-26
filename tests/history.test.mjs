// Unit tests for the diff-based undo history (src/patch.js, src/history.js).
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, apply, copy } from '../src/patch.js';
import { History, MAX_STEPS } from '../src/history.js';
import { buildSampleLab } from '../src/sample.js';
import { normalizeLab, createDevice, duplicateDevice, removeDevice, makePort, Library } from '../src/model.js';

const sample = () => normalizeLab(buildSampleLab());
const json = v => JSON.parse(JSON.stringify(v));
/** diff(a, b) applied to a copy of a must give b, and must not change a or b. */
function roundTrip(a, b) {
  const a0 = JSON.stringify(a), b0 = JSON.stringify(b);
  const ops = diff(a, b);
  assert.deepEqual(apply(copy(a), ops), json(b));
  assert.equal(JSON.stringify(a), a0); assert.equal(JSON.stringify(b), b0);
  return ops;
}

test('patch: objects, arrays, keys added and removed, type changes', () => {
  roundTrip({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3, d: [1, 2] }, e: null });
  roundTrip({ a: 1, gone: 'x', u: undefined }, { a: 2, u: 5 });
  roundTrip({ x: [1, 2, 3, 4] }, { x: [1, 9] });
  roundTrip({ x: [1] }, { x: [1, { y: 2 }, [3]] });
  roundTrip({ x: { y: 1 } }, { x: [1] });
  roundTrip({ x: null }, { x: { y: 1 } });
  roundTrip({ x: 'a' }, { x: undefined });
  assert.deepEqual(apply({ a: 1 }, diff({ a: 1 }, { b: 2 })), { b: 2 });
  assert.deepEqual(diff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), [], 'equal data: empty patch');
});

test('patch: items with ids are matched by id, not position', () => {
  const a = { list: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 3 }] };
  const ops = roundTrip(a, { list: [{ id: 'b', v: 2 }, { id: 'c', v: 30 }] });
  assert.equal(JSON.stringify(ops).includes('"v":2'), false, 'removing the first item does not rewrite the others');
  roundTrip(a, { list: [{ id: 'c', v: 3 }, { id: 'new', v: 0 }, { id: 'a', v: 1 }] });
  roundTrip(a, { list: [] });
  roundTrip({ list: [] }, a);
  roundTrip({ list: [{ id: 'a' }, { id: 'a' }] }, { list: [{ id: 'a', x: 1 }] }); // duplicate ids: by position
});

test('patch: a stored patch does not share objects with the data', () => {
  const a = { d: [] }, b = { d: [{ id: 'x', ports: [{ id: 'p', ip: '' }] }] };
  const ops = diff(a, b);
  b.d[0].ports[0].ip = 'changed later';
  assert.equal(apply(copy(a), ops).d[0].ports[0].ip, '');
  const target = copy(a); apply(target, ops);
  target.d[0].ports[0].ip = 'edited';
  assert.equal(apply(copy(a), ops).d[0].ports[0].ip, '', 'applying twice gives fresh copies');
});

test('patch: "__proto__" is an ordinary key', () => {
  const b = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}');
  const r = apply({}, diff({}, b));
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), JSON.parse(JSON.stringify(b)));
});

test('patch: real lab edits are small', () => {
  const a = sample(), b = copy(a);
  b.devices[0].name = 'renamed';
  const ops = roundTrip(a, b);
  assert.equal(ops.length, 1);
  assert.ok(JSON.stringify(ops).length < 200);
  const c = copy(a); removeDevice(c, c.devices[0].id);
  assert.ok(JSON.stringify(roundTrip(a, c)).length < JSON.stringify(a).length / 4, 'deleting a device does not copy the lab');
});

/** Deterministic random edits like the ones the app makes. */
function rng(seed) { return () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; }; }
function randomEdit(lab, r, library) {
  const pick = a => a[Math.floor(r() * a.length)];
  const d = pick(lab.devices);
  switch (Math.floor(r() * 10)) {
    case 0: d.name += 'x'; break;
    case 1: d.phys.x = Math.round(r() * 400) / 100; d.topo.z = Math.round(r() * 10); break;
    case 2: if (d.ports.length) pick(d.ports).ip = `10.0.${Math.floor(r() * 9)}.${Math.floor(r() * 250)}/24`; break;
    case 3: d.ports.push(makePort({ name: 'eth' + d.ports.length })); break;
    case 4: if (lab.devices.length > 3) removeDevice(lab, d.id); break;
    case 5: duplicateDevice(lab, d); break;
    case 6: lab.devices.push(createDevice(pick(library.all()), { name: 'new' + lab.devices.length })); break;
    case 7: d.routes.push({ dest: '0.0.0.0/0', via: '10.0.0.1', dev: '' }); if (r() < 0.5) d.routes.shift(); break;
    case 8: lab.devices.reverse(); break;
    case 9: if (d.monitor) delete d.monitor; else d.monitor = { enabled: true, host: '' }; break;
  }
}

test('history: 300 random edits, then undo all and redo all', () => {
  const library = new Library(), r = rng(42);
  const lab = sample(), states = [JSON.stringify(lab)];
  const h = new History(lab);
  let cur = lab;
  for (let i = 0; i < 300; i++) {
    randomEdit(cur, r, library);
    if (h.record(cur, 'edit ' + i)) states.push(JSON.stringify(cur));
  }
  const kept = h.undoStack.length;
  assert.equal(kept, Math.min(MAX_STEPS, states.length - 1));
  for (let i = 0; i < kept; i++) {
    const u = h.undo(); cur = u.lab;
    assert.equal(JSON.stringify(cur), states[states.length - 2 - i], `undo step ${i + 1}`);
  }
  assert.equal(h.undo(), null);
  for (let i = kept - 1; i >= 0; i--) cur = h.redo().lab;
  assert.equal(JSON.stringify(cur), states[states.length - 1]);
  assert.equal(h.redo(), null);
});

test('history: no change, no step; a new edit clears redo', () => {
  const lab = sample(), h = new History(lab);
  assert.equal(h.record(lab, 'nothing'), false);
  lab.notes = 'one'; h.record(lab, 'one');
  lab.notes = 'two'; h.record(lab, 'two');
  const u = h.undo();
  assert.equal(u.label, 'two'); assert.equal(u.lab.notes, 'one');
  assert.ok(h.canRedo);
  u.lab.notes = 'three'; h.record(u.lab, 'three');
  assert.equal(h.canRedo, false);
  assert.equal(h.undo().lab.notes, 'one');
});

test('history: the app\'s lab object is never shared with the history', () => {
  const lab = sample(), h = new History(lab);
  lab.notes = 'a'; h.record(lab, 'a');
  lab.devices[0].name = 'edited without commit';
  const u = h.undo();
  assert.notEqual(u.lab.devices[0].name, 'edited without commit');
  u.lab.devices[0].name = 'mutating the returned lab';
  assert.equal(h.redo().lab.devices[0].name, sample().devices[0].name);
});

test('history: memory stays far below full copies', () => {
  const lab = sample(), h = new History(lab);
  const big = 'x'.repeat(50000);
  lab.devices[0].files.push({ id: 'f1', name: 'big.conf', content: big, snapshots: [] }); h.record(lab, 'big file');
  for (let i = 0; i < 100; i++) { lab.devices[1].name = 'n' + i; h.record(lab, 'rename'); }
  const full = JSON.stringify(lab).length * h.undoStack.length;
  assert.ok(h.chars < full / 20, `history ${h.chars} chars vs ${full} for full copies`);
});
