/* ============================================================
   STRING MATCHING
   ------------------------------------------------------------
   All four answer "where does this pattern occur in this text?"
   and all four differ in one place only: how far they slide the
   pattern after a mismatch.

     Naive        always by 1 — throws away everything it learned
     KMP          by as much as the matched prefix allows
     Boyer-Moore  reads right-to-left and can skip whole words
     Rabin-Karp   compares a rolling hash instead of characters
   ============================================================ */

import { STRING_LEGEND } from '../../views/string-view.js';
import { PALINDROME } from './palindrome.js';
import { ZALGO } from './zalgo.js';

const base = { view: 'string', input: 'string', legend: STRING_LEGEND };

/* ───────────────────────── Naive ───────────────────────── */

const naive = {
  ...base,
  id: 'str-naive',
  name: 'Naive Search',
  about: 'Line the pattern up at position 0, compare left to right, and on any mismatch slide along by exactly one and start over. Simple and often fine — but it forgets everything it just learned, so a text of a-repeated with a pattern of a-repeated-then-b makes it re-compare nearly every character at every offset.',
  cost: { best: 'O(n)', avg: 'O(n·m)', worst: 'O(n·m)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'for each starting offset in the text:',
    '  compare the pattern character by character',
    '  on a mismatch, give up on this offset',
    '  slide along by exactly 1 and try again',
  ],
  *run({ text, pattern }) {
    const n = text.length, m = pattern.length;
    const found = [];
    let comparisons = 0;
    if (!m) { yield { text, pattern, note: 'empty pattern' }; return; }

    for (let offset = 0; offset + m <= n; offset++) {
      let k = 0;
      for (; k < m; k++) {
        comparisons++;
        const hit = text[offset + k] === pattern[k];
        yield {
          text, pattern, offset, at: k, ok: k, mismatch: !hit, found: [...found], line: 1,
          note: `'${text[offset + k]}' vs '${pattern[k]}' — ${hit ? 'match' : 'mismatch, start over one along'}`,
          stats: { comparisons, offset, matches: found.length },
        };
        if (!hit) break;
      }
      if (k === m) {
        found.push(offset);
        yield { text, pattern, offset, ok: m, found: [...found], line: 1, note: `full match at index ${offset}`, stats: { comparisons, offset, matches: found.length } };
      }
    }
    yield { text, pattern, offset: n, found: [...found], matchesAt: [...found], note: summarise(found, comparisons), stats: { comparisons, matches: found.length } };
  },
};

/**
 * The match offsets, in coordinates of the ORIGINAL text, on the closing
 * frame of every matcher. `found` drives highlighting and is not always in
 * the same coordinates — the Z-algorithm displays a concatenated string —
 * so anything reading the ANSWER should read this.
 */
function summarise(found, comparisons) {
  return found.length
    ? `found ${found.length} match${found.length === 1 ? '' : 'es'} at ${found.join(', ')} using ${comparisons} character comparisons`
    : `no match — ${comparisons} character comparisons`;
}

/* ───────────────────────── KMP ─────────────────────────── */

const kmp = {
  ...base,
  id: 'str-kmp',
  name: 'Knuth-Morris-Pratt',
  about: 'Never re-reads a character of the text. Before searching it builds a prefix table: for each position in the pattern, the length of the longest piece that is both a prefix and a suffix. On a mismatch that number says exactly how far the pattern can jump without missing anything — so the text pointer only ever moves forward, giving O(n + m).',
  cost: { best: 'O(n + m)', avg: 'O(n + m)', worst: 'O(n + m)', space: 'O(m)', stable: '—' },
  pseudocode: [
    'build the prefix table for the pattern',
    'walk the text with one pointer that never goes backwards',
    'on a match, advance both pointers',
    'on a mismatch, slide the pattern using the table',
    '  (the text pointer stays put)',
  ],
  *run({ text, pattern }) {
    const n = text.length, m = pattern.length;
    if (!m) { yield { text, pattern, note: 'empty pattern' }; return; }

    /* ── build the prefix table ── */
    const lps = new Array(m).fill(0);
    const tbl = (hi) => ({ label: 'prefix table — longest piece that is both a prefix and a suffix', values: [...lps], keys: pattern.split(''), highlight: hi });

    yield { text, pattern, offset: 0, table: tbl(0), line: 0, note: 'first, work out how far the pattern can safely jump', stats: { comparisons: 0, 'text re-reads': 0 } };

    let len = 0, i = 1;
    while (i < m) {
      if (pattern[i] === pattern[len]) {
        lps[i] = ++len;
        yield { text, pattern, offset: 0, table: tbl(i), line: 0, note: `"${pattern.slice(0, len)}" is both a prefix and a suffix of "${pattern.slice(0, i + 1)}"`, stats: { comparisons: 0, 'text re-reads': 0 } };
        i++;
      } else if (len) {
        len = lps[len - 1];
      } else {
        lps[i] = 0;
        yield { text, pattern, offset: 0, table: tbl(i), line: 0, note: `no repeated prefix at '${pattern[i]}'`, stats: { comparisons: 0, 'text re-reads': 0 } };
        i++;
      }
    }

    /* ── search ── */
    const found = [];
    let comparisons = 0, skipped = 0;
    let ti = 0, pi = 0;

    while (ti < n) {
      comparisons++;
      const hit = text[ti] === pattern[pi];
      yield {
        text, pattern, offset: ti - pi, at: pi, ok: pi, mismatch: !hit, found: [...found],
        table: tbl(pi), line: hit ? 2 : 3,
        note: `'${text[ti]}' vs '${pattern[pi]}' — ${hit ? 'match' : 'mismatch'}`,
        stats: { comparisons, 'positions skipped': skipped, matches: found.length },
      };

      if (hit) {
        ti++; pi++;
        if (pi === m) {
          found.push(ti - m);
          yield { text, pattern, offset: ti - m, ok: m, found: [...found], table: tbl(m - 1), line: 2, note: `full match at index ${ti - m}`, stats: { comparisons, 'positions skipped': skipped, matches: found.length } };
          pi = lps[pi - 1];
        }
      } else if (pi) {
        const jump = pi - lps[pi - 1];
        skipped += jump - 1;
        pi = lps[pi - 1];
        yield {
          text, pattern, offset: ti - pi, ok: pi, found: [...found], table: tbl(Math.max(0, pi - 1)), line: 3,
          note: `the table says "${pattern.slice(0, pi)}" already matches here — jump ${jump} ahead without re-reading the text`,
          stats: { comparisons, 'positions skipped': skipped, matches: found.length },
        };
      } else {
        ti++;
      }
    }

    yield { text, pattern, offset: n, found: [...found], matchesAt: [...found], table: tbl(null), note: summarise(found, comparisons), stats: { comparisons, 'positions skipped': skipped, matches: found.length } };
  },
};

/* ──────────────────────── Rabin-Karp ───────────────────── */

const rabinKarp = {
  ...base,
  id: 'str-rabin-karp',
  name: 'Rabin-Karp',
  about: 'Compares numbers instead of characters. It hashes the pattern once, then rolls a hash along the text — dropping the leaving character and adding the entering one in constant time. Only when two hashes agree does it bother checking the actual characters, because different strings can collide.',
  cost: { best: 'O(n + m)', avg: 'O(n + m)', worst: 'O(n·m)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'hash the pattern, and the first window of the text',
    'for each offset:',
    '  if the hashes differ, the strings differ — skip it instantly',
    '  if they match, verify character by character (hashes can collide)',
    '  roll the hash forward one character',
  ],
  *run({ text, pattern }) {
    const n = text.length, m = pattern.length;
    if (!m || m > n) { yield { text, pattern, note: m ? 'pattern is longer than the text' : 'empty pattern' }; return; }

    const BASE = 256, MOD = 101;
    const code = (ch) => ch.charCodeAt(0);

    let patHash = 0, winHash = 0, high = 1;
    for (let i = 0; i < m - 1; i++) high = (high * BASE) % MOD;
    for (let i = 0; i < m; i++) {
      patHash = (BASE * patHash + code(pattern[i])) % MOD;
      winHash = (BASE * winHash + code(text[i])) % MOD;
    }

    const found = [];
    let comparisons = 0, hashChecks = 0, collisions = 0;
    const tbl = (wh) => ({ label: `pattern hash ${patHash}  ·  window hash ${wh}`, values: [], keys: [] });

    yield { text, pattern, offset: 0, line: 0, note: `pattern "${pattern}" hashes to ${patHash}`, stats: { 'hash checks': 0, comparisons: 0, collisions: 0 } };

    for (let offset = 0; offset + m <= n; offset++) {
      hashChecks++;
      const same = winHash === patHash;
      yield {
        text, pattern, offset, found: [...found], line: 2,
        note: `window "${text.slice(offset, offset + m)}" hashes to ${winHash} — ${same ? 'matches the pattern hash, worth checking' : 'different, skip without reading a single character'}`,
        stats: { 'hash checks': hashChecks, comparisons, collisions },
      };

      if (same) {
        let k = 0;
        for (; k < m; k++) {
          comparisons++;
          const hit = text[offset + k] === pattern[k];
          yield {
            text, pattern, offset, at: k, ok: k, mismatch: !hit, found: [...found], line: 3,
            note: `verifying '${text[offset + k]}' vs '${pattern[k]}'`,
            stats: { 'hash checks': hashChecks, comparisons, collisions },
          };
          if (!hit) break;
        }
        if (k === m) {
          found.push(offset);
          yield { text, pattern, offset, ok: m, found: [...found], line: 3, note: `full match at index ${offset}`, stats: { 'hash checks': hashChecks, comparisons, collisions } };
        } else {
          collisions++;
          yield { text, pattern, offset, found: [...found], line: 3, note: 'the hashes agreed but the strings did not — a collision', stats: { 'hash checks': hashChecks, comparisons, collisions } };
        }
      }

      // roll the window one character forward
      if (offset + m < n) {
        winHash = (BASE * (winHash - code(text[offset]) * high) + code(text[offset + m])) % MOD;
        if (winHash < 0) winHash += MOD;
      }
    }

    yield { text, pattern, offset: n, found: [...found], matchesAt: [...found], note: `${summarise(found, comparisons)} — plus ${hashChecks} hash checks and ${collisions} collision${collisions === 1 ? '' : 's'}`, stats: { 'hash checks': hashChecks, comparisons, collisions } };
  },
};

/* ───────────────────── Boyer-Moore ─────────────────────── */

const boyerMoore = {
  ...base,
  id: 'str-boyer-moore',
  name: 'Boyer-Moore',
  about: 'Compares the pattern RIGHT to left. If the text character it lands on appears nowhere in the pattern, the whole pattern can leap past it in one move — so long patterns actually search faster, and on typical text it reads only a fraction of the characters. This is roughly what your editor\'s find does.',
  cost: { best: 'O(n / m)', avg: 'O(n / m)', worst: 'O(n·m)', space: 'O(k)', stable: '—' },
  pseudocode: [
    'note the last position of each character in the pattern',
    'align the pattern, then compare from its RIGHT end backwards',
    'on a mismatch, look up the offending text character',
    '  if it is not in the pattern, skip the whole width',
    '  otherwise slide just far enough to line it up',
  ],
  *run({ text, pattern }) {
    const n = text.length, m = pattern.length;
    if (!m || m > n) { yield { text, pattern, note: m ? 'pattern is longer than the text' : 'empty pattern' }; return; }

    // last occurrence of each character in the pattern
    const lastPos = new Map();
    for (let i = 0; i < m; i++) lastPos.set(pattern[i], i);

    const uniq = [...new Set(pattern.split(''))];
    const tbl = (hi) => ({
      label: 'last position of each character in the pattern',
      values: uniq.map((ch) => lastPos.get(ch)),
      keys: uniq,
      highlight: hi === undefined ? null : uniq.indexOf(hi),
    });

    const found = [];
    let comparisons = 0, skipped = 0;

    yield { text, pattern, offset: 0, table: tbl(), line: 0, note: 'noting where each character last appears in the pattern', stats: { comparisons: 0, 'characters skipped': 0, matches: 0 } };

    let offset = 0;
    while (offset + m <= n) {
      let k = m - 1;
      while (k >= 0) {
        comparisons++;
        const hit = text[offset + k] === pattern[k];
        yield {
          text, pattern, offset, at: k, ok: m - 1 - k, mismatch: !hit, found: [...found],
          table: tbl(text[offset + k]), line: 1,
          note: `from the right: '${text[offset + k]}' vs '${pattern[k]}' — ${hit ? 'match' : 'mismatch'}`,
          stats: { comparisons, 'characters skipped': skipped, matches: found.length },
        };
        if (!hit) break;
        k--;
      }

      if (k < 0) {
        found.push(offset);
        yield { text, pattern, offset, ok: m, found: [...found], table: tbl(), line: 1, note: `full match at index ${offset}`, stats: { comparisons, 'characters skipped': skipped, matches: found.length } };
        offset += 1;
      } else {
        const bad = text[offset + k];
        const last = lastPos.has(bad) ? lastPos.get(bad) : -1;
        const shift = Math.max(1, k - last);
        skipped += shift - 1;
        yield {
          text, pattern, offset, found: [...found], table: tbl(bad), line: 2,
          note: last === -1
            ? `'${bad}' is nowhere in the pattern — jump the whole width, ${shift} places`
            : `'${bad}' appears at position ${last} in the pattern — slide ${shift} to line them up`,
          stats: { comparisons, 'characters skipped': skipped, matches: found.length },
        };
        offset += shift;
      }
    }

    yield { text, pattern, offset: n, found: [...found], matchesAt: [...found], table: tbl(), note: `${summarise(found, comparisons)} — skipped ${skipped} characters without ever looking at them`, stats: { comparisons, 'characters skipped': skipped, matches: found.length } };
  },
};

export const STRINGS = [naive, kmp, ...ZALGO, boyerMoore, rabinKarp, ...PALINDROME];
