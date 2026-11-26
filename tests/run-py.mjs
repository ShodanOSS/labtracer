// npm run test:py -> python -m unittest (python on Windows, python3 elsewhere; PYTHON overrides).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const r = spawnSync(python, ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], { cwd: root, stdio: 'inherit' });
if (r.error) { console.error(`Could not run ${python}: ${r.error.message}. Set PYTHON to your Python 3.`); process.exit(1); }
process.exit(r.status ?? 1);
