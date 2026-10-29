import type { Point } from './walkableGraph';

const M = 0.48; // metres per map unit
/** Points closer than this (map units, ~5 m) are merged, so GPS-sized zigzags are not turns. */
const MIN_LEG = 10;
/** Bends gentler than this (degrees) count as straight; up to TURN_DEG they are "slight" turns. */
const SLIGHT_DEG = 30;
const TURN_DEG = 60;

export type DirectionKind = 'straight' | 'slight-left' | 'slight-right' | 'left' | 'right';

export type Instruction = {
  kind: DirectionKind;
  /** Metres to the turn (or to the goal when going straight). */
  metres: number;
  /** Short text for the on-map pill. */
  text: string;
  /** Full sentence for the voice. */
  spoken: string;
  /** Stable id of the turn (its map position), so each turn is announced only once per stage. */
  turnId: string;
};

const WORD: Record<Exclude<DirectionKind, 'straight'>, string> = {
  'slight-left': 'bear left', 'slight-right': 'bear right', left: 'turn left', right: 'turn right',
};

/** Rounded the way people say distances: to 5 m when close, to 10 m further away. */
export function sayMetres(m: number) {
  return m < 50 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10;
}

/**
 * The next thing the walker has to do along a route that starts at their position: the first
 * real bend ahead (left/right, with the distance to it), or "straight ahead" to the goal.
 */
export function nextInstruction(route: Point[], areaName: string): Instruction | null {
  if (route.length < 2) return null;
  // Drop points that are too close together (keep the start and the goal).
  const pts: Point[] = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const p = pts[pts.length - 1];
    if (Math.hypot(route[i].x - p.x, route[i].y - p.y) >= MIN_LEG) pts.push(route[i]);
  }
  pts.push(route[route.length - 1]);

  let along = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    along += Math.hypot(b.x - a.x, b.y - a.y);
    const ax = b.x - a.x, ay = b.y - a.y, bx = c.x - b.x, by = c.y - b.y;
    // Map y points down (south), so a positive cross product is a clockwise turn: right.
    const deg = (Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180) / Math.PI;
    if (Math.abs(deg) < SLIGHT_DEG) continue;
    const kind: DirectionKind = Math.abs(deg) < TURN_DEG ? (deg > 0 ? 'slight-right' : 'slight-left') : (deg > 0 ? 'right' : 'left');
    const metres = along * M;
    const word = WORD[kind];
    const now = metres < 8;
    const say = sayMetres(metres);
    return {
      kind, metres,
      text: now ? `${cap(word)} now` : `In ${say} m, ${word}`,
      spoken: now ? `${cap(word)} now.` : `In ${say} metres, ${word}.`,
      turnId: `${Math.round(b.x)},${Math.round(b.y)}`,
    };
  }
  along += Math.hypot(pts[pts.length - 1].x - pts[pts.length - 2].x, pts[pts.length - 1].y - pts[pts.length - 2].y);
  const metres = along * M;
  return {
    kind: 'straight', metres,
    text: `Straight ahead · ${sayMetres(metres)} m to ${areaName}`,
    spoken: `Walk straight ahead for ${sayMetres(metres)} metres to ${areaName}.`,
    turnId: 'goal',
  };
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
