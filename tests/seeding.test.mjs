/* Seeding: the point of the seeded generator is that a shared link shows
   the recipient exactly what the sender saw. That only holds if the same
   seed produces byte-identical input every time. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'seeding';

export async function run() {
  reset();
  const rng = await load('rng.js');
  const { generateArray, buildGraph } = await load('inputs.js');

  /* ── the generator itself ── */
  rng.setSeed('abc');
  const first = Array.from({ length: 20 }, () => rng.random());
  rng.rewind();
  const second = Array.from({ length: 20 }, () => rng.random());
  check(JSON.stringify(first) === JSON.stringify(second),
    'rewinding a seed did not reproduce the same sequence');

  rng.setSeed('xyz');
  const other = Array.from({ length: 20 }, () => rng.random());
  check(JSON.stringify(first) !== JSON.stringify(other),
    'two different seeds produced the same sequence');

  check(rng.setSeed('abc') && rng.getSeed() === 'abc', 'a seed did not survive a round trip');
  // Base-36 digits are 0-9 and a-z, so most words ARE valid seeds —
  // 'not a seed' parses fine. Only something with no leading digit fails.
  check(rng.setSeed('!!!') === false, 'a seed with no base-36 digits was accepted');
  check(rng.setSeed('') === false, 'an empty seed was accepted');

  /* ── arrays ── */
  for (const shape of ['random', 'nearly', 'few', 'signed', 'sawtooth']) {
    rng.setSeed('seed1');
    const a = generateArray(40, shape);
    rng.setSeed('seed1');
    const b = generateArray(40, shape);
    check(JSON.stringify(a) === JSON.stringify(b), `"${shape}" arrays differ under the same seed`);

    rng.setSeed('seed2');
    const c = generateArray(40, shape);
    // A sawtooth is deterministic by construction, so it is allowed to match.
    if (shape !== 'sawtooth') {
      check(JSON.stringify(a) !== JSON.stringify(c), `"${shape}" arrays are identical under different seeds`);
    }
  }

  /* ── graphs ── */
  const spec = { directed: false, weighted: true };
  rng.setSeed('g1');
  const g1 = buildGraph(9, spec, { extra: 0.4 });
  rng.setSeed('g1');
  const g2 = buildGraph(9, spec, { extra: 0.4 });
  check(JSON.stringify(g1.edges) === JSON.stringify(g2.edges), 'graphs differ under the same seed');

  rng.setSeed('g2');
  const g3 = buildGraph(9, spec, { extra: 0.4 });
  check(JSON.stringify(g1.edges) !== JSON.stringify(g3.edges), 'graphs are identical under different seeds');

  /* ── a stochastic ALGORITHM must repeat too, or a link to one drifts ── */
  const { SORTING } = await load('algorithms/sorting/index.js');
  const { MAZES } = await load('algorithms/graphs/maze.js');
  const { record } = await load('engine/player.js');

  const bogo = SORTING.find((a) => a.id === 'bogo');
  rng.setSeed('b1');
  const runA = record(bogo.run({ array: [4, 2, 5, 1] }), 200000).length;
  rng.setSeed('b1');
  const runB = record(bogo.run({ array: [4, 2, 5, 1] }), 200000).length;
  check(runA === runB, `bogo sort took ${runA} then ${runB} steps under the same seed — it shuffles randomly, so it has to be seeded too`);

  for (const maze of MAZES) {
    const make = () => {
      const inp = { cols: 21, rows: 11, walls: new Set(), start: 1, goal: 20 };
      record(maze.run(inp), 200000);
      return [...inp.walls].sort((a, b) => a - b).join(',');
    };
    rng.setSeed('m1');
    const w1 = make();
    rng.setSeed('m1');
    const w2 = make();
    check(w1 === w2, `${maze.id} carved a different maze under the same seed`);
  }

  return tally();
}
