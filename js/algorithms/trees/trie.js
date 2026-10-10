/* ============================================================
   TRIES (prefix trees)
   ------------------------------------------------------------
   A tree where the PATH spells the word, not the node. Nothing is
   stored in a node except "a word ends here" — the letters live on
   the way down.

   The payoff is that words sharing a prefix share the path, so
   looking a word up costs the length of the word and nothing to do
   with how many words are stored. A dictionary of a million words
   finds a five-letter word in five steps.
   ============================================================ */

import { T, TREE_LEGEND } from '../../views/tree-view.js';

const base = { view: 'tree', input: 'words', legend: TREE_LEGEND };

/** A trie node: a letter, a map of children, and an end-of-word flag. */
function newTrie() {
  return { nodes: [{ label: '·', kids: new Map(), end: false }], root: 0 };
}

function addChild(t, parent, ch) {
  t.nodes.push({ label: ch, kids: new Map(), end: false });
  const idx = t.nodes.length - 1;
  t.nodes[parent].kids.set(ch, idx);
  return idx;
}

/**
 * Convert to what the tree view wants: children as an ordered array.
 * Sorting by letter keeps the picture stable as words are added.
 */
function toFrame(t, states, extra = {}) {
  return {
    nodes: t.nodes.map((n) => ({
      label: n.label,
      tag: n.end ? '✓' : '',
      children: [...n.kids.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, i]) => i),
    })),
    root: t.root,
    states: states.slice(),
    binary: false,          // n-ary: no left/right slots to preserve
    ...extra,
  };
}

const clear = (t) => new Array(t.nodes.length).fill(T.IDLE);

/* ───────────────────────── Insert ──────────────────────── */

const trieInsert = {
  ...base,
  id: 'trie-insert',
  name: 'Trie Insert',
  about: 'Each word is spelled out from the root, one letter per edge, creating nodes only where the path does not already exist. Words that start the same way share their path — add CAR after CAT and only the R is new. A ✓ marks where a word ends, which is how CAR and CARD can both live on the same branch.',
  cost: { best: 'O(m)', avg: 'O(m)', worst: 'O(m)', space: 'O(total letters)', stable: '—' },
  pseudocode: [
    'for each word:',
    '  start at the root',
    '  for each letter:',
    '    if there is no child for it, make one',
    '    step into that child',
    '  mark the final node as the end of a word',
  ],
  *run({ words }) {
    const t = newTrie();
    let created = 0, reused = 0;

    if (!words?.length) {
      yield toFrame(t, clear(t), { note: 'no words — type some into the box below', stats: { words: 0, nodes: 1 } });
      return;
    }

    yield toFrame(t, clear(t), { line: 0, note: 'an empty trie — just a root', stats: { words: 0, nodes: 1, 'nodes reused': 0 } });

    for (const word of words) {
      let cur = t.root;
      const path = [cur];

      yield toFrame(t, clear(t), { line: 1, note: `inserting "${word}"`, stats: { words: words.indexOf(word), nodes: t.nodes.length, 'nodes reused': reused } });

      for (const ch of word) {
        const existing = t.nodes[cur].kids.get(ch);

        if (existing !== undefined) {
          reused++;
          cur = existing;
          path.push(cur);
          const st = clear(t);
          for (const p of path) st[p] = T.PATH;
          st[cur] = T.COMPARE;
          yield toFrame(t, st, { line: 3, note: `'${ch}' already on this path — follow it, nothing new to build`, stats: { words: words.indexOf(word), nodes: t.nodes.length, 'nodes reused': reused } });
        } else {
          cur = addChild(t, cur, ch);
          created++;
          path.push(cur);
          const st = clear(t);
          for (const p of path) st[p] = T.PATH;
          st[cur] = T.INSERTED;
          yield toFrame(t, st, { line: 3, note: `'${ch}' is new — add a node`, stats: { words: words.indexOf(word), nodes: t.nodes.length, 'nodes reused': reused } });
        }
      }

      t.nodes[cur].end = true;
      const st = clear(t);
      for (const p of path) st[p] = T.PATH;
      st[cur] = T.FOUND;
      yield toFrame(t, st, { line: 5, note: `"${word}" ends here — marked with ✓`, stats: { words: words.indexOf(word) + 1, nodes: t.nodes.length, 'nodes reused': reused } });
    }

    const letters = words.reduce((a, w) => a + w.length, 0);
    yield toFrame(t, new Array(t.nodes.length).fill(T.DONE), {
      note: `${words.length} word${words.length === 1 ? '' : 's'} in ${t.nodes.length - 1} letter node${t.nodes.length === 2 ? '' : 's'} (plus the root) — ` +
        `spelling them out separately would take ${letters} letters, so sharing prefixes saved ${letters - created}`,
      stats: { words: words.length, nodes: t.nodes.length, 'nodes reused': reused },
    });
  },
};

/* ───────────────────────── Search ──────────────────────── */

const trieSearch = {
  ...base,
  id: 'trie-search',
  name: 'Trie Search',
  about: 'Walk down one edge per letter. Three outcomes, and the difference matters: you fall off the tree (not stored), you land on a node with no ✓ (it is only a prefix of other words), or you land on a ✓ (a real word). That middle case is exactly what autocomplete needs — everything below that node is a completion.',
  cost: { best: 'O(1)', avg: 'O(m)', worst: 'O(m)', space: 'O(1)', stable: '—' },
  pseudocode: [
    'start at the root',
    'for each letter of the query:',
    '  if there is no child for it, the word is not here — stop',
    '  step into that child',
    'landed on a ✓  → the word is stored',
    'landed without → it is only a prefix of longer words',
  ],
  *run({ words, target }) {
    const t = newTrie();

    if (!words?.length) {
      yield toFrame(t, clear(t), { note: 'no words to search — type some into the box below', stats: { steps: 0 } });
      return;
    }
    if (!target) {
      yield toFrame(t, clear(t), { note: 'type a word to look up', stats: { steps: 0 } });
      return;
    }

    // build it quietly first — this run is about the lookup
    for (const word of words) {
      let cur = t.root;
      for (const ch of word) {
        cur = t.nodes[cur].kids.get(ch) ?? addChild(t, cur, ch);
      }
      t.nodes[cur].end = true;
    }

    let cur = t.root;
    const path = [cur];
    let steps = 0;

    yield toFrame(t, clear(t), { line: 0, note: `looking up "${target}"`, stats: { steps: 0, 'nodes in trie': t.nodes.length } });

    for (const ch of target) {
      const next = t.nodes[cur].kids.get(ch);
      steps++;

      if (next === undefined) {
        const st = clear(t);
        for (const p of path) st[p] = T.PATH;
        st[cur] = T.REMOVED;
        yield toFrame(t, st, { line: 2, note: `no '${ch}' from here — "${target}" is not in the trie, and neither is anything starting with it`, stats: { steps, 'nodes in trie': t.nodes.length } });
        return;
      }

      cur = next;
      path.push(cur);
      const st = clear(t);
      for (const p of path) st[p] = T.PATH;
      st[cur] = T.COMPARE;
      yield toFrame(t, st, { line: 3, note: `'${ch}' — step down`, stats: { steps, 'nodes in trie': t.nodes.length } });
    }

    const st = clear(t);
    for (const p of path) st[p] = T.PATH;
    st[cur] = t.nodes[cur].end ? T.FOUND : T.INSERTED;

    if (t.nodes[cur].end) {
      yield toFrame(t, st, { line: 4, note: `✓ — "${target}" is a stored word, found in ${steps} step${steps === 1 ? '' : 's'}`, stats: { steps, 'nodes in trie': t.nodes.length } });
    } else {
      // everything below this node is a valid completion
      const completions = [];
      (function collect(i, acc) {
        if (t.nodes[i].end) completions.push(target + acc);
        for (const [ch, k] of t.nodes[i].kids) collect(k, acc + ch);
      })(cur, '');
      yield toFrame(t, st, {
        line: 5,
        note: completions.length
          ? `"${target}" is only a prefix — but it completes to ${completions.join(', ')}`
          : `"${target}" is a prefix of nothing stored`,
        stats: { steps, 'nodes in trie': t.nodes.length, completions: completions.length },
      });
    }
  },
};

export const TRIES = [trieInsert, trieSearch];
