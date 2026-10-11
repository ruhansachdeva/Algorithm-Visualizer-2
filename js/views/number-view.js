/* ============================================================
   Number grid view
   ------------------------------------------------------------
   A wall of integers, each coloured by what the algorithm has
   decided about it. Sieves and divisibility algorithms read far
   better this way than as a bar chart, where the bars would just
   be a straight ramp.

   A frame:
   {
     from, to,              // the inclusive range of numbers shown
     states: Uint8Array,    // one code per number, indexed by (v - from)
     cols,                  // optional; otherwise chosen to fit
     note, stats
   }
   ============================================================ */

import { fitCanvas, colors, fillRound, label } from './draw.js';

export const NUM = {
  UNKNOWN: 0,
  KEPT: 1,       // survived — a prime
  STRUCK: 2,     // crossed out — a composite
  CURRENT: 3,    // the number being worked from
  MARKING: 4,    // being crossed out right now
  SKIPPED: 5,    // already crossed out, visited again
};

const PAD = 14;

export function drawNumbers(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { from = 0, to = 0, states } = frame;
  if (!states || to < from) return;

  const count = to - from + 1;

  // Choose a column count that keeps the cells close to square.
  const cols = frame.cols || Math.max(1, Math.min(count,
    Math.round(Math.sqrt(count * (w - PAD * 2) / Math.max(1, h - PAD * 2)))));
  const rows = Math.ceil(count / cols);

  const size = Math.max(10, Math.floor(Math.min(
    (w - PAD * 2) / cols,
    (h - PAD * 2) / rows,
  )));
  const x0 = (w - size * cols) / 2;
  const y0 = (h - size * rows) / 2;

  const fillFor = {
    [NUM.UNKNOWN]: C.sunken,
    [NUM.KEPT]:    C.sorted,
    [NUM.STRUCK]:  C.range,
    [NUM.CURRENT]: C.swap,
    [NUM.MARKING]: C.compare,
    [NUM.SKIPPED]: C.pivot,
  };

  const fontSize = Math.min(13, Math.max(7, size * 0.38));
  const showText = size >= 15;

  for (let i = 0; i < count; i++) {
    const cx = i % cols, cy = (i / cols) | 0;
    const x = x0 + cx * size;
    const y = y0 + cy * size;
    const st = states[i];

    fillRound(ctx, x + 1, y + 1, size - 2, size - 2, Math.min(4, size / 5), fillFor[st] ?? C.sunken);

    if (st === NUM.UNKNOWN) {
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
    }

    if (showText) {
      const dim = st === NUM.STRUCK;
      label(ctx, String(from + i), x + size / 2, y + size / 2, {
        size: fontSize,
        weight: st === NUM.KEPT || st === NUM.CURRENT ? 700 : 500,
        color: st === NUM.UNKNOWN ? C.dim : dim ? C.faint : '#0d1117',
      });
    }
  }
}

export const NUMBER_LEGEND = [
  ['--c-swap',    'the number we are working from'],
  ['--c-compare', 'being crossed out'],
  ['--c-range',   'crossed out — not prime'],
  ['--c-sorted',  'prime'],
];
