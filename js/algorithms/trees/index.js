/* ============================================================
   TREE ALGORITHMS
   ------------------------------------------------------------
   A binary search tree keeps one promise: everything in a node's
   left subtree is smaller than it, everything on the right is
   bigger. That single rule is what lets you throw away half the
   tree at every step — and it is also what breaks when the input
   arrives already sorted, which is the problem AVL trees fix.
   ============================================================ */

import { T, TREE_LEGEND } from '../../views/tree-view.js';
import { TRIES } from './trie.js';
import { REDBLACK } from './redblack.js';
import { HUFFMAN } from './huffman.js';
import { SEGMENT } from './segment.js';

const base = { view: 'tree', input: 'tree', legend: TREE_LEGEND };

/* ───────────────────── tree plumbing ───────────────────── */

const empty = () => ({ nodes: [], root: null });

function addNode(t, key, extra = {}) {
  t.nodes.push({ label: key, key, children: [null, null], ...extra });
  return t.nodes.length - 1;
}

/** A frame has to deep-ish copy the tree, because its shape changes. */
function tf(t, states, extra = {}) {
  return {
    nodes: t.nodes.map((n) => ({ ...n, children: [...n.children] })),
    root: t.root,
    states: states.slice(),
    ...extra,
  };
}

const clear = (t) => new Array(t.nodes.length).fill(T.IDLE);
const L = 0, R = 1;

/** Plain BST insert with no animation — used to set up a starting tree. */
function quietInsert(t, key) {
  const fresh = addNode(t, key);
  if (t.root === null) { t.root = fresh; return fresh; }
  let cur = t.root;
  while (true) {
    const side = key < t.nodes[cur].key ? L : R;
    if (t.nodes[cur].children[side] === null) {
      t.nodes[cur].children[side] = fresh;
      return fresh;
    }
    cur = t.nodes[cur].children[side];
  }
}

function buildTree(values) {
  const t = empty();
  for (const v of values) quietInsert(t, v);
  return t;
}

function heightOf(t, i) {
  if (i === null) return 0;
  return 1 + Math.max(heightOf(t, t.nodes[i].children[L]), heightOf(t, t.nodes[i].children[R]));
}

/* ───────────────────────── Insert ──────────────────────── */

const insert = {
  ...base,
  id: 'bst-insert',
  name: 'BST Insert',
  about: 'Each new value walks down from the root, going left when it is smaller and right when it is bigger, until it falls off the bottom — and that is where it lands. Watch what happens if you feed it sorted input: every value goes right, and the "tree" degenerates into a linked list where lookups cost O(n).',
  cost: { best: 'O(log n)', avg: 'O(log n)', worst: 'O(n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'if the tree is empty, the new value becomes the root',
    'start at the root',
    'if the new value is smaller, go left; if bigger, go right',
    'repeat until that direction is empty',
    'hang the new node there',
  ],
  *run({ values }) {
    const t = empty();
    let comparisons = 0;

    for (const v of values) {
      const states = clear(t);
      yield tf(t, states, { line: 1, note: `inserting ${v}`, stats: { nodes: t.nodes.length, comparisons, height: heightOf(t, t.root) } });

      if (t.root === null) {
        t.root = addNode(t, v);
        const st = clear(t);
        st[t.root] = T.INSERTED;
        yield tf(t, st, { line: 0, note: `${v} is the first value — it becomes the root`, stats: { nodes: t.nodes.length, comparisons, height: 1 } });
        continue;
      }

      let cur = t.root;
      const path = [];
      while (true) {
        comparisons++;
        path.push(cur);
        const st = clear(t);
        for (const p of path) st[p] = T.PATH;
        st[cur] = T.COMPARE;
        const smaller = v < t.nodes[cur].key;
        yield tf(t, st, {
          line: 2,
          note: `${v} vs ${t.nodes[cur].key} → go ${smaller ? 'left' : 'right'}`,
          stats: { nodes: t.nodes.length, comparisons, height: heightOf(t, t.root) },
        });

        const side = smaller ? L : R;
        if (t.nodes[cur].children[side] === null) {
          const fresh = addNode(t, v);
          t.nodes[cur].children[side] = fresh;
          const st2 = clear(t);
          for (const p of path) st2[p] = T.PATH;
          st2[fresh] = T.INSERTED;
          yield tf(t, st2, { line: 4, note: `nothing to the ${smaller ? 'left' : 'right'} — ${v} goes here`, stats: { nodes: t.nodes.length, comparisons, height: heightOf(t, t.root) } });
          break;
        }
        cur = t.nodes[cur].children[side];
      }
    }

    const done = new Array(t.nodes.length).fill(T.DONE);
    yield tf(t, done, { note: `${t.nodes.length} nodes, height ${heightOf(t, t.root)} (a perfectly balanced tree would be ${Math.ceil(Math.log2(t.nodes.length + 1))})`, stats: { nodes: t.nodes.length, comparisons, height: heightOf(t, t.root) } });
  },
};

/* ───────────────────────── Search ──────────────────────── */

const search = {
  ...base,
  id: 'bst-search',
  name: 'BST Search',
  about: 'Binary search, but walking pointers instead of indices. Every comparison discards an entire subtree. On a balanced tree that is O(log n); on the degenerate tree that sorted input produces, it is the same as scanning a list.',
  cost: { best: 'O(1)', avg: 'O(log n)', worst: 'O(n)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'start at the root',
    'if this node is the target: found it',
    'if the target is smaller: go left',
    'otherwise: go right',
    'if you run off the bottom, it is not in the tree',
  ],
  *run({ values, target }) {
    const t = buildTree(values);
    let cur = t.root;
    const path = [];
    let steps = 0;

    yield tf(t, clear(t), { line: 0, note: `looking for ${target}`, stats: { steps: 0, 'nodes skipped': 0 } });

    while (cur !== null) {
      steps++;
      path.push(cur);
      const st = clear(t);
      for (const p of path) st[p] = T.PATH;
      st[cur] = T.COMPARE;

      if (t.nodes[cur].key === target) {
        st[cur] = T.FOUND;
        yield tf(t, st, { line: 1, note: `found ${target} after ${steps} comparison${steps === 1 ? '' : 's'}`, stats: { steps, 'nodes skipped': t.nodes.length - steps } });
        return;
      }
      const smaller = target < t.nodes[cur].key;
      yield tf(t, st, {
        line: smaller ? 2 : 3,
        note: `${target} ${smaller ? '<' : '>'} ${t.nodes[cur].key} — go ${smaller ? 'left' : 'right'}, skipping the other subtree`,
        stats: { steps, 'nodes skipped': t.nodes.length - steps },
      });
      cur = t.nodes[cur].children[smaller ? L : R];
    }

    const st = clear(t);
    for (const p of path) st[p] = T.PATH;
    yield tf(t, st, { line: 4, note: `ran off the bottom — ${target} is not in the tree`, stats: { steps, 'nodes skipped': t.nodes.length - steps } });
  },
};

/* ───────────────────────── Delete ──────────────────────── */

const remove = {
  ...base,
  id: 'bst-delete',
  name: 'BST Delete',
  about: 'The fiddly one. Removing a leaf is trivial and removing a node with one child just promotes that child — but a node with two children cannot simply vanish. The fix: overwrite it with its in-order successor (the smallest value in its right subtree), the one node guaranteed to keep every ordering promise intact.',
  cost: { best: 'O(log n)', avg: 'O(log n)', worst: 'O(n)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'find the node to delete',
    'no children → just unhook it',
    'one child → promote that child into its place',
    'two children → find the smallest value on the right',
    '  copy it up, then delete that successor instead',
  ],
  *run({ values, target }) {
    const t = buildTree(values);
    let parent = null, cur = t.root, side = L;

    yield tf(t, clear(t), { line: 0, note: `deleting ${target}`, stats: { nodes: t.nodes.length } });

    while (cur !== null && t.nodes[cur].key !== target) {
      const st = clear(t); st[cur] = T.COMPARE;
      yield tf(t, st, { line: 0, note: `${target} vs ${t.nodes[cur].key}`, stats: { nodes: t.nodes.length } });
      parent = cur;
      side = target < t.nodes[cur].key ? L : R;
      cur = t.nodes[cur].children[side];
    }

    if (cur === null) {
      yield tf(t, clear(t), { note: `${target} is not in the tree — nothing to delete`, stats: { nodes: t.nodes.length } });
      return;
    }

    const st0 = clear(t); st0[cur] = T.REMOVED;
    const kids = t.nodes[cur].children.filter((c) => c !== null).length;
    yield tf(t, st0, { line: 0, note: `found ${target} — it has ${kids} child${kids === 1 ? '' : 'ren'}`, stats: { nodes: t.nodes.length } });

    const attach = (node) => {
      if (parent === null) t.root = node;
      else t.nodes[parent].children[side] = node;
    };

    if (kids === 0) {
      attach(null);
      yield tf(t, clear(t), { line: 1, note: 'a leaf — just unhook it', stats: { nodes: t.nodes.length - 1 } });
    } else if (kids === 1) {
      const only = t.nodes[cur].children[L] ?? t.nodes[cur].children[R];
      attach(only);
      const st = clear(t); st[only] = T.INSERTED;
      yield tf(t, st, { line: 2, note: `one child — ${t.nodes[only].key} is promoted into its place`, stats: { nodes: t.nodes.length - 1 } });
    } else {
      // two children: find the in-order successor
      let sParent = cur, s = t.nodes[cur].children[R];
      while (t.nodes[s].children[L] !== null) {
        const st = clear(t); st[cur] = T.REMOVED; st[s] = T.COMPARE;
        yield tf(t, st, { line: 3, note: 'walking left for the smallest value on the right', stats: { nodes: t.nodes.length } });
        sParent = s;
        s = t.nodes[s].children[L];
      }

      const st1 = clear(t); st1[cur] = T.REMOVED; st1[s] = T.FOUND;
      yield tf(t, st1, { line: 3, note: `${t.nodes[s].key} is the successor — the next value in sorted order`, stats: { nodes: t.nodes.length } });

      t.nodes[cur].key = t.nodes[s].key;
      t.nodes[cur].label = t.nodes[s].label;
      const st2 = clear(t); st2[cur] = T.INSERTED;
      yield tf(t, st2, { line: 4, note: `copied ${t.nodes[cur].key} up — now remove the old copy below`, stats: { nodes: t.nodes.length } });

      // unhook the successor (it can only have a right child)
      const sSide = sParent === cur ? R : L;
      t.nodes[sParent].children[sSide] = t.nodes[s].children[R];
    }

    const done = new Array(t.nodes.length).fill(T.DONE);
    yield tf(t, done, { note: `${target} removed — every ordering rule still holds`, stats: { nodes: t.nodes.length - 1 } });
  },
};

/* ────────────────────── Traversals ─────────────────────── */

function traversal(id, name, order, about, pseudo, lineMap) {
  return {
    ...base,
    id, name, about,
    cost: { best: 'O(n)', avg: 'O(n)', worst: 'O(n)', space: 'O(h)', stable: '—' },
    pseudocode: pseudo,
    *run({ values }) {
      const t = buildTree(values);
      const visited = [];
      const states = clear(t);

      yield tf(t, states, { note: `visiting all ${t.nodes.length} nodes in ${name.toLowerCase().replace(' traversal', '')} order`, stats: { visited: 0 } });

      function* walk(i, depth) {
        if (i === null) return;
        for (const step of order) {
          if (step === 'self') {
            states[i] = T.DONE;
            visited.push(t.nodes[i].key);
            yield tf(t, states, {
              line: lineMap.self,
              note: `visit ${t.nodes[i].key} → [${visited.join(', ')}]`,
              stats: { visited: visited.length, depth },
            });
          } else {
            const child = t.nodes[i].children[step === 'left' ? L : R];
            if (child !== null) {
              const st = states.slice(); st[child] = T.VISITING;
              yield tf(t, st, { line: lineMap[step], note: `descend ${step} from ${t.nodes[i].key}`, stats: { visited: visited.length, depth } });
              yield* walk(child, depth + 1);
            }
          }
        }
      }

      yield* walk(t.root, 0);
      yield tf(t, new Array(t.nodes.length).fill(T.DONE), {
        note: `${name.replace(' Traversal', '')}: ${visited.join(', ')}`,
        stats: { visited: visited.length },
      });
    },
  };
}

const inorder = traversal(
  'tree-inorder', 'In-order Traversal', ['left', 'self', 'right'],
  'Left subtree, then the node, then the right subtree. On a binary search tree this emits the values in perfect sorted order — which is both the neatest proof that the tree is correctly built and a genuinely useful way to read one out.',
  ['visit(node):', '  go all the way left first', '  then handle this node', '  then go right'],
  { left: 1, self: 2, right: 3 },
);

const preorder = traversal(
  'tree-preorder', 'Pre-order Traversal', ['self', 'left', 'right'],
  'Node first, then its subtrees. Because the parent is always emitted before its children, the output is enough to rebuild the exact same tree later — which is why this is the order used for serialising trees and for copying them.',
  ['visit(node):', '  handle this node first', '  then go left', '  then go right'],
  { self: 1, left: 2, right: 3 },
);

const postorder = traversal(
  'tree-postorder', 'Post-order Traversal', ['left', 'right', 'self'],
  'Both subtrees before the node itself. Since children are always finished before their parent, this is the order you use to free a tree, compute directory sizes, or evaluate an expression tree bottom-up.',
  ['visit(node):', '  go left', '  then go right', '  handle this node last'],
  { left: 1, right: 2, self: 3 },
);

const levelorder = {
  ...base,
  id: 'tree-levelorder',
  name: 'Level-order Traversal',
  about: 'Breadth-first on a tree: every node at depth 0, then every node at depth 1, and so on, driven by a queue rather than recursion. This is the order that prints a tree the way you would draw it, row by row.',
  cost: { best: 'O(n)', avg: 'O(n)', worst: 'O(n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'queue = [root]',
    'while the queue is not empty:',
    '  take the front node, visit it',
    '  add its left child, then its right child, to the back',
  ],
  *run({ values }) {
    const t = buildTree(values);
    const states = clear(t);
    if (t.root === null) { yield tf(t, states, { note: 'empty tree' }); return; }

    const queue = [[t.root, 0]];
    const visited = [];
    let level = -1;

    while (queue.length) {
      const [i, depth] = queue.shift();
      if (depth !== level) { level = depth; }
      states[i] = T.DONE;
      visited.push(t.nodes[i].key);
      yield tf(t, states, {
        line: 2,
        note: `level ${depth}: visit ${t.nodes[i].key} → [${visited.join(', ')}]`,
        stats: { visited: visited.length, 'queue size': queue.length, level: depth },
      });

      for (const side of [L, R]) {
        const c = t.nodes[i].children[side];
        if (c !== null) {
          queue.push([c, depth + 1]);
          states[c] = T.VISITING;
        }
      }
      if (queue.length) {
        yield tf(t, states, { line: 3, note: `queued its children`, stats: { visited: visited.length, 'queue size': queue.length, level: depth } });
      }
    }

    yield tf(t, new Array(t.nodes.length).fill(T.DONE), { note: `level order: ${visited.join(', ')}`, stats: { visited: visited.length, 'queue size': 0 } });
  },
};

/* ───────────────────── AVL (self-balancing) ────────────── */

const avl = {
  ...base,
  id: 'avl-insert',
  name: 'AVL Tree Insert',
  about: 'A BST that refuses to get lopsided. After every insert it walks back up checking each node\'s balance factor — the height difference between its two sides — and rotates whenever that gap reaches 2. Feed it sorted input and watch it rotate repeatedly to stay short, where a plain BST would collapse into a list.',
  cost: { best: 'O(log n)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'insert like a normal BST',
    'walk back up, recomputing each height',
    'balance factor = height(left) - height(right)',
    'if it reaches +2 or -2, rotate to fix it',
    'four cases: LL, RR, LR, RL',
  ],
  *run({ values }) {
    const t = empty();
    let rotations = 0;

    const h = (i) => (i === null ? 0 : t.nodes[i].h);
    const refresh = (i) => { t.nodes[i].h = 1 + Math.max(h(t.nodes[i].children[L]), h(t.nodes[i].children[R])); };
    const balance = (i) => (i === null ? 0 : h(t.nodes[i].children[L]) - h(t.nodes[i].children[R]));
    const setTags = () => {
      for (let i = 0; i < t.nodes.length; i++) {
        const b = balance(i);
        t.nodes[i].tag = b === 0 ? '' : (b > 0 ? `+${b}` : String(b));
      }
    };

    function rotateRight(y) {
      const x = t.nodes[y].children[L];
      t.nodes[y].children[L] = t.nodes[x].children[R];
      t.nodes[x].children[R] = y;
      refresh(y); refresh(x);
      return x;
    }
    function rotateLeft(x) {
      const y = t.nodes[x].children[R];
      t.nodes[x].children[R] = t.nodes[y].children[L];
      t.nodes[y].children[L] = x;
      refresh(x); refresh(y);
      return y;
    }

    // Recursive insert that rebalances on the way back up.
    function* ins(node, key) {
      if (node === null) {
        const fresh = addNode(t, key, { h: 1, tag: '' });
        const st = clear(t); st[fresh] = T.INSERTED;
        yield tf(t, st, { line: 0, note: `${key} lands here`, stats: { nodes: t.nodes.length, rotations, height: 0 } });
        return fresh;
      }

      const st = clear(t); st[node] = T.COMPARE;
      yield tf(t, st, { line: 0, note: `${key} vs ${t.nodes[node].key}`, stats: { nodes: t.nodes.length, rotations, height: h(t.root) } });

      const side = key < t.nodes[node].key ? L : R;
      t.nodes[node].children[side] = yield* ins(t.nodes[node].children[side], key);

      refresh(node);
      setTags();
      const b = balance(node);

      const st2 = clear(t); st2[node] = T.VISITING;
      yield tf(t, st2, { line: 2, note: `${t.nodes[node].key} has balance factor ${b > 0 ? '+' : ''}${b}${Math.abs(b) > 1 ? ' — too lopsided' : ''}`, stats: { nodes: t.nodes.length, rotations, height: h(t.root) } });

      if (b > 1 || b < -1) {
        const leftHeavy = b > 1;
        const childSide = leftHeavy ? L : R;
        const child = t.nodes[node].children[childSide];
        const childBalance = balance(child);
        let kind;

        // The four classic cases. A "zig-zag" needs two rotations.
        if (leftHeavy && childBalance >= 0) kind = 'LL';
        else if (leftHeavy) kind = 'LR';
        else if (childBalance <= 0) kind = 'RR';
        else kind = 'RL';

        if (kind === 'LR') {
          t.nodes[node].children[L] = rotateLeft(t.nodes[node].children[L]);
          rotations++;
          setTags();
          const st3 = clear(t); st3[node] = T.REMOVED;
          yield tf(t, st3, { line: 4, note: 'left-right case — first rotate the child left', stats: { nodes: t.nodes.length, rotations, height: h(t.root) } });
        }
        if (kind === 'RL') {
          t.nodes[node].children[R] = rotateRight(t.nodes[node].children[R]);
          rotations++;
          setTags();
          const st3 = clear(t); st3[node] = T.REMOVED;
          yield tf(t, st3, { line: 4, note: 'right-left case — first rotate the child right', stats: { nodes: t.nodes.length, rotations, height: h(t.root) } });
        }

        const newRoot = leftHeavy ? rotateRight(node) : rotateLeft(node);
        rotations++;
        setTags();
        const st4 = clear(t); st4[newRoot] = T.INSERTED;
        yield tf(t, st4, { line: 3, note: `${kind} — rotated ${leftHeavy ? 'right' : 'left'}, ${t.nodes[newRoot].key} is the new local root`, stats: { nodes: t.nodes.length, rotations, height: h(t.root) } });
        return newRoot;
      }
      return node;
    }

    for (const v of values) {
      yield tf(t, clear(t), { line: 0, note: `inserting ${v}`, stats: { nodes: t.nodes.length, rotations, height: h(t.root) } });
      t.root = yield* ins(t.root, v);
      setTags();
    }

    setTags();
    const done = new Array(t.nodes.length).fill(T.DONE);
    yield tf(t, done, {
      note: `${t.nodes.length} nodes, height ${h(t.root)} after ${rotations} rotation${rotations === 1 ? '' : 's'} — a plain BST on this input would be ${heightOf(buildTree(values), buildTree(values).root)} tall`,
      stats: { nodes: t.nodes.length, rotations, height: h(t.root) },
    });
  },
};

/* ──────────────────────── Binary Heap ──────────────────── */

const heap = {
  ...base,
  id: 'heap-ops',
  name: 'Binary Heap',
  about: 'A tree with a much weaker promise than a BST: a parent only has to beat its children, with no left/right rule at all. That weakness is the point — it is cheap to maintain, so the smallest item is always at the root and insert and extract both cost O(log n). This is the engine inside Dijkstra and A*.',
  cost: { best: 'O(1)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'the heap lives in a flat array; children of i are 2i+1 and 2i+2',
    'insert: put it at the end, then sift UP while it beats its parent',
    'extract-min: take the root, move the last item to the top',
    '  then sift DOWN while a child beats it',
  ],
  *run({ values }) {
    const heapArr = [];
    let comparisons = 0, swaps = 0;

    // Rebuild the view's tree from the flat array each frame.
    const asTree = () => {
      const t = { nodes: [], root: heapArr.length ? 0 : null };
      for (let i = 0; i < heapArr.length; i++) {
        t.nodes.push({
          label: heapArr[i],
          children: [
            2 * i + 1 < heapArr.length ? 2 * i + 1 : null,
            2 * i + 2 < heapArr.length ? 2 * i + 2 : null,
          ],
          tag: String(i),
        });
      }
      return t;
    };
    const frame = (states, extra) => tf(asTree(), states, extra);
    const blank = () => new Array(heapArr.length).fill(T.IDLE);

    /* ── build the heap by inserting ── */
    for (const v of values) {
      heapArr.push(v);
      let i = heapArr.length - 1;
      let st = blank(); st[i] = T.INSERTED;
      yield frame(st, { line: 1, note: `added ${v} at the end (index ${i})`, stats: { size: heapArr.length, comparisons, swaps } });

      while (i > 0) {
        const parent = (i - 1) >> 1;
        comparisons++;
        st = blank(); st[i] = T.COMPARE; st[parent] = T.COMPARE;
        yield frame(st, { line: 1, note: `is ${heapArr[i]} smaller than its parent ${heapArr[parent]}?`, stats: { size: heapArr.length, comparisons, swaps } });
        if (heapArr[parent] <= heapArr[i]) break;

        [heapArr[parent], heapArr[i]] = [heapArr[i], heapArr[parent]];
        swaps++;
        st = blank(); st[parent] = T.INSERTED;
        yield frame(st, { line: 1, note: 'yes — swap it up', stats: { size: heapArr.length, comparisons, swaps } });
        i = parent;
      }
    }

    yield frame(new Array(heapArr.length).fill(T.DONE), { note: `heap built — ${heapArr[0]} is the smallest, sitting at the root`, stats: { size: heapArr.length, comparisons, swaps } });

    /* ── now drain it, smallest first ── */
    const out = [];
    while (heapArr.length) {
      out.push(heapArr[0]);
      let st = blank(); st[0] = T.REMOVED;
      yield frame(st, { line: 2, note: `take ${heapArr[0]} off the top → [${out.join(', ')}]`, stats: { size: heapArr.length, comparisons, swaps } });

      const last = heapArr.pop();
      if (!heapArr.length) break;
      heapArr[0] = last;

      st = blank(); st[0] = T.VISITING;
      yield frame(st, { line: 2, note: `moved ${last} from the end up to the root`, stats: { size: heapArr.length, comparisons, swaps } });

      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let small = i;
        if (l < heapArr.length) { comparisons++; if (heapArr[l] < heapArr[small]) small = l; }
        if (r < heapArr.length) { comparisons++; if (heapArr[r] < heapArr[small]) small = r; }

        st = blank(); st[i] = T.COMPARE;
        if (l < heapArr.length) st[l] = T.COMPARE;
        if (r < heapArr.length) st[r] = T.COMPARE;
        yield frame(st, { line: 3, note: small === i ? 'both children are bigger — it belongs here' : `child ${heapArr[small]} is smaller — sift down`, stats: { size: heapArr.length, comparisons, swaps } });

        if (small === i) break;
        [heapArr[small], heapArr[i]] = [heapArr[i], heapArr[small]];
        swaps++;
        i = small;
      }
    }

    yield { nodes: [], root: null, states: [], emptyText: `drained in sorted order: ${out.join(', ')}`, note: `emptied — came out sorted: ${out.join(', ')}`, stats: { size: 0, comparisons, swaps } };
  },
};

export const TREES = [insert, search, remove, inorder, preorder, postorder, levelorder, avl, ...REDBLACK, heap, ...SEGMENT, ...TRIES, ...HUFFMAN];
