/* ============================================================
   Points view — scattered 2D points
   ------------------------------------------------------------
   For computational geometry: a cloud of points, a partly-built
   shape joining some of them, and a highlight on whichever few
   the algorithm is currently reasoning about.

   A frame:
   {
     points: [{x, y}],      // normalised 0..1, shared not copied
     hull:   [i, j, k],     // indices, joined in order
     closed: bool,          // join the last back to the first
     current: i,            // the point being considered
     probe:  [a, b, c],     // the three points in a turn test
     dropped: [i, ...],     // ruled out
     pivot: i,              // the anchor point, if any
     note, stats
   }
   ============================================================ */

import { fitCanvas, colors, circle, strokeCircle, line, label, fillRound } from './draw.js';

const PAD = 36;

export function drawPoints(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { points, hull = [], closed = false, current = -1, probe = [], dropped = [], pivot = -1,
          divider = null, band = null } = frame;
  if (!points?.length) return;

  const X = (p) => PAD + p.x * (w - PAD * 2);
  const Y = (p) => h - PAD - p.y * (h - PAD * 2);   // y up, like maths rather than screens

  const droppedSet = new Set(dropped);
  const probeSet = new Set(probe);
  const hullSet = new Set(hull);

  /* ── the vertical band a divide-and-conquer step is working in ── */
  if (band) {
    const x1 = PAD + band[0] * (w - PAD * 2);
    const x2 = PAD + band[1] * (w - PAD * 2);
    fillRound(ctx, Math.min(x1, x2), PAD - 10, Math.abs(x2 - x1), h - PAD * 2 + 20, 4, C.range);
  }
  if (divider !== null) {
    const x = PAD + divider * (w - PAD * 2);
    ctx.save();
    ctx.setLineDash([5, 4]);
    line(ctx, x, PAD - 10, x, h - PAD + 10, C.cursor, 1.5);
    ctx.restore();
  }

  /* ── the shape built so far ── */
  for (let i = 0; i + 1 < hull.length; i++) {
    const a = points[hull[i]], b = points[hull[i + 1]];
    line(ctx, X(a), Y(a), X(b), Y(b), C.path, 2.5);
  }
  if (closed && hull.length > 2) {
    const a = points[hull[hull.length - 1]], b = points[hull[0]];
    line(ctx, X(a), Y(a), X(b), Y(b), C.path, 2.5);
  }

  /* ── the turn currently being tested ── */
  if (probe.length >= 2) {
    for (let i = 0; i + 1 < probe.length; i++) {
      const a = points[probe[i]], b = points[probe[i + 1]];
      line(ctx, X(a), Y(a), X(b), Y(b), C.compare, 2);
    }
  }

  /* ── the points ── */
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = X(p), y = Y(p);

    let fill = C.idle;
    let r = 4.5;
    if (droppedSet.has(i)) { fill = C.idle; r = 3; }
    if (hullSet.has(i))    { fill = C.path; r = 5.5; }
    if (probeSet.has(i))   { fill = C.compare; r = 6; }
    if (i === current)     { fill = C.swap; r = 6.5; }
    if (i === pivot)       { fill = C.cursor; r = 6.5; }

    if (droppedSet.has(i) && !hullSet.has(i) && i !== current) {
      ctx.globalAlpha = 0.35;
    }
    circle(ctx, x, y, r, fill);
    if (i === pivot) strokeCircle(ctx, x, y, r + 3, C.cursor, 1.5);
    ctx.globalAlpha = 1;
  }

  /* ── a small caption for the anchor ── */
  if (pivot >= 0) {
    const p = points[pivot];
    const txt = 'start';
    ctx.font = '700 10px ui-monospace, Menlo, monospace';
    const tw = ctx.measureText(txt).width;
    fillRound(ctx, X(p) - tw / 2 - 4, Y(p) + 11, tw + 8, 14, 4, C.panel);
    label(ctx, txt, X(p), Y(p) + 18.5, { size: 10, weight: 700, color: C.cursor });
  }
}

export const POINTS_LEGEND = [
  ['--c-cursor',  'the anchor point'],
  ['--c-swap',    'the point being added'],
  ['--c-compare', 'the turn being tested'],
  ['--c-path',    'on the hull'],
  ['--c-idle',    'ruled out — strictly inside'],
];
