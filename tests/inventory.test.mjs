// Unit tests for the inventory: CSV parsing, import, export round trip.
// Run: npm test   (Node 18 or later, no browser needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvRows, parseCSV, applyImport, whereIs, inventoryItems } from '../src/inventory.js';
import { buildSampleLab } from '../src/sample.js';
import { normalizeLab, Library, warrantyState, isDeployed } from '../src/model.js';

const library = new Library();
const sample = () => normalizeLab(buildSampleLab());
const toCsv = rows => rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
const byName = (lab, n) => lab.devices.find(d => d.name === n);

/** A messy hand-made spreadsheet: BOM, semicolons, quoted newline, odd formats, bad values. */
function messyCsv(lab) {
  const rack = lab.devices.find(d => d.shape === 'rack').name;
  return '﻿Hostname;Status;Type;Manufacturer;Serial Number;Purchase Date;Price;Warranty Expires;IP;Room;Rack;U;Colour;Comments\n'
    + `nas-02;In use;Storage;Synology;SN123;2023/4/5;"1.234,50 €";2026-12-01;10.0.0.50/24;${lab.rooms[0].name};;;black;"line one\nline two"\n`
    + 'old-switch;decommissioned;network;Netgear;;05/04/2020;$80;;;;;;;\n'
    + 'Spare 4TB drive;spare;Parts;WD;WD-XYZ;2024-01-10;99.99;2027-01-10;;;;;;\n'
    + `new-1u;ordered;Compute;Dell;;;1,500.00;;eth0=10.0.0.60/24;;${rack};2;;\n`
    + 'bad-row;flying;Compute;;;2024-02-30;cheap;;999.1.1.1;Nowhere;;;;\n';
}

test('location text for a rack-mounted device', () => {
  const lab = sample();
  const d = lab.devices.find(x => x.phys.mount === 'rack');
  assert.match(whereIs(lab, d), /› .+ U\d+$/);
});

test('export then import onto the same lab changes nothing', () => {
  const lab = sample();
  const t = parseCSV(toCsv(csvRows(lab, inventoryItems(lab))));
  const before = JSON.stringify(lab);
  const r = applyImport(lab, t[0], t.slice(1), { library });
  assert.equal(r.added, 0);
  assert.equal(r.updated, 0);
  assert.equal(r.same, inventoryItems(lab).length);
  assert.deepEqual(r.warn, []);
  assert.equal(JSON.stringify(lab), before);
});

test('parser: BOM, semicolon separator, quoted newline and "" escapes', () => {
  const m = parseCSV(messyCsv(sample()));
  assert.equal(m.length, 6);
  assert.equal(m[0][0], 'Hostname');
  assert.equal(m[1][13], 'line one\nline two');
  assert.deepEqual(parseCSV('a,b\n"say ""hi""",2\n'), [['a', 'b'], ['say "hi"', '2']]);
  assert.deepEqual(parseCSV('a\tb\r\n1\t2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('messy spreadsheet import', async t => {
  const lab = sample();
  const m = parseCSV(messyCsv(lab));
  const r = applyImport(lab, m[0], m.slice(1), { library });
  assert.equal(r.added, 5);

  await t.test('nas-02: aliases, year-first date, European cost, IP, room, extra column', () => {
    const d = byName(lab, 'nas-02');
    assert.equal(d.inv.status, 'active');
    assert.equal(d.category, 'Storage');
    assert.equal(d.vendor, 'Synology');
    assert.equal(d.serial, 'SN123');
    assert.equal(d.inv.purchased, '2023-04-05');
    assert.equal(d.inv.cost, '1234.5');
    assert.equal(d.inv.warranty, '2026-12-01');
    assert.ok(d.ports.some(p => p.ip === '10.0.0.50/24'));
    assert.equal(d.phys.roomId, lab.rooms[0].id);
    assert.ok(d.attrs.some(a => a.k === 'Colour' && a.v === 'black'));
    assert.equal(d.notes, 'line one\nline two');
  });
  await t.test('old-switch: status word, lowercase category, $ cost, ambiguous date refused', () => {
    const d = byName(lab, 'old-switch');
    assert.equal(d.inv.status, 'retired');
    assert.ok(!isDeployed(d));
    assert.equal(d.category, 'Network');
    assert.equal(d.inv.cost, '80');
    assert.equal(d.inv.purchased, '');
    assert.ok(r.warn.some(w => w.includes('05/04/2020')));
  });
  await t.test('drive: generic part, no ports', () => {
    const d = byName(lab, 'Spare 4TB drive');
    assert.equal(d.templateId, 'part-item');
    assert.ok(d.physicalOnly);
    assert.equal(d.ports.length, 0);
    assert.equal(d.inv.status, 'spare');
  });
  await t.test('new-1u: becomes 1U, taken U falls back to the first free U', () => {
    const d = byName(lab, 'new-1u');
    assert.equal(d.inv.cost, '1500');
    assert.equal(d.ports.find(p => p.name === 'eth0')?.ip, '10.0.0.60/24');
    assert.equal(d.phys.mount, 'rack');
    assert.equal(d.uHeight, 1);
    assert.notEqual(d.phys.rackU, 2);
    assert.ok(r.warn.some(w => w.includes('U2') && w.includes('not free')));
  });
  await t.test('bad-row: every bad value refused with a warning, row still added', () => {
    const d = byName(lab, 'bad-row');
    assert.equal(d.inv.status, 'active');
    assert.equal(d.inv.purchased, '');
    assert.equal(d.inv.cost, '');
    assert.ok(!d.ports.some(p => p.ip));
    for (const s of ['flying', '2024-02-30', 'cheap', '999.1.1.1', 'Nowhere']) assert.ok(r.warn.some(w => w.includes(s)), s);
  });
  await t.test('same file again changes nothing', () => {
    const before = JSON.stringify(lab);
    applyImport(lab, m[0], m.slice(1), { library });
    assert.equal(JSON.stringify(lab), before);
  });
  await t.test('update off: existing rows are skipped', () => {
    const r2 = applyImport(lab, m[0], m.slice(1), { library, update: false });
    assert.equal(r2.skipped, 5);
    assert.equal(r2.added, 0);
  });
});

test('rows match by serial when the name is empty', () => {
  const lab = sample();
  const d = lab.devices.find(x => !x.physicalOnly);
  d.serial = 'ABC-1';
  const r = applyImport(lab, ['name', 'serial', 'asset tag'], [['', 'abc-1', 'T-42']], { library });
  assert.equal(r.updated, 1);
  assert.equal(r.added, 0);
  assert.equal(d.inv.assetTag, 'T-42');
});

test('warranty state', () => {
  const d = { inv: { warranty: '2026-12-01' } }, now = new Date(2026, 10, 25);
  assert.equal(warrantyState(d, now), 'soon');
  assert.equal(warrantyState({ inv: { warranty: '2026-11-24' } }, now), 'expired');
  assert.equal(warrantyState({ inv: { warranty: '2027-06-01' } }, now), 'ok');
  assert.equal(warrantyState({ inv: { warranty: '' } }, now), '');
});

test('cells that a spreadsheet would run as formulas are exported as text and import back unchanged', async () => {
  const { csvCell } = await import('../src/inventory.js');
  for (const v of ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)', '\tx']) {
    const cell = csvCell(v);
    assert.ok(cell.startsWith(`"'`), `${v} is guarded`);
    assert.deepEqual(parseCSV(`a\n${cell}\n`)[1], [v], `${v} imports back`);
  }
  assert.equal(csvCell('plain'), '"plain"');
  assert.equal(csvCell("it's"), `"it's"`);
  assert.deepEqual(parseCSV("a\n'quoted text\n")[1], ["'quoted text"], 'a leading quote before normal text is kept');
});
