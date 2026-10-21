/**
 * Route geometry for the TomaSafe SVG preview (original 800 x 800 map coordinates).
 *
 * IMPORTANT: Dijkstra still determines which graph edges are walkable.
 * This module only builds ONE continuous visible stroke. When the user taps
 * between two graph nodes, its initial short connector begins exactly at the
 * displayed simulated-location marker, rather than at the snapped graph node.
 */
import type { GraphNode, Point } from './walkableGraph';

export type ContinuousRoute = {
  points: Point[];
  length: number;
};

const EPSILON = 0.001;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** One unbroken polyline across roads, covered walkways and open ground. */
export function buildContinuousRoute(
  graphRoute: GraphNode[],
  exactStart?: Point | null,
): ContinuousRoute {
  if (!graphRoute.length) return {points: [], length: 0};

  const first = exactStart ?? graphRoute[0];
  // Keep this first value EXACT: it is also the marker's center.
  const points: Point[] = [{x: first.x, y: first.y}];
  let length = 0;

  for (const graphNode of graphRoute) {
    const previous = points[points.length - 1];
    const next = {x: graphNode.x, y: graphNode.y};
    const segmentLength = distance(previous, next);
    if (segmentLength < EPSILON) continue;
    points.push(next);
    length += segmentLength;
  }
  return {points, length};
}

/**
 * Progressive line reveal. Operates on the Reanimated UI thread.
 * The entire route is one path, so corners have no overlapping end caps or gaps.
 */
export function revealPolyline(points: Point[], distanceVisible: number): string {
  'worklet';
  if (!points.length) return '';
  const first = points[0];
  let d = `M${first.x.toFixed(3)} ${first.y.toFixed(3)}`;
  let left = Math.max(0, distanceVisible);
  for (let i = 1; i < points.length && left > 0; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (segmentLength < 0.001) continue;
    const amount = Math.min(1, left / segmentLength);
    d += ` L${(a.x + (b.x - a.x) * amount).toFixed(3)} ${(a.y + (b.y - a.y) * amount).toFixed(3)}`;
    left -= segmentLength;
  }
  return d;
}
