import {
  WALKABLE_EDGES, WALKABLE_NODES, WALKABLE_NODES_BY_ID,
  type GraphNode,
} from './walkableGraph';

export type DijkstraPaths = {
  distances: Record<string, number>;
  previous: Record<string, string | null>;
};

const neighbors: Record<string, { id: string; weight: number }[]> = {};
for (const node of WALKABLE_NODES) neighbors[node.id] = [];
for (const edge of WALKABLE_EDGES) {
  if (!WALKABLE_NODES_BY_ID[edge.from] || !WALKABLE_NODES_BY_ID[edge.to] ||
      !Number.isFinite(edge.weight) || edge.weight <= 0) {
    throw new Error(`Invalid walkable graph edge ${edge.from} -> ${edge.to}`);
  }
  neighbors[edge.from].push({ id: edge.to, weight: edge.weight });
  neighbors[edge.to].push({ id: edge.from, weight: edge.weight });
}

// Priority queue keeps a full-campus grid practical on mobile (O(E log V)).
type Entry = { id: string; distance: number };
class MinHeap {
  private heap: Entry[] = [];
  get length() { return this.heap.length; }
  push(item: Entry) {
    const a = this.heap;
    let i = a.length;
    a.push(item);
    while (i > 0) {
      const p = (i - 1) >>> 1;
      if (a[p].distance <= item.distance) break;
      a[i] = a[p]; i = p;
    }
    a[i] = item;
  }
  pop(): Entry | undefined {
    const a = this.heap;
    if (!a.length) return undefined;
    const result = a[0];
    const last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (true) {
        const left = i * 2 + 1;
        if (left >= a.length) break;
        const right = left + 1;
        const c = right < a.length && a[right].distance < a[left].distance ? right : left;
        if (a[c].distance >= last.distance) break;
        a[i] = a[c]; i = c;
      }
      a[i] = last;
    }
    return result;
  }
}

/** Dijkstra across visually estimated open space AND user-edited roads. */
export function shortestPathsFromAnchors(anchors: {id: string; weight: number}[]): DijkstraPaths {
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  for (const node of WALKABLE_NODES) {
    distances[node.id] = Infinity;
    previous[node.id] = null;
  }
  const heap = new MinHeap();
  for (const {id, weight} of anchors) {
    if (!WALKABLE_NODES_BY_ID[id] || !Number.isFinite(weight) || weight < 0) continue;
    if (weight < distances[id]) {
      distances[id] = weight;
      previous[id] = null; // the start is a virtual point attached to this graph node
      heap.push({id, distance: weight});
    }
  }
  while (heap.length) {
    const current = heap.pop()!;
    if (current.distance > distances[current.id]) continue;
    for (const {id, weight} of neighbors[current.id]) {
      const candidate = current.distance + weight;
      if (candidate < distances[id]) {
        distances[id] = candidate;
        previous[id] = current.id;
        heap.push({id, distance: candidate});
      }
    }
  }
  return {distances, previous};
}

/** Ordinary node starts retain the original behavior. */
export function shortestPaths(startId: string): DijkstraPaths {
  return shortestPathsFromAnchors([{id:startId,weight:0}]);
}

export function reconstructPath(paths: DijkstraPaths, endId: string): GraphNode[] {
  if (!Number.isFinite(paths.distances[endId])) return [];
  const result: GraphNode[] = [];
  const seen = new Set<string>();
  for (let id: string | null = endId; id !== null; id = paths.previous[id]) {
    if (seen.has(id) || !WALKABLE_NODES_BY_ID[id]) return [];
    seen.add(id);
    result.push(WALKABLE_NODES_BY_ID[id]);
  }
  return result.reverse();
}
