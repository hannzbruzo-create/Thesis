import graph from '../data/roadGraph.json';

export type Point = { x: number; y: number };
export type RoadNode = Point & { id: string };
export type RoadEdge = { from: string; to: string; weight: number };
export const ROAD_NODES = graph.nodes as RoadNode[];
export const ROAD_EDGES = graph.edges as RoadEdge[];
export const ROAD_NODES_BY_ID: Record<string, RoadNode> = Object.fromEntries(
  ROAD_NODES.map(n => [n.id, n])
);
/** Euclidean weight units = original 800×800 SVG units, NEVER metres. */
export const ROAD_GRAPH_UNITS = 'SVG units';
