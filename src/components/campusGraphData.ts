/**
 * TomaSafe Campus Graph — 800×800 source coordinate system.
 * Updated with the new node survey. Older node IDs appearing in the new
 * submission are REPLACED by the latest coordinates (no duplicate IDs).
 *
 * - SUBMITTED_NODES_PIXELS: node-builder coordinates (0–800).
 * - CAMPUS_NODES / NODES: normalized 0–100 coordinates for navigationUtils.
 * - SUBMITTED_EDGES: retained safe historical edges plus ALL new connections.
 * - PATHWAY_EDGES / EDGES: excludes all edges touching evac-boundary nodes.
 * - Polygon corner nodes are NOT exits or walkable pathways.
 *
 * This file stores the graph. navigationUtils.ts does not use it until imported.
 */

export const SOURCE_MAP_SIZE = 800;
export type CampusNodeType = 'hallway' | 'exit' | 'evac-boundary' | 'evac-access';
export type CampusNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  type: CampusNodeType;
  isExit?: boolean;
  areaId?: string;
};
export type CampusEdge = { from: string; to: string };

// Keep exact SVG map coordinates from the node builder here.
export const SUBMITTED_NODES_PIXELS = {
  "N1": { x: 363.08, y: 627.29, name: "N1", type: 'hallway' },
  "N2": { x: 320.75, y: 594.29, name: "N2", type: 'hallway' },
  "N3": { x: 462.75, y: 672.96, name: "N3", type: 'hallway' },
  "N5": { x: 366.76, y: 548.08, name: "N5", type: 'exit', isExit: true },
  "N6": { x: 418.75, y: 611.63, name: "N6", type: 'hallway' },
  "N7": { x: 414.56, y: 550.48, name: "N7", type: 'exit', isExit: true },
  "N8": { x: 439.36, y: 551.08, name: "N8", type: 'exit', isExit: true },
  "N10": { x: 463.8, y: 552.23, name: "N10", type: 'exit', isExit: true },
  "N12": { x: 487.72, y: 555.24, name: "N12", type: 'exit', isExit: true },
  "N13": { x: 514.25, y: 555.44, name: "N13", type: 'exit', isExit: true },
  "N14": { x: 540.62, y: 557.51, name: "N14", type: 'exit', isExit: true },
  "N15": { x: 571.73, y: 558.1, name: "N15", type: 'exit', isExit: true },
  "N22": { x: 596.17, y: 558.95, name: "N22", type: 'exit', isExit: true },
  "N23": { x: 596.17, y: 548.47, name: "N23", type: 'hallway' },
  "N24": { x: 488.68, y: 545.3, name: "N24", type: 'hallway' },
  "N25": { x: 324.53, y: 538.79, name: "N25", type: 'evac-boundary' },
  "N26": { x: 463.79, y: 543.23, name: "N26", type: 'hallway' },
  "N27": { x: 476.08, y: 536.7, name: "N27", type: 'evac-boundary' },
  "N28": { x: 439.8, y: 542.54, name: "N28", type: 'hallway' },
  "N29": { x: 324.63, y: 543.02, name: "N29", type: 'hallway' },
  "N30": { x: 392.14, y: 540.71, name: "N30", type: 'hallway' },
  "N32": { x: 514.66, y: 546.43, name: "N32", type: 'hallway' },
  "N33": { x: 540.94, y: 547, name: "N33", type: 'hallway' },
  "N34": { x: 572.03, y: 547.8, name: "N34", type: 'hallway' },
  "N35": { x: 391.8, y: 550.2, name: "N35", type: 'exit', isExit: true },
  "N36": { x: 414.66, y: 541.74, name: "N36", type: 'hallway' },
  "N37": { x: 367, y: 540.26, name: "N37", type: 'hallway' },
  "N38": { x: 363.73, y: 627.55, name: "N38", type: 'exit', isExit: true },
  "N39": { x: 418.48, y: 551.75, name: "N39", type: 'exit', isExit: true },
  "N40": { x: 442.48, y: 552.61, name: "N40", type: 'exit', isExit: true },
  "N41": { x: 315.9, y: 596.03, name: "N41", type: 'evac-access' },
  "N42": { x: 464.83, y: 673.17, name: "N42", type: 'exit', isExit: true },
  "N43": { x: 412.83, y: 613.17, name: "N43", type: 'hallway' },
  "N44": { x: 324.33, y: 584.67, name: "N44", type: 'evac-boundary' },
  "N45": { x: 573.91, y: 557.75, name: "N45", type: 'exit', isExit: true },
  "N46": { x: 314, y: 587, name: "N46", type: 'evac-boundary' },
  "N47": { x: 489.92, y: 547.85, name: "N47", type: 'hallway' },
  "N48": { x: 473.78, y: 532.85, name: "N48", type: 'hallway' },
  "N49": { x: 370.16, y: 544.83, name: "N49", type: 'hallway' },
  "N50": { x: 395.11, y: 545.53, name: "N50", type: 'hallway' },
  "N51": { x: 418.16, y: 546, name: "N51", type: 'hallway' },
  "N52": { x: 442.4, y: 546.95, name: "N52", type: 'hallway' },
  "N53": { x: 521.46, y: 549.06, name: "N53", type: 'hallway' },
  "N54": { x: 546.87, y: 550, name: "N54", type: 'hallway' },
  "N55": { x: 573.93, y: 551.18, name: "N55", type: 'hallway' },
  "N56": { x: 394.81, y: 551.33, name: "N56", type: 'exit', isExit: true },
  "EVAC_AREA_2_TL": { x: 242.4, y: 224.2, name: "EVAC_AREA_2_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_2' },
  "EVAC_AREA_2_TR": { x: 326.4, y: 224.2, name: "EVAC_AREA_2_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_2' },
  "EVAC_AREA_2_BR": { x: 326.4, y: 404.2, name: "EVAC_AREA_2_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_2' },
  "EVAC_AREA_2_BL": { x: 242.4, y: 404.2, name: "EVAC_AREA_2_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_2' },
  "EVAC_AREA_3_TL": { x: 369.33, y: 221.87, name: "EVAC_AREA_3_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_3' },
  "EVAC_AREA_3_TR": { x: 486.31, y: 221.87, name: "EVAC_AREA_3_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_3' },
  "EVAC_AREA_3_BR": { x: 486.31, y: 287.64, name: "EVAC_AREA_3_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_3' },
  "EVAC_AREA_3_BL": { x: 369.33, y: 287.64, name: "EVAC_AREA_3_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_3' },
  "EVAC_AREA_5_TL": { x: 611.36, y: 225.2, name: "EVAC_AREA_5_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_5' },
  "EVAC_AREA_5_TR": { x: 693.6, y: 225.2, name: "EVAC_AREA_5_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_5' },
  "EVAC_AREA_5_BR": { x: 693.6, y: 416.24, name: "EVAC_AREA_5_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_5' },
  "EVAC_AREA_5_BL": { x: 611.36, y: 416.24, name: "EVAC_AREA_5_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_5' },
  "EVAC_AREA_6_TL": { x: 356.32, y: 72.24, name: "EVAC_AREA_6_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_6' },
  "EVAC_AREA_6_TR": { x: 466.08, y: 72.24, name: "EVAC_AREA_6_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_6' },
  "EVAC_AREA_6_BR": { x: 466.08, y: 139.44, name: "EVAC_AREA_6_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_6' },
  "EVAC_AREA_6_BL": { x: 356.32, y: 139.44, name: "EVAC_AREA_6_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_6' },
  "EVAC_AREA_7_TL": { x: 246.06, y: 436.34, name: "EVAC_AREA_7_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_7' },
  "EVAC_AREA_7_TR": { x: 324.23, y: 436.34, name: "EVAC_AREA_7_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_7' },
  "EVAC_AREA_7_BR": { x: 324.23, y: 596.34, name: "EVAC_AREA_7_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_7' },
  "EVAC_AREA_7_BL": { x: 246.06, y: 596.34, name: "EVAC_AREA_7_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_7' },
  "EVAC_AREA_8_TL": { x: 383.43, y: 477.89, name: "EVAC_AREA_8_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_8' },
  "EVAC_AREA_8_TR": { x: 491.09, y: 477.89, name: "EVAC_AREA_8_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_8' },
  "EVAC_AREA_8_BR": { x: 491.09, y: 537.09, name: "EVAC_AREA_8_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_8' },
  "EVAC_AREA_8_BL": { x: 383.43, y: 537.09, name: "EVAC_AREA_8_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_8' },
  "EVAC_AREA_9_TL": { x: 504.57, y: 634.46, name: "EVAC_AREA_9_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_9' },
  "EVAC_AREA_9_TR": { x: 595.09, y: 634.46, name: "EVAC_AREA_9_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_9' },
  "EVAC_AREA_9_BR": { x: 595.09, y: 698.91, name: "EVAC_AREA_9_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_9' },
  "EVAC_AREA_9_BL": { x: 504.57, y: 698.91, name: "EVAC_AREA_9_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_9' },
  "EVAC_AREA_10_TL": { x: 660.15, y: 627.64, name: "EVAC_AREA_10_TL", type: 'evac-boundary', areaId: 'EVAC_AREA_10' },
  "EVAC_AREA_10_TR": { x: 718.62, y: 627.64, name: "EVAC_AREA_10_TR", type: 'evac-boundary', areaId: 'EVAC_AREA_10' },
  "EVAC_AREA_10_BR": { x: 718.62, y: 759.42, name: "EVAC_AREA_10_BR", type: 'evac-boundary', areaId: 'EVAC_AREA_10' },
  "EVAC_AREA_10_BL": { x: 660.15, y: 759.42, name: "EVAC_AREA_10_BL", type: 'evac-boundary', areaId: 'EVAC_AREA_10' },
} as const;

// Convert pixel coordinates to 0–100, matching the GPS/pathfinding map.
export const CAMPUS_NODES: Record<string, CampusNode> = Object.fromEntries(
  Object.entries(SUBMITTED_NODES_PIXELS).map(([id, point]) => [
    id,
    {
      id,
      name: point.name,
      x: (point.x / SOURCE_MAP_SIZE) * 100,
      y: (point.y / SOURCE_MAP_SIZE) * 100,
      type: point.type,
      isExit: point.type === 'exit',
      ...('areaId' in point ? { areaId: point.areaId } : {}),
    },
  ])
);

// The latest submission supersedes any older coordinates for duplicate IDs.
// Historical edges involving those replaced IDs were omitted because they
// might now attach to a different location or node type.
// Edges in this list include submitted connections to boundary markers,
// but those boundary-marker connections are NOT usable for Dijkstra.
export const SUBMITTED_EDGES: CampusEdge[] = [
  { from: 'N1', to: 'N2' },
  { from: 'N3', to: 'N6' },
  { from: 'N47', to: 'N48' },
  { from: 'N45', to: 'N55' },
  { from: 'N40', to: 'N52' },
  { from: 'N39', to: 'N51' },
  { from: 'N56', to: 'N50' },
  { from: 'N23', to: 'N24' },
  { from: 'N26', to: 'N25' },
  { from: 'N24', to: 'N27' },
  { from: 'N10', to: 'N26' },
  { from: 'N22', to: 'N23' },
  { from: 'N15', to: 'N34' },
  { from: 'N14', to: 'N33' },
  { from: 'N13', to: 'N32' },
  { from: 'N12', to: 'N24' },
  { from: 'N8', to: 'N28' },
  { from: 'N35', to: 'N30' },
  { from: 'N7', to: 'N36' },
  { from: 'N5', to: 'N37' },
  { from: 'N38', to: 'N41' },
  { from: 'N42', to: 'N43' },
  { from: 'N43', to: 'N46' },
];

// Only travel on explicitly drawn connections between non-boundary nodes.
export const PATHWAY_EDGES: CampusEdge[] = SUBMITTED_EDGES.filter(
  edge =>
    !!CAMPUS_NODES[edge.from] &&
    !!CAMPUS_NODES[edge.to] &&
    CAMPUS_NODES[edge.from].type !== 'evac-boundary' &&
    CAMPUS_NODES[edge.to].type !== 'evac-boundary'
);

// Convenient routing aliases; these are NORMALIZED nodes, not SVG pixels.
export const NODES = CAMPUS_NODES;
export const EDGES = PATHWAY_EDGES;

// Polygon geometry references: a perimeter does not imply a walking path.
export const EVACUATION_POLYGON_NODE_IDS = [
  { id: 'EVAC_AREA_2', name: 'Evacuation Area 2', corners: ['EVAC_AREA_2_TL', 'EVAC_AREA_2_TR', 'EVAC_AREA_2_BR', 'EVAC_AREA_2_BL'] },
  { id: 'EVAC_AREA_3', name: 'Evacuation Area 3', corners: ['EVAC_AREA_3_TL', 'EVAC_AREA_3_TR', 'EVAC_AREA_3_BR', 'EVAC_AREA_3_BL'] },
  { id: 'EVAC_AREA_5', name: 'Evacuation Area 5', corners: ['EVAC_AREA_5_TL', 'EVAC_AREA_5_TR', 'EVAC_AREA_5_BR', 'EVAC_AREA_5_BL'] },
  { id: 'EVAC_AREA_6', name: 'Evacuation Area 6', corners: ['EVAC_AREA_6_TL', 'EVAC_AREA_6_TR', 'EVAC_AREA_6_BR', 'EVAC_AREA_6_BL'] },
  { id: 'EVAC_AREA_7', name: 'Evacuation Area 7', corners: ['EVAC_AREA_7_TL', 'EVAC_AREA_7_TR', 'EVAC_AREA_7_BR', 'EVAC_AREA_7_BL'] },
  { id: 'EVAC_AREA_8', name: 'Evacuation Area 8', corners: ['EVAC_AREA_8_TL', 'EVAC_AREA_8_TR', 'EVAC_AREA_8_BR', 'EVAC_AREA_8_BL'] },
  { id: 'EVAC_AREA_9', name: 'Evacuation Area 9', corners: ['EVAC_AREA_9_TL', 'EVAC_AREA_9_TR', 'EVAC_AREA_9_BR', 'EVAC_AREA_9_BL'] },
  { id: 'EVAC_AREA_10', name: 'Evacuation Area 10', corners: ['EVAC_AREA_10_TL', 'EVAC_AREA_10_TR', 'EVAC_AREA_10_BR', 'EVAC_AREA_10_BL'] },
] as const;

// Existing demo node IDs N2/N3 still conflict with navigationUtils.ts,
// so avoid importing graph constants under duplicate local names.
export const DEMO_NODE_ID_CONFLICTS = ['N2', 'N3'] as const;
