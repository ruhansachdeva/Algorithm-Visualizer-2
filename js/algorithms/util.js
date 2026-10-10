/* ============================================================
   Shared helpers for writing algorithms as generators.
   ============================================================ */

/** Fresh bookkeeping for one run. */
export function newState() {
  return {
    sorted: new Set(),                                  // indices locked in place
    stats: { comparisons: 0, swaps: 0, writes: 0 },     // live counters
  };
}

/**
 * Build one frame: a copy of the array plus whatever is being highlighted.
 * The array MUST be copied — otherwise every stored frame would point at
 * the same array and the whole replay would show the final state.
 */
export function snap(arr, state, extra = {}) {
  return {
    array: arr.slice(),
    sorted: [...state.sorted],
    stats: { ...state.stats },
    ...extra,
  };
}

/** Swap two slots and count it. */
export function swapIn(arr, i, j, state) {
  const t = arr[i];
  arr[i] = arr[j];
  arr[j] = t;
  state.stats.swaps++;
  state.stats.writes += 2;
}

/** Mark the whole array finished — the closing frame of a sort. */
export function allSorted(arr, state, note = 'sorted') {
  for (let i = 0; i < arr.length; i++) state.sorted.add(i);
  return snap(arr, state, { note, line: -1 });
}

/** Shuffle in place (Fisher–Yates). */
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
