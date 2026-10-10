/* ============================================================
   DYNAMIC PROGRAMMING
   ------------------------------------------------------------
   Every one of these follows the same recipe:

     1. find a way to describe a subproblem with a few numbers
     2. write the answer to a subproblem in terms of smaller ones
     3. fill the table in an order where the smaller ones are
        already written down

   The yellow cells in each frame are what the current cell is
   reading. That highlight IS the recurrence — if you only watch
   one thing, watch which cells light up yellow.
   ============================================================ */

import { TABLE_LEGEND } from '../../views/table-view.js';

const base = { view: 'table', legend: TABLE_LEGEND };

/** Blank table of nulls. */
const grid = (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(null));
const copy = (t) => t.map((row) => [...row]);

/* ───────────────────────── Fibonacci ───────────────────── */

const fib = {
  ...base,
  id: 'dp-fib',
  name: 'Fibonacci (memoised)',
  about: 'The smallest possible example of why DP exists. Computing fib(n) by naive recursion re-derives the same values an exponential number of times — fib(40) makes over 300 million calls. Writing each answer down once turns that into n additions. Same recurrence, same result, unimaginably different cost.',
  cost: { best: 'O(n)', avg: 'O(n)', worst: 'O(n)', space: 'O(n)', stable: '—' },
  input: 'dp-n',
  pseudocode: [
    'fib(0) = 0, fib(1) = 1',
    'for i from 2 to n:',
    '  fib(i) = fib(i-1) + fib(i-2)',
    'read the answer off the end of the table',
  ],
  *run({ n }) {
    const table = grid(1, n + 1);
    const labels = Array.from({ length: n + 1 }, (_, i) => i);
    const f = (extra) => ({
      table: copy(table), colLabels: labels, rowLabels: [''],
      colTitle: 'n', ...extra,
    });

    table[0][0] = 0;
    yield f({ current: [0, 0], line: 0, note: 'fib(0) = 0 — a base case, nothing to compute', stats: { additions: 0, 'naive calls avoided': 0 } });
    if (n >= 1) {
      table[0][1] = 1;
      yield f({ current: [0, 1], line: 0, note: 'fib(1) = 1 — the other base case', stats: { additions: 0, 'naive calls avoided': 0 } });
    }

    // How many calls the naive version would have made, for contrast.
    const naive = [1, 1];
    let additions = 0;

    for (let i = 2; i <= n; i++) {
      yield f({ current: [0, i], deps: [[0, i - 1], [0, i - 2]], line: 2, note: `fib(${i}) = fib(${i - 1}) + fib(${i - 2}) = ${table[0][i - 1]} + ${table[0][i - 2]}`, stats: { additions, 'naive calls avoided': naive[i - 1] + naive[i - 2] - 1 } });
      table[0][i] = table[0][i - 1] + table[0][i - 2];
      additions++;
      naive[i] = naive[i - 1] + naive[i - 2] + 1;
      yield f({ current: [0, i], line: 2, note: `fib(${i}) = ${table[0][i]} — written down, never recomputed`, stats: { additions, 'naive calls avoided': naive[i] - i } });
    }

    yield f({ path: [[0, n]], line: 3, note: `fib(${n}) = ${table[0][n]} in ${additions} additions; naive recursion would have made ${naive[n].toLocaleString()} calls`, stats: { additions, 'naive calls avoided': naive[n] - additions } });
  },
};

/* ───────────────────────── Knapsack ────────────────────── */

const knapsack = {
  ...base,
  id: 'dp-knapsack',
  name: '0/1 Knapsack',
  about: 'You have a bag with a weight limit and a pile of items, each with a weight and a value. Take each item or leave it — no halves. Every cell answers "using only the first i items, with a bag of capacity w, what is the best value?" and the choice is always the same two options: skip this item, or take it and add its value to the best solution for the remaining capacity.',
  cost: { best: 'O(n·W)', avg: 'O(n·W)', worst: 'O(n·W)', space: 'O(n·W)', stable: '—' },
  input: 'dp-knapsack',
  pseudocode: [
    'rows = items considered so far, columns = bag capacity',
    'for each item i and each capacity w:',
    '  skip it: best[i-1][w]',
    '  take it: value[i] + best[i-1][w - weight[i]]   (if it fits)',
    '  keep whichever is larger',
  ],
  *run({ items, capacity }) {
    const n = items.length;
    const table = grid(n + 1, capacity + 1);
    for (let w = 0; w <= capacity; w++) table[0][w] = 0;

    const rowLabels = ['—', ...items.map((it) => `${it.v}/${it.w}kg`)];
    const colLabels = Array.from({ length: capacity + 1 }, (_, i) => i);
    const f = (extra) => ({
      table: copy(table), rowLabels, colLabels,
      rowTitle: 'items available (value/weight)', colTitle: 'bag capacity',
      ...extra,
    });

    let comparisons = 0;
    yield f({ line: 0, note: 'row 0: with no items available, the best value is always 0', stats: { comparisons: 0, 'cells filled': capacity + 1 } });

    for (let i = 1; i <= n; i++) {
      const item = items[i - 1];
      for (let w = 0; w <= capacity; w++) {
        const skip = table[i - 1][w];
        const fits = item.w <= w;
        const take = fits ? item.v + table[i - 1][w - item.w] : -1;
        const deps = fits ? [[i - 1, w], [i - 1, w - item.w]] : [[i - 1, w]];
        comparisons++;

        yield f({
          current: [i, w], deps, line: 2,
          note: fits
            ? `capacity ${w}: skip → ${skip}, take the ${item.v}-value item → ${item.v} + ${table[i - 1][w - item.w]} = ${take}`
            : `capacity ${w}: the ${item.w}kg item doesn't fit, so carry ${skip} down`,
          stats: { comparisons, 'cells filled': i * (capacity + 1) + w },
        });

        table[i][w] = fits ? Math.max(skip, take) : skip;
        yield f({
          current: [i, w], line: 4,
          note: fits && take > skip ? `take it — best is now ${table[i][w]}` : `keep ${table[i][w]}`,
          stats: { comparisons, 'cells filled': i * (capacity + 1) + w + 1 },
        });
      }
    }

    // Walk back up to see which items were actually chosen.
    const path = [];
    const chosen = [];
    let w = capacity;
    for (let i = n; i > 0; i--) {
      path.push([i, w]);
      if (table[i][w] !== table[i - 1][w]) {
        chosen.push(items[i - 1]);
        w -= items[i - 1].w;
      }
    }
    path.push([0, w]);

    yield f({
      path, line: 4,
      note: `best value ${table[n][capacity]} — take ${chosen.length ? chosen.map((c) => `${c.v}/${c.w}kg`).join(' + ') : 'nothing'}`,
      stats: { comparisons, 'best value': table[n][capacity] },
    });
  },
};

/* ────────────── Longest Common Subsequence ─────────────── */

const lcs = {
  ...base,
  id: 'dp-lcs',
  name: 'Longest Common Subsequence',
  about: 'The longest sequence of characters appearing in both strings in the same order, though not necessarily next to each other. This is the core of `diff` and of every "what changed?" view in version control. When two characters match the answer grows diagonally; when they do not, it inherits the better of its two neighbours.',
  cost: { best: 'O(n·m)', avg: 'O(n·m)', worst: 'O(n·m)', space: 'O(n·m)', stable: '—' },
  input: 'dp-two-strings',
  pseudocode: [
    'rows = one string, columns = the other',
    'if the two characters match:',
    '  answer = 1 + the diagonal cell (both strings advance)',
    'if they differ:',
    '  answer = the better of the cell above and the cell to the left',
  ],
  *run({ a, b }) {
    const n = a.length, m = b.length;
    const table = grid(n + 1, m + 1);
    for (let i = 0; i <= n; i++) table[i][0] = 0;
    for (let j = 0; j <= m; j++) table[0][j] = 0;

    const rowLabels = ['—', ...a.split('')];
    const colLabels = ['—', ...b.split('')];
    const f = (extra) => ({ table: copy(table), rowLabels, colLabels, rowTitle: `"${a}"`, colTitle: `"${b}"`, ...extra });

    let matches = 0, comparisons = 0;
    yield f({ line: 0, note: 'an empty string shares nothing with anything — row 0 and column 0 are all zero', stats: { comparisons: 0, matches: 0 } });

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        comparisons++;
        const same = a[i - 1] === b[j - 1];

        yield f({
          current: [i, j],
          deps: same ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]],
          line: same ? 2 : 4,
          note: same
            ? `'${a[i - 1]}' = '${b[j - 1]}' — extend the diagonal: ${table[i - 1][j - 1]} + 1`
            : `'${a[i - 1]}' ≠ '${b[j - 1]}' — take the best of ${table[i - 1][j]} (above) and ${table[i][j - 1]} (left)`,
          stats: { comparisons, matches },
        });

        if (same) { table[i][j] = table[i - 1][j - 1] + 1; matches++; }
        else table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);

        yield f({ current: [i, j], line: same ? 2 : 4, note: `= ${table[i][j]}`, stats: { comparisons, matches } });
      }
    }

    // trace back to recover the actual subsequence
    const path = [];
    let out = '';
    let i = n, j = m;
    while (i > 0 && j > 0) {
      path.push([i, j]);
      if (a[i - 1] === b[j - 1]) { out = a[i - 1] + out; i--; j--; }
      else if (table[i - 1][j] >= table[i][j - 1]) i--;
      else j--;
    }

    yield f({ path, note: `longest common subsequence is "${out}" (length ${table[n][m]})`, stats: { comparisons, matches, length: table[n][m] } });
  },
};

/* ──────────────────── Edit Distance ────────────────────── */

const editDistance = {
  ...base,
  id: 'dp-edit-distance',
  name: 'Edit Distance',
  about: 'The fewest single-character insertions, deletions or substitutions that turn one string into the other — the number behind spell-checkers and fuzzy search. Each cell picks the cheapest of three repairs, so the three yellow cells are literally "delete", "insert" and "substitute".',
  cost: { best: 'O(n·m)', avg: 'O(n·m)', worst: 'O(n·m)', space: 'O(n·m)', stable: '—' },
  input: 'dp-two-strings',
  pseudocode: [
    'row 0 and column 0: cost of building from nothing',
    'if the characters match, cost = the diagonal (free)',
    'otherwise 1 + the cheapest of:',
    '  the cell above    (delete a character)',
    '  the cell left     (insert a character)',
    '  the diagonal      (substitute)',
  ],
  *run({ a, b }) {
    const n = a.length, m = b.length;
    const table = grid(n + 1, m + 1);

    const rowLabels = ['—', ...a.split('')];
    const colLabels = ['—', ...b.split('')];
    const f = (extra) => ({ table: copy(table), rowLabels, colLabels, rowTitle: `"${a}" →`, colTitle: `→ "${b}"`, ...extra });

    for (let i = 0; i <= n; i++) table[i][0] = i;
    for (let j = 0; j <= m; j++) table[0][j] = j;
    yield f({ line: 0, note: 'the edges are free: turning a string into nothing costs one deletion per character', stats: { comparisons: 0, substitutions: 0 } });

    let comparisons = 0, frees = 0;
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        comparisons++;
        const same = a[i - 1] === b[j - 1];
        const del = table[i - 1][j] + 1;
        const ins = table[i][j - 1] + 1;
        const sub = table[i - 1][j - 1] + (same ? 0 : 1);

        yield f({
          current: [i, j],
          deps: same ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1], [i - 1, j - 1]],
          line: same ? 1 : 2,
          note: same
            ? `'${a[i - 1]}' = '${b[j - 1]}' — no edit needed, copy the diagonal (${sub})`
            : `'${a[i - 1]}' ≠ '${b[j - 1]}' — delete ${del}, insert ${ins}, substitute ${sub}`,
          stats: { comparisons, 'free matches': frees },
        });

        if (same) frees++;
        table[i][j] = Math.min(del, ins, sub);
        yield f({ current: [i, j], line: same ? 1 : 2, note: `= ${table[i][j]}`, stats: { comparisons, 'free matches': frees } });
      }
    }

    const path = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      path.push([i, j]);
      if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) { i--; j--; }
      else if (i > 0 && table[i][j] === table[i - 1][j] + 1) i--;
      else j--;
    }
    path.push([0, 0]);

    yield f({ path, note: `"${a}" → "${b}" takes ${table[n][m]} edit${table[n][m] === 1 ? '' : 's'}`, stats: { comparisons, 'free matches': frees, distance: table[n][m] } });
  },
};

/* ────────────── Longest Increasing Subsequence ─────────── */

const lis = {
  ...base,
  id: 'dp-lis',
  name: 'Longest Increasing Subsequence',
  about: 'The longest run of values that increases left to right, allowing gaps. Each cell asks "what is the longest increasing run ENDING here?" and answers it by looking at every earlier value smaller than this one. The single-row table makes it a clear first example of a one-dimensional DP.',
  cost: { best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(n)', stable: '—' },
  input: 'dp-array',
  pseudocode: [
    'best[i] = longest increasing run that ENDS at i',
    'every single element is a run of 1 to start',
    'for each i, look at every earlier j:',
    '  if value[j] < value[i], the run through j can be extended',
    '  best[i] = max(best[i], best[j] + 1)',
  ],
  *run({ array }) {
    const n = array.length;
    const table = grid(2, n);
    const from = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) { table[0][i] = array[i]; table[1][i] = 1; }

    const f = (extra) => ({
      table: copy(table),
      rowLabels: ['value', 'run'],
      colLabels: Array.from({ length: n }, (_, i) => i),
      colTitle: 'index',
      ...extra,
    });

    let comparisons = 0;
    yield f({ line: 1, note: 'every element on its own is an increasing run of length 1', stats: { comparisons: 0, best: 1 } });

    for (let i = 1; i < n; i++) {
      for (let j = 0; j < i; j++) {
        comparisons++;
        yield f({
          current: [1, i], deps: [[0, j], [1, j], [0, i]], line: 3,
          note: `is ${array[j]} < ${array[i]}? ${array[j] < array[i] ? `yes — a run of ${table[1][j]} could extend to ${table[1][j] + 1}` : 'no — cannot extend'}`,
          stats: { comparisons, best: Math.max(...table[1]) },
        });
        if (array[j] < array[i] && table[1][j] + 1 > table[1][i]) {
          table[1][i] = table[1][j] + 1;
          from[i] = j;
          yield f({ current: [1, i], deps: [[1, j]], line: 4, note: `longest run ending at index ${i} is now ${table[1][i]}`, stats: { comparisons, best: Math.max(...table[1]) } });
        }
      }
    }

    let end = 0;
    for (let i = 1; i < n; i++) if (table[1][i] > table[1][end]) end = i;
    const path = [];
    const seq = [];
    for (let k = end; k !== -1; k = from[k]) { path.push([0, k], [1, k]); seq.unshift(array[k]); }

    yield f({ path, note: `longest increasing subsequence: ${seq.join(' < ')} (length ${table[1][end]})`, stats: { comparisons, best: table[1][end] } });
  },
};

/* ──────────────────────── Coin Change ──────────────────── */

const coinChange = {
  ...base,
  id: 'dp-coin-change',
  name: 'Coin Change',
  about: 'The fewest coins that add up to a target. Greedy — always grab the biggest coin that fits — works for ordinary currency but fails on sets like 1, 3, 4 where making 6 needs 3+3, not 4+1+1. DP tries every coin at every amount, so it is never fooled.',
  cost: { best: 'O(n·A)', avg: 'O(n·A)', worst: 'O(n·A)', space: 'O(A)', stable: '—' },
  input: 'dp-coins',
  pseudocode: [
    'best[0] = 0 coins to make nothing',
    'for each amount from 1 upward:',
    '  for each coin that is not bigger than the amount:',
    '    using it costs 1 + best[amount - coin]',
    '  keep the smallest',
  ],
  *run({ coins, amount }) {
    const table = grid(1, amount + 1);
    const pick = new Array(amount + 1).fill(-1);
    table[0][0] = 0;

    const f = (extra) => ({
      table: copy(table),
      rowLabels: ['coins'],
      colLabels: Array.from({ length: amount + 1 }, (_, i) => i),
      colTitle: `amount to make (coins: ${coins.join(', ')})`,
      ...extra,
    });

    let comparisons = 0;
    yield f({ current: [0, 0], line: 0, note: 'making 0 takes 0 coins', stats: { comparisons: 0 } });

    for (let a = 1; a <= amount; a++) {
      let best = Infinity;
      for (const c of coins) {
        if (c > a) continue;
        comparisons++;
        const prev = table[0][a - c];
        yield f({
          current: [0, a], deps: [[0, a - c]], line: 3,
          note: `use a ${c}: that leaves ${a - c}, which needs ${prev === Infinity ? 'no solution' : prev + ' coin' + (prev === 1 ? '' : 's')}`,
          stats: { comparisons },
        });
        if (prev !== Infinity && prev + 1 < best) { best = prev + 1; pick[a] = c; }
      }
      table[0][a] = best;
      yield f({ current: [0, a], line: 4, note: best === Infinity ? `${a} cannot be made from these coins` : `${a} takes ${best} coin${best === 1 ? '' : 's'}`, stats: { comparisons } });
    }

    const path = [];
    const used = [];
    let a = amount;
    while (a > 0 && pick[a] !== -1) { path.push([0, a]); used.push(pick[a]); a -= pick[a]; }
    path.push([0, 0]);

    const answer = table[0][amount];
    yield f({
      path,
      note: answer === Infinity
        ? `${amount} cannot be made from ${coins.join(', ')}`
        : `${amount} = ${used.join(' + ')} — ${answer} coin${answer === 1 ? '' : 's'}`,
      stats: { comparisons, 'coins needed': answer === Infinity ? '—' : answer },
    });
  },
};

/* ──────────────────────── Subset Sum ───────────────────── */

const subsetSum = {
  ...base,
  id: 'dp-subset-sum',
  name: 'Subset Sum',
  about: 'Can any subset of these numbers add up exactly to the target? A yes/no table instead of a numeric one, and the same skip-or-take choice as the knapsack. The problem is NP-complete in general, but this table solves it in O(n·target) — fast whenever the target is small, which is why that is called "pseudo-polynomial".',
  cost: { best: 'O(n·S)', avg: 'O(n·S)', worst: 'O(n·S)', space: 'O(n·S)', stable: '—' },
  input: 'dp-subset',
  pseudocode: [
    'can[i][s] = can the first i numbers make exactly s?',
    'can[i][0] is always yes — take nothing',
    'for each number and each target:',
    '  yes if you can make s without it,',
    '  or if you can make (s - this number) without it',
  ],
  *run({ numbers, target }) {
    const n = numbers.length;
    const table = grid(n + 1, target + 1);
    for (let i = 0; i <= n; i++) table[i][0] = '✓';
    for (let s = 1; s <= target; s++) table[0][s] = '·';

    const rowLabels = ['—', ...numbers.map(String)];
    const colLabels = Array.from({ length: target + 1 }, (_, i) => i);
    const f = (extra) => ({ table: copy(table), rowLabels, colLabels, rowTitle: 'numbers available', colTitle: 'target sum', ...extra });

    let comparisons = 0;
    yield f({ line: 1, note: 'sum 0 is always reachable — pick nothing. With no numbers, nothing else is.', stats: { comparisons: 0 } });

    for (let i = 1; i <= n; i++) {
      const v = numbers[i - 1];
      for (let s = 1; s <= target; s++) {
        comparisons++;
        const without = table[i - 1][s] === '✓';
        const fits = v <= s;
        const withIt = fits && table[i - 1][s - v] === '✓';

        yield f({
          current: [i, s], deps: fits ? [[i - 1, s], [i - 1, s - v]] : [[i - 1, s]], line: 3,
          note: fits
            ? `make ${s} without ${v}? ${without ? 'yes' : 'no'}. With it, need ${s - v}: ${withIt ? 'yes' : 'no'}`
            : `${v} is bigger than ${s} — can only skip it`,
          stats: { comparisons },
        });

        table[i][s] = (without || withIt) ? '✓' : '·';
        yield f({ current: [i, s], line: 4, note: table[i][s] === '✓' ? `${s} is reachable` : `${s} is not reachable yet`, stats: { comparisons } });
      }
    }

    const ok = table[n][target] === '✓';
    const path = [];
    const chosen = [];
    if (ok) {
      let s = target;
      for (let i = n; i > 0; i--) {
        path.push([i, s]);
        if (table[i - 1][s] !== '✓') { chosen.push(numbers[i - 1]); s -= numbers[i - 1]; }
      }
      path.push([0, s]);
    }

    yield f({
      path,
      note: ok ? `yes — ${chosen.join(' + ')} = ${target}` : `no subset of these numbers adds up to ${target}`,
      stats: { comparisons, reachable: ok ? 'yes' : 'no' },
    });
  },
};

export const DP = [fib, lis, coinChange, subsetSum, knapsack, lcs, editDistance];
