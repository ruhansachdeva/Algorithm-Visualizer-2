/* ============================================================
   MAXIMUM FLOW — Edmonds-Karp
   ------------------------------------------------------------
   How much can you push from a source to a sink through a
   network of pipes with limited capacity? The answer runs
   traffic routing, airline scheduling, image segmentation and
   bipartite matching, all of which reduce to this.

   The algorithm is almost obvious: find any route with room to
   spare, push as much as that route allows, repeat. What is not
   obvious is the RESIDUAL edge — every unit you push creates a
   matching unit of capacity going backwards, so a later path can
   undo an earlier bad decision. Without that you can get stuck
   below the true maximum with no way back.

   Edmonds-Karp is this with one rule added: always take the
   route with the FEWEST edges, found by breadth-first search.
   That single choice is what pins the running time to O(V·E²),
   independent of how large the capacities are.
   ============================================================ */

import { N, E } from '../../views/graph-view.js';

const maxFlow = {
  view: 'graph',
  input: 'graph',
  id: 'graph-max-flow',
  name: 'Maximum Flow (Edmonds-Karp)',
  // acyclic matters here, and not for the usual reason. buildGraph wires
  // a spanning tree and then picks each edge's direction at random, so on
  // a general directed graph there is usually no route from node 0 to the
  // last node at all — 62% of nine-node graphs had none, and the
  // visualizer answered "maximum flow: 0" to most of the runs anybody
  // ever started. Orienting every edge from the lower index to the higher
  // guarantees a source-to-sink path, because each node's spanning-tree
  // parent has a smaller index and the chain therefore reaches 0.
  // A layered network from source to sink is also how every textbook
  // draws one.
  graph: { directed: true, weighted: true, acyclic: true },
  legend: [
    ['--c-compare', 'the route being pushed along'],
    ['--c-path',    'carrying flow'],
    ['--c-swap',    'full — no room left'],
    ['--c-cursor',  'source'],
    ['--c-sorted',  'sink'],
  ],
  about: 'How much can you push from a source to a sink through pipes of limited capacity? Find any route with room to spare, push as much as it allows, repeat. The subtle part is the residual edge: every unit pushed creates a matching unit of capacity going BACKWARDS, so a later route can undo an earlier bad choice — without that you can get stuck below the true maximum. Edmonds-Karp always takes the route with the fewest edges, which is what pins the cost to O(V·E²) no matter how large the capacities are.',
  cost: { best: 'O(E)', avg: 'O(V·E²)', worst: 'O(V·E²)', space: 'O(V + E)', stable: '—' },
  pseudocode: [
    'flow = 0',
    'while a route from source to sink still has room:',
    '  find the one with the FEWEST edges (breadth-first)',
    '  its capacity is the smallest spare capacity along it',
    '  push that much, and add the same amount of capacity backwards',
    'when no route has room left, the flow is maximum',
  ],
  *run(inp) {
    const n = inp.nodes.length;
    if (n < 2) { yield frame(inp, new Uint8Array(n), new Uint8Array(inp.edges.length), [], { note: 'need at least two nodes' }); return; }

    const source = 0;
    const sink = n - 1;

    /* Residual network: for each original edge, how much more can still go
       forward, and how much can be taken back. */
    const cap = inp.edges.map((e) => Math.max(1, Math.abs(e.w)));
    const flow = new Array(inp.edges.length).fill(0);

    /** Every way out of `u`, forward along an edge or backward against one. */
    const movesFrom = (u) => {
      const out = [];
      inp.edges.forEach((e, i) => {
        if (e.a === u && cap[i] - flow[i] > 0) out.push({ to: e.b, edge: i, spare: cap[i] - flow[i], forward: true });
        if (e.b === u && flow[i] > 0) out.push({ to: e.a, edge: i, spare: flow[i], forward: false });
      });
      return out;
    };

    let total = 0, augmentations = 0, searches = 0;

    const labels = () => inp.edges.map((e, i) => `${flow[i]}/${cap[i]}`);
    const states = () => {
      const es = new Uint8Array(inp.edges.length);
      for (let i = 0; i < inp.edges.length; i++) {
        if (flow[i] === cap[i]) es[i] = E.REJECTED;        // saturated
        else if (flow[i] > 0) es[i] = E.CHOSEN;            // carrying something
      }
      return es;
    };
    const nodes = () => {
      const ns = new Uint8Array(n);
      ns[source] = N.START;
      ns[sink] = N.DONE;
      return ns;
    };
    const f = (extra) => frame(inp, extra.ns ?? nodes(), extra.es ?? states(), labels(), {
      stats: { 'flow pushed': total, routes: augmentations, searches },
      ...extra,
    });

    yield f({ line: 0, note: `pushing from ${inp.nodes[source].name} to ${inp.nodes[sink].name} — every edge starts empty` });

    while (true) {
      /* ── breadth-first, so the route found has the fewest edges ── */
      searches++;
      const cameFrom = new Map([[source, null]]);
      const queue = [source];
      while (queue.length && !cameFrom.has(sink)) {
        const u = queue.shift();
        for (const move of movesFrom(u)) {
          if (cameFrom.has(move.to)) continue;
          cameFrom.set(move.to, { from: u, ...move });
          queue.push(move.to);
        }
      }

      if (!cameFrom.has(sink)) {
        yield f({ line: 5, note: `no route left with any room — ${total} is the maximum` });
        break;
      }

      /* ── walk it back to find the tightest pipe ── */
      const route = [];
      for (let at = sink; at !== source; at = cameFrom.get(at).from) route.push(cameFrom.get(at));
      route.reverse();

      const bottleneck = Math.min(...route.map((m) => m.spare));
      const es = states();
      for (const m of route) es[m.edge] = E.LOOKING;
      const ns = nodes();
      for (const m of route) if (m.to !== sink) ns[m.to] = N.CURRENT;

      yield f({
        ns, es, line: 2,
        note: `route ${[inp.nodes[source].name, ...route.map((m) => inp.nodes[m.to].name)].join(' → ')} — the tightest pipe on it has ${bottleneck} spare`,
      });

      /* ── push, remembering that going backwards RETURNS flow ── */
      for (const m of route) {
        if (m.forward) flow[m.edge] += bottleneck;
        else flow[m.edge] -= bottleneck;
      }
      total += bottleneck;
      augmentations++;

      const usedBackward = route.some((m) => !m.forward);
      yield f({
        line: 4,
        note: `pushed ${bottleneck} — total is now ${total}` +
          (usedBackward ? '. That route went backwards along an edge, taking back flow an earlier route had committed.' : ''),
      });
    }

    /* ── the minimum cut: what the flow is actually limited by ── */
    const reachable = new Set([source]);
    const queue = [source];
    while (queue.length) {
      const u = queue.shift();
      for (const m of movesFrom(u)) if (!reachable.has(m.to)) { reachable.add(m.to); queue.push(m.to); }
    }
    const cutEdges = [];
    inp.edges.forEach((e, i) => { if (reachable.has(e.a) && !reachable.has(e.b)) cutEdges.push(i); });

    const es = states();
    for (const i of cutEdges) es[i] = E.REJECTED;
    const ns = nodes();
    for (const u of reachable) if (u !== source) ns[u] = N.VISITED;

    const cutTotal = cutEdges.reduce((sum, i) => sum + cap[i], 0);
    yield f({
      ns, es, line: 5,
      note: `maximum flow ${total}. The bottleneck is the cut ${cutEdges.map((i) => `${inp.nodes[inp.edges[i].a].name}→${inp.nodes[inp.edges[i].b].name}`).join(', ') || '(none)'}, whose capacities total ${cutTotal} — the same number, which is no coincidence.`,
      stats: { 'flow pushed': total, routes: augmentations, searches, 'cut capacity': cutTotal },
    });
  },
};

function frame(inp, ns, es, edgeLabel, extra = {}) {
  return {
    nodes: inp.nodes,
    edges: inp.edges,
    nodeState: ns.slice(),
    edgeState: es.slice(),
    edgeLabel,
    directed: true,
    weighted: true,
    ...extra,
  };
}

export const MAXFLOW = [maxFlow];
