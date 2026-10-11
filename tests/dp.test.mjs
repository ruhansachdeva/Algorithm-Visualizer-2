/* Dynamic programming: each table checked against a separate implementation,
   and — where the algorithm reconstructs an answer from the table — that
   answer re-costed from scratch. A right number with a wrong traceback is a
   common and quiet bug. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'dynamic programming';

export async function run() {
  reset();
  const { DP } = await load('algorithms/dp/index.js');
  const { record } = await load('engine/player.js');
  const get = (id) => DP.find((a) => a.id === id);
  const last = (gen) => record(gen, 400000).at(-1);

  /* ── Fibonacci ── */
  const fibRef = (k) => { let a = 0, b = 1; for (let i = 0; i < k; i++) [a, b] = [b, a + b]; return a; };
  for (const n of [2, 5, 10, 20, 30]) {
    check(last(get('dp-fib').run({ n })).table[0][n] === fibRef(n), `fib(${n}) wrong`);
  }

  /* ── Kadane, with the reported range re-summed ── */
  const kadaneRef = (a) => { let b = a[0], c = a[0]; for (let i = 1; i < a.length; i++) { c = Math.max(a[i], c + a[i]); b = Math.max(b, c); } return b; };
  for (let t = 0; t < 60; t++) {
    const arr = Array.from({ length: 1 + Math.floor(Math.random() * 15) }, () => Math.floor(Math.random() * 24) - 11);
    const f = last(get('dp-kadane').run({ array: arr.slice() }));
    check(f.stats['best found'] === kadaneRef(arr), `Kadane on [${arr}] gave ${f.stats['best found']}`);
    const m = f.note.match(/index (\d+) to (\d+)/);
    if (m) {
      const sum = arr.slice(+m[1], +m[2] + 1).reduce((x, y) => x + y, 0);
      check(sum === kadaneRef(arr), `Kadane's reported range sums to ${sum}, not ${kadaneRef(arr)}`);
    }
  }

  /* ── LIS, with the reported subsequence verified increasing and present ── */
  const lisRef = (a) => { const d = a.map(() => 1); for (let i = 0; i < a.length; i++) for (let j = 0; j < i; j++) if (a[j] < a[i]) d[i] = Math.max(d[i], d[j] + 1); return Math.max(...d, 0); };
  for (let t = 0; t < 40; t++) {
    const arr = Array.from({ length: 4 + Math.floor(Math.random() * 12) }, () => 1 + Math.floor(Math.random() * 40));
    const f = last(get('dp-lis').run({ array: arr }));
    check(f.stats.best === lisRef(arr), `LIS on [${arr}] gave ${f.stats.best}`);
    const m = f.note.match(/subsequence: (.+) \(length/);
    if (m) {
      const seq = m[1].split(' < ').map(Number);
      check(seq.every((v, i) => i === 0 || seq[i - 1] < v), 'LIS result is not increasing');
      let k = 0; for (const v of arr) if (k < seq.length && v === seq[k]) k++;
      check(k === seq.length, 'LIS result is not a subsequence of the input');
    }
  }

  /* ── coin change, with the coin list re-added ── */
  const coinRef = (coins, amount) => { const d = new Array(amount + 1).fill(Infinity); d[0] = 0; for (let a = 1; a <= amount; a++) for (const c of coins) if (c <= a && d[a - c] + 1 < d[a]) d[a] = d[a - c] + 1; return d[amount]; };
  for (const [coins, amount] of [[[1, 3, 4], 6], [[1, 2, 5, 10, 20], 33], [[2], 7], [[3, 7], 5], [[5, 6], 11]]) {
    const f = last(get('dp-coin-change').run({ coins, amount }));
    const ref = coinRef(coins, amount);
    const got = f.table[0][amount];
    check((got === Infinity) === (ref === Infinity) && (ref === Infinity || got === ref), `coins ${coins} to ${amount}: got ${got}, want ${ref}`);
    const m = f.note.match(/= (.+) — (\d+) coin/);
    if (m) {
      const used = m[1].split(' + ').map(Number);
      check(used.reduce((a, b) => a + b, 0) === amount, `coin solution does not add to ${amount}`);
      check(used.length === ref, `coin solution uses ${used.length} coins, optimal is ${ref}`);
    }
  }

  /* ── knapsack, subset sum, LCS, edit distance, matrix chain ── */
  const knapRef = (items, cap) => { const d = new Array(cap + 1).fill(0); for (const it of items) for (let w = cap; w >= it.w; w--) d[w] = Math.max(d[w], d[w - it.w] + it.v); return d[cap]; };
  for (let t = 0; t < 25; t++) {
    const items = Array.from({ length: 2 + Math.floor(Math.random() * 5) }, () => ({ v: 10 * (1 + Math.floor(Math.random() * 12)), w: 1 + Math.floor(Math.random() * 7) }));
    const capacity = 3 + Math.floor(Math.random() * 18);
    check(last(get('dp-knapsack').run({ items, capacity })).stats['best value'] === knapRef(items, capacity), 'knapsack value wrong');
  }

  const subsetRef = (nums, target) => { const can = new Array(target + 1).fill(false); can[0] = true; for (const v of nums) for (let s = target; s >= v; s--) if (can[s - v]) can[s] = true; return can[target]; };
  for (let t = 0; t < 30; t++) {
    const nums = Array.from({ length: 2 + Math.floor(Math.random() * 6) }, () => 1 + Math.floor(Math.random() * 15));
    const target = 1 + Math.floor(Math.random() * 30);
    const f = last(get('dp-subset-sum').run({ numbers: nums, target }));
    check(f.stats.reachable === (subsetRef(nums, target) ? 'yes' : 'no'), `subset sum ${nums} to ${target}`);
    const m = f.note.match(/yes — (.+) = /);
    if (m) check(m[1].split(' + ').map(Number).reduce((a, b) => a + b, 0) === target, 'subset solution does not add up');
  }

  const lcsRef = (a, b) => { const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]); return d[a.length][b.length]; };
  const editRef = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  for (const a of ['KITTEN', 'ABC', '', 'BANANA']) for (const b of ['SITTING', 'AC', 'ATLAS', '']) {
    check(last(get('dp-lcs').run({ a, b })).stats.length === lcsRef(a, b), `LCS "${a}"/"${b}"`);
    check(last(get('dp-edit-distance').run({ a, b })).stats.distance === editRef(a, b), `edit distance "${a}"/"${b}"`);
  }

  const mcmRef = (dims) => { const n = dims.length - 1; const d = Array.from({ length: n }, () => new Array(n).fill(0)); for (let len = 2; len <= n; len++) for (let i = 0; i + len - 1 < n; i++) { const j = i + len - 1; d[i][j] = Infinity; for (let k = i; k < j; k++) d[i][j] = Math.min(d[i][j], d[i][k] + d[k + 1][j] + dims[i] * dims[k + 1] * dims[j + 1]); } return n ? d[0][n - 1] : 0; };
  for (const dims of [[10, 30, 5, 60], [30, 35, 15, 5, 10, 20, 25], [5, 10], [2, 3, 4, 5], [100, 2, 100, 2, 100]]) {
    check(last(get('dp-matrix-chain').run({ dims })).stats['best cost'] === mcmRef(dims), `matrix chain ${dims}`);
  }
  // the textbook answer, exactly
  check(last(get('dp-matrix-chain').run({ dims: [30, 35, 15, 5, 10, 20, 25] })).stats['best cost'] === 15125,
    'the CLRS matrix chain example should cost 15125');

  /* ── rod cutting, with the cut list re-measured ── */
  const rodRef = (p) => { const n = p.length, d = new Array(n + 1).fill(0); for (let L = 1; L <= n; L++) { let b = -Infinity; for (let c = 1; c <= L; c++) b = Math.max(b, p[c - 1] + d[L - c]); d[L] = b; } return d[n]; };
  for (const prices of [[1, 5, 8, 9, 10, 17, 17, 20], [1, 2, 3, 4, 50], [2], [5, 4, 3, 2, 1]]) {
    const f = last(get('dp-rod-cutting').run({ prices }));
    check(f.stats['best value'] === rodRef(prices), `rod cutting ${prices}`);
    const m = f.note.match(/cutting ([\d +]+)/);
    if (m) {
      const pieces = m[1].trim().split(' + ').map(Number);
      check(pieces.reduce((a, b) => a + b, 0) === prices.length, 'the cuts do not use up the whole rod');
      check(pieces.reduce((a, b) => a + prices[b - 1], 0) === rodRef(prices), 'the cuts do not total the claimed value');
    }
  }

  return tally();
}
