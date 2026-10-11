/* ============================================================
   BACKTRACKING
   ------------------------------------------------------------
   Try something. If it leads nowhere, undo it and try the next
   thing. That undo — the backtrack — is the whole idea, and it
   is what makes these a search through a tree of possibilities
   rather than a straight-line computation.

   Watch for the moment a branch is abandoned: that is the
   algorithm pruning away thousands of futures at once.
   ============================================================ */

import { QUEENS_LEGEND, SUDOKU_LEGEND, HANOI_LEGEND } from '../../views/puzzle-view.js';
import { ENUMERATE } from './enumerate.js';

/* ───────────────────────── N-Queens ────────────────────── */

const queens = {
  id: 'bt-n-queens',
  name: 'N-Queens',
  maxFrames: 250000,
  view: 'queens',
  input: 'queens',
  legend: QUEENS_LEGEND,
  about: 'Place N queens on an N×N board so that none can attack another. It works row by row: try each column, and the instant a placement clashes with one already down, abandon it. That early rejection is what makes the problem tractable — a plain brute force over 8 queens is 16 million boards, while this examines a few thousand.',
  cost: { best: 'O(n!)', avg: 'O(n!)', worst: 'O(n!)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'place(row):',
    '  if every row is filled, that is a solution',
    '  for each column in this row:',
    '    if no queen already attacks it: place one and recurse',
    '    then take it back off and try the next column',
  ],
  *run({ n, findAll }) {
    const cols = new Array(n).fill(-1);
    let placements = 0, rejects = 0, backtracks = 0, solutions = 0;

    /** Squares attacked by the queens placed so far. */
    const attacked = (upToRow) => {
      const out = [];
      for (let r = 0; r < upToRow; r++) {
        const c = cols[r];
        if (c < 0) continue;
        for (let rr = r + 1; rr < n; rr++) {
          const d = rr - r;
          for (const cc of [c, c - d, c + d]) {
            if (cc >= 0 && cc < n) out.push([rr, cc]);
          }
        }
      }
      return out;
    };

    const f = (extra) => ({
      n, queens: [...cols],
      stats: { placements, rejected: rejects, backtracks, solutions },
      ...extra,
    });

    const safe = (row, col) => {
      for (let r = 0; r < row; r++) {
        const c = cols[r];
        if (c === col || Math.abs(c - col) === row - r) return false;
      }
      return true;
    };

    function* place(row) {
      if (row === n) {
        solutions++;
        yield f({ line: 1, note: `solution ${solutions} — all ${n} queens placed safely` });
        return !findAll;   // stop at the first unless asked for all
      }

      for (let col = 0; col < n; col++) {
        const ok = safe(row, col);
        if (!ok) rejects++;
        yield f({
          tryRow: row, tryCol: col, conflict: !ok, attacked: attacked(row), line: 3,
          note: ok ? `row ${row}, column ${col} is safe` : `row ${row}, column ${col} is attacked — skip it`,
        });

        if (!ok) continue;

        cols[row] = col;
        placements++;
        yield f({ tryRow: row, tryCol: col, attacked: attacked(row + 1), line: 3, note: `placed a queen at row ${row}, column ${col}` });

        const stop = yield* place(row + 1);
        if (stop) return true;

        cols[row] = -1;
        backtracks++;
        yield f({ tryRow: row, tryCol: col, attacked: attacked(row), line: 4, note: `nothing works below row ${row} — take that queen back off` });
      }
      return false;
    }

    yield f({ line: 0, note: `placing ${n} queens, one row at a time` });
    yield* place(0);

    yield f({
      attacked: [],
      note: solutions
        ? (findAll
          ? `${solutions} distinct solution${solutions === 1 ? '' : 's'} for ${n} queens — ${backtracks} backtracks along the way`
          : `solved — ${placements} placements, ${rejects} rejected, ${backtracks} backtracks`)
        : `no way to place ${n} queens on a ${n}×${n} board`,
    });
  },
};

/* ───────────────────────── Sudoku ──────────────────────── */

const sudoku = {
  id: 'bt-sudoku',
  name: 'Sudoku Solver',
  // A hard puzzle genuinely needs this many steps; each frame is only 81 bytes.
  maxFrames: 300000,
  view: 'sudoku',
  input: 'sudoku',
  legend: SUDOKU_LEGEND,
  about: 'The same try-and-undo search, on a puzzle you probably already know. It finds the first empty square, tries 1 through 9, and recurses on whichever digit does not clash with the row, column or 3×3 box. A dead end rewinds to the last square that still had options left.',
  cost: { best: 'O(1)', avg: 'exponential', worst: 'O(9^k)', space: 'O(k)', stable: '—' },
  pseudocode: [
    'find the first empty square',
    'if there is none, the puzzle is solved',
    'for each digit 1..9:',
    '  if it clashes with the row, column or box, skip it',
    '  otherwise write it in and recurse; on failure, rub it out',
  ],
  *run({ puzzle }) {
    const board = Int8Array.from(puzzle);
    const given = Uint8Array.from(puzzle, (v) => (v ? 1 : 0));
    let tries = 0, backtracks = 0, placed = 0;

    const f = (extra) => ({
      board: board.slice(),   // Int8Array copy — 81 bytes a frame, not 81 boxed numbers
      given,
      stats: { 'digits tried': tries, placed, backtracks },
      ...extra,
    });

    const legal = (i, v) => {
      const r = (i / 9) | 0, c = i % 9;
      for (let k = 0; k < 9; k++) {
        if (board[r * 9 + k] === v) return false;
        if (board[k * 9 + c] === v) return false;
      }
      const br = r - (r % 3), bc = c - (c % 3);
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          if (board[(br + dr) * 9 + bc + dc] === v) return false;
        }
      }
      return true;
    };

    function* solve() {
      let i = board.indexOf(0);
      if (i === -1) return true;

      for (let v = 1; v <= 9; v++) {
        tries++;
        const ok = legal(i, v);
        board[i] = v;
        yield f({ current: i, conflict: !ok, line: 3, note: ok ? `${v} fits at row ${((i / 9) | 0) + 1}, column ${(i % 9) + 1}` : `${v} clashes here` });

        if (ok) {
          placed++;
          if (yield* solve()) return true;
          backtracks++;
          yield f({ current: i, backtracking: true, line: 4, note: `nothing worked after putting ${v} here — rub it out and try ${v + 1}` });
        }
        board[i] = 0;
      }
      return false;
    }

    yield f({ line: 0, note: `${81 - board.filter((v) => v).length} squares to fill` });
    const ok = yield* solve();
    yield f({ note: ok ? `solved — ${tries.toLocaleString()} digits tried, ${backtracks.toLocaleString()} backtracks` : 'this puzzle has no solution' });
  },
};

/* ────────────────────── Towers of Hanoi ────────────────── */

const hanoi = {
  id: 'bt-hanoi',
  name: 'Towers of Hanoi',
  view: 'hanoi',
  input: 'hanoi',
  legend: HANOI_LEGEND,
  about: 'Move a stack of disks to another peg, never putting a bigger disk on a smaller one. The recursive solution is three lines long and provably optimal at 2ⁿ−1 moves — which means 64 disks, the version in the original legend, would take longer than the age of the universe at one move per second.',
  cost: { best: 'O(2ⁿ)', avg: 'O(2ⁿ)', worst: 'O(2ⁿ)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'move(k disks, from, to, spare):',
    '  if k == 0, there is nothing to do',
    '  move k-1 disks out of the way onto `spare`',
    '  move the big disk from `from` to `to`',
    '  move those k-1 disks back on top',
  ],
  *run({ n }) {
    // peg 0 starts with every disk, largest at the bottom
    const pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
    let moves = 0;
    const optimal = 2 ** n - 1;

    const f = (extra) => ({
      pegs: pegs.map((p) => [...p]), total: n,
      stats: { moves, 'fewest possible': optimal, depth: extra.depth ?? 0 },
      ...extra,
    });

    yield f({ line: 0, note: `${n} disks on peg A — this will take exactly ${optimal} move${optimal === 1 ? '' : 's'}` });

    function* move(k, from, to, spare, depth) {
      if (k === 0) return;

      yield* move(k - 1, from, spare, to, depth + 1);

      const disk = pegs[from].pop();
      pegs[to].push(disk);
      moves++;
      yield f({
        moving: { disk, from, to }, depth, line: 3,
        note: `move disk ${disk} from ${'ABC'[from]} to ${'ABC'[to]}  (${moves} of ${optimal})`,
      });

      yield* move(k - 1, spare, to, from, depth + 1);
    }

    yield* move(n, 0, 2, 1, 0);
    yield f({ note: `done in ${moves} moves — the provable minimum for ${n} disks` });
  },
};

export const BACKTRACKING = [...ENUMERATE, queens, sudoku, hanoi];
