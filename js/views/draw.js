/* ============================================================
   Small drawing helpers shared by every view.
   ============================================================ */

/**
 * Resize the canvas to match its on-screen box, accounting for
 * retina displays, and hand back a ready-to-use context.
 * Without the devicePixelRatio scaling everything looks blurry.
 */
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/** Read the current value of a CSS variable, e.g. palette('--c-swap'). */
let varCache = {};
let varCacheTheme = null;

export function palette(name) {
  const theme = document.documentElement.dataset.theme;
  if (theme !== varCacheTheme) { varCache = {}; varCacheTheme = theme; }
  if (!varCache[name]) {
    varCache[name] = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
  }
  return varCache[name];
}

/** Grab a whole set of colors at once, keyed by short name. */
export function colors() {
  return {
    idle:     palette('--c-idle'),
    compare:  palette('--c-compare'),
    swap:     palette('--c-swap'),
    sorted:   palette('--c-sorted'),
    cursor:   palette('--c-cursor'),
    pivot:    palette('--c-pivot'),
    range:    palette('--c-range'),
    found:    palette('--c-found'),
    wall:     palette('--c-wall'),
    visited:  palette('--c-visited'),
    frontier: palette('--c-frontier'),
    path:     palette('--c-path'),
    start:    palette('--c-start'),
    goal:     palette('--c-goal'),
    text:     palette('--text'),
    dim:      palette('--text-dim'),
    faint:    palette('--text-faint'),
    border:   palette('--border'),
    panel:    palette('--bg-panel'),
    sunken:   palette('--bg-sunken'),
  };
}

/** Rectangle with rounded corners, clamped so small bars still look right. */
export function roundRect(ctx, x, y, w, h, r = 3) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

/** Draw a line of text, centered horizontally on `x`. */
export function label(ctx, text, x, y, { size = 11, color = '#fff', weight = 500, align = 'center', baseline = 'middle', mono = true } = {}) {
  ctx.font = `${weight} ${size}px ${mono
    ? 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif'}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

/** Straight line between two points. */
export function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Filled circle. */
export function circle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeCircle(ctx, x, y, r, color, width = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Mix a color toward transparent — used for "eliminated" elements. */
export function fade(ctx, alpha, fn) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  fn();
  ctx.globalAlpha = prev;
}
