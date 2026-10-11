/* ============================================================
   COMPUTATIONAL GEOMETRY
   ------------------------------------------------------------
   The convex hull is the shape you get by stretching an elastic
   band around a set of points and letting go. It is the starting
   point for an enormous amount of geometry — collision detection,
   shape fitting, pathfinding around obstacles — because once you
   have the hull you can ignore everything strictly inside it.
   ============================================================ */

import { POINTS_LEGEND } from '../../views/points-view.js';

/**
 * Which way do you turn going a → b → c?
 *   > 0 left (counter-clockwise), < 0 right (clockwise), 0 straight.
 *
 * This single sign is almost all of 2D geometry: it answers "is this
 * point left of that line", "do these segments cross", "is this polygon
 * wound the right way", without a single square root or division.
 */
function turn(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

const base = { view: 'points', input: 'points', legend: POINTS_LEGEND };

/* ───────────────── Graham scan convex hull ─────────────── */

const graham = {
  ...base,
  id: 'geo-graham',
  name: 'Convex Hull (Graham Scan)',
  about: 'The shape an elastic band makes if you stretch it round a set of points. Start from the lowest point, sort everything else by the angle it sits at from there, then walk that order keeping a stack — and whenever the last three points turn clockwise, the middle one must be inside, so pop it. Each point is pushed and popped at most once, so after the sort the walk is linear.',
  cost: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'find the lowest point — it is certainly on the hull',
    'sort the rest by the angle they sit at from there',
    'walk that order, keeping the hull so far on a stack:',
    '  while the last three turn clockwise, pop the middle one',
    '    (a clockwise turn means it is tucked inside)',
    '  push the new point',
  ],
  *run({ points }) {
    const pts = points;
    const n = pts.length;
    if (n < 3) {
      yield { points: pts, hull: pts.map((_, i) => i), closed: n > 1, note: 'need at least three points for a hull', stats: { points: n } };
      return;
    }

    /* ── the lowest point is certainly a corner ── */
    let anchor = 0;
    for (let i = 1; i < n; i++) {
      if (pts[i].y < pts[anchor].y || (pts[i].y === pts[anchor].y && pts[i].x < pts[anchor].x)) anchor = i;
    }

    let popped = 0, tests = 0;
    const f = (extra) => ({
      points: pts, pivot: anchor,
      stats: { points: n, 'turn tests': tests, 'points discarded': popped },
      ...extra,
    });

    yield f({ current: anchor, line: 0, note: 'the lowest point must be on the hull — nothing can be below it' });

    /* ── sort the others by angle around the anchor ── */
    const order = pts.map((_, i) => i).filter((i) => i !== anchor);
    order.sort((i, j) => {
      const t = turn(pts[anchor], pts[i], pts[j]);
      if (t !== 0) return -t;     // counter-clockwise first
      // same direction: nearer one first, so the far one survives
      const di = (pts[i].x - pts[anchor].x) ** 2 + (pts[i].y - pts[anchor].y) ** 2;
      const dj = (pts[j].x - pts[anchor].x) ** 2 + (pts[j].y - pts[anchor].y) ** 2;
      return di - dj;
    });

    yield f({ current: anchor, dropped: order, line: 1, note: 'the rest sorted by the angle they sit at from the anchor' });

    /* ── walk, popping clockwise turns ── */
    const stack = [anchor];
    const dropped = [];

    for (const i of order) {
      while (stack.length >= 2) {
        const a = pts[stack[stack.length - 2]];
        const b = pts[stack[stack.length - 1]];
        tests++;

        yield f({
          hull: stack.slice(), current: i,
          probe: [stack[stack.length - 2], stack[stack.length - 1], i],
          dropped: dropped.slice(),
          line: 3,
          note: `does ${letter(stack[stack.length - 2])} → ${letter(stack[stack.length - 1])} → ${letter(i)} turn left?`,
        });

        if (turn(a, b, pts[i]) > 0) break;    // a left turn is fine, keep it

        const gone = stack.pop();
        dropped.push(gone);
        popped++;
        yield f({
          hull: stack.slice(), current: i, dropped: dropped.slice(), line: 4,
          note: `no — that is a clockwise turn, so ${letter(gone)} is tucked inside. Drop it.`,
        });
      }

      stack.push(i);
      yield f({ hull: stack.slice(), current: i, dropped: dropped.slice(), line: 5, note: `${letter(i)} joins the hull` });
    }

    yield f({
      hull: stack.slice(), closed: true, dropped: dropped.slice(),
      line: 5,
      note: `hull closed with ${stack.length} corners — the other ${n - stack.length} point(s) are strictly inside and can be ignored`,
      stats: { points: n, 'turn tests': tests, 'hull corners': stack.length },
    });
  },
};

const letter = (i) => `P${i}`;


/* ──────────── Jarvis march (gift wrapping) ─────────────── */

const jarvis = {
  ...base,
  id: 'geo-jarvis',
  name: 'Convex Hull (Gift Wrapping)',
  about: 'The same hull, found by literally wrapping. Stand on a point you know is a corner, then sweep for the one point with everything else to its right — that has to be the next corner. Repeat until you come back round. Its cost is O(n·h), where h is the number of corners, so on a tight cluster with a 4-corner hull it beats the Graham scan outright, and on points near a circle, where nearly everything is a corner, it collapses to O(n²).',
  cost: { best: 'O(n)', avg: 'O(n·h)', worst: 'O(n²)', space: 'O(h)', stable: '—' },
  pseudocode: [
    'start at the leftmost point — it must be a corner',
    'repeat:',
    '  try every other point as the next corner',
    '  keep the one with every remaining point to its right',
    '  add it to the hull and stand there instead',
    'stop when you arrive back at the start',
  ],
  *run({ points }) {
    const pts = points;
    const n = pts.length;
    if (n < 3) {
      yield { points: pts, hull: pts.map((_, i) => i), closed: n > 1, note: 'need at least three points', stats: { points: n } };
      return;
    }

    let start = 0;
    for (let i = 1; i < n; i++) if (pts[i].x < pts[start].x || (pts[i].x === pts[start].x && pts[i].y < pts[start].y)) start = i;

    const hull = [];
    let tests = 0, sweeps = 0;
    const f = (extra) => ({
      points: pts, pivot: start,
      stats: { points: n, 'candidates tried': tests, 'sweeps round the cloud': sweeps, 'hull corners': hull.length },
      ...extra,
    });

    yield f({ current: start, line: 0, note: 'the leftmost point must be a corner — nothing lies to its left' });

    let here = start;
    do {
      hull.push(here);
      sweeps++;
      let best = -1;

      for (let cand = 0; cand < n; cand++) {
        if (cand === here) continue;
        tests++;

        if (best === -1) { best = cand; continue; }

        yield f({
          hull: hull.slice(), current: here, probe: [here, best, cand], line: 2,
          note: `from P${here}: is P${cand} further round than P${best}?`,
        });

        const t = turn(pts[here], pts[best], pts[cand]);
        if (t < 0) {
          // cand is to the right of here→best, so it wraps tighter
          best = cand;
          yield f({ hull: hull.slice(), current: here, probe: [here, best], line: 3, note: `yes — P${cand} wraps tighter, it is the new candidate` });
        }
      }

      yield f({ hull: hull.slice().concat(best === start ? [] : [best]), current: best, line: 4, note: best === start ? 'back at the start — the hull is closed' : `P${best} is a corner` });
      here = best;
    } while (here !== start && hull.length <= n);

    yield f({
      hull: hull.slice(), closed: true, line: 5,
      note: `${hull.length} corners found in ${sweeps} sweeps — Graham scan would have sorted all ${n} points first, this only needed ${tests} comparisons`,
      stats: { points: n, 'candidates tried': tests, 'sweeps round the cloud': sweeps, 'hull corners': hull.length },
    });
  },
};


/* ──────────────── Closest pair of points ──────────────── */

const closestPair = {
  ...base,
  id: 'geo-closest-pair',
  name: 'Closest Pair of Points',
  legend: [
    ['--c-compare', 'pair being measured'],
    ['--c-path',    'closest found so far'],
    ['--c-range',   'the strip worth re-checking'],
    ['--c-cursor',  'the dividing line'],
  ],
  about: 'Which two of these points are nearest each other? Checking every pair is n²/2 measurements. Instead: split the cloud down the middle, solve each half, and take the better of the two. The catch is a pair straddling the line — but only points within that best distance of the line can matter, and inside that strip each point can only be beaten by a handful of others. That bound is what keeps the merge linear and the whole thing O(n log n).',
  cost: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'sort the points left to right',
    'split down the middle and solve each half',
    'let d be the better of the two answers',
    'look only at points within d of the dividing line',
    '  sorted by height, each needs comparing to just a few neighbours',
    'the answer is the best of left, right, and the strip',
  ],
  *run({ points }) {
    const pts = points;
    const n = pts.length;
    if (n < 2) { yield { points: pts, note: 'need at least two points', stats: { points: n } }; return; }

    const dist = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
    const order = pts.map((_, i) => i).sort((a, b) => pts[a].x - pts[b].x);

    let best = Infinity, bestPair = [order[0], order[1]];
    let measured = 0, stripChecks = 0, splits = 0;

    const f = (extra) => ({
      points: pts,
      hull: Number.isFinite(best) ? bestPair : [],
      stats: {
        points: n,
        measurements: measured,
        'if we compared every pair': (n * (n - 1)) / 2,
        'closest so far': Number.isFinite(best) ? best.toFixed(3) : '—',
      },
      ...extra,
    });

    yield f({ line: 0, note: `${n} points sorted left to right — comparing every pair would take ${(n * (n - 1)) / 2} measurements` });

    function* solve(lo, hi, depth) {
      const span = [pts[order[lo]].x, pts[order[hi]].x];

      // Small enough to just measure everything.
      if (hi - lo <= 2) {
        for (let i = lo; i <= hi; i++) {
          for (let j = i + 1; j <= hi; j++) {
            measured++;
            const d = dist(order[i], order[j]);
            yield f({ band: span, probe: [order[i], order[j]], line: 1, note: `small group — measuring directly: ${d.toFixed(3)}` });
            if (d < best) { best = d; bestPair = [order[i], order[j]]; }
          }
        }
        return;
      }

      const mid = (lo + hi) >> 1;
      const midX = pts[order[mid]].x;
      splits++;

      yield f({ band: span, divider: midX, line: 1, note: `split these ${hi - lo + 1} points down the middle` });

      yield* solve(lo, mid, depth + 1);
      yield* solve(mid + 1, hi, depth + 1);

      // Only points within `best` of the line can beat what we already have.
      const strip = [];
      for (let i = lo; i <= hi; i++) if (Math.abs(pts[order[i]].x - midX) < best) strip.push(order[i]);
      strip.sort((a, b) => pts[a].y - pts[b].y);

      yield f({
        band: [midX - best, midX + best], divider: midX, line: 3,
        note: `${strip.length} point(s) sit within ${best.toFixed(3)} of the line — only these can straddle it and still win`,
      });

      for (let i = 0; i < strip.length; i++) {
        // Sorted by height, nothing more than `best` above can matter.
        for (let j = i + 1; j < strip.length && pts[strip[j]].y - pts[strip[i]].y < best; j++) {
          measured++; stripChecks++;
          const d = dist(strip[i], strip[j]);
          yield f({
            band: [midX - best, midX + best], divider: midX, probe: [strip[i], strip[j]], line: 4,
            note: `across the line: ${d.toFixed(3)}${d < best ? ' — closer!' : ''}`,
          });
          if (d < best) { best = d; bestPair = [strip[i], strip[j]]; }
        }
      }
    }

    yield* solve(0, n - 1, 0);

    yield f({
      line: 5,
      note: `closest pair is ${best.toFixed(4)} apart — found in ${measured} measurements instead of ${(n * (n - 1)) / 2}, with ${stripChecks} of those across a dividing line`,
      stats: { points: n, measurements: measured, 'if we compared every pair': (n * (n - 1)) / 2, 'closest distance': best.toFixed(4) },
    });
  },
};

export const GEOMETRY = [graham, jarvis, closestPair];
