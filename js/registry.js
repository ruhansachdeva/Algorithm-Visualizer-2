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
import { BACKTRACKING } from './algorithms/backtracking/index.js';
import { MAZES } from './algorithms/graphs/maze.js';

import { drawArray } from './views/array-view.js';
import { drawGrid, cellAt } from './views/grid-view.js';
import { drawGraph } from './views/graph-view.js';
import { drawTree } from './views/tree-view.js';
import { drawTable } from './views/table-view.js';
import { drawString } from './views/string-view.js';
import { drawQueens, drawSudoku, drawHanoi } from './views/puzzle-view.js';

/**
 * Each category gets a colour and a one-line description. The colour is
 * what makes the sidebar scannable — you learn where "the green ones" are
 * without reading the headings.
 */
export const CATEGORIES = [
  { id: 'sorting',     name: 'Sorting',     color: '#4da3ff', blurb: 'Putting a list in order', algorithms: SORTING },
  { id: 'searching',   name: 'Searching',   color: '#3ddc84', blurb: 'Finding one value in a list', algorithms: SEARCHING },
  { id: 'pathfinding', name: 'Pathfinding', color: '#ffc53d', blurb: 'Shortest route across a board', algorithms: PATHFINDING },
  { id: 'graphs',      name: 'Graphs',      color: '#c678dd', blurb: 'Networks of nodes and edges', algorithms: GRAPHS },
  { id: 'trees',       name: 'Trees',       color: '#2dd4bf', blurb: 'Hierarchies, and how they stay balanced', algorithms: TREES },
  { id: 'dp',          name: 'Dynamic Programming', color: '#ff8c42', blurb: 'Solving each subproblem once', algorithms: DP },
  { id: 'strings',     name: 'String Matching', color: '#f472b6', blurb: 'Finding a pattern inside text', algorithms: STRINGS },
  { id: 'backtracking', name: 'Backtracking', color: '#a3e635', blurb: 'Try, fail, undo, try again', algorithms: BACKTRACKING },
  { id: 'mazes',       name: 'Maze Generation', color: '#8b96a5', blurb: 'Building a board to solve', algorithms: MAZES },
];

/** view name -> the function that paints a frame of that kind */
export const VIEWS = {
  array: drawArray,
  grid: drawGrid,
  graph: drawGraph,
  tree: drawTree,
  table: drawTable,
  string: drawString,
  queens: drawQueens,
  sudoku: drawSudoku,
  hanoi: drawHanoi,
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
