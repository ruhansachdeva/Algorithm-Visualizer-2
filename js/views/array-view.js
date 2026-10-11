/* ============================================================
   Array view — bar chart
   ------------------------------------------------------------
   Used by every sorting and searching algorithm.

   A frame it understands looks like:
   {
     array:    [5, 2, 9, 1],      // required — the values
     compare:  [0, 2],            // indices being compared  (yellow)
     swap:     [0, 2],            // indices being swapped   (red)
     sorted:   [3],               // finished, locked in     (green)
     cursor:   1,                 // "I am here" pointer     (blue)
     pivot:    2,                 // quicksort pivot         (purple)
     range:    [1, 3],            // active window, shaded
     dead:     [0, 4],            // ruled out (binary search), faded
     found:    2,                 // success                 (green flash)
     target:   9,                 // search target, shown top-right
     aux:      { label: 'counts', values: [...], highlight: 2 },
     note:     'comparing 5 and 9'
   }
   Every field except `array` is optional.
   ============================================================ */

import { fitCanvas, colors, fillRound, label, fade, line } from './draw.js';

const PAD = { top: 26, right: 16, bottom: 30, left: 16 };

/* Remembered from the last draw so a mouse position can be turned back
   into an array index without recomputing the layout. */
let lastGeometry = null;

/** Which bar is under the pointer? -1 if none. */
export function barAt(canvas, clientX) {
  if (!lastGeometry) return -1;
  const rect = canvas.getBoundingClientRect();
  const { slot, count } = lastGeometry;
  const i = Math.floor((clientX - rect.left - PAD.left) / slot);
  return i >= 0 && i < count ? i : -1;
}

export function drawArray(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const arr = frame.array || [];
  if (!arr.length) {
    label(ctx, 'empty array', w / 2, h / 2, { size: 13, color: C.faint });
    return;
  }

  // Reserve a strip at the bottom for the auxiliary row, if present.
  const auxH = frame.aux ? 54 : 0;
  const plotTop = PAD.top;
  const plotBottom = h - PAD.bottom - auxH;
  const plotH = Math.max(20, plotBottom - plotTop);
  const plotW = w - PAD.left - PAD.right;

  const n = arr.length;
  const slot = plotW / n;
  const gap = Math.min(3, Math.max(0.5, slot * 0.14));
  const barW = Math.max(1, slot - gap);

  lastGeometry = { slot, count: n };

  const maxVal = Math.max(1, ...arr.map((v) => Math.abs(v)));
  const hasNegatives = arr.some((v) => v < 0);
  // With negatives we need a zero line in the middle of the plot.
  const zeroY = hasNegatives ? plotTop + plotH * 0.55 : plotBottom;
  const unit = hasNegatives ? (plotH * 0.5) / maxVal : plotH / maxVal;

  const sorted  = new Set(frame.sorted || []);
  const compare = new Set(frame.compare || []);
  const swap    = new Set(frame.swap || []);
  const dead    = new Set(frame.dead || []);

  // ── shaded active window ──────────────────────────────────
  if (frame.range) {
    const [lo, hi] = frame.range;
    if (hi >= lo) {
      const x = PAD.left + lo * slot - gap / 2;
      const rw = (hi - lo + 1) * slot;
      fillRound(ctx, x, plotTop - 6, rw, plotH + 12, 6, C.range);
    }
  }

  // ── zero line for negative values ─────────────────────────
  if (hasNegatives) line(ctx, PAD.left, zeroY, w - PAD.right, zeroY, C.border, 1);

  // ── the bars ──────────────────────────────────────────────
  const showLabels = n <= 36 && barW >= 13;
  const showIndexRow = n <= 36 && barW >= 13;

  for (let i = 0; i < n; i++) {
    const v = arr[i];
    const x = PAD.left + i * slot + gap / 2;
    const magnitude = Math.max(2, Math.abs(v) * unit);
    const y = v < 0 ? zeroY : zeroY - magnitude;
    const barH = magnitude;

    let color = C.idle;
    if (sorted.has(i))        color = C.sorted;
    if (i === frame.pivot)    color = C.pivot;
    if (i === frame.cursor)   color = C.cursor;
    if (compare.has(i))       color = C.compare;
    if (swap.has(i))          color = C.swap;
    if (i === frame.found)    color = C.found;

    const isDead = dead.has(i);
    const paint = () => {
      fillRound(ctx, x, y, barW, barH, Math.min(4, barW / 3), color);

      if (showLabels) {
        // Put the number inside the bar if it fits, otherwise above it.
        const inside = barH > 20;
        const ly = v < 0
          ? (inside ? y + barH - 10 : y + barH + 10)
          : (inside ? y + 11 : y - 9);
        label(ctx, String(v), x + barW / 2, ly, {
          size: Math.min(11, Math.max(8, barW * 0.5)),
          color: inside ? pickTextColor(color) : C.dim,
          weight: 600,
        });
      }
    };
    isDead ? fade(ctx, 0.18, paint) : paint();

    // index ruler along the bottom
    if (showIndexRow) {
      label(ctx, String(i), x + barW / 2, plotBottom + 12, {
        size: 9,
        color: i === frame.cursor ? C.cursor : C.faint,
      });
    }

    // caret under whatever the algorithm is pointing at
    if (i === frame.cursor && showIndexRow) {
      label(ctx, '▲', x + barW / 2, plotBottom + 23, { size: 7, color: C.cursor });
    }
  }

  // ── search target chip ────────────────────────────────────
  if (frame.target !== undefined && frame.target !== null) {
    const txt = `target: ${frame.target}`;
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    const tw = ctx.measureText(txt).width;
    fillRound(ctx, w - PAD.right - tw - 16, 6, tw + 16, 20, 6, C.panel);
    label(ctx, txt, w - PAD.right - tw / 2 - 8, 17, { size: 11, color: C.text, weight: 600 });
  }

  // ── auxiliary row (counting sort buckets, radix digits, …) ─
  if (frame.aux) drawAux(ctx, frame.aux, PAD.left, h - PAD.bottom - auxH + 10, plotW, C);
}

/** A compact second row of boxes beneath the main chart. */
function drawAux(ctx, aux, x0, y0, width, C) {
  const vals = aux.values || [];
  if (!vals.length) return;

  label(ctx, aux.label || 'aux', x0, y0 - 2, {
    size: 9.5, color: C.faint, align: 'left', baseline: 'bottom',
  });

  const highlight = new Set(
    Array.isArray(aux.highlight) ? aux.highlight
      : aux.highlight === undefined ? [] : [aux.highlight]
  );

  const slot = width / vals.length;
  const boxW = Math.max(1, Math.min(34, slot - 2));
  const boxH = 22;

  for (let i = 0; i < vals.length; i++) {
    const x = x0 + i * slot + (slot - boxW) / 2;
    const on = highlight.has(i);
    fillRound(ctx, x, y0 + 4, boxW, boxH, 4, on ? C.compare : C.sunken);
    if (!on) {
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y0 + 4.5, boxW - 1, boxH - 1);
    }
    if (boxW >= 14) {
      label(ctx, String(vals[i]), x + boxW / 2, y0 + 15, {
        size: 10, color: on ? pickTextColor(C.compare) : C.dim, weight: 600,
      });
      if (aux.keys) {
        label(ctx, String(aux.keys[i]), x + boxW / 2, y0 + 34, { size: 8.5, color: C.faint });
      }
    }
  }
}

/** Black text on light fills, white on dark ones. */
export function pickTextColor(bg) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(bg.replace('#', '#'));
  if (!m) return '#ffffff';
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#10141a' : '#ffffff';
}
