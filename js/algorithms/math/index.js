/* ============================================================
   NUMBER THEORY
   ------------------------------------------------------------
   Algorithms about the integers themselves rather than about a
   collection of them. They are some of the oldest things in the
   subject — Euclid's method for the greatest common divisor is
   around 2,300 years old and is still what your computer runs.
   ============================================================ */

import { NUM, NUMBER_LEGEND } from '../../views/number-view.js';

/* ──────────────── Sieve of Eratosthenes ────────────────── */

const sieve = {
  view: 'numbers',
  input: 'sieve',
  id: 'math-sieve',
  name: 'Sieve of Eratosthenes',
  legend: NUMBER_LEGEND,
  about: 'Finds every prime up to n without ever testing a single number for divisibility. Instead it works forwards: take the next number still standing, declare it prime, and cross out all of its multiples. Two optimisations fall out of the structure — you can start crossing out at p² rather than 2p, because everything below that was already struck by a smaller prime, and you can stop entirely once p² passes n.',
  cost: { best: 'O(n log log n)', avg: 'O(n log log n)', worst: 'O(n log log n)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'write down every number from 2 to n',
    'take the smallest one not yet crossed out — it is prime',
    'cross out its multiples, starting at p × p',
    '  (anything smaller was already struck by a smaller prime)',
    'stop once p × p is past n; whatever is left standing is prime',
  ],
  *run({ limit }) {
    const from = 2, to = Math.max(2, limit);
    const count = to - from + 1;
    const states = new Uint8Array(count);
    const struck = new Uint8Array(count);

    let primes = 0, crossings = 0, saved = 0;
    const at = (v) => v - from;
    const f = (extra) => ({
      from, to,
      states: states.slice(),
      stats: { primes, 'numbers crossed out': crossings, 'skipped by starting at p²': saved },
      ...extra,
    });

    yield f({ line: 0, note: `every number from 2 to ${to}, nothing decided yet` });

    for (let p = from; p * p <= to; p++) {
      if (struck[at(p)]) continue;

      states[at(p)] = NUM.CURRENT;
      primes++;
      yield f({ line: 1, note: `${p} is still standing, so it is prime — now cross out its multiples` });

      // Everything below p² has a factor smaller than p and was struck already.
      saved += Math.max(0, Math.floor((p * p - 2 * p) / p) + (p * p > 2 * p ? 1 : 0));

      for (let m = p * p; m <= to; m += p) {
        if (struck[at(m)]) {
          states[at(m)] = NUM.SKIPPED;
          yield f({ line: 2, note: `${m} was already crossed out by a smaller prime` });
          states[at(m)] = NUM.STRUCK;
          continue;
        }
        struck[at(m)] = 1;
        crossings++;
        states[at(m)] = NUM.MARKING;
        yield f({ line: 2, note: `${m} = ${p} × ${m / p}, so it is not prime` });
        states[at(m)] = NUM.STRUCK;
      }

      states[at(p)] = NUM.KEPT;
      yield f({ line: 3, note: `done with ${p}` });
    }

    // Whatever is left standing is prime.
    const found = [];
    for (let v = from; v <= to; v++) {
      if (!struck[at(v)]) { states[at(v)] = NUM.KEPT; found.push(v); }
    }
    primes = found.length;

    yield f({
      line: 4,
      note: `${found.length} primes up to ${to}` +
        (found.length <= 24 ? `: ${found.join(', ')}` : `, the largest being ${found[found.length - 1]}`),
    });
  },
};

export const MATH = [sieve];
