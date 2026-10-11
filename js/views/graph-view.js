/* ============================================================
   Graph view — nodes joined by edges
   ------------------------------------------------------------
   For the algorithms that aren't about a 2D board: shortest
   paths on a road network, minimum spanning trees, topological
   ordering, cycle detection.

   A frame:
   {
     nodes: [{x, y, name}],   // shared — positions never change
     edges: [{a, b, w}],      // shared
     nodeState: Uint8Array,   // copied per frame
     edgeState: Uint8Array,   // copied per frame
     nodeLabel: [],           // optional text under each node (distances)
     directed: bool, weighted: bool,
     note, stats
   }
   ============================================================ */

import { fitCanvas, colors, circle, strokeCircle, label, line, fillRound } from './draw.js';

export const N = { IDLE: 0, FRONTIER: 1, VISITED: 2, CURRENT: 3, DONE: 4, START: 5 };
export const E = { IDLE: 0, LOOKING: 1, CHOSEN: 2, REJECTED: 3 };

const PAD = 42;

/** Distinct fills for group-coloured graphs, readable in both themes. */
const GROUP_COLORS = [
  '#4da3ff', '#3ddc84', '#ffc53d', '#c678dd',
  '#ff8c42', '#2dd4bf', '#f472b6', '#a3e635',
];

export function drawGraph(canvas, frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  const C = colors();
  const { nodes, edges, nodeState, edgeState, nodeLabel, nodeGroup, edgeLabel, directed, weighted } = frame;
  if (!nodes?.length) return;

  // Positions are computed once, the first time a graph is drawn, and then
  // cached on the nodes themselves so the picture doesn't jump between frames.
  if (nodes[0].x === undefined) layout(nodes, edges);

  // Node positions arrive normalised 0..1 so they survive any canvas size.
  const R = Math.max(11, Math.min(20, Math.min(w, h) / (nodes.length * 0.9)));
  const px = (n) => PAD + n.x * (w - PAD * 2);
  const py = (n) => PAD + n.y * (h - PAD * 2);

  const edgeColor = {
    [E.IDLE]:     C.border,
    [E.LOOKING]:  C.compare,
    [E.CHOSEN]:   C.path,
    [E.REJECTED]: C.swap,
  };
  const nodeColor = {
    [N.IDLE]:     C.sunken,
    [N.FRONTIER]: C.frontier,
    [N.VISITED]:  C.visited,
    [N.CURRENT]:  C.swap,
    [N.DONE]:     C.sorted,
    [N.START]:    C.start,
  };

  /* ── edges first, so nodes sit on top ── */
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const a = nodes[e.a], b = nodes[e.b];
    const st = edgeState ? edgeState[i] : E.IDLE;
    const x1 = px(a), y1 = py(a), x2 = px(b), y2 = py(b);

    const chosen = st === E.CHOSEN;
    ctx.globalAlpha = st === E.REJECTED ? 0.3 : 1;
    line(ctx, x1, y1, x2, y2, edgeColor[st] ?? C.border, chosen ? 3.5 : st === E.LOOKING ? 2.5 : 1.5);
    ctx.globalAlpha = 1;

    // arrow head for directed graphs
    if (directed) {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const tipX = x2 - Math.cos(ang) * (R + 3);
      const tipY = y2 - Math.sin(ang) * (R + 3);
      const size = 7;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - Math.cos(ang - 0.4) * size, tipY - Math.sin(ang - 0.4) * size);
      ctx.lineTo(tipX - Math.cos(ang + 0.4) * size, tipY - Math.sin(ang + 0.4) * size);
      ctx.closePath();
      ctx.fillStyle = edgeColor[st] ?? C.border;
      ctx.fill();
    }

    // weight, on a small plate so the line doesn't cut through it.
    // `edgeLabel` lets an algorithm say something richer than the raw
    // weight — max flow shows "carried/capacity" rather than just capacity.
    if (weighted || edgeLabel) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const txt = edgeLabel ? String(edgeLabel[i]) : String(e.w);
      ctx.font = '700 10px ui-monospace, Menlo, monospace';
      const tw = ctx.measureText(txt).width;
      fillRound(ctx, mx - tw / 2 - 4, my - 8, tw + 8, 15, 4, C.panel);
      label(ctx, txt, mx, my - 0.5, {
        size: 10, weight: 700,
        color: st === E.CHOSEN ? C.path : st === E.LOOKING ? C.compare : C.dim,
      });
    }
  }

  /* ── nodes ── */
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const st = nodeState ? nodeState[i] : N.IDLE;
    const x = px(n), y = py(n);

    // `nodeGroup` colours nodes by which group they belong to (e.g. which
    // strongly-connected component), overriding the usual state colour.
    const group = nodeGroup ? nodeGroup[i] : -1;
    const fill = group >= 0 ? GROUP_COLORS[group % GROUP_COLORS.length]
                            : (nodeColor[st] ?? C.sunken);

    circle(ctx, x, y, R, fill);
    strokeCircle(ctx, x, y, R,
      st === N.CURRENT && group >= 0 ? C.text : st === N.IDLE && group < 0 ? C.border : 'transparent',
      st === N.CURRENT && group >= 0 ? 2.5 : 1.5);

    label(ctx, n.name, x, y, {
      size: Math.min(13, R * 0.8),
      weight: 700,
      color: st === N.IDLE && group < 0 ? C.dim : '#0d1117',
    });

    // distance / extra info under the node
    if (nodeLabel && nodeLabel[i] !== undefined && nodeLabel[i] !== null && nodeLabel[i] !== '') {
      const txt = String(nodeLabel[i]);
      ctx.font = '700 10px ui-monospace, Menlo, monospace';
      const tw = ctx.measureText(txt).width;
      fillRound(ctx, x - tw / 2 - 4, y + R + 2, tw + 8, 14, 4, C.panel);
      label(ctx, txt, x, y + R + 9.5, { size: 10, weight: 700, color: C.text });
    }
  }
}

/* ────────────────── graph building helpers ─────────────── */

/**
 * Lay nodes out with a quick force simulation: everything pushes
 * everything else apart, edges pull their endpoints together.
 * A few dozen rounds is enough to get a readable, untangled picture.
 */
export function layout(nodes, edges, rounds = 260) {
  for (const n of nodes) {
    if (n.x === undefined) { n.x = Math.random(); n.y = Math.random(); }
  }
  const k = 1.1 / Math.sqrt(nodes.length);

  for (let round = 0; round < rounds; round++) {
    const cool = 1 - round / rounds;
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    // repulsion between every pair
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-6) { dx = Math.random() * 0.01; dy = Math.random() * 0.01; d2 = 1e-4; }
        const force = (k * k) / d2;
        fx[i] += dx * force; fy[i] += dy * force;
        fx[j] -= dx * force; fy[j] -= dy * force;
      }
    }
    // attraction along edges
    for (const e of edges) {
      const dx = nodes[e.a].x - nodes[e.b].x;
      const dy = nodes[e.a].y - nodes[e.b].y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const force = (d * d) / k * 0.9;
      fx[e.a] -= (dx / d) * force; fy[e.a] -= (dy / d) * force;
      fx[e.b] += (dx / d) * force; fy[e.b] += (dy / d) * force;
    }

    for (let i = 0; i < nodes.length; i++) {
      const d = Math.max(0.0001, Math.hypot(fx[i], fy[i]));
      const step = Math.min(d, 0.04 * cool);
      nodes[i].x = Math.min(1, Math.max(0, nodes[i].x + (fx[i] / d) * step));
      nodes[i].y = Math.min(1, Math.max(0, nodes[i].y + (fy[i] / d) * step));
    }
  }

  // stretch the result to fill the available box
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  for (const n of nodes) {
    n.x = maxX > minX ? (n.x - minX) / (maxX - minX) : 0.5;
    n.y = maxY > minY ? (n.y - minY) / (maxY - minY) : 0.5;
  }
  return nodes;
}

export const NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* ───────────────────── legends ─────────────────────────── */
/* Graph frames colour nodes and edges rather than array slots,
   so they spell out their own legends instead of relying on the
   automatic one.                                               */

export const GRAPH_LEGEND = {
  traverse: [
    ['--c-swap',     'currently at'],
    ['--c-frontier', 'queued / seen'],
    ['--c-visited',  'explored'],
    ['--c-sorted',   'finished'],
  ],
  weighted: [
    ['--c-swap',     'being finalised'],
    ['--c-frontier', 'reachable, cost may still improve'],
    ['--c-compare',  'edge under test'],
    ['--c-path',     'best route so far'],
    ['--c-sorted',   'final'],
  ],
  mst: [
    ['--c-compare',  'edge under test'],
    ['--c-path',     'taken into the tree'],
    ['--c-swap',     'skipped — would make a loop'],
    ['--c-sorted',   'in the tree'],
  ],
  dsu: [
    ['--c-path',     'merged two groups'],
    ['--c-swap',     'already connected'],
    ['--c-sorted',   'settled'],
  ],
  cycle: [
    ['--c-swap',     'on the path right now'],
    ['--c-sorted',   'finished'],
    ['--c-compare',  'edge being followed'],
  ],
};
