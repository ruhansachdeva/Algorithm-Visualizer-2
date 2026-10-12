/* Controls: every algorithm declares an `input` type, and inputs.js is
   supposed to have a builder for it that produces the object the
   algorithm's run() destructures. Nothing else in the suite checks that
   the two halves still line up.

   The bug this exists to catch: a merge dropped most of the builders.
   buildInputs falls back to `() => ({})` when a type is missing, so every
   algorithm below Searching received an empty object and died on its
   first line — "Invalid array length", "x is not iterable" — while the
   algorithms themselves were perfectly fine and all their tests passed. */

import { load, check, reset, tally } from './harness.mjs';
import { installDom } from './dom-shim.mjs';

export const name = 'controls';

export async function run() {
  reset();
  const uninstall = installDom();
  try {
    const { ALL } = await load('registry.js');
    const { buildInputs, state } = await load('inputs.js');
    const { record } = await load('engine/player.js');
    const { setSeed } = await load('rng.js');

    /* ── every declared input type has a builder ── */
    const types = [...new Set(ALL.map((a) => a.input))].sort();
    const broken = new Set();
    for (const type of types) {
      const probe = ALL.find((a) => a.input === type);
      const box = document.createElement('div');
      const read = buildInputs(probe, box, () => {});
      const got = read();
      const ok = got && Object.keys(got).length > 0;
      if (!ok) broken.add(type);
      check(ok,
        `input type "${type}" has no builder — buildInputs returned an empty object, so every algorithm using it gets nothing (first affected: ${probe.id})`);
      check(box.children.length > 0,
        `input type "${type}" rendered no controls at all`);
    }

    /* ── and the built input actually drives the algorithm ── */
    for (const algo of ALL) {
      if (broken.has(algo.input)) continue;   // already reported above
      setSeed('controls-suite');
      const box = document.createElement('div');
      let frames;
      try {
        const input = buildInputs(algo, box, () => {})();
        frames = record(algo.run(input), Math.min(algo.maxFrames ?? 60000, 60000));
      } catch (err) {
        check(false, `${algo.id} threw on the input its own controls built: ${err.message}`);
        continue;
      }
      check(frames.length > 0, `${algo.id} produced no frames from the input its controls built`);

      // A frame with no note is a frame the explanation panel renders blank.
      const blank = frames.findIndex((f) => !f.note);
      check(blank === -1, `${algo.id} frame ${blank} has no note`);
    }

    /* ── the controls must survive being used ── */
    // Rebuilding with the same state twice should give the same input:
    // builders that mutate shared state on every call drift over time.
    for (const algo of ALL) {
      if (broken.has(algo.input)) continue;
      setSeed('stability');
      const a = buildInputs(algo, document.createElement('div'), () => {})();
      const b = buildInputs(algo, document.createElement('div'), () => {})();
      const key = (o) => JSON.stringify(o, (_, v) =>
        (v instanceof Set ? [...v] : v instanceof Uint8Array ? [...v] : v));
      check(key(a) === key(b),
        `${algo.id}: building its controls twice gave two different inputs, so a redraw would silently change the run`);
    }
  } finally {
    uninstall();
  }

  return tally();
}
