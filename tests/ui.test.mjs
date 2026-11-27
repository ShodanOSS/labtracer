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
  for (const f of ['server.py', 'ssh_bridge.py', 'guac.py', 'monitoring.py', 'collector']) cpSync(join(ROOT, f), join(tmp, f), { recursive: true });
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
    p.on('console', m => { if (m.type() === 'error' && !/status of (409|422)/.test(m.text())) errors.push(m.text()); }); // 409, 422 = intended conflict and damaged-lab tests
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

  await t.test('every view, panel and inspector tab renders', async () => {
    await page.bringToFront();
    await page.keyboard.press('Escape'); await page.keyboard.press('1'); await sleep(300);
    await page.evaluate(() => { const a = window.labtracer; a.select({ type: 'device', id: a.lab.devices.find(x => x.l2 && x.ports.length > 1 && !x.physicalOnly && x.inv.status === 'active').id }); });
    const tabs = await page.$$eval('#inspector .tabs .tab', t => t.map(x => x.textContent));
    assert.equal(tabs.length, 9);
    for (let i = 0; i < tabs.length; i++) {
      await page.evaluate(i => document.querySelectorAll('#inspector .tabs .tab')[i].click(), i); await sleep(80);
      assert.ok(await page.$eval('#inspector .insp-body', e => e.children.length > 0), `${tabs[i]} tab has content`);
    }
    await page.evaluate(() => { const a = window.labtracer; a.inspector.tab = 'ports'; a.inspector.render(); document.querySelector('#inspector .prow:not(.head) .mini').click(); });
    assert.ok(await page.$('#inspector .pdetail'), 'port details open');
    await page.evaluate(() => { const a = window.labtracer; a.select({ type: 'link', id: a.lab.links[0].id }); });
    assert.match(await page.$eval('#inspector .title', e => e.textContent), /↔/);
    await page.evaluate(() => window.labtracer.select(null));
    assert.match(await page.$eval('#inspector', e => e.textContent), /Address plan/);
    await page.keyboard.press('2'); await sleep(400);
    await page.evaluate(() => { const a = window.labtracer; const r = a.lab.devices.find(x => x.shape === 'rack'); a.setRoom(a.lab.devices.find(x => x.shape === 'rack').phys.roomId); a.inspector.tab = 'physical'; a.select({ type: 'device', id: r.id }); });
    assert.ok(await page.$('#inspector .rack-el'), 'rack elevation');
    assert.ok(await page.evaluate(() => window.labtracer.viewport.objs.size > 0), 'room view draws devices');
    await page.keyboard.press('l');
    assert.match(await page.$eval('#status-left', e => e.textContent), /Link tool/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.labtracer.fileMenu(document.getElementById('btn-file')));
    assert.ok(await page.$('.popup'), 'File menu');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.labtracer.settingsDialog());
    assert.match(await page.$eval('.modal', e => e.textContent), /Render resolution cap/);
    await page.click('.modal .btn.primary'); await sleep(100);
    await page.keyboard.press('1'); await sleep(300);
  });

  await t.test('drift: facts from a device, accept into the model, undo', async () => {
    const facts = JSON.parse(readFileSync(join(ROOT, 'tests/collect-fixtures/ios-switch.facts.json'), 'utf8'));
    const vlan = () => page.evaluate(() => { const a = window.labtracer; return a.lab.devices.find(d => d.name === 'rack-switch').ports.find(p => p.name === 'Gi0/3').vlan; });
    await page.evaluate(f => {
      const a = window.labtracer, d = a.lab.devices.find(x => x.name === 'rack-switch');
      a.collect.facts.set(d.id, f); a.onDriftChanged();
      a.inspector.tab = 'drift'; a.select({ type: 'device', id: d.id });
    }, facts);
    // labels are made on the next animation frame, which a background tab does not get
    await page.bringToFront();
    await page.waitForFunction(() => [...document.querySelectorAll('.lbl')].some(e => /^Δ\d+$/.test(e.getAttribute('data-drift') || '')), { timeout: 5000 })
      .catch(() => assert.fail('drift badge on the label'));
    const row = await page.evaluateHandle(() => [...document.querySelectorAll('#inspector .drow')].find(r => /Gi0\/3 is in VLAN 30/.test(r.textContent)));
    assert.ok(await row.evaluate(r => !!r), 'the VLAN difference is listed');
    assert.equal(await vlan(), 1);
    await row.evaluate(r => r.querySelector('.mini.txt').click()); await sleep(150);
    assert.equal(await vlan(), 30, 'accept changes the model');
    assert.ok(!(await page.$eval('#inspector', e => /Gi0\/3 is in VLAN 30/.test(e.textContent))), 'the item is gone');
    await page.click('#status-left'); await ctrl('z'); await sleep(150);
    assert.equal(await vlan(), 1, 'undo');
    // push: server.py renders the commands from operations; the user reviews them
    await page.evaluate(() => { const a = window.labtracer, d = a.lab.devices.find(x => x.name === 'rack-switch'); d.collect = { enabled: true, driver: 'ios', ignore: [] }; a.inspector.render(); });
    const push = await page.evaluateHandle(() => [...document.querySelectorAll('#inspector .drow')].find(r => /Gi0\/3 is in VLAN 30/.test(r.textContent)).querySelector('.push'));
    await push.evaluate(b => b.click());
    await page.waitForSelector('.modal', { timeout: 15000 }); // the first plan loads paramiko in server.py: that can take seconds
    const review = await page.$eval('.modal', e => e.textContent);
    assert.match(review, /Push to rack-switch/);
    assert.match(review, /interface GigabitEthernet0\/3\s+switchport mode access\s+switchport access vlan 1/, 'the rendered IOS commands');
    assert.ok(await page.$$eval('.modal .btn', b => b.some(x => x.textContent === 'Send to console')));
    await page.keyboard.press('Escape'); await sleep(100);
    assert.equal(await vlan(), 1, 'reviewing changes nothing');
    // stage: the change goes into a change set on the server, reviewed with the others before it runs
    await page.evaluate(() => [...document.querySelectorAll('#inspector .drow')].find(r => /Gi0\/3 is in VLAN 30/.test(r.textContent))
      .querySelectorAll('.mini.txt').forEach(b => { if (b.textContent === 'stage') b.click(); }));
    await page.waitForFunction(() => window.labtracer.changes.current?.items.length === 1 && /1 staged/.test(document.getElementById('inspector').textContent), { timeout: 15000 })
      .catch(() => assert.fail('the Drift tab shows the staged change'));
    await page.evaluate(() => window.labtracer.changes.review());
    const staged = await page.$eval('.modal', e => e.textContent);
    assert.match(staged, /Review staged changes/);
    assert.match(staged, /switchport access vlan 1/);
    assert.match(staged, /rollback timer/);
    await page.evaluate(() => [...document.querySelectorAll('.modal .btn')].find(b => b.textContent === 'Discard').click());
    await page.waitForSelector('.modal .btn.danger'); // the confirmation
    await page.evaluate(() => [...document.querySelectorAll('.modal .btn.danger')].pop().click());
    await page.waitForFunction(() => !window.labtracer.changes.current && !document.querySelector('.modal'), { timeout: 5000 });
    await page.evaluate(() => window.labtracer.changes.audit());
    await page.waitForSelector('.modal .audit');
    const log = await page.$eval('.modal', e => e.textContent);
    assert.match(log, /chain intact/);
    assert.match(log, /change set discarded/);
    await page.keyboard.press('Escape'); await sleep(100);
    // remote access form (Guacamole); the client script is served, but loaded only for a session
    await page.evaluate(() => {
      const a = window.labtracer, d = a.lab.devices.find(x => x.name === 'rack-switch');
      a.inspector.tab = 'console'; a.inspector.conMode.set(d.id, 'remote'); a.select({ type: 'device', id: d.id });
    });
    assert.match(await page.$eval('#inspector', e => e.textContent), /Needs guacd/);
    assert.ok(await page.evaluate(() => !window.Guacamole), 'guac.js is not loaded until a session opens');
    assert.ok(await page.evaluate(async () => (await fetch('/guac.js')).ok), 'guac.js is served');
    await page.evaluate(() => { const a = window.labtracer; a.inspector.conMode.set(a.selection.id, 'sim'); a.inspector.tab = 'drift'; a.inspector.render(); });
    assert.ok(await page.evaluate(() => window.labtracer.events.connected), 'the live events WebSocket is open');
    await page.evaluate(() => { const a = window.labtracer; a.select(null); });
    const panel = await page.$eval('#inspector', e => e.textContent);
    for (const s of [/Drift: model vs devices/, /Discover network/, /Changes and audit/, /Remote access \(Guacamole\)/, /Status from/])
      assert.match(panel, s);
    await page.evaluate(() => { const a = window.labtracer; a.collect.facts.clear(); a.onDriftChanged(); });
  });

  await t.test('Nagios: export the config, show Nagios results', async () => {
    await page.evaluate(() => { const a = window.labtracer; a.select(null); });
    await page.evaluate(() => { const s = document.querySelector('#inspector [data-k="nag-host"]'); s.value = window.labtracer.lab.devices.find(d => d.name === 'dc-01').id; s.dispatchEvent(new Event('change')); });
    await sleep(100);
    assert.match(await page.$eval('#inspector', e => e.textContent), /\d+ hosts, \d+ services/);
    const lab = await page.evaluate(() => window.labtracer.labName);
    await page.evaluate(() => [...document.querySelectorAll('#inspector .btn')].find(b => b.textContent === 'Export').click()); await sleep(600);
    const cfg = readFileSync(join(tmp, 'data', 'export', lab, 'nagios', `labtracer-${lab}.cfg`), 'utf8');
    assert.match(cfg, /host_name\s+srv-01[\s\S]*?parents\s+edge-router/, 'parents from the cabling');
    // the agent with source "nagios": an unreachable host is grey, not red
    const shown = await page.evaluate(() => {
      const a = window.labtracer, m = a.monitor, d = a.lab.devices.find(x => x.name === 'plug-01'), now = Math.floor(Date.now() / 1000);
      m.live = true; m.receivedAt = Date.now();
      m.status = { source: 'nagios', nagiosHosts: ['plug-01', 'old-printer'], error: '', interval: 30, generated: now, now, targets: 1,
        devices: { [d.id]: { name: d.name, state: 'unknown', nagiosState: 'UNREACHABLE', since: now, history: [],
          checks: [{ type: 'nagios', host: 'plug-01', label: 'host', state: 'UNREACHABLE', ok: false, ms: null, err: 'CRITICAL - Host Unreachable' }] } } };
      a.inspector.tab = 'monitor'; a.select({ type: 'device', id: d.id });
      const tab = document.querySelector('#inspector').textContent;
      a.select(null);
      const panel = document.querySelector('#inspector').textContent;
      m.stop();
      return { tab, panel };
    });
    assert.match(shown.tab, /Nagios: UNREACHABLE/);
    assert.match(shown.tab, /a parent of this host is down/);
    assert.match(shown.panel, /In Nagios but not in the lab: old-printer/);
  });

  await t.test('undo and redo a move', async () => {
    const r = await page.evaluate(() => {
      const a = window.labtracer, d = a.lab.devices.find(x => !x.physicalOnly && x.inv.status === 'active');
      const x0 = d.topo.x; d.topo.x = x0 + 3; a.afterDrag(d);
      return { id: d.id, x0 };
    });
    const x = () => page.evaluate(id => [window.labtracer.lab.devices.find(d => d.id === id).topo.x, window.labtracer.viewport.objs.get(id).root.position.x], r.id);
    assert.deepEqual(await x(), [r.x0 + 3, r.x0 + 3]);
    await page.click('#status-left'); await ctrl('z'); await sleep(150);
    assert.deepEqual(await x(), [r.x0, r.x0], 'undo moves it back, in the model and in the view');
    await ctrl('y'); await sleep(150);
    assert.deepEqual(await x(), [r.x0 + 3, r.x0 + 3], 'redo');
  });

  await t.test('a damaged lab file does not stop the app', async () => {
    writeFileSync(join(tmp, 'data', 'labs', 'aaa-damaged.json'), '{"devices": [');
    await page.evaluate(() => localStorage.setItem('labtracer.pref.lastLab', '"aaa-damaged"'));
    const p3 = await open();
    assert.equal(await p3.evaluate(() => window.labtracer.labName), 'example-lab', 'the next lab opens');
    assert.match(await p3.$eval('body', e => e.textContent), /aaa-damaged.json is damaged/, 'the user is told why');
    await p3.close();
  });

  await t.test('dragging a device rebuilds only its own cables', async () => {
    await page.bringToFront(); await page.keyboard.press('Escape'); await page.keyboard.press('1'); await sleep(300);
    // a device with cables, at a screen point where the picker finds it
    const hit = await page.evaluate(() => {
      const a = window.labtracer, vp = a.viewport, r = vp.renderer.domElement.getBoundingClientRect();
      for (const [id, o] of vp.objs) {
        const d = a.lab.devices.find(x => x.id === id);
        if (![...vp.linkObjs.values()].some(lo => lo.a === id || lo.b === id)) continue; // needs a drawn cable
        const v = o.root.position.clone(); v.y += d.dims.h * o.scale * 0.5; v.project(vp.camera);
        const p = { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height };
        if (vp.pick(p)?.id === id) {
          window.__groups = new Map([...vp.linkObjs].map(([k, lo]) => [k, lo.group]));
          return { id, x: p.clientX, y: p.clientY, x0: d.topo.x };
        }
      }
      return null;
    });
    assert.ok(hit, 'found a device to drag');
    await page.mouse.move(hit.x, hit.y); await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(hit.x + i * 15, hit.y + i * 4); await sleep(30); }
    await page.mouse.up(); await sleep(200);
    const r = await page.evaluate(id => {
      const a = window.labtracer, vp = a.viewport, same = [], rebuilt = [], stale = [];
      for (const [lid, lo] of vp.linkObjs) {
        const l = a.lab.links.find(x => x.id === lid), mine = l.a.dev === id || l.b.dev === id;
        const kept = window.__groups.get(lid) === lo.group;
        (mine ? (kept ? stale : rebuilt) : (kept ? same : stale)).push(lid);
      }
      return { x: a.lab.devices.find(d => d.id === id).topo.x, same: same.length, rebuilt: rebuilt.length, stale: stale.length, total: vp.linkObjs.size, children: vp.linkGroup.children.length };
    }, hit.id);
    assert.notEqual(r.x, hit.x0, 'the device moved');
    assert.ok(r.rebuilt > 0, 'its cables were rebuilt');
    assert.ok(r.same > 0, 'the other cables were kept');
    assert.equal(r.stale, 0, 'no cable kept by mistake, none rebuilt by mistake');
    assert.equal(r.children, r.total, 'no orphan cable objects left in the scene');
    await page.click('#status-left'); await ctrl('z'); await sleep(150);
  });

  await t.test('side panels: click to hide and show, drag to resize, keys, kept after reload', async () => {
    const w = (p = page) => p.evaluate(() => ({
      left: document.getElementById('palette').getBoundingClientRect().width,
      right: document.getElementById('inspector').getBoundingClientRect().width,
      view: document.getElementById('viewport').getBoundingClientRect().width,
      canvas: window.labtracer.viewport.renderer.domElement.clientWidth,
    }));
    const box = async side => page.$eval(`.split[data-side="${side}"]`, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const click = async side => { const b = await box(side); await page.mouse.click(b.x, b.y); await sleep(250); };
    const w0 = await w();
    await click('left');
    let w1 = await w();
    assert.equal(w1.left, 0, 'click hides the library');
    assert.ok(w1.view > w0.view + w0.left - 20, 'the view takes the space');
    // the canvas follows on the next ResizeObserver callback: wait for it, a busy machine can take a while
    const grew = await page.waitForFunction(min => window.labtracer.viewport.renderer.domElement.clientWidth > min, { timeout: 5000 }, w0.canvas + 100).then(() => true, () => false);
    assert.ok(grew, `the 3D canvas follows the new size: ${JSON.stringify([w0, await w()])}`);
    await click('left');
    assert.equal((await w()).left, w0.left, 'click shows it again at the same width');

    const b = await box('right');
    await page.mouse.move(b.x, b.y); await page.mouse.down();
    for (let i = 1; i <= 5; i++) { await page.mouse.move(b.x - i * 20, b.y); await sleep(20); }
    await page.mouse.up(); await sleep(250);
    w1 = await w();
    assert.ok(Math.abs(w1.right - (w0.right + 100)) <= 2, `drag widens the properties panel (${w0.right} -> ${w1.right})`);
    assert.ok(await page.$eval('main', e => !e.classList.contains('right-off')), 'a drag is not a click');

    await page.keyboard.press(']'); await sleep(200);
    assert.equal((await w()).right, 0, '] hides the properties panel');
    assert.ok(await page.$eval('#inspector', e => e.inert), 'a hidden panel takes no focus');
    await page.keyboard.press('['); await sleep(200);
    const p2 = await open();
    const saved = await w(p2);
    assert.equal(saved.left, 0, 'hidden library kept after reload');
    assert.equal(saved.right, 0, 'hidden properties panel kept after reload');
    await p2.close();
    await page.bringToFront();
    await page.keyboard.press(']'); await sleep(200);
    assert.ok(Math.abs((await w()).right - w1.right) <= 2, 'shown again at the dragged width');
    await page.keyboard.press(']'); await sleep(200);
    await page.evaluate(() => { const a = window.labtracer; a.openConsole(a.lab.devices.find(d => !d.physicalOnly && d.inv.status === 'active').id); });
    await sleep(200);
    assert.ok((await w()).right > 0, 'opening a console shows the hidden properties panel');
    await page.keyboard.press('['); await sleep(200); // leave both panels open
    await page.evaluate(() => { const a = window.labtracer; a.panels.state.right.w = null; a.panels.apply(); a.panels.save(); });
  });

  await t.test('a lab from a newer LabTracer is refused and not changed', async () => {
    const file = join(tmp, 'data', 'labs', 'aaa-newer.json');
    const newer = JSON.stringify({ version: 99, name: 'aaa-newer', rooms: [], devices: [], links: [], futureField: { keep: true } });
    writeFileSync(file, newer);
    await page.evaluate(() => localStorage.setItem('labtracer.pref.lastLab', '"aaa-newer"'));
    const p3 = await open();
    assert.equal(await p3.evaluate(() => window.labtracer.labName), 'example-lab', 'another lab opens');
    assert.match(await p3.$eval('body', e => e.textContent), /aaa-newer: this lab has format 99/, 'the user is told why');
    await p3.evaluate(() => window.labtracer.save(true)); await sleep(300);
    assert.equal(readFileSync(file, 'utf8'), newer, 'the newer file is untouched');
    await p3.close();
  });

  await t.test('no page errors', () => assert.deepEqual(errors, []));
});
