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

/**
 * The algorithm most people should reach for in each category, and why.
 *
 * "Best" is not the same as "fastest on paper" — it is the one whose
 * trade-offs suit the most situations. Where two genuinely split the job
 * between them, both are marked.
 */
export const PICKS = {
  'timsort':        'What Python, Java and Swift actually use. O(n log n) guaranteed, stable, and it exploits runs that are already in order — so real-world data, which is rarely shuffled, sorts far faster than the worst case suggests.',
  'quick':          'Usually the fastest in practice despite an O(n²) worst case: it sorts in place with excellent cache behaviour and a very tight inner loop. Pick it when memory matters and the data is not adversarial.',
  'binary':         'Twenty steps to search a million items instead of a million. The cost is that the data must be sorted first — but if you search more than a handful of times, sorting once pays for itself immediately.',
  'grid-astar':     'Dijkstra with a sense of direction. Still guaranteed to find the shortest path, but it aims at the goal instead of spreading in all directions, so it explores a fraction of the cells.',
  'graph-dijkstra': 'The standard answer for shortest paths with varying costs. O(E log V) with a heap, and correct for any graph without negative edges — which is nearly all of them.',
  'avl-insert':     'Strictly balanced, so lookups are as fast as a binary search tree can offer. Choose it when you read far more often than you write.',
  'rb-insert':      'Rebalances with fewer rotations than AVL, so writes are cheaper. This is why std::map, Java TreeMap and the Linux scheduler all use it. Choose it when you write as often as you read.',
  'dp-lcs':         'The clearest example of the whole technique: a two-dimensional table, an obvious recurrence, and a real use — it is the engine inside diff and every "what changed?" view.',
  'str-kmp':        'Linear time with no worst case to worry about, because it never re-reads a character of the text. Boyer-Moore is usually faster on ordinary prose, but KMP never degrades.',
  'str-boyer-moore':'Fastest in practice on natural text — it reads right to left and can skip a whole pattern width at a time, so longer patterns actually search faster. This is roughly what your editor\'s find does.',
  'maze-backtracker':'Produces the most satisfying mazes to solve: long winding corridors and few dead ends, because it always tunnels as deep as it can before retreating.',
  'bt-hanoi':       'The clearest demonstration of recursion in the whole collection — three lines of logic, a provably optimal 2\u207f\u22121 moves, and you can see the self-similar structure in the animation.',
};

export const ALL = CATEGORIES.flatMap((c) =>
  c.algorithms.map((a) => ({
    ...a,
    category: c.id,
    categoryName: c.name,
    pick: PICKS[a.id] || null,
  }))
);

export function findAlgo(id) {
  return ALL.find((a) => a.id === id);
}
