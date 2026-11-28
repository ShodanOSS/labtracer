// SPDX-License-Identifier: Apache-2.0
// Format versions of the files LabTracer writes, and the steps that bring an older file up
// to the current format. No DOM: tests/migrations.test.mjs runs it in Node.
//
// How to change the lab format (README: "Change the lab format"):
//  1. Add a step at the end of LAB_STEPS: { to: <last + 1>, note: 'what changed', up(lab) { ... } }.
//     A step changes structure only (rename, move, split or remove a field). New fields with a
//     default value need no step: normalizeLab() in model.js fills them in.
//  2. Write up() for exactly the previous format. Never change a step that has been released.
//  3. Save a lab in the new format as tests/fixtures/lab-v<to>.json and add its hash to
//     tests/fixtures/FROZEN.json (npm test prints it). Never edit an older fixture: the test
//     proves that real old files still open.
// The same rules apply to library.json (LIBRARY_STEPS, library-v<n>.json).

/** Lab files (data/labs/*.json and exported .labtracer.json). Empty: the format is still 1. */
export const LAB_STEPS = [
  // { to: 2, note: 'example: ports[].vlan becomes ports[].accessVlan', up(lab) { ... } },
];

/** The custom object library (data/library.json and exported template files). */
export const LIBRARY_STEPS = [];

const latest = steps => (steps.length ? steps[steps.length - 1].to : 1);
export const LAB_VERSION = latest(LAB_STEPS);
export const LIBRARY_VERSION = latest(LIBRARY_STEPS);

/** The file was written by a newer LabTracer. Opening it here could lose data, so it is refused. */
export class NewerFileError extends Error {
  constructor(what, version, current) {
    super(`this ${what} has format ${version}, but this LabTracer reads format ${current} or older. `
      + 'Update LabTracer, or reload the page if you updated it while this tab was open');
    this.name = 'NewerFileError';
    this.newer = true;
  }
}

/** Format version of a document. A file without one is format 1 (written before versions existed). */
export function versionOf(doc) {
  const v = doc?.version;
  return v === undefined || v === null ? 1 : v;
}

/**
 * Bring doc up to the format of the last step, in place.
 * Returns {doc, from, to}. Throws NewerFileError for a newer file, Error for a bad version.
 */
export function migrate(doc, steps, what = 'file') {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(`not a LabTracer ${what}`);
  const current = latest(steps);
  const from = versionOf(doc);
  if (!Number.isInteger(from) || from < 1) throw new Error(`the ${what} has an unknown format version: ${JSON.stringify(doc.version)}`);
  if (from > current) throw new NewerFileError(what, from, current);
  for (const s of steps) {
    if (s.to <= versionOf(doc)) continue;
    s.up(doc);
    doc.version = s.to;
  }
  doc.version = current;
  return { doc, from, to: current };
}

export const migrateLab = lab => migrate(lab, LAB_STEPS, 'lab');
export const migrateLibrary = lib => migrate(lib, LIBRARY_STEPS, 'library');

/** Template files: {version, templates}, or (older exports and hand-made files) a list or one template. */
export function libraryFromFile(data) {
  if (Array.isArray(data)) return migrateLibrary({ version: 1, templates: data }).doc;
  if (data && typeof data === 'object' && !Array.isArray(data.templates)) return migrateLibrary({ version: 1, templates: [data] }).doc;
  const lib = migrateLibrary(data).doc;
  if (!Array.isArray(lib.templates)) lib.templates = [];
  return lib;
}
