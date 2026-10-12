/* ============================================================
   What you have worked through, kept in the browser.

   IDEAS.md: "Browser storage is probably enough; no accounts." It is,
   with one caveat worth stating plainly on the page: this lives in one
   browser on one device, and clearing site data clears it. Nothing here
   is worth a login.

   Every read and write is wrapped, because localStorage throws rather
   than returning null in a private window and in a few other cases, and
   a quiz that cannot record a score should still let you take it.
   ============================================================ */

const KEY = 'av2:progress';
const VERSION = 2;

const blank = () => ({
  v: VERSION,
  answers: {},     // questionId -> { right, wrong, lastRight, lastAt }
  byAlgo: {},      // algoId     -> { right, wrong }
  byKind: {},      // question kind -> { right, wrong }
  streak: { current: 0, best: 0 },
  totals: { right: 0, wrong: 0 },
});

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // An older shape is not worth migrating for a practice score;
      // better to start clean than to crash on a missing field.
      cache = parsed?.v === VERSION ? { ...blank(), ...parsed } : blank();
    } else {
      cache = blank();
    }
  } catch {
    cache = blank();
  }
  return cache;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
}

const bump = (bucket, key, right) => {
  const slot = (bucket[key] ??= { right: 0, wrong: 0 });
  slot[right ? 'right' : 'wrong']++;
};

/** Record one answer. */
export function record({ id, kind, algo, right }) {
  const p = read();

  const slot = (p.answers[id] ??= { right: 0, wrong: 0, lastRight: null, lastAt: 0 });
  slot[right ? 'right' : 'wrong']++;
  slot.lastRight = right;
  slot.lastAt = Date.now();

  if (algo) bump(p.byAlgo, algo, right);
  if (kind) bump(p.byKind, kind, right);

  p.totals[right ? 'right' : 'wrong']++;
  p.streak.current = right ? p.streak.current + 1 : 0;
  p.streak.best = Math.max(p.streak.best, p.streak.current);

  write();
  return slot;
}

export function stats() {
  const p = read();
  const { right, wrong } = p.totals;
  const answered = right + wrong;
  return {
    answered,
    right,
    wrong,
    percent: answered ? Math.round((right / answered) * 100) : null,
    streak: p.streak.current,
    best: p.streak.best,
    distinct: Object.keys(p.answers).length,
  };
}

export function byKind() { return { ...read().byKind }; }
export function byAlgo() { return { ...read().byAlgo }; }

/**
 * Questions last answered wrongly — the point of tracking progress is
 * knowing what to go back to, not the score.
 */
export function needsRevisit() {
  const p = read();
  return Object.entries(p.answers)
    .filter(([, s]) => s.lastRight === false)
    .sort((a, b) => a[1].lastAt - b[1].lastAt)
    .map(([id]) => id);
}

/** Has this exact question been answered correctly already? */
export function isSettled(id) {
  return read().answers[id]?.lastRight === true;
}

/**
 * Pick the next question, preferring ones not yet seen, then ones last
 * got wrong, and leaving settled questions until last. Within a tier the
 * order is random, so the same run is not the same run twice.
 */
export function prioritise(questions) {
  const p = read();
  const tier = (q) => {
    const s = p.answers[q.id];
    if (!s) return 0;                       // never attempted
    if (s.lastRight === false) return 1;    // got it wrong last time
    return 2;                               // already settled
  };
  return [...questions]
    .map((q) => ({ q, t: tier(q), r: Math.random() }))
    .sort((a, b) => a.t - b.t || a.r - b.r)
    .map((x) => x.q);
}

/** Per-category mastery, for the progress panel. */
export function categoryProgress(questions) {
  const p = read();
  const out = new Map();
  for (const q of questions) {
    const key = q.categoryName ?? 'General';
    const slot = out.get(key) ?? { total: 0, settled: 0, wrong: 0 };
    slot.total++;
    const s = p.answers[q.id];
    if (s?.lastRight === true) slot.settled++;
    else if (s?.lastRight === false) slot.wrong++;
    out.set(key, slot);
  }
  return out;
}

export function reset() {
  cache = blank();
  try { localStorage.removeItem(KEY); } catch {}
}
