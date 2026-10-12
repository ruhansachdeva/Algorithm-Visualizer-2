/* Markup: a handful of checks across the HTML and the CSS that no
   amount of testing the algorithms can catch, because they are about
   whether the page shows what it computed.

   The one that earns this file: an element the HTML marks `hidden`
   stays visible if its own CSS rule sets `display`, because a class
   selector beats the browser's `[hidden] { display: none }`. It is
   silent — nothing throws, nothing logs — and it has happened four
   times here: the race pane showed when racing was off, the
   "measuring…" overlay sat on top of the finished chart forever, and
   two recommendation notes showed on algorithms that have none. */

import { check, reset, tally } from './harness.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'markup';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

/**
 * Every element id that a script sets `.hidden` on, following both the
 * direct `$('id').hidden` form and the `dom.key.hidden` form through the
 * `const dom = { key: $('id') }` map the pages use.
 */
function hiddenIds(entry) {
  const seen = new Set();
  const ids = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    let js;
    try { js = read(path); } catch { return; }

    // key -> id, from the dom map
    const keyToId = new Map();
    for (const m of js.matchAll(/([A-Za-z0-9_]+)\s*:\s*\$\('([a-z0-9-]+)'\)/g)) {
      keyToId.set(m[1], m[2]);
    }
    for (const m of js.matchAll(/\$\('([a-z0-9-]+)'\)\s*\.hidden|getElementById\('([a-z0-9-]+)'\)\s*\.hidden/g)) {
      ids.add(m[1] ?? m[2]);
    }
    for (const m of js.matchAll(/\bdom\.([A-Za-z0-9_]+)\s*\.hidden/g)) {
      const id = keyToId.get(m[1]);
      if (id) ids.add(id);
    }

    // follow relative imports, since the page logic is split across files
    for (const m of js.matchAll(/from\s+'(\.[^']+)'/g)) {
      const dir = path.slice(0, path.lastIndexOf('/'));
      visit(normalise(`${dir}/${m[1]}`));
    }
  };
  visit(entry);
  return ids;
}

/** Flatten ./ and ../ in a path, since these are read from disk. */
function normalise(path) {
  const out = [];
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

export async function run() {
  reset();

  const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
  const sheets = readdirSync(resolve(root, 'css')).filter((f) => f.endsWith('.css'));
  const css = sheets.map((f) => ({ file: `css/${f}`, text: read(`css/${f}`) }));
  const allCss = css.map((c) => c.text).join('\n');

  check(pages.length >= 3, `expected the three pages, found ${pages.join(', ')}`);

  for (const page of pages) {
    const html = read(page);

    /* ── hidden must actually hide ──
       Two ways an element gets hidden, and only one of them is visible
       in the HTML. The bug that prompted this test was the other kind:
       the "measuring…" overlay carries no hidden attribute in the
       markup, it is hidden from script, so a check that only read the
       HTML passed while the overlay sat on top of the chart. */
    const hiddenClasses = new Set();

    // 1. hidden in the markup
    for (const m of html.matchAll(/class="([^"]+)"[^>]*\shidden(?=[\s>])/g)) {
      for (const cls of m[1].split(/\s+/)) if (cls) hiddenClasses.add(cls);
    }

    // 2. hidden from script — resolve the ids the scripts set .hidden on
    const classesOfId = new Map();
    for (const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
      const cls = /class="([^"]+)"/.exec(m[0]);
      if (cls) classesOfId.set(m[1], cls[1].split(/\s+/).filter(Boolean));
    }
    for (const src of [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])) {
      for (const id of hiddenIds(src)) {
        for (const cls of classesOfId.get(id) ?? []) hiddenClasses.add(cls);
      }
    }
    for (const cls of hiddenClasses) {
      // does any rule for this class alone set display?
      const sets = new RegExp(`(^|\\})\\s*\\.${cls}\\s*\\{[^}]*\\bdisplay\\s*:`, 'm').test(allCss);
      if (!sets) continue;
      const guarded = allCss.includes(`.${cls}[hidden]`);
      check(guarded,
        `${page}: .${cls} gets hidden (in the markup or from script), but its CSS sets display and nothing declares ".${cls}[hidden] { display: none }" — ` +
        'a class selector beats the browser default, so it will stay on screen');
    }

    /* ── every id the scripts reach for must exist ── */
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    for (const src of scripts) {
      const js = read(src);
      for (const m of js.matchAll(/\$\('([a-z0-9-]+)'\)|getElementById\('([a-z0-9-]+)'\)/g)) {
        const id = m[1] ?? m[2];
        check(ids.has(id), `${page}: ${src} looks up #${id}, which the page does not contain`);
      }
    }

    /* ── stylesheets and modules must exist ── */
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) {
      check(sheets.includes(m[1].replace('css/', '')), `${page} links ${m[1]}, which is missing`);
    }

    /* ── the basics that make a page usable ── */
    check(/<html[^>]+lang=/.test(html), `${page} has no lang attribute`);
    check(/name="viewport"/.test(html), `${page} has no viewport meta, so it will not scale on a phone`);
    check(/<title>/.test(html), `${page} has no title`);
    check(/name="description"/.test(html), `${page} has no description meta`);
    check(/class="skip-link"/.test(html), `${page} has no skip link`);
  }

  /* ── no page may still advertise the wrong algorithm count ── */
  const { ALL } = await import('./../js/registry.js');
  for (const page of pages) {
    const html = read(page);
    const claims = [...html.matchAll(/(\d+)\s+classic algorithms/g)].map((m) => Number(m[1]));
    for (const n of claims) {
      check(n === ALL.length,
        `${page} says "${n} classic algorithms" but there are ${ALL.length}`);
    }
  }

  /* ── every page carries the shared nav, and marks its own tab ── */
  const { PAGES } = await import('./../js/shared/chrome.js');
  for (const p of PAGES) {
    check(pages.includes(p.href), `the nav links to ${p.href}, which does not exist`);
  }

  return tally();
}
