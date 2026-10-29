/**
 * Small procedural textures (no image files). Each is a grey-scale multiplier
 * around white, so the material colour from the theme still decides the hue.
 * UVs are in map units, so `repeat` = 1 / tile size in map units.
 */
import * as THREE from 'three';

const SIZE = 256;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Smooth tiling value noise in [0, 1]. */
function valueNoise(cells: number, seed: number) {
  const r = rng(seed);
  const grid = Array.from({ length: cells * cells }, r);
  const at = (x: number, y: number) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = u * cells, y = v * cells;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function makeTexture(shade: (u: number, v: number, grain: number) => number, repeat: number) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const grain = rng(7);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const value = Math.max(0, Math.min(1, shade(x / SIZE, y / SIZE, grain())));
      const i = (y * SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(value * 255);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
const inside = (u: number, v: number, u0: number, u1: number, v0: number, v1: number) => u >= u0 && u < u1 && v >= v0 && v < v1;

/**
 * Colour texture for one storey of one bay (u across the bay, v up the storey; repeat 1, the
 * wall UVs count bays and storeys). `paint` returns the colour at (u, v); a faint stain and
 * grain are added on top.
 */
function facadeTexture(seed: number, paint: (u: number, v: number) => RGB) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const grain = rng(seed), stain = valueNoise(8, seed + 12);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x + 0.5) / SIZE, v = (y + 0.5) / SIZE;
      const rgb = paint(u, v);
      const n = 0.97 + stain(u, v) * 0.03 + (grain() - 0.5) * 0.025;
      const i = (y * SIZE + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(Math.max(0, Math.min(1, rgb[k] * n)) * 255);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Framed window with a mullion every `panes`; glass darker under the lintel. */
function windowAt(u: number, v: number, u0: number, u1: number, v0: number, v1: number, panes: number, glass: RGB, frame: RGB): RGB | null {
  if (!inside(u, v, u0, u1, v0, v1)) return null;
  const pu = (u - u0) / (u1 - u0), pv = (v - v0) / (v1 - v0);
  const edge = 0.035 / (u1 - u0);
  const mullion = Math.abs(pu * panes - Math.round(pu * panes)) * (u1 - u0) / panes < 0.01;
  if (pu < edge || pu > 1 - edge || pv < 0.06 || pv > 0.94 || mullion) return frame;
  const t = pv;
  return [glass[0] - t * 0.1, glass[1] - t * 0.1, glass[2] - t * 0.08];
}

const WHITE: RGB = [1, 1, 1];
const PEACH = hex('#EFAE84'), ORANGE = hex('#F57C0A'), TAUPE = hex('#8A7A70');

/** Plain buildings: white wall (tinted by wallColor), floor line, sill and a blue-grey window. */
const paintWindows = (u: number, v: number): RGB => {
  if (v < 0.05) return [0.86, 0.86, 0.86];
  if (inside(u, v, 0.15, 0.85, 0.27, 0.31)) return [1.04, 1.04, 1.04];
  return windowAt(u, v, 0.18, 0.82, 0.31, 0.84, 2, [0.5, 0.58, 0.66], [0.97, 0.97, 0.97]) ?? WHITE;
};

/** UST style: peach spandrel, white ledges, a wide pale window band, orange pilaster at the bay edge. */
const paintUst = (u: number, v: number): RGB => {
  if (u < 0.065 || u > 0.935) return u < 0.02 || u > 0.98 ? [ORANGE[0] * 0.85, ORANGE[1] * 0.85, ORANGE[2] * 0.85] : ORANGE;
  if (v < 0.06) return [0.93, 0.93, 0.93];
  if (v < 0.4) return PEACH;
  if (v < 0.45) return WHITE;
  return windowAt(u, v, 0.08, 0.92, 0.45, 0.93, 4, [0.78, 0.84, 0.8], WHITE) ?? WHITE;
};

/** Ground-floor colonnade: orange columns, shaded walkway behind, white band on top. */
const paintArcade = (u: number, v: number): RGB => {
  if (v > 0.84) return v < 0.87 ? [0.9, 0.9, 0.9] : WHITE;
  if (u < 0.07 || u > 0.93) return u > 0.965 ? [ORANGE[0] * 0.82, ORANGE[1] * 0.82, ORANGE[2] * 0.82] : ORANGE;
  if (v < 0.07) return [0.74, 0.71, 0.68];
  const t = v / 0.84;
  return [0.42 - t * 0.12, 0.38 - t * 0.11, 0.35 - t * 0.1];
};

const TAN = hex('#D8AC84'), CURTAIN = hex('#E8BF98'), SKY = hex('#AFC0CF'), MULLION = hex('#2E2B29');

/** St. Martin 3F: tan spandrel, white ledge, wide window of small dark-framed panes, orange pilasters. */
const paintGrid = (u: number, v: number): RGB => {
  if (u < 0.08 || u > 0.92) return u < 0.025 || u > 0.975 ? [ORANGE[0] * 0.85, ORANGE[1] * 0.85, ORANGE[2] * 0.85] : ORANGE;
  if (v < 0.045) return [0.95, 0.95, 0.95];
  if (v > 0.965) return WHITE;
  if (v < 0.4) return TAN;
  if (v < 0.42) return WHITE;
  // 6 x 4 panes; some show curtains, some reflect the sky.
  const pu = (u - 0.08) / 0.84, pv = (v - 0.42) / 0.545;
  const fu = pu * 6, fv = pv * 4;
  if (Math.min(fu % 1, 1 - (fu % 1)) < 0.06 || Math.min(fv % 1, 1 - (fv % 1)) < 0.07) return MULLION;
  // Mostly pale glass, an odd curtained pane; each pane a touch lighter or darker.
  const cell = (Math.floor(fu) * 7 + Math.floor(fv) * 3) % 9;
  const base = cell === 0 ? CURTAIN : SKY, k = 0.94 + (cell % 3) * 0.04;
  return [base[0] * k, base[1] * k, base[2] * k];
};

/** Aquinas T-rooms: charcoal base band, plain wall, a wood-framed window with brown curtains. */
const paintVeranda = (u: number, v: number): RGB => {
  if (v < 0.25) return [0.36, 0.36, 0.37];
  if (v < 0.27) return [0.3, 0.3, 0.31];
  const w = windowAt(u, v, 0.24, 0.76, 0.36, 0.8, 2, [0.66, 0.44, 0.3], [0.92, 0.9, 0.86]);
  return w ?? WHITE;
};

const YELLOW = hex('#F2B01E');

/**
 * Magayon Hall: a pair of yellow pilasters at each bay edge (split by a shadow line), plain wall,
 * a wide black-framed window with beige curtains.
 */
const paintHall = (u: number, v: number): RGB => {
  const e = Math.min(u, 1 - u);
  if (e < 0.006) return [YELLOW[0] * 0.6, YELLOW[1] * 0.6, YELLOW[2] * 0.6];
  if (e < 0.07) return u > 0.5 && e < 0.02 ? [YELLOW[0] * 0.85, YELLOW[1] * 0.85, YELLOW[2] * 0.85] : YELLOW;
  return windowAt(u, v, 0.14, 0.86, 0.24, 0.74, 3, [0.78, 0.72, 0.6], [0.12, 0.12, 0.13]) ?? WHITE;
};

/** AQ Dome upper floor: tan wall, a band of dark windows, yellow pilasters, white top. */
const paintDome = (u: number, v: number): RGB => {
  if (v > 0.95) return WHITE;
  if (u < 0.07 || u > 0.93) return u < 0.02 || u > 0.98 ? [YELLOW[0] * 0.82, YELLOW[1] * 0.82, YELLOW[2] * 0.82] : YELLOW;
  if (v > 0.3 && v < 0.33) return WHITE;
  return windowAt(u, v, 0.07, 0.93, 0.33, 0.82, 3, [0.24, 0.26, 0.29], [0.5, 0.5, 0.5]) ?? TAN;
};

const CREAM = hex('#E9E1D0');

/**
 * St. Albert / St. John Macias room walls (behind the open corridor): cream wall with a
 * window and a door per bay, a pale line at each floor.
 */
const paintBalcony = (u: number, v: number): RGB => {
  if (v < 0.04 || v > 0.94) return [0.96, 0.95, 0.93];
  if (u > 0.62 && u < 0.76 && v < 0.78) return [0.36, 0.33, 0.31]; // door
  return windowAt(u, v, 0.14, 0.5, 0.34, 0.76, 2, [0.3, 0.33, 0.37], [0.85, 0.85, 0.85]) ?? CREAM;
};

const AMBER = hex('#E9A23B');

/** Fra. Angelico: cream wall, a white-framed light-blue window, yellow-orange pilasters. */
const paintAngelico = (u: number, v: number): RGB => {
  if (v > 0.95) return WHITE;
  if (u < 0.06 || u > 0.94) return u < 0.018 || u > 0.982 ? [AMBER[0] * 0.82, AMBER[1] * 0.82, AMBER[2] * 0.82] : AMBER;
  if (v < 0.04) return [0.95, 0.95, 0.93];
  return windowAt(u, v, 0.26, 0.74, 0.38, 0.78, 2, [0.62, 0.76, 0.86], WHITE) ?? CREAM;
};

/** Fin tower: taupe piers with a wide recessed slot, dark at its edges and lit orange inside. */
const paintFins = (u: number, v: number): RGB => {
  if (u < 0.22 || u > 0.78 || v > 0.955) return u > 0.78 && u < 0.86 ? [TAUPE[0] * 0.78, TAUPE[1] * 0.78, TAUPE[2] * 0.78] : TAUPE;
  if (u < 0.36) return [0.3, 0.25, 0.22];
  const glow = 1 - Math.abs(u - 0.6) / 0.25;
  return [ORANGE[0] * (0.55 + glow * 0.4), ORANGE[1] * (0.5 + glow * 0.4), ORANGE[2] * (0.5 + glow * 0.4)];
};

let cache: ReturnType<typeof build> | null = null;

function build() {
  const blotch = valueNoise(6, 11), fine = valueNoise(24, 23);
  const stripes = valueNoise(10, 31);
  return {
    /** Lawn: soft patches plus a fine grain. Tile = 90 map units. */
    grass: makeTexture((u, v, g) => 0.9 + blotch(u, v) * 0.09 + fine(u, v) * 0.04 + (g - 0.5) * 0.03, 1 / 90),
    /** Playing field: mowing stripes. Tile = 64 map units (4 stripes). */
    field: makeTexture((u, v, g) => (Math.floor(u * 4) % 2 ? 0.93 : 1) - stripes(u, v) * 0.03 + (g - 0.5) * 0.025, 1 / 64),
    /** Asphalt / paving: fine speckle. Tile = 40 map units. */
    asphalt: makeTexture((u, v, g) => 0.94 + fine(u, v) * 0.04 + (g - 0.5) * 0.05, 1 / 40),
    /** Outside the campus: very large, faint patches. Tile = 400 map units. */
    land: makeTexture((u, v, g) => 0.92 + blotch(u, v) * 0.08 + (g - 0.5) * 0.02, 1 / 400),
    /** Roofs: weathered patches and a fine grain so large roofs are not one flat colour. Tile = 70 map units. */
    roof: makeTexture((u, v, g) => 0.9 + blotch(u, v) * 0.08 + fine(u, v) * 0.05 + (g - 0.5) * 0.04, 1 / 70),
    /** Building walls, one texture per FacadeStyle ('plain' uses the window-free part of `windows`). */
    facades: {
      windows: facadeTexture(41, paintWindows),
      plain: null,
      ust: facadeTexture(43, paintUst),
      arcade: facadeTexture(47, paintArcade),
      fins: facadeTexture(53, paintFins),
      grid: facadeTexture(59, paintGrid),
      veranda: facadeTexture(61, paintVeranda),
      hall: facadeTexture(67, paintHall),
      dome: facadeTexture(71, paintDome),
      balcony: facadeTexture(73, paintBalcony),
      angelico: facadeTexture(79, paintAngelico),
    },
  };
}

/** Shared textures, created once. */
export function groundTextures() {
  if (!cache) cache = build();
  return cache;
}
