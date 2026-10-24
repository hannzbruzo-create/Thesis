/** TomaSafe labels – coordinates in percent of 800×800 SVG. */
export type BuildingLabelData = { id: string; name: string; x: number; y: number; minZoom?: number; priority?: number; kind?: 'primary' | 'secondary' };
export const BUILDING_LABELS: BuildingLabelData[] = [
  {
    "id": "angelico",
    "name": "Fra. Angelico BLDG",
    "x": 26.48,
    "y": 83.97,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "aquinas",
    "name": "ST. Thomas Aquinas BLDG",
    "x": 77.72,
    "y": 66.9,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "martin",
    "name": "ST. Martin BLDG",
    "x": 67.35,
    "y": 15.5,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "albert",
    "name": "ST. Albert BLDG",
    "x": 78.1,
    "y": 86.97,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "aquinas8",
    "name": "ST. John Macias BLDG.",
    "x": 59.85,
    "y": 85.1,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "pius",
    "name": "ST. Pius V Hall",
    "x": 51.1,
    "y": 38.73,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "san-lorenzo",
    "name": "San Lorenzo",
    "x": 24.6,
    "y": 22.5,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "rose-delima",
    "name": "STA. Rose de Lima BLDG",
    "x": 32.85,
    "y": 9.25,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "chapel",
    "name": "ST. Thomas Chapel",
    "x": 25.6,
    "y": 52.75,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "dome",
    "name": "AQ Dome",
    "x": 45.6,
    "y": 84.12,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "dominic",
    "name": "ST. Dominic BLDG",
    "x": 70.47,
    "y": 39.75,
    "minZoom": 0.22,
    "priority": 80,
    "kind": "primary"
  },
  {
    "id": "label-mvltphbf",
    "name": "Daragang Magayon Hall",
    "x": 49.55,
    "y": 55.66,
    "minZoom": 1,
    "priority": 40,
    "kind": "secondary"
  },
  {
    "id": "label-mvltuggk",
    "name": "Aqui Preschool & Elementary",
    "x": 49.85,
    "y": 13.16,
    "minZoom": 1,
    "priority": 40,
    "kind": "secondary"
  },
  {
    "id": "label-mvltweem",
    "name": "ST. Raymond De Penafort Convent",
    "x": 11.26,
    "y": 68.59,
    "minZoom": 0.22,
    "priority": 40,
    "kind": "primary"
  }
];
