/* Pathfinding: the algorithms that promise a SHORTEST path must agree with
   a plain breadth-first search. The ones that do not promise it (DFS,
   greedy) may be longer, but can never be shorter — that would mean the
   reference is wrong. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'pathfinding';

const OPTIMAL = new Set(['grid-bfs', 'grid-dijkstra', 'grid-astar', 'grid-bidirectional']);

function board(cols, rows, density) {
  const walls = new Set();
  const start = Math.floor(rows / 2) * cols + 1;
  const goal = Math.floor(rows / 2) * cols + (cols - 2);
  for (let i = 0; i < cols * rows; i++) {
    if (i !== start && i !== goal && Math.random() < density) walls.add(i);
  }
  return { cols, rows, walls, start, goal, weights: null, diagonal: false };
}

/** Ground truth: shortest step count, or null when the goal is walled off. */
function shortest(inp) {
  const queue = [inp.start];
  const dist = new Map([[inp.start, 0]]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur === inp.goal) return dist.get(cur);
    const x = cur % inp.cols, y = (cur / inp.cols) | 0;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= inp.cols || ny >= inp.rows) continue;
      const ni = ny * inp.cols + nx;
      if (inp.walls.has(ni) || dist.has(ni)) continue;
      dist.set(ni, dist.get(cur) + 1);
      queue.push(ni);
    }
  }
  return null;
}

export async function run() {
  reset();
  const { PATHFINDING } = await load('algorithms/graphs/grid.js');
  const { MAZES } = await load('algorithms/graphs/maze.js');
  const { record } = await load('engine/player.js');

  for (let trial = 0; trial < 30; trial++) {
    const inp = board(25, 13, 0.25);
    const truth = shortest(inp);

    for (const algo of PATHFINDING) {
      const copy = { ...inp, walls: new Set(inp.walls) };
      const last = record(algo.run(copy), 200000).at(-1);
      const reported = last.stats?.['path length'];
      const foundOne = reported !== undefined;

      if (truth === null) {
        check(!foundOne, `${algo.id} claimed a path across a board with none`);
      } else {
        check(foundOne, `${algo.id} missed a path of length ${truth}`);
        if (foundOne && OPTIMAL.has(algo.id)) {
          check(reported === truth, `${algo.id} returned ${reported} steps, shortest is ${truth}`);
        }
        if (foundOne && !OPTIMAL.has(algo.id)) {
          check(reported >= truth, `${algo.id} returned ${reported} steps, shorter than the true shortest ${truth}`);
        }
      }
    }
  }

  /* A generated maze has to be solvable, and has to write its walls back
     so the pathfinders can run on what you just watched being carved. */
  for (const algo of MAZES) {
    for (let trial = 0; trial < 5; trial++) {
      const inp = board(31, 15, 0);
      inp.walls = new Set();
      record(algo.run(inp), 200000);
      check(inp.walls.size > 0, `${algo.id} did not write its walls back into the board`);
      check(shortest(inp) !== null, `${algo.id} generated a maze with no route from S to G`);
    }
  }

  return tally();
}
