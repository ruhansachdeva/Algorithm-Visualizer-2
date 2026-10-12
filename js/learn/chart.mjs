/* ============================================================
   The growth chart: measured work as points, the predicted shape as a
   line through them.

   Drawn on a canvas rather than with an SVG library, for the same reason
   the rest of the app is: no build step, nothing to install, and the
   views already have canvas helpers for fitting and theming.

   The axes default to log-log, which is the only sensible default here.
   On linear axes a quadratic at n = 320 is 250 times taller than at
   n = 20, so every interesting point is squashed into the bottom pixel
   row. On log-log a power law is a straight line and its exponent is the
   slope, so "linear" and "quadratic" become two visibly different
   gradients rather than two curves that both look vertical.
   ============================================================ */

import { colors, fitCanvas } from '../views/draw.js';

const PAD = { top: 18, right: 18, bottom: 40, left: 62 };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} data
 * @param {number[]} data.sizes
 * @param {(number|null)[]} data.measured
 * @param {Function} [data.shape]      predicted shape, already run-adjusted
 * @param {number} [data.scale]        the fitted constant for `shape`
 * @param {string} data.xLabel
 * @param {string} data.yLabel
 * @param {string} [data.costLabel]
 * @param {boolean} [data.logAxes]
 */
export function drawChart(canvas, data) {
  // fitCanvas hands back the context plus the CSS-pixel size, having
  // already scaled for the device pixel ratio and cleared the canvas.
  const { ctx, w, h } = fitCanvas(canvas);
  const c = colors();

  const pts = data.sizes
    .map((n, i) => ({ n, y: data.measured[i] }))
    .filter((p) => p.y != null && Number.isFinite(p.y));
  if (pts.length < 2) {
    ctx.fillStyle = c.dim;
    ctx.font = `13px ${fontStack()}`;
    ctx.textAlign = 'center';
    ctx.fillText('not enough measurable sizes to draw a curve', w / 2, h / 2);
    return;
  }

  const log = data.logAxes !== false;
  // A log axis cannot show zero, and plenty of counters legitimately
  // start at zero, so the floor is pulled to the smallest positive value.
  const ys = pts.map((p) => p.y);
  const positive = ys.filter((v) => v > 0);
  const yMin = log ? Math.max(Math.min(...positive) / 2, 0.5) : 0;
  const yMax = Math.max(...ys) * 1.12 || 1;
  const xMin = pts[0].n;
  const xMax = pts.at(-1).n;

  const plot = { x: PAD.left, y: PAD.top, w: w - PAD.left - PAD.right, h: h - PAD.top - PAD.bottom };
  const tx = (n) => plot.x + (log
    ? (Math.log(n) - Math.log(xMin)) / (Math.log(xMax) - Math.log(xMin) || 1) * plot.w
    : (n - xMin) / (xMax - xMin || 1) * plot.w);
  const ty = (v) => {
    if (!log) return plot.y + plot.h - (v - yMin) / (yMax - yMin || 1) * plot.h;
    const lo = Math.log(yMin);
    const hi = Math.log(yMax);
    return plot.y + plot.h - (Math.log(Math.max(v, yMin)) - lo) / (hi - lo || 1) * plot.h;
  };

  /* ── grid and axes ── */
  ctx.font = `11px ${monoStack()}`;
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.fillStyle = c.faint;

  const yTicks = log ? decadeTicks(yMin, yMax) : linearTicks(yMin, yMax, 5);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of yTicks) {
    const y = Math.round(ty(v)) + 0.5;
    if (y < plot.y - 1 || y > plot.y + plot.h + 1) continue;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.fillText(short(v), plot.x - 8, y);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const p of pts) {
    const x = Math.round(tx(p.n)) + 0.5;
    ctx.fillText(short(p.n), x, plot.y + plot.h + 8);
  }

  /* ── the predicted curve ── */
  if (data.shape && data.scale) {
    ctx.strokeStyle = c.compare;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const steps = 90;
    let started = false;
    for (let i = 0; i <= steps; i++) {
      const n = log
        ? Math.exp(Math.log(xMin) + (Math.log(xMax) - Math.log(xMin)) * (i / steps))
        : xMin + (xMax - xMin) * (i / steps);
      const v = data.scale * data.shape(n);
      if (!Number.isFinite(v)) continue;
      const x = tx(n);
      const y = ty(v);
      if (y < plot.y - 200 || y > plot.y + plot.h + 200) { started = false; continue; }
      if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ── the measurement ── */
  ctx.strokeStyle = c.cursor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(tx(p.n), ty(p.y)) : ctx.moveTo(tx(p.n), ty(p.y))));
  ctx.stroke();

  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(tx(p.n), ty(p.y), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = c.panel;
    ctx.fill();
    ctx.strokeStyle = c.cursor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* ── axis titles ── */
  ctx.fillStyle = c.dim;
  ctx.font = `11px ${fontStack()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(data.xLabel, plot.x + plot.w / 2, h - 4);

  ctx.save();
  ctx.translate(13, plot.y + plot.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'top';
  ctx.fillText(data.yLabel, 0, 0);
  ctx.restore();
}

/* One tick per power of ten, which is what makes a log axis readable. */
function decadeTicks(min, max) {
  const out = [];
  for (let e = Math.floor(Math.log10(Math.max(min, 1e-6))); e <= Math.ceil(Math.log10(max)); e++) {
    const base = 10 ** e;
    for (const m of [1, 3]) {
      const v = m * base;
      if (v >= min && v <= max) out.push(v);
    }
  }
  return out.length > 1 ? out : [min, max];
}

function linearTicks(min, max, count) {
  const out = [];
  for (let i = 0; i <= count; i++) out.push(min + (max - min) * (i / count));
  return out;
}

/** 1200 → "1.2k": axis labels have about five characters of room. */
export function short(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  if (a >= 10 || a === 0 || Number.isInteger(v)) return String(Math.round(v));
  return v.toFixed(1);
}

const fontStack = () => getComputedStyle(document.documentElement).getPropertyValue('--sans').trim() || 'system-ui';
const monoStack = () => getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace';

/** Wipe the chart, for when there is nothing to show. */
export function clearChart(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
}
