/* ============================================================
   ENUMERATION — subsets and permutations
   ------------------------------------------------------------
   The two shapes almost every backtracking problem reduces to.

   Subsets ask a yes/no question of each item independently, so
   there are 2ⁿ answers. Permutations ask "which item goes next?",
   and the choice narrows each time, so there are n! — a number
   that gets out of hand immediately. Eight items give 256 subsets
   but 40,320 orderings.
   ============================================================ */

import { newState, snap } from '../util.js';

/* ───────────────────────── Subsets ─────────────────────── */

const subsets = {
  view: 'array',
  input: 'enumerate',
  id: 'bt-subsets',
  name: 'Subsets (power set)',
  legend: [
    ['--c-compare', 'deciding on this item'],
    ['--c-sorted',  'taken into the subset'],
    ['--c-idle',    'left out'],
  ],
  about: 'Every subset of a list, by asking one yes/no question per item: take it, or leave it. Because the questions are independent, there are exactly 2ⁿ answers — and the recursion tree is a perfect binary tree of depth n. This is the skeleton behind subset-sum, the knapsack and every "choose some of these" problem.',
  cost: { best: 'O(2ⁿ)', avg: 'O(2ⁿ)', worst: 'O(2ⁿ)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'decide(i):',
    '  if every item has been decided, record the subset',
    '  TAKE item i, then decide(i + 1)',
    '  put it back, then decide(i + 1) without it',
  ],
  *run({ values }) {
    const arr = values.slice();
    const n = arr.length;
    const st = newState();
    const chosen = [];
    const found = [];

    const f = (i, extra) => snap(arr, st, {
      sorted: chosen.slice(),
      cursor: i,
      stats: { 'subsets found': found.length, 'of a possible': 2 ** n, depth: i },
      ...extra,
    });

    yield f(0, { line: 0, note: `${n} items, so ${2 ** n} subsets to enumerate` });

    function* decide(i) {
      if (i === n) {
        const picked = chosen.map((k) => arr[k]);
        found.push(picked);
        yield f(i, { line: 1, note: `#${found.length}: {${picked.join(', ') || ' '}}` });
        return;
      }

      // take it
      chosen.push(i);
      yield f(i, { compare: [i], line: 2, note: `take ${arr[i]}` });
      yield* decide(i + 1);

      // put it back
      chosen.pop();
      yield f(i, { compare: [i], line: 3, note: `put ${arr[i]} back and try without it` });
      yield* decide(i + 1);
    }

    yield* decide(0);
    yield f(n, { line: 1, note: `all ${found.length} subsets found — the empty one and the full one included` });
  },
};

/* ─────────────────────── Permutations ──────────────────── */

const permutations = {
  view: 'array',
  input: 'enumerate',
  id: 'bt-permutations',
  name: 'Permutations',
  legend: [
    ['--c-sorted',  'fixed so far'],
    ['--c-compare', 'being placed'],
    ['--c-idle',    'still to place'],
  ],
  about: 'Every ordering of a list. Pick something for the first position, then recurse on what is left; the number of choices shrinks by one each level, which is where n! comes from. The growth is brutal — six items give 720 orderings, ten give over three million — and seeing the tree fill is the clearest argument for why brute force over orderings is almost never the answer.',
  cost: { best: 'O(n!)', avg: 'O(n!)', worst: 'O(n!)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'arrange(k):',
    '  if k has passed the end, record this ordering',
    '  for each item from k onwards:',
    '    swap it into position k',
    '    arrange(k + 1)',
    '    swap it back — undo before trying the next',
  ],
  *run({ values }) {
    const arr = values.slice();
    const n = arr.length;
    const st = newState();
    const found = [];
    let swaps = 0;

    const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
    const f = (k, extra) => snap(arr, st, {
      sorted: Array.from({ length: k }, (_, i) => i),
      stats: { 'orderings found': found.length, 'of a possible': fact(n), swaps },
      ...extra,
    });

    yield f(0, { line: 0, note: `${n} items, so ${fact(n).toLocaleString()} orderings` });

    function* arrange(k) {
      if (k >= n - 1) {
        found.push(arr.join(''));
        yield f(n, { line: 1, note: `#${found.length}: ${arr.join(' ')}` });
        return;
      }

      for (let i = k; i < n; i++) {
        if (i !== k) {
          [arr[k], arr[i]] = [arr[i], arr[k]];
          swaps++;
        }
        yield f(k, { compare: [k], cursor: i, line: 3, note: `put ${arr[k]} in position ${k}` });

        yield* arrange(k + 1);

        if (i !== k) {
          [arr[k], arr[i]] = [arr[i], arr[k]];
          swaps++;
          yield f(k, { compare: [k, i], line: 5, note: 'swap back before trying the next choice' });
        }
      }
    }

    yield* arrange(0);
    yield f(0, { line: 1, note: `${found.length.toLocaleString()} orderings — adding one more item would multiply that by ${n + 1}` });
  },
};

export const ENUMERATE = [subsets, permutations];
