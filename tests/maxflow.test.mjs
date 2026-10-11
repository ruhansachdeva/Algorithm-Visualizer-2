/* Max flow. Checked three ways, because a flow algorithm can produce a
   plausible-looking answer that is simply not maximum. */

import { load, check, reset, tally } from './harness.mjs';

export const name = 'max flow';

export async function run() {
  reset();
  const { MAXFLOW } = await load('algorithms/graphs/maxflow.js');
  const { record } = await load('engine/player.js');
  const { buildGraph } = await load('inputs.js');
  const algo = MAXFLOW[0];

  /** Reference: Dinic's algorithm — a different algorithm, same answer. */
  function dinic(n, edges, s, t) {
    const to = [], capacity = [], head = Array.from({ length: n }, () => []);
    const add = (u, v, c) => {
      head[u].push(to.length); to.push(v); capacity.push(c);
      head[v].push(to.length); to.push(u); capacity.push(0);
    };
    for (const e of edges) add(e.a, e.b, Math.max(1, Math.abs(e.w)));

    let flow = 0;
    for (;;) {
      const level = new Array(n).fill(-1);
      level[s] = 0;
      const q = [s];
      for (let i = 0; i < q.length; i++) {
        for (const id of head[q[i]]) {
          if (capacity[id] > 0 && level[to[id]] < 0) { level[to[id]] = level[q[i]] + 1; q.push(to[id]); }
        }
      }
      if (level[t] < 0) return flow;

      const it = new Array(n).fill(0);
      const dfs = (u, pushed) => {
        if (u === t || pushed === 0) return pushed;
        for (; it[u] < head[u].length; it[u]++) {
          const id = head[u][it[u]], v = to[id];
          if (level[v] !== level[u] + 1 || capacity[id] === 0) continue;
          const got = dfs(v, Math.min(pushed, capacity[id]));
          if (got > 0) { capacity[id] -= got; capacity[id ^ 1] += got; return got; }
        }
        return 0;
      };
      for (;;) { const got = dfs(s, Infinity); if (!got) break; flow += got; }
    }
  }

  for (let trial = 0; trial < 50; trial++) {
    const n = 4 + Math.floor(Math.random() * 7);
    const g = buildGraph(n, algo.graph, { extra: 0.4 + Math.random() * 0.6 });
    g.nodes.forEach((nd) => { nd.x = Math.random(); nd.y = Math.random(); });

    const last = record(algo.run(g), 400000).at(-1);
    const got = last.stats['flow pushed'];
    const want = dinic(n, g.edges, 0, n - 1);

    check(got === want, `max flow gave ${got}, Dinic's gives ${want} on a ${n}-node network`);

    /* 1. Conservation: everything into a middle node must come back out. */
    const carried = last.edgeLabel.map((s2) => Number(s2.split('/')[0]));
    for (let v = 1; v < n - 1; v++) {
      let inFlow = 0, outFlow = 0;
      g.edges.forEach((e, i) => { if (e.b === v) inFlow += carried[i]; if (e.a === v) outFlow += carried[i]; });
      check(inFlow === outFlow, `node ${v} takes in ${inFlow} but puts out ${outFlow} — flow must be conserved`);
    }

    /* 2. No pipe may carry more than it holds, or a negative amount. */
    g.edges.forEach((e, i) => {
      const capacity = Math.max(1, Math.abs(e.w));
      check(carried[i] >= 0 && carried[i] <= capacity,
        `an edge carries ${carried[i]} against a capacity of ${capacity}`);
    });

    /* 3. What leaves the source must equal the reported total. */
    let fromSource = 0;
    g.edges.forEach((e, i) => { if (e.a === 0) fromSource += carried[i]; if (e.b === 0) fromSource -= carried[i]; });
    check(fromSource === got, `${fromSource} leaves the source but ${got} was reported`);

    /* 4. Max-flow min-cut: the reported cut must equal the flow. */
    const cut = last.stats['cut capacity'];
    if (cut !== undefined) check(cut === got, `the cut totals ${cut} but the flow is ${got} — these must be equal`);
  }


  /* A network that REQUIRES residual edges.

     Random small networks turn out not to exercise them: with
     shortest-path selection, pushing only forwards happens to reach the
     true maximum almost every time, so deleting the backward-edge code
     passed the random tests untouched. This one was found by searching
     for a case where forward-only falls short, and it is pinned here so
     that code path can never silently rot. */
  {
    const edges = [
      { a: 0, b: 1, w: 6 }, { a: 0, b: 2, w: 2 }, { a: 0, b: 5, w: 2 },
      { a: 0, b: 6, w: 5 }, { a: 0, b: 7, w: 5 }, { a: 1, b: 2, w: 6 },
      { a: 1, b: 4, w: 1 }, { a: 1, b: 5, w: 3 }, { a: 1, b: 6, w: 1 },
      { a: 2, b: 1, w: 3 }, { a: 2, b: 3, w: 5 }, { a: 2, b: 4, w: 3 },
      { a: 2, b: 7, w: 5 }, { a: 3, b: 2, w: 6 }, { a: 3, b: 7, w: 3 },
      { a: 4, b: 3, w: 3 }, { a: 4, b: 5, w: 1 }, { a: 5, b: 1, w: 1 },
      { a: 5, b: 6, w: 4 }, { a: 5, b: 7, w: 5 }, { a: 6, b: 5, w: 4 },
    ];
    const n = 8;
    const nodes = Array.from({ length: n }, (_, i) => ({ name: 'ABCDEFGH'[i], x: Math.random(), y: Math.random() }));
    const adj = Array.from({ length: n }, () => []);
    edges.forEach((e, i) => adj[e.a].push({ to: e.b, w: e.w, edge: i }));

    const last = record(algo.run({ nodes, edges, adj, directed: true, weighted: true, start: 0 }), 400000).at(-1);
    const want = dinic(n, edges, 0, n - 1);
    check(last.stats['flow pushed'] === want,
      `on the pinned network the flow was ${last.stats['flow pushed']}, the true maximum is ${want} — ` +
      'reaching it needs a route that runs BACKWARDS along an edge to undo an earlier commitment');
  }

  return tally();
}
