/* ============================================================
   Puzzle views — N-Queens, Sudoku, Towers of Hanoi
   ------------------------------------------------------------
   Three small renderers for the backtracking algorithms. Each
   one is simple enough to keep separate rather than forcing a
   shared abstraction that would fit none of them well.
   ============================================================ */

import { fitCanvas, colors, fillRound, label, circle, line } from './draw.js';

/* ───────────────────────── N-Queens ────────────────────── */

export function drawQueens(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { n, queens = [], tryRow = -1, tryCol = -1, conflict = false, attacked = [] } = frame;
  if (!n) return;

  const size = Math.floor(Math.min(w - 40, h - 40) / n);
  const x0 = (w - size * n) / 2;
  const y0 = (h - size * n) / 2;
  const attackSet = new Set(attacked.map(([r, c]) => r * n + c));

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = x0 + c * size, y = y0 + r * size;
      const dark = (r + c) % 2 === 1;

      let bg = dark ? C.range : C.sunken;
      if (attackSet.has(r * n + c)) bg = C.wall;
      if (r === tryRow && c === tryCol) bg = conflict ? C.swap : C.compare;

      ctx.fillStyle = bg;
      ctx.fillRect(x, y, size, size);

      if (queens[r] === c) {
        // a queen: a crown-ish disc
        circle(ctx, x + size / 2, y + size / 2, size * 0.3, C.sorted);
        label(ctx, '♛', x + size / 2, y + size / 2 + 1, {
          size: size * 0.42, color: '#0d1117', weight: 700, mono: false,
        });
      } else if (attackSet.has(r * n + c) && size > 22) {
        label(ctx, '×', x + size / 2, y + size / 2, { size: size * 0.3, color: C.faint });
      }
    }
  }

  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, size * n - 1, size * n - 1);
}

export const QUEENS_LEGEND = [
  ['--c-compare', 'trying this square'],
  ['--c-swap',    'rejected — under attack'],
  ['--c-wall',    'attacked by a placed queen'],
  ['--c-sorted',  'queen placed'],
];

/* ───────────────────────── Sudoku ──────────────────────── */

export function drawSudoku(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { board, given, current = -1, conflict = false, backtracking = false } = frame;
  if (!board) return;

  const size = Math.floor(Math.min(w - 40, h - 30) / 9);
  const x0 = (w - size * 9) / 2;
  const y0 = (h - size * 9) / 2;

  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9;
    const x = x0 + c * size, y = y0 + r * size;

    let bg = C.sunken;
    if (given[i]) bg = C.range;
    if (i === current) bg = conflict ? C.swap : backtracking ? C.pivot : C.compare;

    ctx.fillStyle = bg;
    ctx.fillRect(x, y, size, size);

    if (board[i]) {
      label(ctx, String(board[i]), x + size / 2, y + size / 2, {
        size: size * 0.5,
        weight: given[i] ? 800 : 600,
        color: i === current ? '#0d1117' : given[i] ? C.text : C.cursor,
      });
    }
  }

  // thin lines between cells, thick ones between the 3x3 boxes
  for (let k = 0; k <= 9; k++) {
    const thick = k % 3 === 0;
    const p = k * size;
    line(ctx, x0 + p, y0, x0 + p, y0 + size * 9, thick ? C.text : C.border, thick ? 2 : 1);
    line(ctx, x0, y0 + p, x0 + size * 9, y0 + p, thick ? C.text : C.border, thick ? 2 : 1);
  }
}

export const SUDOKU_LEGEND = [
  ['--c-compare', 'trying a digit here'],
  ['--c-swap',    'clashes — try the next digit'],
  ['--c-pivot',   'backtracking'],
  ['--c-range',   'given at the start'],
];

/* ────────────────────── Towers of Hanoi ────────────────── */

export function drawHanoi(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { pegs, total, moving = null } = frame;
  if (!pegs) return;

  const pegW = (w - 60) / 3;
  const maxDiskW = pegW * 0.86;
  const diskH = Math.max(9, Math.min(42, (h - 110) / Math.max(total, 1)));
  const towerH = diskH * total + 30;
  const baseY = Math.min(h - 40, (h + towerH) / 2);

  const pegColors = [C.cursor, C.compare, C.sorted];

  for (let p = 0; p < 3; p++) {
    const cx = 30 + pegW * p + pegW / 2;

    // post and base
    fillRound(ctx, cx - 3, baseY - diskH * total - 14, 6, diskH * total + 14, 3, C.border);
    fillRound(ctx, cx - maxDiskW / 2 - 6, baseY, maxDiskW + 12, 7, 3, C.border);

    label(ctx, ['A', 'B', 'C'][p], cx, baseY + 22, { size: 11, color: C.faint, weight: 700 });

    pegs[p].forEach((disk, idx) => {
      const width = maxDiskW * (0.3 + 0.7 * (disk / total));
      const y = baseY - (idx + 1) * diskH;
      const isMoving = moving && moving.disk === disk;
      fillRound(ctx, cx - width / 2, y + 1, width, diskH - 2, 4,
        isMoving ? C.swap : pegColors[p]);
      if (diskH >= 13) {
        label(ctx, String(disk), cx, y + diskH / 2, {
          size: Math.min(11, diskH * 0.6), weight: 700, color: '#0d1117',
        });
      }
    });
  }
}

export const HANOI_LEGEND = [
  ['--c-swap',   'disk being moved'],
  ['--c-cursor', 'peg A'],
  ['--c-compare','peg B'],
  ['--c-sorted', 'peg C'],
];
