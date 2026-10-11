/* Graphs: each algorithm checked against an independent implementation of
   the same problem — usually a different algorithm entirely, so a shared
   misunderstanding cannot pass both. */

import { load, check, reset, tally, same } from './harness.mjs';

export const name = 'graphs';

export async function run() {
  reset();
  const { GRAPHS } = await load('algorithms/graphs/graph.js');
  const { record } = await load('engine/player.js');
  const { buildGraph } = await load('inputs.js');

  const get = (id) => GRAPHS.find((a) => a.id === id);
  const makeGraph = (n, spec, extra = 0.4) => {
    const g = buildGraph(n, spec, { extra });
    g.nodes.forEach((nd) => { nd.x = Math.random(); nd.y = Math.random(); });
    return g;
  };

  /* ── BFS hop counts ── */
  const bfs = get('graph-bfs');
  for (let t = 0; t < 20; t++) {
    const g = makeGraph(4 + Math.floor(Math.random() * 9), bfs.graph);
    const d = new Map([[0, 0]]); const q = [0];
    while (q.length) { const u = q.shift(); for (const { to } of g.adj[u]) if (!d.has(to)) { d.set(to, d.get(u) + 1); q.push(to); } }
    const got = record(bfs.run(g), 200000).at(-1).nodeLabel;
    for (let i = 0; i < g.nodes.length; i++) {
      check(got[i] === (d.has(i) ? String(d.get(i)) : '∞'), `BFS hop count wrong at node ${i}`);
    }
  }

  /* ── Dijkstra against repeated relaxation ── */
  const dij = get('graph-dijkstra');
  for (let t = 0; t < 20; t++) {
    const g = makeGraph(4 + Math.floor(Math.random() * 9), dij.graph);
    const n = g.nodes.length;
    const d = new Array(n).fill(Infinity); d[0] = 0;
    for (let i = 0; i < n; i++) for (let u = 0; u < n; u++) for (const { to, w } of g.adj[u]) if (d[u] + w < d[to]) d[to] = d[u] + w;
    const got = record(dij.run(g), 200000).at(-1).nodeLabel;
    for (let i = 0; i < n; i++) {
      check(got[i] === (Number.isFinite(d[i]) ? String(d[i]) : '∞'), `Dijkstra distance wrong at node ${i}`);
    }
  }

  /* ── the two spanning trees must weigh the same ── */
  for (let t = 0; t < 20; t++) {
    const g = makeGraph(5 + Math.floor(Math.random() * 8), get('graph-kruskal').graph);
    const k = record(get('graph-kruskal').run(g), 200000).at(-1).stats['total weight'];
    const p = record(get('graph-prim').run(g), 200000).at(-1).stats['total weight'];
    check(k === p, `Kruskal says ${k}, Prim says ${p} — a minimum spanning tree has one weight`);
  }

  /* ── topological order must respect every edge ── */
  const topo = get('graph-topo');
  for (let t = 0; t < 20; t++) {
    const g = makeGraph(4 + Math.floor(Math.random() * 9), topo.graph);
    const last = record(topo.run(g), 200000).at(-1);
    const m = last.note.match(/valid order: (.+)$/);
    if (!check(m !== null, 'topological sort found no order on an acyclic graph')) continue;
    const pos = new Map(m[1].split(' → ').map((nm, i) => [nm, i]));
    for (const e of g.edges) {
      check(pos.get(g.nodes[e.a].name) < pos.get(g.nodes[e.b].name),
        `topological order puts ${g.nodes[e.b].name} before ${g.nodes[e.a].name} despite an edge between them`);
    }
  }

  /* ── Tarjan against Kosaraju: two different algorithms, same answer ── */
  const tarjan = get('graph-tarjan');
  for (let t = 0; t < 20; t++) {
    const g = makeGraph(4 + Math.floor(Math.random() * 9), tarjan.graph, 0.3 + Math.random() * 0.6);
    const n = g.nodes.length;
    const adj = Array.from({ length: n }, () => []), rev = Array.from({ length: n }, () => []);
    for (const e of g.edges) { adj[e.a].push(e.b); rev[e.b].push(e.a); }
    const seen = new Uint8Array(n), order = [];
    const d1 = (u) => { seen[u] = 1; for (const v of adj[u]) if (!seen[v]) d1(v); order.push(u); };
    for (let i = 0; i < n; i++) if (!seen[i]) d1(i);
    const comp = new Int32Array(n).fill(-1); let c = 0;
    const d2 = (u) => { comp[u] = c; for (const v of rev[u]) if (comp[v] === -1) d2(v); };
    for (let i = order.length - 1; i >= 0; i--) if (comp[order[i]] === -1) { d2(order[i]); c++; }

    const got = record(tarjan.run(g), 300000).at(-1).nodeGroup;
    const group = (arr) => {
      const m = new Map();
      arr.forEach((g2, i) => { if (!m.has(g2)) m.set(g2, []); m.get(g2).push(i); });
      return JSON.stringify([...m.values()].map((x) => x.sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]));
    };
    check(group(got) === group([...comp]), 'Tarjan and Kosaraju disagree on the components');
  }

  /* ── bipartite: the verdict, and that a yes really does split the edges ── */
  const bip = get('graph-bipartite');
  for (let t = 0; t < 20; t++) {
    const g = makeGraph(4 + Math.floor(Math.random() * 9), bip.graph, 0.2 + Math.random() * 0.7);
    const n = g.nodes.length, side = new Array(n).fill(-1);
    let truth = true;
    for (let s = 0; s < n && truth; s++) {
      if (side[s] !== -1) continue;
      side[s] = 0; const q = [s];
      while (q.length && truth) {
        const u = q.shift();
        for (const { to } of g.adj[u]) {
          if (side[to] === -1) { side[to] = 1 - side[u]; q.push(to); }
          else if (side[to] === side[u]) truth = false;
        }
      }
    }
    const last = record(bip.run(g), 200000).at(-1);
    const said = /^bipartite/.test(last.note);
    check(said === truth, `bipartite verdict wrong: said ${said}, truth ${truth}`);
    if (said) {
      const lab = last.nodeLabel;
      check(!g.edges.some((e) => lab[e.a] === lab[e.b]), 'claimed bipartite but an edge joins two nodes on the same side');
    }
  }

  return tally();
}
