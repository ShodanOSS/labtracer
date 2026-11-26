// The committed app/app.js and app/app.css must be the build of src/ (npm run build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staleFiles } from '../build.mjs';

test('app/ is built from the current src/', async () => {
  assert.deepEqual(await staleFiles(), [], 'Run: npm run build, then commit app/');
});
