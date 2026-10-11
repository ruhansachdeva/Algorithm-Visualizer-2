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
import { icon } from './icons.js';
import { Player, record } from './engine/player.js';
import { palette, fitCanvas } from './views/draw.js';
import { barAt } from './views/array-view.js';

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
let raceInfo = null;       // how each side of the current race went
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
    writeRaceSide(dom.headA, dom.footA, current, frame.a, frame.doneA, raceInfo?.aSteps ?? 0);
    writeRaceSide(dom.headB, dom.footB, rival, frame.b, frame.doneB, raceInfo?.bSteps ?? 0);
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
function writeRaceSide(head, foot, algo, frame, done, steps) {
  const mark = document.createElement('span');
  if (done) {
    mark.className = 'finished';
    mark.textContent = `finished in ${steps.toLocaleString()} steps`;
  }
  head.replaceChildren(
    Object.assign(document.createElement('span'), { textContent: algo.name }),
    mark,
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
    // Filter the ENRICHED list, not the raw category array — only the
    // enriched entries carry `pick` and `category`.
    const matches = ALL.filter(
      (a) => a.category === cat.id &&
             (!q || a.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q))
    );
    if (!matches.length) continue;

    const head = document.createElement('button');
    head.className = 'cat-head';
    head.type = 'button';
    head.dataset.cat = cat.id;
    head.setAttribute('aria-expanded', 'true');
    head.style.setProperty('--cat', cat.color || 'var(--text-faint)');

    const mark = document.createElement('span');
    mark.className = 'cat-icon';
    mark.append(icon(cat.id));

    head.append(
      Object.assign(document.createElement('span'), { className: 'chevron', textContent: '\u203A' }),
      mark,
      Object.assign(document.createElement('span'), { className: 'cat-name', textContent: cat.name }),
      Object.assign(document.createElement('span'), { className: 'cat-count', textContent: matches.length }),
    );

    // Each category's rows live in their own group so one click hides them.
    const group = document.createElement('div');
    group.className = 'cat-group';
    group.dataset.cat = cat.id;

    // The rows go inside ONE wrapper. Collapsing works by animating the
    // grid row to 0fr, and that only governs the FIRST child — with the
    // buttons as direct children the rest land in implicit auto-sized rows
    // and keep their height, leaving a gap where the list used to be.
    const groupInner = document.createElement('div');
    group.append(groupInner);

    head.addEventListener('click', () => toggleCategory(cat.id));
    dom.list.append(head, group);

    for (const algo of matches) {
      const b = document.createElement('button');
      b.className = 'algo-btn' + (algo.id === current?.id ? ' active' : '');
      b.dataset.id = algo.id;
      b.style.setProperty('--cat', cat.color || 'var(--accent)');

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
      if (algo.pick) {
        const star = document.createElement('span');
        star.className = 'pick-badge';
        star.textContent = '\u2605';
        star.title = 'Worth reaching for first — see the panel on the right';
        b.append(star);
      }

      b.addEventListener('click', () => select(algo.id));
      groupInner.append(b);
    }
  }

  applyCollapsed();

  if (!dom.list.children.length) {
    dom.list.append(Object.assign(document.createElement('div'), {
      className: 'cat-head', textContent: 'no matches',
    }));
  }
}

/** A small category chip above the title: icon, name, and what the family is for. */
function renderCrumb(algo) {
  const cat = CATEGORIES.find((c) => c.id === algo.category);
  const el = $('crumb');
  el.replaceChildren();
  if (!cat) return;

  el.style.setProperty('--cat', cat.color || 'var(--accent)');
  const chip = document.createElement('span');
  chip.className = 'crumb-chip';
  chip.append(icon(cat.id, 11), Object.assign(document.createElement('span'), { textContent: cat.name }));
  el.append(chip);
  if (cat.blurb) {
    el.append(Object.assign(document.createElement('span'), { className: 'crumb-blurb', textContent: cat.blurb }));
  }
}

/** The colour belonging to an algorithm's category. */
function categoryColor(algo) {
  return CATEGORIES.find((c) => c.id === algo.category)?.color || 'var(--accent)';
}

/** Categories the user has folded away, remembered between visits. */
const collapsed = new Set(readCollapsed());

function readCollapsed() {
  try { return JSON.parse(localStorage.getItem('av2:collapsed') || '[]'); }
  catch { return []; }
}

function toggleCategory(id) {
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  try { localStorage.setItem('av2:collapsed', JSON.stringify([...collapsed])); } catch {}
  applyCollapsed();
}

function applyCollapsed() {
  // Filtering, or selecting something inside a folded category, has to
  // open it — otherwise the thing you asked for is invisible.
  const forceOpen = new Set();
  if (dom.filter.value.trim()) {
    for (const head of dom.list.querySelectorAll('.cat-head')) forceOpen.add(head.dataset.cat);
  }
  if (current?.category) forceOpen.add(current.category);

  for (const head of dom.list.querySelectorAll('.cat-head')) {
    const shut = collapsed.has(head.dataset.cat) && !forceOpen.has(head.dataset.cat);
    head.classList.toggle('shut', shut);
    head.setAttribute('aria-expanded', String(!shut));
  }
  for (const group of dom.list.querySelectorAll('.cat-group')) {
    group.classList.toggle('shut', collapsed.has(group.dataset.cat) && !forceOpen.has(group.dataset.cat));
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

  renderCrumb(algo);
  dom.title.textContent = algo.name;
  dom.about.textContent = algo.about || '';

  $('pick-block').hidden = !algo.pick;
  $('info-pick').textContent = algo.pick || '';
  document.documentElement.style.setProperty('--cat-current', categoryColor(algo));
  // The headline number people actually compare algorithms by.
  const bigO = $('big-o');
  bigO.textContent = algo.cost?.avg ?? '';
  bigO.title = algo.cost?.avg ? `typical running time (worst case ${algo.cost.worst})` : '';

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
  // A truncated run looks like a finished one unless we say otherwise.
  document.body.classList.toggle('truncated', !!frames[frames.length - 1]?._truncated);

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
  // Remember how long each side took, and what it finished holding, so the
  // result can be summarised without re-walking the frames.
  raceInfo = {
    aSteps: a.length,
    bSteps: b.length,
    aFinal: a[a.length - 1],
    bFinal: b[b.length - 1],
  };

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

/* Hovering a bar names its index and value — useful when the array is
   too dense for the labels to be drawn. */
dom.canvas.addEventListener('mousemove', (e) => {
  if (current?.view !== 'array') { dom.canvas.title = ''; return; }
  const frame = player.frames[player.index];
  const arr = frame?._race ? frame.a?.array : frame?.array;
  if (!arr) return;
  const i = barAt(dom.canvas, e.clientX);
  dom.canvas.title = i === -1 ? '' : `index ${i} · value ${arr[i]}`;
});
dom.canvas.addEventListener('mouseleave', () => { dom.canvas.title = ''; });

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
  const original = copyBtn.innerHTML;
  const flash = (mark) => {
    copyBtn.textContent = mark;
    copyBtn.classList.add('flash');
    setTimeout(() => { copyBtn.innerHTML = original; copyBtn.classList.remove('flash'); }, 1200);
  };

  try {
    await navigator.clipboard.writeText(`${base}#${where}`);
    flash('✓');
  } catch {
    // Clipboard access can be refused; fall back to showing the link.
    location.hash = where;
    flash('↑');
  }
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
