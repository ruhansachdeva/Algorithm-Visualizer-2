/* ============================================================
   The catalogue — every algorithm in the app, grouped.
   Add a category here and it shows up in the sidebar.
   ============================================================ */

import { SORTING } from './algorithms/sorting/index.js';
import { SEARCHING } from './algorithms/searching/index.js';
import { PATHFINDING } from './algorithms/graphs/grid.js';
import { GRAPHS } from './algorithms/graphs/graph.js';
import { TREES } from './algorithms/trees/index.js';
import { DP } from './algorithms/dp/index.js';
import { STRINGS } from './algorithms/strings/index.js';
import { MAZES } from './algorithms/graphs/maze.js';

import { drawArray } from './views/array-view.js';
import { drawGrid, cellAt } from './views/grid-view.js';
import { drawGraph } from './views/graph-view.js';
import { drawTree } from './views/tree-view.js';
import { drawTable } from './views/table-view.js';
import { drawString } from './views/string-view.js';

export const CATEGORIES = [
  { id: 'sorting',     name: 'Sorting',     algorithms: SORTING },
  { id: 'searching',   name: 'Searching',   algorithms: SEARCHING },
  { id: 'pathfinding', name: 'Pathfinding', algorithms: PATHFINDING },
  { id: 'graphs',      name: 'Graphs',      algorithms: GRAPHS },
  { id: 'trees',       name: 'Trees',       algorithms: TREES },
  { id: 'dp',          name: 'Dynamic Programming', algorithms: DP },
  { id: 'strings',     name: 'String Matching', algorithms: STRINGS },
  { id: 'mazes',       name: 'Maze Generation', algorithms: MAZES },
];

/** view name -> the function that paints a frame of that kind */
export const VIEWS = {
  array: drawArray,
  grid: drawGrid,
  graph: drawGraph,
  tree: drawTree,
  table: drawTable,
  string: drawString,
};

/** view name -> how a mouse maps onto that view (optional) */
export const HIT_TEST = {
  grid: cellAt,
};

export const ALL = CATEGORIES.flatMap((c) =>
  c.algorithms.map((a) => ({ ...a, category: c.id, categoryName: c.name }))
);

export function findAlgo(id) {
  return ALL.find((a) => a.id === id);
}
