/* ============================================================
   MAZE GENERATION
   ------------------------------------------------------------
   These don't find a path — they build the board. Each one has a
   recognisable signature:

     Recursive backtracker → long winding corridors, few junctions
     Randomized Prim       → short branches, very bushy, many dead ends
     Recursive division    → long straight walls, room-like chambers

   When one finishes it writes its walls back into the shared grid,
   so you can switch straight to A* and solve the maze you just
   watched being carved.
   ============================================================ */

import { CELL } from '../../views/grid-view.js';

const base = { view: 'grid', input: 'grid', legend: [
  ['--c-wall', 'wall'],
  ['--c-frontier', 'being carved'],
  ['--c-path', 'open corridor'],
] };

function mf(cells, inp, extra = {}) {
  return { cells: cells.slice(), cols: inp.cols, rows: inp.rows, ...extra };
}

/** Push the finished maze back into the shared grid state. */
function commit(cells, inp) {
  inp.walls.clear();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === CELL.WALL) inp.walls.add(i);
  }
  // Make sure S and G sit in open corridors, not inside a wall.
  for (const key of ['start', 'goal']) {
    if (inp.walls.has(inp[key])) {
      const open = [...Array(cells.length).keys()].filter((i) => !inp.walls.has(i));
      if (open.length) inp[key] = key === 'start' ? open[0] : open[open.length - 1];
    }
  }
  cells[inp.start] = CELL.START;
  cells[inp.goal] = CELL.GOAL;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ───────────── Recursive Backtracker (DFS maze) ────────── */

const backtracker = {
  ...base,
  id: 'maze-backtracker',
  name: 'Maze: Recursive Backtracker',
  about: 'A depth-first search that carves as it goes. From the current cell it tunnels to a random unvisited neighbour two steps away; when it is boxed in it backtracks until it finds somewhere new. Because it always runs as deep as it can before retreating, it produces long twisting corridors and relatively few dead ends.',
  cost: { best: 'O(V)', avg: 'O(V)', worst: 'O(V)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'start somewhere, mark it carved, push it on a stack',
    'while the stack is not empty:',
    '  look at the top cell\'s uncarved neighbours (2 cells away)',
    '  if there are any: carve through to a random one and push it',
    '  if there are none: pop — backtrack',
  ],
  *run(inp) {
    const { cols, rows } = inp;
    const cells = new Uint8Array(cols * rows).fill(CELL.WALL);
    const at = (x, y) => y * cols + x;

    const startX = 1, startY = 1;
    cells[at(startX, startY)] = CELL.EMPTY;
    const stack = [[startX, startY]];
    let carved = 1;

    yield mf(cells, inp, { line: 0, note: 'everything starts solid — carve outward from the top-left', stats: { carved, 'stack depth': 1 } });

    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const options = [[2,0],[-2,0],[0,2],[0,-2]]
        .map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && cells[at(nx, ny)] === CELL.WALL);

      if (!options.length) {
        stack.pop();
        if (stack.length) {
          yield mf(cells, inp, { line: 4, note: 'dead end — backtracking', stats: { carved, 'stack depth': stack.length } });
        }
        continue;
      }

      const [nx, ny] = pick(options);
      // knock out the wall between the two cells, and the cell itself
      cells[at((x + nx) / 2, (y + ny) / 2)] = CELL.EMPTY;
      cells[at(nx, ny)] = CELL.FRONTIER;
      carved += 2;
      yield mf(cells, inp, { line: 3, note: `carving ${nx > x ? 'right' : nx < x ? 'left' : ny > y ? 'down' : 'up'}`, stats: { carved, 'stack depth': stack.length + 1 } });
      cells[at(nx, ny)] = CELL.EMPTY;
      stack.push([nx, ny]);
    }

    commit(cells, inp);
    yield mf(cells, inp, { note: `maze complete — ${carved} open cells. Switch to A* to solve it.`, stats: { carved, 'stack depth': 0 } });
  },
};

/* ──────────────────── Randomized Prim ──────────────────── */

const prim = {
  ...base,
  id: 'maze-prim',
  name: 'Maze: Randomized Prim',
  about: 'Grows the maze outward from one cell. It keeps a pile of every wall touching the carved region and repeatedly knocks out a random one — so the maze expands evenly in all directions rather than tunnelling. The result is bushy: lots of short branches and plenty of dead ends.',
  cost: { best: 'O(V log V)', avg: 'O(V log V)', worst: 'O(V log V)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'carve one starting cell',
    'add all of its walls to a list',
    'while the list is not empty:',
    '  pull out a random wall',
    '  if exactly one side is carved: knock it through and add the new walls',
  ],
  *run(inp) {
    const { cols, rows } = inp;
    const cells = new Uint8Array(cols * rows).fill(CELL.WALL);
    const at = (x, y) => y * cols + x;

    const sx = 1, sy = 1;
    cells[at(sx, sy)] = CELL.EMPTY;
    let carved = 1;

    /** Walls are stored as [wallX, wallY, cellX, cellY]. */
    const walls = [];
    const addWalls = (x, y) => {
      for (const [dx, dy] of [[2,0],[-2,0],[0,2],[0,-2]]) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && cells[at(nx, ny)] === CELL.WALL) {
          walls.push([x + dx / 2, y + dy / 2, nx, ny]);
        }
      }
    };
    addWalls(sx, sy);

    yield mf(cells, inp, { line: 1, note: 'one cell carved, its walls are candidates', stats: { carved, 'walls waiting': walls.length } });

    while (walls.length) {
      const idx = Math.floor(Math.random() * walls.length);
      const [wx, wy, cx, cy] = walls.splice(idx, 1)[0];

      if (cells[at(cx, cy)] !== CELL.WALL) continue;   // already reached another way

      cells[at(wx, wy)] = CELL.EMPTY;
      cells[at(cx, cy)] = CELL.FRONTIER;
      carved += 2;
      yield mf(cells, inp, { line: 4, note: 'knocked a random wall through to new ground', stats: { carved, 'walls waiting': walls.length } });

      cells[at(cx, cy)] = CELL.EMPTY;
      addWalls(cx, cy);
    }

    commit(cells, inp);
    yield mf(cells, inp, { note: `maze complete — ${carved} open cells. Switch to A* to solve it.`, stats: { carved, 'walls waiting': 0 } });
  },
};

/* ─────────────────── Recursive Division ────────────────── */

const division = {
  ...base,
  id: 'maze-division',
  name: 'Maze: Recursive Division',
  about: 'The opposite approach: start with a wide-open room, drop a wall across it with one gap, then do the same to each half. It is the only one of the three that builds walls instead of carving them, and the straight full-length walls it leaves behind give it a blocky, architectural look.',
  cost: { best: 'O(V log V)', avg: 'O(V log V)', worst: 'O(V log V)', space: 'O(log V)', stable: '—' },
  pseudocode: [
    'start with an empty room',
    'split it with a straight wall, leaving one gap',
    'recurse into the chamber on each side',
    'stop when a chamber is too small to split',
  ],
  *run(inp) {
    const { cols, rows } = inp;
    const cells = new Uint8Array(cols * rows).fill(CELL.EMPTY);
    const at = (x, y) => y * cols + x;
    let built = 0;

    // outer border
    for (let x = 0; x < cols; x++) { cells[at(x, 0)] = CELL.WALL; cells[at(x, rows - 1)] = CELL.WALL; }
    for (let y = 0; y < rows; y++) { cells[at(0, y)] = CELL.WALL; cells[at(cols - 1, y)] = CELL.WALL; }

    yield mf(cells, inp, { line: 0, note: 'one big empty room', stats: { 'walls built': 0 } });

    function* divide(x, y, w, h) {
      if (w < 3 || h < 3) return;
      const horizontal = h > w ? true : w > h ? false : Math.random() < 0.5;

      if (horizontal) {
        // wall on an even row, gap on an odd column
        const candidates = [];
        for (let yy = y + 1; yy < y + h - 1; yy += 2) candidates.push(yy);
        if (!candidates.length) return;
        const wy = pick(candidates);
        const gaps = [];
        for (let xx = x; xx < x + w; xx += 2) gaps.push(xx);
        const gap = pick(gaps);

        for (let xx = x; xx < x + w; xx++) {
          if (xx === gap) continue;
          cells[at(xx, wy)] = CELL.WALL;
          built++;
        }
        yield mf(cells, inp, { line: 1, note: `horizontal wall across row ${wy}, gap at column ${gap}`, stats: { 'walls built': built } });

        yield* divide(x, y, w, wy - y);
        yield* divide(x, wy + 1, w, y + h - wy - 1);
      } else {
        const candidates = [];
        for (let xx = x + 1; xx < x + w - 1; xx += 2) candidates.push(xx);
        if (!candidates.length) return;
        const wx = pick(candidates);
        const gaps = [];
        for (let yy = y; yy < y + h; yy += 2) gaps.push(yy);
        const gap = pick(gaps);

        for (let yy = y; yy < y + h; yy++) {
          if (yy === gap) continue;
          cells[at(wx, yy)] = CELL.WALL;
          built++;
        }
        yield mf(cells, inp, { line: 1, note: `vertical wall down column ${wx}, gap at row ${gap}`, stats: { 'walls built': built } });

        yield* divide(x, y, wx - x, h);
        yield* divide(wx + 1, y, x + w - wx - 1, h);
      }
    }

    yield* divide(1, 1, cols - 2, rows - 2);

    commit(cells, inp);
    yield mf(cells, inp, { note: `maze complete — ${built} wall cells. Switch to A* to solve it.`, stats: { 'walls built': built } });
  },
};

export const MAZES = [backtracker, prim, division];
