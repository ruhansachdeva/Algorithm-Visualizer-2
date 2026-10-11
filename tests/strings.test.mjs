/* String matching: all five matchers must find exactly the same occurrences,
   since they solve an identical problem by different means. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'strings';

const TEXTS = ['ABACADABRABRACADABRA', 'AAAAAAAAAAAA', 'THE QUICK BROWN FOX',
               'ABABABABAB', 'MISSISSIPPI', 'XYZ', '', 'AABAACAADAABAABA'];
const PATTERNS = ['ABRA', 'A', 'AAAAB', 'AB', 'ISSI', 'XYZ', 'QQ', 'AABA', 'ABABAB', ''];

const bruteForce = (text, pattern) => {
  const out = [];
  if (!pattern) return out;
  for (let i = 0; i + pattern.length <= text.length; i++) {
    if (text.slice(i, i + pattern.length) === pattern) out.push(i);
  }
  return out;
};

export async function run() {
  reset();
  const { STRINGS } = await load('algorithms/strings/index.js');
  const { record } = await load('engine/player.js');

  // The matchers take a text AND a pattern; the palindrome finder does not.
  const matchers = STRINGS.filter((a) => a.input === 'string');

  for (const text of TEXTS) {
    for (const pattern of PATTERNS) {
      const want = bruteForce(text, pattern);
      for (const algo of matchers) {
        let frames;
        try {
          frames = record(algo.run({ text, pattern }), 300000);
        } catch (err) {
          check(false, `${algo.id} threw on "${text}"/"${pattern}": ${err.message}`);
          continue;
        }
        // matchesAt is always in coordinates of the ORIGINAL text; `found`
        // drives highlighting and is not always the same thing.
        const got = frames.at(-1).matchesAt || [];
        check(JSON.stringify(got) === JSON.stringify(want),
          `${algo.id} on "${text}"/"${pattern}": found [${got}], expected [${want}]`);
      }
    }
  }

  /* Boyer-Moore's claim is that it skips characters outright, so on
     skip-friendly text it must beat naive search on comparisons. */
  const cmp = (id, text, pattern) =>
    record(STRINGS.find((a) => a.id === id).run({ text, pattern }), 300000).at(-1).stats.comparisons;
  const bm = cmp('str-boyer-moore', 'THE QUICK BROWN FOX JUMPS OVER A LAZY DOG AND THEN SLEEPS', 'SLEEPS');
  const naive = cmp('str-naive', 'THE QUICK BROWN FOX JUMPS OVER A LAZY DOG AND THEN SLEEPS', 'SLEEPS');
  check(bm < naive, `Boyer-Moore used ${bm} comparisons against naive's ${naive} — it should use fewer`);

  /* Longest palindrome: the answer must be a real palindrome, a real
     substring, and of maximal length. */
  const pal = STRINGS.find((a) => a.id === 'str-palindrome');
  const palRef = (s) => {
    let best = '';
    for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) {
      const t = s.slice(i, j + 1);
      if (t === [...t].reverse().join('') && t.length > best.length) best = t;
    }
    return best;
  };
  const cases = ['BANANARAMA', 'FORGEEKSSKEEGFOR', 'ABCDEFG', 'A', 'ABBA', 'RACECAR'];
  for (let t = 0; t < 40; t++) {
    cases.push(Array.from({ length: 1 + Math.floor(Math.random() * 12) }, () => 'ABC'[Math.floor(Math.random() * 3)]).join(''));
  }
  for (const s of cases) {
    const m = record(pal.run({ text: s }), 200000).at(-1).note.match(/palindrome is "(.*?)"/);
    if (!check(m !== null, `no palindrome reported for "${s}"`)) continue;
    const got = m[1];
    check(got.length === palRef(s).length, `longest palindrome in "${s}": got "${got}", wanted length ${palRef(s).length}`);
    check(got === [...got].reverse().join(''), `"${got}" is not a palindrome`);
    check(s.includes(got), `"${got}" is not a substring of "${s}"`);
  }

  return tally();
}
