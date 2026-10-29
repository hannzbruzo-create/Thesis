// DEVELOPMENT ONLY. One-off generator for src/map3d/campusModel.ts.
//   node tools/extract-campus-model.cjs           -> writes src/map3d/campusModel.draft.ts
//   node tools/extract-campus-model.cjs --force   -> overwrites src/map3d/campusModel.ts
// Reads roof shapes from assets/maps/ust.svg, roads from the Map Studio project and
// covered walkways from walkabilityEdits.json. Everything stays in 800x800 SVG units.
const fs = require('node:fs');
const path = require('node:path');
const { readFilledPaths, readStrokedPaths, signedArea, simplify } = require('./svgPolygons.cjs');

const root = path.resolve(__dirname, '..');
const svgFile = path.join(root, 'assets/maps/ust.svg');
const force = process.argv.includes('--force');

// Fill colours used by the current artwork (see SVG gradients).
const svgText = fs.readFileSync(svgFile, 'utf8');
const gradientStops = {};
for (const m of svgText.matchAll(/<linearGradient id="([^"]+)"[\s\S]*?<\/linearGradient>/g))
  gradientStops[m[1].toUpperCase()] = [...m[0].matchAll(/stop-color="([^"]+)"/g)].map(x => x[1].toUpperCase());
const firstStop = fill => {
  const id = fill.match(/^URL\(#([^)]+)\)$/);
  return id ? (gradientStops[id[1]]?.[0] ?? null) : fill;
};

const round = n => Math.round(n * 10) / 10;
const ring = r => simplify(r, 0.6).map(([x, y]) => [round(x), round(y)]);
const area = r => Math.abs(signedArea(r));
function inside(p, poly) {
  let v = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) v = !v;
  }
  return v;
}
function centroid(poly) {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = poly[j][0]*poly[i][1] - poly[i][0]*poly[j][1];
    a += c; x += (poly[j][0]+poly[i][0])*c; y += (poly[j][1]+poly[i][1])*c;
  }
  return Math.abs(a) < 1e-6 ? poly[0] : [round(x/(3*a)), round(y/(3*a))];
}

// Labels: buildingLabels.ts stores percentages of the 800x800 map.
const labelSource = fs.readFileSync(path.join(root, 'src/data/buildingLabels.ts'), 'utf8');
const labels = JSON.parse(labelSource.slice(labelSource.indexOf('= [') + 2, labelSource.lastIndexOf(']') + 1))
  .map(l => ({ id: l.id, name: l.name, x: round(l.x * 8), y: round(l.y * 8) }));

const paths = readFilledPaths(svgFile);
const buildings = [];
const areas = [];
let structureCount = 0, parkingCount = 0;
const usedLabels = new Set();

for (const p of paths) {
  const color = firstStop(p.fill);
  for (const raw of p.rings) {
    if (area(raw) < 12) continue;
    const footprint = ring(raw);
    if (footprint.length < 3) continue;
    if (color === '#FFCAA4' || color === '#FFE2CB') {
      const label = labels.find(l => !usedLabels.has(l.id) && inside([l.x, l.y], footprint));
      if (label) usedLabels.add(label.id);
      const light = color === '#FFE2CB';
      buildings.push({
        id: label ? label.id : `structure-${++structureCount}`,
        name: label ? label.name : `Structure ${structureCount}`,
        footprint,
        floors: 3,
        wallColor: '#F3ECE3',
        roofColor: light ? '#F1C7A6' : '#E2845E',
        roof: { style: 'flat' },
      });
    } else if (p.fill === '#B6B6B5' || p.fill === '#BEC1BD') {
      // Grey boxes in the artwork are parking lots, not buildings.
      areas.push({ id: `parking-${++parkingCount}`, kind: 'parking', polygon: footprint });
    } else if (color === '#94DDF2') {
      areas.push({ id: `water-${areas.length + 1}`, kind: 'water', polygon: footprint });
    } else if (color === 'WHITE' && area(raw) < 200000) {
      areas.push({ id: `road-area-${areas.length + 1}`, kind: 'plaza', polygon: footprint });
    } else if (p.fill === '#F0F4F1' && area(raw) < 200000) {
      areas.push({ id: `field-${areas.length + 1}`, kind: 'field', polygon: footprint });
    }
  }
}
// Large buildings are drawn as several touching roof pieces. Pieces that touch
// become one group: they share a name and group id, so floors/colours can be set together.
function segmentDistance(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1], len = dx*dx + dy*dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / len)) : 0;
  return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
}
function polygonGap(p, q) {
  let best = Infinity;
  for (const [from, to] of [[p, q], [q, p]])
    for (const v of from) {
      if (inside(v, to)) return 0;
      for (let i = 0, j = to.length - 1; i < to.length; j = i++) best = Math.min(best, segmentDistance(v, to[j], to[i]));
    }
  return best;
}
const roofs = buildings;
const parent = roofs.map((_, i) => i);
const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
for (let i = 0; i < roofs.length; i++)
  for (let j = i + 1; j < roofs.length; j++)
    if (polygonGap(roofs[i].footprint, roofs[j].footprint) < 2.5) parent[find(i)] = find(j);
const groups = new Map();
roofs.forEach((b, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(b); });
let unnamed = 0;
for (const members of groups.values()) {
  const named = members.find(b => !b.id.startsWith('structure-'));
  const groupId = named ? named.id : `structure-${++unnamed}`;
  const groupName = named ? named.name : `Structure ${unnamed}`;
  let part = 1;
  for (const b of members) {
    if (b !== named) b.id = members.length === 1 ? groupId : `${groupId}-part-${++part}`;
    b.name = groupName;
    if (members.length > 1) b.group = groupId;
  }
}
const modelLabels = labels.map(l => ({ id: l.id, name: l.name, x: l.x, y: l.y }));

const studio = JSON.parse(fs.readFileSync(path.join(root, 'src/data/tomasafe_map_studio_project.json'), 'utf8'));
const roads = [
  ...studio.roads.map(r => ({ id: r.id, points: r.points.map(q => [round(q.x), round(q.y)]), width: 9 })),
  ...readStrokedPaths(svgFile, '#FCFEFA').map((r, i) => ({
    id: `svg-road-${i + 1}`, points: r.points.map(([x, y]) => [round(x), round(y)]), width: r.width,
  })),
];
const edits = JSON.parse(fs.readFileSync(path.join(root, 'src/data/walkabilityEdits.json'), 'utf8'));
const walkways = (edits.zones || []).filter(z => z.type === 'covered' || z.type === 'walk').map(z => ({
  id: z.id, points: z.points.map(q => [round(q.x), round(q.y)]), width: z.width ?? 14, covered: z.type === 'covered',
}));

// ---- write TypeScript ----
const pts = list => '[' + list.map(([x, y]) => `[${x},${y}]`).join(',') + ']';
const str = s => JSON.stringify(s);
const lines = [];
lines.push(`/**
 * TomaSafe campus model — THE file to edit for the 2D/3D map.
 *
 * Units: every x/y is in the original 800 x 800 map units (same as routing,
 * GPS and evacuation areas). 1 unit is about ${'0.48'} m.
 *
 * buildings[]   group      pieces of one building share a group id (the editor edits them together)
 *               footprint  corner points, in order around the building
 *               floors     number of storeys; height = floors x floorHeight (metres, default 3.5)
 *               wallColor / roofColor   any CSS hex colour, e.g. '#F3ECE3'
 *               roof.style 'flat' | 'gable' | 'hip'
 *               roof.pitch roof slope in degrees for gable/hip (default 25)
 *               roof.ridgeAngle  optional ridge direction in degrees (0 = along x); default = longest side
 * labels[]      building names shown on the map
 * areas[]       flat ground shapes: 'grass' | 'field' | 'water' | 'plaza' | 'parking'
 * roads[]       centerlines with a width
 * walkways[]    covered / open walkway centerlines with a width
 * trees[]       x, y and crown radius
 * theme         every colour that is not per building
 *
 * Generated first by tools/extract-campus-model.cjs, then edited by hand or
 * exported from the in-app map editor (long-press the TomaSafe header).
 */
import type { CampusModel } from './modelTypes';

const campusModel: CampusModel = {
  theme: {
    sky: '#E6EEF1',
    ground: '#CFDFC0',
    grass: '#BCD7A3',
    field: '#A6CF8A',
    water: '#8ECFE6',
    plaza: '#ECE8E0',
    parking: '#C3C8CC',
    parkingLine: '#FFFFFF',
    dirt: '#CDB592',
    court: '#A7B8A9',
    courtLine: '#FFFFFF',
    road: '#E3E6E4',
    curb: '#FBFAF6',
    roadEdge: '#A9C39A',
    roadLine: '#FFFFFF',
    apron: '#ECE7DE',
    walkway: '#EFE9DE',
    coveredWalkway: '#C8CFD6',
    tree: '#7FB069',
    labelText: '#1E2B3A',
    labelHalo: '#FFFFFF',
    sunAzimuth: 135,
    sunElevation: 55,
    lightContrast: 0.35,
  },
  buildings: [`);
for (const b of buildings) {
  lines.push(`    {
      id: ${str(b.id)}, name: ${str(b.name)},${b.group ? ` group: ${str(b.group)},` : ""}
      floors: ${b.floors},${b.floorHeight ? ` floorHeight: ${b.floorHeight},` : ''} wallColor: ${str(b.wallColor)}, roofColor: ${str(b.roofColor)},
      roof: { style: 'flat' },
      footprint: ${pts(b.footprint)},
    },`);
}
lines.push(`  ],
  labels: [`);
for (const l of modelLabels) lines.push(`    { id: ${str(l.id)}, name: ${str(l.name)}, x: ${l.x}, y: ${l.y} },`);
lines.push(`  ],
  rooms: [],
  areas: [`);
for (const a of areas) lines.push(`    { id: ${str(a.id)}, kind: ${str(a.kind)}, polygon: ${pts(a.polygon)} },`);
lines.push(`  ],
  roads: [`);
for (const r of roads) lines.push(`    { id: ${str(r.id)}, width: ${r.width}, points: ${pts(r.points)} },`);
lines.push(`  ],
  walkways: [`);
for (const w of walkways) lines.push(`    { id: ${str(w.id)}, width: ${w.width}, covered: ${w.covered}, points: ${pts(w.points)} },`);
lines.push(`  ],
  trees: [],
};

export default campusModel;
`);

const target = path.join(root, 'src/map3d', force ? 'campusModel.ts' : 'campusModel.draft.ts');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, lines.join('\n'));
console.log(`Wrote ${path.relative(root, target)}: ${buildings.length} buildings, ${areas.length} areas, ` +
  `${roads.length} roads, ${walkways.length} walkways, ${modelLabels.length} labels ` +
  `(${usedLabels.size} labels matched a roof).`);
const unmatched = labels.filter(l => !usedLabels.has(l.id)).map(l => l.name);
if (unmatched.length) console.log('Labels with no roof under them:', unmatched.join(', '));
