import { EVACUATION_AREAS, type EvacuationArea } from '../data/evacuationAreas';
import visibleObstacles from '../data/visualObstacles.json';
import walkabilityEdits from '../data/walkabilityEdits.json';
import { shortestPathsFromAnchors, reconstructPath } from './dijkstra';
import { edgeWeight, profileFor, type RoutingProfile } from './routingProfiles';
import type { EmergencyType } from '../emergency/emergencyTypes';
import { WALKABLE_EDGES, WALKABLE_NODES, WALKABLE_NODES_BY_ID, type Point, type GraphNode } from './walkableGraph';

/** DEVELOPMENT SIMULATION ONLY. Not approved emergency routing. */
export const START_SNAP_LIMIT = 24;
export type PreviewPlan = {
  start: GraphNode;
  /** Actual tapped SVG coordinate. Also used by the displayed blue marker. */
  origin: Point;
  /** Snapped attachment point on a genuine graph edge, if available. */
  attachment: Point;
  end: GraphNode;
  area: EvacuationArea;
  route: GraphNode[];
  weightedDistance: number;
};
export type PreviewResult = { plan: PreviewPlan | null; message: string };
export type DestinationPreference = {
  /** Retain this evacuation area during a GPS near-tie, to prevent flip-flopping. */
  preferredAreaId?: string | null;
  /** New area must be this many weighted SVG units cheaper before switching. */
  switchMargin?: number;
  /** Emergency in progress; picks the routing profile (earthquake rules when unknown). */
  emergency?: EmergencyType | null;
};

function insidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    // Treat points on the boundary as inside.
    const cross = (point.x - b.x) * (a.y - b.y) - (point.y - b.y) * (a.x - b.x);
    if (Math.abs(cross) < 0.00001 &&
        point.x >= Math.min(a.x,b.x) && point.x <= Math.max(a.x,b.x) &&
        point.y >= Math.min(a.y,b.y) && point.y <= Math.max(a.y,b.y)) return true;
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
  }
  return inside;
}

type Box = {x0:number; y0:number; x1:number; y1:number};
const boxOf = (poly: Point[]): Box => ({x0:Math.min(...poly.map(p=>p.x)), y0:Math.min(...poly.map(p=>p.y)),
  x1:Math.max(...poly.map(p=>p.x)), y1:Math.max(...poly.map(p=>p.y))});
const inBox = (p: Point, b: Box, pad = 0) => p.x >= b.x0-pad && p.x <= b.x1+pad && p.y >= b.y0-pad && p.y <= b.y1+pad;
// Building footprints and water (generated from the 3D map by tools/build-walkable-graph.cjs).
const obstacles: { id:string; polygon: Point[]; box: Box }[] = visibleObstacles.map(item => {
  const polygon = item.polygon.map(pair => ({x:pair[0],y:pair[1]}));
  return {id: item.id, polygon, box: boxOf(polygon)};
});
type Zone = {type:string; width?:number; points:{x:number;y:number}[]};
const manualZones:Zone[] = walkabilityEdits.zones as Zone[];
function pointNearSegment(p:Point,a:Point,b:Point,radius:number):boolean {
  const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
  const t=length2?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length2)):0;
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))<=radius;
}
function insideZone(point:Point,z:Zone):boolean {
  if(z.type==='covered'||z.type==='walk'){
    for(let i=1;i<z.points.length;i++)if(pointNearSegment(point,z.points[i-1],z.points[i],Math.max(1,z.width??14)/2))return true;
    return false;
  }
  return z.points.length>=3&&insidePolygon(point,z.points);
}
function isKnownObstacle(point: Point): boolean {
  // Explicit building/restricted footprints outrank every walkable override.
  if(manualZones.some(z=>(z.type==='blocked'||z.type==='restricted')&&insideZone(point,z)))return true;
  if(manualZones.some(z=>(z.type==='covered'||z.type==='walk'||z.type==='field')&&insideZone(point,z)))return false;
  return obstacles.some(obstacle => inBox(point, obstacle.box) && insidePolygon(point, obstacle.polygon));
}

/** Distance from a point to the nearest building/water edge, if closer than `limit`. */
function obstacleDistance(point: Point, limit: number): number {
  let best = Infinity;
  for (const o of obstacles) {
    if (!inBox(point, o.box, limit)) continue;
    const p = o.polygon;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[j], b = p[i], dx = b.x-a.x, dy = b.y-a.y, l2 = dx*dx+dy*dy;
      const t = l2 ? Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/l2)) : 0;
      best = Math.min(best, Math.hypot(point.x-a.x-t*dx, point.y-a.y-t*dy));
    }
  }
  return best;
}

/**
 * Spatial index: graph edges and nodes bucketed into 32-unit cells, so each GPS update only
 * examines nearby graph elements instead of every link on campus.
 */
const CELL = 32;
const cellKey = (cx: number, cy: number) => cx * 4096 + cy;
const edgeBuckets = new Map<number, typeof WALKABLE_EDGES>();
const nodeBuckets = new Map<number, GraphNode[]>();
for (const edge of WALKABLE_EDGES) {
  const a = WALKABLE_NODES_BY_ID[edge.from], b = WALKABLE_NODES_BY_ID[edge.to];
  if (!a || !b) continue;
  for (let cx = Math.floor(Math.min(a.x,b.x)/CELL); cx <= Math.floor(Math.max(a.x,b.x)/CELL); cx++)
    for (let cy = Math.floor(Math.min(a.y,b.y)/CELL); cy <= Math.floor(Math.max(a.y,b.y)/CELL); cy++) {
      const k = cellKey(cx, cy);
      const list = edgeBuckets.get(k); if (list) list.push(edge); else edgeBuckets.set(k, [edge]);
    }
}
for (const node of WALKABLE_NODES) {
  const k = cellKey(Math.floor(node.x/CELL), Math.floor(node.y/CELL));
  const list = nodeBuckets.get(k); if (list) list.push(node); else nodeBuckets.set(k, [node]);
}
function nearbyEdges(p: Point, radius: number) {
  const out = new Set<(typeof WALKABLE_EDGES)[number]>();
  for (let cx = Math.floor((p.x-radius)/CELL); cx <= Math.floor((p.x+radius)/CELL); cx++)
    for (let cy = Math.floor((p.y-radius)/CELL); cy <= Math.floor((p.y+radius)/CELL); cy++)
      for (const e of edgeBuckets.get(cellKey(cx, cy)) ?? []) out.add(e);
  return [...out];
}
function nearbyNodes(p: Point, radius: number): GraphNode[] {
  const out: GraphNode[] = [];
  for (let cx = Math.floor((p.x-radius)/CELL); cx <= Math.floor((p.x+radius)/CELL); cx++)
    for (let cy = Math.floor((p.y-radius)/CELL); cy <= Math.floor((p.y+radius)/CELL); cy++)
      for (const n of nodeBuckets.get(cellKey(cx, cy)) ?? []) out.push(n);
  return out;
}

/**
 * If a simulated tap is close to an existing road or covered walkway, prefer
 * its centerline over a nearby open-grid node. This prevents a tap ON a road
 * from silently starting one grid cell to the side.
 *
 * This only affects the simulated start-node choice: Dijkstra still decides
 * whether to travel via road, covered passage, or open ground.
 */
const PATH_TAP_RADIUS = 7; // 800x800 SVG units, not metres
const isPathEdge = (edge: (typeof WALKABLE_EDGES)[number]) => {
  const a = WALKABLE_NODES_BY_ID[edge.from];
  const b = WALKABLE_NODES_BY_ID[edge.to];
  return !!a && !!b && a.kind === b.kind && (a.kind === 'road' || a.kind === 'covered');
};

/** Tapping an obstacle must NOT silently snap to the outside. */
export function snapPreviewStart(point: Point): { node: GraphNode | null; distance: number; blocked: boolean; onPath: boolean } {
  if (isKnownObstacle(point)) return {node: null, distance: Infinity, blocked: true, onPath: false};

  let preferred: GraphNode | null = null;
  let closestCenterline = PATH_TAP_RADIUS;
  for (const edge of nearbyEdges(point, PATH_TAP_RADIUS)) {
    if (!isPathEdge(edge)) continue;
    const a = WALKABLE_NODES_BY_ID[edge.from];
    const b = WALKABLE_NODES_BY_ID[edge.to];
    const dx = b.x - a.x, dy = b.y - a.y;
    const squaredLength = dx * dx + dy * dy;
    const t = squaredLength === 0 ? 0 : Math.max(0, Math.min(1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / squaredLength));
    const px = a.x + t * dx, py = a.y + t * dy;
    const centerlineDistance = Math.hypot(point.x - px, point.y - py);
    if (centerlineDistance > closestCenterline) continue;
    const endpoint = Math.hypot(point.x - a.x, point.y - a.y) <=
      Math.hypot(point.x - b.x, point.y - b.y) ? a : b;
    if (centerlineDistance < closestCenterline && clearStraightConnection(point, endpoint)) {
      closestCenterline = centerlineDistance;
      preferred = endpoint;
    }
  }
  if (preferred) {
    const distance = Math.hypot(point.x - preferred.x, point.y - preferred.y);
    if (distance <= START_SNAP_LIMIT) return {node: preferred, distance, blocked: false, onPath: closestCenterline <= 5};
  }

  let nearest: GraphNode | null = null;
  let distance = Infinity;
  for (const node of nearbyNodes(point, START_SNAP_LIMIT)) {
    const d = Math.hypot(node.x - point.x, node.y - point.y);
    if (d < distance && d <= START_SNAP_LIMIT && clearStraightConnection(point, node)) { nearest = node; distance = d; }
  }
  return {node: distance <= START_SNAP_LIMIT ? nearest : null, distance, blocked: false, onPath: false};
}

/** A short connector must not cut through a blocked building or leave the evacuation area. */
function clearStraightConnection(from: Point, to: Point, within?: Point[]): boolean {
  const length = Math.hypot(to.x-from.x, to.y-from.y);
  const samples = Math.max(2, Math.ceil(length / 2));
  for (let i=0; i<=samples; i++) {
    const t=i/samples;
    const p={x:from.x+(to.x-from.x)*t, y:from.y+(to.y-from.y)*t};
    if (isKnownObstacle(p) || (within && !insidePolygon(p, within))) return false;
  }
  return true;
}

/** Shoelace centroid: for rectangles this is the literal middle of the polygon. */
function polygonCenter(poly: Point[]): Point {
  let twiceArea=0, x=0, y=0;
  for(let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    const cross=a.x*b.y-b.x*a.y;
    twiceArea+=cross; x+=(a.x+b.x)*cross; y+=(a.y+b.y)*cross;
  }
  if (Math.abs(twiceArea)>0.00001) return {x:x/(3*twiceArea),y:y/(3*twiceArea)};
  return {x:poly.reduce((sum,p)=>sum+p.x,0)/poly.length,
    y:poly.reduce((sum,p)=>sum+p.y,0)/poly.length};
}

// Evacuation polygons are stored in 0-100 percentages; graph positions in 0-800 SVG units.
const areaEndpoints = EVACUATION_AREAS.map(area => {
  const polygon=area.polygon.map(p => ({x:p.x*8,y:p.y*8}));
  const nodes=WALKABLE_NODES.filter(n => insidePolygon(n,polygon));
  const middle=polygonCenter(polygon);
  // If the mathematical center is blocked or lies outside a concave shape,
  // use an existing safe node as the marker instead of showing an impossible route.
  const center=insidePolygon(middle,polygon) && !isKnownObstacle(middle)
    ? middle
    : (nodes.filter(n=>!isKnownObstacle(n)).sort((a,b)=>
        Math.hypot(a.x-middle.x,a.y-middle.y)-Math.hypot(b.x-middle.x,b.y-middle.y))[0] ?? null);
  return {area,polygon,nodes,center,enclosure:enclosureOf(polygon)};
});

/** How boxed-in an area is: share of points on a ring ~6 m outside it that fall in buildings (0-1). */
function enclosureOf(polygon: Point[]): number {
  const ccw = polygon.reduce((s, p, i) => { const q = polygon[(i+1)%polygon.length]; return s + p.x*q.y - q.x*p.y; }, 0) > 0;
  let total = 0, walled = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i+1)%polygon.length], len = Math.hypot(b.x-a.x, b.y-a.y);
    if (len < 1e-6) continue;
    // Outward normal (map y grows downward).
    const nx = (ccw ? 1 : -1) * (b.y-a.y)/len, ny = (ccw ? -1 : 1) * (b.x-a.x)/len;
    for (let s = 2; s < len; s += 4) {
      const p = {x:a.x+(b.x-a.x)*s/len+nx*12, y:a.y+(b.y-a.y)*s/len+ny*12};
      total++;
      if (obstacles.some(o => !o.id.startsWith('water') && inBox(p, o.box) && insidePolygon(p, o.polygon))) walled++;
    }
  }
  return total ? walled/total : 0;
}

/** Keeps shortcuts at least ~1.4 m from walls, in line with the graph's wall buffer. */
const SMOOTH_CLEARANCE = 3;
const SMOOTH_LOOKAHEAD = 40;
function clearWithMargin(from: Point, to: Point): boolean {
  const length = Math.hypot(to.x-from.x, to.y-from.y);
  const samples = Math.max(2, Math.ceil(length));
  for (let i = 0; i <= samples; i++) {
    const t = i/samples;
    const p = {x:from.x+(to.x-from.x)*t, y:from.y+(to.y-from.y)*t};
    if (isKnownObstacle(p) || obstacleDistance(p, SMOOTH_CLEARANCE) < SMOOTH_CLEARANCE) return false;
  }
  return true;
}
/**
 * Removes grid corners: from each point, jump to the farthest later point that can be reached
 * in a straight, clear line. The route keeps Dijkstra's choice of corridor and destination
 * but looks like how people actually walk.
 */
function smoothRoute(route: GraphNode[]): GraphNode[] {
  if (route.length <= 2) return route;
  const out: GraphNode[] = [route[0]];
  let i = 0;
  while (i < route.length - 1) {
    let j = i + 1;
    // The start leg (exact position -> graph) was already checked; only shortcut later legs.
    while (j + 1 < route.length && j + 1 - i <= SMOOTH_LOOKAHEAD && i > 0 && clearWithMargin(route[i], route[j + 1])) j++;
    if (i === 0) j = 1;
    out.push(route[j]);
    i = j;
  }
  return out;
}

type Attachment = {position: Point; connections: {id:string;weight:number}[]};
/**
 * Connect a user-selected point to the actual EDGE of the navigation graph,
 * rather than silently replacing it with a nearby node. The projected point
 * can lie between road nodes, so the visible path starts precisely where tapped
 * and follows the edge toward whichever end Dijkstra determines is shortest.
 */
function findAttachment(tap:Point, fallbackNodeId:string, profile:RoutingProfile):Attachment | null {
  const fallback = WALKABLE_NODES_BY_ID[fallbackNodeId];
  if (!fallback || isKnownObstacle(tap)) return null;
  type Match = {edge: (typeof WALKABLE_EDGES)[number]; position:Point; t:number; gap:number; score:number};
  let best:Match|null = null;
  for (const edge of nearbyEdges(tap, START_SNAP_LIMIT)) {
    const a=WALKABLE_NODES_BY_ID[edge.from], b=WALKABLE_NODES_BY_ID[edge.to];
    if (!a || !b) continue;
    const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy;
    if(len2<0.00001)continue;
    const t=Math.max(0,Math.min(1,((tap.x-a.x)*dx+(tap.y-a.y)*dy)/len2));
    const position={x:a.x+t*dx,y:a.y+t*dy};
    const gap=Math.hypot(tap.x-position.x,tap.y-position.y);
    if(gap>START_SNAP_LIMIT || !clearStraightConnection(tap,position))continue;
    // Road or covered paths are preferred near the tap without forcing distant detours.
    const isPath=(a.kind==='road'&&b.kind==='road') || (a.kind==='covered'&&b.kind==='covered');
    const score=gap-(isPath&&gap<=7?2:0);
    if (!best || score<best.score) best={edge,position,t,gap,score};
  }
  if (best) {
    const gapCost=best.gap*profile.costs.open;
    const weight=edgeWeight(best.edge,WALKABLE_NODES_BY_ID[best.edge.from],WALKABLE_NODES_BY_ID[best.edge.to],profile);
    return {position:best.position,connections:[
      {id:best.edge.from,weight:gapCost+weight*best.t},
      {id:best.edge.to,weight:gapCost+weight*(1-best.t)},
    ]};
  }
  // A start next to an isolated node is still supported, if unobstructed.
  if(Math.hypot(tap.x-fallback.x,tap.y-fallback.y)<=START_SNAP_LIMIT &&
     clearStraightConnection(tap,fallback)){
    return {position:{x:fallback.x,y:fallback.y},connections:[
      {id:fallback.id,weight:Math.hypot(tap.x-fallback.x,tap.y-fallback.y)*1.6},
    ]};
  }
  return null;
}

/**
 * Dijkstra chooses the cheapest REACHABLE evacuation area (by the cost of entering it); the
 * route then continues inside the area to its exact middle, where the goal marker stands.
 *
 */
export function calculatePreview(startId: string, exactTap?: Point | null, preference?: DestinationPreference): PreviewResult {
  if (!WALKABLE_NODES_BY_ID[startId]) return {plan:null, message:'Choose a start point on walkable ground.'};
  const origin = exactTap ? {x:exactTap.x,y:exactTap.y} :
    {x:WALKABLE_NODES_BY_ID[startId].x,y:WALKABLE_NODES_BY_ID[startId].y};
  const profile=profileFor(preference?.emergency);
  const attachment=findAttachment(origin,startId,profile);
  if(!attachment)return {plan:null,message:'No safe connection from the selected location to the walkable graph.'};
  const paths=shortestPathsFromAnchors(attachment.connections,profile);
  // Every result begins at the user's exact touch coordinate (one source of truth).
  // The second point is the projected position ON the graph edge. Dijkstra then
  // chooses which endpoint to continue from; these are real graph connections.
  const prefix:GraphNode[]=[{id:'SIM_TAP_ORIGIN',x:origin.x,y:origin.y,kind:'open'}];
  if(Math.hypot(attachment.position.x-origin.x,attachment.position.y-origin.y)>0.001)
    prefix.push({id:'SIM_EDGE_ATTACHMENT',x:attachment.position.x,y:attachment.position.y,kind:'open'});
  return finishRoute(paths,prefix,WALKABLE_NODES_BY_ID[startId],origin,attachment.position,profile,preference);
}

/** Picks the evacuation area from a finished Dijkstra search and builds the route to its middle. */
function finishRoute(paths: ReturnType<typeof shortestPathsFromAnchors>, prefix: GraphNode[], startNode: GraphNode,
  origin: Point, attachmentPoint: Point, profile: RoutingProfile, preference?: DestinationPreference): PreviewResult {
  type Candidate = {area:EvacuationArea; node:GraphNode; distance:number};
  let best: Candidate | null=null;
  let preferred: Candidate | null=null;
  for(const entry of areaEndpoints) {
    for(const node of entry.nodes) {
      const reach=paths.distances[node.id];
      if(!Number.isFinite(reach))continue;
      // Earthquake: an area boxed in by buildings is less preferred than open ground.
      const total=reach+profile.enclosedAreaPenalty*entry.enclosure;
      const candidate={area:entry.area,node,distance:total};
      if(!best || total<best.distance) best=candidate;
      if(entry.area.id===preference?.preferredAreaId && (!preferred || total<preferred.distance))
        preferred=candidate;
    }
  }
  if(!best)return {plan:null,message:'No walkable connection to the center of a mapped evacuation area. Check your polygon, obstacle and pathway edits.'};
  // Hysteresis: retain a still-reachable destination if the new one wins only
  // by a small amount (normally caused by GPS jitter near equal-cost areas).
  if (preferred && preferred.area.id !== best.area.id &&
      preferred.distance - best.distance <= Math.max(0, preference?.switchMargin ?? 0)) {
    best = preferred;
  }
  // The area is chosen by the cost of reaching it, but the route continues inside it to its
  // exact middle (the assembly point): via the reachable graph point nearest the centre, then
  // a straight, clear line to the centre itself.
  const entry=areaEndpoints.find(e=>e.area.id===best!.area.id)!;
  const centre=entry.center;
  const target=centre
    ? entry.nodes.filter(n=>Number.isFinite(paths.distances[n.id]))
        .sort((a,b)=>Math.hypot(a.x-centre.x,a.y-centre.y)-Math.hypot(b.x-centre.x,b.y-centre.y))[0] ?? best.node
    : best.node;
  const graphRoute=reconstructPath(paths,target.id);
  if(!graphRoute.length)return {plan:null,message:'Could not reconstruct the simulated path.'};
  const route:GraphNode[]=[...prefix,...graphRoute];
  const toCentre=!!centre && clearStraightConnection(target,centre,entry.polygon);
  const endPoint=toCentre ? centre! : target;
  const end:GraphNode={id:`DESTINATION_${best.area.id}`,x:endPoint.x,y:endPoint.y,kind:'open'};
  if(toCentre && Math.hypot(target.x-end.x,target.y-end.y)>0.001) route.push(end);
  else route[route.length-1]=end;
  return {
    plan:{start:startNode,origin,attachment:attachmentPoint,end,area:best.area,
      route:smoothRoute(route),weightedDistance:best.distance},
    message:'DEVELOPMENT PREVIEW: access is inferred; covered paths and safe assembly points must be verified on campus.',
  };
}

// ---------------------------------------------------------------------------
// Live GPS entry point. Navigation is outdoor-only: people inside a building are told by SMS /
// push notification to go outside first (campusGps screens out positions inside buildings), and
// routing starts once they are outdoors.

/** Graph point nearest to `p` (used when the exact start cannot attach to a link). */
function nearestOutdoorNode(p: Point, radius = 60): GraphNode | null {
  let best: GraphNode | null = null, d = Infinity;
  for (const n of nearbyNodes(p, radius)) {
    const dn = Math.hypot(n.x-p.x, n.y-p.y);
    if (dn < d) { d = dn; best = n; }
  }
  return best;
}

/** Nearest evacuation area by walking cost from an outdoor position. */
export function planEvacuation(point: Point, preference: DestinationPreference = {}): PreviewResult {
  const snap = snapPreviewStart(point);
  const node = snap.node ?? (snap.blocked ? null : nearestOutdoorNode(point));
  if (!node) return {plan:null, message:snap.blocked ? 'Go outside the building first; navigation starts outdoors.' : 'No walkable ground nearby.'};
  return calculatePreview(node.id, snap.node ? point : {x:node.x, y:node.y}, preference);
}
