/**
 * Orbit camera maths shared by the Three.js camera (JS thread) and the
 * label / gesture worklets (UI thread). Keep both sides on these functions so
 * labels and taps line up exactly with the rendered scene.
 *
 * World axes: X = map x - 400, Z = map y - 400, Y = up. Map units throughout.
 */
export const FOV_DEGREES = 28;
export const MAP_CENTER = 400;
export const MIN_DISTANCE = 90;
export const MAX_DISTANCE = 4200;
export const PITCH_3D = 52;
export const MAX_PITCH = 68;

export type CameraState = {
  /** Ground point the camera looks at, in map units. */
  targetX: number;
  targetY: number;
  distance: number;
  /** Radians. 0 = map-up (north of the SVG) is screen-up. */
  bearing: number;
  /** Degrees from straight down. 0 = 2D top-down. */
  pitch: number;
};

export type Vec3 = [number, number, number];
export type CameraBasis = {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  /** Camera looks along -back. */
  back: Vec3;
  focal: number;
  width: number;
  height: number;
};

export function cameraBasis(s: CameraState, width: number, height: number): CameraBasis {
  'worklet';
  const pitch = (s.pitch * Math.PI) / 180;
  const fx = Math.sin(s.bearing), fz = -Math.cos(s.bearing); // screen-up direction on the ground
  const tx = s.targetX - MAP_CENTER, tz = s.targetY - MAP_CENTER;
  const eye: Vec3 = [
    tx - fx * s.distance * Math.sin(pitch),
    s.distance * Math.cos(pitch),
    tz - fz * s.distance * Math.sin(pitch),
  ];
  let bx = eye[0] - tx, by = eye[1], bz = eye[2] - tz;
  const bl = Math.hypot(bx, by, bz) || 1;
  bx /= bl; by /= bl; bz /= bl;
  // right = upHint x back, with upHint = ground forward (valid even when looking straight down)
  let rx = 0 * bz - fz * by, ry = fz * bx - fx * bz, rz = fx * by - 0 * bx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const ux = by * rz - bz * ry, uy = bz * rx - bx * rz, uz = bx * ry - by * rx;
  const focal = height / 2 / Math.tan((FOV_DEGREES * Math.PI) / 360);
  return { eye, right: [rx, ry, rz], up: [ux, uy, uz], back: [bx, by, bz], focal, width, height };
}

/** Map point (x, y, height) -> screen pixels; visible=false when behind the camera. */
export function worldToScreen(b: CameraBasis, x: number, y: number, h = 0) {
  'worklet';
  const vx = x - MAP_CENTER - b.eye[0], vy = h - b.eye[1], vz = y - MAP_CENTER - b.eye[2];
  const depth = -(vx * b.back[0] + vy * b.back[1] + vz * b.back[2]);
  if (depth < 1) return { x: 0, y: 0, depth, visible: false };
  const cx = vx * b.right[0] + vy * b.right[1] + vz * b.right[2];
  const cy = vx * b.up[0] + vy * b.up[1] + vz * b.up[2];
  return {
    x: b.width / 2 + (cx / depth) * b.focal,
    y: b.height / 2 - (cy / depth) * b.focal,
    depth,
    visible: true,
  };
}

/** Screen pixels -> map point on the ground (or at height h). Null above the horizon. */
export function screenToGround(b: CameraBasis, sx: number, sy: number, h = 0) {
  'worklet';
  const a = (sx - b.width / 2) / b.focal;
  const c = -(sy - b.height / 2) / b.focal;
  const dx = -b.back[0] + b.right[0] * a + b.up[0] * c;
  const dy = -b.back[1] + b.right[1] * a + b.up[1] * c;
  const dz = -b.back[2] + b.right[2] * a + b.up[2] * c;
  if (dy > -1e-4) return null;
  const t = (h - b.eye[1]) / dy;
  return { x: b.eye[0] + dx * t + MAP_CENTER, y: b.eye[2] + dz * t + MAP_CENTER };
}

/** Distance at which the whole 800-unit campus fits the shorter screen side. */
export function fitDistance(width: number, height: number, span = 820): number {
  'worklet';
  const vertical = span / 2 / Math.tan((FOV_DEGREES * Math.PI) / 360);
  const aspect = width > 0 && height > 0 ? width / height : 1;
  return Math.min(MAX_DISTANCE, aspect < 1 ? vertical / aspect : vertical);
}
