/* Number theory and geometry. Both are areas where an implementation can
   be subtly wrong in ways that look fine on a screen, so both are held to
   an independent reference. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'number theory & geometry';

export async function run() {
  reset();
  const { MATH } = await load('algorithms/math/index.js');
  const { GEOMETRY } = await load('algorithms/geometry/index.js');
  const { NUM } = await load('views/number-view.js');
  const { record } = await load('engine/player.js');
  const last = (gen) => record(gen, 600000).at(-1);

  /* ── the sieve against trial division ── */
  const sieve = MATH.find((a) => a.id === 'math-sieve');
  const primesByTrialDivision = (n) => {
    const out = [];
    for (let i = 2; i <= n; i++) {
      let prime = true;
      for (let d = 2; d * d <= i; d++) if (i % d === 0) { prime = false; break; }
      if (prime) out.push(i);
    }
    return out;
  };
  for (const n of [10, 13, 30, 97, 100, 199, 400]) {
    const f = last(sieve.run({ limit: n }));
    const got = [];
    for (let i = 0; i < f.states.length; i++) if (f.states[i] === NUM.KEPT) got.push(2 + i);
    check(JSON.stringify(got) === JSON.stringify(primesByTrialDivision(n)),
      `sieve up to ${n} found ${got.length} primes, trial division finds ${primesByTrialDivision(n).length}`);
  }

  /* ── Euclid ── */
  const gcd = MATH.find((a) => a.id === 'math-gcd');
  const gcdRef = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
  for (let t = 0; t < 200; t++) {
    const a = 1 + Math.floor(Math.random() * 9999);
    const b = Math.floor(Math.random() * 9999);
    check(last(gcd.run({ a, b })).stats.gcd === gcdRef(a, b), `gcd(${a}, ${b}) wrong`);
  }

  /* ── fast exponentiation against repeated multiplication ── */
  const pow = MATH.find((a) => a.id === 'math-fast-power');
  for (const [base, exp, mod] of [[7, 19, 1000000007], [2, 10, 1000], [3, 1, 7], [5, 255, 1000000007], [1, 50, 13]]) {
    let want = 1n; const b = BigInt(base) % BigInt(mod);
    for (let e = exp; e > 0; e--) want = (want * b) % BigInt(mod);
    check(last(pow.run({ base, exp, mod })).stats.result === want.toString(), `${base}^${exp} mod ${mod} wrong`);
  }

  /* ── the two convex hulls must agree, and contain every point ── */
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const [graham, jarvis, closest] = GEOMETRY;
  for (let t = 0; t < 60; t++) {
    const pts = Array.from({ length: 3 + Math.floor(Math.random() * 25) }, () => ({ x: Math.random(), y: Math.random() }));
    const g = new Set(last(graham.run({ points: pts })).hull);
    const j = new Set(last(jarvis.run({ points: pts })).hull);
    check(g.size === j.size && [...g].every((i) => j.has(i)),
      'Graham scan and gift wrapping disagree on which points are corners');

    const hull = [...j].map((i) => pts[i]);
    const outside = pts.some((q) => hull.some((_, i) => cross(hull[i], hull[(i + 1) % hull.length], q) < -1e-9));
    check(!outside, 'a point lies outside the reported hull');
  }

  /* ── closest pair against comparing every pair ── */
  for (let t = 0; t < 60; t++) {
    const pts = Array.from({ length: 2 + Math.floor(Math.random() * 24) }, () => ({ x: Math.random(), y: Math.random() }));
    let want = Infinity;
    for (let i = 0; i < pts.length; i++) for (let k = i + 1; k < pts.length; k++) {
      want = Math.min(want, Math.hypot(pts[i].x - pts[k].x, pts[i].y - pts[k].y));
    }
    const f = last(closest.run({ points: pts }));
    check(Math.abs(Number(f.stats['closest distance']) - want) < 1e-4, `closest pair gave ${f.stats['closest distance']}, wanted ${want.toFixed(4)}`);
    const [a, b] = f.hull;
    check(Math.abs(Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) - want) < 1e-4,
      'the pair it names is not actually the closest pair');
  }

  return tally();
}
