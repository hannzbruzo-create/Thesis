import type { GpsFix } from './campusGps';

/**
 * Smooths walking GPS with a constant-velocity Kalman filter (position + velocity, east and north
 * handled independently in local metres). Each fix is weighted by its reported accuracy, so a
 * ±15 m reading barely moves the estimate while a ±3 m one moves it a lot. Fixes that would need
 * an impossible jump (faster than running) are rejected as outliers.
 *
 * The filter never invents a position: until the first fix arrives it returns nothing, and after
 * a long gap it restarts from the next fix.
 *
 * Between fixes it also uses the phone's own sensors (pedestrian dead reckoning):
 * - each detected step (accelerometer) moves the estimate one step length along the compass
 *   heading (magnetometer), so the marker moves with you instead of waiting for the next fix;
 * - when the step detector is running and no steps are seen, you are standing still, so the
 *   estimate is held in place and successive fixes are averaged (GPS wander cancels out).
 */

/** How quickly a walker can change speed (m/s²); larger follows turns faster but smooths less. */
const ACCELERATION_NOISE = 0.6;
/** Faster than this between fixes is treated as a GPS jump, not movement (m/s). */
const MAX_SPEED = 7;
/** Restart after this long without an accepted fix (ms). */
const RESET_AFTER_MS = 15000;
/** Accuracy assumed when the phone reports none (m). */
const DEFAULT_ACCURACY = 10;
/** Outlier gate: reject a fix this many standard deviations away (combined uncertainty). */
const GATE_SIGMA = 4;
/** Average walking step (m) and its uncertainty per step (m). */
const STEP_LENGTH = 0.7;
const STEP_SIGMA = 0.35;
/** No step for this long (ms) while the step detector runs means standing still. */
const STILL_AFTER_MS = 2000;
/** Position noise added per second (m²/s) when the motion is known from steps, or standing still. */
const STEP_HOLD_NOISE = 0.05;
const STILL_HOLD_NOISE = 0.4;
/** After GPS contradicts "standing still", ignore stillness for this long (ms). */
const STILL_OFF_MS = 15000;

type Axis = { p: number; v: number; pp: number; pv: number; vv: number };
const METRES_PER_DEG_LAT = 111320;

export type FilteredFix = GpsFix & {
  /** Estimated speed (m/s) from the filter. */
  speed: number;
  /** True when this reading was rejected and the estimate was only predicted forward. */
  rejected: boolean;
};

export class GpsKalmanFilter {
  private east: Axis | null = null;
  private north: Axis | null = null;
  private origin: { lat: number; lon: number; mPerDegLon: number } | null = null;
  private lastTime = 0;
  private consecutiveRejects = 0;
  /** Dead reckoning since the last fix: displacement from steps (m) and whether any step had no heading. */
  private stepE = 0;
  private stepN = 0;
  private steps = 0;
  private stepsWithoutHeading = 0;
  private lastStepTime = 0;
  private stillMisses = 0;
  private stillOffUntil = 0;
  /** True while a step detector feeds this filter (enables the standing-still hold). */
  stepDetector = false;

  reset() {
    this.east = this.north = this.origin = null; this.lastTime = 0; this.consecutiveRejects = 0;
    this.stepE = this.stepN = this.steps = this.stepsWithoutHeading = 0; this.lastStepTime = 0;
    this.stillMisses = 0; this.stillOffUntil = 0;
  }

  /**
   * One detected step. With a compass heading (degrees from north) the estimate moves one step
   * that way right away; returns the new estimate, or null before the first fix.
   */
  step(headingDeg: number | null, time: number): FilteredFix | null {
    this.lastStepTime = time;
    if (!this.origin || !this.east || !this.north) return null;
    this.steps++;
    if (headingDeg == null || !Number.isFinite(headingDeg)) { this.stepsWithoutHeading++; return null; }
    const h = (headingDeg * Math.PI) / 180, dE = STEP_LENGTH * Math.sin(h), dN = STEP_LENGTH * Math.cos(h);
    this.east = { ...this.east, p: this.east.p + dE, pp: this.east.pp + STEP_SIGMA * STEP_SIGMA };
    this.north = { ...this.north, p: this.north.p + dN, pp: this.north.pp + STEP_SIGMA * STEP_SIGMA };
    this.stepE += dE; this.stepN += dN;
    return this.output({ latitude: 0, longitude: 0, accuracy: null, timestamp: time }, false);
  }

  update(fix: GpsFix): FilteredFix {
    const accuracy = fix.accuracy != null && Number.isFinite(fix.accuracy) && fix.accuracy > 0 ? fix.accuracy : DEFAULT_ACCURACY;
    if (!this.origin || !this.east || !this.north || fix.timestamp - this.lastTime > RESET_AFTER_MS || fix.timestamp < this.lastTime) {
      return this.start(fix, accuracy);
    }
    const dt = Math.max(0.05, (fix.timestamp - this.lastTime) / 1000);
    const [x, y] = this.toLocal(fix.latitude, fix.longitude);
    const r = accuracy * accuracy;

    // Predict both axes forward: from the steps taken (already applied), from standing still,
    // or, without step information, from the estimated velocity.
    const still = this.stepDetector && this.steps === 0 && fix.timestamp - this.lastStepTime > STILL_AFTER_MS &&
      fix.timestamp >= this.stillOffUntil;
    const stepped = this.steps > 0 && this.stepsWithoutHeading === 0;
    const e = stepped ? hold(this.east, dt, this.stepE / dt, STEP_HOLD_NOISE) : still ? hold(this.east, dt, 0, STILL_HOLD_NOISE) : predict(this.east, dt);
    const n = stepped ? hold(this.north, dt, this.stepN / dt, STEP_HOLD_NOISE) : still ? hold(this.north, dt, 0, STILL_HOLD_NOISE) : predict(this.north, dt);
    this.stepE = this.stepN = this.steps = this.stepsWithoutHeading = 0;
    // Reject jumps: the reading must be plausible given the prediction and both uncertainties
    // (Mahalanobis gate), and not need a faster-than-running move.
    const dx = x - e.p, dy = y - n.p;
    const d2 = (dx * dx) / (e.pp + r) + (dy * dy) / (n.pp + r);
    // GPS keeps disagreeing with "standing still": steps are being missed (phone in a bag or
    // pocket), so stop assuming stillness for a while and follow the GPS normally.
    if (still) {
      if (d2 > 3 && ++this.stillMisses >= 2) { this.stillOffUntil = fix.timestamp + STILL_OFF_MS; this.stillMisses = 0; }
      else if (d2 <= 3) this.stillMisses = 0;
    }
    const tooFar = d2 > GATE_SIGMA * GATE_SIGMA || Math.hypot(dx, dy) > MAX_SPEED * dt + 3 * accuracy;
    if (tooFar && this.consecutiveRejects < 3) {
      this.consecutiveRejects++;
      this.east = e; this.north = n; this.lastTime = fix.timestamp;
      return this.output(fix, true);
    }
    // Several rejections in a row means we were probably wrong (e.g. after a tunnel): re-anchor.
    if (tooFar) return this.start(fix, accuracy);

    this.consecutiveRejects = 0;
    this.east = correct(e, x, r);
    this.north = correct(n, y, r);
    this.lastTime = fix.timestamp;
    return this.output(fix, false);
  }

  private start(fix: GpsFix, accuracy: number): FilteredFix {
    const mPerDegLon = METRES_PER_DEG_LAT * Math.cos((fix.latitude * Math.PI) / 180);
    this.origin = { lat: fix.latitude, lon: fix.longitude, mPerDegLon };
    const r = accuracy * accuracy;
    this.east = { p: 0, v: 0, pp: r, pv: 0, vv: 4 };
    this.north = { p: 0, v: 0, pp: r, pv: 0, vv: 4 };
    this.lastTime = fix.timestamp;
    this.consecutiveRejects = 0;
    return this.output(fix, false);
  }

  private toLocal(lat: number, lon: number): [number, number] {
    const o = this.origin!;
    return [(lon - o.lon) * o.mPerDegLon, (lat - o.lat) * METRES_PER_DEG_LAT];
  }

  private output(fix: GpsFix, rejected: boolean): FilteredFix {
    const o = this.origin!, e = this.east!, n = this.north!;
    return {
      latitude: o.lat + n.p / METRES_PER_DEG_LAT,
      longitude: o.lon + e.p / o.mPerDegLon,
      // Combined 1-sigma horizontal uncertainty of the estimate.
      accuracy: Math.sqrt((e.pp + n.pp) / 2),
      timestamp: fix.timestamp,
      speed: Math.hypot(e.v, n.v),
      rejected,
    };
  }
}

/** Constant-velocity prediction with white-acceleration process noise. */
function predict(a: Axis, dt: number): Axis {
  const q = ACCELERATION_NOISE * ACCELERATION_NOISE;
  const dt2 = dt * dt, dt3 = dt2 * dt, dt4 = dt3 * dt;
  return {
    p: a.p + a.v * dt,
    v: a.v,
    pp: a.pp + 2 * dt * a.pv + dt2 * a.vv + (q * dt4) / 4,
    pv: a.pv + dt * a.vv + (q * dt3) / 2,
    vv: a.vv + q * dt2,
  };
}

/**
 * Prediction when the motion is already known: the position was moved by the steps (or you stood
 * still), so only a little uncertainty is added and the velocity is set from the steps.
 */
function hold(a: Axis, dt: number, velocity: number, noise: number): Axis {
  return { p: a.p, v: velocity, pp: a.pp + noise * dt, pv: 0, vv: 1 };
}

/** Position-only measurement update with variance r. */
function correct(a: Axis, z: number, r: number): Axis {
  const s = a.pp + r;
  const kp = a.pp / s, kv = a.pv / s;
  const y = z - a.p;
  return {
    p: a.p + kp * y,
    v: a.v + kv * y,
    pp: (1 - kp) * a.pp,
    pv: (1 - kp) * a.pv,
    vv: a.vv - kv * a.pv,
  };
}
