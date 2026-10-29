/** Types for campusModel.ts. All x/y values are original 800 x 800 map units. */
export type XY = [number, number];
export type RoofStyle = 'flat' | 'gable' | 'hip' | 'pyramid';
/**
 * Wall look. 'windows' (default): a window per bay on every floor, tinted by wallColor.
 * 'plain': no windows. The others carry their own colours (use wallColor "#FFFFFF"):
 * 'ust' peach walls, white ledges and orange pilasters; 'arcade' a ground-floor colonnade
 * with orange columns (on a canopy: orange columns, white band, red-tile eave); 'fins' grey-brown piers with tall orange-lit slots;
 * 'grid' tan spandrels, orange pilasters and dark-framed grid windows (St. Martin / Aquinas 3F);
 * 'veranda' walls tinted by wallColor with a charcoal base band and curtained windows (Aquinas T-rooms);
 * 'hall' white walls, paired yellow pilasters and wide black-framed curtained windows (Daragang Magayon Hall);
 * 'dome' tan walls, yellow pilasters and a band of dark windows (AQ Dome upper floor);
 * 'balcony' cream room walls with a window and a door per bay, the wall behind an open corridor (St. Albert, St. John Macias);
 * 'angelico' cream walls, light-blue windows and yellow-orange pilasters (Fra. Angelico).
 */
export type FacadeStyle = 'windows' | 'plain' | 'ust' | 'arcade' | 'fins' | 'grid' | 'veranda' | 'hall' | 'dome' | 'balcony' | 'angelico';

export type CampusBuilding = {
  id: string;
  name: string;
  /** Pieces of one building share a group id; the editor changes them together. */
  group?: string;
  floors: number;
  /** Storeys below this piece, for upper floors that differ from the one beneath. Default 0 (on the ground). */
  level?: number;
  /** Metres per storey. Default DEFAULT_FLOOR_HEIGHT. */
  floorHeight?: number;
  wallColor: string;
  roofColor: string;
  roof: { style: RoofStyle; pitch?: number; ridgeAngle?: number };
  /** Roof overhang past the walls, in metres. Default 0 (footprint traced from the roof). */
  eave?: number;
  footprint: XY[];
  /** Enclosed courtyards cut out of the footprint (flat roofs only). */
  holes?: XY[][];
  /**
   * Separate roof sections over one footprint (e.g. one gable per wing), so a single-shape
   * building can still have the pitched roofs seen from above. style defaults to roof.style.
   */
  roofParts?: { poly: XY[]; style?: RoofStyle }[];
  /** Open-sided covered walkway: a thin roof on posts instead of a solid block. */
  canopy?: boolean;
  /** Canopies: metres between posts along each edge; 0 = corners only (a gate over a road). */
  postSpacing?: number;
  /** Canopies: post width, metres. Default 0.22 for 'arcade', 0.25 otherwise. */
  postSize?: number;
  /**
   * Ground floor is a corridor all round, this many metres deep, with posts on the outer line
   * (postColor / postSize / postSpacing). Needs 2+ floors and no courtyards.
   */
  groundArcade?: number;
  /** With groundArcade: the corridor floor is raised this many metres on a platform. */
  plinth?: number;
  /**
   * Open corridor strip in front of rooms, on every floor, opening to this side: floor slabs with a
   * cream balcony wall on the upper floors, painted posts (postColor / postSize / postSpacing) full
   * height, flat roof. The opposite side is the room wall, so it gets no posts or balcony wall.
   */
  balcony?: 'north' | 'south' | 'east' | 'west';
  /** With balcony: the ground-floor corridor gets a balcony wall too. */
  balconyGround?: boolean;
  /** Canopies: post colour, and a different colour for the bottom 0.9 m (a painted base). */
  postColor?: string;
  postBase?: string;
  /** Wall look (see FacadeStyle). Default 'windows'. */
  facade?: FacadeStyle;
  /** How far the white roof-edge band rises above the roof, metres (a parapet). Default 0.18. */
  parapet?: number;
};

/**
 * A round seal mounted on a wall. x/y in map units (on the wall face), height and radius in
 * metres; facing in degrees clockwise from map-up (0 = faces north, 90 = east).
 */
export type CampusEmblem = { id: string; x: number; y: number; height: number; radius: number; facing: number };

/** A name on the map. Rooms carry the floor they are on: 0 = ground floor (default), 1 = 2F, ... */
export type CampusLabel = { id: string; name: string; x: number; y: number; floor?: number };
export type GroundArea = { id: string; kind: 'grass' | 'field' | 'dirt' | 'court' | 'water' | 'plaza' | 'parking'; polygon: XY[] };
export type CampusRoad = { id: string; width: number; points: XY[] };
export type CampusWalkway = {
  id: string;
  width: number;
  /** Covered walkways and corridors get a roof on columns (a veranda when it runs along a building). */
  covered: boolean;
  points: XY[];
  /** Roof height in metres for covered walkways. Default 3. */
  height?: number;
  /** Roof colour for covered walkways. Default theme.coveredWalkway. */
  roofColor?: string;
};
export type CampusTree = { x: number; y: number; r: number };

export type CampusTheme = {
  sky: string;
  ground: string;
  grass: string;
  field: string;
  water: string;
  plaza: string;
  parking: string;
  parkingLine: string;
  /** Bare earth / sand fields. */
  dirt: string;
  /** Sports courts and their painted outline. */
  court: string;
  courtLine: string;
  road: string;
  /** Raised curb along both sides of a road. */
  curb: string;
  /** Soft shadow line just outside the curb. */
  roadEdge: string;
  /** Dashed centre line on roads. */
  roadLine: string;
  /** Sidewalk border around every building. */
  apron: string;
  walkway: string;
  coveredWalkway: string;
  tree: string;
  labelText: string;
  labelHalo: string;
  /** Light direction in degrees: azimuth clockwise from map-up, elevation above the ground. */
  sunAzimuth: number;
  sunElevation: number;
  /** 0 = flat even light, 0.8 = strong difference between lit and shaded walls. No cast shadows. */
  lightContrast: number;
};

export type CampusModel = {
  theme: CampusTheme;
  buildings: CampusBuilding[];
  labels: CampusLabel[];
  /** Small room names from floor plans; shown only when zoomed in. */
  rooms: CampusLabel[];
  areas: GroundArea[];
  roads: CampusRoad[];
  walkways: CampusWalkway[];
  trees: CampusTree[];
  emblems?: CampusEmblem[];
};

/** From CAMPUS_BOUNDS: ~381 m of latitude across 800 units. */
export const METRES_PER_UNIT = 0.48;
export const DEFAULT_FLOOR_HEIGHT = 3.5;
export const DEFAULT_ROOF_PITCH = 25;

/** Height of the piece's bottom above the ground, map units (0 unless it starts on an upper floor). */
export function buildingBase(b: CampusBuilding): number {
  return ((b.level ?? 0) * (b.floorHeight ?? DEFAULT_FLOOR_HEIGHT)) / METRES_PER_UNIT;
}

/** Height of the piece's top (wall tops / roof eaves) above the ground, map units. */
export function buildingHeight(b: CampusBuilding): number {
  return buildingBase(b) + (Math.max(1, b.floors) * (b.floorHeight ?? DEFAULT_FLOOR_HEIGHT)) / METRES_PER_UNIT;
}
