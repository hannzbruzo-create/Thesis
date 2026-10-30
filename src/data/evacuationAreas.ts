/** Evacuation areas painted on the campus map (map-for-evac-areas.png). Map units / 8 (0-100), as routePreview expects. */
export type Point = { x: number; y: number };
/** `place` says where it is on campus (shown to admins with the safety reports). */
export type EvacuationArea = { id: string; name: string; place: string; polygon: Point[] };
export const EVACUATION_AREAS: EvacuationArea[] = [
  { id: "EVAC_AREA_1", name: "Evacuation Area 1", place: "Aqui Preschool & Elementary field", polygon: [{x:43.125,y:9.375}, {x:55,y:9.375}, {x:55,y:14.5}, {x:43.125,y:14.5}] },
  { id: "EVAC_AREA_2", name: "Evacuation Area 2", place: "North lawn (north of St. Pius V Hall)", polygon: [{x:45.438,y:27.875}, {x:59.5,y:27.875}, {x:59.5,y:34.5}, {x:45.438,y:34.5}] },
  { id: "EVAC_AREA_3", name: "Evacuation Area 3", place: "St. Dominic front lawn", polygon: [{x:77,y:28.438}, {x:86,y:28.438}, {x:86,y:50.25}, {x:77,y:50.25}] },
  { id: "EVAC_AREA_4", name: "Evacuation Area 4", place: "West open ground (San Lorenzo grounds)", polygon: [{x:23.375,y:32.063}, {x:41.188,y:32.063}, {x:41.188,y:46.5}, {x:23.375,y:46.5}] },
  { id: "EVAC_AREA_5", name: "Evacuation Area 5", place: "Lawn south of St. Pius V Hall", polygon: [{x:45.625,y:42.938}, {x:58.188,y:42.938}, {x:58.188,y:49.813}, {x:45.625,y:49.813}] },
  { id: "EVAC_AREA_6", name: "Evacuation Area 6", place: "Grounds south of St. Thomas Chapel", polygon: [{x:21.438,y:60.125}, {x:32.625,y:60.125}, {x:32.625,y:73.063}, {x:21.438,y:73.063}] },
  { id: "EVAC_AREA_7", name: "Evacuation Area 7", place: "St. Thomas Aquinas quadrangle", polygon: [{x:44.25,y:60}, {x:62.5,y:60}, {x:62.5,y:68.063}, {x:44.25,y:68.063}] },
  { id: "EVAC_AREA_8", name: "Evacuation Area 8", place: "St. Albert courtyard", polygon: [{x:64,y:80.625}, {x:73.75,y:80.625}, {x:73.75,y:85.938}, {x:64,y:85.938}] },
  { id: "EVAC_AREA_9", name: "Evacuation Area 9", place: "East lawn beside St. Albert", polygon: [{x:83.75,y:78.875}, {x:90.875,y:78.875}, {x:90.875,y:90.625}, {x:83.75,y:90.625}] },
];

/** The evacuation area containing a map point (map units, 0-800), if any. */
export function evacuationAreaAt(p: Point): EvacuationArea | null {
  for (const area of EVACUATION_AREAS) {
    let inside = false;
    const poly = area.polygon;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const ax = poly[i].x * 8, ay = poly[i].y * 8, bx = poly[j].x * 8, by = poly[j].y * 8;
      if ((ay > p.y) !== (by > p.y) && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (inside) return area;
  }
  return null;
}
