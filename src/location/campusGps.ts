import obstacles from '../data/visualObstacles.json';
import zonesData from '../data/walkabilityEdits.json';
import type { Point } from '../navigation/walkableGraph';

/** Existing TomaSafe bounding-box estimate; must be calibrated on campus.
 * Do not treat this as surveyed indoor/outdoor detection. */
export const CAMPUS_BOUNDS = {
  north: 13.165857, south: 13.162422,
  west: 123.747844, east: 123.751555,
} as const;

export const MAX_ROUTE_GPS_ACCURACY_M = 18;
export const MIN_REROUTE_MOVEMENT_M = 2.5;
export const MIN_REROUTE_INTERVAL_MS = 1600;

export type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

/**
 * Map alignment. CAMPUS_BOUNDS is only an estimate, so GPS positions can land a few metres off,
 * and by different amounts in different parts of campus. Each alignment point pairs where the
 * GPS put you (raw map units) with where you really stood (tapped on the map). One point fixes a
 * constant offset; two or more also fix scale and rotation (least-squares similarity fit).
 * Points added in the app are saved on the phone; copy them here (from the GPS test panel's
 * "Share points") to ship them with every install.
 */
export type AlignmentPoint = { raw: Point; map: Point };
export const BUILT_IN_ALIGNMENT: AlignmentPoint[] = [];

/** x' = a·x − b·y + tx, y' = b·x + a·y + ty (scale and rotation in a and b). */
type Similarity = { a: number; b: number; tx: number; ty: number };
const IDENTITY: Similarity = { a: 1, b: 0, tx: 0, ty: 0 };
let alignmentPoints: AlignmentPoint[] = [...BUILT_IN_ALIGNMENT];
let alignment = fitAlignment(alignmentPoints);

/** Least-squares similarity from raw → true points; falls back to a plain offset when the points
 * are too close together or the fit looks implausible (a mis-tap). */
export function fitAlignment(points: AlignmentPoint[]): Similarity {
  if (!points.length) return IDENTITY;
  const n = points.length;
  const cx = points.reduce((s, p) => s + p.raw.x, 0) / n, cy = points.reduce((s, p) => s + p.raw.y, 0) / n;
  const mx = points.reduce((s, p) => s + p.map.x, 0) / n, my = points.reduce((s, p) => s + p.map.y, 0) / n;
  const offset: Similarity = { a: 1, b: 0, tx: mx - cx, ty: my - cy };
  let sxx = 0, sxy = 0, norm = 0;
  for (const p of points) {
    const rx = p.raw.x - cx, ry = p.raw.y - cy, ux = p.map.x - mx, uy = p.map.y - my;
    sxx += rx * ux + ry * uy;
    sxy += rx * uy - ry * ux;
    norm += rx * rx + ry * ry;
  }
  // Points need to be spread out (here: about 20 m apart) to tell scale and rotation apart from noise.
  if (n < 2 || norm < 40 * 40 / 2) return offset;
  const a = sxx / norm, b = sxy / norm;
  const scale = Math.hypot(a, b), rotation = Math.abs(Math.atan2(b, a) * 180 / Math.PI);
  if (scale < 0.8 || scale > 1.25 || rotation > 20) return offset;
  return { a, b, tx: mx - (a * cx - b * cy), ty: my - (b * cx + a * cy) };
}

function applyAlignment(p: Point, t: Similarity = alignment): Point {
  return { x: t.a * p.x - t.b * p.y + t.tx, y: t.b * p.x + t.a * p.y + t.ty };
}

export type AlignmentInfo = {
  points: number; offsetM: number; scale: number; rotationDeg: number;
  /** Average distance (m) between where the alignment now puts each point and where it really is. */
  residualM: number;
};
export function getAlignmentInfo(): AlignmentInfo {
  const t = alignment, centre = { x: 400, y: 400 }, moved = applyAlignment(centre);
  const residual = alignmentPoints.length
    ? alignmentPoints.reduce((s, p) => { const q = applyAlignment(p.raw); return s + Math.hypot(q.x - p.map.x, q.y - p.map.y); }, 0) / alignmentPoints.length
    : 0;
  return {
    points: alignmentPoints.length,
    offsetM: Math.hypot(moved.x - centre.x, moved.y - centre.y) * 0.48,
    scale: Math.hypot(t.a, t.b),
    rotationDeg: Math.atan2(t.b, t.a) * 180 / Math.PI,
    residualM: residual * 0.48,
  };
}
export function getAlignmentPoints() { return alignmentPoints.map(p => ({ raw: { ...p.raw }, map: { ...p.map } })); }
export function setAlignmentPoints(points: AlignmentPoint[]) {
  alignmentPoints = points.map(p => ({ raw: { ...p.raw }, map: { ...p.map } }));
  alignment = fitAlignment(alignmentPoints);
  saveAlignment();
}
/** Taps further than this from the current GPS position (map units, ~50 m) are treated as mis-taps. */
const MAX_ALIGNMENT_TAP = 100;
/** Pair the raw GPS map point with the spot the user tapped as their true position. */
export function addAlignmentPoint(raw: Point, truth: Point): boolean {
  const shown = applyAlignment(raw);
  if (Math.hypot(truth.x - shown.x, truth.y - shown.y) > MAX_ALIGNMENT_TAP) return false;
  setAlignmentPoints([...alignmentPoints, { raw, map: truth }]);
  return true;
}
export function clearAlignment() { setAlignmentPoints([...BUILT_IN_ALIGNMENT]); }

// Saved on the phone, so a calibration survives restarts.
const ALIGNMENT_FILE = 'gps-alignment.json';
function alignmentFile() {
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  return new File(Paths.document, ALIGNMENT_FILE);
}
function saveAlignment() {
  try {
    const file = alignmentFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(alignmentPoints));
  } catch { /* storage unavailable: keep the in-memory alignment for this session */ }
}
/** Load the saved alignment (call once at startup). */
export async function loadAlignment() {
  try {
    const file = alignmentFile();
    if (!file.exists) return;
    const saved = JSON.parse(await file.text()) as AlignmentPoint[];
    if (Array.isArray(saved) && saved.every(p => Number.isFinite(p?.raw?.x) && Number.isFinite(p?.map?.y))) {
      alignmentPoints = saved;
      alignment = fitAlignment(alignmentPoints);
    }
  } catch { /* corrupt or missing: use the built-in alignment */ }
}

/**
 * Correction from fitting ~1,600 points on OpenStreetMap building outlines (surveyed lat/lon) to
 * the campus model's footprints: about 1.5 m west, 0.9 m north, 1.5° rotation, +0.4 % scale.
 * It brings the median outline mismatch from 2.2 m to 1.5 m. Field alignment points (below)
 * are fitted on top of this.
 */
const OSM_ALIGNMENT: Similarity = { a: 1.00409, b: -0.026543, tx: -15.300, ty: 7.089 };

/** GPS position in map units, before the field alignment points are applied. */
export function gpsToRawCampusPoint(latitude: number, longitude: number): Point {
  return applyAlignment({
    x: 800 * (longitude - CAMPUS_BOUNDS.west) / (CAMPUS_BOUNDS.east - CAMPUS_BOUNDS.west),
    y: 800 * (CAMPUS_BOUNDS.north - latitude) / (CAMPUS_BOUNDS.north - CAMPUS_BOUNDS.south),
  }, OSM_ALIGNMENT);
}

export function gpsToCampusPoint(latitude: number, longitude: number): Point {
  return applyAlignment(gpsToRawCampusPoint(latitude, longitude));
}

export function inCampusMap(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 800 && point.y >= 0 && point.y <= 800;
}

export function distanceMeters(a: Pick<GpsFix, 'latitude' | 'longitude'>,
  b: Pick<GpsFix, 'latitude' | 'longitude'>): number {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanceFromSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x-a.x, dy = b.y-a.y;
  const t = dx*dx+dy*dy < 1e-9 ? 0 :
    Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy));
}
function polygonNear(p: Point, vertices: Point[], buffer = 0): boolean {
  if (vertices.length < 3) return false;
  let inside = false;
  for (let i=0,j=vertices.length-1; i<vertices.length; j=i++) {
    const a = vertices[i], b = vertices[j];
    if (distanceFromSegment(p,a,b) <= buffer) return true;
    if ((a.y>p.y)!==(b.y>p.y) && p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

const roofPolygons: Point[][] = obstacles.filter(o => !o.id.startsWith('water')).map(o => o.polygon.map(v => ({ x:v[0], y:v[1] })));
const waterPolygons: Point[][] = obstacles.filter(o => o.id.startsWith('water')).map(o => o.polygon.map(v => ({ x:v[0], y:v[1] })));
const blockedPolygons: Point[][] = (zonesData.zones ?? [])
  .filter(z => z.type === 'blocked' || z.type === 'restricted')
  .map(z => z.points);
const allObstacles = [...blockedPolygons, ...roofPolygons, ...waterPolygons];


/** About 0.48 m per map unit (same scale as the 3D map). */
const METRES_PER_MAP_UNIT = 0.48;
/**
 * Nearest point just outside the building that contains `p`, if within `maxDistance` map units
 * and clear of every other obstacle. Edges are tried nearest first, so a courtyard's
 * zero-width joining cut never wins.
 */
function nearestOutdoorPoint(p: Point, maxDistance: number): Point | null {
  const candidates: { q: Point; d: number }[] = [];
  for (const poly of roofPolygons) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j], b = poly[i], dx = b.x-a.x, dy = b.y-a.y, l2 = dx*dx+dy*dy;
      if (l2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
      const q = {x:a.x+t*dx, y:a.y+t*dy}, d = Math.hypot(q.x-p.x, q.y-p.y);
      if (d <= maxDistance) candidates.push({q, d});
    }
  }
  candidates.sort((m, n) => m.d - n.d);
  for (const {q, d} of candidates) {
    // Step 1.5 map units (~0.7 m) past the wall, away from the drifted point.
    const ux = d > 1e-6 ? (q.x-p.x)/d : 0, uy = d > 1e-6 ? (q.y-p.y)/d : 0;
    const out = {x:q.x+ux*1.5, y:q.y+uy*1.5};
    if (inCampusMap(out) && !allObstacles.some(poly => polygonNear(out, poly))) return out;
  }
  return null;
}


/**
 * Screens a fresh GPS fix against the estimated map extent and blocked polygons.
 * The outer rectangle is NOT a surveyed campus boundary; near-edge readings
 * are marked uncertain rather than forcing a route.
 */
export type GpsScreenCode = 'ok' | 'invalid' | 'low-accuracy' |
  'outside-campus' | 'near-boundary' | 'blocked' | 'near-building' | 'inside-building';
export function screenOutdoorFix(fix: GpsFix): {
  usable: boolean; point: Point | null; reason: string; code: GpsScreenCode;
} {
  const { latitude, longitude, accuracy } = fix;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {usable:false,point:null,code:'invalid',reason:'No valid GPS coordinates.'};
  }
  const point = gpsToCampusPoint(latitude, longitude);
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > MAX_ROUTE_GPS_ACCURACY_M) {
    return {usable:false,point:null,code:'low-accuracy',
      reason:`GPS accuracy is insufficient. Wait for better than ${MAX_ROUTE_GPS_ACCURACY_M} m before routing.`};
  }
  if (!inCampusMap(point)) {
    // A location just outside the approximate rectangle may be on its boundary
    // once both GPS uncertainty and SVG survey error are considered.
    const nearestLatitude = Math.max(CAMPUS_BOUNDS.south,Math.min(CAMPUS_BOUNDS.north,latitude));
    const nearestLongitude = Math.max(CAMPUS_BOUNDS.west,Math.min(CAMPUS_BOUNDS.east,longitude));
    const beyondMeters = distanceMeters({latitude,longitude},{latitude:nearestLatitude,longitude:nearestLongitude});
    if (beyondMeters <= accuracy + 12) {
      return {usable:false,point:null,code:'near-boundary',reason:
        'You are near the mapped campus boundary. We cannot confirm that you are inside Rawis Campus. Move to a known outdoor campus walkway and retry.'};
    }
    return {usable:false,point:null,code:'outside-campus',reason:
      'Outside the mapped UST–Legazpi Rawis Campus area. This evacuation map works only when you are inside the campus.'};
  }
  if (blockedPolygons.some(poly => polygonNear(point, poly))) {
    return {usable:false,point,code:'blocked',reason:
      'GPS is inside a restricted area. Keeping the last verified outdoor route.'};
  }
  if (waterPolygons.some(poly => polygonNear(point, poly))) {
    return {usable:false,point,code:'blocked',reason:
      'GPS is over water. Keeping the last verified outdoor route.'};
  }
  if (roofPolygons.some(poly => polygonNear(point, poly))) {
    // GPS often drifts a few metres into a building near its walls. If the nearest outdoor
    // point is within the reported accuracy (at least 8 m), start the route from there.
    const outside = nearestOutdoorPoint(point, Math.max(accuracy, 8) / METRES_PER_MAP_UNIT);
    if (outside) {
      return {usable:true,point:outside,code:'near-building',reason:
        'You may be inside a building. Go outside first; the route starts from the nearest outdoor point.'};
    }
    // Really inside: navigation is outdoor-only. The SMS / push alert tells people to leave the
    // building first; routing starts once GPS shows them outside.
    return {usable:false,point,code:'inside-building',reason:
      'You appear to be inside a building. Go outside first; navigation starts once you are outdoors.'};
  }
  // Proximity alone must never switch off routing: GPS commonly drifts
  // several metres near walls (multipath/reflections). Only a point actually
  // INSIDE a mapped obstruction is flagged as uncertain above.
  return {usable:true,point,code:'ok',reason:
    'GPS is within the approximate mapped outdoor area; this is not proof of physical location.'};
}
