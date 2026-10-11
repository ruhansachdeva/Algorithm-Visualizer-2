/* Trees: a tree can look right and still be wrong, so these check the
   PROPERTY each structure promises rather than just the final picture. */

import { load, check, reset, tally, distinctInts } from './harness.mjs';

export const name = 'trees';

/* ── reading a frame's tree back out ── */
const inorder = (f) => {
  const out = [];
  (function walk(i) {
    if (i === null || i === undefined) return;
    walk(f.nodes[i].children[0]);
    out.push(f.nodes[i].label);
    walk(f.nodes[i].children[1]);
  })(f.root);
  return out;
};
const height = (f) => (function h(i) {
  if (i === null || i === undefined) return 0;
  return 1 + Math.max(h(f.nodes[i].children[0]), h(f.nodes[i].children[1]));
})(f.root);

export async function run() {
  reset();
  const { TREES } = await load('algorithms/trees/index.js');
  const { record } = await load('engine/player.js');
  const get = (id) => TREES.find((a) => a.id === id);

  for (const sorted of [false, true]) {
    for (let trial = 0; trial < 10; trial++) {
      const values = distinctInts(3 + Math.floor(Math.random() * 12), 99);
      if (sorted) values.sort((a, b) => a - b);
      const target = values[Math.floor(Math.random() * values.length)];
      const want = [...values].sort((a, b) => a - b);

      /* in-order of a BST is the sorted order — that IS the invariant */
      const ins = record(get('bst-insert').run({ values: [...values] }), 200000).at(-1);
      check(JSON.stringify(inorder(ins)) === JSON.stringify(want),
        `BST insert: in-order was ${inorder(ins)}, expected sorted`);

      /* delete must remove exactly one value and keep the ordering */
      const del = record(get('bst-delete').run({ values: [...values], target }), 200000).at(-1);
      check(JSON.stringify(inorder(del)) === JSON.stringify(want.filter((v) => v !== target)),
        `BST delete of ${target}: left ${inorder(del)}`);

      /* AVL: ordering preserved, nothing lost, and height within the bound */
      const avl = record(get('avl-insert').run({ values: [...values] }), 200000).at(-1);
      check(JSON.stringify(inorder(avl)) === JSON.stringify(want), 'AVL lost or reordered values');
      const bound = Math.ceil(1.45 * Math.log2(values.length + 2));
      check(height(avl) <= bound, `AVL height ${height(avl)} exceeds the AVL bound ${bound}`);

      /* a heap must come out in sorted order when drained */
      const heap = record(get('heap-ops').run({ values: [...values] }), 200000).at(-1);
      const m = heap.note.match(/came out sorted: (.*)$/);
      check(m && JSON.stringify(m[1].split(', ').map(Number)) === JSON.stringify(want),
        'binary heap did not drain in sorted order');
    }
  }

  /* ── red-black: all five rules, after EVERY prefix, so a bug cannot
        hide behind later inserts ── */
  const RED = '#e5484d';
  const rb = get('rb-insert');
  for (const mode of ['random', 'sorted']) {
    for (let trial = 0; trial < 6; trial++) {
      const values = distinctInts(1 + Math.floor(Math.random() * 14), 200);
      if (mode === 'sorted') values.sort((a, b) => a - b);

      for (let k = 1; k <= values.length; k++) {
        const prefix = values.slice(0, k);
        const f = record(rb.run({ values: [...prefix] }), 200000).at(-1);
        const isRed = (i) => f.paint[i] === RED;

        check(!isRed(f.root), `red-black: the root is red after inserting ${prefix}`);

        let redRed = false;
        (function walk(i) {
          if (i === null || i === undefined) return;
          for (const c of f.nodes[i].children) {
            if (c === null || c === undefined) continue;
            if (isRed(i) && isRed(c)) redRed = true;
            walk(c);
          }
        })(f.root);
        check(!redRed, `red-black: a red node has a red child after inserting ${prefix}`);

        const blacks = new Set();
        (function paths(i, n) {
          if (i === null || i === undefined) { blacks.add(n); return; }
          const c = n + (isRed(i) ? 0 : 1);
          paths(f.nodes[i].children[0], c);
          paths(f.nodes[i].children[1], c);
        })(f.root, 0);
        check(blacks.size === 1, `red-black: paths have differing black counts (${[...blacks]}) after ${prefix}`);

        check(JSON.stringify(inorder(f)) === JSON.stringify([...prefix].sort((a, b) => a - b)),
          `red-black: ordering broken after inserting ${prefix}`);
      }
    }
  }

  /* ── tries: words in, same words out, and node count equals the number
        of distinct prefixes ── */
  const { TRIES } = await load('algorithms/trees/trie.js');
  const [trieIns, trieSearch] = TRIES;
  for (const words of [['CAT', 'CAR', 'CARD', 'DOG'], ['A'], ['PRE', 'PREFIX', 'PREFIXED'], ['X', 'Y', 'Z']]) {
    const f = record(trieIns.run({ words }), 100000).at(-1);
    const stored = [];
    (function walk(i, acc) {
      if (f.nodes[i].tag === '✓' && acc) stored.push(acc);
      for (const k of f.nodes[i].children) walk(k, acc + f.nodes[k].label);
    })(f.root, '');
    check(JSON.stringify(stored.sort()) === JSON.stringify([...words].sort()), `trie stored ${stored}`);

    const prefixes = new Set();
    for (const w of words) for (let i = 1; i <= w.length; i++) prefixes.add(w.slice(0, i));
    check(f.nodes.length === prefixes.size + 1,
      `trie has ${f.nodes.length} nodes, expected ${prefixes.size + 1} (one per distinct prefix, plus the root)`);

    // a stored word is found; a strict prefix of one is reported as a prefix
    for (const w of words) {
      const last = record(trieSearch.run({ words, target: w }), 100000).at(-1);
      check(/is a stored word/.test(last.note), `trie search missed the stored word ${w}`);
    }
  }

  /* ── Huffman: prefix-free, and the text round-trips ── */
  const huff = get('huffman');
  for (const text of ['ABRACADABRA', 'AAAAAAAAAAAAAAAABBBBCCDE', 'ABCDEFGH', 'A', 'MISSISSIPPI']) {
    const frames = record(huff.run({ text }), 200000);
    const codeFrame = frames.find((x) => /^codes: /.test(x.note || ''));
    if (!check(codeFrame !== undefined, `Huffman emitted no code table for "${text}"`)) continue;

    const codes = new Map();
    for (const pair of codeFrame.note.replace('codes: ', '').split('  ')) {
      const i = pair.lastIndexOf('=');
      if (i < 0) continue;
      codes.set(pair.slice(0, i) === '␣' ? ' ' : pair.slice(0, i), pair.slice(i + 1));
    }

    const all = [...codes.values()];
    check(!all.some((a) => all.some((b) => a !== b && b.startsWith(a))),
      `Huffman codes for "${text}" are not prefix-free, so the output could not be decoded`);

    const encoded = [...text].map((c) => codes.get(c)).join('');
    const byCode = new Map([...codes].map(([c, k]) => [k, c]));
    let decoded = '', buf = '';
    for (const bit of encoded) { buf += bit; if (byCode.has(buf)) { decoded += byCode.get(buf); buf = ''; } }
    check(decoded === text, `Huffman round trip for "${text}" produced "${decoded}"`);
  }

  /* ── the headline claim: AVL beats a plain BST on sorted input ── */
  const sortedVals = Array.from({ length: 15 }, (_, i) => i + 1);
  const avlH = height(record(get('avl-insert').run({ values: [...sortedVals] }), 200000).at(-1));
  const bstH = height(record(get('bst-insert').run({ values: [...sortedVals] }), 200000).at(-1));
  check(avlH < bstH, `on sorted input AVL reached height ${avlH} and the plain BST ${bstH} — AVL should be shorter`);

  return tally();
}
