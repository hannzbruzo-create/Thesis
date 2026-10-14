import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  interpolate,
  Extrapolation,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import UstMapSvg from '../../assets/images/ust.svg';
import BuildingLabels from '../components/BuildingLabels';
import CampusContext from '../components/CampusContext';
import CampusFadeOverlay from '../components/CampusFadeOverlay';
import BuildingDepthLayer from '../components/BuildingDepthLayer';
import EvacuationAreas from '../components/evacuationAreas';
import {
  calculateOutdoorRoute,
  calculateShortestPath,
  gpsToMapPosition,
  NODES,
  RouteResult,
} from '../components/navigationUtils';
import { styles } from '../components/home.styles';

// Animated SVG route highlight (one component, outside HomeScreen).
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

// =========================================================
// CONSTANTS
// =========================================================

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_SIZE = 1200;

// The outside context is 1200x1200 while the real UST map is 800x800.
// That makes the visual context 1.5x larger than the navigation map.
const CONTEXT_SCALE = 1200 / 800;
const CONTEXT_SIZE = MAP_SIZE * CONTEXT_SCALE;
const MIN_ZOOM = 0.22;
const MAX_ZOOM = 4;
const DEFAULT_VIEWPORT_WIDTH = SCREEN_WIDTH;
const DEFAULT_VIEWPORT_HEIGHT = SCREEN_HEIGHT;
const SPRING_CONFIG = {
  damping: 26,
  stiffness: 190,
  mass: 0.85,
  overshootClamping: true,
};
// A moderate pitch gives useful 2.5D depth without distorting navigation.
const MAX_TILT = 28;
const PERSPECTIVE = 2000;
const TILT_SPRING = {
  damping: 21,
  stiffness: 78,
  mass: 1.15,
  overshootClamping: true,
};

// Projection helpers keep the point below your fingers stable even in 3D.
// These are UI-thread worklets, so there is no React render for every gesture frame.
const screenToMapOffset = (
  x: number, y: number, zoom: number, degrees: number
) => {
  'worklet';
  const angle = (degrees * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const worldY = y / (zoom * (cosine + (y * sine) / PERSPECTIVE));
  const depth = 1 - (zoom * worldY * sine) / PERSPECTIVE;
  return { x: (x * depth) / zoom, y: worldY };
};

const mapToScreenOffset = (
  x: number, y: number, zoom: number, degrees: number
) => {
  'worklet';
  const angle = (degrees * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const depth = Math.max(0.15, 1 - (zoom * y * sine) / PERSPECTIVE);
  return { x: (x * zoom) / depth, y: (y * zoom * cosine) / depth };
};

// =========================================================
// HOME SCREEN
// =========================================================

export default function HomeScreen() {
  // Use the actual visible map area so centering behaves consistently
  // across phones with different screen sizes/aspect ratios.
  const [viewportSize, setViewportSize] = useState({
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
  });

  // =======================================================
  // GPS POSITION
  // =======================================================
  const [userPos, setUserPos] = useState({
    x: 50,
    y: 50,
  });
  const [locationGranted, setLocationGranted] = useState(false);
  const [isInsideCampus, setIsInsideCampus] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isWaitingForLocation, setIsWaitingForLocation] = useState(true);

  // =======================================================
  // NAVIGATION
  // =======================================================
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [selectedEvacuationAreaId, setSelectedEvacuationAreaId] = useState<string | null>(null);

  // DEV-ONLY OUTDOOR ROUTE TESTING.
  // Works without campus GPS and never appears in release builds.
  const [testExit, setTestExit] = useState<'N2' | 'N3' | 'N4'>('N2');
  const [isTestRoute, setIsTestRoute] = useState(false);
  const [devPanelExpanded, setDevPanelExpanded] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(112);
  const [overviewMode, setOverviewMode] = useState(false);
  const [gpsHeading, setGpsHeading] = useState<number | null>(null);
  const mapTilt = useSharedValue(0);
  const [isTilted, setIsTilted] = useState(false);
  const hasUserMovedMap = useSharedValue(false);
  const initiallyCenteredOnGPS = useRef(false);

  // =======================================================
  // MAP PAN
  // =======================================================
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // =======================================================
  // MAP ZOOM
  // =======================================================
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const pinchAnchorReady = useSharedValue(false);
  const pinchActive = useSharedValue(false);

  // Keep button zoom's position and scale in sync during animation.
  const buttonZoomActive = useSharedValue(false);
  const buttonZoomAnchorX = useSharedValue(0);
  const buttonZoomAnchorY = useSharedValue(0);
  const [zoomDisplay, setZoomDisplay] = useState(1);

  // Subtle moving highlight on the calculated blue path.
  const routeDashOffset = useSharedValue(0);
  const animatedRouteProps = useAnimatedProps(() => ({
    strokeDashoffset: routeDashOffset.value,
  }));

  useEffect(() => {
    if (activeRoute?.success) {
      routeDashOffset.value = 0;
      routeDashOffset.value = withRepeat(
        withTiming(-4.4, {
          duration: 1800,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      cancelAnimation(routeDashOffset);
      routeDashOffset.value = 0;
    }
    return () => cancelAnimation(routeDashOffset);
  }, [activeRoute]);

  // =======================================================
  // SMOOTH MARKER
  // =======================================================
  const markerX = useSharedValue(50);
  const markerY = useSharedValue(50);

  // =======================================================
  // GPS TRACKING
  // =======================================================
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    const startLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          setLocationGranted(false);
          setIsWaitingForLocation(false);
          return;
        }
        setLocationGranted(true);
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 1,
            timeInterval: 1000,
          },
          (location) => {
            const { latitude, longitude, accuracy, heading } = location.coords;
            if (typeof heading === 'number' && heading >= 0) setGpsHeading(heading);
            setLocationAccuracy(accuracy ?? null);
            setIsWaitingForLocation(false);

            // -------------------------------
            // GPS -> SVG
            // -------------------------------
            const position = gpsToMapPosition(latitude, longitude);
            setIsInsideCampus(position.isInsideCampus);
            if (!position.isInsideCampus) {
              return;
            }

            const newPosition = {
              x: position.x,
              y: position.y,
            };
            setUserPos(newPosition);

            // Center on the first valid campus GPS position ONCE.
            // Later GPS updates only move the marker, not the entire map.
            if (!initiallyCenteredOnGPS.current) {
              initiallyCenteredOnGPS.current = true;
              if (!hasUserMovedMap.value) {
                const centerX = (newPosition.x / 100) * MAP_SIZE - MAP_SIZE / 2;
                const centerY = (newPosition.y / 100) * MAP_SIZE - MAP_SIZE / 2;
                const nextX = -centerX * scale.value;
                const nextY = -centerY * scale.value;
                translateX.value = withTiming(nextX, { duration: 420 });
                translateY.value = withTiming(nextY, { duration: 420 });
                savedTranslateX.value = nextX;
                savedTranslateY.value = nextY;
              }
            }

            // -------------------------------
            // Smooth marker
            // -------------------------------
            markerX.value = withTiming(newPosition.x, { duration: 600 });
            markerY.value = withTiming(newPosition.y, { duration: 600 });
          }
        );
      } catch (error) {
        console.log('Location error:', error);
        setLocationGranted(false);
        setIsWaitingForLocation(false);
      }
    };

    startLocation();
    return () => {
      subscription?.remove();
    };
  }, []);

  // =======================================================
  // CALCULATE EVACUATION DESTINATION
  // =======================================================
  const handleCalculateRoute = () => {
    if (!locationGranted) {
      setSelectedEvacuationAreaId(null);
      Alert.alert('Location Required', 'Please allow location access first.');
      return;
    }

    if (!isInsideCampus) {
      setSelectedEvacuationAreaId(null);
      Alert.alert(
        'Outside Campus',
        'You must be inside the mapped campus area to calculate an evacuation route.'
      );
      return;
    }

    const result = calculateShortestPath(userPos);
    if (!result.success) {
      setActiveRoute(null);
      // Hide evacuation area if no route exists.
      setSelectedEvacuationAreaId(null);
      Alert.alert('Route unavailable', result.message);
      return;
    }

    setActiveRoute(result);
    setIsTestRoute(false);
    setOverviewMode(false);
    mapTilt.value = withSpring(24, TILT_SPRING);
    setIsTilted(true);

    // Show the evacuation site ONLY after a successful calculation.
    setSelectedEvacuationAreaId(result.evacuationAreaId);

    // Keep the current GPS position in focus rather than fitting the whole campus.
    focusMapPoint(userPos);
  };

  const handleTestNavigation = () => {
    const result = calculateOutdoorRoute(testExit);
    if (!result.success) {
      Alert.alert('Test Route Unavailable', result.message);
      return;
    }

    setActiveRoute(result);
    setIsTestRoute(true);
    setDevPanelExpanded(false);
    setOverviewMode(false);
    mapTilt.value = withSpring(24, TILT_SPRING);
    setIsTilted(true);
    setSelectedEvacuationAreaId(result.evacuationAreaId);

    // Test from home: focus the map on the chosen building exit.
    const startNode = NODES[testExit];
    if (startNode) focusMapPoint(startNode);
  };

  // =======================================================
  // STOP NAVIGATION
  // =======================================================
  const handleStopRoute = () => {
    setActiveRoute(null);
    setIsTestRoute(false);
    setOverviewMode(false);
    mapTilt.value = withSpring(0, TILT_SPRING);
    setIsTilted(false);

    // Hide evacuation site again.
    setSelectedEvacuationAreaId(null);
  };

  // =======================================================
  // STABLE CAMERA: PAN BOUNDS + ZOOM + TILT
  // =======================================================
  // Camera translation is relative to the CENTER of the SVG,
  // NOT to the GPS position. A changing GPS fix never drags the map.
  const getPanBounds = (currentScale: number) => {
    'worklet';
    const scaledContextSize = CONTEXT_SIZE * currentScale;
    return {
      x: Math.max(0, (scaledContextSize - viewportSize.width) / 2),
      y: Math.max(0, (scaledContextSize - viewportSize.height) / 2),
    };
  };

  const clampMapTranslation = (
    proposedX: number,
    proposedY: number,
    currentScale: number
  ) => {
    'worklet';
    const limits = getPanBounds(currentScale);
    return {
      x: Math.max(-limits.x, Math.min(limits.x, proposedX)),
      y: Math.max(-limits.y, Math.min(limits.y, proposedY)),
    };
  };

  // Places a world/map point at the center of the viewport.
  // NODES and GPS still use the original 0–100 percentage system.
  const focusMapPoint = (point: { x: number; y: number }) => {
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const targetScale = 1.45;
    const worldX = (point.x / 100) * MAP_SIZE - MAP_SIZE / 2;
    const worldY = (point.y / 100) * MAP_SIZE - MAP_SIZE / 2;
    const projected = mapToScreenOffset(worldX, worldY, targetScale, 24);
    const next = clampMapTranslation(
      -projected.x,
      -projected.y,
      targetScale
    );

    translateX.value = withSpring(next.x, SPRING_CONFIG);
    translateY.value = withSpring(next.y, SPRING_CONFIG);
    scale.value = withSpring(targetScale, SPRING_CONFIG);
    savedTranslateX.value = next.x;
    savedTranslateY.value = next.y;
    savedScale.value = targetScale;
    setZoomDisplay(targetScale);
  };

  // =======================================================
  // ONE-FINGER PAN WITH GENTLE MOMENTUM
  // =======================================================
  const panGesture = Gesture.Pan()
    .minDistance(5)
    .maxPointers(1)
    .onStart(() => {
      if (pinchActive.value) return;
      hasUserMovedMap.value = true;
      buttonZoomActive.value = false;
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      // A second finger can arrive after a pan has already started.
      // Do not let the original pan fight the pinch for camera control.
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

  // =======================================================
  // STABLE TWO-FINGER PINCH — NO DOUBLE-TAP ZOOM
  // =======================================================
  // Pinch is zoom ONLY. Lock the midpoint at the beginning of the
  // gesture, so tiny sideways shifts of fingers don't push the map.
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      hasUserMovedMap.value = true;
      pinchActive.value = true;
      buttonZoomActive.value = false;

      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      // If the user pinches during the 2D/3D transition, lock the pitch
      // at its current frame so the zoom's 3D projection stays stable.
      cancelAnimation(mapTilt);
      savedScale.value = scale.value;

      pinchAnchorReady.value = false;
      const fx = event.focalX;
      const fy = event.focalY;
      if (Number.isFinite(fx) && Number.isFinite(fy) &&
          !(fx === 0 && fy === 0)) {
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
      // Some Android gesture implementations initially report focal=(0,0).
      // Capture a real focal point before changing the map.
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
        // On the first reliable frame, skip scaling instead of jumping.
        savedScale.value = scale.value / Math.pow(Math.max(event.scale, 0.01), 0.93);
        pinchAnchorReady.value = true;
      }

      const nextScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, savedScale.value * Math.pow(Math.max(event.scale, 0.01), 0.93))
      );
      const anchorScreen = mapToScreenOffset(
        pinchStartX.value,
        pinchStartY.value,
        nextScale,
        mapTilt.value
      );
      // Keep the ORIGINAL pinch midpoint on the same point in the SVG.
      // Don't use the changing event.focalX/Y here: they can drift
      // sideways on Android even with a symmetric two-finger pinch.
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

  // No Gesture.Tap(): double tapping does not zoom the map.
  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // =======================================================
  // RECENTER / FIT CAMPUS / ZOOM BUTTONS
  // =======================================================
  const handleRecenter = () => {
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const targetScale = 1;
    const worldX = isInsideCampus
      ? (userPos.x / 100) * MAP_SIZE - MAP_SIZE / 2
      : 0;
    const worldY = isInsideCampus
      ? (userPos.y / 100) * MAP_SIZE - MAP_SIZE / 2
      : 0;
    const projected = mapToScreenOffset(
      worldX, worldY, targetScale, mapTilt.value
    );
    const next = clampMapTranslation(-projected.x, -projected.y, targetScale);

    translateX.value = withSpring(next.x, SPRING_CONFIG);
    translateY.value = withSpring(next.y, SPRING_CONFIG);
    scale.value = withSpring(targetScale, SPRING_CONFIG);
    savedTranslateX.value = next.x;
    savedTranslateY.value = next.y;
    savedScale.value = targetScale;
    setZoomDisplay(targetScale);
  };

  const handleFitCampus = () => {
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const horizontalScale = viewportSize.width / MAP_SIZE;
    const verticalScale = viewportSize.height / MAP_SIZE;
    const targetScale = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(horizontalScale, verticalScale) * 0.9)
    );

    translateX.value = withSpring(0, SPRING_CONFIG);
    translateY.value = withSpring(0, SPRING_CONFIG);
    scale.value = withSpring(targetScale, SPRING_CONFIG);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    savedScale.value = targetScale;
    setZoomDisplay(Math.round(targetScale * 100) / 100);
  };

  // Zoom buttons use ONE animated scale value. Translation is derived
  // every frame from that scale, so scale/position cannot spring apart.
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

  const zoomAroundViewportCenter = (requestedScale: number) => {
    const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requestedScale));
    if (Math.abs(nextScale - scale.value) < 0.001) return;
    hasUserMovedMap.value = true;
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    buttonZoomActive.value = false;

    // Preserve the location currently under the middle of the screen.
    const anchor = screenToMapOffset(
      -translateX.value,
      -translateY.value,
      scale.value,
      mapTilt.value
    );
    buttonZoomAnchorX.value = anchor.x;
    buttonZoomAnchorY.value = anchor.y;
    buttonZoomActive.value = true;

    scale.value = withTiming(
      nextScale,
      { duration: 300, easing: Easing.out(Easing.cubic) },
      (finished) => {
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
      }
    );
  };

  const handleZoomIn = () => zoomAroundViewportCenter(scale.value * 1.28);
  const handleZoomOut = () => zoomAroundViewportCenter(scale.value / 1.28);

  // The UI can also toggle 2D/3D without needing two-finger gestures.
  const handleToggleTilt = () => {
    buttonZoomActive.value = false;
    cancelAnimation(scale);
    const nextTilted = !isTilted;
    const nextTilt = nextTilted ? 24 : 0;

    // Keep the world point currently under screen center in place as
    // the camera pitches, preventing the 3D toggle from shifting the map.
    const anchor = screenToMapOffset(
      -translateX.value, -translateY.value, scale.value, mapTilt.value
    );
    const projected = mapToScreenOffset(
      anchor.x, anchor.y, scale.value, nextTilt
    );
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

  // =======================================================
  // MAP PAN STYLE
  // =======================================================
  const animatedPanStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: viewportSize.width / 2 - MAP_SIZE / 2 + translateX.value },
        { translateY: viewportSize.height / 2 - MAP_SIZE / 2 + translateY.value },
      ],
    }),
    [viewportSize]
  );

  // =======================================================
  // MAP ZOOM STYLE
  // =======================================================
  const animatedZoomStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      { scale: scale.value },
      { rotateX: `${mapTilt.value}deg` },
    ],
  }));

  // Depth fades in continuously with the pitch animation; no heavy
  // component mounting halfway through the 2D-to-3D transition.
  const animatedDepthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      mapTilt.value, [0, 16, MAX_TILT], [0, 0.8, 1], Extrapolation.CLAMP
    ),
  }));

  // =======================================================
  // MARKER STYLE
  // =======================================================
  const animatedMarkerStyle = useAnimatedStyle(() => ({
    left: (markerX.value / 100) * MAP_SIZE,
    top: (markerY.value / 100) * MAP_SIZE,
  }));

  const showRouteOverview = () => {
    setOverviewMode((current) => {
      if (!current) {
        mapTilt.value = withSpring(0, TILT_SPRING);
        setIsTilted(false);
        handleFitCampus();
      } else {
        mapTilt.value = withSpring(24, TILT_SPRING);
        setIsTilted(true);
        const startPoint = isTestRoute ? NODES[testExit] : userPos;
        if (startPoint) focusMapPoint(startPoint);
      }
      return !current;
    });
  };

  // =======================================================
  // STATUS
  // =======================================================
  const getStatus = () => {
    if (isWaitingForLocation) {
      return { text: 'Getting location...', color: '#F59E0B' };
    }
    if (!locationGranted) {
      return { text: 'Location required', color: '#EF4444' };
    }
    if (!isInsideCampus) {
      return { text: 'Outside campus', color: '#F59E0B' };
    }
    return { text: 'Live location', color: '#22C55E' };
  };

  const status = getStatus();

  // =======================================================
  // UI
  // =======================================================
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* MAP */}
        <View
          style={styles.mapViewport}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setViewportSize((previous) =>
              Math.abs(previous.width - width) > 1 ||
              Math.abs(previous.height - height) > 1
                ? { width, height }
                : previous
            );
          }}
        >
          <GestureDetector gesture={mapGesture}>
            <View style={styles.gestureArea}>
              <Animated.View style={[styles.mapPanLayer, animatedPanStyle]}>
                <Animated.View style={[styles.mapZoomLayer, animatedZoomStyle]}>
                  <CampusContext mapSize={MAP_SIZE} />
                  <UstMapSvg width={MAP_SIZE} height={MAP_SIZE} />

                  <Animated.View
                    pointerEvents="none"
                    style={[
                      { position: 'absolute', top: 0, left: 0, width: MAP_SIZE, height: MAP_SIZE },
                      animatedDepthStyle,
                    ]}
                  >
                    <BuildingDepthLayer mapSize={MAP_SIZE} />
                  </Animated.View>

                  <CampusFadeOverlay mapSize={MAP_SIZE} />
                  <EvacuationAreas
                    mapSize={MAP_SIZE}
                    activeAreaId={selectedEvacuationAreaId}
                  />
                  <BuildingLabels mapSize={MAP_SIZE} zoomLevel={zoomDisplay} />

                  {/* ROUTE */}
                  {activeRoute && activeRoute.success && (
                    <Svg
                      width={MAP_SIZE}
                      height={MAP_SIZE}
                      viewBox="0 0 100 100"
                      style={styles.routeOverlay}
                      pointerEvents="none"
                    >
                      {/* White outline */}
                      <Polyline
                        points={activeRoute.pathString}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth="0.82"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Blue route */}
                      <Polyline
                        points={activeRoute.pathString}
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="0.44"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Moving directional highlight */}
                      <AnimatedPolyline
                        points={activeRoute.pathString}
                        fill="none"
                        stroke="#93C5FD"
                        strokeWidth="0.23"
                        strokeDasharray="1.1 1.1"
                        animatedProps={animatedRouteProps}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  )}

                  {/* USER LOCATION */}
                  {(isInsideCampus || (isTestRoute && activeRoute?.success)) && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.userMarker,
                        isTestRoute && activeRoute?.success
                          ? {
                              left: (NODES[testExit].x / 100) * MAP_SIZE,
                              top: (NODES[testExit].y / 100) * MAP_SIZE,
                            }
                          : animatedMarkerStyle,
                      ]}
                    >
                      <View style={styles.accuracyGlow} />
                      <View style={styles.userArrowBadge}>
                        <MaterialCommunityIcons
                          name="navigation"
                          size={22}
                          color="#FFFFFF"
                          style={{
                            transform: [{ rotate: `${isTestRoute ? 0 : (gpsHeading ?? 0)}deg` }],
                          }}
                        />
                      </View>
                    </Animated.View>
                  )}
                </Animated.View>
              </Animated.View>
            </View>
          </GestureDetector>
        </View>

        {activeRoute?.success && (
          <View
            style={[styles.navInstruction, isTestRoute && styles.navInstructionDemo]}
            pointerEvents="box-none"
          >
            <View style={styles.navInstructionLeft}>
              <View style={styles.navDirectionIcon}>
                <MaterialCommunityIcons name="routes" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.navInstructionTitle} numberOfLines={1}>
                  Follow the blue route
                </Text>
                <Text
                  style={[styles.navInstructionSub, isTestRoute && styles.navDemoLabel]}
                  numberOfLines={1}
                >
                  {isTestRoute ? 'DEMO · Not live · ' : 'To '}
                  {activeRoute.evacuationAreaName}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={overviewMode ? 'Return to navigation view' : 'Show route overview'}
              onPress={showRouteOverview}
              style={styles.navOverviewButton}
              hitSlop={8}
            >
              <Text style={styles.navInstructionDistance}>
                {Math.round(activeRoute.distance)} m
              </Text>
              <MaterialCommunityIcons
                name={overviewMode ? 'crosshairs-gps' : 'fit-to-screen-outline'}
                size={16}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* HEADER */}
        <SafeAreaView style={styles.headerWrapper} pointerEvents="box-none">
          <View style={styles.headerCard}>
            <View style={styles.brandContainer}>
              <View style={styles.logoContainer}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.brand}>
                  Toma<Text style={styles.brandAccent}>Safe</Text>
                </Text>
                <Text style={styles.subText}>CAMPUS EVACUATION</Text>
              </View>
            </View>
            <View style={styles.mapBadge}>
              <MaterialCommunityIcons name="map-outline" size={14} color="#2563EB" />
              <Text style={styles.mapBadgeText}>
                {isTestRoute && activeRoute?.success ? 'DEMO' : 'MAP'}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        {/* GPS STATUS */}
        {!(isTestRoute && activeRoute?.success) && (
          <View style={styles.locationStatus}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.locationStatusText}>{status.text}</Text>
          </View>
        )}

        {/* ZOOM CONTROLS */}
        <View style={[styles.mapControls, { bottom: bottomPanelHeight + 24 }]}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleZoomIn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <MaterialCommunityIcons name="plus" size={21} color="#334155" />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <View style={styles.zoomIndicator}>
            <Text style={styles.zoomIndicatorText}>{zoomDisplay.toFixed(1)}×</Text>
          </View>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleZoomOut}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <MaterialCommunityIcons name="minus" size={21} color="#334155" />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleRecenter}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Recenter map"
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#2563EB" />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleToggleTilt}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={isTilted ? 'Switch to flat 2D map' : 'Switch to tilted 3D map'}
          >
            <Text style={{ color: isTilted ? '#2563EB' : '#334155', fontSize: 13, fontWeight: '700' }}>
              {isTilted ? '2D' : '3D'}
            </Text>
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleFitCampus}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Fit campus to screen"
          >
            <MaterialCommunityIcons name="fit-to-screen-outline" size={20} color="#334155" />
          </TouchableOpacity>
        </View>

        {/* COMPACT NAVIGATION CARD */}
        <View
          style={styles.bottomPanel}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            setBottomPanelHeight((previous) =>
              Math.abs(previous - height) > 1 ? height : previous
            );
          }}
        >
          {__DEV__ && (
            <View style={styles.testNavigationPanel}>
              <TouchableOpacity
                style={styles.devHeaderRow}
                accessibilityRole="button"
                accessibilityLabel={devPanelExpanded ? 'Collapse test route controls' : 'Expand test route controls'}
                onPress={() => setDevPanelExpanded((open) => !open)}
              >
                <MaterialCommunityIcons name="code-tags" size={15} color="#64748B" />
                <Text style={styles.testNavigationHeading}>TEST ROUTE · DEV ONLY</Text>
                <View style={styles.devSelectionBadge}>
                  <Text style={styles.devSelectionText}>{testExit}</Text>
                </View>
                <MaterialCommunityIcons
                  name={devPanelExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
              {devPanelExpanded && (
                <View style={styles.testExitRow}>
                  {(['N2', 'N3', 'N4'] as const).map((id) => (
                    <TouchableOpacity
                      key={id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select exit ${id}`}
                      hitSlop={4}
                      onPress={() => setTestExit(id)}
                      style={[
                        styles.testExitButton,
                        testExit === id && styles.testExitButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.testExitButtonText,
                          testExit === id && styles.testExitButtonTextSelected,
                        ]}
                      >
                        {id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Show selected test route"
                    onPress={handleTestNavigation}
                    style={styles.testShowRouteButton}
                  >
                    <Text style={styles.testShowRouteText}>SHOW ROUTE</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {activeRoute?.success ? (
            <View style={styles.routeInfoRow}>
              <View style={styles.routeIcon}>
                <MaterialCommunityIcons name="flag-checkered" size={19} color="#16834A" />
              </View>
              <View style={styles.routeTextContainer}>
                <Text style={styles.routeLabel}>EVACUATION DESTINATION</Text>
                <Text style={styles.routeTitle} numberOfLines={1}>
                  {activeRoute.evacuationAreaName}
                </Text>
                <Text style={styles.routeDistance}>
                  {isTestRoute ? 'Demo route' : 'Mapped route'} · Approx. {Math.round(activeRoute.distance)} m
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopRoute}
                accessibilityRole="button"
                accessibilityLabel="Stop navigation"
                hitSlop={5}
              >
                <MaterialCommunityIcons name="close" size={19} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.compactLocationRow}>
                <View style={styles.compactLocationIcon}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#2563EB" />
                </View>
                <View style={styles.compactLocationInfo}>
                  <Text style={styles.compactLocationTitle}>
                    {isInsideCampus ? 'Live Location' : 'Location unavailable'}
                  </Text>
                  <Text style={styles.compactLocationSubtext}>
                    {locationAccuracy !== null
                      ? `GPS accuracy ±${Math.round(locationAccuracy)} m`
                      : 'Waiting for GPS...'}
                  </Text>
                </View>
                <View style={[styles.liveIndicator, { backgroundColor: status.color }]} />
              </View>
              <TouchableOpacity
                style={[
                  styles.routeButton,
                  (!locationGranted || !isInsideCampus) && styles.routeButtonDisabled,
                ]}
                disabled={!locationGranted || !isInsideCampus}
                activeOpacity={0.85}
                onPress={handleCalculateRoute}
                accessibilityRole="button"
                accessibilityLabel="Find evacuation destination"
              >
                <MaterialCommunityIcons name="directions-fork" size={17} color="#FFFFFF" />
                <Text style={styles.routeButtonText}>FIND EVACUATION DESTINATION</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}