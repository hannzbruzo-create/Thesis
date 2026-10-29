// DEVELOPMENT ONLY. Pulls room names out of an AutoCAD floor-plan PDF.
//   node tools/extract-plan-rooms.mjs reference/plans/aquinas-ground.pdf 180 tools/plans/aquinas-ground.rooms.json [x0,y0,x1,y1]
// The optional crop (plan units) keeps only text inside it, e.g. one drawing on a sheet with several.
// An optional 5th argument sets the minimum text height to keep (default 6.5).
// Positions are written in plan units: PDF points after rotating the page by the
// given angle (the same rotation used to read the building outlines), so
// tools/build-campus-from-photo.cjs can place them with that plan's fit.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [file, rotation = '0', outFile, cropArg, minHeightArg] = process.argv.slice(2);
const crop = cropArg ? cropArg.split(',').map(Number) : null;
if (!file || !outFile) {
  console.error('usage: node tools/extract-plan-rooms.mjs <plan.pdf> <rotation> <out.json>');
  process.exit(1);
}
// Text that is not a room name.
const SKIP = /^(UP|DN|DOWN|ACU|WASHING|FREEZERS|COOKING|COUNTER|LANDING)$|CORRIDOR|EXISTING|ACCESS TO|PLANTER|SIDEWALK|CANOPY|ROOF LINE|SERVICE WALK|PORCH|FLAG POLE|^FENCE$|GROUND FLOOR|PRESCHOOL AND ELEMENTARY|FLOOR PLAN|FLOOR L\.L\.|DESIGNED BY|^[A-Z]?$|^\d+(\.\d+)?$|^[CORID]+$/i;
// Smaller text is fine print for fixtures and sub-rooms. Sheets plotted smaller (A3) need a lower value.
const MIN_HEIGHT = minHeightArg ? +minHeightArg : 6.5;

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
const page = await doc.getPage(1);
const vp = page.getViewport({ scale: 1, rotation: +rotation });
const { items } = await page.getTextContent();

// Each text run -> centre point in plan units, its direction, height and text.
const runs = items.filter(t => t.str.trim()).map(t => {
  const [a, b, c, d, e, f] = t.transform;
  const h = Math.hypot(c, d) || Math.hypot(a, b);
  const len = Math.hypot(a, b) || 1;
  const ux = a / len, uy = b / len; // reading direction in PDF space
  const cx = e + ux * t.width / 2 - uy * h * 0.35, cy = f + uy * t.width / 2 + ux * h * 0.35;
  const [x, y] = pdfjs.Util.applyTransform([cx, cy], vp.transform);
  const [x2, y2] = pdfjs.Util.applyTransform([cx + ux, cy + uy], vp.transform);
  return { text: t.str.trim(), x, y, h, dir: [x2 - x, y2 - y], width: t.width };
}).filter(r => r.h >= MIN_HEIGHT && (!crop || (r.x >= crop[0] && r.y >= crop[1] && r.x <= crop[2] && r.y <= crop[3])));

// 1. Join letter-spaced words drawn one letter per run ("C" "O" "R" ...).
const singles = runs.filter(r => r.text.length === 1);
const used = new Set();
const words = [];
for (const s of singles) {
  if (used.has(s)) continue;
  const line = singles.filter(o => !used.has(o) && Math.abs(o.h - s.h) < 0.2 &&
    Math.abs((o.x - s.x) * s.dir[1] - (o.y - s.y) * s.dir[0]) < s.h * 0.6);
  // walk along the reading direction, keeping letters closer than ~8 letter heights apart
  line.sort((p, q) => ((p.x - s.x) * s.dir[0] + (p.y - s.y) * s.dir[1]) - ((q.x - s.x) * s.dir[0] + (q.y - s.y) * s.dir[1]));
  let group = [];
  const flush = () => {
    if (group.length > 1) {
      for (const g of group) used.add(g);
      const n = group.length;
      words.push({ ...group[0], text: group.map(g => g.text).join(''),
        x: group.reduce((t, g) => t + g.x, 0) / n, y: group.reduce((t, g) => t + g.y, 0) / n });
    }
    group = [];
  };
  for (const o of line) {
    const last = group[group.length - 1];
    if (last && Math.hypot(o.x - last.x, o.y - last.y) > s.h * 8) flush();
    group.push(o);
  }
  flush();
}
const pieces = [...runs.filter(r => !used.has(r) && r.text.length > 1), ...words]
  .map(r => ({ ...r, text: r.text.replace(/\b(\w) (?=\w\b)/g, '$1').replace(/\s+/g, ' ') })); // "L O B B Y" -> "LOBBY"

/** "CASHIER'S OFFICE" -> "Cashier's Office"; keeps codes like T-101 and C.R. as written. */
function titleCase(s) {
  // Codes (T-101, C.R.) and acronyms (CSWCA, PWD, CR) stay in capitals.
  const keep = w => /\d|\./.test(w) || /[^AEIOU\W\d]{4,}/i.test(w) || (w.length <= 4 && !/[AEIOU]/i.test(w));
  return s.split(' ').map(w => (keep(w) ? w.toUpperCase()
    : w.toLowerCase().replace(/(^|-)([a-z])/g, (_, sep, c) => sep + c.toUpperCase()))).join(' ')
    .replace(/ (And|Of|The|For)\b/g, m => m.toLowerCase());
}

// 2. Merge stacked lines of one label ("OFFICE OF THE" over "REGISTRAR").
pieces.sort((p, q) => p.y - q.y || p.x - q.x);
const labels = [];
const taken = new Set();
for (const p of pieces) {
  if (taken.has(p)) continue;
  const stack = [p];
  taken.add(p);
  let grew = true;
  while (grew) {
    grew = false;
    for (const q of pieces) {
      if (taken.has(q) || Math.abs(q.h - p.h) > 0.25) continue;
      const near = stack.some(m => {
        const along = Math.abs((q.x - m.x) * p.dir[0] + (q.y - m.y) * p.dir[1]);
        const across = Math.abs((q.x - m.x) * p.dir[1] - (q.y - m.y) * p.dir[0]);
        return across > p.h * 0.5 && across < p.h * 1.9 && along < Math.max(m.width, q.width) * 0.6;
      });
      if (near) { stack.push(q); taken.add(q); grew = true; }
    }
  }
  // Top line first: order the lines along the text's "up" direction.
  const up = [p.dir[1], -p.dir[0]];
  stack.sort((m, n) => (n.x * up[0] + n.y * up[1]) - (m.x * up[0] + m.y * up[1]));
  const raw = stack.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim();
  if (SKIP.test(raw)) continue;
  labels.push({
    name: titleCase(raw),
    x: Math.round(stack.reduce((t, s) => t + s.x, 0) / stack.length * 10) / 10,
    y: Math.round(stack.reduce((t, s) => t + s.y, 0) / stack.length * 10) / 10,
  });
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ source: path.basename(file), rotation: +rotation, rooms: labels }, null, 1));
console.log(`${labels.length} room labels -> ${outFile}`);
for (const l of labels) console.log(`  ${l.name.padEnd(36)} ${l.x}, ${l.y}`);
