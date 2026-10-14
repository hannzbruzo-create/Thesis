// evacuationData.ts — UST–Legazpi TomaSafe
// All polygon points are the user-mapped rectangles in normalized 0–100 units.
// Pixel values and their four boundary nodes are in campusGraphData.ts.
// Boundary vertices are display geometry, NOT approved walkable routes.

export type MapPoint = { x: number; y: number };
export type EvacuationArea = {
  id: string;
  name: string;
  polygon: MapPoint[];
  center: MapPoint;
};

// The original Area 1 remains for compatibility with the existing demo routes.
// Areas 2, 3, 5, 6, 7, 8, 9, 10 are the newly mapped rectangles.
// No Area 4 was provided, so none is invented.
export const EVACUATION_AREAS: EvacuationArea[] = [
  {
    id: 'EVAC_AREA_1',
    name: 'Evacuation Area 1',
    polygon: [
      { x: 28.68, y: 56.21 },
      { x: 40.62, y: 55.99 },
      { x: 40.12, y: 73.82 },
      { x: 28.29, y: 73.55 },
    ],
    center: { x: 34.43, y: 64.89 },
  },
  {
    id: 'EVAC_AREA_2',
    name: 'Evacuation Area 2',
    polygon: [
      { x: 30.3, y: 28.03 },
      { x: 40.8, y: 28.03 },
      { x: 40.8, y: 50.53 },
      { x: 30.3, y: 50.53 },
    ],
    center: { x: 35.55, y: 39.28 },
  },
  {
    id: 'EVAC_AREA_3',
    name: 'Evacuation Area 3',
    polygon: [
      { x: 46.17, y: 27.73 },
      { x: 60.79, y: 27.73 },
      { x: 60.79, y: 35.96 },
      { x: 46.17, y: 35.96 },
    ],
    center: { x: 53.48, y: 31.84 },
  },
  {
    id: 'EVAC_AREA_5',
    name: 'Evacuation Area 5',
    polygon: [
      { x: 76.42, y: 28.15 },
      { x: 86.7, y: 28.15 },
      { x: 86.7, y: 52.03 },
      { x: 76.42, y: 52.03 },
    ],
    center: { x: 81.56, y: 40.09 },
  },
  {
    id: 'EVAC_AREA_6',
    name: 'Evacuation Area 6',
    polygon: [
      { x: 44.54, y: 9.03 },
      { x: 58.26, y: 9.03 },
      { x: 58.26, y: 17.43 },
      { x: 44.54, y: 17.43 },
    ],
    center: { x: 51.4, y: 13.23 },
  },
  {
    id: 'EVAC_AREA_7',
    name: 'Evacuation Area 7',
    polygon: [
      { x: 30.76, y: 54.54 },
      { x: 40.53, y: 54.54 },
      { x: 40.53, y: 74.54 },
      { x: 30.76, y: 74.54 },
    ],
    center: { x: 35.64, y: 64.54 },
  },
  {
    id: 'EVAC_AREA_8',
    name: 'Evacuation Area 8',
    polygon: [
      { x: 47.93, y: 59.74 },
      { x: 61.39, y: 59.74 },
      { x: 61.39, y: 67.14 },
      { x: 47.93, y: 67.14 },
    ],
    center: { x: 54.66, y: 63.44 },
  },
  {
    id: 'EVAC_AREA_9',
    name: 'Evacuation Area 9',
    polygon: [
      { x: 63.07, y: 79.31 },
      { x: 74.39, y: 79.31 },
      { x: 74.39, y: 87.36 },
      { x: 63.07, y: 87.36 },
    ],
    center: { x: 68.73, y: 83.34 },
  },
  {
    id: 'EVAC_AREA_10',
    name: 'Evacuation Area 10',
    polygon: [
      { x: 82.52, y: 78.46 },
      { x: 89.83, y: 78.46 },
      { x: 89.83, y: 94.93 },
      { x: 82.52, y: 94.93 },
    ],
    center: { x: 86.17, y: 86.69 },
  },
];
