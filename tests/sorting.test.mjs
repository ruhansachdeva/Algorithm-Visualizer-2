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

  /* Stability, tested by its actual definition.

     The problem: these sorts work on plain numbers, and two equal numbers
     are indistinguishable, so you cannot see whether their order was
     preserved. Decorating each value with its index does not help — it
     makes every value distinct, so the sort never meets a tie and the test
     becomes vacuous.

     The trick: JavaScript's relational operators call valueOf(). An object
     that reports a number compares exactly like that number, while staying
     a distinct object you can identify afterwards. So equal KEYS stay equal
     to the algorithm, and stay distinguishable to us.

     Ten of the eleven stable sorts survive this. Radix sort rebuilds its
     values arithmetically when emitting its final frame, which turns them
     back into plain numbers, so it falls back to the weaker check below. */

  const tagged = (key, id) => ({ valueOf: () => key, toString: () => String(key), key, id });
  const DUPLICATE_HEAVY = [
    [3, 1, 3, 1, 2, 2, 3, 1],
    [5, 5, 5, 5],
    [2, 1, 2, 1],
    [9, 4, 9, 4, 9, 4, 1],
    [1, 1, 2, 2, 3, 3, 1, 2, 3],
  ];

  for (const algo of SORTING.filter((a) => a.cost.stable === 'Yes')) {
    for (const keys of DUPLICATE_HEAVY) {
      const input = keys.map(tagged);
      const out = record(algo.run({ array: input.slice() }), 200000).at(-1).array;

      const keptIdentity = out.every((v) => v && typeof v === 'object' && 'id' in v);

      if (keptIdentity) {
        // The real definition: among equal keys, original order is preserved.
        check(out.every((v, i) => i === 0 || out[i - 1].key <= v.key),
          `${algo.id} did not sort [${keys}] correctly`);

        const lastId = new Map();
        let ordered = true;
        for (const v of out) {
          if (lastId.has(v.key) && lastId.get(v.key) > v.id) ordered = false;
          lastId.set(v.key, v.id);
        }
        check(ordered, `${algo.id} claims to be stable but reordered equal keys in [${keys}]`);
      } else {
        // Fallback for an algorithm that rebuilds its values: a stable sort
        // must never EXCHANGE two equal elements, since that reverses them.
        // A shift also marks two cells, so the swap counter tells them apart.
        const frames = record(algo.run({ array: keys.slice() }), 200000);
        let offender = null;
        for (let k = 1; k < frames.length && !offender; k++) {
          const f = frames[k];
          if (!Array.isArray(f.swap) || f.swap.length !== 2 || f.swap[0] === f.swap[1]) continue;
          if ((f.stats?.swaps ?? 0) <= (frames[k - 1].stats?.swaps ?? 0)) continue;
          if (f.array[f.swap[0]] === f.array[f.swap[1]]) offender = f;
        }
        check(!offender, `${algo.id} exchanged two equal values in [${keys}]`);
      }
    }
  }

  return tally();
}
