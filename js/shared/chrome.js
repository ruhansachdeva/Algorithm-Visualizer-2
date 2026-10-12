/* ============================================================
   The bits of the page that are the same everywhere.

   There are three pages now — the visualizer, Learn and Practice — and
   the top bar, the theme and the nav have to behave identically on all
   of them. Keeping the markup in one place means a change to the nav is
   one edit rather than three, and the theme cannot drift out of step
   between pages.
   ============================================================ */

const THEME_KEY = 'av2:theme';

/* Practice is next and goes in here when it exists — a tab that 404s is
   worse than a tab that is not there yet. */
export const PAGES = [
  { id: 'visualize', href: 'index.html',    label: 'Visualize', hint: 'Watch an algorithm run, step by step' },
  { id: 'learn',     href: 'learn.html',    label: 'Learn',     hint: 'Where the complexity comes from, and when to reach for it' },
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
