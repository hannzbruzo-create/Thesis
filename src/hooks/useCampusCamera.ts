import { useCallback, useState } from 'react';
import { Dimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Point } from '../navigation/roadGraph';
import {
  MAP_PERSPECTIVE,
  mapToScreenOffset,
  screenToMapOffset,
} from '../utils/mapProjection';

/**
 * Gesture behavior migrated from the user's working OLD src/app/index.tsx.
 * It deliberately preserves the original focal anchoring, pan limits,
 * perspective projection, pinch scale exponent and transform ordering.
 *
 * Only map-camera concerns belong here; no GPS or legacy route code.
 */
const MAP_SIZE = 1200;
const CONTEXT_SIZE = MAP_SIZE * (1200 / 800);
const MIN_ZOOM = 0.22;
const MAX_ZOOM = 4;
const TILT = 24;
// Gentle, longer camera travel; manual pinch/pan timings are unchanged.
const ROUTE_FOCUS_DURATION_MS = 1250;

// A quintic easing curve: position, velocity AND acceleration settle to
// zero at the ends. Route focus only animates position and zoom.
const smootherStep = (value: number) => {
  'worklet';
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const SPRING_CONFIG = {
  damping: 26,
  stiffness: 190,
  mass: 0.85,
  overshootClamping: true,
};
const TILT_SPRING = {
  damping: 21,
  stiffness: 78,
  mass: 1.15,
  overshootClamping: true,
};
const SCREEN = Dimensions.get('window');

export default function useCampusCamera(onMapTap?: (position: Point) => void) {
  const [viewportSize, setViewportSize] = useState({
    width: SCREEN.width,
    height: SCREEN.height,
  });
  const [zoomDisplay, setZoomDisplay] = useState(1);
  const [isTilted, setIsTilted] = useState(false);

  const mapTilt = useSharedValue(0);
  const hasUserMovedMap = useSharedValue(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const pinchAnchorReady = useSharedValue(false);
  const pinchActive = useSharedValue(false);
  const buttonZoomActive = useSharedValue(false);
  const buttonZoomAnchorX = useSharedValue(0);
  const buttonZoomAnchorY = useSharedValue(0);

  // Programmatic camera travel: animated on the UI thread, independently from
  // pinch/pan, using the legacy projection at EVERY animation frame.
  const focusProgress = useSharedValue(0);
  const focusActive = useSharedValue(false);
  const focusAnchorX = useSharedValue(0);
  const focusAnchorY = useSharedValue(0);
  // Where the selected marker appeared on screen when the flight started.
  // This is used to move the marker smoothly into the center independently
  // of scale/perspective changes (avoids camera arcs and apparent jumps).
  const focusStartScreenX = useSharedValue(0);
  const focusStartScreenY = useSharedValue(0);
  const focusFromScale = useSharedValue(1);
  const focusFromTilt = useSharedValue(0);
  const focusToScale = useSharedValue(1.8);

  // Derive the whole camera pose from one UI-thread animation clock.
  // The map is drawn on ONE animated native view; route focus preserves tilt
  // while smoothly updating zoom/pan instead of toggling 2D and 2.5D.
  const getFocusPose = (progress: number) => {
    'worklet';
    const glide = smootherStep(progress);
    const zoomEase = smootherStep(progress);
    const nextScale = focusFromScale.value +
      (focusToScale.value - focusFromScale.value) * zoomEase;
    // Route calculation never changes the user's selected viewing mode.
    // Keep the current tilt fixed throughout the camera flight (2D stays 2D,
    // 2.5D stays 2.5D). Only the dedicated 2D/3D button changes tilt.
    const nextTilt = focusFromTilt.value;
    const projected = mapToScreenOffset(
      focusAnchorX.value, focusAnchorY.value, nextScale, nextTilt
    );
    return {
      scale: nextScale,
      tilt: nextTilt,
      x: focusStartScreenX.value * (1 - glide) - projected.x,
      y: focusStartScreenY.value * (1 - glide) - projected.y,
    };
  };

  const currentPose = useDerivedValue(() => {
    if (focusActive.value) return getFocusPose(focusProgress.value);
    return {
      scale: scale.value,
      tilt: mapTilt.value,
      x: translateX.value,
      y: translateY.value,
    };
  });

  // Snap the real gesture values to the same projected position BEFORE a
  // cancelled flight releases control. This prevents the one-frame jump when
  // a user pinches, pans or recalculates during the camera animation.
  const cancelFocus = () => {
    'worklet';
    if (!focusActive.value) return;
    const pose = getFocusPose(focusProgress.value);
    cancelAnimation(focusProgress);
    scale.value = pose.scale;
    mapTilt.value = pose.tilt;
    translateX.value = pose.x;
    translateY.value = pose.y;
    savedScale.value = pose.scale;
    savedTranslateX.value = pose.x;
    savedTranslateY.value = pose.y;
    focusActive.value = false;
  };

  const getPanBounds = (currentScale: number) => {
    'worklet';
    const scaledContextSize = CONTEXT_SIZE * currentScale;
    return {
      x: Math.max(0, (scaledContextSize - viewportSize.width) / 2),
      y: Math.max(0, (scaledContextSize - viewportSize.height) / 2),
    };
  };

  const clampMapTranslation = (proposedX: number, proposedY: number, currentScale: number) => {
    'worklet';
    const limits = getPanBounds(currentScale);
    return {
      x: Math.max(-limits.x, Math.min(limits.x, proposedX)),
      y: Math.max(-limits.y, Math.min(limits.y, proposedY)),
    };
  };

  // EXACT original pan interaction: single finger, pan bounds, slight inertial decay.
  const panGesture = Gesture.Pan()
    .minDistance(5)
    .maxPointers(1)
    .onStart(() => {
      if (pinchActive.value) return;
      cancelFocus();
      hasUserMovedMap.value = true;
      buttonZoomActive.value = false;
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (pinchActive.value || event.numberOfPointers !== 1) return;
      const next = clampMapTranslation(
        savedTranslateX.value + event.translationX,
        savedTranslateY.value + event.translationY,
        scale.value
      );
      translateX.value = next.x;
      translateY.value = next.y;
    })
    .onEnd((event) => {
      if (pinchActive.value || event.numberOfPointers > 1) return;
      const limits = getPanBounds(scale.value);
      if (limits.x > 0) {
        translateX.value = withDecay({
          velocity: event.velocityX * 0.55,
          deceleration: 0.993,
          clamp: [-limits.x, limits.x],
        });
      }
      if (limits.y > 0) {
        translateY.value = withDecay({
          velocity: event.velocityY * 0.55,
          deceleration: 0.993,
          clamp: [-limits.y, limits.y],
        });
      }
    });

  // EXACT original pinch interaction: use first valid focal as a fixed
  // screen anchor, apply 0.93 sensitivity and solve translations using
  // the legacy projection math at each new zoom value.
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      cancelFocus();
      hasUserMovedMap.value = true;
      pinchActive.value = true;
      buttonZoomActive.value = false;
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(mapTilt);
      savedScale.value = scale.value;
      pinchAnchorReady.value = false;

      const fx = event.focalX;
      const fy = event.focalY;
      if (Number.isFinite(fx) && Number.isFinite(fy) && !(fx === 0 && fy === 0)) {
        pinchFocalX.value = fx - viewportSize.width / 2;
        pinchFocalY.value = fy - viewportSize.height / 2;
        const anchor = screenToMapOffset(
          pinchFocalX.value - translateX.value,
          pinchFocalY.value - translateY.value,
          scale.value,
          mapTilt.value
        );
        pinchStartX.value = anchor.x;
        pinchStartY.value = anchor.y;
        pinchAnchorReady.value = true;
      }
    })
    .onUpdate((event) => {
      if (!pinchAnchorReady.value) {
        if (!Number.isFinite(event.focalX) || !Number.isFinite(event.focalY) ||
            (event.focalX === 0 && event.focalY === 0)) return;
        pinchFocalX.value = event.focalX - viewportSize.width / 2;
        pinchFocalY.value = event.focalY - viewportSize.height / 2;
        const anchor = screenToMapOffset(
          pinchFocalX.value - translateX.value,
          pinchFocalY.value - translateY.value,
          scale.value,
          mapTilt.value
        );
        pinchStartX.value = anchor.x;
        pinchStartY.value = anchor.y;
        savedScale.value = scale.value / Math.pow(Math.max(event.scale, 0.01), 0.93);
        pinchAnchorReady.value = true;
      }
      const nextScale = Math.max(MIN_ZOOM, Math.min(
        MAX_ZOOM,
        savedScale.value * Math.pow(Math.max(event.scale, 0.01), 0.93)
      ));
      const anchorScreen = mapToScreenOffset(
        pinchStartX.value,
        pinchStartY.value,
        nextScale,
        mapTilt.value
      );
      const next = clampMapTranslation(
        pinchFocalX.value - anchorScreen.x,
        pinchFocalY.value - anchorScreen.y,
        nextScale
      );
      translateX.value = next.x;
      translateY.value = next.y;
      scale.value = nextScale;
    })
    .onFinalize(() => {
      pinchActive.value = false;
      pinchAnchorReady.value = false;
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(setZoomDisplay)(Math.round(scale.value * 100) / 100);
    });

  // Development-only selection: convert screen tap to unprojected 800x800 SVG pixels.
  // The same inverse projection as the original smooth pinch prevents 2.5D offsets.
  const tapGesture = Gesture.Tap().maxDistance(9).onEnd((event, success) => {
    if (!success || !onMapTap || !__DEV__) return;
    cancelFocus();
    const anchor = screenToMapOffset(
      event.x - viewportSize.width / 2 - translateX.value,
      event.y - viewportSize.height / 2 - translateY.value,
      scale.value,
      mapTilt.value
    );
    const x = (anchor.x + MAP_SIZE / 2) * 800 / MAP_SIZE;
    const y = (anchor.y + MAP_SIZE / 2) * 800 / MAP_SIZE;
    if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 800 && y >= 0 && y <= 800) {
      runOnJS(onMapTap)({x, y});
    }
  });
  const gesture = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  // One native transform matrix = one update per frame. Keeping pan and
  // perspective on separate Animated.Views made Android occasionally display
  // translations and 2.5D transforms from different frames (micro-shaking).
  // Transform order is important: T * Perspective * Scale * RotateX, matching
  // the old nested layout and mapProjection.ts exactly.
  const mapStyle = useAnimatedStyle(() => {
    const pose = currentPose.value;
    return {
      transform: [
        { translateX: viewportSize.width / 2 - MAP_SIZE / 2 + pose.x },
        { translateY: viewportSize.height / 2 - MAP_SIZE / 2 + pose.y },
        { perspective: MAP_PERSPECTIVE },
        { scale: pose.scale },
        { rotateX: `${pose.tilt}deg` },
      ],
    };
  }, [viewportSize.width, viewportSize.height]);
  const depthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(currentPose.value.tilt, [0, 16, 28], [0, 0.8, 1], Extrapolation.CLAMP),
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewportSize(previous =>
      Math.abs(previous.width - width) > 1 || Math.abs(previous.height - height) > 1
        ? { width, height }
        : previous
    );
  }, []);

  // Legacy zoom buttons: animate scale; recompute center-anchored pan as the
  // scale animates, using the SAME projection as pinching.
  useAnimatedReaction(
    () => scale.value,
    (currentScale) => {
      if (!buttonZoomActive.value) return;
      const projected = mapToScreenOffset(
        buttonZoomAnchorX.value,
        buttonZoomAnchorY.value,
        currentScale,
        mapTilt.value
      );
      const next = clampMapTranslation(-projected.x, -projected.y, currentScale);
      translateX.value = next.x;
      translateY.value = next.y;
    }
  );

  // Focus once, on one UI-thread clock. No per-frame writes to the main
  // gesture camera values, which are used again only after the flight ends.
  const focusOnPoint = (point: Point, onSettled?: () => void) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      onSettled?.();
      return;
    }
    cancelFocus();
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    cancelAnimation(mapTilt);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    focusAnchorX.value = (point.x / 800) * MAP_SIZE - MAP_SIZE / 2;
    focusAnchorY.value = (point.y / 800) * MAP_SIZE - MAP_SIZE / 2;
    focusFromScale.value = scale.value;
    focusFromTilt.value = mapTilt.value;
    const initialProjection = mapToScreenOffset(
      focusAnchorX.value, focusAnchorY.value, scale.value, mapTilt.value
    );
    focusStartScreenX.value = initialProjection.x + translateX.value;
    focusStartScreenY.value = initialProjection.y + translateY.value;
    focusToScale.value = Math.min(MAX_ZOOM, Math.max(1.8, scale.value));
    focusProgress.value = 0;
    focusActive.value = true;
    // React state drives BuildingLabels and MapControls. Updating it here
    // causes unnecessary React/SVG layout work DURING the 3D camera flight.
    // Commit the visible labels only once the native transform has settled.
    focusProgress.value = withTiming(1, {
      duration: ROUTE_FOCUS_DURATION_MS,
      easing: Easing.linear,
    }, finished => {
      if (finished && focusActive.value) {
        // Commit the pose BEFORE switching styles back to the gesture values.
        const pose = getFocusPose(1);
        scale.value = pose.scale;
        mapTilt.value = pose.tilt;
        translateX.value = pose.x;
        translateY.value = pose.y;
        savedScale.value = pose.scale;
        savedTranslateX.value = pose.x;
        savedTranslateY.value = pose.y;
        focusActive.value = false;
        // Do not force the button into 3D after calculating a path.
        // isTilted already reflects the user's manual button choice.
        runOnJS(setZoomDisplay)(Math.round(pose.scale * 100) / 100);
      }
      // Also reveal the route when an interaction cancels the camera flight.
      // This avoids getting stuck with an invisible route after a manual pan.
      if (onSettled) runOnJS(onSettled)();
    });
  };

  const zoomAroundViewportCenter = (requestedScale: number) => {
    cancelFocus();
    const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedScale));
    if (Math.abs(nextScale - scale.value) < 0.001) return;
    hasUserMovedMap.value = true;
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    buttonZoomActive.value = false;
    const anchor = screenToMapOffset(-translateX.value, -translateY.value, scale.value, mapTilt.value);
    buttonZoomAnchorX.value = anchor.x;
    buttonZoomAnchorY.value = anchor.y;
    buttonZoomActive.value = true;
    scale.value = withTiming(nextScale, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    }, finished => {
      if (!finished) return;
      const projected = mapToScreenOffset(
        buttonZoomAnchorX.value,
        buttonZoomAnchorY.value,
        scale.value,
        mapTilt.value
      );
      const next = clampMapTranslation(-projected.x, -projected.y, scale.value);
      translateX.value = next.x;
      translateY.value = next.y;
      savedTranslateX.value = next.x;
      savedTranslateY.value = next.y;
      savedScale.value = scale.value;
      buttonZoomActive.value = false;
      runOnJS(setZoomDisplay)(Math.round(scale.value * 100) / 100);
    });
  };

  const zoomIn = () => zoomAroundViewportCenter(scale.value * 1.28);
  const zoomOut = () => zoomAroundViewportCenter(scale.value / 1.28);

  const resetView = () => {
    cancelFocus();
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const targetScale = 1;
    const projected = mapToScreenOffset(0, 0, targetScale, mapTilt.value);
    const next = clampMapTranslation(-projected.x, -projected.y, targetScale);
    translateX.value = withSpring(next.x, SPRING_CONFIG);
    translateY.value = withSpring(next.y, SPRING_CONFIG);
    scale.value = withSpring(targetScale, SPRING_CONFIG);
    savedTranslateX.value = next.x;
    savedTranslateY.value = next.y;
    savedScale.value = targetScale;
    setZoomDisplay(targetScale);
  };

  const fitCampus = () => {
    cancelFocus();
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const targetScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
      Math.min(viewportSize.width / MAP_SIZE, viewportSize.height / MAP_SIZE) * 0.9
    ));
    translateX.value = withSpring(0, SPRING_CONFIG);
    translateY.value = withSpring(0, SPRING_CONFIG);
    scale.value = withSpring(targetScale, SPRING_CONFIG);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    savedScale.value = targetScale;
    setZoomDisplay(Math.round(targetScale * 100) / 100);
  };

  // Original 2.5D button behavior: preserve the map point at viewport center.
  const toggleTilt = () => {
    cancelFocus();
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const nextTilted = !isTilted;
    const nextTilt = nextTilted ? TILT : 0;
    const anchor = screenToMapOffset(-translateX.value, -translateY.value, scale.value, mapTilt.value);
    const projected = mapToScreenOffset(anchor.x, anchor.y, scale.value, nextTilt);
    const next = clampMapTranslation(-projected.x, -projected.y, scale.value);
    cancelAnimation(mapTilt);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    mapTilt.value = withSpring(nextTilt, TILT_SPRING);
    translateX.value = withSpring(next.x, TILT_SPRING);
    translateY.value = withSpring(next.y, TILT_SPRING);
    savedTranslateX.value = next.x;
    savedTranslateY.value = next.y;
    setIsTilted(nextTilted);
  };

  // Share the live camera values with screen-space overlays. A destination
  // icon cannot be lifted correctly inside a perspective-tilted map plane:
  // "up" in SVG coordinates is NOT vertical on screen when tilted.
  // The flag is mounted only AFTER focus settles, so it reads the fully
  // committed camera shared values without a transient half-tilted frame.
  const markerCamera = {
    scale,
    tilt: mapTilt,
    translateX,
    translateY,
    viewportSize,
  };

  return {
    markerCamera,
    gesture,
    mapStyle,
    depthStyle,
    zoomDisplay,
    isTilted,
    onLayout,
    zoomIn,
    zoomOut,
    focusOnPoint,
    resetView,
    fitCampus,
    toggleTilt,
  };
}
