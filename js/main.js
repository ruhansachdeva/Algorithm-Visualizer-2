/* ============================================================
   App wiring
   ------------------------------------------------------------
   Pulls the three pieces together:
     registry  — which algorithms exist
     inputs    — the controls that build an algorithm's input
     player    — replays the frames the algorithm yields
     views     — paint one frame onto the canvas
   ============================================================ */

import { CATEGORIES, VIEWS, HIT_TEST, findAlgo, ALL } from './registry.js';
import { buildInputs, pointer, fitGridRows } from './inputs.js';
import { Player, record } from './engine/player.js';
import { palette } from './views/draw.js';

const $ = (id) => document.getElementById(id);

const dom = {
  list: $('algo-list'),
  filter: $('algo-filter'),
  canvas: $('canvas'),
  title: $('algo-title'),
  note: $('algo-note'),
  legend: $('legend'),
  inputs: $('inputs'),
  stats: $('stats'),
  pseudo: $('pseudocode'),
  about: $('info-about'),
  scrub: $('scrub'),
  stepLabel: $('step-label'),
  speed: $('speed'),
  play: $('btn-play'),
  count: $('algo-count'),
};

let current = null;        // the selected algorithm
let readInput = () => ({});
let pendingStep = null;    // step requested by the URL, applied after recording

/** '#quick@120' -> { id: 'quick', step: 120 } */
function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw) return { id: '', step: null };
  const at = raw.indexOf('@');
  if (at === -1) return { id: raw, step: null };
  const step = Number(raw.slice(at + 1));
  return { id: raw.slice(0, at), step: Number.isFinite(step) ? step : null };
}

/* ───────────────────────── player ──────────────────────── */

const player = new Player({
  onFrame: (frame, i, total) => {
    paint(frame);
    dom.scrub.max = String(Math.max(0, total - 1));
    dom.scrub.value = String(i);
    dom.stepLabel.textContent = `step ${i + 1} / ${total}`;
    dom.note.textContent = frame.note || '';
    renderStats(frame.stats);
    highlightLine(frame.line);
  },
  onPlayState: (playing) => {
    dom.play.textContent = playing ? '❙❙' : '▶';
    dom.play.title = playing ? 'Pause' : 'Play';
  },
});

function paint(frame) {
  const draw = VIEWS[current?.view];
  if (draw && frame) draw(dom.canvas, frame, current);
}

/* ───────────────────────── sidebar ─────────────────────── */

function buildSidebar(filterText = '') {
  const q = filterText.trim().toLowerCase();
  dom.list.replaceChildren();

  for (const cat of CATEGORIES) {
    const matches = cat.algorithms.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q)
    );
    if (!matches.length) continue;

    dom.list.append(Object.assign(document.createElement('div'), {
      className: 'cat-head', textContent: cat.name,
    }));

    for (const algo of matches) {
      const b = document.createElement('button');
      b.className = 'algo-btn' + (algo.id === current?.id ? ' active' : '');
      b.textContent = algo.name;
      b.dataset.id = algo.id;
      b.addEventListener('click', () => select(algo.id));
      dom.list.append(b);
    }
  }

  if (!dom.list.children.length) {
    dom.list.append(Object.assign(document.createElement('div'), {
      className: 'cat-head', textContent: 'no matches',
    }));
  }
}

/* ───────────────────── select & run ────────────────────── */

function select(id) {
  const algo = findAlgo(id);
  if (!algo) return;
  current = algo;

  // mark the active row
  for (const b of dom.list.querySelectorAll('.algo-btn')) {
    b.classList.toggle('active', b.dataset.id === id);
  }

  dom.title.textContent = algo.name;
  dom.about.textContent = algo.about || '';
  renderCost(algo.cost);
  renderPseudocode(algo.pseudocode);

  // Grids are sized to the stage, so shape them before the first run.
  if (algo.view === 'grid') fitGridRows(dom.canvas);

  readInput = buildInputs(algo, dom.inputs, rerun);
  rerun();

  // remember the choice across reloads
  try { localStorage.setItem('av2:last', id); } catch {}
  if (parseHash().id !== id) location.hash = id;
}

/**
 * Re-run the current algorithm with whatever the inputs now say.
 * @param {boolean} preserveStep keep the playhead where it is — used while
 *        dragging walls, so the board doesn't jump back to step 1 each pixel
 */
function rerun(preserveStep = false) {
  if (!current) return;
  let frames;
  try {
    // Most runs fit comfortably in the default budget. The ones that don't
    // say so themselves — a hard sudoku legitimately takes 200k+ steps, and
    // its frames are 81 bytes each, so it can afford a bigger allowance.
    frames = record(current.run(readInput()), current.maxFrames ?? 60000);
  } catch (err) {
    console.error(err);
    frames = [{ note: `the algorithm threw: ${err.message}`, array: [] }];
  }
  renderLegend(legendFor(frames, current));
  const keepAt = preserveStep ? player.index : 0;
  player.load(frames);
  if (keepAt) player.seek(Math.min(keepAt, frames.length - 1));

  // Deep link like #quick@120 jumps straight to a step.
  if (pendingStep !== null) {
    player.seek(pendingStep);
    pendingStep = null;
  }
}

/**
 * Work out the legend from the frames themselves, so an algorithm
 * never advertises a colour it doesn't actually use.
 */
const LEGEND_KEYS = [
  ['compare',  '--c-compare',  'comparing'],
  ['swap',     '--c-swap',     'moving'],
  ['cursor',   '--c-cursor',   'cursor'],
  ['pivot',    '--c-pivot',    'pivot'],
  ['range',    '--c-range',    'active window'],
  ['dead',     '--c-idle',     'ruled out'],
  ['sorted',   '--c-sorted',   'done'],
  ['found',    '--c-found',    'found'],
  ['visited',  '--c-visited',  'visited'],
  ['frontier', '--c-frontier', 'frontier'],
  ['path',     '--c-path',     'path'],
];

function legendFor(frames, algo) {
  if (algo.legend) return algo.legend;
  const used = new Set();
  for (const f of frames) {
    for (const [key] of LEGEND_KEYS) {
      if (used.has(key)) continue;
      const v = f[key];
      if (Array.isArray(v) ? v.length : v !== undefined && v !== null) used.add(key);
    }
    if (used.size === LEGEND_KEYS.length) break;
  }
  return LEGEND_KEYS.filter(([k]) => used.has(k)).map(([, c, label]) => [c, label]);
}

/* ───────────────────── info panel ──────────────────────── */

function renderCost(cost = {}) {
  $('cost-best').textContent   = cost.best   ?? '—';
  $('cost-avg').textContent    = cost.avg    ?? '—';
  $('cost-worst').textContent  = cost.worst  ?? '—';
  $('cost-space').textContent  = cost.space  ?? '—';
  $('cost-stable').textContent = cost.stable ?? '—';
}

function renderPseudocode(lines = []) {
  dom.pseudo.replaceChildren();
  for (const l of lines) {
    dom.pseudo.append(Object.assign(document.createElement('li'), { textContent: l }));
  }
}

/** Light up the pseudocode line the algorithm is currently executing. */
function highlightLine(n) {
  const items = dom.pseudo.children;
  for (let i = 0; i < items.length; i++) {
    items[i].classList.toggle('hot', i === n);
  }
}

function renderStats(stats) {
  dom.stats.replaceChildren();
  if (!stats) {
    dom.stats.append(Object.assign(document.createElement('div'), {
      className: 'stat', innerHTML: '<span>—</span><span></span>',
    }));
    return;
  }
  for (const [k, v] of Object.entries(stats)) {
    const row = document.createElement('div');
    row.className = 'stat';
    const a = document.createElement('span'); a.textContent = k;
    const b = document.createElement('span'); b.textContent = typeof v === 'number' ? v.toLocaleString() : String(v);
    row.append(a, b);
    dom.stats.append(row);
  }
}

function renderLegend(entries = []) {
  dom.legend.replaceChildren();
  for (const [varName, text] of entries) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = palette(varName);
    item.append(sw, Object.assign(document.createElement('span'), { textContent: text }));
    dom.legend.append(item);
  }
}

/* ───────────────────── controls wiring ─────────────────── */

$('btn-play').addEventListener('click', () => player.toggle());
$('btn-fwd').addEventListener('click', () => player.step(1));
$('btn-back').addEventListener('click', () => player.step(-1));
$('btn-reset').addEventListener('click', () => player.reset());
$('btn-end').addEventListener('click', () => player.toEnd());

dom.scrub.addEventListener('input', () => {
  player.pause();
  player.seek(Number(dom.scrub.value));
});

dom.speed.addEventListener('input', () => player.setSpeed(Number(dom.speed.value)));
player.setSpeed(Number(dom.speed.value));

dom.filter.addEventListener('input', () => buildSidebar(dom.filter.value));

/* ───────────────── drawing on the canvas ───────────────── */
/* Views that support it (the pathfinding grid) let you draw
   walls and drag the start/goal around with the mouse.        */

function canvasPointer(kind) {
  return (e) => {
    const handlers = pointer[current?.view];
    const hit = HIT_TEST[current?.view];
    if (!handlers || !hit) return;
    if (kind === 'down') dom.canvas.setPointerCapture?.(e.pointerId);
    handlers[kind]?.(e, { canvas: dom.canvas, cellAt: hit, rerun });
  };
}

dom.canvas.addEventListener('pointerdown', canvasPointer('down'));
dom.canvas.addEventListener('pointermove', canvasPointer('move'));
window.addEventListener('pointerup', canvasPointer('up'));
dom.canvas.addEventListener('contextmenu', (e) => {
  if (pointer[current?.view]) e.preventDefault();
});

/* keyboard: space plays, arrows step, r resets */
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  switch (e.key) {
    case ' ':          e.preventDefault(); player.toggle(); break;
    case 'ArrowRight': e.preventDefault(); player.step(e.shiftKey ? 25 : 1); break;
    case 'ArrowLeft':  e.preventDefault(); player.step(e.shiftKey ? -25 : -1); break;
    case 'r': case 'R': player.reset(); break;
    case 'n': case 'N': rerun(); break;
    case 'Home':       player.reset(); break;
    case 'End':        player.toEnd(); break;
  }
});

/* ───────────────────── theme & resize ──────────────────── */

const themeBtn = $('theme-toggle');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('av2:theme', t); } catch {}
  renderLegend(current?.legend || []);
  paint(player.frames[player.index]);
}
themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// Repaint on resize — the canvas is sized from its CSS box.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => paint(player.frames[player.index]), 60);
});

/* ───────────────────────── start ───────────────────────── */

dom.count.textContent = `${ALL.length} algorithms`;

try {
  const saved = localStorage.getItem('av2:theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch {}

buildSidebar();

const hashNow = parseHash();
const fromHash = hashNow.id;
pendingStep = hashNow.step;
let startId = 'bubble';
try {
  startId = (fromHash && findAlgo(fromHash) && fromHash)
    || (localStorage.getItem('av2:last') && findAlgo(localStorage.getItem('av2:last')) && localStorage.getItem('av2:last'))
    || 'bubble';
} catch { startId = fromHash && findAlgo(fromHash) ? fromHash : 'bubble'; }

select(startId);

window.addEventListener('hashchange', () => {
  const { id, step } = parseHash();
  if (id && findAlgo(id)) {
    if (id !== current?.id) { pendingStep = step; select(id); }
    else if (step !== null) player.seek(step);
  }
});
