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


/* ───────────────── Euclid's algorithm (GCD) ────────────── */

const gcd = {
  view: 'array',
  input: 'two-numbers',
  id: 'math-gcd',
  name: "Euclid's GCD",
  legend: [
    ['--c-compare', 'the pair right now'],
    ['--c-sorted',  'the answer'],
  ],
  about: 'The oldest algorithm still in everyday use — about 2,300 years old. To find the largest number dividing both a and b, replace the larger with its remainder when divided by the smaller, and repeat. It works because any number dividing a and b also divides a mod b, so the answer never changes while the numbers collapse. Two four-digit inputs are usually done in under ten steps.',
  cost: { best: 'O(1)', avg: 'O(log min(a,b))', worst: 'O(log min(a,b))', space: 'O(1)', stable: '—' },
  pseudocode: [
    'while b is not zero:',
    '  r = a mod b',
    '  a = b, b = r',
    'when b hits zero, a is the greatest common divisor',
  ],
  *run({ a: a0, b: b0 }) {
    let a = Math.max(1, a0), b = Math.max(0, b0);
    const trail = [];
    let steps = 0;

    const f = (extra) => ({
      array: [a, b],
      aux: trail.length ? { label: 'remainders along the way', values: [...trail] } : undefined,
      stats: { steps, a, b },
      ...extra,
    });

    yield f({ compare: [0, 1], line: 0, note: `gcd(${a}, ${b})` });

    while (b !== 0) {
      const r = a % b;
      steps++;
      yield f({ compare: [0, 1], line: 1, note: `${a} mod ${b} = ${r}` });
      trail.push(r);
      a = b; b = r;
      yield f({ compare: [0, 1], line: 2, note: `now gcd(${a}, ${b})` });
    }

    yield f({ sorted: [0], line: 3, note: `b reached zero, so the answer is ${a}` + (a === 1 ? ' — these two share no factor above 1' : ''), stats: { steps, gcd: a } });
  },
};

/* ──────────────── Fast modular exponentiation ──────────── */

const fastPower = {
  view: 'array',
  input: 'power',
  id: 'math-fast-power',
  name: 'Fast Exponentiation',
  legend: [
    ['--c-compare', 'this bit is 1 — multiply it in'],
    ['--c-idle',    'this bit is 0 — just square'],
    ['--c-sorted',  'result'],
  ],
  about: 'Computing a to the power b by multiplying a by itself b times takes b multiplications. Squaring repeatedly takes about log₂(b). The trick is the binary form of the exponent: each bit says whether to fold the current square into the answer. a^19 needs 19 multiplications the naive way and 8 this way — and the gap widens fast, which is why every public-key cipher depends on it.',
  cost: { best: 'O(1)', avg: 'O(log b)', worst: 'O(log b)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'write the exponent in binary',
    'result = 1, square = the base',
    'for each bit, least significant first:',
    '  if the bit is 1, multiply it into the result',
    '  square the square, and move to the next bit',
  ],
  *run({ base, exp, mod }) {
    const bits = exp.toString(2).split('').reverse();
    let result = 1n;
    let square = BigInt(base) % BigInt(mod);
    const M = BigInt(mod);
    let multiplies = 0;

    const show = () => [Number(result % 100000n), Number(square % 100000n)];
    const f = (extra) => ({
      array: show(),
      aux: { label: `exponent ${exp} in binary (least significant first)`, values: bits.map(Number), keys: bits.map((_, i) => 2 ** i) },
      stats: { multiplications: multiplies, 'naive would take': exp, result: result.toString() },
      ...extra,
    });

    yield f({ line: 1, note: `${base}^${exp} mod ${mod} — exponent in binary is ${exp.toString(2)}` });

    for (let i = 0; i < bits.length; i++) {
      const on = bits[i] === '1';
      yield f({
        aux: { label: `exponent ${exp} in binary (least significant first)`, values: bits.map(Number), keys: bits.map((_, k) => 2 ** k), highlight: i },
        compare: on ? [0, 1] : [1], line: 3,
        note: on
          ? `bit ${i} is 1, so 2^${i} is part of the exponent — fold in the current square`
          : `bit ${i} is 0 — skip the multiply, just square`,
      });

      if (on) { result = (result * square) % M; multiplies++; }
      square = (square * square) % M;
      multiplies++;

      yield f({ line: 4, note: `result is now ${result}, next square is ${square}` });
    }

    yield f({
      sorted: [0], line: 4,
      note: `${base}^${exp} mod ${mod} = ${result} in ${multiplies} multiplications — the naive way would take ${exp}`,
    });
  },
};

export const MATH = [sieve, gcd, fastPower];
