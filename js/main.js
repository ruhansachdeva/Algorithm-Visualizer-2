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
import { palette, fitCanvas } from './views/draw.js';

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
  canvasB: $('canvas-b'),
  paneB: $('pane-b'),
  headA: $('head-a'),
  headB: $('head-b'),
  footA: $('foot-a'),
  footB: $('foot-b'),
  raceSelect: $('race-select'),
};

let current = null;        // the selected algorithm
let rival = null;          // the algorithm it is racing against, if any
let readInput = () => ({});
let pendingStep = null;    // step requested by the URL, applied after recording
let pendingRival = null;   // opponent named in the URL

/**
 * '#quick@120'            -> { id: 'quick', rival: null, step: 120 }
 * '#grid-bfs+grid-astar'  -> a race, shareable as a link
 */
function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw) return { id: '', rival: null, step: null };

  const at = raw.indexOf('@');
  const head = at === -1 ? raw : raw.slice(0, at);
  const step = at === -1 ? null : Number(raw.slice(at + 1));

  const plus = head.indexOf('+');
  return {
    id: plus === -1 ? head : head.slice(0, plus),
    rival: plus === -1 ? null : head.slice(plus + 1),
    step: Number.isFinite(step) ? step : null,
  };
}

/** Keep the URL in step with what is on screen. */
function syncHash() {
  const want = current ? current.id + (rival ? `+${rival.id}` : '') : '';
  if (parseHash().id !== current?.id || (parseHash().rival || null) !== (rival?.id || null)) {
    location.hash = want;
  }
}

/* ───────────────────────── player ──────────────────────── */

const player = new Player({
  onFrame: (frame, i, total) => {
    paint(frame);
    dom.scrub.max = String(Math.max(0, total - 1));
    dom.scrub.value = String(i);
    const pct = total > 1 ? Math.round((i / (total - 1)) * 100) : 100;
    dom.stepLabel.textContent = `step ${(i + 1).toLocaleString()} / ${total.toLocaleString()}  ·  ${pct}%`;
    if (frame._race) {
      dom.note.textContent = `${current.name} vs ${rival.name} — same input, stepped together`;
      renderStats(frame.a.stats);
      highlightLine(frame.a.line);
    } else {
      dom.note.textContent = frame.note || '';
      renderStats(frame.stats);
      highlightLine(frame.line);
    }
  },
  onPlayState: (playing) => {
    dom.play.textContent = playing ? '❙❙' : '▶';
    dom.play.title = playing ? 'Pause' : 'Play';
  },
});

function paint(frame) {
  if (frame?._error) { paintError(frame.note); return; }

  const draw = VIEWS[current?.view];
  if (!draw || !frame) return;

  if (frame._race) {
    draw(dom.canvas, frame.a, current);
    draw(dom.canvasB, frame.b, rival);
    writeRaceSide(dom.headA, dom.footA, current, frame.a, frame.doneA);
    writeRaceSide(dom.headB, dom.footB, rival, frame.b, frame.doneB);
  } else {
    draw(dom.canvas, frame, current);
  }
}

/** Draw a plain message where the visualization would be. */
function paintError(message) {
  const { ctx, w, h } = fitCanvas(dom.canvas);
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = palette('--c-swap');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('something went wrong', w / 2, h / 2 - 12);
  ctx.fillStyle = palette('--text-dim');
  ctx.font = '12px ui-monospace, Menlo, monospace';
  ctx.fillText(message.slice(0, 90), w / 2, h / 2 + 10);
}

/** The name, finish marker, caption and counters for one side of a race. */
function writeRaceSide(head, foot, algo, frame, done) {
  head.replaceChildren(
    Object.assign(document.createElement('span'), { textContent: algo.name }),
    Object.assign(document.createElement('span'), {
      className: done ? 'finished' : '',
      textContent: done ? 'finished' : '',
    }),
  );
  const note = Object.assign(document.createElement('div'), { textContent: frame.note || '' });
  const counters = Object.assign(document.createElement('div'), {
    className: 'counters',
    textContent: frame.stats
      ? Object.entries(frame.stats).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toLocaleString() : v}`).join('  ·  ')
      : '',
  });
  foot.replaceChildren(note, counters);
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

    const head = document.createElement('div');
    head.className = 'cat-head';
    head.append(
      Object.assign(document.createElement('span'), { textContent: cat.name }),
      Object.assign(document.createElement('span'), { className: 'cat-count', textContent: matches.length }),
    );
    dom.list.append(head);

    for (const algo of matches) {
      const b = document.createElement('button');
      b.className = 'algo-btn' + (algo.id === current?.id ? ' active' : '');
      b.dataset.id = algo.id;

      // Show WHERE the search matched, rather than leaving you to spot it.
      const hit = q ? algo.name.toLowerCase().indexOf(q) : -1;
      if (hit === -1) {
        b.textContent = algo.name;
      } else {
        b.append(
          algo.name.slice(0, hit),
          Object.assign(document.createElement('mark'), { textContent: algo.name.slice(hit, hit + q.length) }),
          algo.name.slice(hit + q.length),
        );
      }
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

  fillRacePicker(algo);
  if (pendingRival) {
    const r = findAlgo(pendingRival);
    if (r && rivalsFor(algo).some((o) => o.id === r.id)) setRival(r);
    pendingRival = null;
  }

  // Grids are sized to the stage, so shape them before the first run.
  if (algo.view === 'grid') fitGridRows(dom.canvas);

  // Typing in a text input re-runs on every keystroke; keeping the playhead
  // stops the view snapping back to step 1 between characters.
  readInput = buildInputs(algo, dom.inputs, () => rerun(true));
  rerun();

  // remember the choice across reloads
  try { localStorage.setItem('av2:last', id); } catch {}
  syncHash();
}

/**
 * Re-run the current algorithm with whatever the inputs now say.
 * @param {boolean} preserveStep keep the playhead where it is — used while
 *        dragging walls, so the board doesn't jump back to step 1 each pixel
 */
function rerun(preserveStep = false) {
  if (!current) return;
  let frames;
  const input = readInput();
  try {
    // Most runs fit comfortably in the default budget. The ones that don't
    // say so themselves — a hard sudoku legitimately takes 200k+ steps, and
    // its frames are 81 bytes each, so it can afford a bigger allowance.
    frames = record(current.run(input), current.maxFrames ?? 60000);

    if (rival) frames = buildRace(frames, record(rival.run(input), rival.maxFrames ?? 60000));
  } catch (err) {
    // Show the failure in the stage rather than leaving the last run's
    // picture on screen looking like it is still valid.
    console.error(err);
    frames = [{
      _error: true,
      note: `${current.name} stopped: ${err.message}`,
      stats: { status: 'error' },
    }];
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
 * Zip two runs into one timeline, so a single playhead drives both.
 *
 * The shorter run holds its last frame once it finishes, which is what
 * makes the race readable: one side visibly stops while the other is
 * still working. Frames are shared by reference, not copied.
 */
function buildRace(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      _race: true,
      a: a[Math.min(i, a.length - 1)],
      b: b[Math.min(i, b.length - 1)],
      doneA: i >= a.length - 1,
      doneB: i >= b.length - 1,
    };
  }
  return out;
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
  for (const raw of frames) {
    const f = raw._race ? raw.a : raw;
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
    // '--c-foo' reads the theme variable; anything else is used verbatim,
    // which lets an algorithm name a colour the theme doesn't define.
    sw.style.background = varName.startsWith('--') ? palette(varName) : varName;
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

const loopBtn = $('btn-loop');
loopBtn.addEventListener('click', () => {
  player.loop = !player.loop;
  loopBtn.classList.toggle('on', player.loop);
  loopBtn.setAttribute('aria-pressed', String(player.loop));
  try { localStorage.setItem('av2:loop', player.loop ? '1' : ''); } catch {}
});
try {
  if (localStorage.getItem('av2:loop')) {
    player.loop = true;
    loopBtn.classList.add('on');
    loopBtn.setAttribute('aria-pressed', 'true');
  }
} catch {}

dom.scrub.addEventListener('input', () => {
  player.pause();
  player.seek(Number(dom.scrub.value));
});

// Speed is a preference, not a per-algorithm setting, so it persists.
try {
  const savedSpeed = localStorage.getItem('av2:speed');
  if (savedSpeed) dom.speed.value = savedSpeed;
} catch {}

dom.speed.addEventListener('input', () => {
  player.setSpeed(Number(dom.speed.value));
  try { localStorage.setItem('av2:speed', dom.speed.value); } catch {}
});
player.setSpeed(Number(dom.speed.value));

dom.filter.addEventListener('input', () => buildSidebar(dom.filter.value));

/* Someone who has asked their system to reduce motion probably does not
   want 400 steps a second. Start them slow; they can still speed up. */
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  let hasSavedSpeed = false;
  try { hasSavedSpeed = !!localStorage.getItem('av2:speed'); } catch {}
  if (!hasSavedSpeed) {
    dom.speed.value = '18';
    player.setSpeed(18);
  }
}

/* ───────────────────── race mode ───────────────────────── */

/**
 * Who can an algorithm race? Anything in the same category drawn the same
 * way from the same input — so BFS can race A*, and BST Insert can race
 * AVL Insert, but nothing can race a maze generator (different category,
 * and they rewrite the board as they go).
 */
function rivalsFor(algo) {
  // Graph algorithms also have to agree on the SHAPE of graph they need —
  // feeding an undirected unweighted graph to a topological sort would
  // produce confident nonsense rather than an error.
  const sameGraphKind = (o) => JSON.stringify(o.graph ?? null) === JSON.stringify(algo.graph ?? null);

  return ALL.filter((o) =>
    o.id !== algo.id &&
    o.category === algo.category &&
    o.view === algo.view &&
    o.input === algo.input &&
    sameGraphKind(o));
}

function fillRacePicker(algo) {
  const options = rivalsFor(algo);
  dom.raceSelect.replaceChildren();
  dom.raceSelect.append(Object.assign(document.createElement('option'), { value: '', textContent: 'off' }));
  for (const o of options) {
    dom.raceSelect.append(Object.assign(document.createElement('option'), { value: o.id, textContent: o.name }));
  }
  dom.raceSelect.disabled = options.length === 0;
  $('race-wrap').style.opacity = options.length ? '' : '.4';

  // Keep racing the same opponent across a switch when that still makes sense.
  if (rival && options.some((o) => o.id === rival.id)) dom.raceSelect.value = rival.id;
  else setRival(null);
}

function setRival(algo) {
  rival = algo;
  document.body.classList.toggle('racing', !!algo);
  dom.paneB.hidden = !algo;
  dom.raceSelect.value = algo ? algo.id : '';
}

dom.raceSelect.addEventListener('change', () => {
  setRival(dom.raceSelect.value ? findAlgo(dom.raceSelect.value) : null);
  syncHash();
  rerun();
});

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
  // Escape works even from inside a field, so there is always a way out.
  if (e.key === 'Escape') {
    if (!help.hidden) { toggleHelp(false); return; }
    if (document.activeElement === dom.filter) {
      dom.filter.value = '';
      buildSidebar('');
      dom.filter.blur();
    }
    return;
  }
  if (e.target.matches('input, select, textarea')) return;

  switch (e.key) {
    case '?': e.preventDefault(); toggleHelp(); return;
    case '/': e.preventDefault(); dom.filter.focus(); dom.filter.select(); return;
    case 't': case 'T':
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      return;
  }
  if (!help.hidden) return;   // the overlay swallows playback keys

  // Up/down move through the sidebar list, wrapping at the ends.
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const ids = [...dom.list.querySelectorAll('.algo-btn')].map((b) => b.dataset.id);
    if (!ids.length) return;
    const at = ids.indexOf(current?.id);
    const next = e.key === 'ArrowDown'
      ? ids[(at + 1 + ids.length) % ids.length]
      : ids[(at - 1 + ids.length) % ids.length];
    select(next);
    dom.list.querySelector(`.algo-btn.active`)?.scrollIntoView({ block: 'nearest' });
    return;
  }

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

/* ───────────────────── copy a link ─────────────────────── */

/* Deep links already work; this just saves hand-assembling one. */
const copyBtn = $('copy-link');
copyBtn.addEventListener('click', async () => {
  const base = location.href.split('#')[0];
  const where = current ? current.id + (rival ? `+${rival.id}` : '') + `@${player.index}` : '';
  try {
    await navigator.clipboard.writeText(`${base}#${where}`);
    copyBtn.textContent = '✓';
  } catch {
    // Clipboard access can be refused; fall back to showing the link.
    location.hash = where;
    copyBtn.textContent = '↑';
  }
  setTimeout(() => { copyBtn.textContent = '⧉'; }, 1200);
});

/* ───────────────────── help overlay ────────────────────── */

const help = $('help');
const toggleHelp = (show) => { help.hidden = show === undefined ? !help.hidden : !show; };

$('help-toggle').addEventListener('click', () => toggleHelp());
help.addEventListener('click', () => toggleHelp(false));   // click anywhere to dismiss

/* ───────────────────── theme & resize ──────────────────── */

const themeBtn = $('theme-toggle');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('av2:theme', t); } catch {}
  renderLegend(current ? legendFor(player.frames, current) : []);
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

// An explicit choice wins; otherwise follow whatever the system is set to.
try {
  const saved = localStorage.getItem('av2:theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
  } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    document.documentElement.dataset.theme = 'light';
  }
} catch {}

buildSidebar();

const hashNow = parseHash();
const fromHash = hashNow.id;
pendingStep = hashNow.step;
pendingRival = hashNow.rival;
let startId = 'bubble';
try {
  startId = (fromHash && findAlgo(fromHash) && fromHash)
    || (localStorage.getItem('av2:last') && findAlgo(localStorage.getItem('av2:last')) && localStorage.getItem('av2:last'))
    || 'bubble';
} catch { startId = fromHash && findAlgo(fromHash) ? fromHash : 'bubble'; }

select(startId);

window.addEventListener('hashchange', () => {
  const { id, rival: r, step } = parseHash();
  if (!id || !findAlgo(id)) return;
  if (id !== current?.id || (r || null) !== (rival?.id || null)) {
    pendingStep = step;
    pendingRival = r;
    select(id);
  } else if (step !== null) {
    player.seek(step);
  }
});
