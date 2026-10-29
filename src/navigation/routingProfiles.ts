import type { EmergencyType } from '../emergency/emergencyTypes';
import type { GraphEdge, GraphNode } from './walkableGraph';

/**
 * How routes are weighed for each emergency. Costs multiply a link's length, so they are
 * generalized preferences, not metres or minutes. Both emergencies use the same evacuation areas.
 *
 * - Earthquake: falling glass/tiles and aftershocks are the main risk, so links near building
 *   walls cost up to double, covered walkways are usable but less preferred, and evacuation
 *   areas enclosed by buildings are less preferred.
 * - Fire: getting out quickly matters most, so the wall buffer is light; smoke collects under
 *   roofs, so covered walkways are used only when there is no other way.
 */
export type RoutingProfile = {
  id: EmergencyType;
  /** Cost per unit length by link type (node kinds at each end). */
  costs: { road: number; covered: number; open: number; roadToOpen: number; coveredToOpen: number; roadToCovered: number };
  /** Extra cost right at a wall (1 = double), fading to none at WALL_BUFFER. */
  wallPenalty: number;
  /** Added to an area's route cost when it is fully surrounded by buildings (scaled by how enclosed it is). */
  enclosedAreaPenalty: number;
};

/** Links closer than this to a building wall carry their wall distance (5 m in map units). */
export const WALL_BUFFER = 5 / 0.48;

export const ROUTING_PROFILES: Record<EmergencyType, RoutingProfile> = {
  earthquake: {
    id: 'earthquake',
    costs: { road: 1.0, covered: 1.3, open: 1.6, roadToOpen: 1.18, coveredToOpen: 1.3, roadToCovered: 1.3 },
    wallPenalty: 1.0,
    enclosedAreaPenalty: 80,
  },
  fire: {
    id: 'fire',
    costs: { road: 1.0, covered: 4.0, open: 1.45, roadToOpen: 1.12, coveredToOpen: 4.0, roadToCovered: 4.0 },
    wallPenalty: 0.2,
    enclosedAreaPenalty: 0,
  },
};

/** Used when no emergency type is known yet (the stricter, earthquake rules). */
export const DEFAULT_PROFILE = ROUTING_PROFILES.earthquake;

export function profileFor(type: EmergencyType | null | undefined): RoutingProfile {
  return (type && ROUTING_PROFILES[type]) || DEFAULT_PROFILE;
}

function kindCost(profile: RoutingProfile, a: GraphNode['kind'], b: GraphNode['kind']): number {
  const c = profile.costs;
  if (a === b) return c[a];
  const pair = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (pair === 'open-road') return c.roadToOpen;
  if (pair === 'covered-open') return c.coveredToOpen;
  return c.roadToCovered; // covered-road
}

export function edgeWeight(edge: GraphEdge, a: GraphNode, b: GraphNode, profile: RoutingProfile): number {
  const wall = edge.wall != null ? 1 + profile.wallPenalty * (1 - Math.min(edge.wall, WALL_BUFFER) / WALL_BUFFER) : 1;
  return edge.length * kindCost(profile, a.kind, b.kind) * wall;
}
