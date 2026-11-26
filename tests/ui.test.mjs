// Browser test: drives the real app in headless Edge or Chrome.
// Run: npm run test:ui
// Needs: Python 3, puppeteer-core (npm install), and Edge, Chrome or Chromium on this computer.
// Set LABTRACER_BROWSER to the browser executable if it is not found. The test is skipped without a browser.
// It starts server.py in a temporary copy of the app, so your data/ folder is never touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = [
  process.env.LABTRACER_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
].filter(Boolean);
const browserPath = BROWSERS.find(p => existsSync(p));
let puppeteer = null;
try { puppeteer = (await import('puppeteer-core')).default; } catch { /* not installed */ }
const skip = !browserPath ? 'no Edge, Chrome or Chromium found (set LABTRACER_BROWSER)' : !puppeteer ? 'puppeteer-core is not installed (npm install)' : false;

const CSV = 'Hostname;Status;Type;Manufacturer;Purchase Date;Price;Warranty Expires;IP\n'
  + 'nas-02;In use;Storage;Synology;2023/4/5;"1.234,50 €";2026-12-01;10.0.0.50/24\n'
  + 'old-switch;decommissioned;network;Netgear;;$80;;\n'
  + 'Spare 4TB drive;spare;Parts;WD;2024-01-10;99.99;2025-01-10;\n';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
async function waitForPort(port, ms = 15000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(150)) {
    const up = await new Promise(res => { const c = connect(port, '127.0.0.1', () => { c.end(); res(true); }); c.on('error', () => res(false)); });
    if (up) return;
  }
  throw new Error(`server did not start on port ${port}`);
}

/**
 * Start the browser and connect to its DevTools port. Not puppeteer.launch(): some Edge
 * versions hand off to another process and the first one exits, which launch() reports
 * as a failure. Port 0 lets the browser pick a port; it writes it to DevToolsActivePort.
 */
async function startBrowser(profile) {
  const proc = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--use-angle=swiftshader',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--window-size=1500,900', 'about:blank'], { stdio: 'ignore' });
  proc.on('error', () => {});
  const file = join(profile, 'DevToolsActivePort');
  for (const end = Date.now() + 20000; Date.now() < end; await sleep(150)) {
    if (!existsSync(file)) continue;
    const port = readFileSync(file, 'utf8').split('\n')[0].trim();
    if (!port) continue;
    try { return await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: { width: 1500, height: 900 } }); } catch { /* not ready yet */ }
  }
  proc.kill();
  throw new Error(`could not start ${browserPath}`);
}

test('LabTracer in a browser',{ skip, timeout: 120000 }, async t => {
  const tmp = mkdtempSync(join(tmpdir(), 'labtracer-ui-'));
  for (const f of ['server.py', 'ssh_bridge.py']) cpSync(join(ROOT, f), join(tmp, f));
  cpSync(join(ROOT, 'app'), join(tmp, 'app'), { recursive: true });
  const csvFile = join(tmp, 'messy.csv'); writeFileSync(csvFile, CSV);
  const port = await freePort();
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const server = spawn(python, ['server.py', '--port', String(port), '--no-browser'], { cwd: tmp, stdio: 'ignore' });
  const browser = await waitForPort(port).then(() => startBrowser(join(tmp, 'profile'))).catch(e => { server.kill(); throw e; });
  t.after(async () => {
    await browser.close().catch(() => {}); // closes the whole browser, also the handed-off process
    server.kill();
    // Windows keeps the profile locked for a moment after the browser exits
    for (let i = 0; ; i++) {
      try { rmSync(tmp, { recursive: true, force: true }); break; } catch (e) {
        if (i >= 30) { console.warn(`Could not remove ${tmp}: ${e.code}. Delete it later.`); break; }
        await sleep(500);
      }
    }
  });

  const errors = [];
  const open = async () => {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/status of 409/.test(m.text())) errors.push(m.text()); }); // 409 = intended conflict test
    await p.goto(`http://127.0.0.1:${port}/`);
    await p.waitForFunction(() => window.labtracer?.lab, { timeout: 15000 });
    await sleep(600);
    return p;
  };
  const page = await open();
  const state = () => page.evaluate(() => ({
    rows: document.querySelectorAll('.inv-table tbody tr').length,
    items: window.labtracer.lab.devices.filter(d => !d.logical).length,
    inv: window.labtracer.inventoryOn,
  }));
  const ctrl = async key => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); };

  await t.test('key 3 opens the inventory with one row per item', async () => {
    await page.keyboard.press('3'); await sleep(300);
    const s = await state();
    assert.ok(s.inv);
    assert.equal(s.rows, s.items);
    assert.ok(await page.$eval('#btn-fit', e => getComputedStyle(e).display === 'none'), '3D-only buttons hidden');
    assert.ok(await page.$eval('.lbl-layer', e => getComputedStyle(e).display === 'none'), '3D labels hidden');
  });

  await t.test('clicking a column name sorts', async () => {
    await page.click('.inv-table th'); await sleep(150);
    const names = await page.$$eval('.inv-table tbody tr td:first-child', c => c.map(x => x.textContent.toLowerCase()));
    assert.deepEqual(names, [...names].sort((a, b) => b.localeCompare(a)));
  });

  let target;
  await t.test('a spare device leaves the 3D view', async () => {
    target = await page.evaluate(() => window.labtracer.lab.devices.find(d => !d.physicalOnly && !d.logical && !d.virtual).id);
    await page.click(`tr[data-id="${target}"]`); await sleep(200);
    assert.ok(await page.$eval(`tr[data-id="${target}"]`, e => e.classList.contains('on')), 'row selected');
    await page.select('#inspector [data-k="inv-status"]', 'spare'); await sleep(300);
    assert.ok(await page.$eval(`tr[data-id="${target}"]`, e => e.classList.contains('stored') && e.textContent.includes('Spare')));
    await page.keyboard.press('1'); await sleep(400);
    assert.ok(await page.evaluate(id => !window.labtracer.viewport.objs.has(id) && window.labtracer.viewport.objs.size > 0, target));
    assert.ok(await page.$eval('.inv', e => e.hidden), 'inventory hidden in topology');
    await page.keyboard.press('3'); await sleep(300);
  });

  let base;
  await t.test('"+ Add item" adds a part', async () => {
    base = (await state()).items;
    await page.click('.inv-bar .btn.primary'); await sleep(200);
    await page.type('.modal input.inp', 'test-drive-01');
    await page.click('.modal .btn.primary'); await sleep(300);
    assert.equal((await state()).items, base + 1);
    assert.ok(await page.evaluate(() => window.labtracer.lab.devices.some(d => d.name === 'test-drive-01' && d.templateId === 'part-item')));
  });

  await t.test('CSV import: preview, import, search, undo', async () => {
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('.inv-bar .btn:nth-of-type(2)')]);
    await chooser.accept([csvFile]); await sleep(500);
    const preview = await page.$eval('.modal', e => e.textContent);
    assert.match(preview, /3 new/);
    assert.doesNotMatch(preview, /null/);
    await page.click('.modal .btn.primary'); await sleep(400);
    assert.equal((await state()).items, base + 4);
    assert.ok(await page.evaluate(() => window.labtracer.lab.devices.find(d => d.name === 'nas-02')?.inv.cost === '1234.5'));
    assert.ok(await page.$eval('.inv-sum', e => /warranty expired/.test(e.textContent)));
    await page.type('.inv-search input', 'synology'); await sleep(200);
    assert.equal((await state()).rows, 1);
    await page.click('.inv-sum .mini.txt'); await sleep(200);
    await page.click('#viewport'); await ctrl('z'); await sleep(300);
    assert.equal((await state()).items, base + 1, 'Ctrl+Z undoes the whole import');
    await ctrl('s'); await sleep(600);
  });

  await t.test('two windows: the stale one cannot overwrite silently', async () => {
    const page2 = await open();
    assert.ok(await page2.evaluate(() => window.labtracer.inventoryOn), 'saved view mode restored');
    assert.ok(await page2.evaluate(id => window.labtracer.lab.devices.find(d => d.id === id).inv.status === 'spare', target), 'status saved');
    await page2.evaluate(async () => { const a = window.labtracer; a.lab.notes = 'from window 2'; a.commit('x'); await a.save(true); });
    await page.bringToFront(); // headless: background tabs get no input
    await page.evaluate(async () => { const a = window.labtracer; a.lab.notes = 'from window 1'; a.commit('y'); await a.save(true); });
    await sleep(200);
    assert.ok(await page.evaluate(() => window.labtracer.conflict && /another window/.test(document.getElementById('status-right').textContent)), 'autosave refused, status bar warns');
    await page.evaluate(() => { window.labtracer.save(); }); await sleep(400);
    assert.match(await page.$eval('.modal', e => e.textContent), /changed in another window/i);
    await page.click('.modal .btn.danger'); await sleep(600);
    assert.ok(await page.evaluate(() => !window.labtracer.conflict && !window.labtracer.dirty), 'Replace saves');
  });

  await t.test('no page errors', () => assert.deepEqual(errors, []));
});
