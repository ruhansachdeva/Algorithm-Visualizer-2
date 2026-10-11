/* Searching: for every list and every target — present or absent — each
   algorithm must agree on whether it is there and, if so, where. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'searching';

const LISTS = [
  [1, 3, 5, 7, 9, 11, 13],
  [2, 4, 6, 8],
  [5],
  [],
  [1, 1, 2, 2, 3, 3],
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  [-9, -4, 0, 3, 8, 15],
];

export async function run() {
  reset();
  const { SEARCHING } = await load('algorithms/searching/index.js');
  const { record } = await load('engine/player.js');

  // Only the "find this value" searches; quickselect takes a rank instead.
  const byTarget = SEARCHING.filter((a) => a.input === 'search');

  for (const algo of byTarget) {
    for (const list of LISTS) {
      for (const target of [...list, 0, 99, -100, 4]) {
        const last = record(algo.run({ array: list.slice(), target }), 100000).at(-1);
        if (!check(last !== undefined, `${algo.id} produced no frames`)) continue;

        const said = last.found !== undefined;
        const truth = list.includes(target);
        check(said === truth,
          `${algo.id} on [${list}] looking for ${target}: said ${said ? 'found' : 'absent'}, truth ${truth ? 'present' : 'absent'}`);

        if (said) {
          check(list[last.found] === target,
            `${algo.id} on [${list}] pointed at index ${last.found}, which holds ${list[last.found]} not ${target}`);
        }
      }
    }
  }

  /* Quickselect: the kth smallest, without sorting. */
  const qs = SEARCHING.find((a) => a.id === 'quickselect');
  for (let trial = 0; trial < 200; trial++) {
    const len = 1 + Math.floor(Math.random() * 30);
    const arr = Array.from({ length: len }, () => 1 + Math.floor(Math.random() * 60));
    const k = Math.floor(Math.random() * len);
    const want = [...arr].sort((a, b) => a - b)[k];

    const last = record(qs.run({ array: arr.slice(), k }), 300000).at(-1);
    if (!check(last.found !== undefined, `quickselect found nothing for k=${k}`)) continue;
    check(last.array[last.found] === want,
      `quickselect k=${k} on [${arr}] gave ${last.array[last.found]}, wanted ${want}`);

    // Partitioning must not lose or duplicate anything.
    check(JSON.stringify([...last.array].sort((a, b) => a - b)) === JSON.stringify([...arr].sort((a, b) => a - b)),
      `quickselect altered the multiset of values on [${arr}]`);
  }


  /* ── handed an unsorted list, a sorted search must sort it first,
        get the right answer anyway, and own up to the cost ── */
  const needsSorting = SEARCHING.filter((a) => a.needsSorted === true);
  for (const algo of needsSorting) {
    for (let trial = 0; trial < 12; trial++) {
      const pool = new Set();
      while (pool.size < 6 + Math.floor(Math.random() * 20)) pool.add(1 + Math.floor(Math.random() * 99));
      const unsorted = [...pool];                       // insertion order, not sorted
      const present = unsorted[Math.floor(Math.random() * unsorted.length)];

      for (const target of [present, 1000]) {
        const frames = record(algo.run({ array: unsorted.slice(), target, presorted: false }), 300000);
        const last = frames.at(-1);

        // it has to actually sort, visibly
        check(frames.some((f) => f.phase === 'sorting'),
          `${algo.id} was handed an unsorted list and never sorted it`);

        // and still be right
        const foundSomewhere = frames.some((f) => f.found !== undefined);
        check(foundSomewhere === unsorted.includes(target),
          `${algo.id} on an unsorted list: said ${foundSomewhere ? 'found' : 'absent'} for ${target}`);

        // and the bill must add up
        const st = last.stats || {};
        check(st.TOTAL === st['sorting cost'] + st['search cost'],
          `${algo.id} reported a total of ${st.TOTAL} from ${st['sorting cost']} + ${st['search cost']}`);
        check(st['sorting cost'] > 0, `${algo.id} claimed the sort was free`);
      }
    }
  }

  /* ── linear search must NOT sort: that is its whole advantage here ── */
  {
    const unsorted = [42, 7, 91, 3, 55, 18, 64, 29];
    const frames = record(SEARCHING.find((a) => a.id === 'linear').run({ array: unsorted, target: 55, presorted: false }), 100000);
    check(!frames.some((f) => f.phase === 'sorting'),
      'linear search sorted the list — not needing it sorted is the entire point of this comparison');
  }

  /* ── on one lookup over a decent list, sorting should lose ── */
  {
    const unsorted = Array.from({ length: 40 }, (_, i) => ((i * 37) % 97) + 1);
    const target = unsorted[30];
    const binary = record(SEARCHING.find((a) => a.id === 'binary').run({ array: unsorted.slice(), target, presorted: false }), 300000).at(-1);
    check(binary.stats.TOTAL > binary.stats['a linear scan'],
      `for a single lookup over 40 items, binary + sort cost ${binary.stats.TOTAL} against a linear scan's ` +
      `${binary.stats['a linear scan']} — sorting should not win here, and if it does the accounting is wrong`);
  }

  return tally();
}
