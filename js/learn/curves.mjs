/* ============================================================
   Turning a complexity string into a curve you can draw.

   The registry stores cost as display text — "O(n log n)", "O(V + E)",
   "O(2ⁿ)" — because that is what belongs in a table. To draw it over
   measured data we need the shape as a function of n.

   Two deliberate simplifications, both stated on the page so nobody is
   misled:

   1. Big-O throws away the constant factor, so a shape alone cannot be
      plotted against real counts. We fit the constant to the data (see
      `fitScale`) and draw the scaled shape. That is honest about what
      big-O claims: the *shape* is the prediction, not the height.

   2. Costs in more than one variable get collapsed. A graph here is
      generated with a fixed edge-to-node ratio, so E grows with V and
      "O(V + E)" is linear in n. Pattern length m, radix width d and
      alphabet size k are fixed by the generator, so they fold into the
      constant. Each of those is marked `approx` so the page can say so.
   ============================================================ */

const ln = (x) => Math.log2(Math.max(x, 2));

/* Shapes, keyed by the exact string the registry uses. `approx` marks a
   cost whose extra variables were folded into the constant factor. */
const SHAPES = {
  'O(1)':            { f: () => 1,                     name: 'constant' },
  'O(α(n))':         { f: () => 1,                     name: 'effectively constant', approx: true },
  'O(log log n)':    { f: (n) => ln(ln(n)),            name: 'log-log' },
  'O(n log log n)':  { f: (n) => n * ln(ln(n)),        name: 'n log log n' },
  'O(log n)':        { f: ln,                          name: 'logarithmic' },
  'O(log₃ n)':       { f: (n) => ln(n) / ln(3),        name: 'logarithmic (base 3)' },
  'O(log i)':        { f: ln,                          name: 'logarithmic', approx: true },
  'O(log b)':        { f: ln,                          name: 'logarithmic', approx: true },
  'O(log min(a,b))': { f: ln,                          name: 'logarithmic', approx: true },
  'O(√n)':           { f: (n) => Math.sqrt(n),         name: 'square root' },
  'O(n)':            { f: (n) => n,                    name: 'linear' },
  'O(m)':            { f: (n) => n,                    name: 'linear', approx: true },
  'O(E)':            { f: (n) => n,                    name: 'linear in edges', approx: true },
  'O(V)':            { f: (n) => n,                    name: 'linear in nodes', approx: true },
  'O(n + m)':        { f: (n) => n,                    name: 'linear', approx: true },
  'O(n + k)':        { f: (n) => n,                    name: 'linear', approx: true },
  'O(V + E)':        { f: (n) => n,                    name: 'linear in nodes + edges', approx: true },
  'O(d·n)':          { f: (n) => n,                    name: 'linear per digit', approx: true },
  'O(n / m)':        { f: (n) => n,                    name: 'sublinear', approx: true },
  'O(n·A)':          { f: (n) => n,                    name: 'linear per amount', approx: true },
  'O(n·S)':          { f: (n) => n,                    name: 'linear per target', approx: true },
  'O(n·W)':          { f: (n) => n,                    name: 'linear per capacity', approx: true },
  'O(n·h)':          { f: (n) => n * ln(n),            name: 'n × height', approx: true },
  'O(n log n)':      { f: (n) => n * ln(n),            name: 'n log n' },
  'O(E log V)':      { f: (n) => n * ln(n),            name: 'n log n', approx: true },
  'O(E log E)':      { f: (n) => n * ln(n),            name: 'n log n', approx: true },
  'O(V log V)':      { f: (n) => n * ln(n),            name: 'n log n', approx: true },
  '≈O(n^1.3)':       { f: (n) => n ** 1.3,             name: 'about n^1.3', approx: true },
  'O(n²)':           { f: (n) => n * n,                name: 'quadratic' },
  'O(n·m)':          { f: (n) => n * n,                name: 'quadratic', approx: true },
  'O(V·E)':          { f: (n) => n * n,                name: 'quadratic', approx: true },
  'O(n³)':           { f: (n) => n ** 3,               name: 'cubic' },
  'O(V³)':           { f: (n) => n ** 3,               name: 'cubic' },
  'O(V·E²)':         { f: (n) => n ** 3,               name: 'cubic', approx: true },
  'O(2ⁿ)':           { f: (n) => 2 ** n,               name: 'exponential' },
  'O(mⁿ)':           { f: (n) => 3 ** n,               name: 'exponential', approx: true },
  'O(9^k)':          { f: (n) => 9 ** n,               name: 'exponential', approx: true },
  'O(n!)':           { f: fact,                        name: 'factorial' },
  'O(n·n!)':         { f: (n) => n * fact(n),          name: 'n × factorial' },
};

function fact(n) {
  let r = 1;
  for (let i = 2; i <= Math.min(n, 170); i++) r *= i;
  return r;
}

/* Costs that genuinely cannot be drawn: no shape, or one that depends on
   something the input size does not control. */
const UNPLOTTABLE = {
  '∞': 'unbounded — it may never finish, so there is no curve to draw',
  'exponential': 'exponential, but the base depends on the instance',
  'O(n² / 2^p)': 'depends on the gap sequence, not on n alone',
  'O(b^(d/2))': 'grows with the depth of the search, which the board size does not set',
};

/**
 * The drawable shape for a complexity string.
 * @returns {{f: Function, name: string, approx?: boolean}|null}
 */
export function shapeFor(cost) {
  return SHAPES[String(cost).trim()] ?? null;
}

/** Why a cost cannot be drawn, or null if it can. */
export function whyUnplottable(cost) {
  const key = String(cost).trim();
  if (SHAPES[key]) return null;
  return UNPLOTTABLE[key] ?? 'this one has no single-variable shape to plot';
}

/**
 * Big-O fixes the shape but not the height, so the only fair way to draw a
 * curve against real counts is to scale it to the data. This picks the
 * constant c minimising Σ(measured − c·shape)², which is the textbook
 * least-squares fit through the origin.
 */
export function fitScale(sizes, measured, f) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < sizes.length; i++) {
    const s = f(sizes[i]);
    if (!Number.isFinite(s) || measured[i] == null) continue;
    num += measured[i] * s;
    den += s * s;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * How well the shape explains the data, as R² against the fitted curve.
 * 1 means the measurement follows the predicted shape exactly.
 */
export function agreement(sizes, measured, f) {
  const c = fitScale(sizes, measured, f);
  const mean = measured.reduce((a, b) => a + b, 0) / measured.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < sizes.length; i++) {
    const pred = c * f(sizes[i]);
    if (!Number.isFinite(pred)) continue;
    ssRes += (measured[i] - pred) ** 2;
    ssTot += (measured[i] - mean) ** 2;
  }
  if (ssTot === 0) return 1;
  return Math.max(0, 1 - ssRes / ssTot);
}

/**
 * Which textbook shape the data actually follows best, independent of what
 * the registry claims. Used to say "this measured as quadratic" — and to
 * catch a cost string that is simply wrong.
 */
const CANDIDATES = ['O(1)', 'O(log n)', 'O(√n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2ⁿ)'];

export function bestFit(sizes, measured) {
  let best = null;
  for (const key of CANDIDATES) {
    const r2 = agreement(sizes, measured, SHAPES[key].f);
    if (!best || r2 > best.r2) best = { cost: key, r2, name: SHAPES[key].name };
  }
  return best;
}

/* ────────────────────────────────────────────────────────────
   Judging the fit.

   R² alone is misleading for anything sublinear. Binary search on 50 to
   6,400 items goes from about 6 probes to about 13, so the spread in the
   data is tiny, the denominator in R² is tiny with it, and a couple of
   probes of noise drags R² down to 0.8 on a measurement that is in fact
   textbook logarithmic. Ternary search came out at R² = 0.000 for the
   same reason.

   So the growth rate is estimated directly instead. Fitting
   work ≈ c·nᵖ on log-log axes gives an exponent that is comparable
   across shapes: p ≈ 0 constant, ≈ 0.15 logarithmic, 0.5 square root,
   1 linear, ≈ 1.1 n log n, 2 quadratic. Comparing the measured p with
   the claimed shape's own p over the same range of n is a fair test,
   and it is the one the verdict below uses.
   ──────────────────────────────────────────────────────────── */

/** Fit work ≈ c·nᵖ on log-log axes and return p. */
export function exponent(sizes, measured) {
  const pts = [];
  for (let i = 0; i < sizes.length; i++) {
    if (measured[i] > 0 && sizes[i] > 0) pts.push([Math.log(sizes[i]), Math.log(measured[i])]);
  }
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, [x]) => a + x, 0) / n;
  const my = pts.reduce((a, [, y]) => a + y, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den === 0 ? null : num / den;
}

/** The same exponent for a predicted shape, over the same range of n. */
export function shapeExponent(sizes, f) {
  return exponent(sizes, sizes.map(f));
}

/**
 * What the measurement says about the claim.
 * @returns {{kind: string, text: string, measuredP: number, claimedP: number}}
 */
export function verdict({ sizes, measured, shape, cost, repeatedWhy }) {
  const p = exponent(sizes, measured);
  const q = shapeExponent(sizes, shape);
  if (p == null || q == null) {
    return { kind: 'unknown', text: 'not enough measurable runs to judge the shape', measuredP: p, claimedP: q };
  }

  const gap = p - q;
  const base = { measuredP: p, claimedP: q };

  // A fifth of an exponent is about the width of the noise between
  // n log n and n over one decade. For the factorial and exponential
  // shapes the exponent is 7 or more and a fixed window is far too tight,
  // so it widens in proportion — being within 8% of n! is agreement.
  const tolerance = Math.max(0.2, Math.abs(q) * 0.08);
  if (Math.abs(gap) <= tolerance) {
    return { ...base, kind: 'agrees', text: repeatedWhy
      ? `the measurement follows the predicted shape once the repetition is accounted for — ${repeatedWhy}`
      : `the measurement follows ${cost} closely over this range` };
  }
  if (gap < -0.2) {
    return { ...base, kind: 'under', text: `this ran better than ${cost} on these inputs — that figure is the worst case, and a worst case is a ceiling rather than a forecast` };
  }
  return { ...base, kind: 'over', text: `this ran worse than ${cost} suggests over this range, which usually means a term the headline figure hides is dominating at these sizes` };
}

/** Plain-English growth rate for an exponent. */
export function describeExponent(p) {
  if (p == null) return 'unclear';
  if (p < 0.08) return 'essentially flat';
  if (p < 0.4) return 'logarithmic — barely grows';
  if (p < 0.7) return 'about the square root of n';
  if (p < 0.9) return 'sublinear';
  if (p < 1.12) return 'linear';
  if (p < 1.45) return 'a little above linear, like n log n';
  if (p < 1.75) return 'between linear and quadratic';
  if (p < 2.3) return 'quadratic';
  if (p < 3.3) return 'cubic';
  return 'faster than cubic — effectively exponential here';
}

/**
 * The fact that lands hardest: what happens to the work when the input
 * doubles. Taken from the two measured sizes closest to a doubling.
 */
export function doubling(sizes, measured) {
  let best = null;
  for (let i = 0; i < sizes.length; i++) {
    for (let j = i + 1; j < sizes.length; j++) {
      if (!(measured[i] > 0) || !(measured[j] > 0)) continue;
      const ratio = sizes[j] / sizes[i];
      const off = Math.abs(Math.log2(ratio));
      if (!best || Math.abs(off - 1) < Math.abs(best.off - 1)) {
        best = { off, from: sizes[i], to: sizes[j], fromWork: measured[i], toWork: measured[j] };
      }
    }
  }
  if (!best) return null;
  return { ...best, sizeRatio: best.to / best.from, workRatio: best.toWork / best.fromWork };
}
