/* ============================================================
   Category icons — 16x16 SVG paths.
   Kept as path data rather than files so there is nothing extra
   to load, and they inherit the category colour via currentColor.
   ============================================================ */

export const ICONS = {
  sorting:      'M2 13h3V7H2v6zm4.5 0h3V3h-3v10zM11 13h3V9h-3v4z',
  searching:    'M7 2a5 5 0 1 0 3.1 8.9l3 3 1.4-1.4-3-3A5 5 0 0 0 7 2zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  pathfinding:  'M2 2h4v4H2V2zm8 8h4v4h-4v-4zM4 7v2h2v2h2V9h2V7H8V5H6v2H4z',
  graphs:       'M4 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM8 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5.6 5.4h4.8v1.2H5.6V5.4zm-.5 1.3 1 .7-2 3-1-.7 2-3zm5.8 0 2 3-1 .7-2-3 1-.7z',
  trees:        'M7 2h2v3H7V2zM3 9h2v3H3V9zm8 0h2v3h-2V9zM4 7h8v1.2H4V7zm-.6 0h1.2v2H3.4V7zm8 0h1.2v2h-1.2V7zM7.4 5h1.2v2.2H7.4V5z',
  dp:           'M2 2h12v12H2V2zm1.5 1.5v3h3v-3h-3zm4.5 0v3h4.5v-3H8zM3.5 8v4.5h3V8h-3zM8 8v4.5h4.5V8H8z',
  strings:      'M2 3h12v1.6H2V3zm0 3.6h8v1.6H2V6.6zm0 3.6h12v1.6H2v-1.6zm0 3.6h6V15H2v-1.2z',
  backtracking: 'M8 2a6 6 0 0 1 6 6h-2a4 4 0 0 0-4-4V2zm0 12a6 6 0 0 1-6-6h2a4 4 0 0 0 4 4v2zM5.2 5.2l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zm5.6 3.2 1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4z',
  math:         'M3 3h4v1.4H3V3zm0 3.2h4v1.4H3V6.2zM2.4 10h5.2v1.4H2.4V10zm0 2.6h5.2V14H2.4v-1.4zM11 2.6h1.6v4H11v-4zm-1.6 1.6h4.8v1.6H9.4V4.2zM9.4 10h4.8v1.4H9.4V10zm0 2.6h4.8V14H9.4v-1.4z',
  mazes:        'M2 2h12v12H2V2zm1.6 1.6v2.2h4.8V3.6H3.6zm6.4 0v4.8h2.4V3.6H10zM3.6 7.4v5h2.2v-5H3.6zm3.8 1.8v3.2h5V9.2h-5z',
};

/** Build an <svg> element for a category. */
export function icon(name, size = 14) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flex = 'none';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name] || ICONS.sorting);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}
