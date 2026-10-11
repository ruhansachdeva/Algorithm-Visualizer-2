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

export const GEOMETRY = [graham];
