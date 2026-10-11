/* ============================================================
   SEARCHING ALGORITHMS
   ------------------------------------------------------------
   Every one answers the same question — "where is `target`?" —
   and returns the index, or -1 if it isn't there.

   `dead` marks indices the algorithm has ruled out. Watching
   that grey-out spread is the whole point: it's the difference
   between checking everything and halving the problem.
   ============================================================ */

import { SORTING } from '../sorting/index.js';

const base = { view: 'array', input: 'search' };

/** One search frame. */
function f(arr, target, extra = {}) {
  return { array: arr, target, ...extra };
}

/** Indices outside [lo, hi] — i.e. everything already eliminated. */
function outside(n, lo, hi) {
  const dead = [];
  for (let i = 0; i < n; i++) if (i < lo || i > hi) dead.push(i);
  return dead;
}


/* ══════════════ the cost a sorted search hides ═══════════════

   Binary search is O(log n) — but only on a list that is already
   sorted, and the cost table never says who sorted it.

   Given an unsorted list these algorithms cannot start at all. So
   rather than quietly sorting behind the scenes, the sort runs on
   screen and its comparisons are added to the total. For a SINGLE
   lookup that reverses the usual conclusion completely: a linear
   scan wins easily, because it does not need the list sorted.

   Sorting only pays off once you search the same list many times.
   That is the real reason sorted structures exist, and it is
   invisible if the sort is treated as free.
   ═══════════════════════════════════════════════════════════ */

/** Run Timsort on screen, returning the sorted list and what it cost. */
function* sortFirst(arr, target) {
  const timsort = SORTING.find((a) => a.id === 'timsort');
  let final = null;
  for (const f of timsort.run({ array: arr })) {
    final = f;
    yield { ...f, target, phase: 'sorting', note: `sorting first — ${f.note}` };
  }
  return {
    array: final ? final.array : arr,
    comparisons: final?.stats?.comparisons ?? 0,
  };
}

/** What a plain scan of the ORIGINAL, unsorted list would have cost. */
const linearCost = (arr, target) => {
  const at = arr.indexOf(target);
  return at === -1 ? arr.length : at + 1;
};

/** However this particular algorithm counts its own work. */
const searchEffort = (stats = {}) =>
  stats.steps ?? stats.probes ?? stats.rounds ?? stats.hops ?? stats.comparisons ?? 0;

/**
 * Wrap a search that needs sorted input so that, when handed an unsorted
 * list, it sorts first — visibly, and on the bill.
 */
function sortsFirst(algo) {
  const inner = algo.run;
  return {
    ...algo,
    *run(input) {
      if (input.presorted !== false) { yield* inner.call(this, input); return; }

      const original = input.array.slice();
      const prep = yield* sortFirst(original.slice(), input.target);

      let last = null;
      for (const f of inner.call(this, { ...input, array: prep.array })) {
        last = f;
        yield f;
      }

      const own = searchEffort(last?.stats);
      const total = prep.comparisons + own;
      const linear = linearCost(original, input.target);
      const payback = Math.max(1, Math.ceil(prep.comparisons / Math.max(1, linear - own)));

      yield {
        ...last,
        phase: 'verdict',
        stats: {
          ...(last?.stats ?? {}),
          'sorting cost': prep.comparisons,
          'search cost': own,
          'TOTAL': total,
          'a linear scan': linear,
        },
        note: `${own} step${own === 1 ? '' : 's'} to search — but sorting the list first took ` +
          `${prep.comparisons.toLocaleString()} comparisons, so the honest total is ${total.toLocaleString()}. ` +
          (linear < total
            ? `A linear scan of the unsorted list would have taken ${linear}. For a single lookup it wins outright — ` +
              `sorting only pays off from about the ${payback}${payback === 1 ? 'st' : payback === 2 ? 'nd' : payback === 3 ? 'rd' : 'th'} search onwards.`
            : `A linear scan would have taken ${linear}, so sorting already paid for itself here.`),
      };
    },
  };
}

/* ───────────────────────── Linear ──────────────────────── */

const linear = {
  ...base,
  id: 'linear',
  name: 'Linear Search',
  about: 'Check every slot from left to right until the target turns up. The only search that works on unsorted data, and the only sensible choice for a short list. On a million random items it averages half a million checks — binary search would take twenty.',
  cost: { best: 'O(1)', avg: 'O(n)', worst: 'O(n)', space: 'O(1)', stable: '—' },
  needsSorted: false,
  pseudocode: [
    'for each index i from 0 upward:',
    '  if arr[i] == target: return i',
    'return -1 (not here)',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    for (let i = 0; i < arr.length; i++) {
      yield f(arr, target, {
        cursor: i, compare: [i], line: 1, dead: Array.from({ length: i }, (_, k) => k),
        note: `is arr[${i}] = ${arr[i]} the target?`,
        stats: { checked: i + 1, remaining: arr.length - i - 1 },
      });
      if (arr[i] === target) {
        yield f(arr, target, { found: i, line: 1, note: `found ${target} at index ${i} after ${i + 1} check${i ? 's' : ''}`, stats: { checked: i + 1, remaining: arr.length - i - 1 } });
        return;
      }
    }
    yield f(arr, target, { line: 2, dead: arr.map((_, i) => i), note: `${target} is not in the list — all ${arr.length} checked`, stats: { checked: arr.length, remaining: 0 } });
  },
};

/* ───────────────────────── Binary ──────────────────────── */

const binary = {
  ...base,
  id: 'binary',
  name: 'Binary Search',
  about: 'Look at the middle. If the target is smaller, throw away the whole right half; if bigger, throw away the left. Each step halves what is left, so a list of a million is searched in 20 steps. Requires sorted data — that is the price of admission.',
  cost: { best: 'O(1)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(1)', stable: '—' },
  needsSorted: true,
  pseudocode: [
    'lo = 0, hi = n - 1',
    'while lo <= hi:',
    '  mid = (lo + hi) / 2',
    '  if arr[mid] == target: return mid',
    '  if target < arr[mid]: hi = mid - 1   (drop the right half)',
    '  else: lo = mid + 1                   (drop the left half)',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    let lo = 0, hi = arr.length - 1, steps = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      steps++;
      yield f(arr, target, {
        cursor: mid, range: [lo, hi], dead: outside(arr.length, lo, hi), line: 2,
        note: `middle of [${lo}..${hi}] is index ${mid} = ${arr[mid]}`,
        stats: { steps, 'window size': hi - lo + 1 },
      });

      if (arr[mid] === target) {
        yield f(arr, target, { found: mid, range: [lo, hi], dead: outside(arr.length, lo, hi), line: 3, note: `found ${target} at index ${mid} in ${steps} step${steps === 1 ? '' : 's'}`, stats: { steps, 'window size': hi - lo + 1 } });
        return;
      }
      if (target < arr[mid]) {
        hi = mid - 1;
        yield f(arr, target, { range: [lo, Math.max(lo, hi)], dead: outside(arr.length, lo, hi), line: 4, note: `${target} < ${arr[mid]} — everything right of ${mid} is out`, stats: { steps, 'window size': Math.max(0, hi - lo + 1) } });
      } else {
        lo = mid + 1;
        yield f(arr, target, { range: [Math.min(lo, hi), hi], dead: outside(arr.length, lo, hi), line: 5, note: `${target} > ${arr[mid]} — everything left of ${mid} is out`, stats: { steps, 'window size': Math.max(0, hi - lo + 1) } });
      }
    }
    yield f(arr, target, { dead: arr.map((_, i) => i), line: 6, note: `the window is empty — ${target} is not in the list`, stats: { steps, 'window size': 0 } });
  },
};

/* ───────────────────────── Jump ────────────────────────── */

const jump = {
  ...base,
  id: 'jump',
  name: 'Jump Search',
  about: 'Hop forward in fixed strides of √n until you overshoot the target, then walk backwards one step at a time through that block. Slower than binary search, but it only ever moves forward in big steps — useful when jumping backwards is expensive, like on tape or a linked structure.',
  cost: { best: 'O(1)', avg: 'O(√n)', worst: 'O(√n)', space: 'O(1)', stable: '—' },
  needsSorted: true,
  pseudocode: [
    'step = √n',
    'jump forward by `step` until arr[i] >= target',
    'walk backwards through that block one at a time',
    'return the index if found, else -1',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    const n = arr.length;
    if (!n) { yield f(arr, target, { note: 'empty list' }); return; }

    const step = Math.max(1, Math.floor(Math.sqrt(n)));
    let prev = 0, curr = 0, hops = 0;

    yield f(arr, target, { line: 0, note: `stride = √${n} ≈ ${step}` , stats: { stride: step, hops: 0 } });

    while (curr < n && arr[Math.min(curr, n - 1)] < target) {
      hops++;
      yield f(arr, target, {
        cursor: Math.min(curr, n - 1), compare: [Math.min(curr, n - 1)], line: 1,
        dead: Array.from({ length: prev }, (_, k) => k),
        note: `arr[${Math.min(curr, n - 1)}] = ${arr[Math.min(curr, n - 1)]} < ${target} — jump again`,
        stats: { stride: step, hops },
      });
      prev = curr + 1;
      curr += step;
    }

    const blockEnd = Math.min(curr, n - 1);
    yield f(arr, target, {
      range: [Math.min(prev, blockEnd), blockEnd], line: 2,
      dead: outside(n, Math.min(prev, blockEnd), blockEnd),
      note: `target must be in block [${Math.min(prev, blockEnd)}..${blockEnd}] — scanning it`,
      stats: { stride: step, hops },
    });

    for (let i = blockEnd; i >= prev - 1 && i >= 0; i--) {
      yield f(arr, target, {
        cursor: i, compare: [i], range: [Math.min(prev, blockEnd), blockEnd],
        dead: outside(n, Math.min(prev, blockEnd), blockEnd), line: 2,
        note: `is arr[${i}] = ${arr[i]} the target?`,
        stats: { stride: step, hops },
      });
      if (arr[i] === target) {
        yield f(arr, target, { found: i, line: 3, note: `found ${target} at index ${i}`, stats: { stride: step, hops } });
        return;
      }
      if (arr[i] < target) break;
    }
    yield f(arr, target, { dead: arr.map((_, i) => i), line: 3, note: `${target} is not in the list`, stats: { stride: step, hops } });
  },
};

/* ──────────────────────── Exponential ──────────────────── */

const exponential = {
  ...base,
  id: 'exponential',
  name: 'Exponential Search',
  about: 'Double the index — 1, 2, 4, 8, 16 — until you pass the target, then binary-search the range you just skipped over. Finds a target near the front in O(log i) regardless of how long the list is, so it suits unbounded or very large inputs.',
  cost: { best: 'O(1)', avg: 'O(log i)', worst: 'O(log n)', space: 'O(1)', stable: '—' },
  needsSorted: true,
  pseudocode: [
    'if arr[0] == target: return 0',
    'bound = 1',
    'while bound < n and arr[bound] <= target: bound = bound * 2',
    'binary-search between bound/2 and min(bound, n-1)',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    const n = arr.length;
    if (!n) { yield f(arr, target, { note: 'empty list' }); return; }

    yield f(arr, target, { cursor: 0, compare: [0], line: 0, note: `is arr[0] = ${arr[0]} the target?`, stats: { bound: 1 } });
    if (arr[0] === target) { yield f(arr, target, { found: 0, line: 0, note: `found ${target} at index 0` }); return; }

    let bound = 1;
    while (bound < n && arr[bound] <= target) {
      yield f(arr, target, {
        cursor: bound, compare: [bound], line: 2,
        note: `arr[${bound}] = ${arr[bound]} <= ${target} — double the bound`,
        stats: { bound },
      });
      bound *= 2;
    }

    const lo0 = Math.floor(bound / 2), hi0 = Math.min(bound, n - 1);
    yield f(arr, target, {
      range: [lo0, hi0], dead: outside(n, lo0, hi0), line: 3,
      note: `overshot — binary-search [${lo0}..${hi0}]`,
      stats: { bound },
    });

    let lo = lo0, hi = hi0, steps = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      steps++;
      yield f(arr, target, { cursor: mid, range: [lo, hi], dead: outside(n, lo, hi), line: 3, note: `middle is ${arr[mid]}`, stats: { bound, 'binary steps': steps } });
      if (arr[mid] === target) { yield f(arr, target, { found: mid, line: 3, note: `found ${target} at index ${mid}`, stats: { bound, 'binary steps': steps } }); return; }
      if (target < arr[mid]) hi = mid - 1; else lo = mid + 1;
    }
    yield f(arr, target, { dead: arr.map((_, i) => i), line: 3, note: `${target} is not in the list` });
  },
};

/* ─────────────────────── Interpolation ─────────────────── */

const interpolation = {
  ...base,
  id: 'interpolation',
  name: 'Interpolation Search',
  about: 'Instead of always probing the middle, it guesses where the target should be based on its value — looking for 90 in a 1-to-100 list, it probes near the end. On evenly spread data that is O(log log n), astonishingly fast. On clustered data the guesses are bad and it degrades to O(n).',
  cost: { best: 'O(1)', avg: 'O(log log n)', worst: 'O(n)', space: 'O(1)', stable: '—' },
  needsSorted: true,
  pseudocode: [
    'lo = 0, hi = n - 1',
    'while target is within arr[lo]..arr[hi]:',
    '  guess position from how far target sits between the two ends',
    '  if arr[guess] == target: return guess',
    '  move lo or hi past the guess and repeat',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    const n = arr.length;
    let lo = 0, hi = n - 1, probes = 0;

    while (lo <= hi && target >= arr[lo] && target <= arr[hi]) {
      let pos;
      if (arr[hi] === arr[lo]) {
        pos = lo;
      } else {
        // The guess: how far along the value range the target sits.
        const fraction = (target - arr[lo]) / (arr[hi] - arr[lo]);
        pos = lo + Math.floor(fraction * (hi - lo));
      }
      pos = Math.max(lo, Math.min(hi, pos));
      probes++;

      yield f(arr, target, {
        cursor: pos, range: [lo, hi], dead: outside(n, lo, hi), line: 2,
        note: `${target} sits ~${arr[hi] === arr[lo] ? 0 : Math.round(((target - arr[lo]) / (arr[hi] - arr[lo])) * 100)}% along ${arr[lo]}..${arr[hi]} → probe ${pos}`,
        stats: { probes, 'window size': hi - lo + 1 },
      });

      if (arr[pos] === target) {
        yield f(arr, target, { found: pos, line: 3, note: `found ${target} at index ${pos} in ${probes} probe${probes === 1 ? '' : 's'}`, stats: { probes, 'window size': hi - lo + 1 } });
        return;
      }
      if (arr[pos] < target) {
        lo = pos + 1;
        yield f(arr, target, { range: [Math.min(lo, hi), hi], dead: outside(n, lo, hi), line: 4, note: `guessed too low — search right`, stats: { probes, 'window size': Math.max(0, hi - lo + 1) } });
      } else {
        hi = pos - 1;
        yield f(arr, target, { range: [lo, Math.max(lo, hi)], dead: outside(n, lo, hi), line: 4, note: `guessed too high — search left`, stats: { probes, 'window size': Math.max(0, hi - lo + 1) } });
      }
    }
    yield f(arr, target, { dead: arr.map((_, i) => i), line: 1, note: `${target} is not in the list`, stats: { probes } });
  },
};

/* ───────────────────────── Ternary ─────────────────────── */

const ternary = {
  ...base,
  id: 'ternary',
  name: 'Ternary Search',
  about: 'Cuts the range into three parts instead of two, using two probes per round. It discards two thirds each time rather than one half — but pays two comparisons to do it, so it ends up slightly *worse* than binary search. A good lesson in why fewer rounds does not mean less work.',
  cost: { best: 'O(1)', avg: 'O(log₃ n)', worst: 'O(log₃ n)', space: 'O(1)', stable: '—' },
  needsSorted: true,
  pseudocode: [
    'lo = 0, hi = n - 1',
    'while lo <= hi:',
    '  m1 = one third along, m2 = two thirds along',
    '  if either equals the target: return it',
    '  keep only the third the target can be in',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    const n = arr.length;
    let lo = 0, hi = n - 1, rounds = 0, comparisons = 0;

    while (lo <= hi) {
      rounds++;
      const third = Math.floor((hi - lo) / 3);
      const m1 = lo + third;
      const m2 = hi - third;

      comparisons += 2;
      yield f(arr, target, {
        cursor: m1, compare: [m1, m2], range: [lo, hi], dead: outside(n, lo, hi), line: 2,
        note: `probing ${arr[m1]} (at ${m1}) and ${arr[m2]} (at ${m2})`,
        stats: { rounds, comparisons, 'window size': hi - lo + 1 },
      });

      if (arr[m1] === target) { yield f(arr, target, { found: m1, line: 3, note: `found ${target} at index ${m1}`, stats: { rounds, comparisons } }); return; }
      if (arr[m2] === target) { yield f(arr, target, { found: m2, line: 3, note: `found ${target} at index ${m2}`, stats: { rounds, comparisons } }); return; }

      if (target < arr[m1]) {
        hi = m1 - 1;
        yield f(arr, target, { range: [lo, Math.max(lo, hi)], dead: outside(n, lo, hi), line: 4, note: 'target is in the first third', stats: { rounds, comparisons, 'window size': Math.max(0, hi - lo + 1) } });
      } else if (target > arr[m2]) {
        lo = m2 + 1;
        yield f(arr, target, { range: [Math.min(lo, hi), hi], dead: outside(n, lo, hi), line: 4, note: 'target is in the last third', stats: { rounds, comparisons, 'window size': Math.max(0, hi - lo + 1) } });
      } else {
        lo = m1 + 1; hi = m2 - 1;
        yield f(arr, target, { range: [Math.min(lo, hi), Math.max(lo, hi)], dead: outside(n, lo, hi), line: 4, note: 'target is in the middle third', stats: { rounds, comparisons, 'window size': Math.max(0, hi - lo + 1) } });
      }
    }
    yield f(arr, target, { dead: arr.map((_, i) => i), line: 1, note: `${target} is not in the list`, stats: { rounds, comparisons } });
  },
};

/* ───────────────────────── Fibonacci ───────────────────── */

const fibonacci = {
  ...base,
  id: 'fib-search',
  name: 'Fibonacci Search',
  about: 'Splits the range at Fibonacci numbers rather than the midpoint. The split points only ever require addition and subtraction — no division — and each probe is close to the previous one, which is kinder to a cache than binary search\'s long jumps.',
  cost: { best: 'O(1)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(1)', stable: '—' },
  needsSorted: true,
  pseudocode: [
    'find the smallest Fibonacci number >= n',
    'use the two Fibonacci numbers below it to pick a probe',
    'compare, then shrink the range by one Fibonacci step',
    'repeat until the range is empty',
  ],
  *run({ array, target }) {
    const arr = array.slice();
    const n = arr.length;
    if (!n) { yield f(arr, target, { note: 'empty list' }); return; }

    let fibM2 = 0, fibM1 = 1, fibM = fibM2 + fibM1;
    while (fibM < n) { fibM2 = fibM1; fibM1 = fibM; fibM = fibM2 + fibM1; }

    yield f(arr, target, { line: 0, note: `smallest Fibonacci >= ${n} is ${fibM}`, stats: { fib: fibM } });

    let offset = -1, probes = 0;
    while (fibM > 1) {
      const i = Math.min(offset + fibM2, n - 1);
      probes++;
      yield f(arr, target, {
        cursor: i, compare: [i], range: [Math.max(0, offset + 1), n - 1],
        dead: outside(n, Math.max(0, offset + 1), n - 1), line: 1,
        note: `probe index ${i} (offset ${offset} + fib ${fibM2}) = ${arr[i]}`,
        stats: { probes, fib: fibM },
      });

      if (arr[i] < target) {
        fibM = fibM1; fibM1 = fibM2; fibM2 = fibM - fibM1;
        offset = i;
        yield f(arr, target, { dead: outside(n, offset + 1, n - 1), range: [Math.min(offset + 1, n - 1), n - 1], line: 2, note: `${arr[i]} < ${target} — move the offset forward`, stats: { probes, fib: fibM } });
      } else if (arr[i] > target) {
        fibM = fibM2; fibM1 = fibM1 - fibM2; fibM2 = fibM - fibM1;
        yield f(arr, target, { line: 2, note: `${arr[i]} > ${target} — shrink the range`, stats: { probes, fib: fibM } });
      } else {
        yield f(arr, target, { found: i, line: 2, note: `found ${target} at index ${i} in ${probes} probe${probes === 1 ? '' : 's'}`, stats: { probes } });
        return;
      }
    }

    if (fibM1 && offset + 1 < n && arr[offset + 1] === target) {
      yield f(arr, target, { found: offset + 1, line: 3, note: `found ${target} at index ${offset + 1}`, stats: { probes } });
      return;
    }
    yield f(arr, target, { dead: arr.map((_, i) => i), line: 3, note: `${target} is not in the list`, stats: { probes } });
  },
};


/* ──────────────────────── Quickselect ──────────────────── */

const quickselect = {
  view: 'array',
  input: 'kth',
  id: 'quickselect',
  name: 'Quickselect (kth smallest)',
  legend: [
    ['--c-pivot',   'pivot'],
    ['--c-compare', 'being compared'],
    ['--c-range',   'the part that might still contain the answer'],
    ['--c-idle',    'discarded'],
    ['--c-found',   'the kth smallest'],
  ],
  about: 'Find the kth smallest value without sorting the list. It partitions exactly like quicksort, but then recurses into only ONE side — the side the answer must be in. Discarding half the work each time brings the average cost down from O(n log n) to O(n), which is why finding a median does not require sorting first.',
  cost: { best: 'O(n)', avg: 'O(n)', worst: 'O(n²)', space: 'O(1)', stable: '—' },
  needsSorted: false,
  pseudocode: [
    'partition the range around a pivot, as quicksort does',
    'the pivot is now at its final sorted position p',
    'if p == k, the pivot IS the kth smallest — stop',
    'if k < p, recurse on the left part only',
    'if k > p, recurse on the right part only',
  ],
  *run({ array, k }) {
    const arr = array.slice();
    const n = arr.length;
    const target = Math.max(0, Math.min(n - 1, k));
    let lo = 0, hi = n - 1;
    let comparisons = 0, partitions = 0;

    const dead = () => {
      const out = [];
      for (let i = 0; i < n; i++) if (i < lo || i > hi) out.push(i);
      return out;
    };
    const f = (extra) => ({
      array: arr.slice(),
      range: hi >= lo ? [lo, hi] : undefined,
      dead: dead(),
      stats: { comparisons, partitions, 'still in play': Math.max(0, hi - lo + 1) },
      ...extra,
    });

    yield f({ line: 0, note: `looking for the ${ordinal(target + 1)} smallest of ${n}` });

    while (lo <= hi) {
      if (lo === hi) {
        yield f({ found: lo, line: 2, note: `one value left — arr[${lo}] = ${arr[lo]} is the ${ordinal(target + 1)} smallest` });
        return;
      }

      const pivotVal = arr[hi];
      let boundary = lo;
      partitions++;
      yield f({ pivot: hi, line: 0, note: `pivot = ${pivotVal}` });

      for (let i = lo; i < hi; i++) {
        comparisons++;
        yield f({ pivot: hi, compare: [i], cursor: boundary, line: 0, note: `is ${arr[i]} < ${pivotVal}?` });
        if (arr[i] < pivotVal) {
          if (i !== boundary) {
            [arr[i], arr[boundary]] = [arr[boundary], arr[i]];
            yield f({ pivot: hi, swap: [i, boundary], line: 0, note: 'smaller — move it left' });
          }
          boundary++;
        }
      }
      [arr[boundary], arr[hi]] = [arr[hi], arr[boundary]];
      yield f({ pivot: boundary, swap: [boundary, hi], line: 1, note: `pivot lands at ${boundary} — that is its final sorted position` });

      if (boundary === target) {
        yield f({ found: boundary, line: 2, note: `${arr[boundary]} is the ${ordinal(target + 1)} smallest — found without sorting the rest`, stats: { comparisons, partitions, 'still in play': 1 } });
        return;
      }
      if (target < boundary) {
        hi = boundary - 1;
        yield f({ line: 3, note: `the answer is to the left — discard ${n - (hi - lo + 1)} values and never look at them again` });
      } else {
        lo = boundary + 1;
        yield f({ line: 4, note: `the answer is to the right — discard ${n - (hi - lo + 1)} values and never look at them again` });
      }
    }
  },
};

const ordinal = (k) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = k % 100;
  return k + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* Wrapping reorders the list, so put it back the way it reads best. */
const ORDER = ['linear', 'binary', 'quickselect', 'jump', 'exponential', 'interpolation', 'ternary', 'fib-search'];

// Linear search is deliberately NOT wrapped: not needing a sorted list is
// precisely its advantage, and sorting here would erase the comparison.
export const SEARCHING = [
  linear,
  quickselect,
  ...[binary, jump, exponential, interpolation, ternary, fibonacci].map(sortsFirst),
].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
