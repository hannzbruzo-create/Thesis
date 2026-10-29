import type { CampusModel, XY } from '../modelTypes';

const r = (n: number) => Math.round(n * 10) / 10;
const pts = (list: XY[]) => '[' + list.map(([x, y]) => `[${r(x)},${r(y)}]`).join(',') + ']';
const s = (v: string) => JSON.stringify(v);

/** Serialises the working model back into the same layout as campusModel.ts. */
export function exportCampusModel(m: CampusModel): string {
  const out: string[] = [];
  out.push(`/**
 * TomaSafe campus model — THE file to edit for the 2D/3D map.
 * Exported from the in-app map editor. See modelTypes.ts for every field.
 * Units: original 800 x 800 map units; 1 unit is about 0.48 m.
 */
import type { CampusModel } from './modelTypes';

const campusModel: CampusModel = {
  theme: {`);
  for (const [k, v] of Object.entries(m.theme)) out.push(`    ${k}: ${typeof v === 'number' ? v : s(v)},`);
  out.push('  },\n  buildings: [');
  for (const b of m.buildings) {
    const roof = [`style: ${s(b.roof.style)}`];
    if (b.roof.pitch != null) roof.push(`pitch: ${b.roof.pitch}`);
    if (b.roof.ridgeAngle != null) roof.push(`ridgeAngle: ${b.roof.ridgeAngle}`);
    out.push(`    {
      id: ${s(b.id)}, name: ${s(b.name)},${b.group ? ` group: ${s(b.group)},` : ''}
      floors: ${b.floors},${b.level ? ` level: ${b.level},` : ''}${b.canopy ? ' canopy: true,' : ''}${b.postSpacing != null ? ` postSpacing: ${b.postSpacing},` : ''}${b.postSize != null ? ` postSize: ${b.postSize},` : ''}${b.postColor ? ` postColor: ${s(b.postColor)},` : ''}${b.postBase ? ` postBase: ${s(b.postBase)},` : ''}${b.groundArcade ? ` groundArcade: ${b.groundArcade},` : ''}${b.plinth ? ` plinth: ${b.plinth},` : ''}${b.balcony ? ` balcony: ${s(b.balcony)},` : ''}${b.balconyGround ? ' balconyGround: true,' : ''}${b.floorHeight != null ? ` floorHeight: ${b.floorHeight},` : ''}${b.eave ? ` eave: ${b.eave},` : ''}${b.facade ? ` facade: ${s(b.facade)},` : ''}${b.parapet != null ? ` parapet: ${b.parapet},` : ''} wallColor: ${s(b.wallColor)}, roofColor: ${s(b.roofColor)},
      roof: { ${roof.join(', ')} },
      footprint: ${pts(b.footprint)},${b.holes?.length ? `\n      holes: [${b.holes.map(pts).join(', ')}],` : ''}${b.roofParts?.length ? `\n      roofParts: [${b.roofParts.map(p => `{ poly: ${pts(p.poly)}${p.style ? `, style: ${s(p.style)}` : ''} }`).join(', ')}],` : ''}
    },`);
  }
  out.push('  ],\n  labels: [');
  for (const l of m.labels) out.push(`    { id: ${s(l.id)}, name: ${s(l.name)}, x: ${r(l.x)}, y: ${r(l.y)} },`);
  out.push('  ],\n  rooms: [');
  for (const l of m.rooms) out.push(`    { id: ${s(l.id)}, name: ${s(l.name)}, x: ${r(l.x)}, y: ${r(l.y)}${l.floor ? `, floor: ${l.floor}` : ''} },`);
  out.push('  ],\n  areas: [');
  for (const a of m.areas) out.push(`    { id: ${s(a.id)}, kind: ${s(a.kind)}, polygon: ${pts(a.polygon)} },`);
  out.push('  ],\n  roads: [');
  for (const rd of m.roads) out.push(`    { id: ${s(rd.id)}, width: ${rd.width}, points: ${pts(rd.points)} },`);
  out.push('  ],\n  walkways: [');
  for (const w of m.walkways) {
    const extra = `${w.height != null ? ` height: ${w.height},` : ''}${w.roofColor ? ` roofColor: ${s(w.roofColor)},` : ''}`;
    out.push(`    { id: ${s(w.id)}, width: ${w.width}, covered: ${w.covered},${extra} points: ${pts(w.points)} },`);
  }
  out.push('  ],\n  trees: [');
  for (const t of m.trees) out.push(`    { x: ${r(t.x)}, y: ${r(t.y)}, r: ${r(t.r)} },`);
  out.push('  ],\n  emblems: [');
  for (const e of m.emblems ?? []) out.push(`    { id: ${s(e.id)}, x: ${r(e.x)}, y: ${r(e.y)}, height: ${e.height}, radius: ${e.radius}, facing: ${e.facing} },`);
  out.push('  ],\n};\n\nexport default campusModel;\n');
  return out.join('\n');
}
