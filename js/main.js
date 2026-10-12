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
import { GUIDES } from './category-guides.mjs';
import { foldOrExplain } from './shared/fold-or-explain.js';
import { getSeed, setSeed, reseed, rewind } from './rng.js';
import { Player, record } from './engine/player.js';
import { palette, fitCanvas } from './views/draw.js';
import { barAt } from './views/array-view.js';
import { navElement, rememberAlgo, requireMarkup } from './shared/chrome.js';

const $ = (id) => document.getElementById(id);

/* The markup and this script are two files with two cache lifetimes, so
   a returning visitor can be served one of them new and the other old.
   Check before touching anything: carrying on would throw on the first
   missing element and leave a blank page. */
if (!requireMarkup(['algo-list', 'canvas', 'cost-chips', 'info-more', 'pick-line', 'pseudocode', 'stats', 'scrub'])) {
  // requireMarkup has already reloaded or explained; stop here.
  throw new Error('stale markup — stopped before running against it');
}

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
let pendingSeed = null;    // seed named in the URL

/**
 * '#quick@120'            -> { id: 'quick', rival: null, step: 120 }
 * '#grid-bfs+grid-astar'  -> a race, shareable as a link
 */
function parseHash() {
  const raw = location.hash.slice(1);
  if (!raw) return { id: '', rival: null, step: null };

  // Peel the parts off in the order they can be separated: the seed is
  // last, so it has to come off FIRST — otherwise '#bubble@40~zz9' reads
  // its step as "40~zz9", which is not a number, and the seed vanishes.
  const tilde = raw.indexOf('~');
  const withoutSeed = tilde === -1 ? raw : raw.slice(0, tilde);
  const seed = tilde === -1 ? null : raw.slice(tilde + 1);

  const at = withoutSeed.indexOf('@');
  const names = at === -1 ? withoutSeed : withoutSeed.slice(0, at);
  const step = at === -1 ? null : Number(withoutSeed.slice(at + 1));

  const plus = names.indexOf('+');
  return {
    id: plus === -1 ? names : names.slice(0, plus),
    rival: plus === -1 ? null : names.slice(plus + 1),
    step: Number.isFinite(step) ? step : null,
    seed,
  };
}

/** Keep the URL in step with what is on screen, seed included. */
function syncHash() {
  if (!current) return;
  const want = current.id + (rival ? `+${rival.id}` : '') + `~${getSeed()}`;
  const now = parseHash();
  if (now.id !== current.id || (now.rival || null) !== (rival?.id || null) || now.seed !== getSeed()) {
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
      $('race-result').hidden = !(frame.doneA && frame.doneB);
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

    foldOrExplain(head, {
      fold: (opts) => toggleCategory(cat.id, opts),
      explain: () => openGuide(cat.id),
    });
    head.title = `${cat.name} — double-click for what this family is for`;
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

/* ─────────────────── what a family is for ─────────────────── */

/**
 * Double-clicking a section heading opens this. It is about the family,
 * never about one algorithm: which family a problem belongs to is the
 * first decision you make and a bigger one than the choice inside it.
 */
function openGuide(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  const guide = GUIDES[id];
  if (!cat || !guide) return;

  $('guide-icon').replaceChildren(icon(cat.id, 20));
  $('guide-icon').style.color = cat.color;
  $('guide-title').textContent = cat.name;
  $('guide-sub').textContent = `${cat.blurb} · ${ALL.filter((a) => a.category === id).length} algorithms`;

  const body = $('guide-body');
  body.replaceChildren();
  const sections = [
    ['What it is', guide.what],
    ['When you reach for it', guide.when],
    ['Choosing within it', guide.choosing],
    ['Worth watching for', guide.watch],
  ];
  for (const [heading, text] of sections) {
    if (!text) continue;
    const h = document.createElement('h3');
    h.textContent = heading;
    const p = document.createElement('p');
    p.textContent = text;
    body.append(h, p);
  }

  const first = ALL.find((a) => a.category === id);
  $('guide-learn').href = `learn.html#${first?.id ?? ''}`;

  $('guide').hidden = false;
  $('guide-close').focus();
}

function closeGuide() { $('guide').hidden = true; }

$('guide-close').addEventListener('click', closeGuide);
$('guide').addEventListener('click', (e) => { if (e.target.id === 'guide') closeGuide(); });

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

function toggleCategory(id, { animate = true } = {}) {
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  try { localStorage.setItem('av2:collapsed', JSON.stringify([...collapsed])); } catch {}

  // Undoing the first click of a double click should look like nothing
  // happened, rather than the section flapping open again.
  if (!animate) {
    dom.list.classList.add('no-fold-anim');
    applyCollapsed();
    // Two frames: one for the class to apply, one for the layout to
    // settle at the new size before transitions are allowed back.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      dom.list.classList.remove('no-fold-anim');
    }));
    return;
  }
  applyCollapsed();
}

function applyCollapsed() {
  // Filtering opens everything, otherwise a search could return results
  // you cannot see. The category holding the current algorithm is NOT
  // forced open — folding it away is a legitimate thing to want, and the
  // heading gets a dot so you can still find your way back to it.
  const forceOpen = new Set();
  if (dom.filter.value.trim()) {
    for (const head of dom.list.querySelectorAll('.cat-head')) forceOpen.add(head.dataset.cat);
  }

  for (const head of dom.list.querySelectorAll('.cat-head')) {
    const shut = collapsed.has(head.dataset.cat) && !forceOpen.has(head.dataset.cat);
    head.classList.toggle('shut', shut);
    head.setAttribute('aria-expanded', String(!shut));
    head.classList.toggle('holds-current', shut && head.dataset.cat === current?.category);
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

  applyCollapsed();   // keeps the "holds the current one" dot in step
  renderCrumb(algo);
  dom.title.textContent = algo.name;
  dom.about.textContent = algo.about || '';

  $('info-pick').textContent = algo.pick || '';
  $('pick-line').hidden = !algo.pick;
  $('info-more').href = `learn.html#${algo.id}`;
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
  rememberAlgo(id);
  syncHash();
}

/**
 * Re-run the current algorithm with whatever the inputs now say.
 * @param {boolean} preserveStep keep the playhead where it is — used while
 *        dragging walls, so the board doesn't jump back to step 1 each pixel
 */
function rerun(preserveStep = false) {
  if (!current) return;
  // Rewind first: a re-run with the same seed must produce the same input,
  // otherwise stepping the speed slider would quietly change the data.
  rewind();
  let frames;
  const input = readInput();
  try {
    // Most runs fit comfortably in the default budget. The ones that don't
    // say so themselves — a hard sudoku legitimately takes 200k+ steps, and
    // its frames are 81 bytes each, so it can afford a bigger allowance.
    frames = record(current.run(input), current.maxFrames ?? 60000);

    if (rival) {
      frames = buildRace(frames, record(rival.run(input), rival.maxFrames ?? 60000));
      renderRaceSummary();
    } else {
      raceInfo = null;
      $('race-result').hidden = true;
    }
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
 * Build the end-of-race summary. Called once per race rather than per
 * frame, so the breakdown stays open if the user opened it.
 *
 * The headline is decided on STEPS, which is unambiguous — fewer frames
 * means it got there sooner. Individual counters are only ever marked
 * "fewer", never "better": fewer writes is good, but fewer natural runs
 * or fewer characters skipped is not, and the app should not pretend to
 * know which is which.
 */
function renderRaceSummary() {
  const el = $('race-result');
  if (!rival || !raceInfo) { el.hidden = true; return; }

  const { aSteps, bSteps, aFinal, bFinal } = raceInfo;
  const verdict = $('race-verdict');
  verdict.replaceChildren();

  const faster = aSteps === bSteps ? null : (aSteps < bSteps ? current : rival);
  const ratio = Math.max(aSteps, bSteps) / Math.max(1, Math.min(aSteps, bSteps));

  if (!faster) {
    verdict.append(`Dead heat — both finished in ${aSteps.toLocaleString()} steps.`);
  } else {
    verdict.append(
      Object.assign(document.createElement('b'), { textContent: faster.name }),
      ` finished first — ${Math.min(aSteps, bSteps).toLocaleString()} steps against ${Math.max(aSteps, bSteps).toLocaleString()}, `,
      Object.assign(document.createElement('span'), { className: 'ratio', textContent: `${ratio.toFixed(1)}×` }),
      ' fewer.',
    );
  }

  /* ── the breakdown: every counter both sides reported ── */
  const aStats = aFinal?.stats || {};
  const bStats = bFinal?.stats || {};
  const shared = Object.keys(aStats).filter((k) => k in bStats);

  const detail = $('race-detail');
  detail.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'rr-grid';

  // column headings
  grid.append(
    Object.assign(document.createElement('div'), { className: 'rr-head' }),
    Object.assign(document.createElement('div'), { className: 'rr-head rr-a', textContent: current.name }),
    Object.assign(document.createElement('div'), { className: 'rr-head rr-b', textContent: rival.name }),
  );

  /**
   * One row: a label and two bars scaled against the larger of the pair.
   * A bar is far easier to compare at a glance than two numbers sitting at
   * opposite ends of a wide row.
   */
  const row = (label, av, bv, headline = false) => {
    const cls = headline ? ' rr-headline' : '';
    grid.append(Object.assign(document.createElement('div'), {
      className: 'rr-label' + cls, textContent: label,
    }));

    const numeric = typeof av === 'number' && typeof bv === 'number';
    const max = numeric ? Math.max(av, bv, 1) : 1;

    for (const [value, side] of [[av, 'a'], [bv, 'b']]) {
      const cell = document.createElement('div');
      cell.className = `rr-cell rr-${side}${cls}`;

      if (numeric) {
        const smaller = av !== bv && value === Math.min(av, bv);
        const track = document.createElement('div');
        track.className = 'rr-track';
        const bar = document.createElement('div');
        bar.className = 'rr-bar' + (smaller ? ' rr-smaller' : '');
        bar.style.width = `${Math.max(2, (value / max) * 100)}%`;
        track.append(bar);
        cell.append(track);
      }

      cell.append(Object.assign(document.createElement('span'), {
        className: 'rr-num' + (numeric && av !== bv && value === Math.min(av, bv) ? ' rr-win' : ''),
        textContent: typeof value === 'number' ? value.toLocaleString() : String(value),
      }));
      grid.append(cell);
    }
  };

  row('steps to finish', aSteps, bSteps, true);
  for (const k of shared) row(k, aStats[k], bStats[k]);

  detail.append(grid);
  detail.append(Object.assign(document.createElement('p'), {
    className: 'race-footnote',
    textContent: shared.length
      ? 'Bars are scaled against the larger value in each row. A step is one frame of this animation, including any setup — KMP builds its table before it searches, so it can finish in more steps than naive search while doing far less real work. The counters below are the better guide.'
      : 'These two report different counters, so there is nothing to line up beyond the step count.',
  }));
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

/* Chips rather than the old five-row table: the same five facts in a
   third of the height, which is what lets the steps list and the
   counters share the panel without either being scrolled out of sight. */
function renderCost(cost = {}) {
  const box = $('cost-chips');
  box.replaceChildren();
  // Short labels: "memory" next to "O(log n)" does not fit half of a
  // 280px panel, and the pair was being clipped.
  const rows = [
    ['best', cost.best],
    ['avg', cost.avg],
    ['worst', cost.worst],
    ['mem', cost.space],
    ['stable', cost.stable],
  ];
  for (const [key, value] of rows) {
    if (!value) continue;
    const chip = document.createElement('span');
    chip.className = 'cost-chip';
    const k = document.createElement('b');
    k.textContent = key;
    const v = document.createElement('span');
    v.textContent = value;
    chip.append(k, v);
    box.append(chip);
  }
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

const raceMore = $('race-more');
raceMore.addEventListener('click', () => {
  const open = raceMore.getAttribute('aria-expanded') === 'true';
  raceMore.setAttribute('aria-expanded', String(!open));
  $('race-detail').hidden = open;
});

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
    if (!$('guide').hidden) { closeGuide(); return; }
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
    // Only rows in open categories — stepping into a folded one would move
    // the selection somewhere you cannot see.
    const ids = [...dom.list.querySelectorAll('.cat-group:not(.shut) .algo-btn')].map((b) => b.dataset.id);
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
  const where = current
    ? `${current.id}${rival ? `+${rival.id}` : ''}@${player.index}~${getSeed()}`
    : '';
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

document.querySelector('.topbar-right').prepend(navElement('visualize'));

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
if (hashNow.seed) setSeed(hashNow.seed);
let startId = 'bubble';
try {
  startId = (fromHash && findAlgo(fromHash) && fromHash)
    || (localStorage.getItem('av2:last') && findAlgo(localStorage.getItem('av2:last')) && localStorage.getItem('av2:last'))
    || 'bubble';
} catch { startId = fromHash && findAlgo(fromHash) ? fromHash : 'bubble'; }

select(startId);

window.addEventListener('hashchange', () => {
  const { id, rival: r, step, seed } = parseHash();
  if (!id || !findAlgo(id)) return;
  if (seed && seed !== getSeed()) { setSeed(seed); select(id); return; }
  if (id !== current?.id || (r || null) !== (rival?.id || null)) {
    pendingStep = step;
    pendingRival = r;
    select(id);
  } else if (step !== null) {
    player.seek(step);
  }
});
