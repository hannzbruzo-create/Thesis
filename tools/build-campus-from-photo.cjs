// DEVELOPMENT ONLY. Builds src/map3d/campusModel.ts from a hand tracing of a
// top-down satellite screenshot (reference/campus-top.webp, 970 x 912 px).
//
//   node tools/build-campus-from-photo.cjs           -> writes src/map3d/campusModel.draft.ts
//   node tools/build-campus-from-photo.cjs --force   -> overwrites src/map3d/campusModel.ts
//
// All tracing below is in photo pixels. PHOTO_TO_MAP converts to the app's
// 800 x 800 map units (north-up scale + offset, fitted on the dome, chapel,
// Pius, Dominic, Macias, Albert and gym; worst residual ~8 units / ~4 m).
// The current theme is kept; names come from src/data/buildingLabels.ts and each label is pinned to its building.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const force = process.argv.includes('--force');
const PHOTO_TO_MAP = { sx: 0.75763, tx: 20.131, sy: 0.81563, ty: 19.443 };
const toMap = ([u, v]) => [
  Math.round((PHOTO_TO_MAP.sx * u + PHOTO_TO_MAP.tx) * 10) / 10,
  Math.round((PHOTO_TO_MAP.sy * v + PHOTO_TO_MAP.ty) * 10) / 10,
];
const toPhoto = ([x, y]) => [(x - PHOTO_TO_MAP.tx) / PHOTO_TO_MAP.sx, (y - PHOTO_TO_MAP.ty) / PHOTO_TO_MAP.sy];

const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
const ring = (cx, cy, rx, ry, n, start = 0) => Array.from({ length: n }, (_, i) => {
  const a = start + (i / n) * Math.PI * 2;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
});
const halfDisc = (cx, cy, r, n = 10) => [[cx, cy - r], ...Array.from({ length: n - 1 }, (_, i) => {
  const a = -Math.PI / 2 + ((i + 1) / n) * Math.PI;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}), [cx, cy + r]];

// Floor plans (AutoCAD PDFs in reference/plans/) give exact building shapes.
// Their outlines are read in plan units (PDF points, page rotated so north is up)
// and placed on the photo with a uniform scale + offset fitted on wall corners.
// `rooms` is the room-name file made by: node tools/extract-plan-rooms.mjs <pdf> <rotation> <rooms.json>
// Fits come from matching wall corners (aquinas, martin) or from the best roof
// overlap of the plan's outline (albert, angelico, dome); pius and macias by bounding box.
const PLANS = {
  // reference/plans/aquinas-ground.pdf, rotation 180. Fit residual < 1.2 px (~0.4 m).
  aquinas: { s: 0.192, tx: 421.42, ty: 460.70, rooms: 'tools/plans/aquinas-ground.rooms.json' },
  // martin-elementary-ground.pdf, rotation 0. Corner fit, rms ~8 px (roofs overhang ~1.5 m).
  martin: { s: 0.2126, tx: 396.85, ty: -35.64, rooms: 'tools/plans/martin-elementary-ground.rooms.json' },
  // albert-ground.pdf, rotation 0. Outline fit, IoU 0.77.
  albert: { s: 0.11472, tx: 595.20, ty: 730.69, rooms: 'tools/plans/albert-ground.rooms.json' },
  // angelico-ground.pdf, rotation 180. Outline fit, IoU 0.77.
  angelico: { s: 0.15624, tx: 197.36, ty: 723.11, rooms: 'tools/plans/angelico-ground.rooms.json' },
  // pius-ground.pdf, rotation 0. Bounding box of the outer wall.
  pius: { s: 0.057, tx: 441.14, ty: 313.66, rooms: 'tools/plans/pius-ground.rooms.json' },
  // macias-ground.pdf ("Student Pavilion Bldg."), rotation 90. Bounding box.
  macias: { s: 0.068, tx: 553.75, ty: 749.45, rooms: 'tools/plans/macias-ground.rooms.json' },
  // dome-ground.pdf, rotation 90 (ground-floor drawing only). Outline fit, IoU 0.85.
  dome: { s: 0.30635, tx: 320.32, ty: 699.97, rooms: 'tools/plans/dome-ground.rooms.json', outline: 'tools/plans/dome-ground.outline.json' },
};
const planOutline = plan => JSON.parse(fs.readFileSync(path.join(root, PLANS[plan].outline), 'utf8')).shapes[0].outer;
const fromPlan = (plan, poly) => poly.map(([x, y]) => [PLANS[plan].s * x + PLANS[plan].tx, PLANS[plan].s * y + PLANS[plan].ty]);
const planWidth = (plan, w) => w * PLANS[plan].s;

// Roof colours sampled from the photo, softened for the clean map style.
const TILE = '#C0634F';
const TILE_DARK = '#A9533F';
const METAL = '#CFCFC8';
const METAL_DARK = '#B9B4A8';
const CONCRETE = '#E3E0D8';
const WALL = '#F1EBE2';

// [id, photo polygon, roof, floors, extra]
// floors are placeholders until the real list is supplied; 1 = huts/covered walks.
const BUILDINGS = [
  // North-west cluster
  ['nw-house', rect(126, 9, 166, 36), 'hip', 2],
  ['nw-tall-n', rect(184, 29, 227, 86), 'gable', 2, { group: 'nw-tall' }],
  ['nw-tall-s', rect(196, 86, 220, 130), 'gable', 2, { group: 'nw-tall' }],
  ['nw-hut', rect(380, 11, 393, 28), 'hip', 1],
  ['rose-delima-metal', rect(255, 35, 318, 55), 'flat', 2, { group: 'rose-delima', roofColor: METAL }],
  ['rose-delima-small', rect(239, 25, 273, 37), 'gable', 2, { group: 'rose-delima' }],
  ['rose-delima', rect(299, 42, 387, 70), 'hip', 2, { group: 'rose-delima' }],
  ['rose-delima-back', rect(306, 70, 386, 81), 'flat', 1, { group: 'rose-delima' }],
  ['nw-link', rect(379, 41, 392, 107), 'gable', 1],
  ['nw-hall', rect(257, 100, 392, 140), 'hip', 2],
  ['nw-hall-2', rect(260, 153, 393, 192), 'hip', 2],
  ['san-lorenzo-n', rect(217, 150, 260, 200), 'gable', 2, { group: 'san-lorenzo' }],
  ['san-lorenzo-s', rect(203, 200, 260, 265), 'gable', 2, { group: 'san-lorenzo' }],
  ...[291.6, 311.2, 330.8, 350.4, 370, 389.6].map((x, i) => [`kiosk-${i + 1}`, rect(x, 252, x + 10.3, 269), 'hip', 1, { group: 'kiosks' }]),

  // North range: St. Martin building and the Preschool & Elementary wings, from their ground-floor plan.
  ['elementary-north', fromPlan('martin', rect(54, 311, 1337, 425)), 'gable', 2, { group: 'elementary', eave: 1.5 }],
  ['martin-north', fromPlan('martin', rect(1337, 262, 2067, 380)), 'gable', 2, { group: 'martin', eave: 1.5, roofColor: TILE_DARK }],
  ['martin', fromPlan('martin', rect(1275, 380, 1425, 945)), 'gable', 2, { group: 'martin', eave: 1.5 }],
  ['martin-east', fromPlan('martin', rect(1892, 380, 2067, 787)), 'gable', 2, { group: 'martin', eave: 1.5, roofColor: METAL_DARK }],
  ['martin-south', fromPlan('martin', rect(1640, 787, 2067, 985)), 'hip', 2, { group: 'martin', eave: 1.5 }],
  ['martin-pavilion', fromPlan('martin', rect(1791, 499, 1893, 644)), 'hip', 1, { group: 'martin', eave: 1.5 }],
  ['elementary-canteen', fromPlan('martin', rect(93, 791, 459, 1145)), 'hip', 2, { group: 'elementary', eave: 1.5 }],
  ['elementary-south', fromPlan('martin', rect(459, 982, 1556, 1121)), 'gable', 2, { group: 'elementary', eave: 1.5 }],
  ['elementary-south-east', fromPlan('martin', rect(1556, 948, 1638, 1145)), 'flat', 2, { group: 'elementary', eave: 1.5 }],

  // Dominic
  ['dominic', rect(699, 277, 750, 450), 'gable', 3, { group: 'dominic' }],
  ['dominic-link', rect(715, 217, 741, 277), 'gable', 1, { group: 'dominic' }],
  ['dominic-nw', rect(653, 252, 700, 288), 'hip', 2, { group: 'dominic' }],
  ['dominic-sw', rect(653, 432, 700, 470), 'hip', 2, { group: 'dominic' }],
  ['dominic-walk', rect(713, 450, 733, 500), 'flat', 1, { group: 'dominic', floorHeight: 3 }],
  ['walk-west', rect(599, 423, 611, 513), 'flat', 1, { floorHeight: 3 }],

  // Centre
  ['pius', fromPlan('pius', rect(150, 317, 2073, 1186)), 'hip', 2],
  ['gym', rect(333, 532, 388, 712), 'gable', 2, { group: 'gym', floorHeight: 4.5, roofColor: METAL }],
  ['gym-side', rect(320, 532, 333, 642), 'flat', 1, { group: 'gym' }],
  ['gym-shed', rect(303, 600, 320, 649), 'flat', 1, { group: 'gym', roofColor: METAL_DARK }],

  // South-centre quadrangle: St. Thomas building, from its ground-floor plan (plan units).
  // Corridors are included in the building outlines (they sit under the main roof).
  ['magayon', fromPlan('aquinas', rect(69, 247, 578, 467)), 'gable', 2, { group: 'magayon' }],
  ['magayon-steps', fromPlan('aquinas', rect(21, 322, 69, 419)), 'flat', 1, { group: 'magayon', roofColor: CONCRETE }],
  ['aquinas-north', fromPlan('aquinas', rect(578, 279, 1544, 414)), 'gable', 2, { group: 'aquinas' }],
  ['aquinas-offices', fromPlan('aquinas', rect(620, 414, 967, 442)), 'flat', 2, { group: 'aquinas' }],
  ['aquinas-lobby', fromPlan('aquinas', rect(1606, 328, 1815, 635)), 'hip', 2, { group: 'aquinas' }],
  ['aquinas-cashier', fromPlan('aquinas', rect(1815, 356, 2113, 480)), 'hip', 2, { group: 'aquinas', roofColor: TILE_DARK }],
  ['aquinas-stairs', fromPlan('aquinas', rect(1815, 480, 1944, 633)), 'flat', 2, { group: 'aquinas' }],
  // East wing roof is wider on the courtyard side than the plan's wall line (closeup-01.webp).
  ['aquinas', fromPlan('aquinas', rect(1890, 480, 2113, 1207)), 'gable', 2, { group: 'aquinas' }],
  ['aquinas-south', fromPlan('aquinas', rect(21, 1034, 1944, 1207)), 'gable', 2, { group: 'aquinas' }],
  ['ssc-office', fromPlan('aquinas', rect(1353, 816, 1519, 926)), 'hip', 1],
  ['annex-row', rect(827, 553, 920, 580), 'flat', 1],
  ['annex-end', rect(920, 575, 943, 600), 'hip', 1],
  // Covered walk to St. Albert, kept clear of the buildings beside it.
  ['walk-east', rect(839, 580, 850, 833), 'flat', 1, { floorHeight: 3 }],
  ['quad-hut-1', rect(649, 615, 670, 632), 'hip', 1],

  // South range, from the ground-floor plans. macias-ground.pdf is titled "Student Pavilion Bldg.".
  ['macias', fromPlan('macias', rect(483, 176, 1098, 1390)), 'gable', 2, { group: 'macias' }],
  ['macias-south', fromPlan('macias', rect(501, 1390, 1023, 2002)), 'hip', 2, { group: 'macias' }],
  // St. Albert, adjusted to a closer Google Maps view (reference/closeup-01.webp, north = right side).
  ['albert', rect(770, 753, 822, 870), 'gable', 2, { group: 'albert' }],
  ['albert-south', rect(628, 840, 770, 870), 'gable', 2, { group: 'albert' }],
  ['albert-east', rect(822, 753, 830, 881), 'flat', 1, { group: 'albert' }],
  ['albert-porch', rect(790, 745, 812, 753), 'flat', 1, { group: 'albert' }],

  // Dome: its plan's outline (faceted oval with the entrance and side wings), roof rising to the centre.
  ['dome', fromPlan('dome', planOutline('dome')), 'pyramid', 2, { group: 'dome', floorHeight: 4.5, roof: { style: 'pyramid', pitch: 14 } }],

  // Chapel: quatrefoil plan, roof rising to a central point
  ['chapel', [[238.5, 449], [252, 453], [262, 464], [279, 470], [283, 485], [279, 500], [283, 515], [272, 531], [256, 535], [246, 541],
    [231, 541], [221, 535], [205, 531], [195, 515], [199, 500], [195, 485], [199, 470], [214, 464], [225, 453]], 'pyramid', 2,
    { roof: { style: 'pyramid', pitch: 32 } }],

  // South-west
  ['angelico-w', fromPlan('angelico', rect(232, 153, 495, 489)), 'gable', 2, { group: 'angelico' }],
  ['angelico', fromPlan('angelico', rect(233, 489, 879, 770)), 'gable', 2, { group: 'angelico' }],
  ['angelico-e', fromPlan('angelico', rect(879, 489, 952, 697)), 'flat', 2, { group: 'angelico' }],
  ['angelico-n', fromPlan('angelico', rect(207, 105, 378, 153)), 'flat', 1, { group: 'angelico' }],
  ['sw-hut', rect(287, 730, 301, 744), 'hip', 1],
  ['sw-hut-2', rect(322, 856, 341, 867), 'hip', 1],
  ['walk-south-west', rect(163, 707, 300, 716), 'flat', 1, { floorHeight: 3 }],

  // St. Raymond convent: octagonal pavilions around a light court
  ...[[83, 612], [58, 640], [117, 640], [58, 682], [86, 710]].map(([x, y], i) =>
    [`raymond-${i + 1}`, ring(x, y, 15.5, 15.5, 8, Math.PI / 8), 'pyramid', 2, { group: 'raymond', roof: { style: 'pyramid', pitch: 30 } }]),
  ['raymond-6', ring(117, 678, 20.5, 20.5, 8, Math.PI / 8), 'pyramid', 2, { group: 'raymond', roofColor: '#9EA3A6', roof: { style: 'pyramid', pitch: 25 } }],
  ['raymond-core', rect(75, 627, 98, 697), 'flat', 1, { group: 'raymond', roofColor: CONCRETE }],
  ['raymond-annex', rect(100, 702, 132, 737), 'hip', 2, { group: 'raymond' }],
  ['raymond-l-n', rect(126, 744, 149, 774), 'hip', 2, { group: 'raymond' }],
  ['raymond-l-s', rect(72, 774, 149, 797), 'hip', 2, { group: 'raymond' }],
  ['raymond-small', rect(151, 675, 168, 701), 'gable', 1],
];

// Ground shapes, photo pixels.
const AREAS = [
  { id: 'field-east', kind: 'field', poly: rect(762, 240, 886, 482) },
  { id: 'field-south', kind: 'field', poly: rect(628, 757, 770, 843) },
  { id: 'lawn-quad-south', kind: 'grass', poly: fromPlan('aquinas', rect(80, 480, 1800, 1034)) },
  { id: 'plaza-quad-roundabout', kind: 'plaza', poly: fromPlan('aquinas', ring(1645, 846, 51, 51, 32)) },
  { id: 'dirt-north', kind: 'dirt', poly: rect(513, 60, 597, 133) },
  { id: 'dirt-west', kind: 'dirt', poly: [[232, 270], [418, 270], [418, 379], [232, 379]] },
  { id: 'court-basketball', kind: 'court', poly: rect(343, 447, 383, 527) },
  { id: 'court-small', kind: 'court', poly: rect(440, 580, 462, 629) },
  { id: 'plaza-chapel', kind: 'plaza', poly: ring(238.5, 494, 60, 60, 40) },
  { id: 'plaza-dome', kind: 'plaza', poly: ring(456.5, 806, 106, 79, 40) },
  { id: 'plaza-dominic', kind: 'plaza', poly: halfDisc(750, 360, 28) },
  { id: 'parking-angelico', kind: 'parking', poly: rect(300, 735, 360, 794) },
  { id: 'parking-south', kind: 'parking', poly: rect(492, 731, 826, 746) },
  { id: 'water-south-west', kind: 'water', poly: [[0, 812], [150, 850], [330, 895], [385, 912], [0, 912]] },
];

// Roads: straight segments sharing exact junction points so they meet cleanly.
// The network follows the campus directory board (reference/campus-directory-board.jpg,
// north points right on the board), snapped to the roads visible on the satellite photo.
const ROAD_W = 14; // photo px (~5 m)
const LANE_W = 10; // narrower campus lanes
const ROADS = [
  { id: 'road-north', width: ROAD_W, pts: [[425, 232], [895, 232]] },
  { id: 'road-north-west', width: LANE_W, pts: [[262, 232], [425, 232]] },
  { id: 'road-east', width: ROAD_W, pts: [[895, 232], [895, 724]] },
  { id: 'road-middle', width: ROAD_W, pts: [[392, 490], [895, 490]] },
  { id: 'road-west', width: ROAD_W, pts: [[425, 232], [425, 724]] },
  { id: 'road-centre', width: LANE_W, pts: [[618, 232], [618, 490]] },
  { id: 'road-chapel', width: LANE_W, pts: [[237, 554], [237, 724]] },
  { id: 'road-south', width: ROAD_W, pts: [[165, 724], [895, 724]] },
  { id: 'road-gate-3', width: 12, pts: [[895, 362], [962, 362]] },
  { id: 'road-boundary', width: 18, pts: [[0, 795], [160, 834], [330, 876], [470, 912]] },
  { id: 'highway', width: 22, pts: [[962, 0], [962, 912]] },
];
const WALKWAYS = [
  { id: 'path-chapel-court', width: 8, covered: false, pts: [[298, 494], [343, 494]] },
  // St. Thomas courtyard paths, from the floor plan
  { id: 'path-quad-ew', width: planWidth('aquinas', 23), covered: false, pts: fromPlan('aquinas', [[1519, 846], [1944, 846]]) },
  { id: 'path-quad-ns', width: planWidth('aquinas', 22), covered: false, pts: fromPlan('aquinas', [[1644, 635], [1644, 1034]]) },
];

// ---- edits made in the map editor (tools/map-edits.json, photo pixels) ----
// The editor page (written with --editor) exports this file; shapes listed in it
// replace the traced ones above, or are removed with { "delete": true }.
const BASE = JSON.parse(JSON.stringify({ BUILDINGS, AREAS, ROADS, WALKWAYS })); // before edits, for the editor
// --edits <file> previews a different edits file (e.g. one straight from Downloads).
const editsArg = process.argv.indexOf('--edits');
const editsFile = editsArg > 0 ? path.resolve(process.argv[editsArg + 1]) : path.join(root, 'tools/map-edits.json');
const EDITS = fs.existsSync(editsFile) ? JSON.parse(fs.readFileSync(editsFile, 'utf8')) : null;
if (EDITS) {
  // { "add": true, ... } creates a new shape; { "delete": true } removes one; anything else changes it.
  const applyTo = (list, edits, idOf, create, change) => {
    for (const [id, e] of Object.entries(edits || {})) {
      if (e.add) { list.push(create(id, e)); continue; }
      const i = list.findIndex(item => idOf(item) === id);
      if (i < 0) { console.warn(`map-edits.json: no shape "${id}"`); continue; }
      if (e.delete) list.splice(i, 1);
      else change(list[i], e);
    }
  };
  applyTo(BUILDINGS, EDITS.buildings, b => b[0],
    (id, e) => [id, e.poly, e.roof ?? 'hip', e.floors ?? 2, { name: e.name, group: e.group, floorHeight: e.floorHeight, level: e.level, roofColor: e.roofColor, canopy: e.canopy }],
    (b, e) => {
      if (e.poly) b[1] = e.poly;
      if (e.floors != null) b[3] = e.floors;
      if (e.floorHeight != null) b[4] = { ...(b[4] ?? {}), floorHeight: e.floorHeight };
      if (e.level != null) b[4] = { ...(b[4] ?? {}), level: e.level };
      if (e.holes) b[4] = { ...(b[4] ?? {}), holes: e.holes };
      if (e.roofParts) b[4] = { ...(b[4] ?? {}), roofParts: e.roofParts };
      if (e.canopy != null) b[4] = { ...(b[4] ?? {}), canopy: e.canopy };
      if (e.roofColor) b[4] = { ...(b[4] ?? {}), roofColor: e.roofColor };
      if (e.roof) { if (b[4]?.roof) b[4].roof = { ...b[4].roof, style: e.roof }; else b[2] = e.roof; }
      if (e.name) b[4] = { ...(b[4] ?? {}), name: e.name };
    });
  applyTo(AREAS, EDITS.areas, a => a.id,
    (id, e) => ({ id, kind: e.kind ?? 'grass', poly: e.poly }),
    (a, e) => { if (e.poly) a.poly = e.poly; if (e.kind) a.kind = e.kind; });
  applyTo(ROADS, EDITS.roads, r => r.id,
    (id, e) => ({ id, width: e.width ?? 10, pts: e.pts }),
    (r, e) => { if (e.pts) r.pts = e.pts; if (e.width) r.width = e.width; });
  applyTo(WALKWAYS, EDITS.walkways, w => w.id,
    (id, e) => ({ id, width: e.width ?? 6, covered: false, pts: e.pts }),
    (w, e) => { if (e.pts) w.pts = e.pts; if (e.width) w.width = e.width; });
  const count = ['buildings', 'areas', 'roads', 'walkways'].reduce((n, k) => n + Object.keys(EDITS[k] || {}).length, 0);
  console.log(`Applied ${count} edit(s) from ${path.relative(root, editsFile) || editsFile}`);
}

// ---- load the current model to keep its theme and labels ----
function loadModel(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/^import .*$/m, '')
    .replace(/const campusModel: CampusModel =/, 'globalThis.__campus =').replace(/export default campusModel;/, '');
  vm.runInThisContext(src);
  return globalThis.__campus;
}
const current = loadModel(path.join(root, 'src/map3d/campusModel.ts'));
const theme = {
  ...current.theme,
  dirt: current.theme.dirt ?? '#CDB592',
  court: current.theme.court ?? '#A7B8A9',
  courtLine: current.theme.courtLine ?? '#FFFFFF',
};

const inside = (p, poly) => {
  let v = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) v = !v;
  }
  return v;
};
const centre = poly => poly.reduce((c, p) => [c[0] + p[0] / poly.length, c[1] + p[1] / poly.length], [0, 0]);

// Names: a label names the building (and its group) that its point falls on.
// Always start from the original label positions so re-running gives the same result.
const labelSource = fs.readFileSync(path.join(root, 'src/data/buildingLabels.ts'), 'utf8');
const sourceLabels = JSON.parse(labelSource.slice(labelSource.indexOf('= [') + 2, labelSource.lastIndexOf(']') + 1))
  .map(l => ({ id: l.id, name: l.name, x: Math.round(l.x * 80) / 10, y: Math.round(l.y * 80) / 10 }));
const area = poly => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const named = {};
const labels = sourceLabels.map(l => {
  const p = toPhoto([l.x, l.y]);
  let hit = BUILDINGS.find(b => inside(p, b[1]));
  if (!hit) {
    let best = 26;
    for (const b of BUILDINGS) { const c = centre(b[1]); const d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < best) { best = d; hit = b; } }
  }
  if (!hit) return l; // e.g. a label for a courtyard: keep where it was
  const key = hit[4]?.group ?? hit[0];
  named[key] = l.name;
  // Pin the label to the centre of the group's largest piece, which is always on the building.
  const largest = BUILDINGS.filter(b => (b[4]?.group ?? b[0]) === key).sort((a, b) => area(b[1]) - area(a[1]))[0];
  const [x, y] = toMap(centre(largest[1]));
  return { ...l, x, y };
});

// Room names from each floor plan, placed with that plan's fit. Names that repeat a
// building label (e.g. "Daragang Magayon Hall") are left to the big label.
const buildingNames = new Set(sourceLabels.map(l => l.name.toLowerCase()));
// Tree crowns found on the satellite photo (dark-green canopy, outside buildings), photo px.
const TREES_FILE = path.join(__dirname, 'trees.photo.json');
// Kept lighter than the photo so the map stays readable: no crown may cover a road, path or
// parking lot, and crowds of small overlapping crowns are thinned to fewer, well-spaced trees.
const TREE_ROAD_CLEARANCE = 0.6; // share of the crown radius allowed to reach a road edge
const TREE_SPACING = 1.15;       // kept crowns are at least this many (r1 + r2) apart
const segDist = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};
const pavedLines = [...ROADS, ...WALKWAYS].map(r => ({ pts: r.pts, half: r.width / 2 }));
const pavedAreas = AREAS.filter(a => ['parking', 'plaza', 'court'].includes(a.kind)).map(a => a.poly);
const onPaving = ([x, y, r]) =>
  pavedLines.some(l => l.pts.some((p, i) => i > 0 && segDist(x, y, l.pts[i - 1], p) < l.half + r * TREE_ROAD_CLEARANCE)) ||
  pavedAreas.some(p => inside([x, y], p));
const photoTrees = fs.existsSync(TREES_FILE) ? JSON.parse(fs.readFileSync(TREES_FILE, 'utf8')) : [];
const keptTrees = [];
for (const t of photoTrees.filter(t => !onPaving(t)).sort((a, b) => b[2] - a[2])) {
  if (keptTrees.every(k => Math.hypot(k[0] - t[0], k[1] - t[1]) >= (k[2] + t[2]) * TREE_SPACING)) keptTrees.push(t);
}
const trees = keptTrees.map(([x, y, r]) => {
  const [mx, my] = toMap([x, y]);
  return { x: mx, y: my, r: Math.round(r * (PHOTO_TO_MAP.sx + PHOTO_TO_MAP.sy) / 2 * 10) / 10 };
});

// Upper floors: a plan entry may list `floors: [{ floor: 1, rooms: 'tools/plans/<x>-2f.rooms.json',
// s, tx, ty }]` where s/tx/ty place that sheet's plan units on the photo (fitted like the ground floor).
const upperRooms = Object.entries(PLANS).flatMap(([key, plan]) => (plan.floors ?? []).flatMap(f => {
  const data = JSON.parse(fs.readFileSync(path.join(root, f.rooms), 'utf8'));
  return data.rooms.filter(r => !buildingNames.has(r.name.toLowerCase())).map((r, i) => {
    const [x, y] = toMap([f.s * r.x + f.tx, f.s * r.y + f.ty]);
    return { id: `${key}-f${f.floor + 1}-room-${i + 1}`, name: r.name, x, y, floor: f.floor };
  });
}));

const rooms = Object.entries(PLANS).flatMap(([key, plan]) => {
  if (!plan.rooms) return [];
  const data = JSON.parse(fs.readFileSync(path.join(root, plan.rooms), 'utf8'));
  return data.rooms
    .filter(r => !buildingNames.has(r.name.toLowerCase()))
    .map((r, i) => {
      const [x, y] = toMap(fromPlan(key, [[r.x, r.y]])[0]);
      return { id: `${key}-room-${i + 1}`, name: r.name, x, y };
    });
});

const pretty = id => id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
// Names for groups whose label sits in a courtyard rather than on a roof.
const GROUP_NAMES = { elementary: 'Aqui Preschool & Elementary' };
const buildings = BUILDINGS.map(([id, poly, roof, floors, extra = {}]) => {
  const key = extra.group ?? id;
  return {
    id,
    name: extra.name ?? named[key] ?? GROUP_NAMES[key] ?? pretty(key), // a name typed in the map editor wins
    group: extra.group,
    floors,
    floorHeight: extra.floorHeight,
    level: extra.level,
    eave: extra.eave,
    wallColor: extra.wallColor ?? WALL,
    roofColor: extra.roofColor ?? TILE,
    roof: extra.roof ?? { style: roof },
    footprint: poly.map(toMap),
    holes: extra.holes?.map(h => h.map(toMap)),
    roofParts: extra.roofParts?.map(p => ({ poly: p.poly.map(toMap), style: p.style })),
    canopy: extra.canopy,
  };
});
const scaleW = w => Math.round(w * PHOTO_TO_MAP.sx * 10) / 10;

// ---- write TypeScript ----
const pts = list => '[' + list.map(([x, y]) => `[${x},${y}]`).join(',') + ']';
const s = v => JSON.stringify(v);
const out = [];
out.push(`/**
 * TomaSafe campus model — THE file to edit for the 2D/3D map.
 *
 * Units: every x/y is in the original 800 x 800 map units (same as routing,
 * GPS and evacuation areas). 1 unit is about 0.48 m.
 *
 * buildings[]   group      pieces of one building share a group id (the editor edits them together)
 *               footprint  corner points, in order around the building
 *               floors     number of storeys; height = floors x floorHeight (metres, default 3.5)
 *               level      storeys below this piece (upper floors with their own shape); default 0
 *               holes      enclosed courtyards cut out of the footprint (flat roof)
 *               roofParts  pitched roof sections over one footprint ({ poly, style })
 *               canopy     true for open covered walkways (roof on posts)
 *               wallColor / roofColor   any CSS hex colour, e.g. '#F3ECE3'
 *               roof.style 'flat' | 'gable' | 'hip' | 'pyramid'
 *               roof.pitch roof slope in degrees (default 25)
 *               roof.ridgeAngle  optional ridge direction in degrees (0 = along x); default = longest side
 * labels[]      building names shown on the map
 * rooms[]       small room names from floor plans (shown when zoomed in)
 * areas[]       ground shapes: 'grass' | 'field' | 'dirt' | 'court' | 'plaza' | 'parking' | 'water'
 * roads[]       centerlines with a width
 * walkways[]    covered / open walkway centerlines with a width
 * trees[]       x, y and crown radius (detected from the photo: tools/trees.photo.json)
 * theme         every colour that is not per building
 *
 * Generated by tools/build-campus-from-photo.cjs from a traced satellite
 * screenshot, then edited by hand or exported from the in-app map editor
 * (long-press the TomaSafe header).
 */
import type { CampusModel } from './modelTypes';

const campusModel: CampusModel = {
  theme: {`);
for (const [k, v] of Object.entries(theme)) out.push(`    ${k}: ${typeof v === 'number' ? v : s(v)},`);
out.push('  },\n  buildings: [');
for (const b of buildings) {
  const roof = [`style: ${s(b.roof.style)}`];
  if (b.roof.pitch != null) roof.push(`pitch: ${b.roof.pitch}`);
  out.push(`    {
      id: ${s(b.id)}, name: ${s(b.name)},${b.group ? ` group: ${s(b.group)},` : ''}
      floors: ${b.floors},${b.level ? ` level: ${b.level},` : ''}${b.canopy ? ' canopy: true,' : ''}${b.floorHeight != null ? ` floorHeight: ${b.floorHeight},` : ''}${b.eave ? ` eave: ${b.eave},` : ''} wallColor: ${s(b.wallColor)}, roofColor: ${s(b.roofColor)},
      roof: { ${roof.join(', ')} },
      footprint: ${pts(b.footprint)},${b.holes?.length ? `\n      holes: [${b.holes.map(pts).join(', ')}],` : ''}${b.roofParts?.length ? `\n      roofParts: [${b.roofParts.map(p => `{ poly: ${pts(p.poly)}${p.style ? `, style: ${s(p.style)}` : ''} }`).join(', ')}],` : ''}
    },`);
}
out.push('  ],\n  labels: [');
for (const l of labels) out.push(`    { id: ${s(l.id)}, name: ${s(l.name)}, x: ${l.x}, y: ${l.y} },`);
out.push('  ],\n  rooms: [');
for (const l of [...rooms, ...upperRooms]) out.push(`    { id: ${s(l.id)}, name: ${s(l.name)}, x: ${l.x}, y: ${l.y}${l.floor ? `, floor: ${l.floor}` : ''} },`);
out.push('  ],\n  areas: [');
for (const a of AREAS) out.push(`    { id: ${s(a.id)}, kind: ${s(a.kind)}, polygon: ${pts(a.poly.map(toMap))} },`);
out.push('  ],\n  roads: [');
for (const r of ROADS) out.push(`    { id: ${s(r.id)}, width: ${scaleW(r.width)}, points: ${pts(r.pts.map(toMap))} },`);
out.push('  ],\n  walkways: [');
for (const w of WALKWAYS) {
  const extra = `${w.height != null ? ` height: ${w.height},` : ''}${w.roofColor ? ` roofColor: ${s(w.roofColor)},` : ''}`;
  out.push(`    { id: ${s(w.id)}, width: ${scaleW(w.width)}, covered: ${w.covered},${extra} points: ${pts(w.pts.map(toMap))} },`);
}
out.push('  ],\n  trees: [');
for (const t of trees) out.push(`    { x: ${t.x}, y: ${t.y}, r: ${t.r} },`);
out.push('  ],\n};\n\nexport default campusModel;\n');

// --overlay <file>: also write the tracing in photo pixels, for checking against the screenshot.
const overlayArg = process.argv.indexOf('--overlay');
if (overlayArg > 0) {
  fs.writeFileSync(process.argv[overlayArg + 1], JSON.stringify({
    buildings: BUILDINGS.map(b => ({ id: b[0], poly: b[1] })),
    areas: AREAS.map(a => ({ id: a.id, poly: a.poly })),
    roads: [...ROADS, ...WALKWAYS].map(r => ({ id: r.id, w: r.width, pts: r.pts })),
    rooms: rooms.map(r => ({ name: r.name, at: toPhoto([r.x, r.y]) })),
  }));
}

// --editor: write reference/map-editor.html (next to the git-ignored photo it draws on).
// It shows the shapes before edits plus the current edits, so you continue where you left off.
if (process.argv.includes('--editor')) {
  const nameOf = id => buildings.find(b => b.id === id)?.name ?? id;
  const data = {
    buildings: BASE.BUILDINGS.map(([id, poly, roof, floors, extra = {}]) => ({
      id, poly, name: nameOf(id), group: extra.group, roof: extra.roof?.style ?? roof, floors,
    })),
    areas: BASE.AREAS.map(a => ({ id: a.id, kind: a.kind, poly: a.poly })),
    roads: [...BASE.ROADS.map(r => ({ id: r.id, width: r.width, pts: r.pts })),
      ...BASE.WALKWAYS.map(w => ({ id: w.id, width: w.width, covered: w.covered, pts: w.pts }))],
  };
  const template = fs.readFileSync(path.join(__dirname, 'map-editor-template.html'), 'utf8');
  const html = template
    .replace('/*__DATA__*/null', JSON.stringify(data))
    .replace('/*__EDITS__*/null', JSON.stringify(EDITS));
  const editorFile = path.join(root, 'reference/map-editor.html');
  fs.writeFileSync(editorFile, html);
  console.log(`Wrote ${path.relative(root, editorFile)} (open it in a browser).`);
}

const target = path.join(root, 'src/map3d', force ? 'campusModel.ts' : 'campusModel.draft.ts');
fs.writeFileSync(target, out.join('\n'));
console.log(`Wrote ${path.relative(root, target)}: ${buildings.length} building pieces, ${AREAS.length} areas, ${ROADS.length} roads, ${WALKWAYS.length} walkways.`);
console.log('Named:', Object.entries(named).map(([k, v]) => `${k} = ${v}`).join('; '));
