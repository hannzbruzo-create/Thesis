import { EVACUATION_AREAS, type EvacuationArea } from '../data/evacuationAreas';
import visibleObstacles from '../data/visualObstacles.json';
import walkabilityEdits from '../data/walkabilityEdits.json';
import { shortestPathsFromAnchors, reconstructPath } from './dijkstra';
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

const obstacles: { id:string; polygon: Point[] }[] = visibleObstacles.map(item => ({
  id: item.id, polygon: item.polygon.map(pair => ({x:pair[0],y:pair[1]}))
}));
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
  return obstacles.some(obstacle => insidePolygon(point, obstacle.polygon));
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
const preferredPathEdges = WALKABLE_EDGES.filter(edge => {
  const a = WALKABLE_NODES_BY_ID[edge.from];
  const b = WALKABLE_NODES_BY_ID[edge.to];
  return a && b && a.kind === b.kind && (a.kind === 'road' || a.kind === 'covered');
});

/** Tapping an obstacle must NOT silently snap to the outside. */
export function snapPreviewStart(point: Point): { node: GraphNode | null; distance: number; blocked: boolean; onPath: boolean } {
  if (isKnownObstacle(point)) return {node: null, distance: Infinity, blocked: true, onPath: false};

  let preferred: GraphNode | null = null;
  let closestCenterline = PATH_TAP_RADIUS;
  for (const edge of preferredPathEdges) {
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
  for (const node of WALKABLE_NODES) {
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
  return {area,polygon,nodes,center};
});

type Attachment = {position: Point; connections: {id:string;weight:number}[]};
/**
 * Connect a user-selected point to the actual EDGE of the navigation graph,
 * rather than silently replacing it with a nearby node. The projected point
 * can lie between road nodes, so the visible path starts precisely where tapped
 * and follows the edge toward whichever end Dijkstra determines is shortest.
 */
function findAttachment(tap:Point, fallbackNodeId:string):Attachment | null {
  const fallback = WALKABLE_NODES_BY_ID[fallbackNodeId];
  if (!fallback || isKnownObstacle(tap)) return null;
  type Match = {edge: (typeof WALKABLE_EDGES)[number]; position:Point; t:number; gap:number; score:number};
  let best:Match|null = null;
  for (const edge of WALKABLE_EDGES) {
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
    const gapCost=best.gap*1.6;
    return {position:best.position,connections:[
      {id:best.edge.from,weight:gapCost+best.edge.weight*best.t},
      {id:best.edge.to,weight:gapCost+best.edge.weight*(1-best.t)},
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

/** Dijkstra chooses the cheapest REACHABLE route to the center of each evacuation area.
 * A final connection to the exact center is only allowed if the entire segment
 * stays in walkable space INSIDE that evacuation polygon.
 */
export function calculatePreview(startId: string, exactTap?: Point | null, preference?: DestinationPreference): PreviewResult {
  if (!WALKABLE_NODES_BY_ID[startId]) return {plan:null, message:'Choose a start point on walkable ground.'};
  const origin = exactTap ? {x:exactTap.x,y:exactTap.y} :
    {x:WALKABLE_NODES_BY_ID[startId].x,y:WALKABLE_NODES_BY_ID[startId].y};
  const attachment=findAttachment(origin,startId);
  if(!attachment)return {plan:null,message:'No safe connection from the selected location to the walkable graph.'};
  const paths=shortestPathsFromAnchors(attachment.connections);
  const centerCostMultiplier=1.6; // open-field routing cost; SVG units, not metres
  type Candidate = {area:EvacuationArea; node:GraphNode; center:Point; distance:number};
  let best: Candidate | null=null;
  let preferred: Candidate | null=null;
  for(const entry of areaEndpoints) {
    if(!entry.center)continue;
    for(const node of entry.nodes) {
      const roadDistance=paths.distances[node.id];
      if(!Number.isFinite(roadDistance))continue;
      if(!clearStraightConnection(node,entry.center,entry.polygon))continue;
      const connectorDistance=Math.hypot(entry.center.x-node.x,entry.center.y-node.y);
      const total=roadDistance+connectorDistance*centerCostMultiplier;
      const candidate={area:entry.area,node,center:entry.center,distance:total};
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
  const graphRoute=reconstructPath(paths,best.node.id);
  if(!graphRoute.length)return {plan:null,message:'Could not reconstruct the simulated path.'};
  // Every result begins at the user's exact touch coordinate (one source of truth).
  // The second point is the projected position ON the graph edge. Dijkstra then
  // chooses which endpoint to continue from; these are real graph connections.
  const route:GraphNode[]=[{id:'SIM_TAP_ORIGIN',x:origin.x,y:origin.y,kind:'open'}];
  if(Math.hypot(attachment.position.x-origin.x,attachment.position.y-origin.y)>0.001)
    route.push({id:'SIM_EDGE_ATTACHMENT',x:attachment.position.x,y:attachment.position.y,kind:'open'});
  route.push(...graphRoute);
  // A display-only final node is safe because its preceding straight connection
  // has been checked against BOTH the obstacle mask and the area boundary.
  const end:GraphNode={id:`DESTINATION_${best.area.id}`,
    x:best.center.x,y:best.center.y,kind:'open'};
  if(Math.hypot(best.node.x-end.x,best.node.y-end.y)>0.001)route.push(end);
  return {
    plan:{start:WALKABLE_NODES_BY_ID[startId],origin,attachment:attachment.position,end,area:best.area,
      route,weightedDistance:best.distance},
    message:'DEVELOPMENT PREVIEW: access is inferred; covered paths and safe assembly points must be verified on campus.',
  };
}
