import buildings from '../data/visualObstacles.json';
import type { Point } from './walkableGraph';

/**
 * APPROXIMATE calibration only. The bounds are from the existing campus project,
 * NOT a surveyed per-vertex SVG/GPS calibration. Never present this as a verified
 * determination of whether a user is physically indoors.
 */
export const CAMPUS_LIMITS = {
  north: 13.165857, south: 13.162422,
  west: 123.747844, east: 123.751555,
};
const MAX_ACCEPTED_ACCURACY_METERS = 18;
const BUILDING_CLEARANCE_MAP_UNITS = 9; // additional conservative buffer

export type OutdoorCheck =
  | { status: 'outside'; point: Point; detail: string }
  | { status: 'inside' | 'uncertain'; point: Point | null; detail: string };

export function gpsToMap(latitude: number, longitude: number): Point {
  return {
    x: ((longitude - CAMPUS_LIMITS.west) / (CAMPUS_LIMITS.east - CAMPUS_LIMITS.west)) * 800,
    y: ((CAMPUS_LIMITS.north - latitude) / (CAMPUS_LIMITS.north - CAMPUS_LIMITS.south)) * 800,
  };
}

function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx=b.x-a.x, dy=b.y-a.y;
  const len=dx*dx+dy*dy;
  const t=len===0?0:Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len));
  return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}

function nearOrInsidePolygon(point: Point, vertices: number[][], buffer = 0): boolean {
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a={x:vertices[i][0],y:vertices[i][1]}, b={x:vertices[j][0],y:vertices[j][1]};
    if(segmentDistance(point,a,b)<=buffer)return true;
    if((a.y>point.y)!==(b.y>point.y) &&
       point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}

/** Simulation check accepts a *manually placed* point; not proof of physical outdoors. */
export function checkSimulatedOutside(point: Point): OutdoorCheck {
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||
    point.x<0||point.x>800||point.y<0||point.y>800)
    return {status:'uncertain',point:null,detail:'The selected point is outside the mapped campus.'};
  if(buildings.some(b=>nearOrInsidePolygon(point,b.polygon)))
    return {status:'inside',point,detail:'The point overlaps a mapped building. Move it to an open outdoor location.'};
  return {status:'outside',point,detail:'This simulated point is not on a mapped roof. This is not a live safety check.'};
}

/**
 * Deliberately fails CLOSED when location is insufficient. These SVG building
 * footprints and approximate bounds must be field-calibrated before real use.
 */
export function evaluateOutdoorGps(
  latitude:number, longitude:number, accuracyMeters: number | null | undefined,
): OutdoorCheck {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))
    return {status:'uncertain',point:null,detail:'A valid device location was not available.'};
  const point=gpsToMap(latitude,longitude);
  if(point.x<0||point.x>800||point.y<0||point.y>800)
    return {status:'uncertain',point:null,detail:'Your location is outside the calibrated campus area.'};
  if(accuracyMeters==null||!Number.isFinite(accuracyMeters)||accuracyMeters>MAX_ACCEPTED_ACCURACY_METERS)
    return {status:'uncertain',point,detail:'GPS uncertainty is too high to assess building proximity. Try again outdoors.'};
  // Even with a good fix, the reported accuracy radius may overlap a building.
  // Approximate map scale: 800 units / (0.003435 degrees latitude × 111,000 m).
  const uncertaintyMapUnits=accuracyMeters*800/((CAMPUS_LIMITS.north-CAMPUS_LIMITS.south)*111000);
  const onRoof=buildings.some(b=>nearOrInsidePolygon(point,b.polygon));
  if(onRoof)return {status:'inside',point,detail:'Your reported location overlaps a mapped building. Outdoor routing is paused.'};
  const closeToRoof=buildings.some(b=>nearOrInsidePolygon(point,b.polygon,uncertaintyMapUnits+BUILDING_CLEARANCE_MAP_UNITS));
  if(closeToRoof)return {status:'uncertain',point,detail:'Your GPS uncertainty overlaps a nearby building. Move to a clear open area and try again.'};
  return {status:'outside',point,detail:'GPS appears clear of mapped building footprints. Confirm you are actually outside.'};
}
