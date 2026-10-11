/* ============================================================
   GRAPH ALGORITHMS
   ------------------------------------------------------------
   The grid algorithms were a special case of these: a grid is
   just a graph where every cell is joined to its four neighbours.
   Here the shape is arbitrary, edges carry weights, and some
   graphs are one-way.
   ============================================================ */

import { N, E, GRAPH_LEGEND } from '../../views/graph-view.js';
import { MinHeap } from './grid.js';

const base = { view: 'graph', input: 'graph' };

/** One frame. nodes/edges are shared — only the state arrays are copied. */
function gf(inp, ns, es, extra = {}) {
  return {
    nodes: inp.nodes,
    edges: inp.edges,
    nodeState: ns.slice(),
    edgeState: es.slice(),
    directed: inp.directed,
    weighted: inp.weighted,
    ...extra,
  };
}

const blankN = (inp) => new Uint8Array(inp.nodes.length);
const blankE = (inp) => new Uint8Array(inp.edges.length);
const nm = (inp, i) => inp.nodes[i].name;

/** Pretty-print a distance array for the labels under each node. */
function distLabels(dist) {
  return Array.from(dist, (d) => (Number.isFinite(d) ? String(d) : '∞'));
}

/* ───────────────────────── BFS ─────────────────────────── */

const bfs = {
  ...base,
  id: 'graph-bfs',
  legend: GRAPH_LEGEND.traverse,
  name: 'BFS (graph)',
  about: 'Visits every node one "hop radius" at a time using a queue. On an unweighted graph the order it reaches nodes IS the shortest-path order, so the hop count it records for each node is the true minimum number of edges from the start.',
  cost: { best: 'O(V + E)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: false },
  pseudocode: [
    'queue = [start], mark start seen',
    'while the queue is not empty:',
    '  take the front node off the queue',
    '  for each neighbour not yet seen:',
    '    mark it seen, record hops, add it to the back',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const dist = new Float64Array(inp.nodes.length).fill(Infinity);
    const queue = [inp.start];
    dist[inp.start] = 0;
    ns[inp.start] = N.START;
    let visited = 0;

    yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 0, note: `starting from ${nm(inp, inp.start)}`, stats: { visited: 0, 'queue size': 1 } });

    while (queue.length) {
      const u = queue.shift();
      visited++;
      if (u !== inp.start) ns[u] = N.CURRENT;
      yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 2, note: `at ${nm(inp, u)}, ${dist[u]} hop${dist[u] === 1 ? '' : 's'} from the start`, stats: { visited, 'queue size': queue.length } });

      for (const { to, edge } of inp.adj[u]) {
        if (Number.isFinite(dist[to])) continue;
        dist[to] = dist[u] + 1;
        es[edge] = E.CHOSEN;
        ns[to] = N.FRONTIER;
        queue.push(to);
        yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 4, note: `${nm(inp, to)} is ${dist[to]} hops away — queued`, stats: { visited, 'queue size': queue.length } });
      }
      if (u !== inp.start) ns[u] = N.VISITED;
    }

    const unreached = [...dist].filter((d) => !Number.isFinite(d)).length;
    yield gf(inp, ns, es, { nodeLabel: distLabels(dist), note: unreached ? `done — ${unreached} node(s) unreachable from the start` : 'done — every node reached', stats: { visited, 'queue size': 0 } });
  },
};

/* ───────────────────────── DFS ─────────────────────────── */

const dfs = {
  ...base,
  id: 'graph-dfs',
  legend: GRAPH_LEGEND.traverse,
  name: 'DFS (graph)',
  about: 'Follows one path as deep as it will go, then backs up to the last junction with an unexplored branch. The recursion itself is the data structure. Depth order is what makes cycle detection, topological sorting and strongly-connected components possible.',
  cost: { best: 'O(V + E)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: false },
  pseudocode: [
    'visit(node):',
    '  mark it seen',
    '  for each neighbour not yet seen:',
    '    visit(neighbour)      ← go deeper first',
    '  return — backtrack',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const seen = new Uint8Array(inp.nodes.length);
    const order = [];
    ns[inp.start] = N.START;

    yield gf(inp, ns, es, { line: 0, note: `starting from ${nm(inp, inp.start)}`, stats: { visited: 0, depth: 0 } });

    function* visit(u, depth) {
      seen[u] = 1;
      order.push(u);
      if (u !== inp.start) ns[u] = N.CURRENT;
      yield gf(inp, ns, es, { line: 1, note: `went deeper to ${nm(inp, u)} (depth ${depth})`, stats: { visited: order.length, depth } });

      for (const { to, edge } of inp.adj[u]) {
        if (seen[to]) continue;
        es[edge] = E.CHOSEN;
        yield* visit(to, depth + 1);
      }
      if (u !== inp.start) ns[u] = N.VISITED;
      yield gf(inp, ns, es, { line: 4, note: `nothing left at ${nm(inp, u)} — backtracking`, stats: { visited: order.length, depth } });
    }

    yield* visit(inp.start, 0);
    yield gf(inp, ns, es, { note: `done — visit order: ${order.map((i) => nm(inp, i)).join(' → ')}`, stats: { visited: order.length, depth: 0 } });
  },
};

/* ─────────────────────── Dijkstra ──────────────────────── */

const dijkstra = {
  ...base,
  id: 'graph-dijkstra',
  legend: GRAPH_LEGEND.weighted,
  name: "Dijkstra (graph)",
  about: 'Shortest paths when edges have different costs. It keeps a best-known distance for every node and repeatedly finalises the cheapest unfinished one. Once a node is finalised its distance can never improve — which is exactly why this breaks if any edge has a negative weight.',
  cost: { best: 'O(E log V)', avg: 'O(E log V)', worst: 'O(E log V)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: true },
  pseudocode: [
    'distance[start] = 0, everything else = ∞',
    'while unfinished nodes remain:',
    '  finalise the one with the smallest distance',
    '  for each of its edges, "relax": is going via me cheaper?',
    '  if so, write down the smaller distance',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const done = new Uint8Array(n);
    const pq = new MinHeap();
    dist[inp.start] = 0;
    pq.push(inp.start, 0);
    ns[inp.start] = N.START;
    let settled = 0, relaxations = 0, improvements = 0;

    yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 0, note: `${nm(inp, inp.start)} costs 0 to reach; everything else is unknown`, stats: { settled: 0, relaxations: 0 } });

    while (pq.size) {
      const u = pq.pop();
      if (done[u]) continue;
      done[u] = 1;
      settled++;
      if (u !== inp.start) ns[u] = N.CURRENT;
      yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 2, note: `${nm(inp, u)} is final at cost ${dist[u]} — nothing can beat it now`, stats: { settled, relaxations, improvements } });

      for (const { to, w, edge } of inp.adj[u]) {
        relaxations++;
        es[edge] = E.LOOKING;
        const candidate = dist[u] + w;
        yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 3, note: `via ${nm(inp, u)}, ${nm(inp, to)} would cost ${dist[u]} + ${w} = ${candidate}`, stats: { settled, relaxations, improvements } });

        if (candidate < dist[to]) {
          dist[to] = candidate;
          improvements++;
          pq.push(to, candidate);
          if (!done[to]) ns[to] = N.FRONTIER;
          es[edge] = E.CHOSEN;
          yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 4, note: `better — ${nm(inp, to)} now costs ${candidate}`, stats: { settled, relaxations, improvements } });
        } else {
          es[edge] = E.IDLE;
        }
      }
      if (u !== inp.start) ns[u] = N.DONE;
    }
    yield gf(inp, ns, es, { nodeLabel: distLabels(dist), note: `done — every reachable node has its cheapest cost`, stats: { settled, relaxations, improvements } });
  },
};

/* ────────────────────── Bellman-Ford ───────────────────── */

const bellmanFord = {
  ...base,
  id: 'graph-bellman-ford',
  legend: GRAPH_LEGEND.weighted,
  name: 'Bellman-Ford',
  about: 'Slower than Dijkstra but it copes with negative edge weights. It simply relaxes EVERY edge, V-1 times over — enough rounds for any shortest path to propagate end to end. One extra round is the trick: if anything still improves, a negative cycle exists and shortest paths are meaningless.',
  cost: { best: 'O(E)', avg: 'O(V·E)', worst: 'O(V·E)', space: 'O(V)', stable: '—' },
  graph: { directed: true, weighted: true, negative: true },
  pseudocode: [
    'distance[start] = 0, everything else = ∞',
    'repeat V-1 times:',
    '  for EVERY edge u→v: if dist[u] + w < dist[v], improve it',
    'one more round: if anything still improves,',
    '  there is a negative cycle',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    dist[inp.start] = 0;
    ns[inp.start] = N.START;
    let improvements = 0, relaxations = 0;

    yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 0, note: `start at ${nm(inp, inp.start)}`, stats: { round: 0, relaxations: 0, improvements: 0 } });

    for (let round = 1; round <= n - 1; round++) {
      let changed = false;
      yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 1, note: `round ${round} of ${n - 1} — relaxing every edge`, stats: { round, relaxations, improvements } });

      for (let i = 0; i < inp.edges.length; i++) {
        const e = inp.edges[i];
        const pairs = inp.directed ? [[e.a, e.b]] : [[e.a, e.b], [e.b, e.a]];
        for (const [u, v] of pairs) {
          relaxations++;
          if (!Number.isFinite(dist[u])) continue;
          es[i] = E.LOOKING;
          if (dist[u] + e.w < dist[v]) {
            dist[v] = dist[u] + e.w;
            improvements++;
            changed = true;
            es[i] = E.CHOSEN;
            ns[v] = N.FRONTIER;
            yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 2, note: `${nm(inp, v)} improved to ${dist[v]} via ${nm(inp, u)}`, stats: { round, relaxations, improvements } });
          } else {
            es[i] = E.IDLE;
          }
        }
      }
      if (!changed) {
        yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 1, note: `round ${round} changed nothing — we can stop early`, stats: { round, relaxations, improvements } });
        break;
      }
    }

    // One extra pass: anything that still improves means a negative cycle.
    for (let i = 0; i < inp.edges.length; i++) {
      const e = inp.edges[i];
      const pairs = inp.directed ? [[e.a, e.b]] : [[e.a, e.b], [e.b, e.a]];
      for (const [u, v] of pairs) {
        if (Number.isFinite(dist[u]) && dist[u] + e.w < dist[v]) {
          es[i] = E.REJECTED;
          ns[v] = N.CURRENT;
          yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 4, note: `${nm(inp, v)} STILL improves — there is a negative cycle, so no shortest path exists`, stats: { relaxations, improvements } });
          return;
        }
      }
    }

    for (let i = 0; i < n; i++) if (Number.isFinite(dist[i])) ns[i] = N.DONE;
    ns[inp.start] = N.START;
    yield gf(inp, ns, es, { nodeLabel: distLabels(dist), line: 3, note: 'no negative cycle — these distances are final', stats: { relaxations, improvements } });
  },
};

/* ──────────────────── Topological Sort ─────────────────── */

const topo = {
  ...base,
  id: 'graph-topo',
  legend: GRAPH_LEGEND.traverse,
  name: 'Topological Sort',
  about: 'Orders the nodes of a one-way graph so every arrow points forward — the scheduling problem behind build systems, course prerequisites and spreadsheet recalculation. Kahn\'s method repeatedly takes a node with nothing left pointing into it. If it ever runs out of such nodes with work remaining, the graph has a cycle.',
  cost: { best: 'O(V + E)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: true, weighted: false, acyclic: true },
  pseudocode: [
    'count incoming arrows for every node',
    'queue every node with a count of zero',
    'while the queue is not empty:',
    '  take one out, append it to the order',
    '  remove its outgoing arrows, queueing anything that hits zero',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const indegree = new Int32Array(n);
    for (const e of inp.edges) indegree[e.b]++;

    const order = [];
    const queue = [];
    for (let i = 0; i < n; i++) if (indegree[i] === 0) { queue.push(i); ns[i] = N.FRONTIER; }

    yield gf(inp, ns, es, {
      nodeLabel: Array.from(indegree, String), line: 1,
      note: `${queue.length} node(s) have nothing pointing at them — they can go first`,
      stats: { placed: 0, ready: queue.length },
    });

    while (queue.length) {
      const u = queue.shift();
      order.push(u);
      ns[u] = N.CURRENT;
      yield gf(inp, ns, es, { nodeLabel: Array.from(indegree, String), line: 3, note: `${nm(inp, u)} goes at position ${order.length}`, stats: { placed: order.length, ready: queue.length } });

      for (const { to, edge } of inp.adj[u]) {
        indegree[to]--;
        es[edge] = E.CHOSEN;
        if (indegree[to] === 0) {
          queue.push(to);
          ns[to] = N.FRONTIER;
        }
      }
      ns[u] = N.DONE;
      yield gf(inp, ns, es, { nodeLabel: Array.from(indegree, String), line: 4, note: `removed ${nm(inp, u)}'s arrows`, stats: { placed: order.length, ready: queue.length } });
    }

    if (order.length < n) {
      for (let i = 0; i < n; i++) if (indegree[i] > 0) ns[i] = N.CURRENT;
      yield gf(inp, ns, es, { nodeLabel: Array.from(indegree, String), note: `stuck with ${n - order.length} node(s) left — the graph contains a cycle, so no valid order exists`, stats: { placed: order.length, ready: 0 } });
      return;
    }
    yield gf(inp, ns, es, { note: `valid order: ${order.map((i) => nm(inp, i)).join(' → ')}`, stats: { placed: order.length, ready: 0 } });
  },
};

/* ──────────────────── Union-Find (DSU) ─────────────────── */

/** Disjoint-set with path compression and union by size. */
class DSU {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = new Array(n).fill(1);
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];   // path compression
      x = this.parent[x];
    }
    return x;
  }
  union(a, b) {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] += this.size[rb];
    return true;
  }
}

const unionFind = {
  ...base,
  id: 'graph-union-find',
  legend: GRAPH_LEGEND.dsu,
  name: 'Union-Find',
  about: 'Tracks which nodes are connected to which, under a stream of "join these two" operations. With path compression and union-by-size, each query costs effectively constant time. The labels under each node show the group leader — watch whole groups re-point to one leader the moment two groups merge.',
  cost: { best: 'O(1)', avg: 'O(α(n))', worst: 'O(α(n))', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: false },
  pseudocode: [
    'every node starts as its own group',
    'for each edge (a, b):',
    '  find the leader of a and the leader of b',
    '  if they differ, point the smaller group at the larger',
    '  if they match, a and b were already connected',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const dsu = new DSU(n);
    let groups = n, merges = 0, redundant = 0;

    const leaders = () => Array.from({ length: n }, (_, i) => nm(inp, dsu.find(i)));

    yield gf(inp, ns, es, { nodeLabel: leaders(), line: 0, note: `${n} separate groups to start — everyone leads themselves`, stats: { groups, merges: 0, 'already joined': 0 } });

    for (let i = 0; i < inp.edges.length; i++) {
      const e = inp.edges[i];
      es[i] = E.LOOKING;
      ns[e.a] = N.CURRENT; ns[e.b] = N.CURRENT;
      yield gf(inp, ns, es, { nodeLabel: leaders(), line: 2, note: `is ${nm(inp, e.a)} already connected to ${nm(inp, e.b)}?`, stats: { groups, merges, 'already joined': redundant } });

      if (dsu.union(e.a, e.b)) {
        groups--; merges++;
        es[i] = E.CHOSEN;
        yield gf(inp, ns, es, { nodeLabel: leaders(), line: 3, note: `no — merged. ${groups} group${groups === 1 ? '' : 's'} left`, stats: { groups, merges, 'already joined': redundant } });
      } else {
        redundant++;
        es[i] = E.REJECTED;
        yield gf(inp, ns, es, { nodeLabel: leaders(), line: 4, note: 'yes — this edge adds nothing', stats: { groups, merges, 'already joined': redundant } });
      }
      ns[e.a] = N.VISITED; ns[e.b] = N.VISITED;
    }

    for (let i = 0; i < n; i++) ns[i] = N.DONE;
    yield gf(inp, ns, es, { nodeLabel: leaders(), note: `done — ${groups} connected component${groups === 1 ? '' : 's'}`, stats: { groups, merges, 'already joined': redundant } });
  },
};

/* ─────────────────────── Kruskal MST ───────────────────── */

const kruskal = {
  ...base,
  id: 'graph-kruskal',
  legend: GRAPH_LEGEND.mst,
  name: "Kruskal's MST",
  about: 'Finds the cheapest set of edges that still connects everything. Sort every edge by weight and take them cheapest-first, skipping any that would close a loop — Union-Find is what makes "would this close a loop?" fast. The greedy choice is provably optimal here, which is not true of most greedy algorithms.',
  cost: { best: 'O(E log E)', avg: 'O(E log E)', worst: 'O(E log E)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: true },
  pseudocode: [
    'sort every edge from cheapest to most expensive',
    'for each edge in that order:',
    '  if its two ends are already connected, skip it (it would make a loop)',
    '  otherwise take it into the tree',
    'stop once V-1 edges have been taken',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const dsu = new DSU(n);
    const order = inp.edges.map((e, i) => ({ ...e, i })).sort((a, b) => a.w - b.w);
    let taken = 0, total = 0, skipped = 0;

    yield gf(inp, ns, es, { line: 0, note: `edges sorted: ${order.map((e) => e.w).join(', ')}`, stats: { 'edges taken': 0, 'total weight': 0, skipped: 0 } });

    for (const e of order) {
      es[e.i] = E.LOOKING;
      ns[e.a] = N.CURRENT; ns[e.b] = N.CURRENT;
      yield gf(inp, ns, es, { line: 1, note: `cheapest left: ${nm(inp, e.a)}–${nm(inp, e.b)} costing ${e.w}`, stats: { 'edges taken': taken, 'total weight': total, skipped } });

      if (dsu.union(e.a, e.b)) {
        es[e.i] = E.CHOSEN;
        taken++; total += e.w;
        ns[e.a] = N.DONE; ns[e.b] = N.DONE;
        yield gf(inp, ns, es, { line: 3, note: `taken — tree weight is now ${total}`, stats: { 'edges taken': taken, 'total weight': total, skipped } });
      } else {
        es[e.i] = E.REJECTED;
        skipped++;
        ns[e.a] = N.DONE; ns[e.b] = N.DONE;
        yield gf(inp, ns, es, { line: 2, note: 'skipped — both ends are already connected, this would make a loop', stats: { 'edges taken': taken, 'total weight': total, skipped } });
      }
      if (taken === n - 1) break;
    }

    yield gf(inp, ns, es, {
      note: taken === n - 1
        ? `minimum spanning tree complete — ${taken} edges, total weight ${total}`
        : `graph is disconnected — best possible forest has ${taken} edges, weight ${total}`,
      stats: { 'edges taken': taken, 'total weight': total, skipped },
    });
  },
};

/* ───────────────────────── Prim MST ────────────────────── */

const prim = {
  ...base,
  id: 'graph-prim',
  legend: GRAPH_LEGEND.mst,
  name: "Prim's MST",
  about: 'The same minimum spanning tree, grown differently. Instead of sorting all edges globally, it starts from one node and repeatedly adds the cheapest edge leaving the tree it has built so far. Kruskal thinks about edges; Prim thinks about a growing blob. Both land on the same total weight.',
  cost: { best: 'O(E log V)', avg: 'O(E log V)', worst: 'O(E log V)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: true },
  pseudocode: [
    'start with one node in the tree',
    'repeat until every node is in:',
    '  look at every edge leaving the tree',
    '  take the cheapest one that reaches a new node',
    '  add that node to the tree',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const inTree = new Uint8Array(n);
    const pq = new MinHeap();
    let taken = 0, total = 0, considered = 0;

    inTree[inp.start] = 1;
    ns[inp.start] = N.DONE;
    for (const { to, w, edge } of inp.adj[inp.start]) pq.push({ to, w, edge }, w);

    yield gf(inp, ns, es, { line: 0, note: `tree starts at ${nm(inp, inp.start)}`, stats: { 'nodes in tree': 1, 'total weight': 0 } });

    while (pq.size && taken < n - 1) {
      const { to, w, edge } = pq.pop();
      considered++;
      if (inTree[to]) {
        es[edge] = E.REJECTED;
        yield gf(inp, ns, es, { line: 2, note: `cheapest edge (${w}) leads to ${nm(inp, to)}, already in the tree — skip`, stats: { 'nodes in tree': taken + 1, 'total weight': total, considered } });
        continue;
      }

      es[edge] = E.CHOSEN;
      inTree[to] = 1;
      ns[to] = N.DONE;
      taken++; total += w;
      yield gf(inp, ns, es, { line: 3, note: `added ${nm(inp, to)} for ${w} — tree weight ${total}`, stats: { 'nodes in tree': taken + 1, 'total weight': total, considered } });

      for (const next of inp.adj[to]) {
        if (!inTree[next.to]) {
          pq.push(next, next.w);
          if (ns[next.to] === N.IDLE) ns[next.to] = N.FRONTIER;
        }
      }
      yield gf(inp, ns, es, { line: 2, note: 'new edges are now candidates', stats: { 'nodes in tree': taken + 1, 'total weight': total, considered } });
    }

    yield gf(inp, ns, es, {
      note: taken === n - 1
        ? `minimum spanning tree complete — ${taken} edges, total weight ${total}`
        : `graph is disconnected — reached ${taken + 1} of ${n} nodes, weight ${total}`,
      stats: { 'nodes in tree': taken + 1, 'total weight': total, considered },
    });
  },
};

/* ─────────────────── Cycle Detection ───────────────────── */

const cycleDetect = {
  ...base,
  id: 'graph-cycle',
  legend: GRAPH_LEGEND.cycle,
  name: 'Cycle Detection',
  about: 'Depth-first search that keeps three colours: untouched, "on the path I am currently walking", and finished. If it ever meets a node that is still on the current path, it has walked in a circle. This grey-node test is the standard way to tell a deadlock or a circular dependency from a merely shared one.',
  cost: { best: 'O(1)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: true, weighted: false },
  pseudocode: [
    'colour every node white (untouched)',
    'visit(u): colour u grey — "on the current path"',
    '  for each neighbour v:',
    '    if v is grey, we have looped back — cycle found',
    '    if v is white, visit it',
    '  colour u black — finished, safely off the path',
  ],
  *run(inp) {
    const ns = blankN(inp), es = blankE(inp);
    const n = inp.nodes.length;
    const colour = new Uint8Array(n);   // 0 white, 1 grey, 2 black
    let found = false, explored = 0;

    const labelOf = () => Array.from(colour, (c) => ['', 'on path', 'done'][c]);

    yield gf(inp, ns, es, { nodeLabel: labelOf(), line: 0, note: 'nothing visited yet', stats: { explored: 0, 'on current path': 0 } });

    function* visit(u) {
      colour[u] = 1;
      explored++;
      ns[u] = N.CURRENT;
      yield gf(inp, ns, es, { nodeLabel: labelOf(), line: 1, note: `${nm(inp, u)} is now on the path I am walking`, stats: { explored, 'on current path': colour.filter((c) => c === 1).length } });

      for (const { to, edge } of inp.adj[u]) {
        if (found) return;
        es[edge] = E.LOOKING;
        yield gf(inp, ns, es, { nodeLabel: labelOf(), line: 2, note: `following ${nm(inp, u)} → ${nm(inp, to)}`, stats: { explored, 'on current path': colour.filter((c) => c === 1).length } });

        if (colour[to] === 1) {
          es[edge] = E.REJECTED;
          ns[to] = N.CURRENT;
          found = true;
          yield gf(inp, ns, es, { nodeLabel: labelOf(), line: 3, note: `${nm(inp, to)} is still on the path — that is a cycle`, stats: { explored, 'on current path': colour.filter((c) => c === 1).length } });
          return;
        }
        if (colour[to] === 0) {
          es[edge] = E.CHOSEN;
          yield* visit(to);
        } else {
          es[edge] = E.IDLE;
        }
      }
      colour[u] = 2;
      ns[u] = N.DONE;
      yield gf(inp, ns, es, { nodeLabel: labelOf(), line: 5, note: `${nm(inp, u)} is finished — safely off the path`, stats: { explored, 'on current path': colour.filter((c) => c === 1).length } });
    }

    for (let i = 0; i < n && !found; i++) {
      if (colour[i] === 0) yield* visit(i);
    }

    yield gf(inp, ns, es, {
      nodeLabel: labelOf(),
      note: found ? 'this graph contains a cycle' : 'no cycle — every path eventually ends',
      stats: { explored, 'on current path': 0 },
    });
  },
};


/* ─────────────── Tarjan's Strongly-Connected Components ─────────────── */

const tarjan = {
  ...base,
  id: 'graph-tarjan',
  legend: [
    ['--c-swap',    'on the stack right now'],
    ['--c-compare', 'edge being followed'],
    ['--c-swap',    'edge into a finished component'],
    ['#4da3ff',     'each colour is one component'],
  ],
  name: "Tarjan's SCC",
  about: 'Finds every group of nodes that can all reach each other — the circular parts of a one-way graph. It gives each node a discovery number and a "lowlink": the smallest number reachable from it without leaving the current stack. When a node\'s lowlink equals its own number, it is the root of a component, and everything above it on the stack is that component. One depth-first pass, no repeats.',
  cost: { best: 'O(V + E)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: true, weighted: false },
  pseudocode: [
    'give each node a discovery number as you first reach it',
    'lowlink = the smallest number reachable from here via the stack',
    'after visiting a child, take the smaller of the two lowlinks',
    'if a neighbour is already on the stack, use its discovery number',
    'when lowlink == own number, pop the stack down to here:',
    '  that is one complete component',
  ],
  *run(inp) {
    const n = inp.nodes.length;
    const ns = blankN(inp), es = blankE(inp);
    const index = new Int32Array(n).fill(-1);
    const low = new Int32Array(n).fill(-1);
    const onStack = new Uint8Array(n);
    const group = new Int32Array(n).fill(-1);
    const stack = [];
    let counter = 0, components = 0;

    // "4/2" means: found fourth, can reach back as far as the second.
    const labels = () => Array.from({ length: n }, (_, i) =>
      index[i] < 0 ? '' : `${index[i]}/${low[i]}`);

    const frame = (extra) => gf(inp, ns, es, {
      nodeLabel: labels(),
      nodeGroup: Array.from(group),
      stats: { visited: counter, 'on stack': stack.length, components },
      ...extra,
    });

    yield frame({ line: 0, note: 'numbering nodes as we first reach them' });

    function* strongconnect(u) {
      index[u] = low[u] = counter++;
      stack.push(u);
      onStack[u] = 1;
      ns[u] = N.CURRENT;
      yield frame({ line: 0, note: `${nm(inp, u)} is number ${index[u]} — pushed on the stack` });

      for (const { to, edge } of inp.adj[u]) {
        es[edge] = E.LOOKING;

        if (index[to] === -1) {
          yield frame({ line: 2, note: `${nm(inp, to)} is new — go deeper` });
          es[edge] = E.CHOSEN;
          yield* strongconnect(to);
          low[u] = Math.min(low[u], low[to]);
          yield frame({ line: 2, note: `back at ${nm(inp, u)}: its lowlink becomes ${low[u]}` });
        } else if (onStack[to]) {
          low[u] = Math.min(low[u], index[to]);
          es[edge] = E.CHOSEN;
          yield frame({ line: 3, note: `${nm(inp, to)} is still on the stack — ${nm(inp, u)} can loop back to ${index[to]}` });
        } else {
          // already settled into an earlier component; ignore it
          es[edge] = E.REJECTED;
          yield frame({ line: 3, note: `${nm(inp, to)} already belongs to a finished component — ignore` });
        }
      }

      if (low[u] === index[u]) {
        const members = [];
        let w;
        do {
          w = stack.pop();
          onStack[w] = 0;
          group[w] = components;
          ns[w] = N.DONE;
          members.push(nm(inp, w));
        } while (w !== u);
        components++;
        yield frame({
          line: 4,
          note: `${nm(inp, u)}'s lowlink equals its own number — component ${components}: {${members.reverse().join(', ')}}`,
        });
      }
    }

    for (let i = 0; i < n; i++) {
      if (index[i] === -1) yield* strongconnect(i);
    }

    const sizes = {};
    for (let i = 0; i < n; i++) sizes[group[i]] = (sizes[group[i]] || 0) + 1;
    const cyclic = Object.values(sizes).filter((v) => v > 1).length;

    yield frame({
      note: `${components} component${components === 1 ? '' : 's'}` +
        (cyclic
          ? ` — ${cyclic === 1 ? 'one of them contains' : `${cyclic} of them contain`} a cycle`
          : ' — no cycles, every node stands alone'),
    });
  },
};


/* ────────────────────── Floyd-Warshall ─────────────────── */

const floydWarshall = {
  id: 'graph-floyd-warshall',
  name: 'Floyd-Warshall',
  view: 'table',          // the table IS the algorithm here, not the graph
  input: 'graph',
  legend: [
    ['--c-swap',    'pair being reconsidered'],
    ['--c-compare', 'the two legs of the detour'],
    ['--c-range',   'best known so far'],
    ['--c-path',    'diagonal — zero means no negative cycle'],
  ],
  about: 'Shortest paths between EVERY pair of nodes, not just from one start. The idea is disarmingly simple: for each node k in turn, ask of every pair (i, j) whether detouring through k is shorter than what you already have. After every k has had its turn, every entry is optimal. Three nested loops, five lines, and it copes with negative edges.',
  cost: { best: 'O(V³)', avg: 'O(V³)', worst: 'O(V³)', space: 'O(V²)', stable: '—' },
  graph: { directed: true, weighted: true },
  pseudocode: [
    'start the table at the direct edge costs (∞ where there is no edge)',
    'for each node k, as a possible stop-over:',
    '  for every pair (i, j):',
    '    if cost(i→k) + cost(k→j) < cost(i→j), take the detour',
    'after the last k, every entry is the true shortest path',
  ],
  *run(inp) {
    const n = inp.nodes.length;
    const names = inp.nodes.map((x) => x.name);
    const d = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));

    for (const e of inp.edges) {
      d[e.a][e.b] = Math.min(d[e.a][e.b], e.w);
      if (!inp.directed) d[e.b][e.a] = Math.min(d[e.b][e.a], e.w);
    }

    let improvements = 0, tests = 0;
    const f = (extra) => ({
      table: d.map((row) => [...row]),
      rowLabels: names, colLabels: names,
      rowTitle: 'from', colTitle: 'to',
      stats: { 'stop-overs done': extra._k ?? 0, tested: tests, improvements },
      ...extra,
    });

    yield f({ line: 0, note: 'the table starts as the direct edges — ∞ means no direct link' });

    for (let k = 0; k < n; k++) {
      yield f({ _k: k, line: 1, note: `now allowing ${names[k]} as a stop-over` });

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          tests++;
          const viaK = d[i][k] + d[k][j];

          // Only pause on pairs where the detour is actually possible —
          // otherwise V³ frames of "∞ is not better" drowns out the idea.
          if (Number.isFinite(viaK)) {
            yield f({
              _k: k, current: [i, j], deps: [[i, k], [k, j]], line: 3,
              note: `${names[i]}→${names[j]} costs ${fmt(d[i][j])}; via ${names[k]} it is ${fmt(d[i][k])} + ${fmt(d[k][j])} = ${viaK}`,
            });
          }

          if (viaK < d[i][j]) {
            d[i][j] = viaK;
            improvements++;
            yield f({
              _k: k, current: [i, j], deps: [[i, k], [k, j]], line: 3,
              note: `better — ${names[i]}→${names[j]} is now ${viaK} by going through ${names[k]}`,
            });
          }
        }
      }
      yield f({ _k: k + 1, line: 1, note: `${names[k]} done — every route that benefits from it is recorded` });
    }

    // A negative number on the diagonal means a loop that pays you to walk it.
    const negative = [];
    for (let i = 0; i < n; i++) if (d[i][i] < 0) negative.push(names[i]);

    const unreachable = d.flat().filter((v) => !Number.isFinite(v)).length;
    yield f({
      _k: n,
      path: Array.from({ length: n }, (_, i) => [i, i]),
      note: negative.length
        ? `negative cycle through ${negative.join(', ')} — shortest paths are undefined`
        : `done — every pair's shortest path is in the table` +
          (unreachable ? `, and ${unreachable} pair(s) have no route at all` : ''),
    });
  },
};

const fmt = (v) => (Number.isFinite(v) ? v : '∞');


/* ─────────────────── Bipartite check ───────────────────── */

const bipartite = {
  ...base,
  id: 'graph-bipartite',
  name: 'Bipartite Check',
  legend: [
    ['--c-swap',    'being examined'],
    ['--c-compare', 'edge being checked'],
    ['#4da3ff',     'one side'],
    ['#3ddc84',     'the other side'],
  ],
  about: 'Can the nodes be split into two groups with every edge crossing between them? Colour the start node, colour all its neighbours the opposite shade, and keep going. If you ever reach a node that already has the colour you were about to give it, the answer is no. A graph is bipartite exactly when it contains no odd-length cycle, which is what that clash detects.',
  cost: { best: 'O(1)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: false },
  pseudocode: [
    'colour the first node side 0',
    'walk outwards, giving each neighbour the opposite side',
    'if a neighbour already has the SAME side as the node you came from,',
    '  the graph is not bipartite — you have found an odd cycle',
    'if every node gets a side with no clash, it is bipartite',
  ],
  *run(inp) {
    const n = inp.nodes.length;
    const ns = blankN(inp), es = blankE(inp);
    const side = new Int32Array(n).fill(-1);
    let checked = 0;

    const f = (extra) => gf(inp, ns, es, {
      nodeGroup: Array.from(side),
      nodeLabel: Array.from(side, (v) => (v < 0 ? '' : v === 0 ? 'A' : 'B')),
      stats: { coloured: side.filter((v) => v >= 0).length, 'edges checked': checked },
      ...extra,
    });

    yield f({ line: 0, note: 'nothing coloured yet' });

    for (let start = 0; start < n; start++) {
      if (side[start] !== -1) continue;

      side[start] = 0;
      const queue = [start];
      ns[start] = N.CURRENT;
      yield f({ line: 0, note: `${nm(inp, start)} goes on side A` });

      while (queue.length) {
        const u = queue.shift();
        ns[u] = N.VISITED;

        for (const { to, edge } of inp.adj[u]) {
          checked++;
          es[edge] = E.LOOKING;

          if (side[to] === -1) {
            side[to] = 1 - side[u];
            queue.push(to);
            es[edge] = E.CHOSEN;
            yield f({ line: 1, note: `${nm(inp, to)} must go on side ${side[to] === 0 ? 'A' : 'B'}, opposite ${nm(inp, u)}` });
          } else if (side[to] === side[u]) {
            es[edge] = E.REJECTED;
            ns[u] = N.CURRENT; ns[to] = N.CURRENT;
            yield f({
              line: 2,
              note: `${nm(inp, u)} and ${nm(inp, to)} are joined but both on side ${side[u] === 0 ? 'A' : 'B'} — not bipartite`,
            });
            yield f({ line: 3, note: 'that clash means there is an odd-length cycle somewhere in the graph' });
            return;
          } else {
            es[edge] = E.IDLE;
          }
        }
      }
    }

    for (let i = 0; i < n; i++) ns[i] = N.DONE;
    const a = side.filter((v) => v === 0).length;
    yield f({ line: 4, note: `bipartite — ${a} node(s) on side A, ${n - a} on side B, and every edge crosses between them` });
  },
};

/* ──────────── Bridges and articulation points ──────────── */

const bridges = {
  ...base,
  id: 'graph-bridges',
  name: 'Bridges & Cut Vertices',
  legend: [
    ['--c-swap',    'being explored'],
    ['--c-compare', 'edge being followed'],
    ['--c-sorted',  'safe to remove'],
    ['--c-path',    'tree edge'],
  ],
  about: 'Which single edge, or single node, would break the network in two if it failed? A depth-first search records when each node was first reached, and the earliest node reachable from its subtree without using the edge it came in by. If a child cannot reach anything above its parent, the connecting edge is a bridge and the parent is a cut vertex. This is how you find single points of failure in a network.',
  cost: { best: 'O(V + E)', avg: 'O(V + E)', worst: 'O(V + E)', space: 'O(V)', stable: '—' },
  graph: { directed: false, weighted: false },
  pseudocode: [
    'depth-first search, numbering nodes as you first reach them',
    'low[u] = earliest node reachable from u\'s subtree',
    'after exploring a child v:',
    '  if low[v] > disc[u], the edge u-v is a bridge',
    '  if low[v] >= disc[u], u is a cut vertex (unless it is the root)',
    'the root is a cut vertex when it has more than one child',
  ],
  *run(inp) {
    const n = inp.nodes.length;
    const ns = blankN(inp), es = blankE(inp);
    const disc = new Int32Array(n).fill(-1);
    const low = new Int32Array(n).fill(-1);
    const cut = new Uint8Array(n);
    let timer = 0;
    const foundBridges = [];

    const labels = () => Array.from({ length: n }, (_, i) => (disc[i] < 0 ? '' : `${disc[i]}/${low[i]}`));
    const f = (extra) => gf(inp, ns, es, {
      nodeLabel: labels(),
      stats: { visited: timer, bridges: foundBridges.length, 'cut vertices': cut.reduce((a, b) => a + b, 0) },
      ...extra,
    });

    yield f({ line: 0, note: 'numbering nodes as the search first reaches them' });

    function* dfs(u, parentEdge) {
      disc[u] = low[u] = timer++;
      ns[u] = N.CURRENT;
      yield f({ line: 0, note: `${nm(inp, u)} first reached at time ${disc[u]}` });

      let children = 0;

      for (const { to, edge } of inp.adj[u]) {
        if (edge === parentEdge) continue;   // never walk straight back

        if (disc[to] === -1) {
          children++;
          es[edge] = E.CHOSEN;
          yield f({ line: 1, note: `going deeper to ${nm(inp, to)}` });
          yield* dfs(to, edge);

          low[u] = Math.min(low[u], low[to]);
          yield f({ line: 2, note: `back at ${nm(inp, u)}: its subtree reaches as far back as ${low[u]}` });

          if (low[to] > disc[u]) {
            foundBridges.push(`${nm(inp, u)}-${nm(inp, to)}`);
            es[edge] = E.REJECTED;
            yield f({ line: 3, note: `${nm(inp, to)}'s subtree cannot reach above ${nm(inp, u)} — so ${nm(inp, u)}-${nm(inp, to)} is a bridge` });
          }
          if (disc[u] !== 0 && low[to] >= disc[u] && !cut[u]) {
            cut[u] = 1;
            yield f({ line: 4, note: `removing ${nm(inp, u)} would cut ${nm(inp, to)}'s side loose — it is a cut vertex` });
          }
        } else {
          // an edge back to an already-seen node: a shortcut upwards
          low[u] = Math.min(low[u], disc[to]);
          es[edge] = E.LOOKING;
          yield f({ line: 1, note: `${nm(inp, to)} was already seen at time ${disc[to]} — a way back up` });
          es[edge] = E.IDLE;
        }
      }

      if (disc[u] === 0 && children > 1 && !cut[u]) {
        cut[u] = 1;
        yield f({ line: 5, note: `${nm(inp, u)} is the root with ${children} separate branches — removing it splits them apart` });
      }

      ns[u] = cut[u] ? N.CURRENT : N.DONE;
    }

    for (let i = 0; i < n; i++) if (disc[i] === -1) yield* dfs(i, -1);

    for (let i = 0; i < n; i++) ns[i] = cut[i] ? N.CURRENT : N.DONE;
    yield f({
      note: foundBridges.length || cut.some(Boolean)
        ? `${foundBridges.length} bridge(s)${foundBridges.length ? `: ${foundBridges.join(', ')}` : ''} and ${cut.reduce((a, b) => a + b, 0)} cut vertex(es) — each one is a single point of failure`
        : 'no bridges and no cut vertices — every part of this network has a second route',
    });
  },
};

export const GRAPHS = [bfs, dfs, dijkstra, bellmanFord, floydWarshall, topo, unionFind, kruskal, prim, cycleDetect, bipartite, bridges, tarjan];
