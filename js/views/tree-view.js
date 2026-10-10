/* ============================================================
   Tree view
   ------------------------------------------------------------
   Draws any rooted tree: binary search trees, AVL trees, heaps
   and tries all share this renderer.

   A frame:
   {
     nodes: [{ label, children: [idx|null, ...], tag }],
     root:  index of the root (or null for an empty tree)
     states: Uint8Array,   one state per node
     note, stats
   }

   For a BINARY tree, `children` is always [left, right] with nulls
   kept in place — that is what makes a lone left child still hang
   to the left instead of sliding under its parent.
   ============================================================ */

import { fitCanvas, colors, circle, strokeCircle, label, line, fillRound } from './draw.js';

export const T = {
  IDLE: 0, VISITING: 1, COMPARE: 2, FOUND: 3, DONE: 4,
  INSERTED: 5, REMOVED: 6, PATH: 7,
};

const PAD_X = 30;
const PAD_TOP = 34;
const PAD_BOTTOM = 26;

/**
 * Give every node an (x, depth). Children are placed first, then the
 * parent is centred over them — the classic tidy-tree trick.
 */
function layoutTree(nodes, root) {
  const pos = new Map();
  let cursor = 0;
  let maxDepth = 0;

  function walk(i, depth) {
    if (i === null || i === undefined) {
      cursor += 0.62;          // empty slot: keeps left/right honest
      return;
    }
    maxDepth = Math.max(maxDepth, depth);
    const kids = nodes[i].children || [];
    const real = kids.filter((k) => k !== null && k !== undefined);

    if (!real.length) {
      pos.set(i, { x: cursor++, depth });
      return;
    }
    const xs = [];
    for (const k of kids) {
      walk(k, depth + 1);
      if (k !== null && k !== undefined) xs.push(pos.get(k).x);
    }

    if (real.length === 1) {
      // Offset the parent so a lone child visibly hangs left or right.
      const onLeft = kids.indexOf(real[0]) === 0;
      pos.set(i, { x: xs[0] + (onLeft ? 0.5 : -0.5), depth });
    } else {
      pos.set(i, { x: (Math.min(...xs) + Math.max(...xs)) / 2, depth });
    }
  }

  walk(root, 0);
  return { pos, maxDepth, width: Math.max(1, cursor) };
}

export function drawTree(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { nodes, root, states } = frame;

  if (root === null || root === undefined || !nodes?.length) {
    label(ctx, frame.emptyText || 'the tree is empty', w / 2, h / 2, { size: 13, color: C.faint, mono: false });
    return;
  }

  const { pos, maxDepth, width } = layoutTree(nodes, root);

  const usableW = w - PAD_X * 2;
  const usableH = h - PAD_TOP - PAD_BOTTOM;
  const stepX = usableW / Math.max(1, width);
  const stepY = maxDepth > 0 ? usableH / maxDepth : 0;

  const R = Math.max(9, Math.min(20, stepX * 0.42, stepY * 0.36 || 20));

  const X = (i) => PAD_X + (pos.get(i).x + 0.5) * stepX;
  const Y = (i) => PAD_TOP + pos.get(i).depth * stepY;

  const fillFor = {
    [T.IDLE]:     C.sunken,
    [T.VISITING]: C.cursor,
    [T.COMPARE]:  C.compare,
    [T.FOUND]:    C.found,
    [T.DONE]:     C.sorted,
    [T.INSERTED]: C.pivot,
    [T.REMOVED]:  C.swap,
    [T.PATH]:     C.visited,
  };

  /* ── edges ── */
  for (const [i] of pos) {
    for (const k of nodes[i].children || []) {
      if (k === null || k === undefined || !pos.has(k)) continue;
      const st = states ? states[k] : T.IDLE;
      const hot = st !== T.IDLE && st !== T.DONE;
      line(ctx, X(i), Y(i), X(k), Y(k), hot ? fillFor[st] : C.border, hot ? 2 : 1.3);
    }
  }

  /* ── nodes ── */
  for (const [i] of pos) {
    const st = states ? states[i] : T.IDLE;
    const x = X(i), y = Y(i);

    circle(ctx, x, y, R, fillFor[st] ?? C.sunken);
    strokeCircle(ctx, x, y, R, st === T.IDLE ? C.border : 'transparent', 1.5);

    label(ctx, String(nodes[i].label), x, y, {
      size: Math.min(13, R * 0.85),
      weight: 700,
      color: st === T.IDLE ? C.dim : '#0d1117',
    });

    // a small badge: AVL balance factor, trie end-of-word, heap index…
    if (nodes[i].tag !== undefined && nodes[i].tag !== null && nodes[i].tag !== '') {
      const txt = String(nodes[i].tag);
      ctx.font = '700 9px ui-monospace, Menlo, monospace';
      const tw = ctx.measureText(txt).width;
      fillRound(ctx, x + R - 2, y - R - 6, tw + 7, 13, 4, C.panel);
      label(ctx, txt, x + R + 1.5 + tw / 2, y - R + 0.5, { size: 9, weight: 700, color: C.dim });
    }
  }
}

export const TREE_LEGEND = [
  ['--c-compare', 'comparing'],
  ['--c-cursor',  'walking through'],
  ['--c-pivot',   'just added'],
  ['--c-found',   'found'],
  ['--c-sorted',  'done'],
];
