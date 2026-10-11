/* Segment tree. The answer is easy to check; the interesting assertion is
   that it reaches that answer in a logarithmic number of visits, since a
   subtly wrong boundary test can still total correctly while walking the
   entire tree. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'segment tree';

export async function run() {
  reset();
  const { SEGMENT } = await load('algorithms/trees/segment.js');
  const { record } = await load('engine/player.js');
  const [build, query] = SEGMENT;
  const last = (gen) => record(gen, 300000).at(-1);

  for (let trial = 0; trial < 40; trial++) {
    const n = 1 + Math.floor(Math.random() * 16);
    const values = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 20));

    /* Build: the root must hold the total, every node the total of its range. */
    const b = last(build.run({ values }));
    check(b.nodes[0].label === values.reduce((a, c) => a + c, 0),
      `the root holds ${b.nodes[0].label}, the list totals ${values.reduce((a, c) => a + c, 0)}`);

    check(b.nodes.length === 2 * n - 1,
      `a segment tree over ${n} values should have ${2 * n - 1} nodes, this has ${b.nodes.length}`);

    // Every internal node must equal its two children.
    for (let i = 0; i < b.nodes.length; i++) {
      const [l, r] = b.nodes[i].children;
      if (l === null || r === null) continue;
      check(b.nodes[i].label === b.nodes[l].label + b.nodes[r].label,
        `node ${i} holds ${b.nodes[i].label} but its halves total ${b.nodes[l].label + b.nodes[r].label}`);
    }

    /* Query: every possible range, against a plain sum. */
    for (let from = 0; from < n; from++) {
      for (let to = from; to < n; to++) {
        const q = last(query.run({ values, from, to }));
        const want = values.slice(from, to + 1).reduce((a, c) => a + c, 0);
        check(q.stats.answer === want, `range ${from}..${to} of [${values}] gave ${q.stats.answer}, wanted ${want}`);

        /* The whole point is that it does NOT look at every element. A node
           fully inside must stop the descent — if that test is wrong the sum
           still comes out right while the walk touches the entire tree. */
        check(q.stats['nodes visited'] <= 4 * Math.ceil(Math.log2(n + 1)) + 4,
          `range ${from}..${to} of ${n} values visited ${q.stats['nodes visited']} nodes — ` +
          'that is not logarithmic, so a node fully inside the range is not stopping the descent');
      }
    }

    /* Asking for everything must be answerable by the root alone. */
    const whole = last(query.run({ values, from: 0, to: n - 1 }));
    check(whole.stats['nodes visited'] === 1,
      `asking for the whole list visited ${whole.stats['nodes visited']} nodes — the root alone should answer it`);
  }

  /* Reversed bounds should be read as a range, not as nothing. */
  const values = [4, 8, 1, 6, 2];
  const flipped = last(query.run({ values, from: 3, to: 1 }));
  check(flipped.stats.answer === 8 + 1 + 6, `reversed bounds gave ${flipped.stats.answer}, wanted 15`);

  return tally();
}
