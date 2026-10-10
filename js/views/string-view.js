/* ============================================================
   String view — pattern matching
   ------------------------------------------------------------
   The text on top, the pattern slid underneath it. What matters
   is how far the pattern JUMPS after a mismatch: the naive
   version always shuffles along by one, while KMP and
   Boyer-Moore use what they just learned to skip ahead.

   A frame:
   {
     text, pattern,
     offset,      // where the pattern currently sits
     at,          // index inside the pattern being compared
     ok,          // how many characters have matched at this offset
     mismatch,    // true if the current comparison failed
     found: [],   // offsets where a full match was confirmed
     dead: [],    // offsets already ruled out
     table: { label, values, highlight }   // e.g. KMP's prefix table
   }
   ============================================================ */

import { fitCanvas, colors, fillRound, label } from './draw.js';

const PAD = 18;

export function drawString(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { text = '', pattern = '', offset = 0, at = -1, ok = 0, mismatch = false, found = [], table } = frame;
  if (!text) return;

  const n = text.length;
  const cw = Math.max(12, Math.min(40, (w - PAD * 2) / Math.max(n, 1)));
  const chH = Math.min(34, cw * 1.05);
  const x0 = PAD + Math.max(0, ((w - PAD * 2) - cw * n) / 2);

  // Centre the whole block: text row, index ruler, pattern row, helper table.
  const tableH = table && table.values?.length ? 56 : 0;
  const blockH = chH + 14 + 26 + chH + tableH;
  const topY = Math.max(PAD + 12, (h - blockH) / 2);
  const patY = topY + chH + 30;          // clears the index ruler underneath
  const tableY = patY + chH + 36;

  const foundSet = new Set();
  for (const f of found) for (let k = 0; k < pattern.length; k++) foundSet.add(f + k);

  /* ── the text ── */
  label(ctx, 'text', x0, topY - 9, { size: 9.5, color: C.faint, align: 'left', baseline: 'bottom', mono: false });

  for (let i = 0; i < n; i++) {
    const x = x0 + i * cw;
    const inWindow = i >= offset && i < offset + pattern.length;
    const comparing = at >= 0 && i === offset + at;

    let bg = C.sunken;
    if (foundSet.has(i)) bg = C.found;
    else if (inWindow) bg = C.range;
    if (comparing) bg = mismatch ? C.swap : C.compare;

    fillRound(ctx, x + 1, topY, cw - 2, chH, 4, bg);
    label(ctx, text[i], x + cw / 2, topY + chH / 2, {
      size: Math.min(15, cw * 0.52), weight: 700,
      color: bg === C.sunken ? C.dim : '#0d1117',
    });
    if (cw >= 18) {
      label(ctx, String(i), x + cw / 2, topY + chH + 8, { size: 8.5, color: C.faint });
    }
  }

  /* ── the pattern, slid to the current offset ── */
  label(ctx, 'pattern', x0, patY - 2, { size: 9.5, color: C.faint, align: 'left', baseline: 'bottom', mono: false });

  for (let k = 0; k < pattern.length; k++) {
    const i = offset + k;
    if (i < 0 || i >= n) continue;
    const x = x0 + i * cw;
    const comparing = k === at;

    let bg = C.sunken;
    if (k < ok) bg = C.path;
    if (comparing) bg = mismatch ? C.swap : C.compare;

    fillRound(ctx, x + 1, patY + 6, cw - 2, chH, 4, bg);
    label(ctx, pattern[k], x + cw / 2, patY + 6 + chH / 2, {
      size: Math.min(15, cw * 0.52), weight: 700,
      color: bg === C.sunken ? C.dim : '#0d1117',
    });
  }

  /* ── a helper table underneath (KMP prefix table, shift table…) ── */
  if (table && table.values?.length && tableY + 40 < h) {
    label(ctx, table.label, x0, tableY - 4, { size: 9.5, color: C.faint, align: 'left', baseline: 'bottom', mono: false });

    const tw = Math.max(14, Math.min(cw, 34));
    const highlight = new Set(
      Array.isArray(table.highlight) ? table.highlight
        : table.highlight === undefined || table.highlight === null ? [] : [table.highlight]
    );

    for (let i = 0; i < table.values.length; i++) {
      const x = x0 + i * tw;
      const on = highlight.has(i);
      fillRound(ctx, x + 1, tableY + 2, tw - 2, 20, 3, on ? C.compare : C.sunken);
      if (!on) {
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1.5, tableY + 2.5, tw - 3, 19);
      }
      label(ctx, String(table.values[i]), x + tw / 2, tableY + 12, {
        size: 10, weight: 700, color: on ? '#0d1117' : C.dim,
      });
      if (table.keys) {
        label(ctx, String(table.keys[i]), x + tw / 2, tableY + 31, { size: 9, color: C.faint });
      }
    }
  }
}

export const STRING_LEGEND = [
  ['--c-compare', 'comparing'],
  ['--c-swap',    'mismatch'],
  ['--c-path',    'matched so far'],
  ['--c-range',   'current window'],
  ['--c-found',   'full match'],
];
