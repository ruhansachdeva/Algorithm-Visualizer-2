/* ============================================================
   The Practice page.

   The missing half of IDEAS.md: the app explained algorithms well and
   never once checked whether any of it landed.

   Five formats, from two sources. "Predict the next step" and "trace it
   by hand" are generated from real runs, so there is an endless supply
   and the answer is read off an actual execution rather than typed in by
   someone who might be wrong. The other three — which algorithm would
   you use, spot the complexity, find the bug — are written, because the
   question *is* the judgement.

   Two deliberate choices about how it behaves:

   - Nothing is timed and nothing is scored out of ten. The useful output
     is "you have not got this one yet", so a question answered wrongly
     comes back around and a question answered rightly moves to the back
     of the queue.
   - Every wrong option explains itself. Being told you are wrong is
     worth very little; being told what you were probably thinking is
     worth something.
   ============================================================ */

import { findAlgo, VIEWS } from '../registry.js';
import { initTheme, wireTheme, navElement, lastAlgo } from '../shared/chrome.js';
import { BANK, KINDS, withShuffledOptions } from './bank.mjs';
import { generate } from './generate.mjs';
import * as progress from './progress.mjs';

const $ = (id) => document.getElementById(id);
const dom = {
  answered: $('score-answered'), percent: $('score-percent'), streak: $('score-streak'),
  barFill: $('score-bar-fill'), barLabel: $('score-bar-label'),
  card: $('card'), kindChip: $('kind-chip'), topic: $('card-topic'),
  prompt: $('q-prompt'), note: $('q-note'), code: $('q-code'),
  visual: $('q-visual'), canvas: $('q-canvas'), hint: $('q-hint'),
  options: $('options'),
  feedback: $('feedback'), badge: $('feedback-badge'), extra: $('feedback-extra'),
  feedbackText: $('feedback-text'), links: $('feedback-links'),
  nextBtn: $('next-btn'), skipBtn: $('skip-btn'), footNote: $('foot-note'),
  kindList: $('kind-list'), topicList: $('topic-list'), revisitNote: $('revisit-note'),
  resetBtn: $('reset-btn'),
};

initTheme();
$('topbar-right').prepend(navElement('practice'));
wireTheme($('theme-toggle'), () => drawVisual(currentQuestion));

/* ───────────────────── which formats are on ───────────────────── */

const KINDS_KEY = 'av2:practice:kinds';
const allKinds = Object.keys(KINDS);

function readEnabled() {
  try {
    const saved = JSON.parse(localStorage.getItem(KINDS_KEY));
    if (Array.isArray(saved) && saved.length) return new Set(saved.filter((k) => allKinds.includes(k)));
  } catch {}
  return new Set(allKinds);
}

let enabled = readEnabled();

function saveEnabled() {
  try { localStorage.setItem(KINDS_KEY, JSON.stringify([...enabled])); } catch {}
}

/* ───────────────────── the queue ───────────────────── */

let queue = [];
let currentQuestion = null;
let answered = false;

/**
 * Generated questions are made in batches: producing one costs a full
 * run of an algorithm, so there is no point doing it per question, and
 * no point doing hundreds up front either.
 */
function refill() {
  const written = BANK.filter((q) => enabled.has(q.kind));
  const wantsGenerated = enabled.has('predict') || enabled.has('trace');
  const made = wantsGenerated
    ? generate(14, String(Date.now())).filter((q) => enabled.has(q.kind))
    : [];
  queue = progress.prioritise([...written, ...made]).map(withShuffledOptions);
}

function nextQuestion() {
  if (!queue.length) refill();
  if (!queue.length) {
    showEmpty();
    return;
  }
  currentQuestion = queue.shift();
  answered = false;
  render(currentQuestion);
}

function showEmpty() {
  currentQuestion = null;
  dom.kindChip.textContent = 'nothing selected';
  dom.topic.textContent = '';
  dom.prompt.textContent = 'No question types are turned on.';
  dom.note.hidden = false;
  dom.note.textContent = 'Pick at least one on the right and a question will appear.';
  dom.code.hidden = true;
  dom.visual.hidden = true;
  dom.options.replaceChildren();
  dom.feedback.hidden = true;
  dom.nextBtn.hidden = true;
  dom.skipBtn.hidden = true;
}

/* ───────────────────── rendering ───────────────────── */

function render(q) {
  dom.kindChip.textContent = KINDS[q.kind]?.label ?? q.kind;
  dom.kindChip.dataset.kind = q.kind;
  dom.topic.textContent = q.categoryName ?? '';

  dom.prompt.textContent = q.prompt;

  dom.note.hidden = !q.note;
  if (q.note) dom.note.textContent = q.note;

  if (q.code) {
    dom.code.hidden = false;
    dom.code.querySelector('code').textContent = q.code;
  } else {
    dom.code.hidden = true;
  }

  dom.visual.hidden = !q.frame;
  dom.hint.textContent = q.hint ?? '';
  if (q.frame) requestAnimationFrame(() => drawVisual(q));

  /* ── options ── */
  dom.options.replaceChildren();
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.type = 'button';

    const letter = document.createElement('span');
    letter.className = 'option-letter';
    letter.textContent = 'ABCD'[i] ?? String(i + 1);

    const body = document.createElement('span');
    body.className = 'option-body';
    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = opt.text;
    body.append(text);

    btn.append(letter, body);
    btn.addEventListener('click', () => answer(q, i));
    dom.options.append(btn);
  });

  dom.feedback.hidden = true;
  dom.nextBtn.hidden = true;
  dom.skipBtn.hidden = false;

  const settled = progress.isSettled(q.id);
  dom.footNote.textContent = settled ? 'you have had this one right before' : '';

  dom.card.scrollIntoView({ block: 'nearest' });
  renderScores();
}

/**
 * Generated "predict" questions show the real thing — the same canvas
 * drawing the visualizer uses, on the actual frame the run produced.
 * A redrawn approximation would be a different question.
 */
function drawVisual(q) {
  if (!q?.frame) return;
  const draw = VIEWS[q.view];
  if (!draw) return;
  try {
    draw(dom.canvas, q.frame, q.viewAlgo);
  } catch {
    dom.visual.hidden = true;
  }
}

function answer(q, index) {
  if (answered) return;
  answered = true;

  const chosen = q.options[index];
  const right = !!chosen.correct;

  // Mark every option, not just the one picked: knowing why the other
  // three are wrong is most of the value of a multiple-choice question.
  [...dom.options.children].forEach((btn, i) => {
    const opt = q.options[i];
    btn.disabled = true;
    btn.classList.add(opt.correct ? 'is-right' : 'is-wrong');
    if (i === index) btn.classList.add('is-chosen');
    if (opt.why) {
      const why = document.createElement('span');
      why.className = 'option-why';
      why.textContent = opt.why;
      btn.querySelector('.option-body').append(why);
    }
  });

  progress.record({ id: q.id, kind: q.kind, algo: q.algo, right });

  dom.feedback.hidden = false;
  dom.feedback.dataset.right = String(right);
  dom.badge.textContent = right ? 'correct' : 'not quite';
  dom.extra.textContent = right ? '' : 'the right answer is marked below';
  dom.feedbackText.textContent = q.explain ?? '';

  dom.links.replaceChildren();
  const algo = q.algo && findAlgo(q.algo);
  if (algo) {
    addLink(`index.html#${algo.id}`, `Watch ${algo.name} run →`);
    addLink(`learn.html#${algo.id}`, `Read about ${algo.name} →`);
  }
  if (q.deepen) {
    const p = document.createElement('p');
    p.className = 'feedback-deepen';
    p.textContent = q.deepen;
    dom.links.append(p);
  }

  dom.nextBtn.hidden = false;
  dom.skipBtn.hidden = true;
  dom.nextBtn.focus();
  renderScores();
  renderTopics();
}

function addLink(href, label) {
  const a = document.createElement('a');
  a.className = 'feedback-link';
  a.href = href;
  a.textContent = label;
  dom.links.append(a);
}

/* ───────────────────── scores and panel ───────────────────── */

function renderScores() {
  const s = progress.stats();
  dom.answered.textContent = s.answered;
  dom.percent.textContent = s.percent == null ? '—' : `${s.percent}%`;
  dom.streak.textContent = s.streak;

  // Only the written bank has a fixed size, so it is the only honest
  // denominator — the generated questions are unlimited.
  const settled = BANK.filter((q) => progress.isSettled(q.id)).length;
  const pct = Math.round((settled / BANK.length) * 100);
  dom.barFill.style.width = `${pct}%`;
  dom.barLabel.textContent = `${settled} of ${BANK.length} written questions answered correctly`;
}

function renderKinds() {
  dom.kindList.replaceChildren();
  for (const [kind, meta] of Object.entries(KINDS)) {
    const row = document.createElement('label');
    row.className = 'kind-row';

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = enabled.has(kind);
    box.addEventListener('change', () => {
      if (box.checked) enabled.add(kind);
      else enabled.delete(kind);
      if (!enabled.size) { enabled.add(kind); box.checked = true; return; }
      saveEnabled();
      refill();
      if (!answered) nextQuestion();
    });

    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'kind-name';
    name.textContent = meta.label;
    const blurb = document.createElement('span');
    blurb.className = 'kind-blurb';
    blurb.textContent = meta.blurb;

    const k = progress.byKind()[kind];
    if (k && k.right + k.wrong > 0) {
      const tally = document.createElement('span');
      tally.className = 'kind-tally';
      tally.textContent = `${k.right}/${k.right + k.wrong}`;
      name.append(' ', tally);
    }

    text.append(name, blurb);
    row.append(box, text);
    dom.kindList.append(row);
  }
}

function renderTopics() {
  const perCat = progress.categoryProgress(BANK);
  dom.topicList.replaceChildren();

  for (const [name, slot] of [...perCat].sort((a, b) => a[0].localeCompare(b[0]))) {
    const row = document.createElement('div');
    row.className = 'topic-row';

    const label = document.createElement('span');
    label.className = 'topic-name';
    label.textContent = name;

    const bar = document.createElement('span');
    bar.className = 'topic-bar';
    const done = document.createElement('span');
    done.className = 'topic-bar-done';
    done.style.width = `${Math.round((slot.settled / slot.total) * 100)}%`;
    const wrong = document.createElement('span');
    wrong.className = 'topic-bar-wrong';
    wrong.style.width = `${Math.round((slot.wrong / slot.total) * 100)}%`;
    bar.append(done, wrong);

    const count = document.createElement('span');
    count.className = 'topic-count';
    count.textContent = `${slot.settled}/${slot.total}`;

    row.append(label, bar, count);
    dom.topicList.append(row);
  }

  const revisit = progress.needsRevisit().length;
  dom.revisitNote.textContent = revisit
    ? `${revisit} question${revisit === 1 ? '' : 's'} to come back to — they are queued first.`
    : 'Nothing outstanding. Questions you get wrong are queued up again here.';
}

/* ───────────────────── controls ───────────────────── */

dom.nextBtn.addEventListener('click', nextQuestion);
dom.skipBtn.addEventListener('click', () => {
  // A skip is not a wrong answer: it goes to the back rather than into
  // the revisit list, because "not now" is not "I got this wrong".
  if (currentQuestion) queue.push(currentQuestion);
  nextQuestion();
});

dom.resetBtn.addEventListener('click', () => {
  if (!confirm('Clear everything this browser has recorded about your practice? This cannot be undone.')) return;
  progress.reset();
  refill();
  renderScores();
  renderKinds();
  renderTopics();
  nextQuestion();
});

// 1–4 to answer, enter or space for the next one: answering a few dozen
// questions with the mouse is more tiring than it needs to be.
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (!answered && /^[1-4]$/.test(e.key)) {
    const btn = dom.options.children[Number(e.key) - 1];
    if (btn) { btn.click(); e.preventDefault(); }
    return;
  }
  if (answered && (e.key === 'Enter' || e.key === ' ')) {
    nextQuestion();
    e.preventDefault();
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => drawVisual(currentQuestion), 90);
});

/* ───────────────────── start ───────────────────── */

renderKinds();
renderTopics();
renderScores();
refill();

/* A link from the Learn page names an algorithm; lead with its questions
   if the bank has any, rather than ignoring what brought you here. */
const wanted = location.hash.slice(1) || lastAlgo();
if (wanted) {
  const first = queue.findIndex((q) => q.algo === wanted);
  if (first > 0) queue.unshift(queue.splice(first, 1)[0]);
}

nextQuestion();
