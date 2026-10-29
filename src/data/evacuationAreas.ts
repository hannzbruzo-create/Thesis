/** Evacuation areas painted on the campus map (map-for-evac-areas.png). Map units / 8 (0-100), as routePreview expects. */
export type Point = { x: number; y: number };
export type EvacuationArea = { id: string; name: string; polygon: Point[] };
export const EVACUATION_AREAS: EvacuationArea[] = [
  { id: "EVAC_AREA_1", name: "Evacuation Area 1", polygon: [{x:43.125,y:9.375}, {x:55,y:9.375}, {x:55,y:14.5}, {x:43.125,y:14.5}] }, // Aqui Preschool & Elementary field
  { id: "EVAC_AREA_2", name: "Evacuation Area 2", polygon: [{x:45.438,y:27.875}, {x:59.5,y:27.875}, {x:59.5,y:34.5}, {x:45.438,y:34.5}] }, // North lawn (north of St. Pius V Hall)
  { id: "EVAC_AREA_3", name: "Evacuation Area 3", polygon: [{x:77,y:28.438}, {x:86,y:28.438}, {x:86,y:50.25}, {x:77,y:50.25}] }, // St. Dominic front lawn
  { id: "EVAC_AREA_4", name: "Evacuation Area 4", polygon: [{x:23.375,y:32.063}, {x:41.188,y:32.063}, {x:41.188,y:46.5}, {x:23.375,y:46.5}] }, // West open ground (San Lorenzo grounds)
  { id: "EVAC_AREA_5", name: "Evacuation Area 5", polygon: [{x:45.625,y:42.938}, {x:58.188,y:42.938}, {x:58.188,y:49.813}, {x:45.625,y:49.813}] }, // Lawn south of St. Pius V Hall
  { id: "EVAC_AREA_6", name: "Evacuation Area 6", polygon: [{x:21.438,y:60.125}, {x:32.625,y:60.125}, {x:32.625,y:73.063}, {x:21.438,y:73.063}] }, // Grounds south of St. Thomas Chapel
  { id: "EVAC_AREA_7", name: "Evacuation Area 7", polygon: [{x:44.25,y:60}, {x:62.5,y:60}, {x:62.5,y:68.063}, {x:44.25,y:68.063}] }, // St. Thomas Aquinas quadrangle
  { id: "EVAC_AREA_8", name: "Evacuation Area 8", polygon: [{x:64,y:80.625}, {x:73.75,y:80.625}, {x:73.75,y:85.938}, {x:64,y:85.938}] }, // St. Albert courtyard
  { id: "EVAC_AREA_9", name: "Evacuation Area 9", polygon: [{x:83.75,y:78.875}, {x:90.875,y:78.875}, {x:90.875,y:90.625}, {x:83.75,y:90.625}] }, // East lawn beside St. Albert
];
