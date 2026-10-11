/* ============================================================
   HUFFMAN CODING
   ------------------------------------------------------------
   The greedy algorithm behind ZIP, JPEG and MP3. Fixed-width
   encoding spends 8 bits on every character whether it is a
   space or a 'q'. Huffman spends FEWER bits on common characters
   and more on rare ones, and comes out ahead overall.

   The build is almost suspiciously simple: take the two rarest
   items, join them under a new parent, put the parent back, and
   repeat. The rarest characters end up deepest, which is exactly
   the same as saying they get the longest codes.

   The result is a prefix code — no character's code is the start
   of another's — which is what makes the output decodable with
   no separators between symbols.
   ============================================================ */

import { T } from '../../views/tree-view.js';

const LEAF = '#4da3ff';
const INNER = '#3d4a5c';

/** Build a frame for the view out of the current forest of trees. */
function forestFrame(nodes, roots, states, extra = {}) {
  return {
    // A virtual root holds the not-yet-merged trees side by side, so you can
    // watch the forest shrink from many trees into one.
    nodes: [
      { label: '', children: roots.slice() },
      ...nodes.map((n) => ({
        label: n.ch === null ? String(n.freq) : `${n.ch === ' ' ? '␣' : n.ch}`,
        tag: n.ch === null ? '' : String(n.freq),
        children: [n.left === null ? null : n.left + 1, n.right === null ? null : n.right + 1],
      })),
    ],
    root: 0,
    states: [T.IDLE, ...states],
    paint: ['rgba(0,0,0,0)', ...nodes.map((n) => (n.ch === null ? INNER : LEAF))],
    binary: true,
    hideRoot: true,
    ...extra,
  };
}

const huffman = {
  view: 'tree',
  input: 'huffman',
  id: 'huffman',
  name: 'Huffman Coding',
  legend: [
    [LEAF, 'character'],
    [INNER, 'merged node (sum of its children)'],
    ['--c-compare', 'the two rarest, about to merge'],
    ['--c-pivot', 'just merged'],
  ],
  about: 'The greedy algorithm inside ZIP, JPEG and MP3. Fixed-width encoding spends 8 bits on every character whether it is a space or a q; Huffman gives common characters short codes and rare ones long codes. It builds the tree by repeatedly joining the two rarest items under a new parent — so the rarest characters sink deepest, which is the same thing as giving them the longest codes.',
  cost: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'count how often each character appears',
    'make a one-node tree for each character',
    'while more than one tree remains:',
    '  take the two with the smallest counts',
    '  join them under a new parent whose count is their sum',
    'left branch = 0, right branch = 1; the path to a leaf is its code',
  ],
  *run({ text }) {
    const nodes = [];     // { ch, freq, left, right }
    const add = (ch, freq, left = null, right = null) => {
      nodes.push({ ch, freq, left, right });
      return nodes.length - 1;
    };
    const blank = () => new Array(nodes.length).fill(T.IDLE);

    /* ── count characters ── */
    const counts = new Map();
    for (const ch of text) counts.set(ch, (counts.get(ch) || 0) + 1);

    if (counts.size === 0) {
      yield { nodes: [], root: null, states: [], emptyText: 'type something to encode', note: 'nothing to encode' };
      return;
    }

    // ties broken by character so the tree is reproducible run to run
    const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
    let roots = sorted.map(([ch, freq]) => add(ch, freq) + 1);

    let merges = 0;
    const stats = () => ({
      'distinct characters': counts.size,
      'trees remaining': roots.length,
      merges,
    });

    yield forestFrame(nodes, roots, blank(), {
      line: 1,
      note: `${counts.size} distinct characters, each starting as its own tree: ${sorted.map(([c, f]) => `${c === ' ' ? '␣' : c}×${f}`).join('  ')}`,
      stats: stats(),
    });

    /* ── repeatedly merge the two rarest ── */
    while (roots.length > 1) {
      // pick the two smallest; ties go to the earlier one for stability
      const freqOf = (r) => nodes[r - 1].freq;
      let i1 = 0;
      for (let k = 1; k < roots.length; k++) if (freqOf(roots[k]) < freqOf(roots[i1])) i1 = k;
      let i2 = i1 === 0 ? 1 : 0;
      for (let k = 0; k < roots.length; k++) {
        if (k === i1) continue;
        if (freqOf(roots[k]) < freqOf(roots[i2])) i2 = k;
      }

      const a = roots[i1], b = roots[i2];
      const st = blank();
      st[a - 1] = T.COMPARE;
      st[b - 1] = T.COMPARE;
      yield forestFrame(nodes, roots, st, {
        line: 3,
        note: `the two rarest are ${freqOf(a)} and ${freqOf(b)} — join them`,
        stats: stats(),
      });

      // smaller count on the left, purely so the drawing is tidy
      const [lo, hi] = freqOf(a) <= freqOf(b) ? [a, b] : [b, a];
      const parent = add(null, freqOf(lo) + freqOf(hi), lo - 1, hi - 1) + 1;
      merges++;

      roots = roots.filter((r) => r !== a && r !== b);
      roots.push(parent);

      const st2 = blank();
      st2[parent - 1] = T.INSERTED;
      yield forestFrame(nodes, roots, st2, {
        line: 4,
        note: `new node of ${nodes[parent - 1].freq} — ${roots.length} tree${roots.length === 1 ? '' : 's'} left`,
        stats: stats(),
      });
    }

    /* ── read the codes off the finished tree ── */
    const codes = new Map();
    (function assign(i, code) {
      const n = nodes[i];
      if (n.ch !== null) {
        // A lone character still needs one bit.
        codes.set(n.ch, code || '0');
        return;
      }
      assign(n.left, code + '0');
      assign(n.right, code + '1');
    })(roots[0] - 1, '');

    const fixedBits = text.length * 8;
    const huffBits = [...text].reduce((sum, ch) => sum + codes.get(ch).length, 0);
    const saved = Math.round((1 - huffBits / fixedBits) * 100);

    const table = [...codes.entries()]
      .sort((a, b) => a[1].length - b[1].length || (a[0] < b[0] ? -1 : 1))
      .map(([ch, code]) => `${ch === ' ' ? '␣' : ch}=${code}`)
      .join('  ');

    yield forestFrame(nodes, roots, blank(), {
      line: 5,
      note: `codes: ${table}`,
      stats: { ...stats(), 'plain bits': fixedBits, 'huffman bits': huffBits, 'saved': `${saved}%` },
    });

    yield forestFrame(nodes, roots, blank(), {
      line: 5,
      note: `"${text.length > 40 ? text.slice(0, 40) + '…' : text}" takes ${huffBits} bits instead of ${fixedBits} — ${saved}% smaller. The commonest character got a ${Math.min(...[...codes.values()].map((c) => c.length))}-bit code, the rarest ${Math.max(...[...codes.values()].map((c) => c.length))}.`,
      stats: { ...stats(), 'plain bits': fixedBits, 'huffman bits': huffBits, 'saved': `${saved}%` },
    });
  },
};

export const HUFFMAN = [huffman];
