/* Practice: the questions have to be answerable and correctly marked,
   or the page teaches the wrong thing with total confidence.

   The generated questions get the strongest check available: their
   answers are re-derived here by running the algorithm independently of
   whatever generate.mjs decided. A question whose answer was read off a
   different run than the one it shows would be undetectable any other
   way. */

import { load, check, equal, reset, tally } from './harness.mjs';
import { installDom, fakeStorage } from './dom-shim.mjs';

export const name = 'practice';

export async function run() {
  reset();
  const uninstall = installDom();
  try {
    const { ALL, findAlgo } = await load('registry.js');
    const { record } = await load('engine/player.js');
    const { BANK, KINDS, withShuffledOptions } = await import('./../js/practice/bank.mjs');
    const { generate } = await import('./../js/practice/generate.mjs');

    /* ── the written bank ── */
    const ids = new Set();
    for (const q of BANK) {
      check(!ids.has(q.id), `two questions share the id "${q.id}"`);
      ids.add(q.id);

      check(!!KINDS[q.kind], `question ${q.id} has kind "${q.kind}", which the page cannot label`);
      check(q.options.length >= 2, `question ${q.id} has fewer than two options`);

      const correct = q.options.filter((o) => o.correct);
      equal(correct.length, 1, `question ${q.id} should have exactly one correct option`);

      for (const o of q.options) {
        check(!!o.text?.trim(), `question ${q.id} has an option with no text`);
        // The explanation on a wrong option is the part that teaches;
        // an unexplained wrong answer just says "no".
        check(!!o.why?.trim(), `question ${q.id}: option "${o.text}" does not say why`);
      }

      check(!!q.explain?.trim(), `question ${q.id} has no explanation`);
      check(!!q.categoryName, `question ${q.id} has no topic, so it cannot appear in the progress panel`);
      if (q.algo) check(!!findAlgo(q.algo), `question ${q.id} points at unknown algorithm "${q.algo}"`);
      if (q.code) check(!/\t/.test(q.code), `question ${q.id} has a tab in its code, which renders unpredictably`);
    }

    /* ── the options must get shuffled ──
       The bank lists the correct answer first for readability. If the
       page showed them in that order, clicking the first option every
       time would score 27 of 30 — which an automated run did. */
    const firstPositions = BANK.map((q) => q.options.findIndex((o) => o.correct));
    check(firstPositions.every((p) => p === 0),
      'the bank is meant to list the correct option first; if that changed, the comment in bank.mjs is now wrong');

    const spread = new Map();
    for (let i = 0; i < 400; i++) {
      const q = withShuffledOptions(BANK.find((x) => x.options.length === 4));
      const at = q.options.findIndex((o) => o.correct);
      spread.set(at, (spread.get(at) ?? 0) + 1);
    }
    equal(spread.size, 4, 'withShuffledOptions() should move the correct answer to all four positions');
    for (const [at, count] of spread) {
      check(count > 400 / 4 / 3, `position ${at} came up only ${count} times in 400 shuffles — the shuffle is skewed`);
    }
    const sample = withShuffledOptions(BANK[0]);
    equal(sample.options.length, BANK[0].options.length, 'shuffling must not lose or add options');
    check(BANK[0].options.every((o) => sample.options.includes(o)), 'shuffling must keep the same options');

    /* ── generated questions ── */
    const made = generate(24, 'test-suite');
    check(made.length >= 18, `only ${made.length} of 24 generated questions came back`);

    const genIds = new Set();
    for (const q of made) {
      check(!genIds.has(q.id), `generated questions repeated the id "${q.id}"`);
      genIds.add(q.id);
      equal(q.options.filter((o) => o.correct).length, 1,
        `generated question ${q.id} should have exactly one correct option`);
      check(!!q.explain?.trim(), `generated question ${q.id} has no explanation`);
      check(!!findAlgo(q.algo), `generated question ${q.id} names unknown algorithm "${q.algo}"`);
      if (q.frame) check(!!q.view, `generated question ${q.id} has a frame but no view to draw it with`);
    }

    /* ── and the generated answers must be independently right ── */
    for (const q of made) {
      if (q.kind !== 'trace') continue;
      // Re-derive it: pull the input back out of the prompt and run the
      // algorithm here, rather than trusting the generator's own run.
      const m = q.prompt.match(/\[([-\d, ]+)\]/);
      check(!!m, `trace question ${q.id} does not show an array in its prompt`);
      if (!m) continue;
      const array = m[1].split(',').map((x) => Number(x.trim()));
      const targetMatch = q.prompt.match(/looking for (\d+)/);
      const algo = findAlgo(q.algo);
      const input = targetMatch
        ? { array, target: Number(targetMatch[1]) }
        : { array };
      const last = record(algo.run(structuredClone(input)), 60000).at(-1);

      const stated = Number(q.options.find((o) => o.correct).text);
      const counterName = q.explain.match(/“(.+?)”/)?.[1];
      check(!!counterName, `trace question ${q.id} does not name the counter in its explanation`);
      if (counterName) {
        equal(last.stats?.[counterName], stated,
          `trace question ${q.id} says ${stated} but re-running it gives ${last.stats?.[counterName]}`);
      }
    }

    /* ── progress ── */
    const progress = await import('./../js/practice/progress.mjs');
    progress.reset();

    equal(progress.stats().answered, 0, 'a fresh progress store should be empty');
    equal(progress.stats().percent, null, 'percent with nothing answered should be null, not 0');

    progress.record({ id: 'q1', kind: 'choose', algo: 'bubble', right: true });
    progress.record({ id: 'q2', kind: 'choose', algo: 'quick', right: false });
    progress.record({ id: 'q3', kind: 'bug', algo: 'bubble', right: true });

    const s = progress.stats();
    equal(s.answered, 3, 'answered count');
    equal(s.right, 2, 'right count');
    equal(s.percent, 67, 'percent correct');
    equal(s.streak, 1, 'a wrong answer should reset the streak, and q3 restarts it');
    equal(s.best, 1, 'best streak');

    check(progress.isSettled('q1'), 'q1 was answered correctly and should be settled');
    check(!progress.isSettled('q2'), 'q2 was answered wrongly and should not be settled');
    check(!progress.isSettled('never-seen'), 'an unseen question is not settled');

    equal(progress.needsRevisit().join(','), 'q2', 'only the wrongly-answered question needs revisiting');

    // Getting it right afterwards clears it from the revisit list.
    progress.record({ id: 'q2', kind: 'choose', algo: 'quick', right: true });
    equal(progress.needsRevisit().length, 0, 'a corrected question should leave the revisit list');
    equal(progress.stats().streak, 2, 'two right in a row');

    /* ── ordering: unseen first, then wrong, then settled ── */
    const qs = [{ id: 'q1' }, { id: 'q2' }, { id: 'fresh' }];
    progress.record({ id: 'q2', kind: 'choose', right: false });
    const order = progress.prioritise(qs).map((q) => q.id);
    equal(order[0], 'fresh', 'a question never attempted should come first');
    equal(order[1], 'q2', 'a question last got wrong should come before a settled one');
    equal(order[2], 'q1', 'a settled question should come last');

    /* ── and it must survive storage being unavailable ── */
    const realStore = globalThis.localStorage;
    globalThis.localStorage = fakeStorage({ broken: true });
    let threw = null;
    try {
      progress.reset();
      progress.record({ id: 'x', kind: 'choose', right: true });
      progress.stats();
      progress.needsRevisit();
      progress.prioritise([{ id: 'x' }]);
      progress.categoryProgress(BANK);
    } catch (err) {
      threw = err.message;
    }
    globalThis.localStorage = realStore;
    check(threw === null,
      `the progress store must work when localStorage throws — a private window should not break the quiz, but it threw: ${threw}`);

    /* ── the progress panel's category rollup ── */
    progress.reset();
    const cats = progress.categoryProgress(BANK);
    check(cats.size > 1, 'the written bank should span more than one topic');
    let counted = 0;
    for (const slot of cats.values()) counted += slot.total;
    equal(counted, BANK.length, 'every written question should land in exactly one topic');
  } finally {
    uninstall();
  }

  return tally();
}
