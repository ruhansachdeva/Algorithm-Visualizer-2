import { random } from './rng.js';

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
  search: { size: 24, target: 7, data: null },
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
      button('new array', () => { s.data = generateArray(s.size, s.dist); rerun(); }),
    );

    if (algo.id === 'bogo' && s.size > 9) {
      s.size = 8;
      s.data = generateArray(8, s.dist);
    }
    return () => ({ array: s.data });
  },

  /* ── sorted array + a target, for searching ── */
  search(box, algo, rerun) {
    const s = state.search;
    const needsSorted = algo.needsSorted !== false;

    const regen = () => {
      s.data = generateArray(s.size, needsSorted ? 'random' : s.dist || 'random');
      if (needsSorted) s.data.sort((a, b) => a - b);
      // keep duplicates out of sorted searches so "the index" is unambiguous
      if (needsSorted) s.data = [...new Set(s.data)].sort((a, b) => a - b);
    };
    if (!s.data || (needsSorted && s.data.some((v, i, a) => i && a[i - 1] > v))) regen();
    if (s.target === null || s.target === undefined) s.target = s.data[Math.floor(random() * s.data.length)];

    const targetField = numberBox('target', s.target, (v) => { s.target = v; rerun(); });

    box.append(
      slider('items', { min: 4, max: 90, value: s.size }, (v) => { s.size = v; regen(); rerun(); }),
      targetField,
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
      button('new list', () => { regen(); rerun(); }),
    );

    if (needsSorted) {
      const hint = el('span', 'field', 'list is kept sorted — binary-style searches require it');
      hint.style.opacity = '.7';
      box.append(hint);
    }
    return () => ({ array: s.data, target: s.target });
  },

  /* ── two whole numbers ── */
  'two-numbers'(box, algo, rerun) {
    const s = state.pair;
    box.append(
      numberBox('a', s.a, (v) => { s.a = Math.max(1, Math.min(99999, v | 0)); rerun(); }),
      numberBox('b', s.b, (v) => { s.b = Math.max(0, Math.min(99999, v | 0)); rerun(); }),
      button("Euclid's own example", () => { s.a = 1071; s.b = 462; rebuild(box, algo, rerun); }),
      button('coprime pair', () => { s.a = 1234; s.b = 4567; rebuild(box, algo, rerun); }),
      button('random', () => {
        s.a = 2 + Math.floor(random() * 9000);
        s.b = 2 + Math.floor(random() * 9000);
        rebuild(box, algo, rerun);
      }),
    );
    return () => ({ a: s.a, b: s.b });
  },

  /* ── base, exponent, modulus ── */
  power(box, algo, rerun) {
    const s = state.power;
    box.append(
      numberBox('base', s.base, (v) => { s.base = Math.max(1, Math.min(999, v | 0)); rerun(); }),
      slider('exponent', { min: 1, max: 255, value: s.exp }, (v) => { s.exp = v; rerun(); }),
      button('prime modulus', () => { s.mod = 1000000007; rebuild(box, algo, rerun); }),
      button('small modulus', () => { s.mod = 1000; rebuild(box, algo, rerun); }),
    );
    const hint = el('span', 'field', `working mod ${s.mod} — a bigger exponent costs one more step each time it doubles`);
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ base: s.base, exp: s.exp, mod: s.mod });
  },

  /* ── a cloud of 2D points ── */
  points(box, algo, rerun) {
    const s = state.points;

    const make = () => {
      const n = s.n;
      if (s.shape === 'circle') {
        // Points near a circle: almost every one ends up on the hull.
        s.data = Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + random() * 0.1;
          const r = 0.42 + random() * 0.04;
          return { x: 0.5 + r * Math.cos(a), y: 0.5 + r * Math.sin(a) };
        });
      } else if (s.shape === 'clustered') {
        // A tight blob: a handful of corners and a lot of interior.
        s.data = Array.from({ length: n }, () => ({
          x: 0.5 + (random() - 0.5) * 0.45 * random(),
          y: 0.5 + (random() - 0.5) * 0.45 * random(),
        }));
      } else {
        s.data = Array.from({ length: n }, () => ({
          x: 0.06 + random() * 0.88,
          y: 0.06 + random() * 0.88,
        }));
      }
    };
    if (!s.data || s.data.length !== s.n) make();

    box.append(
      slider('points', { min: 3, max: 90, value: s.n }, (v) => { s.n = v; make(); rerun(); }),
      button('new points', () => { make(); rerun(); }),
    );
    for (const [key, name] of [['scattered', 'scattered'], ['clustered', 'clustered'], ['circle', 'near a circle']]) {
      box.append(button(name, () => { s.shape = key; make(); rebuild(box, algo, rerun); }, { active: s.shape === key }));
    }
    const hint = el('span', 'field', 'on a circle almost every point is a corner; in a cluster almost none are');
    hint.style.opacity = '.7';
    box.append(hint);

    return () => ({ points: s.data });
  },

  /* ── an upper limit, for sieves ── */
  sieve(box, algo, rerun) {
    const s = state.sieve;
    box.append(
      slider('up to', { min: 10, max: 400, value: s.limit, step: 10 }, (v) => { s.limit = v; rerun(); }),
    );
    const hint = el('span', 'field', 'watch the multiples of 2 go, then 3, then 5 — by 11 there is almost nothing left to cross out');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ limit: s.limit });
  },

  /* ── one string to search inside ── */
  palindrome(box, algo, rerun) {
    const s = state.palindrome;
    const f = field('text');
    const input = el('input');
    input.type = 'text';
    input.style.width = '260px';
    input.value = s.text;
    input.addEventListener('input', () => { s.text = input.value.toUpperCase().slice(0, 34); input.value = s.text; rerun(); });
    f.append(input);
    box.append(
      f,
      button('odd-length answer', () => { s.text = 'BANANARAMA'; rebuild(box, algo, rerun); }),
      button('even-length answer', () => { s.text = 'FORGEEKSSKEEGFOR'; rebuild(box, algo, rerun); }),
      button('no palindrome', () => { s.text = 'ABCDEFG'; rebuild(box, algo, rerun); }),
    );
    const hint = el('span', 'field', 'even-length answers need a centre that sits between two characters');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ text: s.text });
  },

  /* ── a short text to compress ── */
  huffman(box, algo, rerun) {
    const s = state.huffman;
    const f = field('text');
    const input = el('input');
    input.type = 'text';
    input.style.width = '280px';
    input.value = s.text;
    input.addEventListener('input', () => { s.text = input.value.slice(0, 60); input.value = s.text; rerun(); });
    f.append(input);

    box.append(
      f,
      button('ABRACADABRA', () => { s.text = 'ABRACADABRA'; rebuild(box, algo, rerun); }),
      button('lopsided', () => { s.text = 'AAAAAAAAAAAAAAAABBBBCCDE'; rebuild(box, algo, rerun); }),
      button('all equal', () => { s.text = 'ABCDEFGH'; rebuild(box, algo, rerun); }),
    );
    const hint = el('span', 'field', 'lopsided letter counts compress well; equal counts barely compress at all');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ text: s.text });
  },

  /* ── a list of words, for tries ── */
  words(box, algo, rerun) {
    const s = state.words;
    const wantsTarget = algo.id === 'trie-search';

    const listField = field('words');
    const listInput = el('input');
    listInput.type = 'text';
    listInput.style.width = '300px';
    listInput.value = s.list;
    listInput.addEventListener('input', () => { s.list = listInput.value; rerun(); });
    listField.append(listInput);
    box.append(listField);

    if (wantsTarget) {
      const tf = field('look up');
      const ti = el('input');
      ti.type = 'text';
      ti.style.width = '110px';
      ti.value = s.target;
      ti.addEventListener('input', () => { s.target = ti.value.toUpperCase(); ti.value = s.target; rerun(); });
      tf.append(ti);
      box.append(tf);
    }

    box.append(
      button('shared prefixes', () => { s.list = 'CAT, CAR, CARD, CARE, CARGO, CAT'; s.target = 'CAR'; rebuild(box, algo, rerun); }),
      button('nothing in common', () => { s.list = 'APPLE, BANANA, CHERRY, DATE'; s.target = 'BANANA'; rebuild(box, algo, rerun); }),
    );

    if (wantsTarget) {
      const hint = el('span', 'field', 'try a word that is only a prefix — "CAR" when CARD is stored');
      hint.style.opacity = '.7';
      box.append(hint);
    }

    return () => ({
      words: parseWords(s.list),
      target: (s.target || '').toUpperCase(),
    });
  },

  /* ── text + pattern, for string matching ── */
  string(box, algo, rerun) {
    const s = state.string;
    const textBox = (labelText, key, width) => {
      const f = field(labelText);
      const input = el('input');
      input.type = 'text';
      input.value = s[key];
      if (width) input.style.width = width;
      input.addEventListener('input', () => {
        s[key] = input.value.toUpperCase().slice(0, key === 'text' ? 46 : 12);
        input.value = s[key];
        rerun();
      });
      f.append(input);
      return f;
    };

    box.append(
      textBox('text', 'text', '280px'),
      textBox('pattern', 'pattern', '110px'),
      button('worst case for naive', () => {
        s.text = 'AAAAAAAAAAAAAAAAAAAAAAAA';
        s.pattern = 'AAAAB';
        rebuild(box, algo, rerun);
      }),
      button('long skips for Boyer-Moore', () => {
        s.text = 'THE QUICK BROWN FOX JUMPS OVER A DOG';
        s.pattern = 'JUMPS';
        rebuild(box, algo, rerun);
      }),
    );
    const hint = el('span', 'field', 'run the same text through all four and compare the comparison counts');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ text: s.text, pattern: s.pattern });
  },

  /* ── N-Queens ── */
  queens(box, algo, rerun) {
    const s = state.queens;
    box.append(
      slider('board size', { min: 4, max: 12, value: s.n }, (v) => { s.n = v; rerun(); }),
      button(s.findAll ? 'find: every solution' : 'find: first solution', (b) => {
        s.findAll = !s.findAll;
        b.textContent = s.findAll ? 'find: every solution' : 'find: first solution';
        b.classList.toggle('on', s.findAll);
        rerun();
      }, { active: s.findAll }),
    );
    const hint = el('span', 'field', 'there is no solution for a 2×2 or 3×3 board — try it');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ n: s.n, findAll: s.findAll });
  },

  /* ── Sudoku ── */
  sudoku(box, algo, rerun) {
    const s = state.sudoku;
    for (const [key, name] of [['easy', 'easy'], ['medium', 'medium'], ['hard', 'hard (lots of backtracking)']]) {
      box.append(button(name, () => { s.which = key; rebuild(box, algo, rerun); }, { active: s.which === key }));
    }
    return () => ({ puzzle: SUDOKU[s.which] });
  },

  /* ── a small set to enumerate over ── */
  enumerate(box, algo, rerun) {
    const s = state.enumerate;
    // Permutations blow up far faster than subsets, so they get a tighter cap.
    const max = algo.id === 'bt-permutations' ? 6 : 9;
    if (s.n > max) s.n = max;

    box.append(
      slider('items', { min: 1, max, value: s.n }, (v) => { s.n = v; rerun(); }),
    );
    const total = algo.id === 'bt-permutations'
      ? Array.from({ length: s.n }, (_, i) => i + 1).reduce((a, b) => a * b, 1)
      : 2 ** s.n;
    const hint = el('span', 'field',
      `${s.n} items → ${total.toLocaleString()} ${algo.id === 'bt-permutations' ? 'orderings' : 'subsets'}` +
      (algo.id === 'bt-permutations' ? ' · capped at 6 because 10 items is over three million' : ''));
    hint.style.opacity = '.7';
    box.append(hint);

    return () => ({ values: Array.from({ length: s.n }, (_, i) => i + 1) });
  },

  /* ── Towers of Hanoi ── */
  hanoi(box, algo, rerun) {
    const s = state.hanoi;
    box.append(slider('disks', { min: 1, max: 10, value: s.n }, (v) => { s.n = v; rerun(); }));
    const hint = el('span', 'field', 'every extra disk doubles the number of moves');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ n: s.n });
  },

  /* ── dynamic programming inputs ── */

  'dp-n'(box, algo, rerun) {
    const d = state.dp;
    box.append(slider('n', { min: 2, max: 40, value: d.n }, (v) => { d.n = v; rerun(); }));
    return () => ({ n: d.n });
  },

  'dp-two-strings'(box, algo, rerun) {
    const d = state.dp;
    const textBox = (labelText, key) => {
      const f = field(labelText);
      const input = el('input');
      input.type = 'text';
      input.value = d[key];
      input.addEventListener('input', () => {
        d[key] = input.value.toUpperCase().slice(0, 14);
        input.value = d[key];
        rerun();
      });
      f.append(input);
      return f;
    };
    box.append(
      textBox('string A', 'a'),
      textBox('string B', 'b'),
      button('KITTEN / SITTING', () => { d.a = 'KITTEN'; d.b = 'SITTING'; rebuild(box, algo, rerun); }),
      button('ALGORITHM / LOGARITHM', () => { d.a = 'ALGORITHM'; d.b = 'LOGARITHM'; rebuild(box, algo, rerun); }),
    );
    return () => ({ a: d.a || 'A', b: d.b || 'B' });
  },

  'dp-rod'(box, algo, rerun) {
    const d = state.dp;
    const f = field('piece prices');
    const input = el('input');
    input.type = 'text';
    input.style.width = '220px';
    input.value = d.prices.join(', ');
    input.addEventListener('input', () => {
      const parsed = input.value.split(/[^0-9]+/).map(Number).filter((x) => x >= 0);
      if (parsed.length) { d.prices = parsed.slice(0, 10); rerun(); }
    });
    f.append(input);
    box.append(
      f,
      button('textbook prices', () => { d.prices = [1, 5, 8, 9, 10, 17, 17, 20]; rebuild(box, algo, rerun); }),
      button('whole rod wins', () => { d.prices = [1, 2, 3, 4, 50]; rebuild(box, algo, rerun); }),
    );
    const hint = el('span', 'field', 'the nth number is what a piece of length n sells for');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ prices: d.prices });
  },

  'dp-signed'(box, algo, rerun) {
    const d = state.dp;
    box.append(
      slider('values', { min: 4, max: 24, value: d.signed.length }, (v) => {
        d.signed = Array.from({ length: v }, () => Math.floor(random() * 24) - 11);
        rerun();
      }),
      button('new values', () => {
        d.signed = d.signed.map(() => Math.floor(random() * 24) - 11);
        rerun();
      }),
      button('textbook example', () => { d.signed = [-2, 1, -3, 4, -1, 2, 1, -5, 4]; rebuild(box, algo, rerun); }),
      button('all negative', () => { d.signed = [-8, -3, -6, -2, -5, -4]; rebuild(box, algo, rerun); }),
    );
    const hint = el('span', 'field', 'with every value negative the answer is the single least-bad one');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ array: d.signed });
  },

  'dp-array'(box, algo, rerun) {
    const d = state.dp;
    box.append(
      slider('values', { min: 4, max: 20, value: d.array.length }, (v) => {
        d.array = Array.from({ length: v }, () => 1 + Math.floor(random() * 40));
        rerun();
      }),
      button('new values', () => {
        d.array = d.array.map(() => 1 + Math.floor(random() * 40));
        rerun();
      }),
    );
    return () => ({ array: d.array });
  },

  'dp-coins'(box, algo, rerun) {
    const d = state.dp;
    const coinsField = field('coins');
    const input = el('input');
    input.type = 'text';
    input.value = d.coins.join(', ');
    input.addEventListener('input', () => {
      const parsed = input.value.split(/[,\s]+/).map(Number).filter((x) => Number.isInteger(x) && x > 0);
      if (parsed.length) { d.coins = parsed.slice(0, 6); rerun(); }
    });
    coinsField.append(input);

    box.append(
      coinsField,
      slider('amount', { min: 1, max: 40, value: d.amount }, (v) => { d.amount = v; rerun(); }),
      button('1, 3, 4 (greedy fails here)', () => { d.coins = [1, 3, 4]; d.amount = 6; rebuild(box, algo, rerun); }),
      button('UK coins', () => { d.coins = [1, 2, 5, 10, 20]; d.amount = 33; rebuild(box, algo, rerun); }),
    );
    return () => ({ coins: d.coins, amount: d.amount });
  },

  'dp-subset'(box, algo, rerun) {
    const d = state.dp;
    const numsField = field('numbers');
    const input = el('input');
    input.type = 'text';
    input.value = d.numbers.join(', ');
    input.addEventListener('input', () => {
      const parsed = input.value.split(/[,\s]+/).map(Number).filter((x) => Number.isInteger(x) && x > 0);
      if (parsed.length) { d.numbers = parsed.slice(0, 8); rerun(); }
    });
    numsField.append(input);

    box.append(
      numsField,
      slider('target', { min: 1, max: 40, value: d.target }, (v) => { d.target = v; rerun(); }),
      button('new numbers', () => {
        d.numbers = Array.from({ length: 6 }, () => 1 + Math.floor(random() * 15));
        rebuild(box, algo, rerun);
      }),
    );
    return () => ({ numbers: d.numbers, target: d.target });
  },

  'dp-matrix'(box, algo, rerun) {
    const d = state.dp;
    const f = field('dimensions');
    const input = el('input');
    input.type = 'text';
    input.style.width = '210px';
    input.value = d.dims.join(' x ');
    input.addEventListener('input', () => {
      const parsed = input.value.split(/[^0-9]+/).map(Number).filter((x) => x > 0);
      if (parsed.length >= 2) { d.dims = parsed.slice(0, 8); rerun(); }
    });
    f.append(input);

    const shapes = el('span', 'field');
    const describe = () => {
      shapes.textContent = d.dims.slice(0, -1)
        .map((_, i) => `A${i + 1}=${d.dims[i]}x${d.dims[i + 1]}`).join('  ');
    };
    describe();
    shapes.style.opacity = '.7';

    box.append(
      f,
      button('classic example', () => { d.dims = [10, 30, 5, 60]; rebuild(box, algo, rerun); }),
      button('textbook chain', () => { d.dims = [30, 35, 15, 5, 10, 20, 25]; rebuild(box, algo, rerun); }),
      button('random', () => {
        const k = 4 + Math.floor(random() * 3);
        d.dims = Array.from({ length: k }, () => 5 * (1 + Math.floor(random() * 12)));
        rebuild(box, algo, rerun);
      }),
      shapes,
    );
    return () => ({ dims: d.dims });
  },

  'dp-knapsack'(box, algo, rerun) {
    const d = state.dp;
    box.append(
      slider('items', { min: 2, max: 7, value: d.items.length }, (v) => {
        d.items = Array.from({ length: v }, () => ({
          v: 10 * (1 + Math.floor(random() * 12)),
          w: 1 + Math.floor(random() * 7),
        }));
        rerun();
      }),
      slider('bag capacity', { min: 3, max: 22, value: d.capacity }, (v) => { d.capacity = v; rerun(); }),
      button('new items', () => {
        d.items = d.items.map(() => ({
          v: 10 * (1 + Math.floor(random() * 12)),
          w: 1 + Math.floor(random() * 7),
        }));
        rerun();
      }),
    );
    const hint = el('span', 'field', 'each item is shown as value/weight');
    hint.style.opacity = '.7';
    box.append(hint);
    return () => ({ items: d.items, capacity: d.capacity });
  },

  /* ── a list of values to build a tree from ── */
  tree(box, algo, rerun) {
    const s = state.tree;
    const wantsTarget = algo.id === 'bst-search' || algo.id === 'bst-delete';

    const regen = () => {
      // distinct values, so "the" node for a key is unambiguous
      const pool = new Set();
      while (pool.size < s.size) pool.add(1 + Math.floor(random() * 99));
      s.values = [...pool];
      if (s.sorted) s.values.sort((a, b) => a - b);
      s.target = s.values[Math.floor(random() * s.values.length)];
    };
    if (!s.values || s.values.length !== s.size) regen();

    const targetField = wantsTarget
      ? numberBox('target', s.target, (v) => { s.target = v; rerun(); })
      : null;

    box.append(
      slider('values', { min: 3, max: 24, value: s.size }, (v) => { s.size = v; regen(); if (targetField) targetField.querySelector('input').value = s.target; rerun(); }),
      button(s.sorted ? 'input: sorted' : 'input: shuffled', (b) => {
        s.sorted = !s.sorted;
        b.textContent = s.sorted ? 'input: sorted' : 'input: shuffled';
        b.classList.toggle('on', s.sorted);
        regen();
        if (targetField) targetField.querySelector('input').value = s.target;
        rerun();
      }, { active: s.sorted }),
      button('new values', () => { regen(); if (targetField) targetField.querySelector('input').value = s.target; rerun(); }),
    );
    if (targetField) box.append(targetField);

    const hint = el('span', 'field', s.sorted
      ? 'sorted input is the worst case — compare BST Insert with AVL Insert on it'
      : 'try "input: sorted" and compare BST Insert against AVL Insert');
    hint.style.opacity = '.7';
    box.append(hint);

    return () => ({ values: s.values, target: s.target });
  },

  /* ── node-and-edge graph ── */
  graph(box, algo, rerun) {
    const g = state.graph;
    const spec = algo.graph || {};
    // Different algorithms want different graph shapes, so the cached
    // graph is keyed by the shape it was built for.
    const key = JSON.stringify([spec, g.size, g.extra, g.negativeCycle]);

    const regen = () => {
      g.cache = buildGraph(g.size, spec, { extra: g.extra, negativeCycle: g.negativeCycle });
      g.key = JSON.stringify([spec, g.size, g.extra, g.negativeCycle]);
    };
    if (!g.cache || g.key !== key) regen();

    box.append(
      slider('nodes', { min: 4, max: 16, value: g.size }, (v) => { g.size = v; regen(); rerun(); }),
      slider('extra edges', { min: 0, max: 12, value: Math.round(g.extra * 10) }, (v) => { g.extra = v / 10; regen(); rerun(); }),
      button('new graph', () => { regen(); rerun(); }),
      // Clearing the positions makes the view lay the graph out afresh.
      button('re-layout', () => {
        for (const node of g.cache.nodes) { delete node.x; delete node.y; }
        rerun();
      }),
    );

    if (algo.id === 'bt-coloring') {
      g.colors = g.colors ?? 3;
      box.append(slider('colours allowed', { min: 1, max: 6, value: g.colors }, (v) => { g.colors = v; rerun(); }));
      const hint = el('span', 'field', 'drop to 2 and most graphs become impossible — that is the bipartite question');
      hint.style.opacity = '.7';
      box.append(hint);
    }

    if (spec.negative) {
      box.append(button(g.negativeCycle ? 'negative cycle: on' : 'negative cycle: off', (b) => {
        g.negativeCycle = !g.negativeCycle;
        b.textContent = g.negativeCycle ? 'negative cycle: on' : 'negative cycle: off';
        b.classList.toggle('on', g.negativeCycle);
        regen();
        rerun();
      }, { active: g.negativeCycle }));
      const hint = el('span', 'field', 'turn this on to watch the extra round catch a cycle that makes paths meaningless');
      hint.style.opacity = '.7';
      box.append(hint);
    }

    return () => ({ ...g.cache, colors: g.colors ?? 3 });
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
      button('new list', () => { s.data = generateArray(s.size, 'random'); rerun(); }),
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
        button('random walls', () => { randomWalls(); rerun(); }),
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
