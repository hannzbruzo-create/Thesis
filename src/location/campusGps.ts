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
export const MIN_REROUTE_MOVEMENT_M = 4;
export const MIN_REROUTE_INTERVAL_MS = 3000;

export type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export function gpsToCampusPoint(latitude: number, longitude: number): Point {
  return {
    x: 800 * (longitude - CAMPUS_BOUNDS.west) / (CAMPUS_BOUNDS.east - CAMPUS_BOUNDS.west),
    y: 800 * (CAMPUS_BOUNDS.north - latitude) / (CAMPUS_BOUNDS.north - CAMPUS_BOUNDS.south),
  };
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

const roofPolygons: Point[][] = obstacles.map(o => o.polygon.map(v => ({ x:v[0], y:v[1] })));
const blockedPolygons: Point[][] = (zonesData.zones ?? [])
  .filter(z => z.type === 'blocked' || z.type === 'restricted')
  .map(z => z.points);
const allObstacles = [...blockedPolygons, ...roofPolygons];

/**
 * Screens a fresh GPS fix against the estimated map extent and blocked polygons.
 * The outer rectangle is NOT a surveyed campus boundary; near-edge readings
 * are marked uncertain rather than forcing a route.
 */
export type GpsScreenCode = 'ok' | 'invalid' | 'low-accuracy' |
  'outside-campus' | 'near-boundary' | 'blocked' | 'near-building';
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
    if (beyondMeters <= accuracy + 5) {
      return {usable:false,point:null,code:'near-boundary',reason:
        'You are near the mapped campus boundary. We cannot confirm that you are inside Rawis Campus. Move to a known outdoor campus walkway and retry.'};
    }
    return {usable:false,point:null,code:'outside-campus',reason:
      'Outside the mapped UST–Legazpi Rawis Campus area. This evacuation map works only when you are inside the campus.'};
  }
  if (allObstacles.some(poly => polygonNear(point, poly))) {
    return {usable:false,point:null,code:'blocked',reason:
      'GPS position overlaps a mapped building or blocked area. Outdoor routing is paused.'};
  }
  const latMetersPerMapUnit = (CAMPUS_BOUNDS.north-CAMPUS_BOUNDS.south)*111000/800;
  const margin = Math.max(3, Math.min(9, accuracy / latMetersPerMapUnit * 0.35));
  if (allObstacles.some(poly => polygonNear(point,poly,margin))) {
    return {usable:false,point:null,code:'near-building',reason:
      'GPS is too close to a mapped building. Move to a clear outdoor area before routing.'};
  }
  return {usable:true,point,code:'ok',reason:
    'GPS is within the approximate mapped outdoor area; this is not proof of physical location.'};
}
