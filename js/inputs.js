import { random, reseed } from './rng.js';

/* ============================================================
   Input controls
   ------------------------------------------------------------
   Each algorithm declares what kind of input it needs
   ('array', 'search', 'grid', 'graph', 'tree', 'dp', 'string').
   This file renders the right controls for that kind and hands
   back the actual input object the algorithm will receive.

   State lives at module level so your settings survive switching
   between algorithms — change the array once, compare five sorts.
   ============================================================ */

export const state = {
  array:  { size: 30, dist: 'random', data: null },
  search: { size: 24, target: 7, data: null, presorted: true },
  kth:    { size: 24, k: 11, data: null },
  graph:  { size: 9, extra: 0.35, negativeCycle: false, cache: null, key: '' },
  tree:   { size: 10, sorted: false, values: null, target: null },
  string: { text: 'ABACADABRABRACADABRA', pattern: 'ABRA' },
  words:  { list: 'CAT, CAR, CARD, CARE, DOG, DO, DONE', target: 'CARD' },
  huffman:{ text: 'ABRACADABRA' },
  sieve:  { limit: 120 },
  points: { n: 22, shape: 'scattered', data: null },
  pair:   { a: 1071, b: 462 },
  power:  { base: 7, exp: 19, mod: 1000000007 },
  palindrome: { text: 'BANANARAMA' },
  queens: { n: 8, findAll: false },
  sudoku: { which: 'easy' },
  hanoi:  { n: 4 },
  enumerate: { n: 4 },
  dp:     {
    n: 14,
    a: 'KITTEN', b: 'SITTING',
    array: [3, 10, 2, 1, 20, 4, 6, 21, 8],
    coins: [1, 3, 4], amount: 11,
    numbers: [3, 34, 4, 12, 5, 2], target: 9,
    items: [{ v: 60, w: 5 }, { v: 100, w: 4 }, { v: 120, w: 6 }, { v: 40, w: 3 }],
    dims: [30, 35, 15, 5, 10, 20, 25],
    signed: [-2, 1, -3, 4, -1, 2, 1, -5, 4],
    prices: [1, 5, 8, 9, 10, 17, 17, 20],
    capacity: 10,
  },
  grid:   {
    cols: 45, rows: 23,
    walls: new Set(),
    start: null, goal: null,
    weights: null,
    weighted: false,
    diagonal: false,
  },
};

/** Split a free-text list into clean, de-duplicated uppercase words. */
function parseWords(text) {
  const seen = new Set();
  for (const w of String(text).toUpperCase().split(/[^A-Z]+/)) {
    if (w) seen.add(w.slice(0, 14));
  }
  return [...seen].slice(0, 14);
}

/* ───────────────────── sudoku puzzles ──────────────────── */

const parse = (str) => str.replace(/[^0-9.]/g, '').split('').map((c) => (c === '.' ? 0 : Number(c)));

export const SUDOKU = {
  easy: parse(`
    53..7....
    6..195...
    .98....6.
    8...6...3
    4..8.3..1
    7...2...6
    .6....28.
    ...419..5
    ....8..79`),
  medium: parse(`
    ..9748...
    7........
    .2.1.9...
    ..7...24.
    .64.1.59.
    .98...3..
    ...8.3.2.
    ........6
    ...2759..`),
  // 25 clues, unique solution, and deliberately sparse in the top-left —
  // brute force scans in reading order, so early gaps cost it dearly.
  // Measured at ~213k steps and 21k backtracks.
  hard: parse(`
    ......8..
    ...5....9
    7.4....6.
    ..29.....
    9....7.32
    4.3.2....
    ..8.9...3
    ...6.1...
    .5.2.3.76`),
};

/* ───────────────────── graph building ──────────────────── */

const NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const randInt = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

/**
 * Build a random graph matching what the algorithm needs.
 *
 * Every graph starts as a random spanning tree so it is always
 * connected — a disconnected graph makes most of these algorithms
 * look broken when they are behaving correctly.
 */
export function buildGraph(n, spec, opts = {}) {
  const nodes = Array.from({ length: n }, (_, i) => ({ name: NAMES[i % 26] }));
  const edges = [];
  const seen = new Set();

  const key = (a, b) => (spec.directed ? `${a}>${b}` : `${Math.min(a,b)}-${Math.max(a,b)}`);
  const weightFor = (a, b) => {
    if (!spec.weighted) return 1;
    // Negative weights only ever point "forward", so no negative cycle
    // can form by accident — the toggle below adds one deliberately.
    if (spec.negative && a < b && random() < 0.3) return -randInt(1, 4);
    return randInt(1, 9);
  };
  const add = (a, b) => {
    if (a === b) return;
    const k = key(a, b);
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ a, b, w: weightFor(a, b) });
  };

  // spanning tree: every node hangs off an earlier one
  for (let i = 1; i < n; i++) {
    const parent = randInt(0, i - 1);
    // In a DAG, arrows must always run from the lower index to the higher.
    spec.acyclic || spec.negative ? add(parent, i) : (random() < 0.5 ? add(parent, i) : add(i, parent));
  }

  // a few extra edges for interest
  const extras = Math.round(n * (opts.extra ?? 0.4));
  for (let k = 0; k < extras; k++) {
    let a = randInt(0, n - 1), b = randInt(0, n - 1);
    if (spec.acyclic || spec.negative) { if (a > b) [a, b] = [b, a]; }
    add(a, b);
  }

  // deliberately create a cycle for the algorithms that hunt for one
  if (spec.directed && !spec.acyclic && !spec.negative && n > 3) {
    add(n - 1, randInt(0, Math.floor(n / 2)));
  }
  if (spec.negative && opts.negativeCycle && n > 3) {
    // Guarantee a real cycle: force the loop 1 → 2 → 3 → 1 to exist,
    // then make the way back cheap enough that going round it forever
    // keeps lowering the cost. Just adding a back edge isn't enough —
    // the forward path has to exist too.
    const ensure = (a, b, w) => {
      const existing = edges.find((e) => e.a === a && e.b === b);
      if (existing) existing.w = w;
      else edges.push({ a, b, w });
    };
    ensure(1, 2, 1);
    ensure(2, 3, 1);
    ensure(3, 1, -9);
  }

  // adjacency list: for each node, the edges leaving it
  const adj = Array.from({ length: n }, () => []);
  edges.forEach((e, i) => {
    adj[e.a].push({ to: e.b, w: e.w, edge: i });
    if (!spec.directed) adj[e.b].push({ to: e.a, w: e.w, edge: i });
  });

  return { nodes, edges, adj, directed: !!spec.directed, weighted: !!spec.weighted, start: 0 };
}

/* ───────────────────── grid helpers ────────────────────── */

/**
 * Pick a row count that fills the stage instead of leaving bands of
 * empty space above and below the board.
 */
export function fitGridRows(canvas) {
  const g = state.grid;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const aspect = rect.width / rect.height;
  const rows = Math.max(9, Math.round(g.cols / aspect)) | 1;   // odd, for mazes
  if (rows !== g.rows) {
    g.rows = rows;
    resetGrid();
  }
}

/** Put S and G at sensible spots and clear anything stale. */
export function resetGrid({ keepWalls = false } = {}) {
  const g = state.grid;
  const mid = Math.floor(g.rows / 2);
  g.start = mid * g.cols + 2;
  g.goal = mid * g.cols + (g.cols - 3);
  if (!keepWalls) g.walls = new Set();
  g.weights = new Uint8Array(g.cols * g.rows).fill(1);
  if (g.weighted) sprinkleWeights();
}

/** Patches of slow terrain, so Dijkstra has something to think about. */
function sprinkleWeights() {
  const g = state.grid;
  g.weights = new Uint8Array(g.cols * g.rows).fill(1);
  const blobs = Math.max(3, Math.floor((g.cols * g.rows) / 160));
  for (let b = 0; b < blobs; b++) {
    const cx = Math.floor(random() * g.cols);
    const cy = Math.floor(random() * g.rows);
    const r = 2 + Math.floor(random() * 3);
    const w = 3 + Math.floor(random() * 7);
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        g.weights[y * g.cols + x] = w;
      }
    }
  }
  g.weights[g.start] = 1;
  g.weights[g.goal] = 1;
}

/** Scatter random blocks — a quick way to get an interesting board. */
function randomWalls(density = 0.28) {
  const g = state.grid;
  g.walls = new Set();
  for (let i = 0; i < g.cols * g.rows; i++) {
    if (i === g.start || i === g.goal) continue;
    if (random() < density) g.walls.add(i);
  }
}

/* ───────────────────── data generators ─────────────────── */

function randomInts(n, max = 99) {
  return Array.from({ length: n }, () => 1 + Math.floor(random() * max));
}

/** Build an array with a particular shape, so you can see how shape affects cost. */
export function generateArray(n, dist) {
  switch (dist) {
    case 'sorted':
      return randomInts(n).sort((a, b) => a - b);
    case 'reversed':
      return randomInts(n).sort((a, b) => b - a);
    case 'nearly': {
      // sorted, then a handful of neighbouring swaps
      const a = randomInts(n).sort((x, y) => x - y);
      for (let k = 0; k < Math.max(1, Math.floor(n / 12)); k++) {
        const i = Math.floor(random() * (n - 1));
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
      }
      return a;
    }
    case 'few': {
      const pool = randomInts(Math.max(2, Math.ceil(n / 8)));
      return Array.from({ length: n }, () => pool[Math.floor(random() * pool.length)]);
    }
    case 'signed':
      // Negative values exercise the zero line in the chart, and several
      // sorts have subtly different behaviour once values go below zero.
      return Array.from({ length: n }, () => Math.floor(random() * 120) - 55);
    case 'sawtooth': {
      const period = Math.max(3, Math.floor(n / 4));
      return Array.from({ length: n }, (_, i) => 5 + (i % period) * Math.floor(90 / period));
    }
    case 'random':
    default:
      return randomInts(n);
  }
}

/* ───────────────────── small DOM builders ──────────────── */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function field(labelText) {
  const f = el('div', 'field');
  if (labelText) f.append(el('span', null, labelText));
  return f;
}

function slider(labelText, { min, max, value, step = 1 }, onInput) {
  const f = field(labelText);
  const input = el('input');
  input.type = 'range';
  Object.assign(input, { min, max, value, step });
  const val = el('span', 'val', String(value));
  input.addEventListener('input', () => {
    val.textContent = input.value;
    onInput(Number(input.value));
  });
  f.append(input, val);
  return f;
}

function button(text, onClick, { active = false } = {}) {
  const b = el('button', 'btn' + (active ? ' on' : ''), text);
  b.addEventListener('click', () => onClick(b));
  return b;
}

function selectBox(labelText, options, current, onChange) {
  const f = field(labelText);
  const sel = el('select');
  for (const [value, text] of options) {
    const o = el('option', null, text);
    o.value = value;
    if (value === current) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  f.append(sel);
  return f;
}

function numberBox(labelText, value, onChange, { min, max } = {}) {
  const f = field(labelText);
  const input = el('input');
  input.type = 'number';
  input.value = value;
  if (min !== undefined) input.min = min;
  if (max !== undefined) input.max = max;
  input.addEventListener('change', () => onChange(Number(input.value)));
  f.append(input);
  return f;
}

export const ui = { el, field, slider, button, selectBox, numberBox };

/* ───────────────────── per-type controls ───────────────── */

const DISTRIBUTIONS = [
  ['random', 'random'],
  ['nearly', 'nearly sorted'],
  ['sorted', 'already sorted'],
  ['reversed', 'reversed'],
  ['few', 'few unique values'],
  ['sawtooth', 'sawtooth'],
  ['signed', 'mixed positive / negative'],
];

const builders = {

  /* ── plain array, for sorting ── */
  array(box, algo, rerun) {
    const s = state.array;
    if (!s.data || s.data.length !== s.size) s.data = generateArray(s.size, s.dist);

    box.append(
      slider('items', { min: 4, max: algo.id === 'bogo' ? 9 : 120, value: Math.min(s.size, algo.id === 'bogo' ? 9 : 120) }, (v) => {
        s.size = v;
        s.data = generateArray(v, s.dist);
        rerun();
      }),
      selectBox('shape', DISTRIBUTIONS, s.dist, (v) => {
        s.dist = v;
        s.data = generateArray(s.size, v);
        rerun();
      }),
      button('new array', () => { reseed(); s.data = generateArray(s.size, s.dist); rerun(); }),
    );

    if (algo.id === 'bogo' && s.size > 9) {
      s.size = 8;
      s.data = generateArray(8, s.dist);
    }
    return () => ({ array: s.data });
  },

  /* ── a list and a target, for searching ── */
  search(box, algo, rerun) {
    const s = state.search;
    const needsSorted = algo.needsSorted !== false;

    const regen = () => {
      // Distinct values so "the index of the target" is unambiguous.
      const pool = new Set();
      while (pool.size < s.size) pool.add(1 + Math.floor(random() * 99));
      s.data = [...pool];
      if (s.presorted) s.data.sort((a, b) => a - b);
    };
    const inOrder = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
    if (!s.data || s.data.length !== s.size || (s.presorted && !inOrder(s.data))) regen();

    const targetField = numberBox('target', s.target, (v) => { s.target = v; rerun(); });
    if (s.target === null || s.target === undefined) s.target = s.data[Math.floor(random() * s.data.length)];

    box.append(
      slider('items', { min: 4, max: 90, value: s.size }, (v) => { s.size = v; regen(); rerun(); }),
      targetField,
      // A dropdown rather than a toggle button: "list: sorted" read as a
      // label rather than a control, so nobody found it.
      selectBox('list order', [['sorted', 'already sorted'], ['unsorted', 'unsorted']],
        s.presorted ? 'sorted' : 'unsorted', (v) => {
          s.presorted = v === 'sorted';
          regen();
          rebuild(box, algo, rerun);
        }),
      button('pick one that exists', () => {
        s.target = s.data[Math.floor(random() * s.data.length)];
        targetField.querySelector('input').value = s.target;
        rerun();
      }),
      button('pick a missing one', () => {
        let t = 0;
        do { t = 1 + Math.floor(random() * 99); } while (s.data.includes(t));
        s.target = t;
        targetField.querySelector('input').value = t;
        rerun();
      }),
      button('new list', () => { reseed(); regen(); rerun(); }),
    );

    const hint = el('span', 'field', !s.presorted && needsSorted
      ? 'the list is unsorted, so this algorithm must sort it first — and the sort is counted'
      : needsSorted
        ? 'try "list: unsorted" — binary-style searches have to sort first, and that is not free'
        : 'this one works on any order, which is the whole point of the unsorted option');
    hint.style.opacity = '.7';
    box.append(hint);

    return () => ({ array: s.data, target: s.target, presorted: s.presorted });
  },

  /* ── an unsorted list and a rank to find ── */
  kth(box, algo, rerun) {
    const s = state.kth;
    if (!s.data || s.data.length !== s.size) s.data = generateArray(s.size, 'random');
    if (s.k >= s.size) s.k = Math.floor(s.size / 2);

    const kField = slider('k (0 = smallest)', { min: 0, max: s.size - 1, value: s.k }, (v) => { s.k = v; rerun(); });

    box.append(
      slider('items', { min: 3, max: 80, value: s.size }, (v) => {
        s.size = v;
        s.k = Math.min(s.k, v - 1);
        s.data = generateArray(v, 'random');
        rebuild(box, algo, rerun);
      }),
      kField,
      button('median', () => { s.k = Math.floor((s.size - 1) / 2); rebuild(box, algo, rerun); }),
      button('new list', () => { reseed(); s.data = generateArray(s.size, 'random'); rerun(); }),
    );
    const hint = el('span', 'field', 'the list is NOT sorted — that is the point');
    hint.style.opacity = '.7';
    box.append(hint);

    return () => ({ array: s.data, k: s.k });
  },

  /* ── 2D board, for pathfinding and mazes ── */
  grid(box, algo, rerun) {
    const g = state.grid;
    const isMaze = algo.id.startsWith('maze-');
    if (g.start === null) resetGrid();

    const resize = (cols) => {
      // Mazes need odd dimensions to carve properly.
      g.cols = cols % 2 ? cols : cols + 1;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      const aspect = rect.height ? rect.width / rect.height : 1.9;
      g.rows = Math.max(9, Math.round(g.cols / aspect)) | 1;
      resetGrid();
      rerun();
    };

    box.append(
      slider('board width', { min: 15, max: 81, value: g.cols, step: 2 }, resize),
    );

    if (!isMaze) {
      box.append(
        button('clear walls', () => { g.walls = new Set(); rerun(); }),
        button('random walls', () => { reseed(); randomWalls(); rerun(); }),
        button(g.weighted ? 'terrain: on' : 'terrain: off', (b) => {
          g.weighted = !g.weighted;
          b.textContent = g.weighted ? 'terrain: on' : 'terrain: off';
          b.classList.toggle('on', g.weighted);
          if (g.weighted) sprinkleWeights();
          else g.weights = new Uint8Array(g.cols * g.rows).fill(1);
          rerun();
        }, { active: g.weighted }),
        button(g.diagonal ? 'diagonals: on' : 'diagonals: off', (b) => {
          g.diagonal = !g.diagonal;
          b.textContent = g.diagonal ? 'diagonals: on' : 'diagonals: off';
          b.classList.toggle('on', g.diagonal);
          rerun();
        }, { active: g.diagonal }),
      );
      const hint = el('span', 'field', 'drag on the board to draw walls · drag S or G to move them');
      hint.style.opacity = '.7';
      box.append(hint);
    } else {
      const hint = el('span', 'field', 'when it finishes, switch to A* to solve the maze it built');
      hint.style.opacity = '.7';
      box.append(hint);
    }

    return () => ({
      cols: g.cols, rows: g.rows,
      walls: g.walls,
      start: g.start, goal: g.goal,
      weights: g.weighted ? g.weights : null,
      diagonal: g.diagonal,
    });
  },
};

/* ──────────────── mouse drawing on the board ───────────── */

let drag = null;   // 'wall' | 'erase' | 'start' | 'goal'

export const pointer = {
  grid: {
    down(e, { canvas, cellAt, rerun }) {
      const g = state.grid;
      const i = cellAt(canvas, g.cols, g.rows, e.clientX, e.clientY);
      if (i < 0) return;

      if (i === g.start) drag = 'start';
      else if (i === g.goal) drag = 'goal';
      else drag = g.walls.has(i) ? 'erase' : 'wall';

      applyDrag(i, rerun);
    },
    move(e, { canvas, cellAt, rerun }) {
      if (!drag) return;
      const g = state.grid;
      const i = cellAt(canvas, g.cols, g.rows, e.clientX, e.clientY);
      if (i < 0) return;
      applyDrag(i, rerun);
    },
    up() { drag = null; },
  },
};

function applyDrag(i, rerun) {
  const g = state.grid;
  if (drag === 'start') {
    if (i === g.goal || g.walls.has(i)) return;
    if (g.start === i) return;
    g.start = i;
  } else if (drag === 'goal') {
    if (i === g.start || g.walls.has(i)) return;
    if (g.goal === i) return;
    g.goal = i;
  } else if (drag === 'wall') {
    if (i === g.start || i === g.goal || g.walls.has(i)) return;
    g.walls.add(i);
  } else if (drag === 'erase') {
    if (!g.walls.has(i)) return;
    g.walls.delete(i);
  } else return;
  rerun();
}

/**
 * Render the controls an algorithm needs.
 * @returns {Function} call it to read the current input object
 */
export function buildInputs(algo, box, rerun) {
  box.replaceChildren();
  const builder = builders[algo.input];
  if (!builder) return () => ({});
  lastBuild = { algo, box, rerun };
  return builder(box, algo, rerun);
}

/* A preset button changes several values at once, so the controls
   themselves have to be redrawn to show the new state. */
let lastBuild = null;
function rebuild(box, algo, rerun) {
  box.replaceChildren();
  builders[algo.input](box, algo, rerun);
  rerun();
}

/** Let later categories register their own control builders. */
export function registerInput(type, builder) {
  builders[type] = builder;
}
