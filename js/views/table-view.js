/* ============================================================
   Table view — for dynamic programming
   ------------------------------------------------------------
   Every DP algorithm here is really the same picture: a grid of
   subproblems, filled in an order where each answer only needs
   answers already written down.

   The useful part of the animation is the DEPENDENCY highlight —
   the cells the current one is reading. That is the recurrence,
   made visible.

   A frame:
   {
     table: [[v|null, ...], ...],
     rowLabels: [], colLabels: [],
     rowTitle: '', colTitle: '',
     current: [r, c],
     deps:    [[r, c], ...],
     path:    [[r, c], ...],   // traceback at the end
     note, stats
   }
   ============================================================ */

import { fitCanvas, colors, fillRound, label } from './draw.js';

const PAD = 12;

export function drawTable(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { table, rowLabels = [], colLabels = [], current, deps = [], path = [] } = frame;
  if (!table?.length) return;

  const rows = table.length;
  const cols = table[0].length;

  // Space for the header row and column.
  const headW = rowLabels.length ? 46 : 14;
  const headH = colLabels.length ? 26 : 10;

  const availW = w - PAD * 2 - headW;
  const availH = h - PAD * 2 - headH;
  const cw = Math.max(16, Math.min(66, availW / cols));
  const ch = Math.max(15, Math.min(54, availH / rows));

  const x0 = PAD + headW + Math.max(0, (availW - cw * cols) / 2);
  const y0 = PAD + headH + Math.max(0, (availH - ch * rows) / 2);

  const depSet = new Set(deps.map(([r, c]) => `${r},${c}`));
  const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));

  const fontSize = Math.min(12, Math.max(7.5, Math.min(cw * 0.34, ch * 0.5)));
  const headFont = Math.min(11, Math.max(7, fontSize));

  /* ── column headers ── */
  for (let c = 0; c < cols && colLabels.length; c++) {
    label(ctx, String(colLabels[c] ?? ''), x0 + c * cw + cw / 2, y0 - 9, {
      size: headFont,
      color: current && current[1] === c ? C.cursor : C.faint,
      weight: current && current[1] === c ? 700 : 500,
    });
  }
  if (frame.colTitle) {
    label(ctx, frame.colTitle, x0 + (cw * cols) / 2, y0 - 22, { size: 9.5, color: C.faint, mono: false });
  }

  /* ── row headers ── */
  for (let r = 0; r < rows && rowLabels.length; r++) {
    label(ctx, String(rowLabels[r] ?? ''), x0 - 8, y0 + r * ch + ch / 2, {
      size: headFont,
      color: current && current[0] === r ? C.cursor : C.faint,
      align: 'right',
      weight: current && current[0] === r ? 700 : 500,
    });
  }
  if (frame.rowTitle) {
    ctx.save();
    ctx.translate(PAD + 6, y0 + (ch * rows) / 2);
    ctx.rotate(-Math.PI / 2);
    label(ctx, frame.rowTitle, 0, 0, { size: 9.5, color: C.faint, mono: false });
    ctx.restore();
  }

  /* ── cells ── */
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * cw;
      const y = y0 + r * ch;
      const v = table[r][c];
      const key = `${r},${c}`;

      const isCurrent = current && current[0] === r && current[1] === c;
      const isDep = depSet.has(key);
      const isPath = pathSet.has(key);
      const filled = v !== null && v !== undefined;

      let bg = C.sunken;
      if (filled) bg = C.range;
      if (isPath) bg = C.path;
      if (isDep) bg = C.compare;
      if (isCurrent) bg = C.swap;

      fillRound(ctx, x + 1, y + 1, cw - 2, ch - 2, 3, bg);

      if (!filled && !isCurrent) {
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      }

      if (filled) {
        const text = typeof v === 'number' && !Number.isFinite(v) ? '∞' : String(v);
        label(ctx, text, x + cw / 2, y + ch / 2, {
          size: fontSize,
          weight: isCurrent || isDep || isPath ? 800 : 600,
          color: isCurrent || isDep || isPath ? '#0d1117' : C.text,
        });
      } else if (isCurrent) {
        label(ctx, '?', x + cw / 2, y + ch / 2, { size: fontSize, weight: 800, color: '#0d1117' });
      }
    }
  }
}

export const TABLE_LEGEND = [
  ['--c-swap',    'cell being filled'],
  ['--c-compare', 'cells it reads (the recurrence)'],
  ['--c-range',   'already solved'],
  ['--c-path',    'the answer, traced back'],
];
