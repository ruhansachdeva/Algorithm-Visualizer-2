/* ============================================================
   The Learn page.

   One algorithm at a time, in more depth than the visualizer's side
   panel has room for: what it costs, what it actually cost when measured,
   when to reach for it, and the case against it.

   The measurement is the part worth being careful about. Running an
   algorithm at nine input sizes, three times each, is tens of thousands
   of generator steps, and doing that synchronously on the main thread
   freezes the page for long enough to look broken. So it runs in slices
   between animation frames: the page draws, says "measuring…", and fills
   in as results arrive.
   ============================================================ */

import { CATEGORIES, ALL, findAlgo } from '../registry.js';
import { TRADEOFFS } from '../tradeoffs.js';
import { icon } from '../icons.js';
import { initTheme, wireTheme, navElement, rememberAlgo, lastAlgo } from '../shared/chrome.js';
import { measure, series, sizesFor, runShape, PLANS, NO_PLAN } from './measure.mjs';
import { shapeFor, whyUnplottable, fitScale, verdict, describeExponent, doubling, exponent, growthKind } from './curves.mjs';
import { drawChart, clearChart, short } from './chart.mjs';
import { WHY } from './why.mjs';

const $ = (id) => document.getElementById(id);
const dom = {
  list: $('algo-list'), filter: $('algo-filter'),
  crumb: $('doc-crumb'), title: $('doc-title'), about: $('doc-about'),
  openViz: $('open-viz'),
  costGrid: $('cost-grid'),
  chart: $('chart'), chartBusy: $('chart-busy'), chartNote: $('chart-note'),
  keyPredicted: $('key-predicted'),
  axesToggle: $('axes-toggle'), remeasure: $('remeasure'),
  verdict: $('verdict'), verdictBadge: $('verdict-badge'), verdictText: $('verdict-text'),
  doubling: $('doubling'), doublingHead: $('doubling-head'), doublingText: $('doubling-text'),
  growthTable: $('growth-table'), growthFine: $('growth-fine'),
  whenUse: $('when-use'), whenAvoid: $('when-avoid'),
  pickNote: $('pick-note'), pickText: $('pick-text'),
  pros: $('pros'), cons: $('cons'),
  secTradeoffs: $('sec-tradeoffs'), pseudo: $('pseudocode'),
};

initTheme();
$('topbar-right').prepend(navElement('learn'));
wireTheme($('theme-toggle'), () => redraw());

let current = null;
let logAxes = true;
let latest = null;     // the last finished measurement
let runToken = 0;      // bumped to abandon a measurement still in flight

/* ───────────────────── the picker ───────────────────── */

function buildSidebar(filterText = '') {
  const q = filterText.trim().toLowerCase();
  dom.list.replaceChildren();

  for (const cat of CATEGORIES) {
    const algos = ALL.filter((a) => a.category === cat.id &&
      (!q || a.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q)));
    if (!algos.length) continue;

    const group = document.createElement('div');
    group.className = 'algo-group';

    const head = document.createElement('div');
    head.className = 'algo-cat';
    head.innerHTML = icon(cat.id);
    head.append(document.createTextNode(cat.name));
    group.append(head);

    for (const algo of algos) {
      const a = document.createElement('a');
      a.className = 'algo-item';
      a.href = `#${algo.id}`;
      a.dataset.id = algo.id;
      a.textContent = algo.name;
      if (algo.id === current?.id) a.classList.add('active');
      group.append(a);
    }
    dom.list.append(group);
  }

  if (!dom.list.children.length) {
    const none = document.createElement('p');
    none.className = 'algo-none';
    none.textContent = 'nothing matches that';
    dom.list.append(none);
  }
}

dom.filter.addEventListener('input', () => buildSidebar(dom.filter.value));

/* ───────────────────── rendering ───────────────────── */

function text(el, value) { el.textContent = value ?? '—'; }

function select(id) {
  const algo = findAlgo(id);
  if (!algo) return;
  current = algo;
  rememberAlgo(id);

  for (const el of dom.list.querySelectorAll('.algo-item')) {
    el.classList.toggle('active', el.dataset.id === id);
  }

  dom.crumb.textContent = algo.categoryName;
  text(dom.title, algo.name);
  text(dom.about, algo.about);
  dom.openViz.href = `index.html#${algo.id}`;

  renderCost(algo);
  renderWhen(algo);
  renderTradeoffs(algo);
  renderPseudocode(algo);
  startMeasuring(algo);

  document.title = `${algo.name} — Learn — Algorithm Visualizer`;
}

function renderCost(algo) {
  const rows = [
    ['Best case', algo.cost?.best],
    ['Average', algo.cost?.avg],
    ['Worst case', algo.cost?.worst],
    ['Extra memory', algo.cost?.space],
  ];
  if (algo.cost?.stable) rows.push(['Stable', algo.cost.stable]);

  dom.costGrid.replaceChildren();
  for (const [label, value] of rows) {
    if (!value) continue;
    const cell = document.createElement('div');
    cell.className = 'cost-cell';
    const k = document.createElement('span');
    k.className = 'cost-key';
    k.textContent = label;
    const v = document.createElement('span');
    v.className = 'cost-val';
    v.textContent = value;
    cell.append(k, v);

    // Say what the shape means in words — "O(n log n)" is only obvious
    // once somebody has told you, which is the point of this page.
    const shape = shapeFor(value);
    if (shape) {
      const note = document.createElement('span');
      note.className = 'cost-shape';
      note.textContent = shape.name;
      cell.append(note);
    }
    dom.costGrid.append(cell);
  }

  const why = WHY[algo.id];
  if (why) {
    const block = document.createElement('div');
    block.className = 'cost-why';
    const h = document.createElement('h4');
    h.textContent = 'Where that comes from';
    const p = document.createElement('p');
    p.textContent = why;
    block.append(h, p);
    dom.costGrid.append(block);
  }
}

function renderWhen(algo) {
  const t = TRADEOFFS[algo.id] ?? {};
  text(dom.whenUse, t.useWhen);
  text(dom.whenAvoid, t.avoid);
  if (algo.pick) {
    dom.pickNote.hidden = false;
    text(dom.pickText, algo.pick);
  } else {
    dom.pickNote.hidden = true;
  }
}

function renderTradeoffs(algo) {
  const t = TRADEOFFS[algo.id] ?? {};
  const fill = (ul, items) => {
    ul.replaceChildren();
    for (const item of items ?? []) {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    }
  };
  fill(dom.pros, t.pros);
  fill(dom.cons, t.cons);
  dom.secTradeoffs.hidden = !(t.pros?.length || t.cons?.length);
}

function renderPseudocode(algo) {
  dom.pseudo.replaceChildren();
  for (const step of algo.pseudocode ?? []) {
    const li = document.createElement('li');
    li.textContent = step;
    dom.pseudo.append(li);
  }
}

/* ───────────────────── measuring ───────────────────── */

function showBusy(on, label = 'measuring…') {
  dom.chartBusy.hidden = !on;
  dom.chartBusy.textContent = label;
}

function clearMeasurement(message) {
  latest = null;
  showBusy(true, message);
  dom.verdict.hidden = true;
  dom.doubling.hidden = true;
  dom.chartNote.textContent = '';
  clearChart(dom.chart);
}

async function startMeasuring(algo) {
  const token = ++runToken;

  if (NO_PLAN[algo.input]) {
    clearMeasurement(`nothing to measure here — ${NO_PLAN[algo.input]}`);
    return;
  }
  if (!PLANS[algo.input]) {
    clearMeasurement('no measurement plan for this input yet');
    return;
  }

  clearMeasurement('measuring…');

  // Hand the browser a frame first, so "measuring…" is actually painted
  // before the main thread disappears into the measurement.
  await new Promise((r) => requestAnimationFrame(() => r()));
  if (token !== runToken) return;

  let m;
  try {
    m = measure(algo, { seed: `learn:${Date.now() % 100000}`, cap: 250000, repeats: 3 });
  } catch (err) {
    clearMeasurement(`could not measure this one: ${err.message}`);
    return;
  }
  if (token !== runToken || !m) return;

  const s = series(m);
  const usable = s.values.filter((v) => v != null && Number.isFinite(v));
  if (usable.length < 2) {
    clearMeasurement('this one did not produce a countable measurement');
    return;
  }

  latest = { algo, m, s };
  showBusy(false);
  redraw();
  renderVerdict(algo, m, s);
  renderDoubling(algo, m, s);
}

function redraw() {
  if (!latest) return;
  const { algo, m, s } = latest;
  const claimed = algo.cost?.avg;
  const shape = shapeFor(claimed);
  const adjusted = shape ? runShape(algo, shape.f) : null;
  const scale = adjusted ? fitScale(m.sizes, s.values, adjusted.f) : 0;

  drawChart(dom.chart, {
    sizes: m.sizes,
    measured: s.values,
    shape: adjusted?.f,
    scale,
    xLabel: m.label,
    yLabel: s.label,
    logAxes: logAxes,
  });

  dom.keyPredicted.textContent = shape ? `predicted ${claimed}` : 'no curve to predict';

  const bits = [];
  bits.push(`Counting ${s.isStepFallback
    ? 'the steps the algorithm itself reports'
    : `“${s.label}”, averaged over three runs at each size`}.`);
  if (shape) {
    bits.push(`Big-O fixes the shape but not the height, so the dashed curve is ${claimed} scaled to sit on the data — the shape is the prediction, not the height.`);
    if (shape.approx) bits.push('That cost mentions more than one variable; the others are held fixed by the input generator, so they fold into the constant.');
  } else {
    bits.push(`${claimed} cannot be drawn: ${whyUnplottable(claimed)}.`);
  }
  if (m.rows.some((r) => r.capped)) bits.push('The largest sizes hit the step limit, so their counts are floors rather than totals.');
  dom.chartNote.textContent = bits.join(' ');
}

function renderVerdict(algo, m, s) {
  const claimed = algo.cost?.avg;
  const shape = shapeFor(claimed);
  if (!shape) { dom.verdict.hidden = true; return; }

  const adjusted = runShape(algo, shape.f);
  const v = verdict({
    sizes: m.sizes, measured: s.values, shape: adjusted.f,
    cost: claimed, repeatedWhy: adjusted.why,
  });

  dom.verdict.hidden = false;
  dom.verdict.dataset.kind = v.kind;
  dom.verdictBadge.textContent = {
    agrees: 'matches the theory',
    under: 'beat its worst case',
    over: 'slower than the headline',
    unknown: 'inconclusive',
  }[v.kind] ?? v.kind;

  const parts = [cap(v.text) + '.'];
  if (adjusted.why && v.kind !== 'agrees') parts.push(cap(adjusted.why) + '.');
  parts.push(`Fitting the measurements to c·nᵖ gives p = ${v.measuredP.toFixed(2)} — ${describeExponent(v.measuredP)} — against p = ${v.claimedP.toFixed(2)} for ${claimed} over this range.`);
  dom.verdictText.textContent = parts.join(' ');
}

function renderDoubling(algo, m, s) {
  const d = doubling(m.sizes, s.values);
  if (!d) { dom.doubling.hidden = true; return; }
  dom.doubling.hidden = false;

  /* Exponential growth needs the other story. "Doubling the discs
     quadruples the work" is true of Hanoi over 2…4 discs and completely
     misleading: every single extra disc doubles it. So the framing is
     chosen by what the data actually lies on, not by the ratio alone. */
  const kind = growthKind(m.sizes, s.values);

  const explosive = kind.kind === 'exponential' && kind.base > 1.3;
  dom.doublingHead.textContent = explosive
    ? 'What happens when the input grows by one'
    : 'What happens when the input doubles';

  if (explosive) {
    const unit = m.label.replace(/s$/, '');
    const first = m.rows[0];
    const last = m.rows.at(-1);
    const lastWork = s.values.at(-1);
    dom.doublingText.textContent =
      `This does not grow with the size of the input so much as explode with it: every extra ${unit} ` +
      `multiplies the work by about ${kind.base.toFixed(kind.base < 3 ? 1 : 0)}. ` +
      `At ${short(first.n)} it took ${short(Math.round(s.values[0]))}; at ${short(last.n)}, ${short(Math.round(lastWork))}. ` +
      `Ten more would make that about ${short(Math.round(lastWork * kind.base ** 10))}. ` +
      `This is the kind of cost you have to design around — there is no constant factor that rescues it.`;
  } else {
    const factor = d.workRatio;

    /* The bands matter: doubling the input and seeing the work ×3 is the
       signature of n log n, not of a quadratic. A quadratic quadruples;
       the log factor shows up as the gap between 2 and 4. */
    const band =
      factor < 1.25 ? { said: 'barely moved', means: 'That is what sublinear growth buys you: the input can grow a long way and the work hardly notices.' }
      : factor < 2.4 ? { said: `roughly doubled (×${factor.toFixed(1)})`, means: 'Twice the input, twice the work — that is what linear means.' }
      : factor < 3.5 ? { said: `rather more than doubled (×${factor.toFixed(1)})`, means: 'More than double but well short of quadruple: that gap is the log factor, so this is n log n territory.' }
      : factor < 5.5 ? { said: `about quadrupled (×${factor.toFixed(1)})`, means: 'Double the input, four times the work — the signature of a quadratic.' }
      : { said: `went up ×${factor.toFixed(factor < 10 ? 1 : 0)}`, means: 'Growing faster than quadratic: each doubling of the input costs more than four times as much.' };

    dom.doublingText.textContent =
      `Going from ${short(d.from)} to ${short(d.to)} — ${d.sizeRatio.toFixed(d.sizeRatio % 1 ? 1 : 0)}× the input — the work ${band.said}, ` +
      `from ${short(Math.round(d.fromWork))} to ${short(Math.round(d.toWork))}. ${band.means}`;
  }

  // The per-size table, with the step-over-step multiplier, because the
  // ratio column is where a growth rate becomes obvious.
  const rows = [['input', s.label, 'vs previous']];
  m.rows.forEach((r, i) => {
    const v = s.values[i];
    if (v == null) return;
    const prev = i > 0 ? s.values[i - 1] : null;
    const ratio = prev ? `×${(v / prev).toFixed(2)}` : '';
    rows.push([short(r.n), short(Math.round(v)) + (r.capped ? '+' : ''), ratio]);
  });

  dom.growthTable.replaceChildren();
  rows.forEach(([a, b, c], i) => {
    const tr = document.createElement('tr');
    for (const value of [a, b, c]) {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      cell.textContent = value;
      tr.append(cell);
    }
    dom.growthTable.append(tr);
  });

  const p = exponent(m.sizes, s.values);
  dom.growthFine.textContent = p == null ? ''
    : `Each row multiplies the input by about ${(m.sizes.at(-1) / m.sizes.at(-2)).toFixed(2)}, so a steady ratio in the last column is a power law — here n^${p.toFixed(2)}.`;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ───────────────────── controls ───────────────────── */

dom.axesToggle.addEventListener('click', () => {
  logAxes = !logAxes;
  dom.axesToggle.setAttribute('aria-pressed', String(logAxes));
  dom.axesToggle.textContent = logAxes ? 'log axes' : 'linear axes';
  redraw();
});

dom.remeasure.addEventListener('click', () => current && startMeasuring(current));

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(redraw, 80);
});

/* ───────────────────── start ───────────────────── */

buildSidebar();

const fromHash = location.hash.slice(1);
select((fromHash && findAlgo(fromHash) && fromHash) || lastAlgo() || 'bubble');
buildSidebar(dom.filter.value);

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id && findAlgo(id) && id !== current?.id) select(id);
});
