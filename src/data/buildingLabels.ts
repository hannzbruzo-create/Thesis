/**
 * Original TomaSafe building positions, expressed as percentages of the
 * 800×800 SVG campus map. Keeping these separate makes map updates safer.
 */
export type BuildingLabelData = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export const BUILDING_LABELS: BuildingLabelData[] = [
  { id: 'angelico', name: 'Fra. Angelico BLDG', x: 26.48, y: 83.97 },
  { id: 'aquinas', name: 'ST. Thomas Aquinas BLDG', x: 77.72, y: 66.90 },
  { id: 'martin', name: 'ST. Martin BLDG', x: 67.35, y: 15.50 },
  { id: 'albert', name: 'Albert', x: 78.10, y: 86.97 },
  { id: 'aquinas8', name: 'Aquinas 8', x: 59.85, y: 85.10 },
  { id: 'pius', name: 'ST. Pius V Hall', x: 51.10, y: 38.73 },
  { id: 'san-lorenzo', name: 'San Lorenzo', x: 24.60, y: 22.50 },
  { id: 'rose-delima', name: 'STA. Rose de Lima BLDG', x: 32.85, y: 9.25 },
  { id: 'chapel', name: 'ST. Thomas Chapel', x: 25.60, y: 52.75 },
  { id: 'dome', name: 'AQ Dome', x: 45.60, y: 84.12 },
  { id: 'dominic', name: 'ST. Dominic BLDG', x: 70.47, y: 39.75 },
];
