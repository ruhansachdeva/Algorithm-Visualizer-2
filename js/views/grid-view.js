/* ============================================================
   Grid view — 2D maze / pathfinding board
   ------------------------------------------------------------
   A frame is deliberately compact, because a pathfinding run can
   produce thousands of them:

   {
     cells:  Uint8Array,   // one state code per cell (see CELL below)
     cols, rows,
     weights: Uint8Array,  // movement cost, shared — never copied
     labels: Float64Array, // optional per-cell number (distance, f-score)
     note, stats
   }

   Storing a Uint8Array per frame instead of a set of objects is
   what keeps 5,000-step searches smooth.
   ============================================================ */

import { fitCanvas, colors, fillRound, label } from './draw.js';

export const CELL = {
  EMPTY:    0,
  WALL:     1,
  VISITED:  2,
  FRONTIER: 3,
  PATH:     4,
  START:    5,
  GOAL:     6,
  CURRENT:  7,
};

const PAD = 10;

/** Work out where the board sits inside the canvas. */
export function gridGeometry(canvas, cols, rows) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width - PAD * 2;
  const h = rect.height - PAD * 2;
  const size = Math.max(4, Math.floor(Math.min(w / cols, h / rows)));
  const boardW = size * cols;
  const boardH = size * rows;
  return {
    size,
    x0: PAD + (w - boardW) / 2,
    y0: PAD + (h - boardH) / 2,
    boardW, boardH,
  };
}

/** Which cell is under a mouse position? -1 if outside the board. */
export function cellAt(canvas, cols, rows, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const g = gridGeometry(canvas, cols, rows);
  const cx = Math.floor((clientX - rect.left - g.x0) / g.size);
  const cy = Math.floor((clientY - rect.top - g.y0) / g.size);
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
  return cy * cols + cx;
}

export function drawGrid(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { cells, cols, rows, weights, labels } = frame;
  if (!cells) return;

  const g = gridGeometry(canvas, cols, rows);
  const size = g.size;
  const gap = size > 10 ? 1 : 0;
  const radius = size > 14 ? 2 : 0;

  const fillFor = {
    [CELL.EMPTY]:    C.sunken,
    [CELL.WALL]:     C.wall,
    [CELL.VISITED]:  C.visited,
    [CELL.FRONTIER]: C.frontier,
    [CELL.PATH]:     C.path,
    [CELL.START]:    C.start,
    [CELL.GOAL]:     C.goal,
    [CELL.CURRENT]:  C.swap,
  };

  // board backing, so empty cells read as one surface
  fillRound(ctx, g.x0 - 2, g.y0 - 2, g.boardW + 4, g.boardH + 4, 6, C.sunken);

  const showLabels = size >= 22 && labels;
  const showWeights = size >= 16 && weights;

  for (let i = 0; i < cells.length; i++) {
    const cx = i % cols;
    const cy = (i / cols) | 0;
    const x = g.x0 + cx * size;
    const y = g.y0 + cy * size;
    const state = cells[i];

    let fill = fillFor[state] ?? C.sunken;

    // Heavier cells get a visibly darker tint so weighted runs read clearly.
    if (state === CELL.EMPTY && showWeights && weights[i] > 1) {
      fill = C.range;
    }

    if (state === CELL.EMPTY && !(showWeights && weights[i] > 1)) {
      // grid lines only — keeps the empty board from looking like a solid slab
      ctx.fillStyle = C.sunken;
      ctx.fillRect(x, y, size - gap, size - gap);
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, size - gap - 1, size - gap - 1);
    } else {
      fillRound(ctx, x, y, size - gap, size - gap, radius, fill);
    }

    // weight digit
    if (showWeights && weights[i] > 1 && state !== CELL.WALL) {
      label(ctx, String(weights[i]), x + size / 2, y + size / 2, {
        size: Math.min(10, size * 0.4), color: C.dim, weight: 700,
      });
    }

    // distance label on top of explored cells
    if (showLabels && labels[i] !== undefined && Number.isFinite(labels[i]) &&
        (state === CELL.VISITED || state === CELL.FRONTIER || state === CELL.PATH)) {
      label(ctx, String(Math.round(labels[i])), x + size / 2, y + size / 2, {
        size: Math.min(10, size * 0.38), color: '#0d1117', weight: 700,
      });
    }

    // start / goal glyphs
    if (state === CELL.START || state === CELL.GOAL) {
      label(ctx, state === CELL.START ? 'S' : 'G', x + size / 2, y + size / 2, {
        size: Math.min(13, size * 0.55), color: '#0d1117', weight: 800,
      });
    }
  }
}

export const GRID_LEGEND = [
  ['--c-frontier', 'frontier (next to look at)'],
  ['--c-visited',  'already explored'],
  ['--c-path',     'shortest path'],
  ['--c-wall',     'wall'],
  ['--c-goal',     'goal'],
];
