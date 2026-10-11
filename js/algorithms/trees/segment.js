/* ============================================================
   SEGMENT TREE
   ------------------------------------------------------------
   The problem: given a list, answer "what is the total between
   positions 3 and 11?" over and over, while the list also keeps
   changing.

   Adding the range up each time costs O(n) per question. Keeping
   a running-totals array answers instantly but costs O(n) to fix
   after every change. A segment tree takes O(log n) for both,
   which is what you want when questions and changes are mixed.

   It works by storing the total of a RANGE at each node: the
   root covers everything, its children cover each half, and so
   on down to single items. Any range you ask for can be built
   from at most about 2·log(n) of those nodes — so the query
   touches a handful of nodes instead of the whole list.
   ============================================================ */

import { T } from '../../views/tree-view.js';

const base = { view: 'tree', input: 'segment' };

/** Build the node list the tree view wants: each covers [lo, hi]. */
function buildNodes(values) {
  const nodes = [];
  const make = (lo, hi) => {
    const self = nodes.length;
    nodes.push({ lo, hi, sum: 0, children: [null, null] });
    if (lo < hi) {
      const mid = (lo + hi) >> 1;
      nodes[self].children[0] = make(lo, mid);
      nodes[self].children[1] = make(mid + 1, hi);
    }
    return self;
  };
  if (values.length) make(0, values.length - 1);
  return nodes;
}

const frameOf = (nodes, states, extra = {}) => ({
  nodes: nodes.map((n) => ({
    label: n.sum,
    tag: n.lo === n.hi ? `${n.lo}` : `${n.lo}-${n.hi}`,
    children: [...n.children],
  })),
  root: nodes.length ? 0 : null,
  states: states.slice(),
  binary: true,
  ...extra,
});

/* ───────────────────────── Build ───────────────────────── */

const build = {
  ...base,
  id: 'segtree-build',
  name: 'Segment Tree: Build',
  legend: [
    ['--c-compare', 'adding up its two halves'],
    ['--c-pivot',   'a single item'],
    ['--c-sorted',  'settled'],
  ],
  about: 'Each node holds the total of a range: the root covers the whole list, its children cover each half, and so on down to single items. Building it is one pass from the bottom up — a leaf is just its own value, and every other node is the sum of its two children. The whole tree is 2n-1 nodes and takes O(n) to build.',
  cost: { best: 'O(n)', avg: 'O(n)', worst: 'O(n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'build(node covering lo..hi):',
    '  if lo == hi, the node is just that one value',
    '  otherwise build both halves first',
    '  then the node is the sum of its two children',
  ],
  *run({ values }) {
    const nodes = buildNodes(values);
    if (!nodes.length) { yield frameOf(nodes, [], { note: 'nothing to build' }); return; }
    const blank = () => new Array(nodes.length).fill(T.IDLE);
    let adds = 0;

    yield frameOf(nodes, blank(), {
      line: 0,
      note: `${values.length} values → ${nodes.length} nodes`,
      stats: { nodes: nodes.length, additions: 0 },
    });

    function* fill(i) {
      const n = nodes[i];
      if (n.lo === n.hi) {
        n.sum = values[n.lo];
        const st = blank(); st[i] = T.INSERTED;
        yield frameOf(nodes, st, { line: 1, note: `position ${n.lo} holds ${n.sum}`, stats: { nodes: nodes.length, additions: adds } });
        return;
      }
      yield* fill(n.children[0]);
      yield* fill(n.children[1]);

      n.sum = nodes[n.children[0]].sum + nodes[n.children[1]].sum;
      adds++;
      const st = blank();
      st[i] = T.COMPARE;
      st[n.children[0]] = T.PATH;
      st[n.children[1]] = T.PATH;
      yield frameOf(nodes, st, {
        line: 3,
        note: `range ${n.lo}-${n.hi} = ${nodes[n.children[0]].sum} + ${nodes[n.children[1]].sum} = ${n.sum}`,
        stats: { nodes: nodes.length, additions: adds },
      });
    }

    yield* fill(0);
    yield frameOf(nodes, new Array(nodes.length).fill(T.DONE), {
      line: 3,
      note: `built in ${adds} additions — the root holds the total of everything, ${nodes[0].sum}`,
      stats: { nodes: nodes.length, additions: adds },
    });
  },
};

/* ───────────────────── Range query ─────────────────────── */

const query = {
  ...base,
  id: 'segtree-query',
  name: 'Segment Tree: Range Query',
  legend: [
    ['--c-sorted',  'used whole — its total goes straight into the answer'],
    ['--c-compare', 'partly inside, so look at its children'],
    ['--c-swap',    'entirely outside, ignored'],
  ],
  about: 'Ask for the total between two positions. Walk down from the root: a node completely inside the range contributes its stored total and the search stops there, a node completely outside is ignored, and only a node straddling the boundary needs its children looked at. At most two nodes per level can straddle, which is why the answer costs about 2·log(n) visits however long the list is.',
  cost: { best: 'O(1)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(log n)', stable: '—' },
  pseudocode: [
    'query(node, l, r):',
    '  if the node is entirely outside l..r, return 0',
    '  if the node is entirely inside, return its stored total',
    '  otherwise ask both children and add the answers',
  ],
  *run({ values, from, to }) {
    const nodes = buildNodes(values);
    if (!nodes.length) { yield frameOf(nodes, [], { note: 'nothing to query' }); return; }

    // Fill the sums quietly — this run is about the query.
    (function fill(i) {
      const n = nodes[i];
      if (n.lo === n.hi) { n.sum = values[n.lo]; return n.sum; }
      n.sum = fill(n.children[0]) + fill(n.children[1]);
      return n.sum;
    })(0);

    const lo = Math.min(from, to), hi = Math.max(from, to);
    const states = new Array(nodes.length).fill(T.IDLE);
    let visited = 0, used = 0;

    const f = (extra) => frameOf(nodes, states, {
      stats: { 'nodes visited': visited, 'whole nodes used': used, 'list length': values.length },
      ...extra,
    });

    yield f({ line: 0, note: `total between positions ${lo} and ${hi} — adding them up one by one would take ${hi - lo + 1} steps` });

    function* ask(i) {
      const n = nodes[i];
      visited++;

      if (n.hi < lo || n.lo > hi) {
        states[i] = T.REMOVED;
        yield f({ line: 1, note: `range ${n.lo}-${n.hi} is entirely outside — ignore it and everything below it` });
        return 0;
      }
      if (n.lo >= lo && n.hi <= hi) {
        states[i] = T.DONE;
        used++;
        yield f({ line: 2, note: `range ${n.lo}-${n.hi} is entirely inside — take its stored total ${n.sum} and stop here` });
        return n.sum;
      }

      states[i] = T.COMPARE;
      yield f({ line: 3, note: `range ${n.lo}-${n.hi} straddles the boundary — ask both halves` });
      const left = yield* ask(n.children[0]);
      const right = yield* ask(n.children[1]);
      return left + right;
    }

    const answer = yield* ask(0);
    const bruteForce = hi - lo + 1;
    yield f({
      line: 3,
      note: `total is ${answer}, from ${used} stored node${used === 1 ? '' : 's'} — ${visited} nodes visited against ${bruteForce} values if you added them up directly`,
      stats: { 'nodes visited': visited, 'whole nodes used': used, 'list length': values.length, answer },
    });
  },
};

export const SEGMENT = [build, query];
