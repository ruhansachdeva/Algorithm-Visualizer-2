/* ============================================================
   A very small test harness.

   No framework, no install — the whole point of this project is
   that it runs with nothing but a browser and python3, and the
   tests should not break that. `node tests/run.mjs` is enough.
   ============================================================ */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Import something from the app's js/ directory. */
export const load = (path) => import(resolve(here, '..', 'js', path));

/** Collected failures for the suite currently running. */
let failures = [];
let checks = 0;

export function reset() { failures = []; checks = 0; }
export function tally() { return { failures: failures.length, checks, messages: failures }; }

/** Record a check. `ok` true passes; anything else fails with `message`. */
export function check(ok, message) {
  checks++;
  if (!ok) failures.push(message);
  return ok;
}

/** Deep-ish equality good enough for arrays of numbers and strings. */
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Shorthand: assert two values match, describing the difference if not. */
export function equal(got, want, what) {
  return check(same(got, want), `${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
}

/* ── input shapes, shared by several suites ── */

export const randomInts = (n, max = 99) =>
  Array.from({ length: n }, () => 1 + Math.floor(Math.random() * max));

export const distinctInts = (n, max = 200) => {
  const seen = new Set();
  while (seen.size < n) seen.add(1 + Math.floor(Math.random() * max));
  return [...seen];
};

export const SORT_CASES = [
  [5, 2, 9, 1, 7, 3],
  [1, 2, 3, 4, 5],
  [5, 4, 3, 2, 1],
  [42],
  [],
  [3, 3, 3, 3],
  [7, 7, 1, 9, 1, 4, 4],
  [10, -3, 4, -8, 0, 5],
];
