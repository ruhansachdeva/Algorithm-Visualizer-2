/* ============================================================
   Seeded random numbers.
   ------------------------------------------------------------
   Everything random in this app — the array you sort, the walls
   on the board, the shape of a graph, the shuffles inside bogo
   sort — comes from here rather than Math.random().

   The reason is sharing. A link like #quick@120 is meant to show
   someone a specific moment, but with Math.random() they open it
   and see a different array at step 120, which makes the link
   almost useless. With a seed in the URL they see exactly what
   you saw.
   ============================================================ */

/**
 * mulberry32 — small, fast, and good enough for picking test data.
 * Not for anything where randomness has to be unguessable.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seed = (Math.random() * 0xFFFFFFFF) >>> 0;
let next = mulberry32(seed);

/** The current seed, as a short string suitable for a URL. */
export const getSeed = () => seed.toString(36);

/** Adopt a seed (from a URL). Returns false if it isn't a usable one. */
export function setSeed(value) {
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 36);
  if (!Number.isFinite(parsed)) return false;
  seed = parsed >>> 0;
  next = mulberry32(seed);
  return true;
}

/** Start again from a fresh seed — what "new array" and friends do. */
export function reseed() {
  seed = (Math.random() * 0xFFFFFFFF) >>> 0;
  next = mulberry32(seed);
  return seed;
}

/** Rewind to the start of the current seed, so a re-run repeats exactly. */
export const rewind = () => { next = mulberry32(seed); };

/* ── the same shapes as Math.random, but reproducible ── */

export const random = () => next();
export const randInt = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
export const pick = (arr) => arr[Math.floor(next() * arr.length)];

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
