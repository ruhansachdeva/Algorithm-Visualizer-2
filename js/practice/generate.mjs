/* ============================================================
   Questions generated from real runs.

   Two of the five formats in IDEAS.md can be produced rather than
   written, and they are better produced: the answer is read off an
   actual execution, so it cannot be wrong, and there is an unlimited
   supply instead of a fixed bank.

     - "Predict the next step": pause a real run, ask what happens next,
       and take the answer from the next frame.
     - "Trace it by hand": give an exact input and ask how much work it
       takes, with the answer from the run's own counters.

   The other three formats — which algorithm would you use, spot the
   complexity, find the bug — need a human to write them, and live in
   bank.mjs.

   The distractors matter as much as the answer. A wrong option has to
   be something a person might actually believe: for a comparison, the
   neighbouring pairs; for a count, a number off by the kind of margin
   that comes from forgetting the last pass. Options that are obviously
   silly make a question that tests nothing.
   ============================================================ */

import { ALL, findAlgo } from '../registry.js';
import { record } from '../engine/player.js';
import { setSeed, random, seedFrom } from '../rng.js';

const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pick = (xs) => xs[Math.floor(random() * xs.length)];

/* ────────────────── predict the next step ────────────────── */

/* Sorts whose frames expose a compare and then act on it, which is what
   makes "will it swap?" a fair question with a definite answer. */
const PREDICTABLE_SORTS = ['bubble', 'cocktail', 'selection', 'insertion', 'gnome', 'odd-even'];

/**
 * Show a comparison mid-run and ask what the algorithm does about it.
 *
 * The answer is whether the following frame is a swap, so it is right by
 * construction — and the question is a real one, because answering it
 * means knowing what the algorithm is trying to achieve, not just what
 * the two numbers are.
 */
function predictSwap(seedKey) {
  setSeed(seedFrom(seedKey));
  const id = pick(PREDICTABLE_SORTS);
  const algo = findAlgo(id);
  const n = 7 + Math.floor(random() * 3);
  const array = Array.from({ length: n }, () => 5 + Math.floor(random() * 90));

  const frames = record(algo.run({ array: [...array] }), 4000);

  // Only the frames that pose a comparison and have a successor to check.
  const choices = frames
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => f.compare && i + 1 < frames.length);
  if (!choices.length) return null;

  const { f, i } = pick(choices);
  const next = frames[i + 1];
  const swapped = !!next.swap;
  const [a, b] = f.compare;

  return {
    id: `gen:swap:${id}:${seedKey}:${i}`,
    kind: 'predict',
    algo: id,
    category: algo.category,
    categoryName: algo.categoryName,
    prompt: `${algo.name} has just compared the two highlighted items. What happens on the very next step?`,
    frame: f,
    view: algo.view,
    viewAlgo: algo,
    hint: f.note,
    options: shuffle([
      { text: 'They swap places', correct: swapped },
      { text: 'They stay where they are, and it moves on', correct: !swapped },
    ]),
    explain: swapped
      ? `They swap. ${algo.name} wants the smaller value earlier, and the comparison found them the wrong way round — which is exactly what the next frame does.`
      : `No swap. These two are already in the right order relative to each other, so there is nothing to fix and the algorithm moves along.`,
    deepen: `The step after this one is “${next.note}”.`,
  };
}

/**
 * Binary search: given the window, which index does it probe next?
 *
 * Distractors are the other plausible midpoints — the middle of the
 * whole array, and the two neighbours of the real answer — because
 * "halfway through what is left" and "halfway through everything" is
 * precisely the confusion worth testing.
 */
function predictProbe(seedKey) {
  setSeed(seedFrom(seedKey));
  const n = 12 + Math.floor(random() * 8);
  const pool = new Set();
  while (pool.size < n) pool.add(2 + Math.floor(random() * 96));
  const array = [...pool].sort((a, b) => a - b);
  const target = array[Math.floor(random() * array.length)];

  const algo = findAlgo('binary');
  const frames = record(algo.run({ array, target }), 200);

  const probes = frames
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.cursor != null && f.range);
  if (probes.length < 2) return null;

  // Not the first probe: the midpoint of the full array is too easy.
  const { f, i } = pick(probes.slice(1));
  const [lo, hi] = f.range;
  const answer = f.cursor;

  const wrong = new Set();
  wrong.add(Math.floor((array.length - 1) / 2));   // middle of everything
  wrong.add(answer - 1);
  wrong.add(answer + 1);
  wrong.add(lo);
  const distractors = [...wrong].filter((v) => v !== answer && v >= 0 && v < array.length).slice(0, 3);

  return {
    id: `gen:probe:${seedKey}:${i}`,
    kind: 'predict',
    algo: 'binary',
    category: algo.category,
    categoryName: algo.categoryName,
    prompt: `Binary search is looking for ${target}. It has narrowed the search to indices ${lo}–${hi}. Which index does it look at next?`,
    frame: { ...f, cursor: undefined },
    view: 'array',
    viewAlgo: algo,
    options: shuffle([
      { text: `index ${answer}`, correct: true },
      ...distractors.map((v) => ({ text: `index ${v}`, correct: false })),
    ]),
    explain: `Index ${answer} — the middle of what is left, ⌊(${lo} + ${hi}) / 2⌋ = ${answer}, holding ${array[answer]}. Binary search always halves the *remaining* window, not the original array, and that is the whole source of its log n behaviour.`,
  };
}

/* ────────────────── trace it by hand ────────────────── */

/* Each entry names an algorithm, the counter to ask about, and how to
   phrase it. Only counters that are a total — a snapshot like "queue
   size" has no answer to trace. */
const TRACEABLE = [
  { id: 'bubble',    counter: 'comparisons', noun: 'comparisons' },
  { id: 'selection', counter: 'comparisons', noun: 'comparisons' },
  { id: 'insertion', counter: 'comparisons', noun: 'comparisons' },
  { id: 'selection', counter: 'swaps',       noun: 'swaps' },
  { id: 'bubble',    counter: 'swaps',       noun: 'swaps' },
  { id: 'linear',    counter: 'checked',     noun: 'items checked' },
];

/**
 * Give a small exact input and ask for a count. The answer comes from
 * running it, so it is exact; the distractors are the near misses that
 * an actual hand-trace produces — the off-by-one from counting passes
 * instead of comparisons, and the n² and n(n−1)/2 confusion.
 */
function traceCount(seedKey) {
  setSeed(seedFrom(seedKey));
  const spec = pick(TRACEABLE);
  const algo = findAlgo(spec.id);
  const n = 5 + Math.floor(random() * 2);

  const input = spec.id === 'linear'
    ? (() => {
        const pool = new Set();
        while (pool.size < n) pool.add(1 + Math.floor(random() * 40));
        const array = [...pool];
        return { array, target: array[Math.floor(random() * array.length)] };
      })()
    : { array: Array.from({ length: n }, () => 1 + Math.floor(random() * 40)) };

  const frames = record(algo.run(structuredClone(input)), 3000);
  const answer = frames.at(-1)?.stats?.[spec.counter];
  if (answer == null) return null;

  const candidates = new Set([
    answer,
    n * (n - 1) / 2,
    n * n,
    n - 1,
    n,
    answer + 1,
    answer - 1,
  ]);
  const distractors = [...candidates]
    .filter((v) => v !== answer && v >= 0 && Number.isInteger(v))
    .slice(0, 3);
  if (distractors.length < 2) return null;

  const shown = spec.id === 'linear'
    ? `[${input.array.join(', ')}], looking for ${input.target}`
    : `[${input.array.join(', ')}]`;

  return {
    id: `gen:trace:${spec.id}:${spec.counter}:${seedKey}`,
    kind: 'trace',
    algo: spec.id,
    category: algo.category,
    categoryName: algo.categoryName,
    prompt: `Run ${algo.name} on ${shown}. How many ${spec.noun} does it make?`,
    note: 'Work it through on paper — the point is the trace, not the guess.',
    options: shuffle([
      { text: String(answer), correct: true },
      ...distractors.map((v) => ({ text: String(v), correct: false })),
    ]),
    explain: `${answer}. You can check it: open this input in the visualizer and the “${spec.counter}” counter reads ${answer} at the end.`,
    link: `index.html#${spec.id}`,
  };
}

/* ────────────────────────────────────────────────────────────
   The generators, and a seeded batch of questions from them.
   ──────────────────────────────────────────────────────────── */

const GENERATORS = [predictSwap, predictProbe, traceCount];

/**
 * A batch of generated questions.
 *
 * Generators can legitimately return null — a run with no comparison
 * frame, a count with no distinct distractors — so this asks for more
 * than it needs and stops when it has enough, rather than trusting
 * every attempt to produce something.
 */
export function generate(count = 12, seedPrefix = String(Date.now())) {
  const out = [];
  const seen = new Set();
  for (let attempt = 0; out.length < count && attempt < count * 6; attempt++) {
    const gen = GENERATORS[attempt % GENERATORS.length];
    let q = null;
    try {
      q = gen(`${seedPrefix}:${attempt}`);
    } catch {
      q = null;
    }
    if (!q || seen.has(q.id)) continue;
    // A question whose options hold no correct answer is a broken
    // question; better to drop it than to show something unanswerable.
    if (!q.options.some((o) => o.correct)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}
