/* Catalogue checks: things that should be true of EVERY algorithm,
   whatever it does. These are the ones that catch a new addition
   wired up incorrectly. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'catalogue';

export async function run() {
  reset();
  const { CATEGORIES, ALL, VIEWS, HIT_TEST } = await load('registry.js');
  const { TRADEOFFS } = await load('tradeoffs.js');

  check(ALL.length > 0, 'the catalogue is empty');

  const ids = new Set();
  for (const algo of ALL) {
    check(!ids.has(algo.id), `two algorithms share the id "${algo.id}"`);
    ids.add(algo.id);

    check(typeof algo.name === 'string' && algo.name.length > 0, `${algo.id} has no name`);
    check(typeof algo.run === 'function', `${algo.id} has no run function`);
    check(typeof algo.about === 'string' && algo.about.length > 40,
      `${algo.id} has no real description — the panel would be empty or useless`);
    check(algo.cost && algo.cost.avg, `${algo.id} has no average-case cost`);
    check(Array.isArray(algo.pseudocode) && algo.pseudocode.length > 0, `${algo.id} has no pseudocode`);

    check(VIEWS[algo.view] !== undefined,
      `${algo.id} declares the view "${algo.view}", which nothing knows how to draw`);
    check(typeof algo.input === 'string' && algo.input.length > 0,
      `${algo.id} declares no input type, so no controls would appear`);
  }

  /* Every algorithm needs a trade-offs entry. A new one added without
     prose leaves the panel empty, which looks like a bug and is the kind
     of omission nobody notices until a user does. */
  for (const algo of ALL) {
    const t = TRADEOFFS[algo.id];
    if (!check(t !== undefined, `${algo.id} has no trade-offs entry`)) continue;
    check(Array.isArray(t.pros) && t.pros.length > 0, `${algo.id} lists no pros`);
    check(Array.isArray(t.cons) && t.cons.length > 0,
      `${algo.id} lists no cons — every algorithm has a downside, even if it is only narrow applicability`);
    check(typeof t.useWhen === 'string' && t.useWhen.length > 10, `${algo.id} does not say when to reach for it`);
    check(typeof t.avoid === 'string' && t.avoid.length > 5, `${algo.id} does not say when to avoid it`);
    // Length is a poor proxy for usefulness — "Not stable." is short and
    // says something real. Reject content-free filler by name instead.
    const FILLER = ['slow', 'fast', 'inefficient', 'efficient', 'simple', 'complex', 'good', 'bad'];
    for (const line of [...t.pros, ...t.cons]) {
      const bare = line.toLowerCase().replace(/[^a-z ]/g, '').trim();
      check(!FILLER.includes(bare), `${algo.id} has a content-free trade-off: "${line}"`);
      check(line.trim().length > 0, `${algo.id} has an empty trade-off`);
    }
  }

  /* And nothing stale pointing at an algorithm that no longer exists. */
  for (const id of Object.keys(TRADEOFFS)) {
    check(ALL.some((a) => a.id === id) || id.startsWith('segtree'),
      `trade-offs mention "${id}", which is not in the catalogue`);
  }

  /* Every category needs an identity, since the sidebar is built from it. */
  for (const cat of CATEGORIES) {
    check(cat.algorithms.length > 0, `the ${cat.name} category is empty`);
    check(/^#[0-9a-f]{6}$/i.test(cat.color || ''), `the ${cat.name} category has no colour`);
    check(typeof cat.blurb === 'string' && cat.blurb.length > 0, `the ${cat.name} category has no description`);
  }

  /* A pseudocode `line:` that points past the end highlights nothing. */
  check(Object.keys(HIT_TEST).every((v) => VIEWS[v] !== undefined),
    'a hit-test is registered for a view that does not exist');

  /* ── the family guides ──
     Double-clicking a section heading explains the whole family. These
     render through textContent, so any Markdown left in them shows up
     literally on screen — a stray *and* was visible in the Trees guide
     before this existed. Note that "A*" is an algorithm, not emphasis. */
  {
    const { GUIDES } = await import('./../js/category-guides.mjs');
    const parts = ['what', 'when', 'choosing', 'watch'];

    for (const cat of CATEGORIES) {
      const guide = GUIDES[cat.id];
      check(!!guide, `category "${cat.id}" has no guide, so double-clicking it would do nothing`);
      if (!guide) continue;
      for (const part of parts) {
        const text = guide[part];
        check(typeof text === 'string' && text.length > 90,
          `${cat.id}.${part} is missing or too thin to be worth reading`);
        if (!text) continue;
        const emphasis = text.match(/(?<![A-Za-z])\*[^*\s][^*]*\*|_[^_]+_|`/);
        check(!emphasis,
          `${cat.id}.${part} contains Markdown (${emphasis?.[0]}) — it is rendered as plain text and would show the markup`);
      }
      // It is about the family. A guide that only names one algorithm has
      // drifted into being a Learn page.
      check(!/^(This algorithm|It )/.test(guide.what),
        `${cat.id}.what reads like it is describing a single algorithm`);
    }

    for (const id of Object.keys(GUIDES)) {
      check(CATEGORIES.some((c) => c.id === id), `GUIDES has "${id}", which is not a category`);
    }
  }

  return tally();
}
