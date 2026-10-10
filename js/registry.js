/* ============================================================
   The catalogue — every algorithm in the app, grouped.
   Add a category here and it shows up in the sidebar.
   ============================================================ */

import { SORTING } from './algorithms/sorting/index.js';

import { drawArray } from './views/array-view.js';

export const CATEGORIES = [
  { id: 'sorting',     name: 'Sorting',     algorithms: SORTING },
];

/** view name -> the function that paints a frame of that kind */
export const VIEWS = {
  array: drawArray,
};

/** view name -> how a mouse maps onto that view (optional) */
export const HIT_TEST = {
};

export const ALL = CATEGORIES.flatMap((c) =>
  c.algorithms.map((a) => ({ ...a, category: c.id, categoryName: c.name }))
);

export function findAlgo(id) {
  return ALL.find((a) => a.id === id);
}
