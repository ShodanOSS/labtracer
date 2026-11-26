// Undo and redo for the lab. Each step keeps only what changed (src/patch.js), in both
// directions, so the history of a large lab with many config snapshots stays small.
// No DOM: tests/history.test.mjs runs it in Node.
import { diff, apply, copy, patchSize } from './patch.js';

export const MAX_STEPS = 200;
export const MAX_CHARS = 24e6; // also cap the memory: a few steps can be large (a CSV import, a deleted device with configs)

export class History {
  /** lab: the document as last committed. */
  constructor(lab = null) { this.reset(lab); }

  reset(lab) {
    this.base = lab ? copy(lab) : null; // private copy of the committed state, never shared with the app
    this.undoStack = []; this.redoStack = [];
    this.chars = 0;
  }

  /** Record the changes since the last commit. false if nothing changed. */
  record(lab, label) {
    const redo = diff(this.base, lab);
    if (!redo.length) return false;
    const undo = diff(lab, this.base);
    this.base = apply(this.base, redo);
    const size = patchSize(undo) + patchSize(redo);
    this.undoStack.push({ undo, redo, label, size }); this.chars += size;
    for (const e of this.redoStack) this.chars -= e.size;
    this.redoStack = [];
    while (this.undoStack.length > 1 && (this.undoStack.length > MAX_STEPS || this.chars > MAX_CHARS)) this.chars -= this.undoStack.shift().size;
    return true;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  /** Step back. Returns {lab, label} with a new lab object for the app, or null. */
  undo() {
    const e = this.undoStack.pop(); if (!e) return null;
    this.base = apply(this.base, e.undo);
    this.redoStack.push(e);
    return { lab: copy(this.base), label: e.label };
  }
  redo() {
    const e = this.redoStack.pop(); if (!e) return null;
    this.base = apply(this.base, e.redo);
    this.undoStack.push(e);
    return { lab: copy(this.base), label: e.label };
  }
}
