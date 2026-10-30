import type { GuideVisualKind } from '../../emergency/emergencyTypes';

/**
 * The guide animations as data: each scene is a short looping clip drawn in a 100 x 100 box.
 * A scene is a stack of layers; a layer holds static shapes and/or one jointed figure, and can
 * move (keyframes), shake or blink. Time `t` runs 0 -> 1 over `ms` and loops.
 *
 * To change an animation, edit its scene below: poses are joint positions (POSES), and a figure
 * tweens smoothly from one keyframe pose to the next.
 *
 * Kept free of React Native imports so tools can render the same scenes in a browser preview.
 */

// ---------------------------------------------------------------------------
// Types

/** Segment easing from a keyframe to the next: 0 ease in-out, 1 linear, 2 hold (jump at the next key). */
export type Ease = 0 | 1 | 2;
/** Colour token (resolved by the renderer) or a literal colour. */
export type Color = 'tint' | 'ink' | 'limb' | 'muted' | 'no' | 'ok' | 'light' | 'dark' | 'glass' | 'smoke' | 'white' | 'grass' | 'sun' | 'wood' | 'leaf' | 'fire' | 'flame' | 'skin';

export type Shape =
  | { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill?: Color; stroke?: Color; sw?: number }
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: Color; stroke?: Color; sw?: number }
  | { k: 'path'; d: string; fill?: Color; stroke?: Color; sw?: number }
  | { k: 'text'; x: number; y: number; text: string; size: number; fill: Color };

/** Layer movement keyframe: offset (units), uniform scale, extra horizontal scale, rotation (deg), opacity. */
export type ViewKey = { t: number; x?: number; y?: number; s?: number; sx?: number; r?: number; o?: number; e?: Ease };
/** Figure keyframe: pose, horizontal offset, scale (feet stay on the ground), vertical offset, opacity. */
export type FigKey = { t: number; pose: PoseName; x?: number; dy?: number; s?: number; o?: number; e?: Ease };
/** Side-to-side shaking: `amp` units, `cycles` shakes per loop, only inside the `on` time windows. */
export type Shake = { amp: number; cycles: number; on?: [number, number][] };

export type Layer = {
  shapes?: Shape[];
  figure?: FigKey[];
  keys?: ViewKey[];
  shake?: Shake;
  /** Pivot for scale / rotation, in units. */
  origin?: [number, number];
};
export type Scene = { ms: number; layers: Layer[] };

// ---------------------------------------------------------------------------
// Figure: 11 joints, side view facing right, feet on y = 86.
// Order: head, neck, pelvis, back elbow, back hand, front elbow, front hand,
//        back knee, back foot, front knee, front foot.

type Pt = [number, number];
const pose = (...pts: Pt[]) => pts.flat();

export const POSES = {
  stand: pose([50, 20], [50, 31], [50, 56], [48, 44], [47, 56], [52, 44], [53, 56], [49, 71], [48, 86], [51, 71], [52, 86]),
  walk1: pose([51, 20], [50, 31], [49, 56], [55, 43], [60, 53], [45, 43], [41, 54], [44, 70], [35, 84], [56, 69], [61, 86]),
  pass1: pose([51, 19], [50, 30], [50, 55], [50, 43], [51, 55], [50, 43], [50, 55], [54, 68], [50, 79], [50, 70], [50, 86]),
  walk2: pose([51, 20], [50, 31], [49, 56], [45, 43], [41, 54], [55, 43], [60, 53], [56, 69], [61, 86], [44, 70], [35, 84]),
  pass2: pose([51, 19], [50, 30], [50, 55], [50, 43], [51, 55], [50, 43], [50, 55], [50, 70], [50, 86], [54, 68], [50, 79]),
  run1: pose([57, 22], [54, 32], [48, 55], [60, 42], [67, 37], [47, 41], [42, 49], [41, 68], [31, 74], [58, 64], [60, 80]),
  runPass1: pose([56, 20], [53, 30], [48, 53], [55, 41], [60, 46], [51, 41], [55, 47], [53, 64], [47, 72], [49, 69], [48, 86]),
  run2: pose([57, 22], [54, 32], [48, 55], [47, 41], [42, 49], [60, 42], [67, 37], [58, 64], [60, 80], [41, 68], [31, 74]),
  runPass2: pose([56, 20], [53, 30], [48, 53], [51, 41], [55, 47], [55, 41], [60, 46], [49, 69], [48, 86], [53, 64], [47, 72]),
  crouch: pose([56, 40], [52, 50], [36, 64], [56, 61], [60, 72], [58, 60], [62, 71], [48, 72], [44, 86], [50, 70], [48, 86]),
  kneel: pose([70, 56], [62, 61], [38, 68], [61, 74], [62, 86], [64, 74], [66, 86], [37, 83], [22, 86], [40, 83], [25, 86]),
  crawl1: pose([66, 62], [58, 65], [34, 70], [57, 77], [56, 86], [62, 76], [66, 86], [34, 84], [20, 86], [42, 84], [28, 86]),
  crawl2: pose([66, 62], [58, 65], [34, 70], [62, 76], [66, 86], [57, 77], [56, 86], [42, 84], [28, 86], [34, 84], [20, 86]),
  coverKneel: pose([66, 62], [58, 65], [34, 70], [60, 77], [62, 86], [67, 56], [58, 57], [33, 84], [18, 86], [36, 84], [21, 86]),
  holdKneel: pose([66, 62], [58, 65], [34, 70], [67, 56], [58, 57], [68, 64], [77, 61], [33, 84], [18, 86], [36, 84], [21, 86]),
  guard: pose([50, 20], [50, 31], [50, 56], [42, 25], [47, 13], [58, 25], [53, 13], [46, 71], [44, 86], [54, 71], [56, 86]),
  cheer: pose([50, 20], [50, 31], [50, 56], [44, 22], [39, 11], [57, 22], [62, 11], [46, 71], [44, 86], [54, 71], [56, 86]),
};
export type PoseName = keyof typeof POSES;
/** Figure line widths and head radius at scale 1. */
export const FIGURE = { head: 7.5, torso: 10, limb: 6.5 };

// ---------------------------------------------------------------------------
// Keyframe sampling (worklets: also run on the UI thread).

export type NormViewKey = { t: number; x: number; y: number; s: number; sx: number; r: number; o: number; e: Ease };
export type NormFigKey = { t: number; j: number[]; x: number; y: number; s: number; o: number; e: Ease };

function eased(f: number, e: Ease) {
  'worklet';
  if (e === 2) return 0;
  if (e === 1) return f;
  return f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
}

/** Index of the keyframe at or before t, and the eased progress to the next one. */
function locate(times: number[], eases: Ease[], t: number): [number, number] {
  'worklet';
  const n = times.length;
  if (n === 1 || t <= times[0]) return [0, 0];
  if (t >= times[n - 1]) return [n - 1, 0];
  let i = 0;
  while (i < n - 2 && t >= times[i + 1]) i++;
  const span = times[i + 1] - times[i];
  return [i, eased(span > 0 ? (t - times[i]) / span : 0, eases[i])];
}

/** Layer movement at time t: [x, y, scale, scaleX, rotation, opacity]. */
export function sampleView(keys: NormViewKey[] | null, shake: Shake | null, t: number): number[] {
  'worklet';
  let x = 0, y = 0, s = 1, sx = 1, r = 0, o = 1;
  if (keys && keys.length) {
    const [i, f] = locate(keys.map(k => k.t), keys.map(k => k.e), t);
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f; s = a.s + (b.s - a.s) * f;
    sx = a.sx + (b.sx - a.sx) * f; r = a.r + (b.r - a.r) * f; o = a.o + (b.o - a.o) * f;
  }
  if (shake) {
    let on = !shake.on;
    if (shake.on) for (const w of shake.on) if (t >= w[0] && t < w[1]) on = true;
    if (on) x += Math.sin(t * Math.PI * 2 * shake.cycles) * shake.amp;
  }
  return [x, y, s, sx, r, o];
}

/** Figure at time t: 22 joint coordinates (placed and scaled), then scale and opacity. */
export function sampleFigure(keys: NormFigKey[], t: number): number[] {
  'worklet';
  const [i, f] = locate(keys.map(k => k.t), keys.map(k => k.e), t);
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, s = a.s + (b.s - a.s) * f;
  const out: number[] = [];
  for (let k = 0; k < 22; k++) {
    const v = a.j[k] + (b.j[k] - a.j[k]) * f;
    out.push(v * s + (k % 2 === 0 ? x : y));
  }
  out.push(s, a.o + (b.o - a.o) * f);
  return out;
}

/** SVG path through joints (indices into the 11-joint list). */
export function jointPath(j: number[], chain: number[]): string {
  'worklet';
  let d = '';
  for (let k = 0; k < chain.length; k++) {
    const p = chain[k] * 2;
    d += (k === 0 ? 'M' : ' L') + j[p].toFixed(2) + ' ' + j[p + 1].toFixed(2);
  }
  return d;
}

/** Limb chains: arm = neck -> elbow -> hand, leg = pelvis -> knee -> foot. */
export const CHAINS = {
  backArm: [1, 3, 4], frontArm: [1, 5, 6], backLeg: [2, 7, 8], frontLeg: [2, 9, 10], torso: [1, 2],
};

// ---------------------------------------------------------------------------
// Builders

function normView(keys: ViewKey[]): NormViewKey[] {
  let prev: NormViewKey = { t: 0, x: 0, y: 0, s: 1, sx: 1, r: 0, o: 1, e: 0 };
  return [...keys].sort((a, b) => a.t - b.t).map(k => (prev = {
    t: k.t, x: k.x ?? prev.x, y: k.y ?? prev.y, s: k.s ?? prev.s, sx: k.sx ?? prev.sx, r: k.r ?? prev.r, o: k.o ?? prev.o, e: k.e ?? 0,
  }));
}

function normFigure(keys: FigKey[]): NormFigKey[] {
  let x = 0, dy = 0, s = 1, o = 1;
  return [...keys].sort((a, b) => a.t - b.t).map(k => {
    x = k.x ?? x; dy = k.dy ?? dy; s = k.s ?? s; o = k.o ?? o;
    // Scaling is about the box origin; push the figure down so its feet stay on the ground line.
    return { t: k.t, j: POSES[k.pose], x, y: 86 * (1 - s) + dy, s, o, e: k.e ?? 0 };
  });
}

export type NormLayer = { shapes: Shape[]; figure: NormFigKey[] | null; keys: NormViewKey[] | null; shake: Shake | null; origin: [number, number] | null };
export type NormScene = { ms: number; layers: NormLayer[] };

function scene(ms: number, layers: Layer[]): NormScene {
  return {
    ms,
    layers: layers.map(l => ({
      shapes: l.shapes ?? [],
      figure: l.figure ? normFigure(l.figure) : null,
      keys: l.keys ? normView(l.keys) : null,
      shake: l.shake ?? null,
      origin: l.origin ?? null,
    })),
  };
}

/**
 * A walk (or run / crawl) cycle from `from` to `to` ([x, dy]) between times t0 and t1. The number
 * of steps follows the distance and stride, so the feet do not slide. Fades in and out at the ends.
 */
function walk(o: {
  from: [number, number]; to: [number, number]; t0: number; t1: number; s?: number;
  cycle?: PoseName[]; stride?: number; fade?: boolean;
}): FigKey[] {
  const s = o.s ?? 1, cycle = o.cycle ?? ['walk1', 'pass1', 'walk2', 'pass2'], stride = (o.stride ?? 26) * s;
  const half = cycle.length / 2;
  const steps = Math.max(1, Math.round(Math.abs(o.to[0] - o.from[0]) / stride));
  const n = steps * half;
  const keys: FigKey[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    keys.push({
      t: o.t0 + (o.t1 - o.t0) * f, pose: cycle[i % cycle.length], e: 1, s,
      x: o.from[0] + (o.to[0] - o.from[0]) * f, dy: o.from[1] + (o.to[1] - o.from[1]) * f,
      o: o.fade !== false && (i === 0 || i === n) ? 0 : 1,
    });
  }
  return keys;
}

/** Blinks between full and faint `cycles` times per loop. */
function blink(cycles: number, from = 0): ViewKey[] {
  const keys: ViewKey[] = [{ t: 0, o: from > 0 ? 0 : 1, e: 2 }];
  const span = (1 - from) / cycles;
  for (let c = 0; c < cycles; c++) {
    const a = from + c * span;
    keys.push({ t: a, o: 1, e: 2 }, { t: a + span * 0.62, o: 0.2, e: 2 });
  }
  return keys;
}

/** Ring that grows and fades, `cycles` times from `from`. */
function ping(cycles: number, from = 0): ViewKey[] {
  const keys: ViewKey[] = [{ t: 0, s: 0.5, o: 0, e: 2 }];
  const span = (1 - from) / cycles;
  for (let c = 0; c < cycles; c++) {
    const a = from + c * span;
    keys.push({ t: a, s: 0.5, o: 1, e: 1 }, { t: a + span * 0.95, s: 1.6, o: 0, e: 2 });
  }
  return keys;
}

/** Back-and-forth movement or pulse: values alternate a / b, `cycles` times. */
function wave(cycles: number, a: Omit<ViewKey, 't'>, b: Omit<ViewKey, 't'>): ViewKey[] {
  const keys: ViewKey[] = [];
  for (let i = 0; i <= cycles * 2; i++) keys.push({ t: i / (cycles * 2), ...(i % 2 ? b : a) });
  return keys;
}

// ---------------------------------------------------------------------------
// Props

const GROUND: Shape = { k: 'path', d: 'M6 88 H94', stroke: 'muted', sw: 3 };
const TABLE: Shape[] = [
  { k: 'path', d: 'M22 50 V87 M78 50 V87', stroke: 'wood', sw: 4.5 },
  { k: 'rect', x: 14, y: 43, w: 72, h: 7, rx: 2, fill: 'wood' },
];
const noSign = (cx: number, cy: number, r: number): Shape[] => {
  const k = r * 0.7;
  return [
    { k: 'circle', cx, cy, r, stroke: 'no', sw: 4.5 },
    { k: 'path', d: `M${cx - k} ${cy - k} L${cx + k} ${cy + k}`, stroke: 'no', sw: 4.5 },
  ];
};
const doorway = (x: number, w = 20): Shape[] => [
  { k: 'rect', x, y: 34, w, h: 53, rx: 1.5, fill: 'dark', stroke: 'ink', sw: 2.5 },
];
const smoke = (y: number): Shape[] => [18, 32, 47, 62, 77, 91].map((cx, i) => ({ k: 'circle' as const, cx, cy: y - (i % 2) * 4, r: 9 + (i % 2) * 2, fill: 'smoke' as Color }));
const WAVES: Shape = { k: 'path', d: 'M6 94 Q14 90 22 94 T38 94 T54 94 T70 94 T86 94', stroke: 'tint', sw: 2.5 };

// ---------------------------------------------------------------------------
// Scenes

export const GUIDE_SCENES: Record<GuideVisualKind, NormScene> = {
  // Earthquake: stand -> crouch -> down on hands and knees, with a "down" arrow.
  drop: scene(3000, [
    { shapes: [GROUND] },
    { figure: [
      { t: 0, pose: 'stand', o: 0 }, { t: 0.06, pose: 'stand', o: 1 }, { t: 0.24, pose: 'stand' },
      { t: 0.4, pose: 'crouch' }, { t: 0.56, pose: 'kneel' }, { t: 0.92, pose: 'kneel', o: 1 }, { t: 1, pose: 'kneel', o: 0 },
    ] },
    { shapes: [{ k: 'path', d: 'M86 16 V38 M78 30 L86 38 L94 30', stroke: 'tint', sw: 5 }],
      keys: [{ t: 0, y: 0, o: 1 }, { t: 0.12, y: 7 }, { t: 0.24, y: 0 }, { t: 0.36, y: 7 }, { t: 0.46, y: 0, o: 1 }, { t: 0.54, o: 0 }, { t: 1, o: 0 }] },
  ]),

  // Crawl under the table while things fall and the room shakes, then cover the head.
  cover: scene(3000, [
    { shapes: [GROUND] },
    { shapes: [{ k: 'rect', x: 30, y: 6, w: 7, h: 7, fill: 'smoke' }, { k: 'rect', x: 62, y: 2, w: 6, h: 6, fill: 'smoke' }],
      keys: [{ t: 0, y: 0, o: 1, e: 1 }, { t: 0.42, y: 30, o: 0, e: 2 }, { t: 0.5, y: 0, o: 1, e: 1 }, { t: 0.92, y: 30, o: 0, e: 2 }, { t: 1, y: 0, o: 1 }] },
    { shapes: TABLE, shake: { amp: 1.6, cycles: 12 },
      figure: [
        { t: 0, pose: 'crawl1', x: -30, o: 0, e: 1 }, { t: 0.08, pose: 'crawl2', x: -23, o: 1, e: 1 },
        { t: 0.16, pose: 'crawl1', x: -15, e: 1 }, { t: 0.24, pose: 'crawl2', x: -7, e: 1 }, { t: 0.32, pose: 'crawl1', x: 0 },
        { t: 0.46, pose: 'coverKneel' }, { t: 0.93, pose: 'coverKneel', o: 1 }, { t: 1, pose: 'coverKneel', o: 0 },
      ] },
  ]),

  // Hold the table leg (one hand) and cover the head (the other) while it shakes.
  hold: scene(2600, [
    { shapes: [GROUND] },
    { shapes: [
        { k: 'path', d: 'M7 30 Q3 37 7 44 M11 26 Q5 37 11 48', stroke: 'tint', sw: 2.5 },
        { k: 'path', d: 'M93 30 Q97 37 93 44 M89 26 Q95 37 89 48', stroke: 'tint', sw: 2.5 },
      ], keys: blink(4) },
    { shapes: TABLE, shake: { amp: 2, cycles: 14 },
      figure: [{ t: 0, pose: 'coverKneel' }, { t: 0.18, pose: 'holdKneel' }, { t: 0.9, pose: 'holdKneel' }, { t: 1, pose: 'coverKneel' }] },
    { shapes: [{ k: 'circle', cx: 77, cy: 61, r: 7, stroke: 'tint', sw: 3 }], origin: [77, 61], keys: ping(2, 0.2) },
  ]),

  // Stay under cover while shaking; going out the door is crossed out.
  stay: scene(2800, [
    { shapes: [GROUND, WAVES], shake: { amp: 1.2, cycles: 10 } },
    { shapes: TABLE, figure: [{ t: 0, pose: 'coverKneel' }], keys: [{ t: 0, s: 0.68 }], origin: [4, 88], shake: { amp: 1.4, cycles: 12 } },
    { shapes: [...doorway(72), ...noSign(82, 60, 15)], keys: blink(3) },
  ]),

  // Walk out calmly towards the open exit.
  walk: scene(3400, [
    { shapes: [GROUND, ...doorway(72), { k: 'rect', x: 70, y: 22, w: 24, h: 9, rx: 1.5, fill: 'ok' },
      { k: 'text', x: 74.5, y: 29, text: 'EXIT', size: 7, fill: 'white' }] },
    { figure: walk({ from: [-40, 0], to: [22, 0], t0: 0, t1: 0.96, s: 0.85 }) },
  ]),

  // Walk down the stairs; the lift is crossed out.
  stairs: scene(3600, [
    { shapes: [
      { k: 'path', d: 'M2 38 H20 V48 H34 V58 H48 V68 H62 V78 H76 V88 H98', stroke: 'ink', sw: 3 },
      { k: 'rect', x: 70, y: 6, w: 24, h: 31, rx: 2, fill: 'light', stroke: 'ink', sw: 2 },
      { k: 'path', d: 'M82 9 V34', stroke: 'ink', sw: 1.5 },
    ] },
    { shapes: noSign(82, 21.5, 13), keys: blink(3) },
    { figure: walk({ from: [-14, -48], to: [42, -8], t0: 0, t1: 0.96, s: 0.52 }) },
  ]),

  // Move away from shaking, cracked windows.
  windows: scene(3200, [
    { shapes: [GROUND] },
    { shapes: [
      { k: 'rect', x: 6, y: 16, w: 30, h: 40, rx: 2, fill: 'glass', stroke: 'ink', sw: 2.5 },
      { k: 'path', d: 'M21 16 V56 M6 36 H36', stroke: 'ink', sw: 2 },
      { k: 'path', d: 'M11 21 L17 29 L13 33 M29 41 L33 48 L28 52', stroke: 'no', sw: 1.8 },
    ], shake: { amp: 1, cycles: 10 } },
    { shapes: noSign(21, 36, 21), keys: blink(3) },
    { figure: walk({ from: [-6, 0], to: [38, 0], t0: 0, t1: 0.96, s: 0.8 }) },
  ]),

  // Walk towards the EXIT sign; its arrow nudges the way.
  'exit-sign': scene(3200, [
    { shapes: [GROUND, { k: 'rect', x: 52, y: 8, w: 42, h: 22, rx: 3, fill: 'ok' }, { k: 'text', x: 58, y: 24, text: 'EXIT', size: 12, fill: 'white' }] },
    { shapes: [{ k: 'path', d: 'M60 40 H86 M79 33 L86 40 L79 47', stroke: 'ok', sw: 4.5 }], keys: wave(3, { x: 0 }, { x: 5 }) },
    { figure: walk({ from: [-30, 0], to: [16, 0], t0: 0, t1: 0.96, s: 0.8 }) },
  ]),

  // Building shakes in bursts; stand clear in the open, protecting the head.
  aftershock: scene(3000, [
    { shapes: [GROUND] },
    { shapes: [
      { k: 'rect', x: 8, y: 32, w: 38, h: 55, rx: 1.5, fill: 'light', stroke: 'ink', sw: 2.5 },
      { k: 'path', d: 'M15 42 h8 M31 42 h8 M15 56 h8 M31 56 h8 M15 70 h8 M31 70 h8', stroke: 'ink', sw: 4 },
    ], shake: { amp: 2.4, cycles: 18, on: [[0.04, 0.24], [0.54, 0.74]] } },
    { shapes: [
      { k: 'path', d: 'M60 5 L74 30 H46 Z', fill: 'tint' },
      { k: 'path', d: 'M60 13 V21', stroke: 'white', sw: 3.5 },
      { k: 'circle', cx: 60, cy: 25.5, r: 2, fill: 'white' },
    ], origin: [60, 20], keys: wave(2, { s: 1 }, { s: 1.12 }) },
    { figure: [{ t: 0, pose: 'guard', x: 42, s: 0.72 }] },
  ]),

  // Fire: run out through the door, away from the flames.
  'run-out': scene(2600, [
    { shapes: [GROUND, ...doorway(74)] },
    { shapes: [
      { k: 'path', d: 'M6 87 C2 72 12 64 10 50 C21 59 26 72 22 87 Z', fill: 'fire' },
      { k: 'path', d: 'M16 87 C14 76 22 70 22 61 C30 69 33 78 29 87 Z', fill: 'flame' },
    ], origin: [16, 87], keys: wave(4, { s: 1 }, { s: 1.08 }) },
    { figure: walk({ from: [-24, 0], to: [42, 0], t0: 0, t1: 0.96, s: 0.8, cycle: ['run1', 'runPass1', 'run2', 'runPass2'], stride: 26 }) },
  ]),

  // Crawl low under the smoke.
  'smoke-low': scene(3400, [
    { shapes: [GROUND] },
    { shapes: [...smoke(20), ...smoke(38)], keys: wave(1, { x: -4 }, { x: 4 }) },
    { shapes: [{ k: 'path', d: 'M90 48 V66 M84 60 L90 66 L96 60', stroke: 'tint', sw: 4 }], keys: blink(3) },
    { figure: walk({ from: [-28, 0], to: [18, 0], t0: 0, t1: 0.96, cycle: ['crawl1', 'crawl2'], stride: 10 }) },
  ]),

  // Raise a cloth over the nose and mouth while smoke drifts past.
  nose: scene(3000, [
    { shapes: [{ k: 'circle', cx: 8, cy: 28, r: 7, fill: 'smoke' }, { k: 'circle', cx: 16, cy: 22, r: 8, fill: 'smoke' },
      { k: 'circle', cx: 9, cy: 70, r: 7, fill: 'smoke' }, { k: 'circle', cx: 17, cy: 76, r: 6, fill: 'smoke' }],
      keys: [{ t: 0, x: 0, o: 0, e: 1 }, { t: 0.2, o: 0.8, e: 1 }, { t: 0.8, o: 0.8, e: 1 }, { t: 1, x: 16, o: 0 }] },
    { shapes: [
      { k: 'path', d: 'M22 100 Q24 68 50 66 Q76 68 78 100 Z', fill: 'ink' },
      { k: 'circle', cx: 50, cy: 42, r: 21, fill: 'skin', stroke: 'ink', sw: 3 },
      { k: 'circle', cx: 42, cy: 37, r: 2.6, fill: 'ink' }, { k: 'circle', cx: 58, cy: 37, r: 2.6, fill: 'ink' },
      { k: 'path', d: 'M46 30 Q42 28 38 30 M54 30 Q58 28 62 30', stroke: 'ink', sw: 2 },
    ] },
    { shapes: [
      { k: 'path', d: 'M28 102 Q28 78 38 58', stroke: 'limb', sw: 9 },
      { k: 'rect', x: 32, y: 45, w: 36, h: 16, rx: 6, fill: 'tint' },
    ], keys: [{ t: 0, y: 34, o: 0 }, { t: 0.08, o: 1 }, { t: 0.32, y: 0 }, { t: 0.9, y: 0, o: 1 }, { t: 1, y: 34, o: 0 }] },
  ]),

  // Walk away from the bag: leave belongings behind.
  belongings: scene(3200, [
    { shapes: [GROUND,
      { k: 'rect', x: 10, y: 56, w: 26, h: 31, rx: 6, fill: 'smoke', stroke: 'ink', sw: 2 },
      { k: 'path', d: 'M16 56 Q23 44 30 56', stroke: 'ink', sw: 2.5 },
      { k: 'rect', x: 15, y: 68, w: 16, h: 9, rx: 2, fill: 'muted' }] },
    { shapes: noSign(23, 70, 19), keys: blink(3) },
    { figure: walk({ from: [4, 0], to: [42, 0], t0: 0, t1: 0.96, s: 0.8 }) },
  ]),

  // Walk out through the door, then the door swings shut behind.
  door: scene(3600, [
    { shapes: [GROUND, ...doorway(60, 24)] },
    { figure: walk({ from: [-36, 0], to: [22, 0], t0: 0, t1: 0.5, s: 0.8 }) },
    { shapes: [{ k: 'rect', x: 60, y: 34, w: 24, h: 53, rx: 1.5, fill: 'tint', stroke: 'ink', sw: 2.5 }, { k: 'circle', cx: 79, cy: 62, r: 2.2, fill: 'white' }],
      origin: [60, 60], keys: [{ t: 0, sx: 0.1 }, { t: 0.55, sx: 0.1 }, { t: 0.72, sx: 1 }, { t: 0.94, sx: 1 }, { t: 1, sx: 0.1 }] },
  ]),

  // Safe outside: happy figure in the open, with a check mark.
  outside: scene(2800, [
    { shapes: [
      { k: 'path', d: 'M6 88 H94', stroke: 'grass', sw: 4 },
      { k: 'rect', x: 6, y: 50, w: 20, h: 37, fill: 'light', stroke: 'muted', sw: 2 },
      { k: 'rect', x: 84.5, y: 64, w: 3, h: 23, fill: 'wood' }, { k: 'circle', cx: 86, cy: 58, r: 10, fill: 'leaf' },
      { k: 'circle', cx: 16, cy: 18, r: 8, fill: 'sun' },
    ] },
    { figure: [
      { t: 0, pose: 'stand', x: 2 }, { t: 0.15, pose: 'cheer' }, { t: 0.3, pose: 'cheer', dy: -4 }, { t: 0.45, pose: 'cheer', dy: 0 },
      { t: 0.6, pose: 'cheer', dy: -4 }, { t: 0.75, pose: 'cheer', dy: 0 }, { t: 1, pose: 'stand' },
    ] },
    { shapes: [{ k: 'circle', cx: 78, cy: 22, r: 12, stroke: 'ok', sw: 3 }], origin: [78, 22], keys: ping(2) },
    { shapes: [
      { k: 'circle', cx: 78, cy: 22, r: 10, fill: 'ok' },
      { k: 'path', d: 'M73.5 22 L77 25.5 L83 18.5', stroke: 'white', sw: 3.5 },
    ] },
  ]),
};
