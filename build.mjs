// Build app/app.js and app/app.css from src/. The one place the build options live.
//   node build.mjs           build (npm run build)
//   node build.mjs --check   rebuild in memory, compare with the committed files, exit 1 if they differ
//   node build.mjs --watch   unminified build with a source map, rebuilt on each change (npm run dev)
// app/app.js is committed so the app runs without Node.js. The check makes sure it matches src/.
import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const OPTIONS = {
  entryPoints: [join(ROOT, 'src/main.js')],
  outfile: join(ROOT, 'app/app.js'),
  bundle: true, format: 'iife', minify: true, target: ['chrome90', 'firefox90'],
  logLevel: 'warning',
};

/** Files that differ between a fresh build and app/: [] when in sync. */
export async function staleFiles() {
  const r = await esbuild.build({ ...OPTIONS, write: false });
  const out = [];
  for (const f of r.outputFiles) {
    let disk = '';
    try { disk = readFileSync(f.path, 'utf8').replace(/\r\n/g, '\n'); } catch { /* missing = stale */ }
    if (disk !== f.text) out.push(relative(ROOT, f.path).replace(/\\/g, '/'));
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2];
  if (arg === '--check') {
    const stale = await staleFiles();
    if (stale.length) { console.error(`Out of date: ${stale.join(', ')}. Run: npm run build`); process.exit(1); }
    console.log('app/ matches src/');
  } else if (arg === '--watch') {
    const ctx = await esbuild.context({ ...OPTIONS, minify: false, sourcemap: true, logLevel: 'info' });
    await ctx.watch();
  } else {
    await esbuild.build(OPTIONS);
  }
}
