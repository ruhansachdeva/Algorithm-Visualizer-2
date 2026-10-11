/* ============================================================
   GRAPH COLOURING
   ------------------------------------------------------------
   Give every node a colour so that no edge joins two of the same.
   The classic use is timetabling: nodes are exams, an edge means
   a student sits both, and a colour is a time slot — so the
   fewest colours is the shortest exam period.

   Two colours is easy (that is the bipartite check). Three is
   NP-complete, which is why this one has to guess and backtrack
   where the bipartite check never does.
   ============================================================ */

import { N, E } from '../../views/graph-view.js';

const PALETTE = ['#4da3ff', '#3ddc84', '#ffc53d', '#c678dd', '#ff8c42', '#2dd4bf'];

const coloring = {
  view: 'graph',
  input: 'graph',
  id: 'bt-coloring',
  name: 'Graph Colouring',
  graph: { directed: false, weighted: false },
  legend: [
    ['--c-swap',    'node being coloured'],
    ['--c-compare', 'edge being checked'],
    ['#4da3ff',     'colour 1'],
    ['#3ddc84',     'colour 2'],
    ['#ffc53d',     'colour 3'],
  ],
  about: 'Colour every node so no edge joins two of the same. The real use is scheduling: nodes are exams, an edge means some student sits both, a colour is a time slot — so the fewest colours is the shortest exam timetable. Deciding whether two colours suffice is easy, and is exactly the bipartite check. Three is NP-complete, which is why this one has to guess and undo where the bipartite check never does.',
  cost: { best: 'O(n)', avg: 'O(mⁿ)', worst: 'O(mⁿ)', space: 'O(n)', stable: '—' },
  pseudocode: [
    'colour(node):',
    '  if every node is coloured, we are done',
    '  for each available colour:',
    '    if no neighbour already has it, use it and recurse',
    '    if that leads nowhere, take the colour back off',
    '  having run out of colours, report failure upward',
  ],
  *run(inp) {
    const n = inp.nodes.length;
    const limit = inp.colors ?? 3;
    const ns = new Uint8Array(n);
    const es = new Uint8Array(inp.edges.length);
    const colour = new Int32Array(n).fill(-1);
    let tries = 0, backtracks = 0;

    const f = (extra) => ({
      nodes: inp.nodes, edges: inp.edges,
      nodeState: ns.slice(), edgeState: es.slice(),
      nodeGroup: Array.from(colour),
      directed: false, weighted: false,
      stats: { 'colours allowed': limit, 'colours tried': tries, backtracks, coloured: colour.filter((c) => c >= 0).length },
      ...extra,
    });

    yield f({ line: 0, note: `trying to colour ${n} nodes with ${limit} colour${limit === 1 ? '' : 's'}` });

    function* paint(i) {
      if (i === n) return true;

      for (let c = 0; c < limit; c++) {
        tries++;

        // does any neighbour already wear this colour?
        let clash = -1;
        for (const { to, edge } of inp.adj[i]) {
          if (colour[to] === c) { clash = to; es[edge] = E.LOOKING; break; }
        }

        colour[i] = c;
        ns[i] = N.CURRENT;
        yield f({
          line: 3,
          note: clash === -1
            ? `${inp.nodes[i].name} takes colour ${c + 1}`
            : `${inp.nodes[i].name} cannot take colour ${c + 1} — ${inp.nodes[clash].name} already has it`,
        });

        if (clash !== -1) { colour[i] = -1; es.fill(E.IDLE); continue; }

        ns[i] = N.DONE;
        if (yield* paint(i + 1)) return true;

        backtracks++;
        colour[i] = -1;
        ns[i] = N.CURRENT;
        yield f({ line: 4, note: `nothing works further along — take colour ${c + 1} back off ${inp.nodes[i].name}` });
      }

      ns[i] = N.IDLE;
      return false;
    }

    const ok = yield* paint(0);

    if (ok) for (let i = 0; i < n; i++) ns[i] = N.DONE;
    const used = new Set([...colour].filter((c) => c >= 0)).size;

    yield f({
      line: ok ? 1 : 5,
      note: ok
        ? `coloured with ${used} colour${used === 1 ? '' : 's'} after ${backtracks} backtrack${backtracks === 1 ? '' : 's'} — no edge joins two of the same`
        : `${limit} colour${limit === 1 ? '' : 's'} is not enough for this graph — every combination was tried and every one clashed`,
    });
  },
};

export const COLORING = [coloring];
