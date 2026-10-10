/* ============================================================
   PATHFINDING ON A GRID
   ------------------------------------------------------------
   Every one of these answers "what is the shortest way from S
   to G?" — but they disagree about which cell to look at next,
   and that single disagreement is the whole personality of each
   algorithm. Watch the shape of the explored region:

     BFS       spreads as a perfect diamond
     Dijkstra  spreads as a diamond warped by terrain cost
     A*        reaches toward the goal and barely explores elsewhere
     Greedy    dives at the goal and gets fooled by walls
     DFS       bolts off in one direction and wanders
   ============================================================ */

import { CELL, GRID_LEGEND } from '../../views/grid-view.js';

const base = { view: 'grid', input: 'grid', legend: GRID_LEGEND };

/* ───────────────────── shared machinery ────────────────── */

/** Build the starting board from the user's walls / start / goal. */
function board(inp) {
  const cells = new Uint8Array(inp.cols * inp.rows);
  for (const w of inp.walls) cells[w] = CELL.WALL;
  cells[inp.start] = CELL.START;
  cells[inp.goal] = CELL.GOAL;
  return cells;
}

/** One frame. `cells` is copied; `weights` is shared because it never changes. */
function gf(cells, inp, extra = {}) {
  return {
    cells: cells.slice(),
    cols: inp.cols,
    rows: inp.rows,
    weights: inp.weights,
    ...extra,
  };
}

/** Paint a cell, but never scribble over S or G. */
function mark(cells, i, state, inp) {
  if (i === inp.start || i === inp.goal) return;
  cells[i] = state;
}

/** The 4 (or 8) cells you can step to from `i`. */
function neighbours(i, inp) {
  const { cols, rows } = inp;
  const x = i % cols, y = (i / cols) | 0;
  const out = [];
  const steps = inp.diagonal
    ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
    : [[1,0],[0,1],[-1,0],[0,-1]];

  for (const [dx, dy] of steps) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
    const ni = ny * cols + nx;
    if (inp.walls.has(ni)) continue;
    out.push(ni);
  }
  return out;
}

const cost = (inp, i) => (inp.weights ? Math.max(1, inp.weights[i]) : 1);

/** Walk `cameFrom` backwards from the goal, lighting up the route. */
function* tracePath(cells, inp, cameFrom, stats) {
  const path = [];
  let node = inp.goal;
  while (node !== undefined && node !== inp.start) {
    path.push(node);
    node = cameFrom.get(node);
    if (path.length > inp.cols * inp.rows) break;   // guard against a bad chain
  }
  path.reverse();

  let total = 0;
  for (const p of path) {
    total += cost(inp, p);
    mark(cells, p, CELL.PATH, inp);
    yield gf(cells, inp, {
      note: `tracing the path back — ${path.length} step${path.length === 1 ? '' : 's'}`,
      stats: { ...stats, 'path length': path.length, 'path cost': total },
    });
  }
  yield gf(cells, inp, {
    note: `done — shortest path is ${path.length} steps, total cost ${total}`,
    stats: { ...stats, 'path length': path.length, 'path cost': total },
  });
}

function* noPath(cells, inp, stats) {
  yield gf(cells, inp, {
    note: 'every reachable cell was explored — the goal is walled off',
    stats,
  });
}

/* ─────────── a real binary heap (used by Dijkstra & A*) ─────────── */

/**
 * Min-heap keyed by priority. This is the data structure that makes
 * Dijkstra fast: pulling the cheapest unvisited node is O(log n)
 * instead of O(n) from scanning a list.
 */
export class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }

  push(value, priority) {
    this.items.push({ value, priority });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let small = i;
        if (l < this.items.length && this.items[l].priority < this.items[small].priority) small = l;
        if (r < this.items.length && this.items[r].priority < this.items[small].priority) small = r;
        if (small === i) break;
        [this.items[small], this.items[i]] = [this.items[i], this.items[small]];
        i = small;
      }
    }
    return top ? top.value : undefined;
  }
}

/* ───────────────────────── BFS ─────────────────────────── */

const bfs = {
  ...base,
  id: 'grid-bfs',
  name: 'Breadth-First Search',
  about: 'Explores in rings: every cell one step away, then every cell two steps away, and so on. Because it never looks at distance 3 before finishing distance 2, the first time it reaches the goal it has found the shortest path — guaranteed, as long as every step costs the same.',
  cost: { best: 'O(1)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'put the start in a queue',
    'while the queue is not empty:',
    '  take the OLDEST cell out (first in, first out)',
    '  if it is the goal: stop',
    '  add every unvisited neighbour to the back of the queue',
  ],
  *run(inp) {
    const cells = board(inp);
    const queue = [inp.start];
    const seen = new Set([inp.start]);
    const cameFrom = new Map();
    const dist = new Float64Array(inp.cols * inp.rows).fill(Infinity);
    dist[inp.start] = 0;
    let popped = 0;

    yield gf(cells, inp, { labels: dist, note: 'starting at S', stats: { visited: 0, frontier: 1 }, line: 0 });

    while (queue.length) {
      const curr = queue.shift();
      popped++;
      mark(cells, curr, CELL.CURRENT, inp);
      yield gf(cells, inp, {
        labels: dist, line: 2,
        note: `taking the oldest cell from the queue (distance ${dist[curr]})`,
        stats: { visited: popped, frontier: queue.length },
      });

      if (curr === inp.goal) {
        yield gf(cells, inp, { labels: dist, line: 3, note: 'reached the goal', stats: { visited: popped, frontier: queue.length } });
        yield* tracePath(cells, inp, cameFrom, { visited: popped, frontier: queue.length });
        return;
      }

      mark(cells, curr, CELL.VISITED, inp);

      for (const nb of neighbours(curr, inp)) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        cameFrom.set(nb, curr);
        dist[nb] = dist[curr] + 1;
        queue.push(nb);
        mark(cells, nb, CELL.FRONTIER, inp);
      }
      yield gf(cells, inp, {
        labels: dist, line: 4,
        note: `queued ${neighbours(curr, inp).filter((n) => dist[n] === dist[curr] + 1).length} new neighbours`,
        stats: { visited: popped, frontier: queue.length },
      });
    }
    yield* noPath(cells, inp, { visited: popped, frontier: 0 });
  },
};

/* ───────────────────────── DFS ─────────────────────────── */

const dfs = {
  ...base,
  id: 'grid-dfs',
  name: 'Depth-First Search',
  about: 'Same code as BFS with one word changed: it takes the NEWEST cell off the stack instead of the oldest. That one change turns careful ring-by-ring exploration into a single long tunnel that follows one direction until it hits a dead end. It finds *a* path, almost never the shortest one.',
  cost: { best: 'O(1)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'put the start on a stack',
    'while the stack is not empty:',
    '  take the NEWEST cell off (last in, first out)',
    '  if it is the goal: stop',
    '  push every unvisited neighbour',
  ],
  *run(inp) {
    const cells = board(inp);
    const stack = [inp.start];
    const seen = new Set([inp.start]);
    const cameFrom = new Map();
    let popped = 0;

    yield gf(cells, inp, { note: 'starting at S', stats: { visited: 0, stack: 1 }, line: 0 });

    while (stack.length) {
      const curr = stack.pop();
      popped++;
      mark(cells, curr, CELL.CURRENT, inp);
      yield gf(cells, inp, {
        line: 2, note: 'taking the most recently added cell',
        stats: { visited: popped, stack: stack.length },
      });

      if (curr === inp.goal) {
        yield* tracePath(cells, inp, cameFrom, { visited: popped, stack: stack.length });
        return;
      }
      mark(cells, curr, CELL.VISITED, inp);

      for (const nb of neighbours(curr, inp)) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        cameFrom.set(nb, curr);
        stack.push(nb);
        mark(cells, nb, CELL.FRONTIER, inp);
      }
      yield gf(cells, inp, { line: 4, note: 'pushed its neighbours', stats: { visited: popped, stack: stack.length } });
    }
    yield* noPath(cells, inp, { visited: popped, stack: 0 });
  },
};

/* ─────────────────────── Dijkstra ──────────────────────── */

const dijkstra = {
  ...base,
  id: 'grid-dijkstra',
  name: "Dijkstra's Algorithm",
  about: 'BFS that understands that some ground is slower to cross. It always expands the cell with the smallest total cost so far, pulled from a priority queue. Turn on weighted terrain and watch the explored region bulge around the cheap cells and avoid the expensive ones.',
  cost: { best: 'O(E log V)', avg: 'O(E log V)', worst: 'O(E log V)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'distance to start = 0, everything else = infinity',
    'put the start in a priority queue',
    'repeatedly pull the CHEAPEST cell out:',
    '  for each neighbour, is going through me cheaper than its best known route?',
    '  if so, record the better distance and queue it',
  ],
  *run(inp) {
    const cells = board(inp);
    const n = inp.cols * inp.rows;
    const dist = new Float64Array(n).fill(Infinity);
    const done = new Uint8Array(n);
    const cameFrom = new Map();
    const pq = new MinHeap();

    dist[inp.start] = 0;
    pq.push(inp.start, 0);
    let popped = 0, relaxed = 0;

    yield gf(cells, inp, { labels: dist, line: 0, note: 'start costs 0, everything else is unknown', stats: { visited: 0, 'queue size': 1, relaxations: 0 } });

    while (pq.size) {
      const curr = pq.pop();
      if (done[curr]) continue;
      done[curr] = 1;
      popped++;

      mark(cells, curr, CELL.CURRENT, inp);
      yield gf(cells, inp, {
        labels: dist, line: 2,
        note: `cheapest unexplored cell costs ${dist[curr]}`,
        stats: { visited: popped, 'queue size': pq.size, relaxations: relaxed },
      });

      if (curr === inp.goal) {
        yield* tracePath(cells, inp, cameFrom, { visited: popped, 'queue size': pq.size, relaxations: relaxed });
        return;
      }
      mark(cells, curr, CELL.VISITED, inp);

      let improved = 0;
      for (const nb of neighbours(curr, inp)) {
        if (done[nb]) continue;
        const candidate = dist[curr] + cost(inp, nb);
        relaxed++;
        if (candidate < dist[nb]) {
          dist[nb] = candidate;
          cameFrom.set(nb, curr);
          pq.push(nb, candidate);
          mark(cells, nb, CELL.FRONTIER, inp);
          improved++;
        }
      }
      yield gf(cells, inp, {
        labels: dist, line: 4,
        note: improved ? `found a cheaper route to ${improved} neighbour${improved === 1 ? '' : 's'}` : 'no neighbour got cheaper',
        stats: { visited: popped, 'queue size': pq.size, relaxations: relaxed },
      });
    }
    yield* noPath(cells, inp, { visited: popped, 'queue size': 0, relaxations: relaxed });
  },
};

/* ────────────────────────── A* ─────────────────────────── */

function manhattan(a, b, cols) {
  return Math.abs((a % cols) - (b % cols)) + Math.abs(((a / cols) | 0) - ((b / cols) | 0));
}

const astar = {
  ...base,
  id: 'grid-astar',
  name: 'A* Search',
  about: 'Dijkstra with a sense of direction. It ranks cells by cost-so-far PLUS an estimate of the distance still to go, so it expands toward the goal instead of in all directions. As long as that estimate never overshoots the true remaining distance, the path it finds is still guaranteed shortest — it just gets there far faster.',
  cost: { best: 'O(1)', avg: 'O(E log V)', worst: 'O(E log V)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'g = cost from the start, h = estimated cost to the goal',
    'rank cells by f = g + h',
    'repeatedly expand the cell with the smallest f:',
    '  for each neighbour, if this route gives a smaller g, keep it',
    '  queue it with its new f',
  ],
  *run(inp) {
    const cells = board(inp);
    const n = inp.cols * inp.rows;
    const g = new Float64Array(n).fill(Infinity);
    const f = new Float64Array(n).fill(Infinity);
    const done = new Uint8Array(n);
    const cameFrom = new Map();
    const pq = new MinHeap();

    const h = (i) => manhattan(i, inp.goal, inp.cols);
    g[inp.start] = 0;
    f[inp.start] = h(inp.start);
    pq.push(inp.start, f[inp.start]);
    let popped = 0;

    yield gf(cells, inp, { labels: f, line: 0, note: `estimate from S to G is ${h(inp.start)} steps`, stats: { visited: 0, 'queue size': 1 } });

    while (pq.size) {
      const curr = pq.pop();
      if (done[curr]) continue;
      done[curr] = 1;
      popped++;

      mark(cells, curr, CELL.CURRENT, inp);
      yield gf(cells, inp, {
        labels: f, line: 2,
        note: `best guess: cost ${g[curr]} so far + ${h(curr)} to go = ${f[curr]}`,
        stats: { visited: popped, 'queue size': pq.size },
      });

      if (curr === inp.goal) {
        yield* tracePath(cells, inp, cameFrom, { visited: popped, 'queue size': pq.size });
        return;
      }
      mark(cells, curr, CELL.VISITED, inp);

      for (const nb of neighbours(curr, inp)) {
        if (done[nb]) continue;
        const candidate = g[curr] + cost(inp, nb);
        if (candidate < g[nb]) {
          g[nb] = candidate;
          f[nb] = candidate + h(nb);
          cameFrom.set(nb, curr);
          pq.push(nb, f[nb]);
          mark(cells, nb, CELL.FRONTIER, inp);
        }
      }
      yield gf(cells, inp, { labels: f, line: 4, note: 'ranked its neighbours by cost + estimate', stats: { visited: popped, 'queue size': pq.size } });
    }
    yield* noPath(cells, inp, { visited: popped, 'queue size': 0 });
  },
};

/* ──────────────────── Greedy Best-First ────────────────── */

const greedy = {
  ...base,
  id: 'grid-greedy',
  name: 'Greedy Best-First',
  about: 'A* with the cost-so-far thrown away — it ranks cells purely by how close they look to the goal. Usually very fast, and it will happily walk you into a long detour, because it never reconsiders how much the journey has already cost. The clearest demonstration that fast and correct are different things.',
  cost: { best: 'O(1)', avg: 'O(E log V)', worst: 'O(E log V)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'rank cells only by the estimated distance to the goal',
    'always expand whichever cell looks closest',
    'ignore how far you have already travelled',
    '(fast, but the path is not guaranteed shortest)',
  ],
  *run(inp) {
    const cells = board(inp);
    const n = inp.cols * inp.rows;
    const done = new Uint8Array(n);
    const seen = new Uint8Array(n);
    const cameFrom = new Map();
    const pq = new MinHeap();
    const h = (i) => manhattan(i, inp.goal, inp.cols);

    pq.push(inp.start, h(inp.start));
    seen[inp.start] = 1;
    let popped = 0;

    yield gf(cells, inp, { line: 0, note: 'ranking purely by distance-to-goal', stats: { visited: 0, 'queue size': 1 } });

    while (pq.size) {
      const curr = pq.pop();
      if (done[curr]) continue;
      done[curr] = 1;
      popped++;

      mark(cells, curr, CELL.CURRENT, inp);
      yield gf(cells, inp, { line: 1, note: `this one looks ${h(curr)} away`, stats: { visited: popped, 'queue size': pq.size } });

      if (curr === inp.goal) {
        yield* tracePath(cells, inp, cameFrom, { visited: popped, 'queue size': pq.size });
        return;
      }
      mark(cells, curr, CELL.VISITED, inp);

      for (const nb of neighbours(curr, inp)) {
        if (seen[nb]) continue;
        seen[nb] = 1;
        cameFrom.set(nb, curr);
        pq.push(nb, h(nb));
        mark(cells, nb, CELL.FRONTIER, inp);
      }
      yield gf(cells, inp, { line: 2, note: 'queued neighbours by how close they look', stats: { visited: popped, 'queue size': pq.size } });
    }
    yield* noPath(cells, inp, { visited: popped, 'queue size': 0 });
  },
};

/* ──────────────────── Bidirectional BFS ────────────────── */

const bidirectional = {
  ...base,
  id: 'grid-bidirectional',
  name: 'Bidirectional BFS',
  about: 'Runs two breadth-first searches at once — one from the start, one from the goal — and stops when they touch. Two circles of radius d/2 cover far less area than one circle of radius d, so it typically explores a fraction of what plain BFS does while still finding a shortest path.',
  cost: { best: 'O(1)', avg: 'O(b^(d/2))', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  pseudocode: [
    'run one BFS outward from the start',
    'run another BFS outward from the goal',
    'alternate one step each',
    'when a cell is reached by both, join the two halves',
  ],
  *run(inp) {
    const cells = board(inp);
    const fromStart = new Map([[inp.start, null]]);
    const fromGoal = new Map([[inp.goal, null]]);
    let qa = [inp.start], qb = [inp.goal];
    let popped = 0;

    yield gf(cells, inp, { line: 0, note: 'two searches, one from each end', stats: { visited: 0, 'from S': 1, 'from G': 1 } });

    while (qa.length && qb.length) {
      for (const [queue, mine, theirs, who] of [[qa, fromStart, fromGoal, 'S'], [qb, fromGoal, fromStart, 'G']]) {
        const nextLayer = [];
        for (const curr of queue) {
          popped++;
          mark(cells, curr, CELL.VISITED, inp);

          for (const nb of neighbours(curr, inp)) {
            if (mine.has(nb)) continue;
            mine.set(nb, curr);

            if (theirs.has(nb)) {
              // The two searches have met at `nb`.
              mark(cells, nb, CELL.CURRENT, inp);
              yield gf(cells, inp, { line: 3, note: 'the two searches met', stats: { visited: popped, 'from S': fromStart.size, 'from G': fromGoal.size } });

              const path = [];
              let node = nb;
              while (node != null) { path.push(node); node = fromStart.get(node); }
              path.reverse();
              node = fromGoal.get(nb);
              while (node != null) { path.push(node); node = fromGoal.get(node); }

              for (const p of path) {
                mark(cells, p, CELL.PATH, inp);
                yield gf(cells, inp, { note: 'joining the two halves', stats: { visited: popped, 'path length': path.length - 1 } });
              }
              yield gf(cells, inp, {
                note: `done — ${path.length - 1} steps, and only ${popped} cells explored`,
                stats: { visited: popped, 'path length': path.length - 1 },
              });
              return;
            }
            mark(cells, nb, CELL.FRONTIER, inp);
            nextLayer.push(nb);
          }
        }
        yield gf(cells, inp, {
          line: who === 'S' ? 0 : 1,
          note: `expanded the search growing from ${who}`,
          stats: { visited: popped, 'from S': fromStart.size, 'from G': fromGoal.size },
        });
        if (who === 'S') qa = nextLayer; else qb = nextLayer;
        if (!nextLayer.length) break;
      }
    }
    yield* noPath(cells, inp, { visited: popped });
  },
};

export const PATHFINDING = [bfs, dfs, dijkstra, astar, greedy, bidirectional];
