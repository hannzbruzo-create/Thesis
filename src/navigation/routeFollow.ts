import type { GraphNode, Point } from './walkableGraph';
import type { PreviewPlan } from './routePreview';

/**
 * Keeps the blue dot and the route steady while walking. While the (filtered) GPS position is
 * close to the current route, the dot is shown ON the route and the part already walked is
 * trimmed away, so the line shrinks smoothly instead of being recalculated on every jitter.
 * Only when the walker clearly leaves the route does a full reroute take over.
 */

/** Within this distance of the route the walker counts as following it (metres). */
export const ON_ROUTE_METRES = 8;
/** Once on the route, the walker must stray this far before counting as off it (hysteresis, so
 * the marker does not flip between snapped and free when GPS hovers around 8 m). */
export const STAY_ON_ROUTE_METRES = 12;
const METRES_PER_MAP_UNIT = 0.48;

export type RouteProgress = {
  /** Closest point on the route (map units). */
  snapped: Point;
  /** Distance from the GPS position to the route, metres. */
  offRouteMetres: number;
  /** Index of the route segment the walker is on. */
  segment: number;
  /** Distance along the route from its start to the snapped point, map units. */
  along: number;
  onRoute: boolean;
};

/**
 * Projects `p` onto the route. Searching starts at `fromSegment` (the last known progress) and
 * looks only a little behind it, so a route that doubles back never makes the dot jump backwards.
 */
export function routeProgress(route: Point[], p: Point, fromSegment = 0, wasOnRoute = false): RouteProgress | null {
  if (route.length < 2) return null;
  const limit = wasOnRoute ? STAY_ON_ROUTE_METRES : ON_ROUTE_METRES;
  let best: RouteProgress | null = null;
  let before = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (i >= fromSegment - 1) {
      const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
      const q = { x: a.x + t * dx, y: a.y + t * dy };
      const metres = Math.hypot(p.x - q.x, p.y - q.y) * METRES_PER_MAP_UNIT;
      if (!best || metres < best.offRouteMetres) {
        best = { snapped: q, offRouteMetres: metres, segment: i, along: before + t * Math.sqrt(l2), onRoute: metres <= limit };
      }
    }
    before += Math.sqrt(l2);
  }
  return best;
}

/** The plan as seen from the walker's progress: it starts at the dot and keeps the same destination. */
export function trimPlan(plan: PreviewPlan, progress: RouteProgress): PreviewPlan {
  const start: GraphNode = { id: 'SIM_TAP_ORIGIN', x: progress.snapped.x, y: progress.snapped.y, kind: 'open' };
  const rest = plan.route.slice(progress.segment + 1);
  return { ...plan, origin: progress.snapped, attachment: progress.snapped, route: [start, ...rest] };
}

/** Remaining walking distance along a route, metres. */
export function routeLengthMetres(route: Point[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
  return total * METRES_PER_MAP_UNIT;
}
