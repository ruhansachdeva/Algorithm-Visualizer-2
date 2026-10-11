/* ============================================================
   Z-ALGORITHM
   ------------------------------------------------------------
   For every position i, Z[i] is the length of the longest stretch
   starting at i that also matches the start of the string.

   On its own that sounds abstract. The trick that makes it a
   pattern matcher: glue the pattern, a character that appears in
   neither, and the text into one string. Anywhere Z equals the
   pattern's length, the pattern occurs — and the separator is
   what stops a match running off the end of the pattern into the
   text and over-counting.

   It stays linear by reusing work: the [l, r] window is the
   rightmost stretch already known to match the prefix, so inside
   it the answer can be copied from an earlier position instead of
   being recomputed.
   ============================================================ */

const SEP = '|';

const zAlgorithm = {
  view: 'string',
  input: 'string',
  id: 'str-z',
  name: 'Z-Algorithm',
  legend: [
    ['--c-compare', 'comparing to the prefix'],
    ['--c-swap',    'mismatch — the stretch ends here'],
    ['--c-range',   'the [l, r] window already known'],
    ['--c-found',   'a full match'],
  ],
  about: 'For each position, how long a stretch starting there also matches the start of the string? Glue pattern + separator + text together and every place that number equals the pattern length is an occurrence. It stays linear by never redoing work: the [l, r] window is the rightmost stretch already known to match the prefix, and inside it the answer can be copied from an earlier position rather than recomputed.',
  cost: { best: 'O(n + m)', avg: 'O(n + m)', worst: 'O(n + m)', space: 'O(n + m)', stable: '—' },
  pseudocode: [
    'glue pattern + separator + text into one string',
    'keep a window [l, r]: the rightmost stretch matching the prefix',
    'for each position i:',
    '  if i is inside the window, copy the answer from i - l',
    '  then extend by direct comparison for as long as it matches',
    '  wherever Z equals the pattern length, the pattern occurs',
  ],
  *run({ text, pattern }) {
    if (!pattern || !text) { yield { text: text || '', pattern: '', note: 'need both a pattern and a text' }; return; }

    const s = pattern + SEP + text;
    const n = s.length;
    const m = pattern.length;
    const z = new Array(n).fill(0);
    const found = [];        // offsets in the ORIGINAL text
    const marks = [];        // the same matches, in concatenated coordinates
    let comparisons = 0, copied = 0;

    const f = (extra) => ({
      text: s, pattern: '',
      table: { label: `Z — how much of the start repeats here (a ${m} means the pattern)`, values: [...z], keys: s.split('') },
      spans: marks.map((k) => [k, k + m - 1]),
      stats: { comparisons, 'answers copied, not recomputed': copied, matches: found.length },
      ...extra,
    });

    yield f({ line: 0, note: `"${pattern}" + "${SEP}" + "${text}" — the separator stops a match spilling out of the pattern` });

    let l = 0, r = 0;
    for (let i = 1; i < n; i++) {
      if (i < r) {
        // inside the known window: the answer at i-l is a safe starting point
        z[i] = Math.min(r - i, z[i - l]);
        copied++;
        yield f({
          probe: [i], span: null, line: 3,
          note: `${i} is inside the window [${l}, ${r}) — copy ${z[i]} from position ${i - l} instead of comparing`,
        });
      }

      while (i + z[i] < n && s[z[i]] === s[i + z[i]]) {
        comparisons++;
        z[i]++;
      }
      if (i + z[i] < n) comparisons++;

      yield f({
        probe: [i], line: 4,
        note: z[i] ? `${z[i]} character(s) from position ${i} match the start` : `nothing at position ${i} matches the start`,
      });

      if (i + z[i] > r) { l = i; r = i + z[i]; }

      if (z[i] === m) {
        const at = i - m - 1;
        found.push(at);
        marks.push(i);
        yield f({
          probe: [i], line: 5,
          note: `Z is ${m}, the whole pattern — it occurs at index ${at} of the text`,
        });
      }
    }

    yield f({
      line: 5,
      note: found.length
        ? `${found.length} match${found.length === 1 ? '' : 'es'} at ${found.join(', ')} — ${comparisons} comparisons, with ${copied} answers copied rather than recomputed`
        : `no match — ${comparisons} comparisons`,
      matchesAt: [...found],
    });
  },
};

export const ZALGO = [zAlgorithm];
