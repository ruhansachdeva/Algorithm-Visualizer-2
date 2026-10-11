/* Backtracking: the signature bug is a bad undo, which shows up as
   duplicate or missing results long before it shows up as a wrong count. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'backtracking';

export async function run() {
  reset();
  const { BACKTRACKING } = await load('algorithms/backtracking/index.js');
  const { record } = await load('engine/player.js');
  const get = (id) => BACKTRACKING.find((a) => a.id === id);

  /* ── subsets and permutations: exact counts AND all distinct ── */
  const subsets = get('bt-subsets');
  for (const k of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const values = Array.from({ length: k }, (_, i) => i + 1);
    const frames = record(subsets.run({ values }), 2000000);
    check(frames.at(-1).stats['subsets found'] === 2 ** k, `${k} items gave ${frames.at(-1).stats['subsets found']} subsets, wanted ${2 ** k}`);
    const seen = frames.filter((f) => /^#\d+: /.test(f.note || '')).map((f) => f.note.replace(/^#\d+: /, ''));
    check(new Set(seen).size === 2 ** k, `subsets of ${k} items were not all distinct — a bad undo duplicates results`);
  }

  const perms = get('bt-permutations');
  for (const k of [1, 2, 3, 4, 5, 6]) {
    const values = Array.from({ length: k }, (_, i) => i + 1);
    const want = values.reduce((a, b) => a * b, 1);
    const frames = record(perms.run({ values }), 2000000);
    check(frames.at(-1).stats['orderings found'] === want, `${k} items gave ${frames.at(-1).stats['orderings found']} orderings, wanted ${want}`);
    const seen = frames.filter((f) => /^#\d+: /.test(f.note || '')).map((f) => f.note.replace(/^#\d+: /, ''));
    check(new Set(seen).size === want, `permutations of ${k} items were not all distinct`);
  }

  /* ── N-Queens: the known solution counts, and a legal board ── */
  const queens = get('bt-n-queens');
  for (const [n, want] of [[2, 0], [3, 0], [4, 2], [5, 10], [6, 4], [7, 40], [8, 92]]) {
    const got = record(queens.run({ n, findAll: true }), 400000).at(-1).stats.solutions;
    check(got === want, `${n}-queens found ${got} solutions, the known count is ${want}`);
  }
  for (const n of [4, 6, 8]) {
    const solved = record(queens.run({ n, findAll: false }), 400000).find((f) => /^solution 1/.test(f.note || ''));
    if (!check(solved !== undefined, `${n}-queens found no solution`)) continue;
    const q = solved.queens;
    let legal = q.every((c) => c >= 0);
    for (let a = 0; a < n && legal; a++) for (let b = a + 1; b < n && legal; b++) {
      if (q[a] === q[b] || Math.abs(q[a] - q[b]) === b - a) legal = false;
    }
    check(legal, `${n}-queens produced a board where two queens attack each other`);
  }

  /* ── Sudoku: every shipped puzzle solves, and the solution is valid ── */
  const sudoku = get('bt-sudoku');
  const { SUDOKU } = await load('inputs.js');
  for (const [label, puzzle] of Object.entries(SUDOKU)) {
    const last = record(sudoku.run({ puzzle }), sudoku.maxFrames ?? 60000).at(-1);
    if (!check(/solved/.test(last.note), `the ${label} sudoku did not solve within its frame budget`)) continue;
    const b = last.board;
    const ok = (vals) => { const s = new Set(vals); return s.size === 9 && !s.has(0); };
    let valid = true;
    for (let r = 0; r < 9; r++) if (!ok(Array.from(b.slice(r * 9, r * 9 + 9)))) valid = false;
    for (let c = 0; c < 9; c++) if (!ok(Array.from({ length: 9 }, (_, r) => b[r * 9 + c]))) valid = false;
    for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
      const box = [];
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) box.push(b[(br * 3 + dr) * 9 + bc * 3 + dc]);
      if (!ok(box)) valid = false;
    }
    puzzle.forEach((v, i) => { if (v && b[i] !== v) valid = false; });
    check(valid, `the ${label} sudoku solution breaks a rule, or overwrote a given`);
  }

  /* ── Hanoi: exactly 2^n - 1 moves, and never a big disk on a small one ── */
  const hanoi = get('bt-hanoi');
  for (let n = 1; n <= 8; n++) {
    const frames = record(hanoi.run({ n }), 400000);
    check(frames.at(-1).stats.moves === 2 ** n - 1, `hanoi with ${n} disks took ${frames.at(-1).stats.moves} moves, the minimum is ${2 ** n - 1}`);
    check(frames.at(-1).pegs[2].length === n, `hanoi with ${n} disks left ${frames.at(-1).pegs[2].length} on the target peg`);
    const illegal = frames.some((f) => f.pegs.some((peg) => peg.some((d, i) => i > 0 && d > peg[i - 1])));
    check(!illegal, `hanoi with ${n} disks put a larger disk on a smaller one`);
  }

  return tally();
}
