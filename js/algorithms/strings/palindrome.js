/* ============================================================
   LONGEST PALINDROMIC SUBSTRING
   ------------------------------------------------------------
   Every palindrome has a centre. There are 2n-1 of them — one on
   each character, and one in each gap between two characters —
   and that second kind is what catches even-length palindromes
   like "abba", which is the part people forget.

   So: stand on each centre in turn and push outwards while the
   characters still match. O(n²) in the worst case, but with a
   tiny constant and no extra memory.
   ============================================================ */

import { STRING_LEGEND } from '../../views/string-view.js';

const palindrome = {
  view: 'string',
  input: 'palindrome',
  id: 'str-palindrome',
  name: 'Longest Palindrome',
  legend: [
    ['--c-compare', 'characters being compared'],
    ['--c-swap',    'they differ — this centre is done'],
    ['--c-found',   'longest palindrome so far'],
  ],
  about: 'The longest stretch of the text that reads the same backwards. Every palindrome has a centre, and there are 2n-1 of them: one on each character and one in each gap between two characters. That second kind is what catches even-length palindromes like "abba", and is the case people forget. Stand on each centre and push outwards while the characters match.',
  cost: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'for each of the 2n-1 possible centres:',
    '  (n on a character, n-1 in the gaps between characters)',
    '  push left and right outwards while the two match',
    '  stop at a mismatch or at either end of the text',
    '  remember the longest stretch seen',
  ],
  *run({ text }) {
    const n = text.length;
    if (!n) { yield { text, pattern: '', note: 'type something' }; return; }

    let bestLo = 0, bestHi = 0, comparisons = 0, centres = 0;

    const f = (extra) => ({
      text, pattern: '',
      spans: [[bestLo, bestHi]],
      stats: { centres, comparisons, longest: bestHi - bestLo + 1 },
      ...extra,
    });

    yield f({ line: 0, note: `${2 * n - 1} centres to try` });

    for (let c = 0; c < 2 * n - 1; c++) {
      // Even c sits on a character; odd c sits in the gap after it.
      let lo = c >> 1;
      let hi = lo + (c & 1);
      centres++;

      if (c & 1 && text[lo] !== text[hi]) {
        comparisons++;
        yield f({ probe: [lo, hi], mismatch: true, line: 1, note: `gap centre between '${text[lo]}' and '${text[hi]}' — they differ, nothing here` });
        continue;
      }

      yield f({ probe: [lo, hi], line: 1, note: (c & 1) ? `centre in the gap after index ${lo}` : `centre on '${text[lo]}' at index ${lo}` });

      // push outwards
      while (lo > 0 && hi < n - 1) {
        comparisons++;
        const same = text[lo - 1] === text[hi + 1];
        yield f({
          probe: [lo - 1, hi + 1], mismatch: !same, line: 2,
          note: `'${text[lo - 1]}' vs '${text[hi + 1]}' — ${same ? 'still a palindrome, keep going' : 'differ, stop here'}`,
        });
        if (!same) break;
        lo--; hi++;
      }

      if (hi - lo > bestHi - bestLo) {
        bestLo = lo; bestHi = hi;
        yield f({ line: 4, note: `new longest: "${text.slice(lo, hi + 1)}" (${hi - lo + 1} characters)` });
      }
    }

    yield f({
      line: 4,
      note: `longest palindrome is "${text.slice(bestLo, bestHi + 1)}" — ${bestHi - bestLo + 1} characters, found in ${comparisons} comparisons`,
    });
  },
};

export const PALINDROME = [palindrome];
