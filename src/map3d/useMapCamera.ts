import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation, Easing, runOnJS, useSharedValue, withDecay, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  cameraBasis, fitDistance, FOV_DEGREES, MAP_CENTER, MAX_DISTANCE, MAX_PITCH, MIN_DISTANCE, PITCH_3D,
  screenToGround, type CameraState,
} from './cameraMath';
import type { Point } from '../navigation/walkableGraph';

export type CameraValues = {
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  distance: SharedValue<number>;
  bearing: SharedValue<number>;
  pitch: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
  /**
   * The camera the 3D view last drew. Gestures change the values above on the UI thread at once,
   * but the 3D scene draws a frame or two later on the JS thread; screen overlays (labels, goal
   * pin) follow this snapshot so they stay glued to the buildings instead of sliding ahead.
   */
  rendered: SharedValue<CameraState>;
};

export function readCamera(c: CameraValues): CameraState {
  'worklet';
  return {
    targetX: c.targetX.value, targetY: c.targetY.value, distance: c.distance.value,
    bearing: c.bearing.value, pitch: c.pitch.value,
  };
}

const EASE = { duration: 650, easing: Easing.inOut(Easing.cubic) };
/** The camera's look-at point can't leave the campus (plus a small margin), map units. */
const BOUND_MIN = -20;
const BOUND_MAX = 820;
/** Furthest zoom-out, relative to the distance that fits the whole campus. */
const MAX_ZOOM_OUT = 1.2;
/** Follow mode turns the map only when the heading changes by more than this (degrees). */
const HEADING_DEADBAND = 12;
/** Taps and fling momentum are ignored this soon after two fingers were on the screen (ms). */
const MULTI_TOUCH_GRACE_MS = 400;
/** A one-finger release slower than this (px/s) stops the map instead of flinging it. */
const MIN_FLING_SPEED = 250;
/** Per-event pinch scale is clamped to this range (Android spikes when a finger lifts). */
const MIN_SCALE_STEP = 0.85;
const MAX_SCALE_STEP = 1.18;
const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

/** Shortest-path target angle for animating bearings across ±π. */
function nearestAngle(from: number, to: number) {
  'worklet';
  const twoPi = Math.PI * 2;
  let delta = ((to - from) % twoPi + twoPi) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  return from + delta;
}

type Options = {
  /** Single tap on the map, in map units. */
  onTap?: (point: Point) => void;
  /** Called when the user drags the map by hand (used to stop follow mode). */
  onUserMove?: () => void;
  /** Called once, after the first layout, so the map can set its opening view. */
  onFirstLayout?: () => void;
};

/** A rectangle in map units. */
export type MapBounds = { minX: number; minY: number; maxX: number; maxY: number };
/** Screen space covered by overlays (header, bottom card), px. */
export type ScreenInsets = { top: number; bottom: number };

/**
 * Orbit camera: one-finger pan, pinch zoom, two-finger twist to rotate and
 * two-finger vertical drag to tilt (3D only). Zoom and rotation pivot around
 * the fingers so the point under them stays put.
 */
export default function useMapCamera({ onTap, onUserMove, onFirstLayout }: Options) {
  const camera: CameraValues = {
    targetX: useSharedValue(MAP_CENTER),
    targetY: useSharedValue(MAP_CENTER),
    distance: useSharedValue(1100),
    bearing: useSharedValue(0),
    // The map opens flat (2D); navigation switches it to the tilted 3D view.
    pitch: useSharedValue(0),
    width: useSharedValue(0),
    height: useSharedValue(0),
    rendered: useSharedValue<CameraState>({ targetX: MAP_CENTER, targetY: MAP_CENTER, distance: 1100, bearing: 0, pitch: 0 }),
  };
  const maxDistance = useSharedValue(MAX_DISTANCE);
  const is3D = useSharedValue(false);
  const [mode3D, setMode3D] = useState(false);
  // 0 = undecided, 1 = tilting, 2 = pinch/rotate. Keeps tilt from fighting zoom.
  const twoFinger = useSharedValue(0);
  const pinchTotal = useSharedValue(1);
  const rotateTotal = useSharedValue(0);
  // Last time two fingers were down, and the pinch focal point of the previous event.
  const lastMultiTouch = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  /** Keep the ground point under (sx, sy) fixed while `change` alters the camera. */
  const pivot = (sx: number, sy: number, change: () => void) => {
    'worklet';
    const w = camera.width.value, h = camera.height.value;
    const before = screenToGround(cameraBasis(readCamera(camera), w, h), sx, sy);
    change();
    const after = screenToGround(cameraBasis(readCamera(camera), w, h), sx, sy);
    if (before && after) {
      camera.targetX.value = clamp(camera.targetX.value + before.x - after.x, BOUND_MIN, BOUND_MAX);
      camera.targetY.value = clamp(camera.targetY.value + before.y - after.y, BOUND_MIN, BOUND_MAX);
    }
  };

  const stopMotion = () => {
    'worklet';
    cancelAnimation(camera.targetX); cancelAnimation(camera.targetY);
    cancelAnimation(camera.distance); cancelAnimation(camera.bearing);
  };

  /** Move the map so the ground point under (fromX, fromY) ends up under (toX, toY). */
  const drag = (fromX: number, fromY: number, toX: number, toY: number) => {
    'worklet';
    const b = cameraBasis(readCamera(camera), camera.width.value, camera.height.value);
    const from = screenToGround(b, fromX, fromY);
    const to = screenToGround(b, toX, toY);
    if (!from || !to) return;
    let dx = from.x - to.x, dy = from.y - to.y;
    // Near the horizon in 3D a few pixels are a long way on the ground: cap one event's move.
    const limit = camera.distance.value * 0.25, len = Math.hypot(dx, dy);
    if (len > limit) { dx *= limit / len; dy *= limit / len; }
    camera.targetX.value = clamp(camera.targetX.value + dx, BOUND_MIN, BOUND_MAX);
    camera.targetY.value = clamp(camera.targetY.value + dy, BOUND_MIN, BOUND_MAX);
  };

  /** True while, or shortly after, two fingers were on the screen. */
  const recentMultiTouch = () => {
    'worklet';
    return Date.now() - lastMultiTouch.value < MULTI_TOUCH_GRACE_MS;
  };

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        stopMotion();
        if (onUserMove) runOnJS(onUserMove)();
      })
      .onChange(e => {
        // While two fingers are down the pinch moves the map; don't move it twice.
        if (e.numberOfPointers > 1) return;
        drag(e.x - e.changeX, e.y - e.changeY, e.x, e.y);
      })
      .onEnd(e => {
        // No fling when the pan ended because a second finger landed, or the release was slow.
        if (recentMultiTouch() || Math.hypot(e.velocityX, e.velocityY) < MIN_FLING_SPEED) return;
        // Momentum: convert the screen fling velocity to a ground velocity.
        const w = camera.width.value, h = camera.height.value;
        const b = cameraBasis(readCamera(camera), w, h);
        const a = screenToGround(b, w / 2, h / 2);
        const c = screenToGround(b, w / 2 + e.velocityX * 0.01, h / 2 + e.velocityY * 0.01);
        if (!a || !c) return;
        camera.targetX.value = withDecay({ velocity: -(c.x - a.x) * 100, deceleration: 0.985, clamp: [BOUND_MIN, BOUND_MAX] });
        camera.targetY.value = withDecay({ velocity: -(c.y - a.y) * 100, deceleration: 0.985, clamp: [BOUND_MIN, BOUND_MAX] });
      });

    const pinch = Gesture.Pinch()
      .onTouchesDown(e => { if (e.numberOfTouches > 1) lastMultiTouch.value = Date.now(); })
      .onStart(e => {
        stopMotion();
        pinchTotal.value = 1;
        focalX.value = e.focalX;
        focalY.value = e.focalY;
        lastMultiTouch.value = Date.now();
      })
      .onChange(e => {
        lastMultiTouch.value = Date.now();
        const fx = focalX.value, fy = focalY.value;
        focalX.value = e.focalX;
        focalY.value = e.focalY;
        // With one finger left the focal point and scale jump: ignore until two are down again.
        if (e.numberOfPointers < 2) return;
        const step = clamp(e.scaleChange, MIN_SCALE_STEP, MAX_SCALE_STEP);
        pinchTotal.value *= step;
        if (twoFinger.value === 0 && Math.abs(Math.log(pinchTotal.value)) > 0.06) twoFinger.value = 2;
        if (twoFinger.value === 1) return;
        // Two-finger drag moves the map with the fingers, then zoom around them.
        drag(fx, fy, e.focalX, e.focalY);
        pivot(e.focalX, e.focalY, () => {
          camera.distance.value = clamp(camera.distance.value / step, MIN_DISTANCE, maxDistance.value);
        });
      })
      .onFinalize(() => {
        lastMultiTouch.value = Date.now();
        pinchTotal.value = 1;
        twoFinger.value = 0;
      });

    const rotate = Gesture.Rotation()
      .onStart(() => { rotateTotal.value = 0; lastMultiTouch.value = Date.now(); })
      .onChange(e => {
        lastMultiTouch.value = Date.now();
        if (e.numberOfPointers < 2) return;
        rotateTotal.value += e.rotationChange;
        if (twoFinger.value === 0 && Math.abs(rotateTotal.value) > 0.09) twoFinger.value = 2;
        if (twoFinger.value === 1) return;
        pivot(e.anchorX, e.anchorY, () => {
          camera.bearing.value -= e.rotationChange;
        });
      })
      .onFinalize(() => {
        lastMultiTouch.value = Date.now();
        rotateTotal.value = 0;
        twoFinger.value = 0;
      });

    const tilt = Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onChange(e => {
        if (!is3D.value) return;
        if (twoFinger.value === 0 && Math.abs(e.translationY) > 14 &&
            Math.abs(Math.log(pinchTotal.value)) < 0.06 && Math.abs(rotateTotal.value) < 0.09) {
          twoFinger.value = 1;
        }
        if (twoFinger.value !== 1) return;
        camera.pitch.value = clamp(camera.pitch.value - e.changeY * 0.3, 0, MAX_PITCH);
      })
      .onFinalize(() => { twoFinger.value = 0; });

    // Taps right after a two-finger touch are ignored: two quick pinches must never count as a double-tap zoom.
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(10)
      .maxDelay(300)
      .onEnd(e => {
        if (recentMultiTouch()) return;
        const b = cameraBasis(readCamera(camera), camera.width.value, camera.height.value);
        const p = screenToGround(b, e.x, e.y);
        if (p) {
          camera.targetX.value = withTiming((camera.targetX.value + p.x) / 2, EASE);
          camera.targetY.value = withTiming((camera.targetY.value + p.y) / 2, EASE);
        }
        camera.distance.value = withTiming(clamp(camera.distance.value / 2, MIN_DISTANCE, maxDistance.value), EASE);
      });

    const singleTap = Gesture.Tap()
      .maxDuration(250)
      .maxDistance(10)
      .onEnd(e => {
        if (!onTap || recentMultiTouch()) return;
        const b = cameraBasis(readCamera(camera), camera.width.value, camera.height.value);
        const p = screenToGround(b, e.x, e.y);
        if (p) runOnJS(onTap)({ x: p.x, y: p.y });
      });

    return Gesture.Simultaneous(Gesture.Exclusive(doubleTap, singleTap), pan, pinch, rotate, tilt);
  }, [onTap, onUserMove]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const first = camera.width.value === 0;
    camera.width.value = width;
    camera.height.value = height;
    maxDistance.value = Math.min(MAX_DISTANCE, fitDistance(width, height) * MAX_ZOOM_OUT);
    if (first) camera.distance.value = fitDistance(width, height);
    else camera.distance.value = clamp(camera.distance.value, MIN_DISTANCE, maxDistance.value);
    if (first && width > 0 && onFirstLayout) onFirstLayout();
  }, [onFirstLayout]);

  const zoomBy = useCallback((factor: number) => {
    stopMotion();
    camera.distance.value = withTiming(clamp(camera.distance.value / factor, MIN_DISTANCE, maxDistance.value), EASE);
  }, []);

  const setMode = useCallback((threeD: boolean) => {
    is3D.value = threeD;
    setMode3D(threeD);
    camera.pitch.value = withTiming(threeD ? PITCH_3D : 0, { duration: 700, easing: Easing.inOut(Easing.cubic) });
  }, []);

  /**
   * Frame a map rectangle inside the part of the screen that overlays do not cover. The tilt
   * shortens the north-south depth on screen, so the distance is worked out for the box as seen
   * at the current pitch, and the target is shifted so the box sits in the middle of the free area.
   */
  const fitBounds = useCallback((box: MapBounds, insets: ScreenInsets = { top: 0, bottom: 0 },
    opts: { animate?: boolean; padding?: number; resetBearing?: boolean; done?: () => void } = {}) => {
    const w = camera.width.value, h = camera.height.value;
    if (!w || !h) return;
    const { animate = true, padding = 0.12, resetBearing = true, done } = opts;
    stopMotion();
    const bearing = resetBearing ? nearestAngle(camera.bearing.value, 0) : camera.bearing.value;
    const pitch = (camera.pitch.value * Math.PI) / 180;
    const tanHalf = Math.tan((FOV_DEGREES * Math.PI) / 360);
    const free = Math.max(140, h - insets.top - insets.bottom);
    // Box extent along the screen's up/down and left/right directions for this bearing.
    const ex = box.maxX - box.minX, ey = box.maxY - box.minY;
    const c = Math.abs(Math.cos(bearing)), s = Math.abs(Math.sin(bearing));
    const across = (ex * c + ey * s) * (1 + padding), depth = (ex * s + ey * c) * (1 + padding);
    const foreshorten = 0.45 + 0.55 * Math.cos(pitch);
    const dDepth = (depth * foreshorten / 2) / tanHalf * (h / free);
    const dAcross = (across / 2) / tanHalf * (h / w);
    const distance = clamp(Math.max(dDepth, dAcross), MIN_DISTANCE, maxDistance.value);
    // Move the target toward the bottom of the screen by half the inset difference, so the box
    // appears centred in the free area (screen-down in map units is (-sin b, cos b)).
    const worldPerPx = (2 * distance * tanHalf) / h / foreshorten;
    const shift = ((insets.bottom - insets.top) / 2) * worldPerPx;
    const tx = (box.minX + box.maxX) / 2 - Math.sin(bearing) * shift;
    const ty = (box.minY + box.maxY) / 2 + Math.cos(bearing) * shift;
    if (!animate) {
      camera.targetX.value = tx; camera.targetY.value = ty; camera.distance.value = distance; camera.bearing.value = bearing;
      done?.();
      return;
    }
    const ease = { duration: 900, easing: Easing.inOut(Easing.cubic) };
    camera.targetX.value = withTiming(tx, ease, finished => { if (finished && done) runOnJS(done)(); });
    camera.targetY.value = withTiming(ty, ease);
    camera.distance.value = withTiming(distance, ease);
    camera.bearing.value = withTiming(bearing, ease);
  }, []);

  const fit = useCallback(() => {
    stopMotion();
    camera.targetX.value = withTiming(MAP_CENTER, EASE);
    camera.targetY.value = withTiming(MAP_CENTER, EASE);
    camera.bearing.value = withTiming(nearestAngle(camera.bearing.value, 0), EASE);
    camera.distance.value = withTiming(fitDistance(camera.width.value, camera.height.value), EASE);
  }, []);

  /** Glide to a point, then call `done` once the camera has settled. */
  const focusOnPoint = useCallback((p: Point, done?: () => void, distance = 340) => {
    stopMotion();
    camera.targetX.value = withTiming(p.x, { duration: 900, easing: Easing.inOut(Easing.cubic) }, finished => {
      if (finished && done) runOnJS(done)();
    });
    camera.targetY.value = withTiming(p.y, { duration: 900, easing: Easing.inOut(Easing.cubic) });
    camera.distance.value = withTiming(Math.min(camera.distance.value, distance), { duration: 900 });
  }, []);

  /** Follow mode: keep the user centred (same glide as the marker, so it stays put on screen). */
  const follow = useCallback((p: Point) => {
    const glide = { duration: 700, easing: Easing.out(Easing.quad) };
    camera.targetX.value = withTiming(p.x, glide);
    camera.targetY.value = withTiming(p.y, glide);
  }, []);
  /** Follow mode: turn the map to the phone's heading, ignoring small compass wobble. */
  const lastBearing = useSharedValue<number | null>(null);
  const followHeading = useCallback((headingDegrees: number | null, force = false) => {
    if (headingDegrees == null) return;
    const want = (headingDegrees * Math.PI) / 180;
    const prev = lastBearing.value;
    if (!force && prev != null && Math.abs(nearestAngle(prev, want) - prev) < (HEADING_DEADBAND * Math.PI) / 180) return;
    lastBearing.value = want;
    camera.bearing.value = withTiming(nearestAngle(camera.bearing.value, want), { duration: 800, easing: Easing.inOut(Easing.quad) });
  }, []);

  return { camera, gesture, onLayout, zoomIn: () => zoomBy(1.6), zoomOut: () => zoomBy(1 / 1.6), setMode, mode3D, fit, fitBounds, focusOnPoint, follow, followHeading };
}
