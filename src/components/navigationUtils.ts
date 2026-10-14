
//
// navigationUtils.ts
// TomaSafe — Outdoor Evacuation Pathfinding
//
// Coordinates are normalized from 0–100.
// Original UST SVG viewBox: 0 0 800 800.
//
// First graph:
// N2, N3, N4 = Building exits
// N5 = Evacuation Area 1 access
//

// ============================================
// TYPES
// ============================================

export type MapPoint = {
  x: number;
  y: number;
};

export type Node = MapPoint & {
  id: string;
  name: string;
  type:
    | 'exit'
    | 'walkway'
    | 'turn'
    | 'intersection'
    | 'evac-access';
  isExit?: boolean;
};

export type Edge = {
  from: string;
  to: string;
};

export type RouteResult =
  | {
      success: true;
      startNodeId: string;
      exitNodeId: string;
      exitName: string;
      evacuationAreaId: string;
      evacuationAreaName: string;
      destinationNodeId: string;
      distance: number;
      path: string[];
      points: MapPoint[];
      pathString: string;
    }
  | {
      success: false;
      message: string;
    };

// ============================================
// CAMPUS GPS BOUNDARIES
// ============================================

export const CAMPUS_LIMITS = {
  north: 13.165857,
  south: 13.162422,
  west: 123.747844,
  east: 123.751555,
};

// ============================================
// OUTDOOR GRAPH NODES
// ============================================

export const NODES: Record<string, Node> = {
  N2: {
    id: 'N2',
    name: 'Building Exit N2',
    x: 29.8613,
    y: 82.4775,
    type: 'exit',
    isExit: true,
  },

  N3: {
    id: 'N3',
    name: 'Building Exit N3',
    x: 32.4162,
    y: 82.5613,
    type: 'exit',
    isExit: true,
  },

  N4: {
    id: 'N4',
    name: 'Building Exit N4',
    x: 34.8612,
    y: 82.6162,
    type: 'exit',
    isExit: true,
  },

  N5: {
    id: 'N5',
    name: 'Evacuation Area 1 Access',
    x: 32.6112,
    y: 74.45,
    type: 'evac-access',
  },
};

// ============================================
// OUTDOOR GRAPH EDGES
// Bidirectional approved connections
// ============================================

export const EDGES: Edge[] = [
  { from: 'N2', to: 'N3' },
  { from: 'N3', to: 'N4' },
  { from: 'N3', to: 'N5' },
];

// ============================================
// EVACUATION DESTINATIONS
// ============================================

export const EVACUATION_TARGETS = {
  EVAC_AREA_1: {
    id: 'EVAC_AREA_1',
    name: 'Evacuation Area 1',
    accessNodeIds: ['N5'],
  },
};

// ============================================
// GPS TO MAP POSITION
// ============================================

export function gpsToMapPosition(
  latitude: number,
  longitude: number
) {
  const x =
    ((longitude - CAMPUS_LIMITS.west) /
      (CAMPUS_LIMITS.east - CAMPUS_LIMITS.west)) *
    100;

  const y =
    ((CAMPUS_LIMITS.north - latitude) /
      (CAMPUS_LIMITS.north - CAMPUS_LIMITS.south)) *
    100;

  const isInsideCampus =
    x >= 0 &&
    x <= 100 &&
    y >= 0 &&
    y <= 100;

  return {
    x,
    y,
    isInsideCampus,
  };
}

// ============================================
// MAP DISTANCE
// ============================================

export function getMapDistance(
  a: MapPoint,
  b: MapPoint
) {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y
  );
}

// ============================================
// MAP POSITION TO GPS
// ============================================

function mapPositionToGps(point: MapPoint) {
  const longitude =
    CAMPUS_LIMITS.west +
    (point.x / 100) *
      (CAMPUS_LIMITS.east - CAMPUS_LIMITS.west);

  const latitude =
    CAMPUS_LIMITS.north -
    (point.y / 100) *
      (CAMPUS_LIMITS.north - CAMPUS_LIMITS.south);

  return {
    latitude,
    longitude,
  };
}

// ============================================
// HAVERSINE DISTANCE (METERS)
// ============================================

export function getDistanceInMeters(
  a: MapPoint,
  b: MapPoint
) {
  const gpsA = mapPositionToGps(a);
  const gpsB = mapPositionToGps(b);

  const earthRadius = 6371000;

  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const lat1 = toRadians(gpsA.latitude);
  const lat2 = toRadians(gpsB.latitude);

  const deltaLat = toRadians(
    gpsB.latitude - gpsA.latitude
  );

  const deltaLon = toRadians(
    gpsB.longitude - gpsA.longitude
  );

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(haversine),
      Math.sqrt(1 - haversine)
    );

  return earthRadius * angularDistance;
}

// ============================================
// FIND NEAREST NODE
// ============================================

export function findNearestNode(
  point: MapPoint
) {
  let nearestNodeId: string | null = null;
  let nearestDistance = Infinity;

  for (const [nodeId, node] of Object.entries(NODES)) {
    const distance = getDistanceInMeters(
      point,
      node
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestNodeId = nodeId;
    }
  }

  return nearestNodeId;
}

// ============================================
// FIND NEAREST BUILDING EXIT
// Used as a temporary GPS-based start choice.
// ============================================

export function findNearestExitNode(
  point: MapPoint
) {
  let nearestExitId: string | null = null;
  let nearestDistance = Infinity;

  for (const [nodeId, node] of Object.entries(NODES)) {
    if (!node.isExit) {
      continue;
    }

    const distance = getDistanceInMeters(
      point,
      node
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestExitId = nodeId;
    }
  }

  return nearestExitId;
}

// ============================================
// GET CONNECTED NEIGHBORS
// ============================================

function getNeighbors(nodeId: string) {
  const currentNode = NODES[nodeId];

  if (!currentNode) {
    return [];
  }

  const neighbors: {
    id: string;
    distance: number;
  }[] = [];

  for (const edge of EDGES) {
    let neighborId: string | null = null;

    if (edge.from === nodeId) {
      neighborId = edge.to;
    } else if (edge.to === nodeId) {
      neighborId = edge.from;
    }

    if (!neighborId) {
      continue;
    }

    const neighborNode = NODES[neighborId];

    if (!neighborNode) {
      continue;
    }

    neighbors.push({
      id: neighborId,
      distance: getDistanceInMeters(
        currentNode,
        neighborNode
      ),
    });
  }

  return neighbors;
}

// ============================================
// DIJKSTRA SHORTEST PATH
// ============================================

function dijkstra(
  startNodeId: string,
  endNodeId: string
) {
  if (
    !NODES[startNodeId] ||
    !NODES[endNodeId]
  ) {
    return null;
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const unvisited = new Set(Object.keys(NODES));

  for (const nodeId of Object.keys(NODES)) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  }

  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let currentNodeId: string | null = null;
    let smallestDistance = Infinity;

    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDistance) {
        smallestDistance = distances[nodeId];
        currentNodeId = nodeId;
      }
    }

    if (
      currentNodeId === null ||
      !Number.isFinite(smallestDistance)
    ) {
      break;
    }

    if (currentNodeId === endNodeId) {
      break;
    }

    unvisited.delete(currentNodeId);

    for (const neighbor of getNeighbors(currentNodeId)) {
      if (!unvisited.has(neighbor.id)) {
        continue;
      }

      const candidateDistance =
        distances[currentNodeId] +
        neighbor.distance;

      if (
        candidateDistance <
        distances[neighbor.id]
      ) {
        distances[neighbor.id] =
          candidateDistance;

        previous[neighbor.id] =
          currentNodeId;
      }
    }
  }

  if (!Number.isFinite(distances[endNodeId])) {
    return null;
  }

  const path: string[] = [];
  let current: string | null = endNodeId;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path,
    distance: distances[endNodeId],
  };
}

// ============================================
// CALCULATE ROUTE FROM A KNOWN EXIT
// ============================================

export function calculateOutdoorRoute(
  startNodeId: string,
  evacuationAreaId: keyof typeof EVACUATION_TARGETS =
    'EVAC_AREA_1'
): RouteResult {
  const startNode = NODES[startNodeId];
  const target = EVACUATION_TARGETS[evacuationAreaId];

  if (!startNode?.isExit || !target) {
    return {
      success: false,
      message:
        'Invalid building exit or evacuation area.',
    };
  }

  let bestRoute:
    | {
        destinationNodeId: string;
        distance: number;
        path: string[];
      }
    | null = null;

  for (const destinationId of target.accessNodeIds) {
    const result = dijkstra(
      startNodeId,
      destinationId
    );

    if (!result) {
      continue;
    }

    if (
      bestRoute === null ||
      result.distance < bestRoute.distance
    ) {
      bestRoute = {
        destinationNodeId: destinationId,
        distance: result.distance,
        path: result.path,
      };
    }
  }

  if (!bestRoute) {
    return {
      success: false,
      message:
        'No approved connected route was found to the evacuation area.',
    };
  }

  // Start the route at the building exit.
  // Do not draw a straight line through a
  // building from an uncertain GPS point.

  const points: MapPoint[] = bestRoute.path.map(
    nodeId => ({
      x: NODES[nodeId].x,
      y: NODES[nodeId].y,
    })
  );

  return {
    success: true,

    startNodeId,

    // Kept for compatibility with index.tsx.
    exitNodeId: startNodeId,
    exitName: target.name,

    evacuationAreaId: target.id,
    evacuationAreaName: target.name,
    destinationNodeId: bestRoute.destinationNodeId,

    distance: bestRoute.distance,

    path: bestRoute.path,
    points,

    pathString: points
      .map(point => `${point.x},${point.y}`)
      .join(' '),
  };
}

// ============================================
// GPS-BASED START NODE (PROTOTYPE)
// ============================================

export function calculateShortestPath(
  userPosition: MapPoint
): RouteResult {
  if (
    Object.keys(NODES).length === 0 ||
    EDGES.length === 0
  ) {
    return {
      success: false,
      message:
        'Outdoor evacuation graph has not been mapped yet.',
    };
  }

  // For initial testing, use the nearest
  // mapped building exit as the route start.
  //
  // Before deployment, replace this automatic
  // choice with the user's confirmed exit
  // or an officially assigned exit.

  const startNodeId =
    findNearestExitNode(userPosition);

  if (!startNodeId) {
    return {
      success: false,
      message:
        'No mapped building exit is available.',
    };
  }

  return calculateOutdoorRoute(
    startNodeId,
    'EVAC_AREA_1'
  );
}

// ============================================
// LEGACY FUNCTION COMPATIBILITY
// ============================================

export function calculateNearestExit(
  userPosition: MapPoint
): RouteResult {
  return calculateShortestPath(userPosition);
}
