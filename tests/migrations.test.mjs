// Format versions and migrations (src/migrations.js).
// Run: npm test
//
// tests/fixtures holds one saved file for each format version. They are frozen: they stand
// for real files on users' disks, so a test must never "fix" them. To add a format, read
// the comment at the top of src/migrations.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LAB_STEPS, LIBRARY_STEPS, LAB_VERSION, LIBRARY_VERSION, migrate, migrateLab, migrateLibrary, libraryFromFile, versionOf,
} from '../src/migrations.js';
import { normalizeLab, newLab } from '../src/model.js';
import { inventoryItems } from '../src/inventory.js';
import { duplicateIps } from '../src/netsim.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const text = f => readFileSync(join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
const load = f => JSON.parse(text(f));
const sha = s => createHash('sha256').update(s).digest('hex');
const FROZEN = load('FROZEN.json');

test('fixtures are frozen: none was edited, each one is listed', () => {
  const files = readdirSync(DIR).filter(f => f !== 'FROZEN.json').sort();
  const unlisted = files.filter(f => !FROZEN[f]).map(f => `"${f}": "${sha(text(f))}"`);
  assert.deepEqual(unlisted, [], `add to tests/fixtures/FROZEN.json: ${unlisted.join(', ')}`);
  assert.deepEqual(files, Object.keys(FROZEN).sort(), 'a fixture listed in FROZEN.json is missing: never remove one');
  for (const f of files) assert.equal(sha(text(f)), FROZEN[f], `${f} was changed. Fixtures must stay as released. Hash of the current file: ${sha(text(f))}`);
});

for (const [name, steps, current] of [['lab', LAB_STEPS, LAB_VERSION], ['library', LIBRARY_STEPS, LIBRARY_VERSION]]) {
  test(`${name} steps are numbered 2, 3, 4… and each has a note`, () => {
    steps.forEach((s, i) => {
      assert.equal(s.to, i + 2, `step ${i} must have to: ${i + 2}`);
      assert.equal(typeof s.up, 'function');
      assert.ok(s.note, `step to ${s.to} needs a note`);
    });
    assert.equal(current, steps.length ? steps[steps.length - 1].to : 1);
  });

  test(`there is a ${name} fixture for every format, 1 to ${current}`, () => {
    for (let v = 1; v <= current; v++) assert.ok(FROZEN[`${name}-v${v}.json`], `save a ${name} in format ${v} as tests/fixtures/${name}-v${v}.json`);
  });
}

test('every lab fixture opens: migrated, normalized, usable', () => {
  for (const f of Object.keys(FROZEN).filter(f => f.startsWith('lab-'))) {
    const lab = load(f);
    const r = migrateLab(lab);
    assert.equal(r.from, +/v(\d+)/.exec(f)[1], `${f}: its own version`);
    assert.equal(lab.version, LAB_VERSION);
    normalizeLab(lab);
    const once = JSON.stringify(lab);
    assert.equal(JSON.stringify(normalizeLab(JSON.parse(once))), once, `${f}: normalizing again changes nothing`);
    assert.ok(lab.devices.length > 0 && lab.links.length > 0, `${f}: devices and links kept`);
    assert.ok(inventoryItems(lab).length > 0);
    duplicateIps(lab); // the simulator reads every port
    const d = lab.devices.find(x => x.files.some(y => y.name === 'wg0.conf'));
    assert.equal(d?.inv.assetTag, 'A-0001', `${f}: inventory fields kept`);
    assert.equal(d.files.find(y => y.name === 'wg0.conf').snapshots.length, 1, `${f}: config snapshots kept`);
  }
});

test('every library fixture opens', () => {
  for (const f of Object.keys(FROZEN).filter(f => f.startsWith('library-'))) {
    const lib = load(f);
    const r = migrateLibrary(lib);
    assert.equal(r.from, +/v(\d+)/.exec(f)[1]);
    assert.equal(lib.version, LIBRARY_VERSION);
    assert.ok(lib.templates.length > 0 && lib.templates.every(t => t.id && t.name && t.shape && t.ports));
  }
});

test('migrate: steps run in order, only the ones a file needs', () => {
  const log = [];
  const steps = [
    { to: 2, note: 'a', up: d => { log.push(2); d.b = d.a; delete d.a; } },
    { to: 3, note: 'b', up: d => { log.push(3); d.c = d.b * 10; } },
  ];
  const d1 = { a: 1 }; // no version: format 1
  assert.deepEqual(migrate(d1, steps), { doc: d1, from: 1, to: 3 });
  assert.deepEqual(d1, { b: 1, c: 10, version: 3 });
  assert.deepEqual(log, [2, 3]);
  log.length = 0;
  const d2 = { version: 2, b: 5 };
  migrate(d2, steps);
  assert.deepEqual(log, [3]); assert.equal(d2.c, 50);
  log.length = 0;
  const d3 = { version: 3, c: 1 };
  assert.deepEqual(migrate(d3, steps), { doc: d3, from: 3, to: 3 });
  assert.deepEqual(log, [], 'current format: nothing runs');
});

test('migrate: a newer file is refused and left unchanged', () => {
  const doc = { version: LAB_VERSION + 1, devices: [{ id: 'x' }], futureField: 1 };
  const before = JSON.stringify(doc);
  assert.throws(() => migrateLab(doc), e => e.newer === true && /newer LabTracer|format/.test(e.message));
  assert.equal(JSON.stringify(doc), before);
  assert.throws(() => normalizeLab(JSON.parse(before)), e => e.newer, 'normalizeLab refuses it too (it no longer relabels the version)');
  assert.throws(() => migrateLibrary({ version: LIBRARY_VERSION + 1, templates: [] }), e => e.newer);
});

test('migrate: bad versions are errors, not guesses', () => {
  for (const v of [0, -1, 1.5, '2', true, []]) assert.throws(() => migrateLab({ version: v, devices: [] }), /unknown format version/, JSON.stringify(v));
  for (const d of [null, [], 'lab']) assert.throws(() => migrateLab(d), /not a LabTracer lab/);
  assert.equal(versionOf({}), 1);
  assert.equal(versionOf({ version: null }), 1);
});

test('new labs are written in the current format', () => {
  assert.equal(newLab().version, LAB_VERSION);
});

test('template files: current export, older export, a list, one template', () => {
  const t = { id: 'cus_a', name: 'A', shape: 'box' };
  assert.deepEqual(libraryFromFile({ version: LIBRARY_VERSION, templates: [t] }).templates, [t]);
  assert.deepEqual(libraryFromFile({ templates: [t] }).templates, [t]);
  assert.deepEqual(libraryFromFile([t]).templates, [t]);
  assert.deepEqual(libraryFromFile({ ...t }).templates, [t]);
  assert.throws(() => libraryFromFile({ version: LIBRARY_VERSION + 1, templates: [] }), e => e.newer);
});
