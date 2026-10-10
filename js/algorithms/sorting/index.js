/* ============================================================
   SORTING ALGORITHMS
   ------------------------------------------------------------
   Each one is a generator: it runs the real algorithm, and every
   `yield` hands back a picture of the array mid-flight.

   Read any `run` function top to bottom and you're reading the
   actual algorithm — the yields are the only extra.
   ============================================================ */

import { newState, snap, swapIn, allSorted } from '../util.js';
const base = { view: 'array', input: 'array' };

/* ───────────────────────── Bubble ───────────────────────── */

const bubble = {
  ...base,
  id: 'bubble',
  name: 'Bubble Sort',
  about: 'Walks the list over and over, swapping any two neighbours that are out of order. Big values "bubble" to the end one pass at a time. After pass k the last k items are guaranteed correct, so each pass can stop a little earlier.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: [
    'repeat until no swaps happen:',
    '  for each neighbouring pair a, b:',
    '    if a > b: swap them',
    '  the last item is now in place',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;

    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;

      for (let j = 0; j < n - 1 - pass; j++) {
        st.stats.comparisons++;
        yield snap(arr, st, {
          compare: [j, j + 1], line: 1,
          note: `is ${arr[j]} > ${arr[j + 1]}?`,
        });

        if (arr[j] > arr[j + 1]) {
          swapIn(arr, j, j + 1, st);
          swapped = true;
          yield snap(arr, st, {
            swap: [j, j + 1], line: 2,
            note: `yes — swapped`,
          });
        }
      }

      st.sorted.add(n - 1 - pass);
      yield snap(arr, st, { line: 3, note: `pass ${pass + 1} done — ${arr[n - 1 - pass]} is in place` });

      // Already sorted: a pass with zero swaps means we can stop.
      if (!swapped) {
        yield allSorted(arr, st, 'a full pass with no swaps — already sorted');
        return;
      }
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────── Cocktail Shaker ─────────────────── */

const cocktail = {
  ...base,
  id: 'cocktail',
  name: 'Cocktail Shaker Sort',
  about: 'Bubble sort that alternates direction: one pass pushes the largest value right, the next pass drags the smallest value left. The back-and-forth fixes bubble sort\'s weakness with small values stranded near the end.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: [
    'repeat until no swaps:',
    '  sweep left → right, swapping out-of-order pairs',
    '  sweep right → left, swapping out-of-order pairs',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    let lo = 0, hi = arr.length - 1, swapped = true;

    while (swapped && lo < hi) {
      swapped = false;

      for (let i = lo; i < hi; i++) {
        st.stats.comparisons++;
        yield snap(arr, st, { compare: [i, i + 1], range: [lo, hi], line: 1, note: `→ is ${arr[i]} > ${arr[i + 1]}?` });
        if (arr[i] > arr[i + 1]) {
          swapIn(arr, i, i + 1, st);
          swapped = true;
          yield snap(arr, st, { swap: [i, i + 1], range: [lo, hi], line: 1, note: 'swapped' });
        }
      }
      st.sorted.add(hi--);

      for (let i = hi; i > lo; i--) {
        st.stats.comparisons++;
        yield snap(arr, st, { compare: [i - 1, i], range: [lo, hi], line: 2, note: `← is ${arr[i - 1]} > ${arr[i]}?` });
        if (arr[i - 1] > arr[i]) {
          swapIn(arr, i - 1, i, st);
          swapped = true;
          yield snap(arr, st, { swap: [i - 1, i], range: [lo, hi], line: 2, note: 'swapped' });
        }
      }
      st.sorted.add(lo++);
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Selection ───────────────────── */

const selection = {
  ...base,
  id: 'selection',
  name: 'Selection Sort',
  about: 'Scans the unsorted part for the smallest value, then swaps it into the front. Does the fewest swaps of any simple sort — exactly n-1 — which matters when moving an item is expensive. Comparisons stay O(n²) no matter how sorted the input already is.',
  cost: { best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'for each position i from left to right:',
    '  find the smallest value in the rest of the list',
    '  swap it into position i',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;

    for (let i = 0; i < n - 1; i++) {
      let min = i;
      yield snap(arr, st, { cursor: i, pivot: min, range: [i, n - 1], line: 0, note: `filling position ${i}` });

      for (let j = i + 1; j < n; j++) {
        st.stats.comparisons++;
        yield snap(arr, st, {
          cursor: i, pivot: min, compare: [j], range: [i, n - 1], line: 1,
          note: `is ${arr[j]} < ${arr[min]} (smallest so far)?`,
        });
        if (arr[j] < arr[min]) {
          min = j;
          yield snap(arr, st, { cursor: i, pivot: min, range: [i, n - 1], line: 1, note: `new smallest: ${arr[min]} at ${min}` });
        }
      }

      if (min !== i) {
        swapIn(arr, i, min, st);
        yield snap(arr, st, { swap: [i, min], line: 2, note: `swapped ${arr[i]} into position ${i}` });
      }
      st.sorted.add(i);
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Insertion ───────────────────── */

const insertion = {
  ...base,
  id: 'insertion',
  name: 'Insertion Sort',
  about: 'Builds a sorted region on the left, one item at a time. Each new item slides left past everything bigger than it, like sorting a hand of cards. Genuinely fast on small or nearly-sorted data, which is why real libraries fall back to it for short runs.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: [
    'for each item after the first:',
    '  hold it aside',
    '  slide bigger neighbours one slot right',
    '  drop the held item into the gap',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    st.sorted.add(0);

    for (let i = 1; i < arr.length; i++) {
      const key = arr[i];
      let j = i - 1;
      yield snap(arr, st, { cursor: i, line: 1, note: `holding ${key}, looking for its spot` });

      while (j >= 0) {
        st.stats.comparisons++;
        yield snap(arr, st, { compare: [j], cursor: i, line: 2, note: `is ${arr[j]} > ${key}?` });
        if (arr[j] <= key) break;

        arr[j + 1] = arr[j];
        st.stats.writes++;
        yield snap(arr, st, { swap: [j, j + 1], line: 2, note: `shifted ${arr[j + 1]} right` });
        j--;
      }

      arr[j + 1] = key;
      st.stats.writes++;
      st.sorted.add(i);
      yield snap(arr, st, { swap: [j + 1], line: 3, note: `dropped ${key} at position ${j + 1}` });
    }
    yield allSorted(arr, st);
  },
};

/* ────────────────── Binary Insertion Sort ──────────────── */

const binaryInsertion = {
  ...base,
  id: 'binary-insertion',
  name: 'Binary Insertion Sort',
  about: 'Insertion sort, but it binary-searches the sorted region for the landing spot instead of comparing one neighbour at a time. That cuts comparisons to O(n log n) — but it still has to shift every item over, so the total work stays O(n²).',
  cost: { best: 'O(n log n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: [
    'for each item after the first:',
    '  binary search the sorted part for where it goes',
    '  shift everything from there onward right',
    '  place the item',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    st.sorted.add(0);

    for (let i = 1; i < arr.length; i++) {
      const key = arr[i];
      let lo = 0, hi = i - 1, pos = i;
      yield snap(arr, st, { cursor: i, range: [0, i - 1], line: 1, note: `where does ${key} go?` });

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        st.stats.comparisons++;
        yield snap(arr, st, { cursor: i, compare: [mid], range: [lo, hi], line: 1, note: `compare with ${arr[mid]}` });
        if (arr[mid] > key) { pos = mid; hi = mid - 1; }
        else lo = mid + 1;
      }
      pos = lo;

      for (let j = i - 1; j >= pos; j--) {
        arr[j + 1] = arr[j];
        st.stats.writes++;
        yield snap(arr, st, { swap: [j, j + 1], line: 2, note: 'shifting right' });
      }
      arr[pos] = key;
      st.stats.writes++;
      st.sorted.add(i);
      yield snap(arr, st, { swap: [pos], line: 3, note: `placed ${key} at ${pos}` });
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Shell ───────────────────────── */

const shell = {
  ...base,
  id: 'shell',
  name: 'Shell Sort',
  about: 'Insertion sort on items spaced far apart, then on closer and closer spacings, finishing with a normal gap-1 pass. The early wide passes move items most of the way home cheaply, so the final pass has almost nothing left to do.',
  cost: { best: 'O(n log n)', avg: '≈O(n^1.3)', worst: 'O(n²)', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'gap = n / 2',
    'while gap >= 1:',
    '  insertion-sort items that are `gap` apart',
    '  gap = gap / 2',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;

    for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
      yield snap(arr, st, { line: 2, note: `gap = ${gap}` });

      for (let i = gap; i < n; i++) {
        const key = arr[i];
        let j = i;
        yield snap(arr, st, { cursor: i, line: 2, note: `holding ${key} (gap ${gap})` });

        while (j >= gap) {
          st.stats.comparisons++;
          yield snap(arr, st, { compare: [j - gap, j], cursor: i, line: 2, note: `is ${arr[j - gap]} > ${key}?` });
          if (arr[j - gap] <= key) break;
          arr[j] = arr[j - gap];
          st.stats.writes++;
          yield snap(arr, st, { swap: [j - gap, j], line: 2, note: `moved ${arr[j]} right by ${gap}` });
          j -= gap;
        }
        arr[j] = key;
        st.stats.writes++;
      }
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Comb ────────────────────────── */

const comb = {
  ...base,
  id: 'comb',
  name: 'Comb Sort',
  about: 'Bubble sort with a shrinking gap. Comparing distant pairs first kills off "turtles" — small values near the end that bubble sort would take forever to drag home. The gap shrinks by about 1.3× each round until it hits 1.',
  cost: { best: 'O(n log n)', avg: 'O(n² / 2^p)', worst: 'O(n²)', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'gap = n',
    'repeat:',
    '  gap = max(1, gap / 1.3)',
    '  compare & swap every pair `gap` apart',
    'until gap == 1 and no swaps happened',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;
    let gap = n, swapped = true;

    while (gap > 1 || swapped) {
      gap = Math.max(1, Math.floor(gap / 1.3));
      swapped = false;
      yield snap(arr, st, { line: 2, note: `gap = ${gap}` });

      for (let i = 0; i + gap < n; i++) {
        st.stats.comparisons++;
        yield snap(arr, st, { compare: [i, i + gap], line: 3, note: `is ${arr[i]} > ${arr[i + gap]}?` });
        if (arr[i] > arr[i + gap]) {
          swapIn(arr, i, i + gap, st);
          swapped = true;
          yield snap(arr, st, { swap: [i, i + gap], line: 3, note: 'swapped' });
        }
      }
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Gnome ───────────────────────── */

const gnome = {
  ...base,
  id: 'gnome',
  name: 'Gnome Sort',
  about: 'Imagine a garden gnome shuffling along a row of flower pots: if the pot behind is taller, swap and step back; otherwise step forward. One pointer, no nested loops, and it ends up doing roughly what insertion sort does.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: [
    'i = 0',
    'while i < n:',
    '  if i == 0 or arr[i-1] <= arr[i]: i = i + 1',
    '  else: swap(i-1, i); i = i - 1',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    let i = 0;

    while (i < arr.length) {
      if (i === 0) { i++; continue; }
      st.stats.comparisons++;
      yield snap(arr, st, { compare: [i - 1, i], cursor: i, line: 2, note: `is ${arr[i - 1]} <= ${arr[i]}?` });

      if (arr[i - 1] <= arr[i]) {
        i++;
        yield snap(arr, st, { cursor: Math.min(i, arr.length - 1), line: 2, note: 'in order — step forward' });
      } else {
        swapIn(arr, i - 1, i, st);
        yield snap(arr, st, { swap: [i - 1, i], line: 3, note: 'out of order — swap and step back' });
        i--;
      }
    }
    yield allSorted(arr, st);
  },
};

/* ──────────────────── Odd-Even (brick) ─────────────────── */

const oddEven = {
  ...base,
  id: 'odd-even',
  name: 'Odd-Even Sort',
  about: 'Alternates between comparing every even-indexed pair and every odd-indexed pair. Within a phase no two comparisons touch the same element, so all of them could run at the same time — which is why this shape is used on parallel hardware.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'Yes' },
  pseudocode: [
    'repeat until a full round makes no swaps:',
    '  compare/swap pairs (0,1) (2,3) (4,5) …',
    '  compare/swap pairs (1,2) (3,4) (5,6) …',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;
    let sorted = false;

    while (!sorted) {
      sorted = true;
      for (const start of [0, 1]) {
        for (let i = start; i + 1 < n; i += 2) {
          st.stats.comparisons++;
          yield snap(arr, st, {
            compare: [i, i + 1], line: start + 1,
            note: `${start === 0 ? 'even' : 'odd'} phase — is ${arr[i]} > ${arr[i + 1]}?`,
          });
          if (arr[i] > arr[i + 1]) {
            swapIn(arr, i, i + 1, st);
            sorted = false;
            yield snap(arr, st, { swap: [i, i + 1], line: start + 1, note: 'swapped' });
          }
        }
      }
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Merge ───────────────────────── */

const merge = {
  ...base,
  id: 'merge',
  name: 'Merge Sort',
  about: 'Splits the list in half, sorts each half, then zips the two sorted halves together. The merge only ever looks at the front of each half, so it runs in one linear pass. O(n log n) guaranteed on every input — but it needs a scratch array to merge into.',
  cost: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: 'Yes' },
  pseudocode: [
    'if the range has 0 or 1 items, it is already sorted',
    'split it down the middle',
    'merge-sort the left half',
    'merge-sort the right half',
    'merge the two sorted halves back together',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    yield* msort(arr, 0, arr.length - 1, st);
    yield allSorted(arr, st);
  },
};

function* msort(arr, lo, hi, st) {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;

  yield snap(arr, st, { range: [lo, hi], line: 1, note: `split [${lo}..${hi}] at ${mid}` });
  yield* msort(arr, lo, mid, st);
  yield* msort(arr, mid + 1, hi, st);
  yield* mergeRuns(arr, lo, mid, hi, st);
}

function* mergeRuns(arr, lo, mid, hi, st) {
  // Copy both halves out, then write the winners back in order.
  const left = arr.slice(lo, mid + 1);
  const right = arr.slice(mid + 1, hi + 1);
  let i = 0, j = 0, k = lo;

  yield snap(arr, st, { range: [lo, hi], line: 4, note: `merging [${lo}..${mid}] with [${mid + 1}..${hi}]` });

  while (i < left.length && j < right.length) {
    st.stats.comparisons++;
    const takeLeft = left[i] <= right[j];
    yield snap(arr, st, {
      range: [lo, hi], cursor: k, compare: [], line: 4,
      note: `${left[i]} vs ${right[j]} → take ${takeLeft ? left[i] : right[j]}`,
    });
    arr[k] = takeLeft ? left[i++] : right[j++];
    st.stats.writes++;
    yield snap(arr, st, { range: [lo, hi], swap: [k], line: 4, note: `wrote ${arr[k]} at ${k}` });
    k++;
  }

  // Whatever is left over is already in order — copy it straight across.
  while (i < left.length) {
    arr[k] = left[i++]; st.stats.writes++;
    yield snap(arr, st, { range: [lo, hi], swap: [k], line: 4, note: `left-over from left half: ${arr[k]}` });
    k++;
  }
  while (j < right.length) {
    arr[k] = right[j++]; st.stats.writes++;
    yield snap(arr, st, { range: [lo, hi], swap: [k], line: 4, note: `left-over from right half: ${arr[k]}` });
    k++;
  }

  if (lo === 0 && hi === arr.length - 1) for (let x = lo; x <= hi; x++) st.sorted.add(x);
  yield snap(arr, st, { range: [lo, hi], line: 4, note: `[${lo}..${hi}] is now sorted` });
}

/* ────────────────── Quick (Lomuto) ─────────────────────── */

const quick = {
  ...base,
  id: 'quick',
  name: 'Quick Sort',
  about: 'Picks a pivot, shuffles everything smaller to its left and bigger to its right, then repeats on each side. The pivot lands in its final home after one pass. Fastest general sort in practice — but a badly chosen pivot on already-sorted data degrades it to O(n²).',
  cost: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: 'No' },
  pseudocode: [
    'pick the last item as the pivot',
    'walk the range, keeping a boundary of "smaller than pivot"',
    'anything smaller gets swapped to the left of the boundary',
    'put the pivot right after the boundary — it is now final',
    'recurse on the left and right sides',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    yield* qsort(arr, 0, arr.length - 1, st);
    yield allSorted(arr, st);
  },
};

function* qsort(arr, lo, hi, st) {
  if (lo > hi) return;
  if (lo === hi) { st.sorted.add(lo); yield snap(arr, st, { note: `single item at ${lo} — done` }); return; }

  const p = yield* partition(arr, lo, hi, st);
  st.sorted.add(p);
  yield snap(arr, st, { pivot: p, line: 3, note: `pivot ${arr[p]} is home at ${p}` });

  yield* qsort(arr, lo, p - 1, st);
  yield* qsort(arr, p + 1, hi, st);
}

function* partition(arr, lo, hi, st) {
  const pivotVal = arr[hi];
  let boundary = lo;

  yield snap(arr, st, { range: [lo, hi], pivot: hi, line: 0, note: `pivot = ${pivotVal}` });

  for (let i = lo; i < hi; i++) {
    st.stats.comparisons++;
    yield snap(arr, st, {
      range: [lo, hi], pivot: hi, compare: [i], cursor: boundary, line: 1,
      note: `is ${arr[i]} < ${pivotVal}?`,
    });

    if (arr[i] < pivotVal) {
      if (i !== boundary) {
        swapIn(arr, i, boundary, st);
        yield snap(arr, st, { range: [lo, hi], pivot: hi, swap: [i, boundary], line: 2, note: 'smaller — move it left' });
      }
      boundary++;
    }
  }

  swapIn(arr, boundary, hi, st);
  yield snap(arr, st, { range: [lo, hi], swap: [boundary, hi], line: 3, note: `pivot into place at ${boundary}` });
  return boundary;
}

/* ──────────────── Quick (3-way / Dutch flag) ───────────── */

const quick3 = {
  ...base,
  id: 'quick-3way',
  name: 'Quick Sort (3-way)',
  about: 'Quicksort that splits into three regions — less than, equal to, and greater than the pivot — instead of two. All the duplicates land in the middle and are finished at once, so arrays with many repeated values sort in linear time instead of quadratic.',
  cost: { best: 'O(n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: 'No' },
  pseudocode: [
    'pivot = first item of the range',
    'keep three zones: < pivot, == pivot, > pivot',
    'scan, growing whichever zone the current item belongs to',
    'the == zone is finished; recurse on < and > only',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    yield* q3(arr, 0, arr.length - 1, st);
    yield allSorted(arr, st);
  },
};

function* q3(arr, lo, hi, st) {
  if (lo >= hi) { if (lo === hi) st.sorted.add(lo); return; }

  const pivotVal = arr[lo];
  let lt = lo, i = lo, gt = hi;
  yield snap(arr, st, { range: [lo, hi], pivot: lo, line: 0, note: `pivot = ${pivotVal}` });

  while (i <= gt) {
    st.stats.comparisons++;
    yield snap(arr, st, { range: [lo, hi], compare: [i], cursor: lt, line: 2, note: `${arr[i]} vs pivot ${pivotVal}` });

    if (arr[i] < pivotVal) {
      swapIn(arr, lt, i, st);
      yield snap(arr, st, { range: [lo, hi], swap: [lt, i], line: 2, note: 'smaller — goes left' });
      lt++; i++;
    } else if (arr[i] > pivotVal) {
      swapIn(arr, i, gt, st);
      yield snap(arr, st, { range: [lo, hi], swap: [i, gt], line: 2, note: 'bigger — goes right' });
      gt--;
    } else {
      yield snap(arr, st, { range: [lo, hi], pivot: i, line: 2, note: 'equal — stays put' });
      i++;
    }
  }

  for (let k = lt; k <= gt; k++) st.sorted.add(k);
  yield snap(arr, st, { range: [lo, hi], line: 3, note: `${gt - lt + 1} copies of ${pivotVal} are now final` });

  yield* q3(arr, lo, lt - 1, st);
  yield* q3(arr, gt + 1, hi, st);
}

/* ───────────────────────── Heap ────────────────────────── */

const heap = {
  ...base,
  id: 'heap',
  name: 'Heap Sort',
  about: 'Treats the array as a binary tree where every parent beats its children, so the largest value sits at index 0. Repeatedly swap that maximum to the end and repair the heap. O(n log n) worst case with no extra memory — the trade-off is poor cache behaviour from jumping around the array.',
  cost: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'build a max-heap: sift down from the last parent to the root',
    'repeat:',
    '  swap the root (the biggest) with the last unsorted slot',
    '  shrink the heap by one',
    '  sift the new root back down to where it belongs',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;

    yield snap(arr, st, { line: 0, note: 'building the max-heap' });
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      yield* siftDown(arr, i, n, st, 0);
    }
    yield snap(arr, st, { line: 0, note: `heap built — ${arr[0]} is the largest` });

    for (let end = n - 1; end > 0; end--) {
      swapIn(arr, 0, end, st);
      st.sorted.add(end);
      yield snap(arr, st, { swap: [0, end], line: 2, note: `moved ${arr[end]} to position ${end}` });
      yield* siftDown(arr, 0, end, st, 4);
    }
    yield allSorted(arr, st);
  },
};

function* siftDown(arr, root, size, st, lineNo) {
  while (true) {
    const left = 2 * root + 1;
    const right = 2 * root + 2;
    let biggest = root;

    if (left < size) {
      st.stats.comparisons++;
      yield snap(arr, st, { compare: [root, left], cursor: root, line: lineNo, note: `parent ${arr[root]} vs left child ${arr[left]}` });
      if (arr[left] > arr[biggest]) biggest = left;
    }
    if (right < size) {
      st.stats.comparisons++;
      yield snap(arr, st, { compare: [biggest, right], cursor: root, line: lineNo, note: `vs right child ${arr[right]}` });
      if (arr[right] > arr[biggest]) biggest = right;
    }

    if (biggest === root) {
      yield snap(arr, st, { cursor: root, line: lineNo, note: 'parent already wins — heap is fine here' });
      return;
    }
    swapIn(arr, root, biggest, st);
    yield snap(arr, st, { swap: [root, biggest], line: lineNo, note: `child was bigger — sift ${arr[biggest]} down` });
    root = biggest;
  }
}

/* ───────────────────────── Counting ────────────────────── */

const counting = {
  ...base,
  id: 'counting',
  name: 'Counting Sort',
  about: 'Doesn\'t compare anything. It tallies how many times each value appears, turns those tallies into running totals, then reads each item straight to its final index. Linear time — but it needs an array as wide as the range of values, so it only suits small integer ranges.',
  cost: { best: 'O(n + k)', avg: 'O(n + k)', worst: 'O(n + k)', space: 'O(n + k)', stable: 'Yes' },
  pseudocode: [
    'count how many of each value there are',
    'turn counts into running totals (prefix sums)',
    'walk the input backwards, placing each item at its total',
    'decrement that total so duplicates stack neatly',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    if (!arr.length) { yield snap(arr, st, { note: 'nothing to sort' }); return; }

    // Shift by the minimum so negative values work too.
    const min = Math.min(...arr), max = Math.max(...arr);
    const counts = new Array(max - min + 1).fill(0);
    const auxKeys = counts.map((_, i) => i + min);

    for (let i = 0; i < arr.length; i++) {
      counts[arr[i] - min]++;
      yield snap(arr, st, {
        cursor: i, line: 0,
        aux: { label: `counts (values ${min}..${max})`, values: [...counts], keys: auxKeys, highlight: arr[i] - min },
        note: `tallied ${arr[i]}`,
      });
    }

    for (let v = 1; v < counts.length; v++) {
      counts[v] += counts[v - 1];
      yield snap(arr, st, {
        line: 1,
        aux: { label: 'running totals', values: [...counts], keys: auxKeys, highlight: v },
        note: `running total up to ${v + min} is ${counts[v]}`,
      });
    }

    const out = new Array(arr.length);
    for (let i = arr.length - 1; i >= 0; i--) {
      const v = arr[i];
      counts[v - min]--;
      out[counts[v - min]] = v;
      st.stats.writes++;
      yield snap(arr, st, {
        cursor: i, line: 2,
        aux: { label: 'running totals', values: [...counts], keys: auxKeys, highlight: v - min },
        note: `${v} belongs at index ${counts[v - min]}`,
      });
    }

    for (let i = 0; i < out.length; i++) {
      arr[i] = out[i];
      st.sorted.add(i);
      yield snap(arr, st, { swap: [i], line: 3, note: `copied ${arr[i]} back` });
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Radix ───────────────────────── */

const radix = {
  ...base,
  id: 'radix',
  name: 'Radix Sort (LSD)',
  about: 'Sorts by the ones digit, then the tens, then the hundreds. Because each pass is stable, earlier passes survive later ones and the array ends fully sorted. No value comparisons at all — cost depends on the number of digits, not on how jumbled the input is.',
  cost: { best: 'O(d·n)', avg: 'O(d·n)', worst: 'O(d·n)', space: 'O(n + k)', stable: 'Yes' },
  pseudocode: [
    'for each digit position, least significant first:',
    '  bucket every item by that digit (0–9)',
    '  read the buckets back out in order',
    'after the last digit the array is sorted',
  ],
  *run({ array }) {
    let arr = array.slice();
    const st = newState();
    if (!arr.length) { yield snap(arr, st, { note: 'nothing to sort' }); return; }

    // Offset so every value is non-negative; undone at the end.
    const min = Math.min(...arr, 0);
    if (min < 0) arr = arr.map((v) => v - min);

    const max = Math.max(...arr);
    for (let place = 1; place <= max || place === 1; place *= 10) {
      const buckets = Array.from({ length: 10 }, () => []);
      yield snap(arr.map((v) => v + min), st, { line: 0, note: `sorting by the ${placeName(place)} digit` });

      for (let i = 0; i < arr.length; i++) {
        const d = Math.floor(arr[i] / place) % 10;
        buckets[d].push(arr[i]);
        yield snap(arr.map((v) => v + min), st, {
          cursor: i, line: 1,
          aux: { label: 'buckets 0–9 (sizes)', values: buckets.map((b) => b.length), keys: [0,1,2,3,4,5,6,7,8,9], highlight: d },
          note: `${arr[i] + min} → bucket ${d}`,
        });
      }

      let k = 0;
      for (let d = 0; d < 10; d++) {
        for (const v of buckets[d]) {
          arr[k] = v;
          st.stats.writes++;
          yield snap(arr.map((x) => x + min), st, {
            swap: [k], line: 2,
            aux: { label: 'buckets 0–9 (sizes)', values: buckets.map((b) => b.length), keys: [0,1,2,3,4,5,6,7,8,9], highlight: d },
            note: `read ${v + min} back from bucket ${d}`,
          });
          k++;
        }
      }
      if (place > max) break;
    }

    const final = arr.map((v) => v + min);
    for (let i = 0; i < final.length; i++) st.sorted.add(i);
    yield snap(final, st, { line: 3, note: 'every digit processed — sorted' });
  },
};

function placeName(p) {
  return { 1: 'ones', 10: 'tens', 100: 'hundreds', 1000: 'thousands' }[p] || `${p}s`;
}

/* ───────────────────────── Bucket ──────────────────────── */

const bucket = {
  ...base,
  id: 'bucket',
  name: 'Bucket Sort',
  about: 'Spreads values into ordered buckets by range, sorts each bucket with insertion sort, then concatenates. Linear on average when the data is spread evenly — but if everything lands in one bucket it collapses to whatever the inner sort costs.',
  cost: { best: 'O(n + k)', avg: 'O(n + k)', worst: 'O(n²)', space: 'O(n + k)', stable: 'Yes' },
  pseudocode: [
    'make k empty buckets spanning the value range',
    'drop each item into the bucket its value falls in',
    'sort each bucket on its own',
    'concatenate the buckets left to right',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    if (!arr.length) { yield snap(arr, st, { note: 'nothing to sort' }); return; }

    const min = Math.min(...arr), max = Math.max(...arr);
    const count = Math.max(1, Math.min(10, Math.ceil(Math.sqrt(arr.length))));
    const span = (max - min + 1) / count;
    const buckets = Array.from({ length: count }, () => []);

    yield snap(arr, st, { line: 0, note: `${count} buckets across values ${min}..${max}` });

    for (let i = 0; i < arr.length; i++) {
      const b = Math.min(count - 1, Math.floor((arr[i] - min) / span));
      buckets[b].push(arr[i]);
      yield snap(arr, st, {
        cursor: i, line: 1,
        aux: { label: 'bucket sizes', values: buckets.map((x) => x.length), highlight: b },
        note: `${arr[i]} → bucket ${b}`,
      });
    }

    let k = 0;
    for (let b = 0; b < count; b++) {
      // plain insertion sort inside the bucket
      const bk = buckets[b];
      for (let i = 1; i < bk.length; i++) {
        const key = bk[i];
        let j = i - 1;
        while (j >= 0 && bk[j] > key) { st.stats.comparisons++; bk[j + 1] = bk[j]; j--; }
        bk[j + 1] = key;
      }
      if (bk.length) {
        yield snap(arr, st, {
          line: 2,
          aux: { label: 'bucket sizes', values: buckets.map((x) => x.length), highlight: b },
          note: `bucket ${b} sorted internally: [${bk.join(', ')}]`,
        });
      }

      for (const v of bk) {
        arr[k] = v;
        st.sorted.add(k);
        st.stats.writes++;
        yield snap(arr, st, { swap: [k], line: 3, note: `placed ${v}` });
        k++;
      }
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Cycle ───────────────────────── */

const cycleSort = {
  ...base,
  id: 'cycle',
  name: 'Cycle Sort',
  about: 'Works out exactly where each item belongs by counting how many values are smaller, then moves it straight there — displacing whatever sat in that slot, which then gets placed in turn. Does the theoretical minimum number of writes, which matters for memory that wears out from writing.',
  cost: { best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'for each starting position:',
    '  count smaller items to find where this value belongs',
    '  write it there, picking up whatever it displaced',
    '  repeat with the displaced value until the cycle closes',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;

    for (let start = 0; start < n - 1; start++) {
      let item = arr[start];
      let pos = start;

      yield snap(arr, st, { cursor: start, line: 0, note: `where does ${item} belong?` });
      for (let i = start + 1; i < n; i++) {
        st.stats.comparisons++;
        yield snap(arr, st, { cursor: start, compare: [i], line: 1, note: `is ${arr[i]} < ${item}?` });
        if (arr[i] < item) pos++;
      }

      if (pos === start) {
        yield snap(arr, st, { cursor: start, line: 1, note: `${item} is already home` });
        continue;
      }
      while (item === arr[pos]) pos++;   // skip past duplicates

      [arr[pos], item] = [item, arr[pos]];
      st.stats.writes++;
      yield snap(arr, st, { swap: [pos], line: 2, note: `wrote ${arr[pos]} at ${pos}, now holding ${item}` });

      // Keep going until the displaced value lands back at `start`.
      while (pos !== start) {
        pos = start;
        for (let i = start + 1; i < n; i++) {
          st.stats.comparisons++;
          if (arr[i] < item) pos++;
        }
        while (item === arr[pos]) pos++;
        if (item !== arr[pos]) {
          [arr[pos], item] = [item, arr[pos]];
          st.stats.writes++;
          yield snap(arr, st, { swap: [pos], line: 3, note: `wrote ${arr[pos]} at ${pos}, now holding ${item}` });
        }
      }
    }
    yield allSorted(arr, st);
  },
};

/* ───────────────────────── Pancake ─────────────────────── */

const pancake = {
  ...base,
  id: 'pancake',
  name: 'Pancake Sort',
  about: 'The only move allowed is flipping a prefix of the array, like righting a stack of pancakes with a spatula. To place the largest value: flip it to the front, then flip the whole unsorted prefix so it lands at the back.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'for size = n down to 2:',
    '  find the biggest item in the first `size` items',
    '  flip the prefix up to it — it is now at the front',
    '  flip the whole prefix of `size` — it lands at the back',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();

    for (let size = arr.length; size > 1; size--) {
      let maxIdx = 0;
      for (let i = 1; i < size; i++) {
        st.stats.comparisons++;
        yield snap(arr, st, { compare: [i], pivot: maxIdx, range: [0, size - 1], line: 1, note: `biggest so far: ${arr[maxIdx]}` });
        if (arr[i] > arr[maxIdx]) maxIdx = i;
      }
      if (maxIdx !== size - 1) {
        if (maxIdx !== 0) {
          yield snap(arr, st, { range: [0, maxIdx], line: 2, note: `flip the first ${maxIdx + 1} to bring ${arr[maxIdx]} to the front` });
          yield* flip(arr, maxIdx, st, 2);
        }
        yield snap(arr, st, { range: [0, size - 1], line: 3, note: `flip the first ${size} to send ${arr[0]} to the back` });
        yield* flip(arr, size - 1, st, 3);
      }
      st.sorted.add(size - 1);
    }
    yield allSorted(arr, st);
  },
};

function* flip(arr, end, st, lineNo) {
  let i = 0, j = end;
  while (i < j) {
    swapIn(arr, i, j, st);
    yield snap(arr, st, { swap: [i, j], range: [0, end], line: lineNo, note: 'flipping…' });
    i++; j--;
  }
}

/* ───────────────────────── Bogo ────────────────────────── */

const bogo = {
  ...base,
  id: 'bogo',
  name: 'Bogo Sort',
  about: 'Shuffle the array at random. Check if it happens to be sorted. If not, shuffle again. Included because it is the clearest possible illustration of why we bother with the other sorts — expected time is O(n·n!), so 10 items averages around 36 million shuffles.',
  cost: { best: 'O(n)', avg: 'O(n·n!)', worst: '∞', space: 'O(1)', stable: 'No' },
  pseudocode: [
    'while the array is not sorted:',
    '  shuffle it at random',
    '(this is a joke, but a useful one)',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const LIMIT = 15000;     // give up before the heat death of the universe
    let rounds = 0;

    const isSorted = () => {
      for (let i = 0; i + 1 < arr.length; i++) {
        st.stats.comparisons++;
        if (arr[i] > arr[i + 1]) return false;
      }
      return true;
    };

    while (!isSorted()) {
      if (++rounds > LIMIT) {
        yield snap(arr, st, { note: `gave up after ${LIMIT.toLocaleString()} shuffles — told you so` });
        return;
      }
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        swapIn(arr, i, j, st);
      }
      yield snap(arr, st, { line: 1, note: `shuffle #${rounds} — not sorted` });
    }
    yield allSorted(arr, st, `sorted by sheer luck after ${rounds} shuffle${rounds === 1 ? '' : 's'}`);
  },
};


/* ───────────────────────── Timsort ─────────────────────── */

/* Real Timsort uses 32 here. Lowered so that merging is visible on the
   small arrays this visualizer works with — with a threshold of 32, any
   array under 32 items would be sorted by one insertion pass and you
   would never see a merge. */
const MIN_MERGE = 8;

/**
 * Pick a run length so that the number of runs is at or just below a
 * power of two — which is what keeps the merges balanced.
 */
function minRunLength(n) {
  let r = 0;
  while (n >= MIN_MERGE) {
    r |= n & 1;
    n >>= 1;
  }
  return n + r;
}

const timsort = {
  ...base,
  id: 'timsort',
  name: 'Timsort',
  about: 'The sort actually used by Python, Java and Swift. It is built on the observation that real data is rarely shuffled — it arrives in already-ordered stretches. Timsort finds those natural runs, extends the short ones with insertion sort, and merges them in an order that keeps the merges balanced. On already-sorted input it finds one run and stops in a single pass.',
  cost: { best: 'O(n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: 'Yes' },
  pseudocode: [
    'scan for a natural run — a stretch already in order',
    '  (a descending stretch is reversed, which keeps the sort stable)',
    'if the run is shorter than minrun, extend it with insertion sort',
    'push the run on a stack',
    'merge stack neighbours whenever the size rules are broken',
    'at the end, merge whatever is left',
  ],
  *run({ array }) {
    const arr = array.slice();
    const st = newState();
    const n = arr.length;
    if (n < 2) { yield allSorted(arr, st); return; }

    const minrun = minRunLength(n);
    let natural = 0, merges = 0;
    const stats = () => ({ ...st.stats, 'natural runs': natural, merges });

    yield snap(arr, st, { line: 0, note: `${n} items — minimum run length is ${minrun}`, stats: stats() });

    /** Stack of runs, each { start, length }. */
    const runs = [];

    let i = 0;
    while (i < n) {
      /* ── find how far the data is already in order ── */
      let end = i + 1;
      let descending = false;

      if (end < n) {
        st.stats.comparisons++;
        descending = arr[end] < arr[end - 1];
        end++;
        if (descending) {
          while (end < n) {
            st.stats.comparisons++;
            if (arr[end] >= arr[end - 1]) break;
            end++;
          }
        } else {
          while (end < n) {
            st.stats.comparisons++;
            if (arr[end] < arr[end - 1]) break;
            end++;
          }
        }
      }

      let len = end - i;
      natural++;
      yield snap(arr, st, {
        range: [i, end - 1], line: 0,
        note: `found a ${descending ? 'descending' : 'ascending'} run of ${len} already in order`,
        stats: stats(),
      });

      /* ── a descending run is reversed, never sorted ── */
      if (descending) {
        let lo = i, hi = end - 1;
        while (lo < hi) {
          swapIn(arr, lo, hi, st);
          yield snap(arr, st, { range: [i, end - 1], swap: [lo, hi], line: 1, note: 'reversing it — cheaper than sorting, and keeps equal items in order', stats: stats() });
          lo++; hi--;
        }
      }

      /* ── too short? insertion-sort more items onto the end ── */
      if (len < minrun) {
        const want = Math.min(minrun, n - i);
        yield snap(arr, st, { range: [i, i + want - 1], line: 2, note: `only ${len} long — extending to ${want} with insertion sort`, stats: stats() });

        for (let k = i + len; k < i + want; k++) {
          const key = arr[k];
          let j = k - 1;
          while (j >= i) {
            st.stats.comparisons++;
            yield snap(arr, st, { range: [i, i + want - 1], compare: [j], cursor: k, line: 2, note: `is ${arr[j]} > ${key}?`, stats: stats() });
            if (arr[j] <= key) break;
            arr[j + 1] = arr[j];
            st.stats.writes++;
            j--;
          }
          arr[j + 1] = key;
          st.stats.writes++;
          yield snap(arr, st, { range: [i, i + want - 1], swap: [j + 1], line: 2, note: `placed ${key}`, stats: stats() });
        }
        len = want;
      }

      runs.push({ start: i, length: len });
      yield snap(arr, st, {
        range: [i, i + len - 1], line: 3,
        note: `run of ${len} pushed — stack is now [${runs.map((r) => r.length).join(', ')}]`,
        stats: stats(),
      });
      i += len;

      /* ── keep the stack balanced ── */
      yield* collapse(false);
    }

    /* ── merge whatever is left ── */
    yield* collapse(true);

    // Closing frame keeps the run/merge counters, which are the whole story
    // here — allSorted() would carry only the generic ones.
    for (let k = 0; k < n; k++) st.sorted.add(k);
    yield snap(arr, st, {
      line: -1,
      note: `sorted — ${natural} natural run${natural === 1 ? '' : 's'} found, ${merges} merge${merges === 1 ? '' : 's'} performed`,
      stats: stats(),
    });

    /**
     * Timsort's stack rules: each run must be longer than the sum of the
     * two above it, and longer than the one above it. Breaking either one
     * triggers a merge, which is what keeps merge sizes similar.
     */
    function* collapse(force) {
      while (runs.length > 1) {
        let k = runs.length - 2;

        if (!force) {
          const a = runs[k - 1], b = runs[k], c = runs[k + 1];
          if (k > 0 && a.length <= b.length + c.length) {
            if (a.length < c.length) k--;
          } else if (b.length <= c.length) {
            // merge at k
          } else break;
        } else if (k > 0 && runs[k - 1].length < runs[k + 1].length) {
          k--;
        }

        yield* mergeRuns(k);
      }
    }

    function* mergeRuns(k) {
      const left = runs[k], right = runs[k + 1];
      const lo = left.start, mid = lo + left.length - 1, hi = right.start + right.length - 1;
      merges++;

      yield snap(arr, st, {
        range: [lo, hi], line: 4,
        note: `merging runs of ${left.length} and ${right.length}`,
        stats: stats(),
      });

      const leftCopy = arr.slice(lo, mid + 1);
      const rightCopy = arr.slice(mid + 1, hi + 1);
      let a = 0, b = 0, w = lo;

      while (a < leftCopy.length && b < rightCopy.length) {
        st.stats.comparisons++;
        // <= keeps equal elements in their original order: the stable choice
        const takeLeft = leftCopy[a] <= rightCopy[b];
        arr[w] = takeLeft ? leftCopy[a++] : rightCopy[b++];
        st.stats.writes++;
        yield snap(arr, st, { range: [lo, hi], swap: [w], cursor: w, line: 4, note: `${takeLeft ? 'left' : 'right'} run wins with ${arr[w]}`, stats: stats() });
        w++;
      }
      while (a < leftCopy.length) {
        arr[w] = leftCopy[a++]; st.stats.writes++;
        yield snap(arr, st, { range: [lo, hi], swap: [w], line: 4, note: `rest of the left run: ${arr[w]}`, stats: stats() });
        w++;
      }
      while (b < rightCopy.length) {
        arr[w] = rightCopy[b++]; st.stats.writes++;
        yield snap(arr, st, { range: [lo, hi], swap: [w], line: 4, note: `rest of the right run: ${arr[w]}`, stats: stats() });
        w++;
      }

      runs.splice(k, 2, { start: lo, length: left.length + right.length });
      yield snap(arr, st, {
        range: [lo, hi], line: 4,
        note: `merged — stack is now [${runs.map((r) => r.length).join(', ')}]`,
        stats: stats(),
      });
    }
  },
};

export const SORTING = [
  bubble, cocktail, selection, insertion, binaryInsertion,
  shell, comb, gnome, oddEven,
  merge, timsort, quick, quick3, heap,
  counting, radix, bucket, cycleSort, pancake, bogo,
];
