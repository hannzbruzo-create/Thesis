// DEVELOPMENT ONLY. No dependencies other than Node.js.
// Rebuilds the outdoor routing data from the 3D campus model (src/map3d/campusModel.ts),
// so routes follow the same buildings, roads and covered walkways the map shows.
//
//   node tools/build-walkable-graph.cjs
//
// Writes:
//   src/data/fullWalkableGraph.json  open-ground grid + road centrelines + covered walkways
//   src/data/visualObstacles.json    ground-floor building footprints (courtyards cut out)
//
// Units are the app's 800 x 800 map units (1 unit is about 0.48 m), same as GPS and routing.
// Restricted / blocked zones in src/data/walkabilityEdits.json still apply; its old
// covered/field overrides belonged to the previous roof mask and are ignored here.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// ---- Load the 3D model (plain TS object literal) ----
let src = fs.readFileSync(path.join(root, 'src/map3d/campusModel.ts'), 'utf8')
  .replace(/^import .*$/m, '')
  .replace(/const campusModel: CampusModel =/, 'globalThis.__model =')
  .replace(/export default campusModel;/, '');
vm.runInThisContext(src);
const model = globalThis.__model;
const edits = JSON.parse(fs.readFileSync(path.join(root, 'src/data/walkabilityEdits.json'), 'utf8'));

// Routing costs live in src/navigation/routingProfiles.ts (one profile per emergency type).
// COST is only used to label link types here; it does not change the stored data.
const COST = { road: 1, covered: 1, open: 1, roadToOpen: 1, coveredToOpen: 1, roadToCovered: 1 };
const GRID = 8;         // open-ground grid spacing (~3.8 m), linked in 16 directions
// Links within this distance of a building wall store that distance, so each emergency profile
// can add its own wall penalty. Covered walkways are exempt: they always run beside buildings.
const WALL_BUFFER = 5 / 0.48; // 5 m in map units
const ROAD_STEP = 8;    // node spacing along roads and paths
const COVERED_STEP = 5; // node spacing inside covered walkways

// ---- Geometry helpers ----
const inPoly = (x, y, p) => {
  let v = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) v = !v;
  }
  return v;
};
const bbox = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const shape = (poly, holes = []) => ({ poly, holes, box: bbox(poly) });
const inShape = (x, y, s) => x >= s.box[0] && x <= s.box[2] && y >= s.box[1] && y <= s.box[3] &&
  inPoly(x, y, s.poly) && !s.holes.some(h => inPoly(x, y, h));

// Solid ground-floor buildings are obstacles; covered walkways (canopies) are walkable underneath.
const solid = model.buildings.filter(b => !b.level && !b.canopy);
const canopies = model.buildings.filter(b => b.canopy && !b.level);
const buildingShapes = solid.map(b => shape(b.footprint, b.holes ?? []));
const water = model.areas.filter(a => a.kind === 'water').map(a => shape(a.polygon));
const noGo = (edits.zones ?? []).filter(z => z.type === 'blocked' || z.type === 'restricted')
  .map(z => shape(z.points.map(p => [p.x, p.y])));
const blockedShapes = [...buildingShapes, ...water, ...noGo];
const blocked = (x, y) => x < 0 || y < 0 || x > 800 || y > 800 || blockedShapes.some(s => inShape(x, y, s));
const clear = (a, b) => {
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.75)); // fine steps so diagonals cannot clip corners
  for (let i = 0; i <= n; i++) { const t = i / n; if (blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
  return true;
};

// Building walls, bucketed for fast "distance to the nearest wall" lookups.
const WALL_CELL = 16, wallBuckets = new Map();
for (const b of solid) for (const ringPts of [b.footprint, ...(b.holes ?? [])]) {
  for (let i = 0; i < ringPts.length; i++) {
    const a = ringPts[i], c = ringPts[(i + 1) % ringPts.length];
    const pad = WALL_BUFFER;
    for (let gx = Math.floor((Math.min(a[0], c[0]) - pad) / WALL_CELL); gx <= Math.floor((Math.max(a[0], c[0]) + pad) / WALL_CELL); gx++)
      for (let gy = Math.floor((Math.min(a[1], c[1]) - pad) / WALL_CELL); gy <= Math.floor((Math.max(a[1], c[1]) + pad) / WALL_CELL); gy++) {
        const k = gx + ',' + gy; if (!wallBuckets.has(k)) wallBuckets.set(k, []); wallBuckets.get(k).push([a, c]);
      }
  }
}
const wallDistance = (x, y) => {
  let best = Infinity;
  for (const [a, c] of wallBuckets.get(Math.floor(x / WALL_CELL) + ',' + Math.floor(y / WALL_CELL)) ?? []) {
    const dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return best;
};
const wallDist = (a, b) => Math.min(wallDistance(a.x, a.y), wallDistance(b.x, b.y), wallDistance((a.x + b.x) / 2, (a.y + b.y) / 2));

// ---- Graph ----
const nodes = [], byId = new Map(), edges = [], seen = new Set();
const addNode = (id, x, y, kind) => { const n = { id, x: +x.toFixed(2), y: +y.toFixed(2), kind }; nodes.push(n); byId.set(id, n); return n; };
const addEdge = (a, b, mul) => {
  if (a.id === b.id) return;
  const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
  if (seen.has(key) || !clear(a, b)) return;
  seen.add(key);
  // Costs are applied at run time per emergency (src/navigation/routingProfiles.ts): store the
  // link length and, when it runs within WALL_BUFFER of a building, its distance to the wall.
  // Roads that meet at the same point give zero-length links; Dijkstra needs a positive weight.
  const edge = { from: a.id, to: b.id, length: Math.max(0.01, +Math.hypot(a.x - b.x, a.y - b.y).toFixed(2)) };
  if (a.kind !== 'covered' && b.kind !== 'covered') { const d = wallDist(a, b); if (d < WALL_BUFFER) edge.wall = +d.toFixed(1); }
  edges.push(edge);
};

// Open ground: a grid over everything that is not a building, water or a no-go zone.
const cols = Math.floor(800 / GRID);
const grid = [];
for (let j = 0; j < cols; j++) for (let i = 0; i < cols; i++) {
  const x = GRID / 2 + i * GRID, y = GRID / 2 + j * GRID;
  if (!blocked(x, y)) grid[j * cols + i] = addNode(`G${String(i).padStart(2, '0')}_${String(j).padStart(2, '0')}`, x, y, 'open');
}
for (let j = 0; j < cols; j++) for (let i = 0; i < cols; i++) {
  const a = grid[j * cols + i]; if (!a) continue;
  // 16 directions (the 8 neighbours plus "knight" steps) so open-ground routes can run at
  // shallow angles instead of zigzagging along the grid.
  for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1], [2, 1], [1, 2], [-1, 2], [-2, 1]]) {
    if (i + di < 0 || i + di >= cols) continue;
    const b = grid[(j + dj) * cols + i + di];
    if (b) addEdge(a, b, COST.open);
  }
}

// Roads and paved paths: nodes along each centreline.
const lines = [...model.roads.map(r => r.points), ...model.walkways.filter(w => !w.covered).map(w => w.points)];
const roadNodes = [];
lines.forEach((pts, li) => {
  let prev = null, k = 0;
  for (let s = 1; s < pts.length; s++) {
    const [ax, ay] = pts[s - 1], [bx, by] = pts[s];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / ROAD_STEP));
    for (let t = s === 1 ? 0 : 1; t <= n; t++) {
      const x = ax + (bx - ax) * t / n, y = ay + (by - ay) * t / n;
      if (blocked(x, y)) { prev = null; continue; }
      const node = addNode(`R${li}_${k++}`, x, y, 'road');
      roadNodes.push(node);
      if (prev) addEdge(prev, node, COST.road);
      prev = node;
    }
  }
});

// Covered walkways: a fine grid inside each canopy outline.
const coveredNodes = [];
canopies.forEach((c, ci) => {
  const [x0, y0, x1, y1] = bbox(c.footprint);
  const own = [];
  for (let y = y0 + COVERED_STEP / 2; y < y1; y += COVERED_STEP) for (let x = x0 + COVERED_STEP / 2; x < x1; x += COVERED_STEP) {
    if (!inPoly(x, y, c.footprint) || blocked(x, y)) continue;
    own.push(addNode(`C${ci}_${own.length}`, x, y, 'covered'));
  }
  // Narrow walkways can be thinner than the sample step: fall back to the outline's centre line.
  if (!own.length) {
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2], long = x1 - x0 > y1 - y0;
    const len = long ? x1 - x0 : y1 - y0, n = Math.max(1, Math.round(len / COVERED_STEP));
    for (let t = 0; t <= n; t++) {
      const x = long ? x0 + len * t / n : cx, y = long ? cy : y0 + len * t / n;
      if (!blocked(x, y)) own.push(addNode(`C${ci}_${own.length}`, x, y, 'covered'));
    }
  }
  for (let a = 0; a < own.length; a++) for (let b = a + 1; b < own.length; b++)
    if (Math.hypot(own[a].x - own[b].x, own[a].y - own[b].y) <= COVERED_STEP * 1.5) addEdge(own[a], own[b], COST.covered);
  coveredNodes.push(...own);
});

// Link the layers: road junctions, road <-> open ground, covered <-> road / open ground.
const near = (list, p, r) => list.filter(q => q !== p && Math.abs(q.x - p.x) <= r && Math.abs(q.y - p.y) <= r && Math.hypot(q.x - p.x, q.y - p.y) <= r);
const openNodes = nodes.filter(n => n.kind === 'open');
for (const r of roadNodes) {
  for (const q of near(roadNodes, r, ROAD_STEP * 0.9)) addEdge(r, q, COST.road); // crossings and junctions
  for (const q of near(openNodes, r, GRID * 1.2)) addEdge(r, q, COST.roadToOpen);
}
for (const c of coveredNodes) {
  for (const q of near(roadNodes, c, 10)) addEdge(c, q, COST.roadToCovered);
  for (const q of near(openNodes, c, 10)) addEdge(c, q, COST.coveredToOpen);
}

// Keep the main network, plus any closed-off pocket that holds an evacuation area
// (e.g. the St. Albert courtyard, which people inside the surrounding buildings exit into).
// Pockets with no evacuation area are dropped: a start there could never reach safety.
const adj = new Map(nodes.map(n => [n.id, []]));
for (const e of edges) { adj.get(e.from).push(e.to); adj.get(e.to).push(e.from); }
const evacPolys = (edits.zones ?? []).filter(z => z.type === 'evac').map(z => z.points.map(p => [p.x, p.y]));
const comp = new Map(), keepComps = new Set(); let best = null, bestSize = 0;
for (const n of nodes) {
  if (comp.has(n.id)) continue;
  const stack = [n.id], members = []; comp.set(n.id, n.id);
  while (stack.length) { const id = stack.pop(); members.push(id); for (const m of adj.get(id)) if (!comp.has(m)) { comp.set(m, n.id); stack.push(m); } }
  if (members.length > bestSize) { bestSize = members.length; best = n.id; }
  if (members.some(id => { const p = byId.get(id); return evacPolys.some(poly => inPoly(p.x, p.y, poly)); })) keepComps.add(n.id);
}
keepComps.add(best);
const keepNodes = nodes.filter(n => keepComps.has(comp.get(n.id)));
const keepIds = new Set(keepNodes.map(n => n.id));
const keepEdges = edges.filter(e => keepIds.has(e.from) && keepIds.has(e.to));
const kinds = keepNodes.reduce((k, n) => (k[n.kind] = (k[n.kind] ?? 0) + 1, k), {});

fs.writeFileSync(path.join(root, 'src/data/fullWalkableGraph.json'), JSON.stringify({
  metadata: {
    version: 4, mapSize: 800, gridSpacing: GRID, wallBuffer: +WALL_BUFFER.toFixed(2), costs: 'src/navigation/routingProfiles.ts',
    mode: 'DEVELOPMENT ONLY — outdoor visibility-based preview',
    source: 'src/map3d/campusModel.ts (tools/build-walkable-graph.cjs)',
    notes: [
      'Open-ground grid, road and paved-path centrelines, and covered walkways from the 3D campus model; no indoor graph.',
      'Ground outside buildings is ASSUMED walkable; fences/obstructions and area access are NOT validated.',
      'Water and restricted/blocked zones from walkabilityEdits.json are excluded.',
      'Routing chooses minimum weighted cost, not necessarily minimum geometric distance. Units are NOT metres.',
    ],
    counts: kinds,
  },
  nodes: keepNodes,
  edges: keepEdges,
}));

// Obstacles: one ring per building; a courtyard is joined to the outline by a zero-width cut,
// which even-odd point-in-polygon tests (routePreview, campusGps, outdoorSafety) handle correctly.
const ring = b => {
  if (!b.holes?.length) return b.footprint;
  let out = [...b.footprint, b.footprint[0]];
  for (const h of b.holes) out = [...out, ...h, h[0], b.footprint[0]];
  return out;
};
fs.writeFileSync(path.join(root, 'src/data/visualObstacles.json'),
  JSON.stringify([
    ...solid.map(b => ({ id: b.id, polygon: ring(b).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]) })),
    // Water is never walkable either (ids start with 'water').
    ...model.areas.filter(a => a.kind === 'water').map(a => ({ id: `water-${a.id}`, polygon: a.polygon.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]) })),
  ]));

console.log(`Graph: ${keepNodes.length} nodes (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}), ${keepEdges.length} edges` +
  (nodes.length > keepNodes.length ? `; dropped ${nodes.length - keepNodes.length} unreachable nodes` : ''));
console.log(`Obstacles: ${solid.length} building footprints`);
