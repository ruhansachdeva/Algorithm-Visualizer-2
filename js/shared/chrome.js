/* ============================================================
   The bits of the page that are the same everywhere.

   There are three pages now — the visualizer, Learn and Practice — and
   the top bar, the theme and the nav have to behave identically on all
   of them. Keeping the markup in one place means a change to the nav is
   one edit rather than three, and the theme cannot drift out of step
   between pages.
   ============================================================ */

const THEME_KEY = 'av2:theme';

export const PAGES = [
  { id: 'visualize', href: 'index.html',    label: 'Visualize', hint: 'Watch an algorithm run, step by step' },
  { id: 'learn',     href: 'learn.html',    label: 'Learn',     hint: 'Where the complexity comes from, and when to reach for it' },
  { id: 'practice',  href: 'practice.html', label: 'Practice',  hint: 'Questions that check whether it stuck' },
];

/**
 * An explicit choice wins; otherwise follow the system. Called before
 * first paint so the page does not flash the wrong theme.
 */
export function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) { document.documentElement.dataset.theme = saved; return saved; }
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      document.documentElement.dataset.theme = 'light';
      return 'light';
    }
  } catch {}
  return document.documentElement.dataset.theme || 'dark';
}

/** Flip the theme and remember it. `after` is for repainting a canvas. */
export function toggleTheme(after) {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  after?.(next);
  return next;
}

/** Wire up a theme button, wherever the page chose to put it. */
export function wireTheme(btn, after) {
  btn?.addEventListener('click', () => toggleTheme(after));
}

/**
 * The page tabs. `active` is a page id from PAGES.
 *
 * The current page is a span rather than a link: a link to the page you
 * are already on is a small lie, and screen readers announce it as a
 * destination.
 */
export function navElement(active) {
  const nav = document.createElement('nav');
  nav.className = 'pagenav';
  nav.setAttribute('aria-label', 'Sections');
  for (const page of PAGES) {
    if (page.id === active) {
      const here = document.createElement('span');
      here.className = 'pagenav-link is-here';
      here.textContent = page.label;
      here.setAttribute('aria-current', 'page');
      nav.append(here);
    } else {
      const a = document.createElement('a');
      a.className = 'pagenav-link';
      a.href = page.href;
      a.textContent = page.label;
      a.title = page.hint;
      nav.append(a);
    }
  }
  return nav;
}

/**
 * Carry the chosen algorithm between pages, so "go deeper on this one"
 * lands on the right page rather than the page's default.
 */
export function rememberAlgo(id) {
  try { localStorage.setItem('av2:last', id); } catch {}
}

export function lastAlgo() {
  try { return localStorage.getItem('av2:last'); } catch { return null; }
}


/* ============================================================
   Surviving a half-updated cache.

   There is no build step here, so index.html and js/main.js are two
   separate files with two separate cache lifetimes on GitHub Pages. For
   a few minutes after a deploy a returning visitor can get one of them
   new and the other old, and when a release moves an element around —
   as the panel rebuild did — the script reaches for an id that the
   markup it was served does not have, throws on the first null, and
   leaves a completely blank page. Both directions were reproduced:

     new markup + old script -> "Cannot read properties of null
                                 (reading 'addEventListener')"
     old markup + new script -> "Cannot set properties of null
                                 (setting 'hidden')"

   The old script already in people's caches cannot be fixed from here.
   This fixes the other direction, and every future deploy once it has
   been cached: if the markup is not the markup this script was written
   against, reload once with a cache-busting query rather than running
   against it and dying. If that still does not help, say so plainly
   instead of showing nothing.
   ============================================================ */

const RELOAD_FLAG = 'av2:reloaded-for-skew';

/**
 * @param {string[]} ids  elements this page's script cannot work without
 * @returns {boolean} true if it is safe to carry on
 */
export function requireMarkup(ids) {
  const missing = ids.filter((id) => !document.getElementById(id));
  if (!missing.length) {
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
    return true;
  }

  let triedAlready = false;
  try { triedAlready = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch {}

  if (!triedAlready) {
    // One attempt, flagged so a genuinely broken page cannot loop. The
    // query string is what actually forces a fresh copy; a plain reload
    // is free to hand back the same cached file.
    try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch {}
    const url = `${location.pathname}?v=${Date.now()}${location.hash}`;
    location.replace(url);
    return false;
  }

  showStaleNotice(missing);
  return false;
}

function showStaleNotice(missing) {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999', 'display:grid',
    'place-items:center', 'padding:24px', 'text-align:center',
    'background:#0e1116', 'color:#e6edf3',
    'font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
  ].join(';');

  const inner = document.createElement('div');
  inner.style.maxWidth = '30rem';
  inner.innerHTML =
    '<h1 style="margin:0 0 10px;font-size:19px">This page is half-updated</h1>' +
    '<p style="margin:0 0 16px;color:#8b96a5">Your browser is holding an old copy of one of the files ' +
    'alongside a new copy of another, so the page cannot start. A hard reload fixes it: ' +
    '<kbd>⌘ Shift R</kbd> on a Mac, <kbd>Ctrl Shift R</kbd> otherwise.</p>';

  const btn = document.createElement('button');
  btn.textContent = 'Reload now';
  btn.style.cssText = 'padding:9px 16px;border:0;border-radius:8px;background:#4da3ff;color:#fff;font:inherit;font-weight:600;cursor:pointer';
  btn.addEventListener('click', () => {
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch {}
    location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);
  });

  const detail = document.createElement('p');
  detail.style.cssText = 'margin:16px 0 0;font-size:11.5px;color:#5c6673';
  detail.textContent = `missing from the page it was served: ${missing.join(', ')}`;

  inner.append(btn, detail);
  box.append(inner);
  document.body.append(box);
}
