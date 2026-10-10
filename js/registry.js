/* ============================================================
   The catalogue — every algorithm in the app, grouped.
   Add a category here and it shows up in the sidebar.
   ============================================================ */

import { SORTING } from './algorithms/sorting/index.js';
import { SEARCHING } from './algorithms/searching/index.js';
import { PATHFINDING } from './algorithms/graphs/grid.js';
import { MAZES } from './algorithms/graphs/maze.js';

import { drawArray } from './views/array-view.js';
import { drawGrid, cellAt } from './views/grid-view.js';

export const CATEGORIES = [
  { id: 'sorting',     name: 'Sorting',     algorithms: SORTING },
  { id: 'searching',   name: 'Searching',   algorithms: SEARCHING },
  { id: 'pathfinding', name: 'Pathfinding', algorithms: PATHFINDING },
  { id: 'mazes',       name: 'Maze Generation', algorithms: MAZES },
];

/** view name -> the function that paints a frame of that kind */
export const VIEWS = {
  array: drawArray,
  grid: drawGrid,
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
