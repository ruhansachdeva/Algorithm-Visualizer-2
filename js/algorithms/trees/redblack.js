/* ============================================================
   RED-BLACK TREE
   ------------------------------------------------------------
   The self-balancing tree that most standard libraries actually
   use — C++'s std::map, Java's TreeMap, and the Linux kernel's
   scheduler are all red-black trees.

   It keeps five rules:
     1. every node is red or black
     2. the root is black
     3. a red node's children are both black  (no two reds in a row)
     4. every path from a node down to a missing child passes
        through the same number of black nodes
     5. missing children count as black

   Rule 4 is the one doing the work. It means the longest path can
   be at most twice the shortest — alternating red/black versus all
   black — so the tree can never get more than 2·log(n) tall.

   AVL trees are more rigidly balanced and so slightly faster to
   search; red-black trees rebalance with fewer rotations and so
   are faster to modify. That trade is why both exist.
   ============================================================ */

import { T } from '../../views/tree-view.js';

const RED = '#e5484d';
const BLACK = '#30363d';

/* The tree is stored in a flat array; -1 stands for "no node". */
const NIL = -1;

function newTree() {
  return { nodes: [], root: NIL };
}

function addNode(t, key) {
  t.nodes.push({ key, label: key, red: true, left: NIL, right: NIL, parent: NIL });
  return t.nodes.length - 1;
}

/** The view wants `children` arrays; it also gets a colour per node. */
function frameOf(t, states, extra = {}) {
  return {
    nodes: t.nodes.map((n) => ({
      label: n.label,
      children: [n.left === NIL ? null : n.left, n.right === NIL ? null : n.right],
    })),
    root: t.root === NIL ? null : t.root,
    states: states.slice(),
    paint: t.nodes.map((n) => (n.red ? RED : BLACK)),
    binary: true,
    emptyText: 'the tree is empty',
    ...extra,
  };
}

const clear = (t) => new Array(t.nodes.length).fill(T.IDLE);
const isRed = (t, i) => i !== NIL && t.nodes[i].red;

/* ───────────────────────── rotations ───────────────────── */
/* A rotation changes the shape but never the left-to-right order,
   which is why it is safe to use for rebalancing.                */

function rotateLeft(t, x) {
  const y = t.nodes[x].right;
  t.nodes[x].right = t.nodes[y].left;
  if (t.nodes[y].left !== NIL) t.nodes[t.nodes[y].left].parent = x;

  t.nodes[y].parent = t.nodes[x].parent;
  if (t.nodes[x].parent === NIL) t.root = y;
  else if (x === t.nodes[t.nodes[x].parent].left) t.nodes[t.nodes[x].parent].left = y;
  else t.nodes[t.nodes[x].parent].right = y;

  t.nodes[y].left = x;
  t.nodes[x].parent = y;
}

function rotateRight(t, x) {
  const y = t.nodes[x].left;
  t.nodes[x].left = t.nodes[y].right;
  if (t.nodes[y].right !== NIL) t.nodes[t.nodes[y].right].parent = x;

  t.nodes[y].parent = t.nodes[x].parent;
  if (t.nodes[x].parent === NIL) t.root = y;
  else if (x === t.nodes[t.nodes[x].parent].right) t.nodes[t.nodes[x].parent].right = y;
  else t.nodes[t.nodes[x].parent].left = y;

  t.nodes[y].right = x;
  t.nodes[x].parent = y;
}

/* ───────────────────────── insert ──────────────────────── */

const rbInsert = {
  view: 'tree',
  input: 'tree',
  id: 'rb-insert',
  name: 'Red-Black Insert',
  legend: [
    [RED, 'red node'],
    [BLACK, 'black node'],
    ['--c-compare', 'being examined'],
    ['--c-pivot', 'just inserted'],
    ['--c-sorted', 'rule restored'],
  ],
  about: 'The self-balancing tree inside std::map, Java\'s TreeMap and the Linux scheduler. A new node always arrives red, because red adds no black-height and so breaks only the easy rule — "no two reds in a row". Fixing that needs at most two rotations, where an AVL tree may need to rebalance all the way to the root. AVL stays shorter and searches faster; red-black rebalances cheaper and so writes faster.',
  cost: { best: 'O(log n)', avg: 'O(log n)', worst: 'O(log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'insert like a normal BST and colour the new node RED',
    'while the parent is also red (two reds in a row):',
    '  if the uncle is RED  → recolour parent, uncle and grandparent',
    '  if the uncle is BLACK → rotate, then recolour',
    'finally, paint the root black',
  ],
  *run({ values }) {
    const t = newTree();
    let rotations = 0, recolours = 0, comparisons = 0;

    const blackHeight = () => {
      let h = 0;
      for (let i = t.root; i !== NIL; i = t.nodes[i].left) if (!t.nodes[i].red) h++;
      return h;
    };
    const stats = () => ({ nodes: t.nodes.length, rotations, recolours, 'black height': blackHeight() });
    const f = (states, extra) => frameOf(t, states, { stats: stats(), ...extra });

    for (const key of values) {
      /* ── ordinary BST descent ── */
      let parent = NIL, cur = t.root;
      const path = [];

      yield f(clear(t), { line: 0, note: `inserting ${key}` });

      while (cur !== NIL) {
        parent = cur;
        path.push(cur);
        comparisons++;
        const st = clear(t);
        for (const p of path) st[p] = T.PATH;
        st[cur] = T.COMPARE;
        const goLeft = key < t.nodes[cur].key;
        yield f(st, { line: 0, note: `${key} vs ${t.nodes[cur].key} → go ${goLeft ? 'left' : 'right'}` });
        cur = goLeft ? t.nodes[cur].left : t.nodes[cur].right;
      }

      const z = addNode(t, key);
      t.nodes[z].parent = parent;
      if (parent === NIL) t.root = z;
      else if (key < t.nodes[parent].key) t.nodes[parent].left = z;
      else t.nodes[parent].right = z;

      {
        const st = clear(t);
        st[z] = T.INSERTED;
        yield f(st, { line: 0, note: `${key} goes in RED — red adds no black-height, so it can only break the easy rule` });
      }

      /* ── restore the rules ── */
      let n = z;
      while (n !== t.root && isRed(t, t.nodes[n].parent)) {
        const p = t.nodes[n].parent;
        const g = t.nodes[p].parent;
        if (g === NIL) break;

        const parentIsLeft = p === t.nodes[g].left;
        const uncle = parentIsLeft ? t.nodes[g].right : t.nodes[g].left;

        {
          const st = clear(t);
          st[n] = T.COMPARE; st[p] = T.COMPARE; st[g] = T.VISITING;
          if (uncle !== NIL) st[uncle] = T.VISITING;
          yield f(st, { line: 1, note: `${t.nodes[n].key} and its parent ${t.nodes[p].key} are both red — uncle is ${isRed(t, uncle) ? 'RED' : 'BLACK'}` });
        }

        if (isRed(t, uncle)) {
          // Case 1: just repaint. The problem moves up two levels.
          t.nodes[p].red = false;
          t.nodes[uncle].red = false;
          t.nodes[g].red = true;
          recolours++;
          const st = clear(t);
          st[p] = T.DONE; st[uncle] = T.DONE; st[g] = T.COMPARE;
          yield f(st, { line: 2, note: 'red uncle — repaint parent and uncle black, grandparent red, then carry the problem upward' });
          n = g;
        } else {
          // Case 2: the new node is on the "inside" — rotate it outward first.
          if (parentIsLeft && n === t.nodes[p].right) {
            n = p;
            rotateLeft(t, n);
            rotations++;
            const st = clear(t);
            st[n] = T.VISITING;
            yield f(st, { line: 3, note: 'black uncle, inner child — rotate left first to straighten the zig-zag' });
          } else if (!parentIsLeft && n === t.nodes[p].left) {
            n = p;
            rotateRight(t, n);
            rotations++;
            const st = clear(t);
            st[n] = T.VISITING;
            yield f(st, { line: 3, note: 'black uncle, inner child — rotate right first to straighten the zig-zag' });
          }

          // Case 3: recolour and rotate the grandparent the other way.
          const p2 = t.nodes[n].parent;
          const g2 = t.nodes[p2].parent;
          if (g2 === NIL) break;

          t.nodes[p2].red = false;
          t.nodes[g2].red = true;
          recolours++;
          if (parentIsLeft) rotateRight(t, g2); else rotateLeft(t, g2);
          rotations++;

          const st = clear(t);
          st[p2] = T.DONE;
          yield f(st, { line: 3, note: `rotate ${parentIsLeft ? 'right' : 'left'} around ${t.nodes[g2].key} and swap the two colours — ${t.nodes[p2].key} takes over, both rules hold again` });
        }
      }

      if (t.nodes[t.root].red) {
        t.nodes[t.root].red = false;
        recolours++;
        const st = clear(t);
        st[t.root] = T.DONE;
        yield f(st, { line: 4, note: 'the root must always be black — painting it black raises every path\'s black count equally, so rule 4 still holds' });
      }
    }

    const height = (function h(i) {
      if (i === NIL) return 0;
      return 1 + Math.max(h(t.nodes[i].left), h(t.nodes[i].right));
    })(t.root);

    // No highlight ring on the closing frame — in this tree the node's own
    // colour is the information, and ringing everything competes with it.
    yield f(clear(t), {
      note: `${t.nodes.length} nodes, height ${height}, black height ${blackHeight()} — ${rotations} rotation${rotations === 1 ? '' : 's'} and ${recolours} recolour${recolours === 1 ? '' : 's'} in total`,
    });
  },
};

export const REDBLACK = [rbInsert];
