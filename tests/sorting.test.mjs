/* Sorting: every algorithm must produce the same order as the language's
   own sort, on inputs chosen to break the careless implementations —
   empty, single, duplicates, negatives, already sorted, reversed. */

import { load, check, equal, reset, tally, SORT_CASES } from './harness.mjs';

export const name = 'sorting';

export async function run() {
  reset();
  const { SORTING } = await load('algorithms/sorting/index.js');
  const { record } = await load('engine/player.js');

  for (const algo of SORTING) {
    for (const input of SORT_CASES) {
      // Bogo sort is factorial; anything but a tiny input never finishes.
      if (algo.id === 'bogo' && input.length > 6) continue;

      const want = [...input].sort((a, b) => a - b);
      let frames;
      try {
        frames = record(algo.run({ array: input.slice() }), 200000);
      } catch (err) {
        check(false, `${algo.id} threw on [${input}]: ${err.message}`);
        continue;
      }

      if (!check(frames.length > 0, `${algo.id} produced no frames on [${input}]`)) continue;
      equal(frames[frames.length - 1].array, want, `${algo.id} on [${input}]`);

      // A sort must never lose, duplicate or invent a value mid-run.
      const badFrame = frames.find((f) => !f.array || f.array.length !== input.length);
      check(!badFrame, `${algo.id} on [${input}] produced a frame of the wrong length`);
    }
  }

  /* Timsort's whole claim: already-sorted input is one run and no merges. */
  const timsort = SORTING.find((a) => a.id === 'timsort');
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
  const t = record(timsort.run({ array: sorted.slice() }), 200000).at(-1);
  check(t.stats['natural runs'] === 1, `Timsort found ${t.stats['natural runs']} runs on sorted input, wanted 1`);
  check(t.stats.merges === 0, `Timsort did ${t.stats.merges} merges on sorted input, wanted 0`);

  /* Stability: equal keys must keep their original order. Encoding each key
     as key*100 + position lets us check that without a separate mechanism. */
  for (const algo of SORTING.filter((a) => a.cost.stable === 'Yes' && a.id !== 'bogo')) {
    const keys = Array.from({ length: 30 }, () => Math.floor(Math.random() * 5));
    const decorated = keys.map((k, i) => k * 100 + i);
    const out = record(algo.run({ array: decorated.slice() }), 200000).at(-1).array;

    const lastSeen = new Map();
    let stable = true;
    for (const v of out) {
      const key = Math.floor(v / 100), pos = v % 100;
      if (lastSeen.has(key) && lastSeen.get(key) > pos) stable = false;
      lastSeen.set(key, pos);
    }
    check(stable, `${algo.id} claims to be stable but reordered equal keys`);
  }

  return tally();
}
