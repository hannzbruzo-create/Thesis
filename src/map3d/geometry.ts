/**
 * Geometry builders for the campus scene. Inputs are map units (800 x 800);
 * outputs are Three.js geometries in world space (X = x-400, Z = y-400, Y up).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  buildingBase, buildingHeight, DEFAULT_FLOOR_HEIGHT, DEFAULT_ROOF_PITCH, METRES_PER_UNIT, type CampusBuilding, type CampusEmblem, type FacadeStyle, type XY,
} from './modelTypes';
import { MAP_CENTER } from './cameraMath';

const wx = (x: number) => x - MAP_CENTER;
const wz = (y: number) => y - MAP_CENTER;

function signedArea(points: XY[]): number {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) a += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  return a / 2;
}

/** Drop duplicate/closing points so triangulation is happy. */
function cleanRing(points: XY[]): XY[] {
  const out: XY[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.05) out.push(p);
  }
  if (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop();
  return out;
}

/** Flat, upward-facing polygon at height y, optionally with holes cut out. */
export function flatPolygon(points: XY[], y: number, holes: XY[][] = []): THREE.BufferGeometry | null {
  const ring = cleanRing(points);
  if (ring.length < 3) return null;
  const holeRings = holes.map(cleanRing).filter(h => h.length >= 3);
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, holeRings.map(h => h.map(([x, z]) => new THREE.Vector2(x, z))));
  const all = [...ring, ...holeRings.flat()];
  const positions: number[] = [];
  for (const t of triangles) {
    // Wind so the face points up (+Y) regardless of the input order.
    const [a, b, c] = t.map(i => all[i]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const tri = cross > 0 ? [a, c, b] : [a, b, c];
    for (const p of tri) positions.push(wx(p[0]), y, wz(p[1]));
  }
  return withGroundUV(positions);
}

/** Geometry from flat positions, with UVs in map units so textures tile seamlessly across shapes. */
function withGroundUV(positions: number[]): THREE.BufferGeometry {
  const uv: number[] = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i] + MAP_CENTER, positions[i + 2] + MAP_CENTER);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Grows (d > 0) or shrinks a polygon by d map units using mitred corners.
 * Very sharp corners are clamped so the outline never spikes.
 */
export function offsetPolygon(points: XY[], d: number): XY[] {
  const ring = cleanRing(points);
  const n = ring.length;
  if (n < 3) return ring;
  const sign = signedArea(ring) > 0 ? 1 : -1;
  const normal = (a: XY, b: XY): XY => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    return [(sign * dy) / len, (-sign * dx) / len];
  };
  return ring.map((p, i) => {
    const n1 = normal(ring[(i - 1 + n) % n], p), n2 = normal(p, ring[(i + 1) % n]);
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const scale = d / Math.max(0.35, 1 + dot);
    mx *= scale; my *= scale;
    const len = Math.hypot(mx, my), max = Math.abs(d) * 2.5;
    if (len > max) { mx *= max / len; my *= max / len; }
    return [p[0] + mx, p[1] + my] as XY;
  });
}

/**
 * Roof and columns of a covered walkway / veranda along a polyline. The roof is
 * a thin slab (one box per segment plus a square at each joint); columns stand
 * along both edges about every 3.4 m. Height in map units.
 */
export function coveredWalkway(points: XY[], width: number, height: number) {
  const pts = dedupe(points);
  if (pts.length < 2) return null;
  const slab = Math.min(0.9, height * 0.08), post = Math.min(0.9, width * 0.08), spacing = 7;
  const roofParts: THREE.BufferGeometry[] = [], columnParts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, angle: number, out: THREE.BufferGeometry[]) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(-angle);
    g.translate(x, y, z);
    out.push(g.toNonIndexed());
    g.dispose();
  };
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-3) continue;
    const angle = Math.atan2(by - ay, bx - ax);
    box(len, slab, width, wx((ax + bx) / 2), height - slab / 2, wz((ay + by) / 2), angle, roofParts);
    const nx = -(by - ay) / len, ny = (bx - ax) / len, edge = width / 2 - post;
    const count = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= count; k++) {
      const t = k / count, cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
      for (const side of [-1, 1]) {
        box(post, height - slab, post, wx(cx + nx * edge * side), (height - slab) / 2, wz(cy + ny * edge * side), angle, columnParts);
      }
    }
  }
  for (let i = 1; i < pts.length - 1; i++) box(width, slab, width, wx(pts[i][0]), height - slab / 2, wz(pts[i][1]), 0, roofParts);
  const strip = (list: THREE.BufferGeometry[]) => {
    for (const g of list) g.deleteAttribute('uv');
    return list.length ? mergeGeometries(list) : null;
  };
  return { roof: strip(roofParts), columns: strip(columnParts) };
}

/** Painted court lines: inset outline, centre line and centre circle on the court's rectangle. */
export function courtMarkings(points: XY[], y: number, lineWidth = 0.45): THREE.BufferGeometry | null {
  const ring = cleanRing(points);
  if (ring.length < 3) return null;
  const r = orientedRectangle(ring);
  const c = Math.cos(r.angle), s = Math.sin(r.angle);
  const at = (u: number, v: number): XY => [u * c - v * s, u * s + v * c];
  const inset = 1.2;
  const u0 = r.minU + inset, u1 = r.maxU - inset, v0 = r.minV + inset, v1 = r.maxV - inset;
  const um = (r.minU + r.maxU) / 2, vm = (r.minV + r.maxV) / 2;
  const radius = Math.min(v1 - v0, u1 - u0) * 0.18;
  const circle = Array.from({ length: 25 }, (_, i) => at(um + radius * Math.cos((i / 24) * Math.PI * 2), vm + radius * Math.sin((i / 24) * Math.PI * 2)));
  return mergeAll([
    strip([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1), at(u0, v0)], lineWidth, y),
    strip([at(um, v0), at(um, v1)], lineWidth, y),
    strip(circle, lineWidth, y),
  ]);
}

/** Dashes along a polyline (road centre lines). */
export function dashedLine(points: XY[], width: number, y: number, dash = 4, gap = 4): THREE.BufferGeometry | null {
  const pieces: (THREE.BufferGeometry | null)[] = [];
  let carry = 0; // distance into the current dash/gap cycle
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    let t = 0;
    while (t < len) {
      const cycle = (carry + t) % (dash + gap);
      if (cycle < dash) {
        const end = Math.min(len, t + (dash - cycle));
        pieces.push(strip([[ax + (bx - ax) * (t / len), ay + (by - ay) * (t / len)],
          [ax + (bx - ax) * (end / len), ay + (by - ay) * (end / len)]], width, y));
        t = end;
      } else {
        t += dash + gap - cycle;
      }
    }
    carry = (carry + len) % (dash + gap);
  }
  return mergeAll(pieces);
}

/** Parking stall lines along both long sides of a lot's oriented rectangle. */
export function parkingStripes(points: XY[], y: number, spacing = 5.5, lineWidth = 0.45): THREE.BufferGeometry | null {
  const ring = cleanRing(points);
  if (ring.length < 3) return null;
  const r = orientedRectangle(ring);
  const c = Math.cos(r.angle), s = Math.sin(r.angle);
  const at = (u: number, v: number): XY => [u * c - v * s, u * s + v * c];
  const width = r.maxV - r.minV, length = r.maxU - r.minU;
  if (width < 8 || length < spacing * 2) return null;
  const stall = Math.min(10, width * 0.38);
  const pieces: (THREE.BufferGeometry | null)[] = [];
  for (let u = r.minU + spacing; u < r.maxU - spacing / 2; u += spacing) {
    pieces.push(strip([at(u, r.minV + 0.8), at(u, r.minV + stall)], lineWidth, y));
    pieces.push(strip([at(u, r.maxV - 0.8), at(u, r.maxV - stall)], lineWidth, y));
  }
  return mergeAll(pieces);
}

/** Plain flat strip between consecutive points (no round joins). */
function strip(points: XY[], width: number, y: number): THREE.BufferGeometry | null {
  const half = width / 2;
  const positions: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-3) continue;
    const nx = (-(by - ay) / len) * half, ny = ((bx - ax) / len) * half;
    const q = [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
    for (const k of [0, 1, 2, 0, 2, 3]) positions.push(wx(q[k][0]), y, wz(q[k][1]));
  }
  return positions.length ? withGroundUV(positions) : null;
}

/** Drop consecutive duplicate points of an open polyline. */
function dedupe(points: XY[]): XY[] {
  return points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.05);
}

/** Flat ribbon along a polyline with round joins and caps. */
export function ribbon(points: XY[], width: number, y: number): THREE.BufferGeometry | null {
  const pts = dedupe(points);
  if (pts.length < 2) return null;
  const parts: (THREE.BufferGeometry | null)[] = [strip(pts, width, y)];
  for (const [x, z] of pts) {
    const disc = new THREE.CircleGeometry(width / 2, 12).toNonIndexed();
    disc.rotateX(-Math.PI / 2);
    disc.translate(wx(x), y, wz(z));
    parts.push(withGroundUV(Array.from(disc.getAttribute('position').array)));
    disc.dispose();
  }
  return mergeAll(parts);
}

/** Merge many geometries (skipping nulls) into one draw call. UVs/colours are kept only if every part has them. */
export function mergeAll(list: (THREE.BufferGeometry | null)[]): THREE.BufferGeometry | null {
  const parts = list.filter((g): g is THREE.BufferGeometry => !!g).map(g => (g.index ? g.toNonIndexed() : g));
  if (!parts.length) return null;
  for (const name of ['uv', 'color']) {
    if (!parts.every(p => p.getAttribute(name))) for (const p of parts) if (p.getAttribute(name)) p.deleteAttribute(name);
  }
  return mergeGeometries(parts);
}

/**
 * Vertical walls around a footprint, with flat per-face normals. A vertex
 * colour darkens the bottom of each wall so buildings look anchored
 * to the ground (a cheap ambient-occlusion effect; materials use vertexColors).
 */
function walls(ring: XY[], height: number, inward = false, facade?: { floor: number; bay: number }): THREE.BufferGeometry {
  // Inward walls face into the ring (courtyard walls of a hole).
  const ccw = (signedArea(ring) > 0) !== inward;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const base = 0.66, mid = Math.min(1, 0.9 + 0.1 * Math.min(1, 12 / Math.max(height, 1)));
  // Facade walls get a darker band at the top: the shade under the roof overhang.
  const band = facade ? Math.min(EAVE_SHADE_M / METRES_PER_UNIT, height * 0.3) : 0;
  const rows: [number, number, number, number][] = band
    ? [[0, height - band, base, mid], [height - band, height, mid, EAVE_SHADE]]
    : [[0, height, base, mid]];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const [p, q] = ccw ? [a, b] : [b, a];
    // Window bays: a whole number per wall so no window is cut at a corner; short walls stay plain.
    const bays = facade?.bay ? Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) * METRES_PER_UNIT / facade.bay) : 0;
    for (const [y0, y1, c0, c1] of rows) {
      // Outward-facing quad (map y grows "down", so CCW in map = CW seen from +Y).
      const v = [
        [wx(p[0]), y0, wz(p[1])], [wx(q[0]), y0, wz(q[1])],
        [wx(q[0]), y1, wz(q[1])], [wx(p[0]), y1, wz(p[1])],
      ];
      // u counts bays along the wall, v counts storeys; plain walls sample the window-free pier.
      const uv = bays && facade ? [[0, y0 / facade.floor], [bays, y0 / facade.floor], [bays, y1 / facade.floor], [0, y1 / facade.floor]] : null;
      for (const k of [0, 2, 1, 0, 3, 2]) {
        positions.push(...v[k]);
        const c = k < 2 ? c0 : c1;
        colors.push(c, c, c);
        uvs.push(...(uv ? uv[k] : PLAIN_UV));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** Wall setback from the traced roof edge, metres: the roof overhangs the walls by this much. */
const WALL_INSET_M = 0.8;
/** Roof slab edge (fascia) thickness, metres; it rises a little above the roof as a lip. */
const FASCIA_M = 0.45, FASCIA_LIP_M = 0.18;
/** Depth of the shade under the eaves, metres, and how dark it gets. */
const EAVE_SHADE_M = 0.9, EAVE_SHADE = 0.72;
/** Width of one repeat of each facade texture, metres (0 = plain wall). */
const FACADE_BAY_M: Record<FacadeStyle, number> = { windows: 3.2, plain: 0, ust: 3.4, arcade: 3.4, fins: 1.5, grid: 3.4, veranda: 3.4, hall: 4.2, dome: 3.6, balcony: 3.6, angelico: 3.4 };
/** Facade texture coordinate on plain wall (gable ends, fascia, posts): the band above the windows. */
const PLAIN_UV = [0.5, 0.975];

/** Same per-vertex value on every vertex (vertex colour or uv) so a part can merge with the walls. */
function fill(g: THREE.BufferGeometry, name: 'color' | 'uv', value: number[]) {
  const count = g.getAttribute('position').count;
  g.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: count }, () => value).flat(), value.length));
  return g;
}

/** Map-unit UVs on any geometry so roof textures tile the same way on flat and sloped faces. */
function groundUV(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position');
  const uv: number[] = [];
  for (let i = 0; i < p.count; i++) uv.push(p.getX(i) + MAP_CENTER, p.getZ(i) + MAP_CENTER);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Downward-facing copy of a flat polygon: the underside of the roof overhang. */
function soffit(ring: XY[], y: number, holes: XY[][]): THREE.BufferGeometry | null {
  const g = flatPolygon(ring, y, holes);
  if (!g) return null;
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) {
    // Swap two corners of each triangle to flip it.
    const x = p.getX(i + 1), yy = p.getY(i + 1), z = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, x, yy, z);
  }
  g.computeVertexNormals();
  return fill(fill(g, 'color', [0.6, 0.6, 0.6]), 'uv', PLAIN_UV);
}

/**
 * Walls set back from the traced roof outline, so the roof reads as a slab that overhangs them.
 * Thin pieces get a smaller setback, and none when shrinking would fold the shape.
 */
function wallRing(ring: XY[], insetM: number, hole = false): XY[] {
  if (!insetM) return ring;
  const r = orientedRectangle(ring);
  const d = Math.min(insetM / METRES_PER_UNIT, Math.min(r.maxU - r.minU, r.maxV - r.minV) * 0.12);
  // A courtyard hole grows, which moves its walls back into the building.
  const inner = offsetPolygon(ring, hole ? d : -d);
  const area = signedArea(ring), innerArea = signedArea(inner);
  return hole || (Math.sign(area) === Math.sign(innerArea) && Math.abs(innerArea) > Math.abs(area) * 0.5) ? inner : ring;
}

/** Roof slab edge (bright fascia trim) and its underside, joined to the wall mesh. */
function roofTrim(roofRing: XY[], roofHoles: XY[][], height: number, lip: number): THREE.BufferGeometry {
  const fascia = FASCIA_M / METRES_PER_UNIT;
  const edges = [walls(roofRing, fascia + lip), ...roofHoles.map(h => walls(h, fascia + lip, true))]
    .map(g => fill(g.translate(0, height - fascia, 0), 'color', [1, 1, 1]));
  return mergeAll([...edges, soffit(roofRing, height - fascia, roofHoles)])!;
}

/** Smallest-area rectangle around the footprint (rotating calipers on the hull). */
export function orientedRectangle(ring: XY[], forcedAngle?: number) {
  const hull = convexHull(ring);
  const angles = forcedAngle != null
    ? [(forcedAngle * Math.PI) / 180]
    : hull.map((p, i) => { const q = hull[(i + 1) % hull.length]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
  let best: { angle: number; minU: number; maxU: number; minV: number; maxV: number; area: number } | null = null;
  for (const angle of angles) {
    const c = Math.cos(angle), s = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c + y * s, v = -x * s + y * c;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) best = { angle, minU, maxU, minV, maxV, area };
  }
  const r = best!;
  // Make U the long side (ridge direction) unless the angle was forced.
  if (forcedAngle == null && r.maxV - r.minV > r.maxU - r.minU) {
    const angle = r.angle + Math.PI / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c + y * s, v = -x * s + y * c;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    return { angle, minU, maxU, minV, maxV };
  }
  return r;
}

function convexHull(points: XY[]): XY[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: XY[] = [], upper: XY[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Gable / hip roof built on the footprint's oriented rectangle.
 * Returns the sloped roof faces and (for gables) the triangular end walls.
 */
function pitchedRoof(ring: XY[], base: number, style: 'gable' | 'hip', pitchDeg: number, ridgeAngle?: number) {
  const r = orientedRectangle(ring, ridgeAngle);
  const c = Math.cos(r.angle), s = Math.sin(r.angle);
  const toWorld = (u: number, v: number, y: number): number[] => [wx(u * c - v * s), y, wz(u * s + v * c)];
  const halfW = (r.maxV - r.minV) / 2;
  const midV = (r.minV + r.maxV) / 2;
  const rise = Math.tan((pitchDeg * Math.PI) / 180) * halfW;
  const inset = style === 'hip' ? Math.min(halfW, (r.maxU - r.minU) / 2) : 0;
  const top = base + rise;
  const A = toWorld(r.minU, r.minV, base), B = toWorld(r.maxU, r.minV, base);
  const C = toWorld(r.maxU, r.maxV, base), D = toWorld(r.minU, r.maxV, base);
  const R1 = toWorld(r.minU + inset, midV, top), R2 = toWorld(r.maxU - inset, midV, top);
  const roof: number[] = [];
  const ends: number[] = [];
  const tri = (out: number[], a: number[], b: number[], cc: number[]) => {
    // Face must point upward: flip when the normal's Y component is negative.
    const ux = b[0] - a[0], uz = b[2] - a[2];
    const vx = cc[0] - a[0], vz = cc[2] - a[2];
    const ny = uz * vx - ux * vz;
    if (ny >= 0) out.push(...a, ...b, ...cc);
    else out.push(...a, ...cc, ...b);
  };
  // Two long slopes.
  tri(roof, A, B, R2); tri(roof, A, R2, R1);
  tri(roof, C, D, R1); tri(roof, C, R1, R2);
  if (style === 'hip') { tri(roof, D, A, R1); tri(roof, B, C, R2); }
  else { endWall(ends, D, A, R1); endWall(ends, B, C, R2); }
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roof, 3));
  roofGeometry.computeVertexNormals();
  const endGeometry = new THREE.BufferGeometry();
  endGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ends, 3));
  endGeometry.computeVertexNormals();
  return { roof: roofGeometry, ends: endGeometry, ridgeHeight: top };
}

/**
 * Roof rising from every edge to one apex above the centroid: suits round,
 * octagonal and cross-shaped plans (dome, chapel, convent pavilions).
 */
function pyramidRoof(ring: XY[], base: number, pitchDeg: number): THREE.BufferGeometry {
  const [cx, cy] = polygonCentroid(ring);
  const reach = Math.max(...ring.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const apex = [wx(cx), base + Math.tan((pitchDeg * Math.PI) / 180) * reach * 0.8, wz(cy)];
  const positions: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const pa = [wx(a[0]), base, wz(a[1])], pb = [wx(b[0]), base, wz(b[1])];
    // Wind each face so its normal points up.
    const ux = pb[0] - pa[0], uz = pb[2] - pa[2], vx = apex[0] - pa[0], vz = apex[2] - pa[2];
    if (uz * vx - ux * vz >= 0) positions.push(...pa, ...pb, ...apex);
    else positions.push(...pa, ...apex, ...pb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/** Vertical gable triangle; both windings are emitted so it is visible from either side. */
function endWall(out: number[], a: number[], b: number[], apex: number[]) {
  out.push(...a, ...b, ...apex, ...a, ...apex, ...b);
}

export type BuildingGeometry = {
  walls: THREE.BufferGeometry;
  roof: THREE.BufferGeometry;
  outline: THREE.BufferGeometry;
  height: number;
};

export function buildBuilding(b: CampusBuilding): BuildingGeometry | null {
  const ring = cleanRing(b.footprint);
  if (ring.length < 3) return null;
  // Built from the ground up, then raised when the piece starts on an upper floor.
  const base = buildingBase(b);
  const height = buildingHeight(b) - base;
  if (b.balcony) return raise(balconyStrip(ring, height, b), base);
  if (b.canopy) return raise(canopy(ring, height, b.eave ? offsetPolygon(ring, b.eave / METRES_PER_UNIT) : ring, b), base);
  const holes = (b.holes ?? []).map(cleanRing).filter(h => h.length >= 3);
  // Footprints are traced from the roof, so the walls step back under it; with an explicit eave
  // (metres) the walls follow the footprint and the roof grows past it instead.
  const inset = b.eave ? 0 : WALL_INSET_M;
  const wallOuter = wallRing(ring, inset);
  const wallHoles = holes.map(h => wallRing(h, inset, true));
  const facade = { floor: (b.floorHeight ?? DEFAULT_FLOOR_HEIGHT) / METRES_PER_UNIT, bay: FACADE_BAY_M[b.facade ?? 'windows'] };
  const storey = facade.floor;
  const wallGeometry = b.groundArcade && !holes.length && height > storey
    ? arcadeWalls(ring, wallOuter, height, storey, b, facade)
    : mergeAll([walls(wallOuter, height, false, facade), ...wallHoles.map(h => walls(h, height, true, facade))])!;
  const roofRing = b.eave ? offsetPolygon(ring, b.eave / METRES_PER_UNIT) : ring;
  const roofHoles = b.eave ? holes.map(h => offsetPolygon(h, -b.eave! / METRES_PER_UNIT)) : holes;
  const lip = (b.parapet ?? FASCIA_LIP_M) / METRES_PER_UNIT;
  const trim = roofTrim(roofRing, roofHoles, height, lip);
  // A ground-floor corridor gets a red-tile eave over it, below the white ledge.
  const corridorEave = b.groundArcade && !holes.length && height > storey ? tileEave(wallOuter, storey - LEDGE_M / METRES_PER_UNIT) : null;
  const finish = (walls: THREE.BufferGeometry, roof: THREE.BufferGeometry, rings: XY[][], roofRings: XY[][], h: number) =>
    finishBuilding(walls, corridorEave ? mergeAll([roof, corridorEave])! : roof, rings, roofRings, h, lip);
  const wallRings = [wallOuter, ...wallHoles], roofRings = [roofRing, ...roofHoles];
  // Gable ends share the wall colour and plain facade, so they join the wall mesh.
  const shell = (ends: THREE.BufferGeometry[]) => {
    const g = mergeAll([wallGeometry, trim, ...ends.filter(e => e.getAttribute('position').count)
      .map(e => fill(fill(e, 'color', [1, 1, 1]), 'uv', PLAIN_UV))])!;
    g.computeVertexNormals();
    return g;
  };
  const pitch = b.roof.pitch ?? DEFAULT_ROOF_PITCH;
  if (b.roofParts?.length) {
    // One wall shell, several roofs: a flat cap over the whole footprint plus a pitched roof per section.
    const roofs = [flatPolygon(roofRing, height, roofHoles)];
    const ends: THREE.BufferGeometry[] = [];
    for (const part of b.roofParts) {
      const style = part.style ?? b.roof.style;
      const partRing = b.eave ? offsetPolygon(part.poly, b.eave / METRES_PER_UNIT) : cleanRing(part.poly);
      if (partRing.length < 3 || style === 'flat') continue;
      if (style === 'pyramid') { roofs.push(groundUV(pyramidRoof(partRing, height, pitch))); continue; }
      const pitched = pitchedRoof(partRing, height, style, pitch);
      roofs.push(groundUV(pitched.roof));
      ends.push(pitched.ends);
    }
    return raise(finish(shell(ends), mergeAll(roofs)!, wallRings, roofRings, height), base);
  }
  if (b.roof.style === 'flat' || holes.length) {
    // Pitched roofs need a solid rectangle, so a building with courtyards always gets a flat roof.
    return raise(finish(shell([]), flatPolygon(roofRing, height, roofHoles)!, wallRings, roofRings, height), base);
  }
  if (b.roof.style === 'pyramid') {
    return raise(finish(shell([]), groundUV(pyramidRoof(roofRing, height, pitch)), wallRings, roofRings, height), base);
  }
  const pitched = pitchedRoof(roofRing, height, b.roof.style, pitch, b.roof.ridgeAngle);
  // The flat cap underneath hides gaps when the footprint is not a perfect rectangle.
  const roof = mergeAll([groundUV(pitched.roof), flatPolygon(roofRing, height)])!;
  return raise(finish(shell([pitched.ends]), roof, wallRings, roofRings, height), base);
}

/** Balcony wall height and floor-slab edge thickness on open corridors, metres. */
const BALCONY_WALL_M = 1.05, SLAB_M = 0.3;

/**
 * Open corridor on every floor (St. Albert / St. John Macias): a floor slab per storey with a
 * cream balcony wall around its open edges on the upper floors, painted posts running the full
 * height, and a flat roof behind a white parapet.
 */
function balconyStrip(ring: XY[], height: number, b: CampusBuilding): BuildingGeometry {
  const storey = (b.floorHeight ?? DEFAULT_FLOOR_HEIGHT) / METRES_PER_UNIT;
  const floors = Math.max(1, Math.round(height / storey));
  const wallH = BALCONY_WALL_M / METRES_PER_UNIT, slab = SLAB_M / METRES_PER_UNIT;
  const cream = rgb('#E9E1D0'), white = [1, 1, 1];
  // Edges on the room side (outward normal facing away from the open side) stay bare.
  const open = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[b.balcony!];
  const sign = signedArea(ring) > 0 ? 1 : -1;
  const kept = ring.map((a, i) => {
    const c = ring[(i + 1) % ring.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const n = [(sign * (c[1] - a[1])) / len, (-sign * (c[0] - a[0])) / len];
    return n[0] * open[0] + n[1] * open[1] > -0.7;
  });
  // Open edges as two-point "rings": walls() then gives a double-sided strip along each.
  const edges = ring.map((a, i) => [a, ring[(i + 1) % ring.length]] as XY[]).filter((_, i) => kept[i]);
  const parts: (THREE.BufferGeometry | null)[] = [];
  const floorsGeo: (THREE.BufferGeometry | null)[] = [];
  for (let f = b.balconyGround ? 0 : 1; f < floors; f++) {
    const y = f * storey;
    for (const e of edges) {
      if (f) parts.push(fill(fill(walls(e, slab).translate(0, y - slab, 0), 'uv', PLAIN_UV), 'color', white));
      parts.push(fill(fill(walls(e, wallH).translate(0, y, 0), 'uv', PLAIN_UV), 'color', cream));
    }
    if (!f) continue;
    parts.push(soffit(ring, y - slab, []));
    floorsGeo.push(flatPolygon(ring, y));
  }
  const post = (b.postSize ?? 0.35) / METRES_PER_UNIT, spacing = (b.postSpacing || 3.6) / METRES_PER_UNIT;
  const color = rgb(b.postColor ?? '#F2B01E');
  const line = offsetPolygon(ring, -post / 2);
  for (let i = 0; i < line.length; i++) {
    if (!kept[i]) continue;
    const a = line[i], c = line[(i + 1) % line.length];
    const n = Math.max(1, Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / spacing));
    for (let k = 0; k < n; k++) {
      const x = a[0] + ((c[0] - a[0]) * k) / n, y = a[1] + ((c[1] - a[1]) * k) / n, h = post / 2;
      parts.push(fill(fill(walls([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], height), 'uv', PLAIN_UV), 'color', color));
    }
  }
  const lip = (b.parapet ?? FASCIA_LIP_M) / METRES_PER_UNIT;
  parts.push(roofTrim(ring, [], height, lip));
  const floorTops = mergeAll(floorsGeo);
  const roof = mergeAll([flatPolygon(ring, height), floorTops])!;
  return finishBuilding(mergeAll(parts)!, roof, [ring], [ring], height, lip);
}

/** Facade texture coordinate on a column (orange on 'arcade', plain wall on the others). */
const COLUMN_UV = [0.03, 0.5];
/** Height of the painted base on coloured posts, metres. */
const POST_BASE_M = 0.9;
const rgb = (hex: string) => new THREE.Color(hex).toArray();
/** White ledge between a ground-floor corridor and the floor above, metres. */
const LEDGE_M = 0.6;
/** How far a raised corridor platform reaches past the building outline, metres. */
const PLINTH_LIP_M = 0.8;

/**
 * Walls of a building whose ground floor is a covered corridor all round (the AQ Dome):
 * the ground-floor wall steps back `groundArcade` metres behind a ring of painted posts under
 * a white ledge; the upper floors stand on the outer line.
 */
function arcadeWalls(ring: XY[], outer: XY[], height: number, storey: number, b: CampusBuilding, facade: { floor: number; bay: number }) {
  const depth = b.groundArcade! / METRES_PER_UNIT;
  let inner = offsetPolygon(ring, -depth);
  if (Math.sign(signedArea(inner)) !== Math.sign(signedArea(ring)) || Math.abs(signedArea(inner)) < Math.abs(signedArea(ring)) * 0.3) inner = wallRing(ring, 2);
  const ledge = LEDGE_M / METRES_PER_UNIT, post = (b.postSize ?? 0.5) / METRES_PER_UNIT;
  const color = rgb(b.postColor ?? '#F2B01E');
  // Raised corridor floor: a platform a little wider than the building, posts and walls stand on it.
  const lift = (b.plinth ?? 0) / METRES_PER_UNIT;
  const parts: (THREE.BufferGeometry | null)[] = [
    // Recessed ground-floor wall, in the corridor's shade.
    fill(walls(inner, storey - ledge - lift).translate(0, lift, 0), 'color', [0.55, 0.55, 0.56]),
    walls(outer, height - storey, false, facade).translate(0, storey, 0),
    fill(walls(outer, ledge).translate(0, storey - ledge, 0), 'color', [1, 1, 1]),
    soffit(outer, storey - ledge, [inner]),
  ];
  // Posts on the outer line: one at every corner and every few metres between.
  const spacing = (b.postSpacing || 3.6) / METRES_PER_UNIT;
  const line = offsetPolygon(outer, -post / 2);
  for (let i = 0; i < line.length; i++) {
    const a = line[i], c = line[(i + 1) % line.length];
    const n = Math.max(1, Math.round(Math.hypot(c[0] - a[0], c[1] - a[1]) / spacing));
    for (let k = 0; k < n; k++) {
      const x = a[0] + ((c[0] - a[0]) * k) / n, y = a[1] + ((c[1] - a[1]) * k) / n, h = post / 2;
      parts.push(fill(fill(walls([[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]], storey - ledge - lift).translate(0, lift, 0), 'uv', PLAIN_UV), 'color', color));
    }
  }
  if (lift) {
    const edge = offsetPolygon(ring, PLINTH_LIP_M / METRES_PER_UNIT);
    parts.push(fill(fill(walls(edge, lift), 'uv', PLAIN_UV), 'color', [0.72, 0.71, 0.69]));
    const top = flatPolygon(edge, lift);
    if (top) parts.push(fill(fill(top, 'uv', PLAIN_UV), 'color', [0.86, 0.84, 0.8]));
  }
  return mergeAll(parts)!;
}

/**
 * Covered walkway: a roof slab with a fascia band, held up by posts along its edges.
 * The 'arcade' style (UST covered walks) has orange columns, a tall white band and a
 * red-tile eave sloping out below the band. `spacing` 0 keeps posts at the corners only
 * (a gate over a road).
 */
function canopy(ring: XY[], height: number, roofRing: XY[], b: CampusBuilding): BuildingGeometry {
  const ust = b.facade === 'arcade';
  const fascia = (b.parapet ?? (ust ? 0.8 : 0.35)) / METRES_PER_UNIT;
  const post = (b.postSize ?? (ust ? 0.22 : 0.25)) / METRES_PER_UNIT;
  const spacingM = b.postSpacing ?? (ust ? 3.4 : 4);
  const parts = [walls(roofRing, fascia).translate(0, height - fascia, 0)];
  // Posts sit just inside the outline, at every corner and every few metres between.
  const inner = offsetPolygon(ring, -post);
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i], c = inner[(i + 1) % inner.length];
    const n = spacingM ? Math.max(1, Math.round((Math.hypot(c[0] - a[0], c[1] - a[1]) * METRES_PER_UNIT) / spacingM)) : 1;
    for (let k = 0; k < n; k++) {
      const x = a[0] + ((c[0] - a[0]) * k) / n, y = a[1] + ((c[1] - a[1]) * k) / n, h = post / 2;
      const square: XY[] = [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]];
      if (!b.postColor) { parts.push(fill(walls(square, height - fascia), 'uv', COLUMN_UV)); continue; }
      // Painted posts: plain texture, colour from vertex colours, darker base band.
      const baseTop = Math.min(POST_BASE_M / METRES_PER_UNIT, (height - fascia) * 0.4);
      parts.push(fill(fill(walls(square, baseTop), 'uv', PLAIN_UV), 'color', rgb(b.postBase ?? b.postColor)));
      parts.push(fill(fill(walls(square, height - fascia - baseTop).translate(0, baseTop, 0), 'uv', PLAIN_UV), 'color', rgb(b.postColor)));
    }
  }
  const roofs = [flatPolygon(roofRing, height)];
  // A hip or pyramid roof can sit on the slab (open halls); gables would need end walls.
  if (b.roof.style === 'hip') roofs.push(groundUV(pitchedRoof(roofRing, height, 'hip', b.roof.pitch ?? DEFAULT_ROOF_PITCH, b.roof.ridgeAngle).roof));
  if (b.roof.style === 'pyramid') roofs.push(groundUV(pyramidRoof(roofRing, height, b.roof.pitch ?? DEFAULT_ROOF_PITCH)));
  if (ust) roofs.push(tileEave(roofRing, height - fascia));
  const lines: number[] = [];
  for (let i = 0; i < roofRing.length; i++) {
    const a = roofRing[i], c = roofRing[(i + 1) % roofRing.length];
    lines.push(wx(a[0]), height, wz(a[1]), wx(c[0]), height, wz(c[1]));
  }
  const outline = new THREE.BufferGeometry();
  outline.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { walls: mergeAll(parts)!, roof: mergeAll(roofs)!, outline, height };
}

/** Narrow tiled skirt sloping out and down from the bottom of a fascia band. */
function tileEave(outline: XY[], y: number): THREE.BufferGeometry {
  // offsetPolygon drops repeated points, so clean first to keep both rings vertex-aligned.
  const ring = cleanRing(outline);
  const out = offsetPolygon(ring, 0.7 / METRES_PER_UNIT), drop = 0.3 / METRES_PER_UNIT;
  const positions: number[] = [];
  const tri = (p: number[], q: number[], r: number[]) => {
    // Wind each face so it points up.
    const ny = (q[2] - p[2]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[2] - p[2]);
    positions.push(...p, ...(ny >= 0 ? q : r), ...(ny >= 0 ? r : q));
  };
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = [wx(ring[i][0]), y, wz(ring[i][1])], b = [wx(ring[j][0]), y, wz(ring[j][1])];
    const A = [wx(out[i][0]), y - drop, wz(out[i][1])], B = [wx(out[j][0]), y - drop, wz(out[j][1])];
    tri(a, b, B); tri(a, B, A);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return groundUV(g);
}

function raise(g: BuildingGeometry, base: number): BuildingGeometry {
  if (!base) return g;
  g.walls.translate(0, base, 0); g.roof.translate(0, base, 0); g.outline.translate(0, base, 0);
  return { ...g, height: g.height + base };
}

function finishBuilding(wallGeometry: THREE.BufferGeometry, roof: THREE.BufferGeometry, rings: XY[][], roofRings: XY[][], height: number, lip: number): BuildingGeometry {
  // Crisp outline along the top of the fascia and down the wall corners (up to the soffit).
  const lines: number[] = [];
  const top = height + lip, soffitY = height - FASCIA_M / METRES_PER_UNIT;
  for (const roofRing of roofRings) for (let i = 0; i < roofRing.length; i++) {
    const a = roofRing[i], b = roofRing[(i + 1) % roofRing.length];
    lines.push(wx(a[0]), top, wz(a[1]), wx(b[0]), top, wz(b[1]));
  }
  for (const a of rings.flat()) lines.push(wx(a[0]), 0, wz(a[1]), wx(a[0]), soffitY, wz(a[1]));
  const outline = new THREE.BufferGeometry();
  outline.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { walls: wallGeometry, roof, outline, height };
}

/** Even-odd point-in-polygon in map units. */
export function pointInPolygon(x: number, y: number, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Centroid of a polygon in map units (used for label/selection anchors). */
export function polygonCentroid(poly: XY[]): XY {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += c; cx += (poly[j][0] + poly[i][0]) * c; cy += (poly[j][1] + poly[i][1]) * c;
  }
  if (Math.abs(a) < 1e-6) return poly[0];
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * A round seal on a wall, as flat discs stacked just off the wall: gold rim, white ring, navy
 * field and a small two-tone shield. Returns one geometry per colour.
 */
export function emblemParts(e: CampusEmblem): { geometry: THREE.BufferGeometry; color: string }[] {
  const R = e.radius / METRES_PER_UNIT;
  const f = (e.facing * Math.PI) / 180;
  const dir = [Math.sin(f), -Math.cos(f)]; // world x, z the seal faces
  const place = (g: THREE.BufferGeometry, layer: number) => {
    // Discs face +Z; turn them to face `dir`, then lift each layer a little off the wall.
    g.rotateY(Math.PI - f);
    g.translate(wx(e.x) + dir[0] * layer, e.height / METRES_PER_UNIT, wz(e.y) + dir[1] * layer);
    return g;
  };
  const shield = (half: boolean) => {
    const s = new THREE.Shape(), w = R * 0.34, top = R * 0.4, mid = -R * 0.05, tip = -R * 0.46;
    s.moveTo(0, top); s.lineTo(half ? 0 : w, top); if (!half) s.lineTo(w, mid);
    s.quadraticCurveTo(half ? 0 : w * 0.9, tip * 0.75, 0, tip);
    s.quadraticCurveTo(-w * 0.9, tip * 0.75, -w, mid); s.lineTo(-w, top); s.closePath();
    return new THREE.ShapeGeometry(s, 8);
  };
  return [
    { geometry: place(new THREE.CircleGeometry(R, 40), 0.12), color: '#E9B308' },
    { geometry: place(new THREE.CircleGeometry(R * 0.86, 40), 0.18), color: '#FFFFFF' },
    { geometry: place(new THREE.CircleGeometry(R * 0.72, 40), 0.24), color: '#1E3A6E' },
    { geometry: place(shield(false), 0.3), color: '#FFFFFF' },
    { geometry: place(shield(true), 0.36), color: '#2B5BA8' },
  ];
}
