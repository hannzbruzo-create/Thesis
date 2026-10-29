import combinedGraph from '../data/fullWalkableGraph.json';
export type Point = { x: number; y: number };
export type GraphNode = Point & { id: string; kind: 'road' | 'open' | 'covered' };
/** length in map units; wall = distance to the nearest building wall when closer than WALL_BUFFER. */
export type GraphEdge = { from: string; to: string; length: number; wall?: number };
export const WALKABLE_NODES = combinedGraph.nodes as GraphNode[];
export const WALKABLE_EDGES = combinedGraph.edges as GraphEdge[];
export const WALKABLE_NODES_BY_ID: Record<string, GraphNode> = Object.fromEntries(
  WALKABLE_NODES.map(node => [node.id, node])
);
export const WALKABLE_METADATA = combinedGraph.metadata;
