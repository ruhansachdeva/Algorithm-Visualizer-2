/* Complexity: the Learn page claims to measure what an algorithm really
   costs and lay the predicted curve over it. That claim is only worth
   making if the measurement is trustworthy, so this suite checks the
   machinery and then checks it against algorithms whose complexity is
   not in doubt.

   Three bugs this caught while being written, all of which produced a
   confident and completely wrong curve:

     - Counting Sort "measured as O(1)", because the counter chosen was
       `comparisons`, which is 0 at every size — not comparing is the
       whole point of a counting sort.
     - Segment Tree Query "measured as O(n)", because the counter chosen
       was `answer`: the sum it was asked for, which grows with the
       numbers in the array and says nothing about the cost of a query.
     - Fast Modular Exponentiation "measured as O(n)", because the
       counter chosen was `naive would take` — the cost of the approach
       it exists to avoid. */

import { load, check, equal, reset, tally } from './harness.mjs';
import { installDom } from './dom-shim.mjs';

export const name = 'complexity';

/* Algorithms whose growth is textbook-certain, with the exponent of
   work ≈ c·nᵖ that it implies. The windows are loose on purpose: these
   assert the shape, not a benchmark.
   
   Note that the exponent of a shape depends on the range it is measured
   over, which is why n log n is not 1.0. Across 20…320 items it works
   out at about 1.24, and 2ⁿ across 2…8 items at almost exactly 3.0 —
   so the windows are centred on those, not on the asymptotic ideal. */
const CERTAIN = [
  ['bubble',               1.8, 2.2, 'quadratic'],
  ['selection',            1.8, 2.2, 'quadratic'],
  ['merge',                0.9, 1.45, 'n log n'],
  ['heap',                 0.9, 1.45, 'n log n'],
  ['linear',               0.8, 1.2, 'linear'],
  ['binary',              -0.1, 0.4, 'logarithmic'],
  ['graph-floyd-warshall', 2.7, 3.3, 'cubic'],
  ['dp-matrix-chain',      2.6, 3.4, 'cubic'],
  ['dp-lcs',               1.8, 2.2, 'quadratic'],
  ['bt-hanoi',             2.5, 99,  'exponential'],
  ['bt-subsets',           2.5, 99,  'exponential'],
  ['math-sieve',           0.9, 1.3, 'n log log n, so just above linear'],
  ['tree-inorder',         0.9, 1.2, 'linear'],
  ['segtree-build',        0.9, 1.2, 'linear'],
];

export async function run() {
  reset();
  const uninstall = installDom();
  try {
    const { ALL } = await load('registry.js');
    const { buildInputs } = await load('inputs.js');
    const curves = await import('./../js/learn/curves.mjs');
    const mz = await import('./../js/learn/measure.mjs');

    /* ── every cost string is either drawable or has a stated reason ── */
    for (const algo of ALL) {
      for (const key of ['best', 'avg', 'worst']) {
        const cost = algo.cost?.[key];
        if (!cost) continue;
        const ok = curves.shapeFor(cost) || curves.whyUnplottable(cost);
        check(!!ok, `${algo.id}: cost "${cost}" has neither a curve nor a reason it cannot be drawn`);
      }
    }

    /* ── every input type can be built at a chosen size ── */
    for (const type of [...new Set(ALL.map((a) => a.input))]) {
      const probe = ALL.find((a) => a.input === type);
      if (mz.NO_PLAN[type]) {
        check(typeof mz.NO_PLAN[type] === 'string', `${type}: listed as unscalable but with no reason given`);
        continue;
      }
      check(!!mz.PLANS[type], `input type "${type}" has no measurement plan and is not listed as unscalable`);
    }

    /* ── a measured input must match what the real controls produce ──
       Two plans were wrong when written: `dp-signed` built `{signed}`
       where the control builds `{array}`, and `enumerate` built `{n}`
       where the control builds `{values}`. Both produced an algorithm
       that threw, which the old code then reported as "no data". */
    for (const type of [...new Set(ALL.map((a) => a.input))]) {
      if (!mz.PLANS[type]) continue;
      const probe = ALL.find((a) => a.input === type);
      const real = Object.keys(buildInputs(probe, document.createElement('div'), () => {})()).sort();
      const mine = Object.keys(mz.inputFor(probe, mz.sizesFor(probe)[1]) ?? {});
      for (const k of real) {
        check(mine.includes(k), `measurement plan for "${type}" is missing the key "${k}" that its real controls provide`);
      }
    }

    /* ── no measurement may silently fail ── */
    for (const algo of ALL) {
      if (!mz.PLANS[algo.input]) continue;
      const m = mz.measure(algo, { repeats: 1, cap: 60000 });
      check(!!m, `${algo.id}: measure() returned nothing`);
      if (!m) continue;
      const failed = m.rows.filter((r) => r.failed).map((r) => r.n);
      check(failed.length === 0, `${algo.id}: measurement threw at size(s) ${failed.join(', ')}`);
      const s = mz.series(m);
      check(s.values.every((v) => v != null), `${algo.id}: counter "${s.label}" was missing at some sizes`);
    }

    /* ── the chosen counter must actually be work ── */
    for (const algo of ALL) {
      if (!mz.PLANS[algo.input]) continue;
      const m = mz.measure(algo, { repeats: 1, cap: 60000 });
      const s = mz.series(m);
      check(!/naive|avoided|would take|if we |brute/i.test(s.label),
        `${algo.id}: measuring "${s.label}", which is the cost of the alternative, not of this algorithm`);
      const vals = s.values.filter((v) => v != null);
      check(Math.min(...vals) !== Math.max(...vals),
        `${algo.id}: counter "${s.label}" is the same at every size, so it cannot show growth`);
    }

    /* ── and the measurement must land on the known answer ── */
    for (const [id, lo, hi, what] of CERTAIN) {
      const algo = ALL.find((a) => a.id === id);
      check(!!algo, `${id} is not in the registry`);
      if (!algo) continue;
      const m = mz.measure(algo, { repeats: 2, cap: 300000 });
      const s = mz.series(m);
      const p = curves.exponent(m.sizes, s.values);
      check(p != null && p >= lo && p <= hi,
        `${id} measured as n^${p?.toFixed(2)} counting "${s.label}", but it is ${what} (expected ${lo}–${hi})`);
    }

    /* ── the fitting helpers themselves ── */
    const sizes = [10, 20, 40, 80, 160];
    const square = sizes.map((n) => 3 * n * n);
    equal(Math.round(curves.exponent(sizes, square)), 2, 'exponent() on exact 3n²');
    equal(Math.round(curves.fitScale(sizes, square, (n) => n * n)), 3, 'fitScale() on exact 3n²');
    check(curves.agreement(sizes, square, (n) => n * n) > 0.999, 'agreement() on an exact quadratic');
    check(curves.agreement(sizes, square, (n) => n) < 0.99, 'agreement() should not call a quadratic linear');

    const d = curves.doubling(sizes, square);
    equal(d.sizeRatio, 2, 'doubling() picks a pair where n doubles');
    check(Math.abs(d.workRatio - 4) < 0.01, `doubling() on a quadratic should quadruple the work, got ${d.workRatio}`);

    // Big-O keeps the shape and discards the constant, so a curve 1,000×
    // too tall must still be recognised as the same shape.
    const tall = sizes.map((n) => 1000 * n * n);
    check(curves.agreement(sizes, tall, (n) => n * n) > 0.999,
      'agreement() must be scale-free — it is comparing shapes, not heights');

    /* ── power law or exponential ──
       Hanoi over 2…9 discs fits an exponent of about 3.4, which is
       indistinguishable from a cubic by exponent alone. Calling it
       quadratic and saying "doubling the discs quadruples the work" was
       wrong on the page before this test existed. */
    const small = [2, 3, 4, 5, 6, 7, 8];
    equal(curves.growthKind(small, small.map((n) => 2 ** n)).kind, 'exponential',
      'growthKind() on 2ⁿ');
    equal(curves.growthKind(small, small.map((n) => n ** 3)).kind, 'power',
      'growthKind() on n³ over the same small range');
    equal(curves.growthKind(sizes, square).kind, 'power', 'growthKind() on a quadratic');
    const base = curves.growthKind(small, small.map((n) => 2 ** n)).base;
    check(Math.abs(base - 2) < 0.05, `growthKind() should report a base near 2 for 2ⁿ, got ${base}`);

    // Every algorithm the page would describe as exploding should be one
    // whose stated cost is actually exponential or factorial.
    for (const algo of ALL) {
      if (!mz.PLANS[algo.input]) continue;
      const m = mz.measure(algo, { repeats: 1, cap: 120000 });
      const sr = mz.series(m);
      const k = curves.growthKind(m.sizes, sr.values);
      if (k.kind !== 'exponential' || k.base <= 1.3) continue;
      const cost = `${algo.cost?.avg} ${algo.cost?.worst}`;
      check(/[ⁿ!]|\^|exponential/.test(cost),
        `${algo.id} measured as exponential (×${k.base.toFixed(1)} per item) but its cost is given as ${algo.cost?.avg} — one of the two is wrong`);
    }

    /* ── verdicts ── */
    const linearData = sizes.map((n) => 5 * n);
    const vAgree = curves.verdict({ sizes, measured: linearData, shape: (n) => n, cost: 'O(n)' });
    equal(vAgree.kind, 'agrees', 'verdict() on linear data against O(n)');
    const vUnder = curves.verdict({ sizes, measured: linearData, shape: (n) => n * n, cost: 'O(n²)' });
    equal(vUnder.kind, 'under', 'verdict() on linear data against O(n²)');
    const vOver = curves.verdict({ sizes, measured: square, shape: (n) => n, cost: 'O(n)' });
    equal(vOver.kind, 'over', 'verdict() on quadratic data against O(n)');

    // Factorial exponents are 7 and up, where a fixed ±0.2 window would
    // call every honest measurement a disagreement.
    const factorialish = sizes.map((n) => n ** 7);
    const vBig = curves.verdict({ sizes, measured: factorialish, shape: (n) => n ** 7.3, cost: 'O(n!)' });
    equal(vBig.kind, 'agrees', 'verdict() tolerance must scale with the exponent');
  } finally {
    uninstall();
  }

  return tally();
}
