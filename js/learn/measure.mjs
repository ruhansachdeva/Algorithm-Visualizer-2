/* ============================================================
   Measuring what an algorithm actually costs.

   The cost table says O(n log n). This runs the algorithm at a dozen
   input sizes, counts the work it really does, and hands back the
   numbers so the page can draw them under the predicted curve.

   Two things worth knowing about how it counts:

   - It never stores frames. The player keeps every frame so you can
     scrub backwards, which is fine for one run of 200 items and hopeless
     for twelve runs of 2,000. Here the generator is drained and thrown
     away, keeping only the counters.

   - "Steps" means frames the algorithm chose to yield, which is its own
     idea of a step and not a machine instruction. That makes it
     comparable across sizes of the same algorithm — which is all the
     curve needs — but not across different algorithms. The counters the
     algorithm reports itself (comparisons, swaps, visited) are the
     honest numbers, and the page prefers them when they exist.
   ============================================================ */

import { generateArray, buildGraph } from '../inputs.js';
import { random, randInt, setSeed, seedFrom } from '../rng.js';

const ints = (n, max = 99) => Array.from({ length: n }, () => 1 + Math.floor(random() * max));
const sorted = (n) => {
  const pool = new Set();
  while (pool.size < n) pool.add(1 + Math.floor(random() * Math.max(n * 8, 50)));
  return [...pool].sort((a, b) => a - b);
};
const letters = (n) => Array.from({ length: n }, () => 'ABCD'[Math.floor(random() * 4)]).join('');

/** `len` characters drawn from the first `distinct` letters of the alphabet. */
const alphabet = (distinct, len) => {
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, Math.min(distinct, 26));
  // Every letter appears at least once, or the tree is smaller than asked for.
  const out = [...pool];
  while (out.length < len) out.push(pool[Math.floor(random() * pool.length)]);
  return out.join('');
};

/* A plain open board with no walls: `n` is a cell count, so the width is
   chosen to keep it roughly square. */
function board(cells) {
  const cols = Math.max(5, Math.round(Math.sqrt(cells * 1.9)) | 1);
  const rows = Math.max(5, Math.round(cells / cols));
  return {
    cols, rows,
    walls: new Set(),
    start: 0,
    goal: cols * rows - 1,
    weights: null,
    diagonal: false,
  };
}

/* ────────────────────────────────────────────────────────────
   One entry per input type: the sizes to try, what `n` means on the
   x axis, and how to build an input of that size.

   `sizes` is deliberately modest where the algorithm is exponential —
   measuring 8-disk Hanoi is instructive, 25-disk Hanoi is a hung tab.
   ──────────────────────────────────────────────────────────── */
export const PLANS = {
  array:            { label: 'items',            sizes: [20, 40, 60, 90, 120, 160, 200, 260, 320], make: (n) => ({ array: ints(n) }) },
  search:           { label: 'items in the list', sizes: [50, 100, 200, 400, 800, 1600, 3200, 6400], make: (n) => { const a = sorted(n); return { array: a, target: a[Math.floor(a.length * 0.72)], presorted: true }; } },
  kth:              { label: 'items',            sizes: [50, 100, 200, 400, 800, 1600, 3200], make: (n) => ({ array: ints(n, n * 4), k: Math.max(1, Math.floor(n / 2)) }) },
  grid:             { label: 'cells on the board', sizes: [120, 250, 500, 900, 1500, 2400, 3600], make: board },
  graph:            { label: 'nodes',            sizes: [6, 9, 12, 16, 20, 26, 32, 40], make: null },
  tree:             { label: 'values inserted',  sizes: [8, 16, 32, 64, 128, 256, 512], make: (n) => { const v = [...new Set(ints(n, n * 6))]; return { values: v, target: v[Math.floor(v.length / 2)] }; } },
  segment:          { label: 'values',           sizes: [4, 8, 16, 32, 64, 128, 256], make: (n) => ({ values: ints(n, 20), from: Math.floor(n * 0.25), to: Math.floor(n * 0.75) }) },
  string:           { label: 'characters of text', sizes: [40, 80, 160, 320, 640, 1280, 2560], make: (n) => ({ text: letters(n), pattern: letters(4) }) },
  // A trie's cost is O(m), the length of the word — so the words get
  // longer as well as more numerous, or a claim about m cannot be tested.
  // 14 is where the real control truncates them.
  words:            { label: 'words',            sizes: [4, 8, 12, 16, 20, 26], make: (n) => { const len = Math.min(14, 3 + Math.round(n / 3)); const list = [...new Set(Array.from({ length: n }, () => letters(len)))]; return { words: list, target: list[0] }; } },
  // Huffman's n is the number of *distinct* characters, not the length of
  // the text: a million-character file of two letters builds a two-leaf
  // tree. So the alphabet grows with the sample, or the measurement is
  // flat and says nothing.
  huffman:          { label: 'distinct characters', sizes: [4, 6, 9, 12, 16, 20, 26], make: (n) => ({ text: alphabet(n, n * 12) }) },
  sieve:            { label: 'limit',            sizes: [50, 100, 200, 400, 800, 1600, 3200], make: (n) => ({ limit: n }) },
  points:           { label: 'points',           sizes: [8, 16, 24, 36, 50, 70, 95], make: (n) => ({ points: Array.from({ length: n }, () => ({ x: random(), y: random() })) }) },
  palindrome:       { label: 'characters',       sizes: [20, 40, 80, 160, 320, 640], make: (n) => ({ text: letters(n) }) },
  queens:           { label: 'board size',       sizes: [4, 5, 6, 7, 8, 9], make: (n) => ({ n, findAll: false }) },
  enumerate:        { label: 'items',            sizes: [2, 3, 4, 5, 6, 7, 8], make: (n) => ({ values: Array.from({ length: n }, (_, i) => i + 1) }) },
  hanoi:            { label: 'disks',            sizes: [2, 3, 4, 5, 6, 7, 8, 9], make: (n) => ({ n }) },
  'two-numbers':    { label: 'size of the inputs', sizes: [100, 1000, 10000, 100000, 1000000, 10000000], make: (n) => ({ a: n + 71, b: Math.floor(n * 0.43) + 13 }) },
  power:            { label: 'exponent',         sizes: [8, 64, 512, 4096, 32768, 262144, 2097152], make: (n) => ({ base: 7, exp: n, mod: 1000000007 }) },
  'dp-n':           { label: 'n',                sizes: [5, 10, 15, 20, 25, 30, 35], make: (n) => ({ n }) },
  'dp-two-strings': { label: 'characters each',  sizes: [4, 8, 12, 16, 22, 28, 36], make: (n) => ({ a: letters(n), b: letters(n) }) },
  'dp-rod':         { label: 'rod length',       sizes: [4, 6, 8, 10, 13, 16, 20], make: (n) => ({ prices: ints(n, 25) }) },
  'dp-signed':      { label: 'items',            sizes: [10, 20, 40, 80, 160, 320, 640], make: (n) => ({ array: Array.from({ length: n }, () => randInt(-9, 9)) }) },
  'dp-array':       { label: 'items',            sizes: [6, 10, 16, 24, 34, 46, 60], make: (n) => ({ array: ints(n, n * 3) }) },
  'dp-coins':       { label: 'amount',           sizes: [10, 20, 40, 80, 160, 320, 640], make: (n) => ({ coins: [1, 3, 4], amount: n }) },
  // The target is held fixed on purpose: the claim is O(n·S), so letting S
  // grow with n too would make the x axis vary two things at once and the
  // curve would come out quadratic for reasons that are not the algorithm.
  'dp-subset':      { label: 'numbers',          sizes: [4, 6, 8, 11, 14, 18, 22], make: (n) => ({ numbers: ints(n, 15), target: 24 }) },
  'dp-matrix':      { label: 'matrices',         sizes: [3, 4, 5, 6, 8, 10, 12], make: (n) => ({ dims: ints(n + 1, 40) }) },
  'dp-knapsack':    { label: 'items',            sizes: [3, 5, 7, 10, 14, 18, 24], make: (n) => ({ items: Array.from({ length: n }, () => ({ v: randInt(10, 120), w: randInt(1, 9) })), capacity: 10 }) },
};

/* Sudoku is the one input with nothing to scale: there are three fixed
   puzzles, and "a 40% harder puzzle" is not a size. */
export const NO_PLAN = {
  sudoku: 'there is no size to vary — the puzzles are fixed, and difficulty is not a number',
};

/**
 * Sizes worth trying for one algorithm. Exponential algorithms get a
 * shorter list, since the honest measurement is the one that finishes.
 */
export function sizesFor(algo) {
  const plan = PLANS[algo.input];
  if (!plan) return null;
  let sizes = plan.sizes;
  if (algo.id === 'bogo') sizes = [3, 4, 5, 6, 7];        // factorial; 8 already hangs
  if (algo.id === 'bt-n-queens') sizes = [4, 5, 6, 7, 8];
  if (algo.id === 'dp-fib') sizes = [5, 10, 15, 20, 25, 30, 35];
  return sizes;
}

/** Build an input of a given size for an algorithm. */
export function inputFor(algo, n) {
  const plan = PLANS[algo.input];
  if (!plan) return null;
  if (algo.input === 'graph') {
    const spec = algo.graph || {};
    return { ...buildGraph(n, spec, { extra: 0.35, negativeCycle: false }), colors: 3 };
  }
  const input = plan.make(n);
  // Grid algorithms that build mazes carve walls rather than search, and
  // a maze needs odd dimensions to come out right.
  if (algo.input === 'grid' && algo.id.startsWith('maze-')) {
    input.cols |= 1;
    input.rows |= 1;
  }
  return input;
}

/**
 * Drain one run and report what it cost.
 * @returns {{steps:number, counters:Object, capped:boolean}}
 */
export function costOf(algo, input, cap) {
  const gen = algo.run(input);
  let steps = 0;
  let last = null;
  let r = gen.next();
  while (!r.done) {
    steps++;
    last = r.value;
    if (steps >= cap) return { steps, counters: numeric(last), capped: true };
    r = gen.next();
  }
  return { steps, counters: numeric(last), capped: false };
}

const numeric = (frame) => {
  const out = {};
  for (const [k, v] of Object.entries(frame?.stats ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
};

/**
 * Run an algorithm across its size range.
 *
 * Each size is measured on the same seed so the inputs form a family
 * rather than a lucky one and an unlucky one — otherwise the curve picks
 * up noise from the input, not from the algorithm.
 *
 * @param {object} algo
 * @param {{seed?: string, cap?: number, repeats?: number}} [opts]
 */
export function measure(algo, { seed = 'growth', cap = 400000, repeats = 3 } = {}) {
  const sizes = sizesFor(algo);
  if (!sizes) return null;

  const rows = [];
  for (const n of sizes) {
    // Average a few different inputs of the same size: one run of quick
    // sort can get a lucky pivot and dent the curve for no good reason.
    const runs = [];
    for (let r = 0; r < repeats; r++) {
      // seedFrom, not the raw string: setSeed reads base-36 and would
      // stop at the first colon, giving every size and repeat one seed.
      setSeed(seedFrom(`${seed}:${algo.id}:${n}:${r}`));
      const input = inputFor(algo, n);
      try {
        runs.push(costOf(algo, input, cap));
      } catch {
        runs.push(null);
      }
    }
    const ok = runs.filter(Boolean);
    if (!ok.length) { rows.push({ n, failed: true }); continue; }

    const keys = [...new Set(ok.flatMap((r) => Object.keys(r.counters)))];
    const counters = {};
    for (const k of keys) {
      const vals = ok.map((r) => r.counters[k]).filter((v) => v != null);
      counters[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    rows.push({
      n,
      steps: ok.reduce((a, r) => a + r.steps, 0) / ok.length,
      counters,
      capped: ok.some((r) => r.capped),
    });
  }
  return { sizes: rows.map((r) => r.n), rows, label: PLANS[algo.input].label };
}

/* ────────────────────────────────────────────────────────────
   Which counters are work.

   The algorithms report two different kinds of number through the same
   `stats` object, because the live panel wants both: totals that only
   ever go up ("comparisons: 418") and snapshots of the current state
   ("queue size: 12", "best value: 220", "answer: 57").

   Only the first kind is a growth curve. A snapshot plotted against n
   produces a shape that means nothing — the measured "complexity" of
   Segment Tree Query came out as O(n) because the counter picked was
   `answer`, the sum it had been asked for, which grows with the values
   in the array and has nothing to do with the cost of the query.

   So work counters are listed rather than guessed at. This is the app's
   own vocabulary, and a new algorithm adding a counter that belongs here
   is a one-line change; leave it out and the measurement quietly falls
   back to counting steps, which is never wrong, only coarser.
   ──────────────────────────────────────────────────────────── */
const WORK = new Set([
  // comparisons and data movement
  'comparisons', 'swaps', 'writes', 'merges', 'partitions', 'rotations', 'recolours',
  // traversal
  'visited', 'nodes visited', 'explored', 'checked', 'steps', 'hops', 'probes',
  'binary steps', 'rounds', 'searches', 'sweeps round the cloud',
  // graph work
  'relaxations', 'improvements', 'edges checked', 'edges taken', 'considered',
  'tested', 'stop-overs done', 'placed', 'coloured', 'merges', 'already joined',
  // search and matching
  'matches', 'hash checks', 'collisions', 'positions skipped', 'characters skipped',
  'centres', 'nodes skipped',
  // dp and enumeration
  'additions', 'cuts tried', 'splits tried', 'colours tried', 'backtracks',
  'placements', 'rejected', 'subsets found', 'orderings found', 'solutions',
  'moves', 'multiplications', 'candidates tried', 'turn tests',
  'measurements', 'numbers crossed out', 'skipped',
  // construction
  'carved', 'walls built', 'nodes reused',
]);

/* Counters describing the road not taken — "naive would take", "if we
   compared every pair" — exist to make a point about what the algorithm
   saves. They are not its work, and they grow fastest of all, so any rule
   of the form "take the counter that grows most" lands on them. */
const COUNTERFACTUAL = /naive|avoided|would take|if we |instead of|brute|fewest possible|of a possible|skipped by starting/i;

/**
 * Which counter best represents the work this algorithm did.
 *
 * Counters that never move are dropped too: counting sort reports
 * `comparisons: 0` at every size, because not comparing is the entire
 * point, and a flat line fits "constant time" perfectly.
 *
 * @returns {string|null} null means "no usable counter — count steps"
 */
export function primaryCounter(rows) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.counters ?? {})))];
  const valuesOf = (k) => rows.map((r) => r.counters?.[k]).filter((v) => v != null);

  const usable = keys.filter((k) => {
    if (!WORK.has(k) || COUNTERFACTUAL.test(k)) return false;
    const v = valuesOf(k);
    if (v.length < 2 || Math.min(...v) === Math.max(...v)) return false;
    // A counter that is exactly n at every size is restating the input.
    return !rows.every((r, i) => r.counters?.[k] == null || r.counters[k] === rows[i].n);
  });
  if (!usable.length) return null;

  // Comparisons first where they exist — it is the number textbooks quote.
  const preferred = ['comparisons', 'visited', 'relaxations', 'measurements',
    'additions', 'turn tests', 'numbers crossed out', 'moves', 'multiplications',
    'writes', 'probes', 'steps'];
  for (const p of preferred) if (usable.includes(p)) return p;

  let best = null;
  for (const k of usable) {
    const v = valuesOf(k);
    const growth = v[0] > 0 ? v.at(-1) / v[0] : v.at(-1);
    if (!best || growth > best.growth) best = { key: k, growth };
  }
  return best.key;
}

/**
 * The measured series to plot, and what to call it on the axis.
 * Falls back to counting yielded frames, which every algorithm has.
 */
export function series(m) {
  const key = primaryCounter(m.rows);
  const values = m.rows.map((r) => (key ? r.counters?.[key] : r.steps) ?? null);
  const real = values.filter((v) => v != null && Number.isFinite(v));
  return {
    key,
    label: key ?? 'steps',
    values,
    isStepFallback: !key,
    // A measurement that does not move with the input has no shape, and
    // must not be handed to the verdict: a flat line against O(V·E²)
    // reads as "beat its worst case", when the truth is that the input
    // generator never gave it anything to do.
    flat: real.length > 1 && Math.min(...real) === Math.max(...real),
  };
}


/* ────────────────────────────────────────────────────────────
   When the cost table and the run describe different things.

   A cost of O(log n) on BST Insert means one insert. The visualizer
   inserts n values, so the run costs n × O(log n), and a curve drawn
   straight from the table would be wrong by a factor of n — measured
   R² against O(log n) is 0.38, against n × O(log n) it is 0.998.

   Rather than quietly fixing up the shape, the page says which of these
   is happening, because the mismatch is itself worth understanding.
   ──────────────────────────────────────────────────────────── */

/** The run repeats the table's operation once per item. */
export const REPEATED = {
  'bst-insert':  'inserts every value, one at a time',
  'avl-insert':  'inserts every value, rebalancing after each one',
  'rb-insert':   'inserts every value, recolouring after each one',
  'trie-insert':  'inserts every word',
  'heap-ops':    'pushes every value, then pops them all',
  'graph-union-find': 'performs a union or find for every edge',
};

/** The run builds the structure first, and the table's cost is the tail. */
export const BUILD_FIRST = {
  'bst-search': 'builds the whole tree before searching it once',
  'bst-delete': 'builds the whole tree before deleting from it',
  'trie-search': 'builds the trie before looking one word up',
  'segtree-query': 'builds the whole tree before asking one range question',
};

/**
 * The shape to draw for a run, given the table's shape for one operation.
 * @returns {{f: Function, why: string|null}}
 */
export function runShape(algo, f) {
  if (REPEATED[algo.id]) {
    return { f: (n) => n * f(n), why: `the table's cost is for one operation — this run ${REPEATED[algo.id]}, so the curve drawn is n × that` };
  }
  if (BUILD_FIRST[algo.id]) {
    return { f, why: `the table's cost is for the operation alone — this run ${BUILD_FIRST[algo.id]}, and that build is most of what you see` };
  }
  return { f, why: null };
}
