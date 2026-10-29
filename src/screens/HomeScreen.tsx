import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share, StatusBar, useWindowDimensions, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import CampusMap3D from '../map3d/CampusMap3D';
import { useModelStore } from '../map3d/ModelStore';
import HeaderBar from '../components/ui/HeaderBar';
import NavigationPanel from '../components/ui/NavigationPanel';
import EmergencyInstructions from '../components/ui/EmergencyInstructions';
import EmergencyChooser from '../components/ui/EmergencyChooser';
import type { EmergencyType } from '../emergency/emergencyTypes';
import { planEvacuation, type PreviewPlan } from '../navigation/routePreview';
import type { Point, GraphNode } from '../navigation/walkableGraph';
import useLiveCampusLocation from '../hooks/useLiveCampusLocation';
import {
  screenOutdoorFix, distanceMeters, MIN_REROUTE_INTERVAL_MS, gpsToCampusPoint, gpsToRawCampusPoint, inCampusMap,
  addAlignmentPoint, clearAlignment, getAlignmentInfo, getAlignmentPoints, setAlignmentPoints,
  MIN_REROUTE_MOVEMENT_M, type GpsFix,
} from '../location/campusGps';
import { GpsKalmanFilter } from '../location/gpsFilter';
import { routeProgress, trimPlan, type RouteProgress } from '../navigation/routeFollow';
import GpsTestPanel from '../components/ui/GpsTestPanel';
import DirectionPill from '../components/ui/DirectionPill';
import useVoiceDirections from '../hooks/useVoiceDirections';
import usePhoneHeading from '../hooks/usePhoneHeading';
import useStepDetector from '../hooks/useStepDetector';
import useFloorDetector from '../hooks/useFloorDetector';
import styles from '../styles/screens/HomeScreen.styles';

type Props = {
  /** An alert link or notification tap; `outside` skips the guide and opens navigation. */
  emergencyRequest?: { id: number; type: EmergencyType; outside?: boolean } | null;
};
type Stage = 'choose' | 'instructions' | 'navigation';
type CalculatedAt = { fix: GpsFix; plan: PreviewPlan; at: number };
/** While following the route, still re-check for a better evacuation area this often (ms). */
const ON_ROUTE_RECHECK_MS = 10000;
/** Standing still, the marker ignores moves smaller than this (map units, ~1.2 m). */
const STILL_DEADBAND = 2.5;
/** On the route, GPS noise may not pull the marker backwards by less than this (map units, ~6 m);
 * a real turn-back is larger. */
const BACKTRACK_LIMIT = 12;

export default function HomeScreen({ emergencyRequest }: Props) {
  const [stage, setStage] = useState<Stage>('choose');
  const [emergencyType, setEmergencyType] = useState<EmergencyType | null>(null);
  const [instructionId, setInstructionId] = useState(0);
  const [start, setStart] = useState<GraphNode | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [startOnPath, setStartOnPath] = useState(false);
  const [plan, setPlan] = useState<PreviewPlan | null>(null);
  const [displayPlan, setDisplayPlan] = useState<PreviewPlan | null>(null);
  const [animateRoute, setAnimateRoute] = useState(false);
  const [routeWarning, setRouteWarning] = useState(false);
  const activeFocus = useRef<{ id: number; plan: PreviewPlan } | null>(null);
  const focusSequence = useRef(0);
  const [focusRequest, setFocusRequest] = useState<{ point: Point; id: number; bounds?: { minX: number; minY: number; maxX: number; maxY: number } } | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [gpsRetryKey, setGpsRetryKey] = useState(0);
  const [outsideConfirmed, setOutsideConfirmed] = useState(false);
  const [outsideCampus, setOutsideCampus] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  // GPS test panel (long-press the GPS line in the bottom card) and tap-to-calibrate.
  const [gpsTestOpen, setGpsTestOpen] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [alignmentInfo, setAlignmentInfo] = useState(getAlignmentInfo());
  const [gpsDebug, setGpsDebug] = useState<{ raw: GpsFix; smoothed: GpsFix; point: Point | null; screen: string } | null>(null);
  const gpsTestRef = useRef(false);
  gpsTestRef.current = gpsTestOpen;
  const [liveMessage, setLiveMessage] = useState('GPS starts after you confirm you are outside.');
  const gps = useLiveCampusLocation(liveEnabled, gpsRetryKey);
  const { editorOpen } = useModelStore();
  const lastCalculated = useRef<CalculatedAt | null>(null);
  const mostRecentFix = useRef(0);
  const outsideConsecutive = useRef(0);
  // Walking GPS is smoothed before use; progress along the current route keeps the dot on it.
  const gpsFilter = useRef(new GpsKalmanFilter());
  const routeSegment = useRef(0);
  // Marker steadiness: last shown position, whether it is snapped to the route and how far along.
  const markerState = useRef<{ shown: Point | null; onRoute: boolean; along: number }>({ shown: null, onRoute: false, along: 0 });
  const lastStepAt = useRef(0);
  // Sensor fusion: compass heading + accelerometer steps move the estimate between GPS fixes
  // (see GpsKalmanFilter), and the barometer warns when you are upstairs.
  const navigating = liveEnabled && stage === 'navigation';
  const heading = usePhoneHeading(liveEnabled);
  const headingRef = useRef<number | null>(null);
  headingRef.current = heading;
  const [stepCount, setStepCount] = useState(0);
  const [atGround, setAtGround] = useState(false);
  const floor = useFloorDetector(navigating, atGround);
  const floorRef = useRef(floor);
  floorRef.current = floor;
  // One voice on/off setting for the guide and the spoken directions.
  const [voiceMuted, setVoiceMuted] = useState(false);
  const toggleVoice = useCallback(() => setVoiceMuted(m => !m), []);
  const { height: screenHeight } = useWindowDimensions();
  const guideHeight = Math.min(600, Math.round(screenHeight * 0.66));

  const resetRoute = useCallback(() => {
    activeFocus.current = null;
    lastCalculated.current = null;
    mostRecentFix.current = 0;
    outsideConsecutive.current = 0;
    gpsFilter.current.reset();
    routeSegment.current = 0;
    markerState.current = { shown: null, onRoute: false, along: 0 };
    setGpsAccuracy(null);
    setAnimateRoute(false);
    setRouteWarning(false);
    setStart(null);
    setStartPoint(null);
    setStartOnPath(false);
    setPlan(null);
    setDisplayPlan(null);
    setFocusRequest(null);
  }, []);

  const selectEmergency = useCallback((type: EmergencyType) => {
    setLiveEnabled(false);
    setOutsideConfirmed(false);
    setOutsideCampus(false);
    resetRoute();
    setLiveMessage('Waiting for GPS...');
    setEmergencyType(type);
    setInstructionId(id => id + 1);
    setStage('instructions');
  }, [resetRoute]);

  const finishInstructions = useCallback(() => {
    // Only called after two full speech cycles (or explicit voice-error fallback)
    // AND the user presses the outside-confirmation button.
    resetRoute();
    setOutsideCampus(false);
    setOutsideConfirmed(true);
    setLiveMessage('Requesting your current GPS location...');
    setStage('navigation');
    setLiveEnabled(true);
  }, [resetRoute]);

  // Alert link or notification: open the guide, or go straight to the map ("I'm safe outside").
  useEffect(() => {
    if (!emergencyRequest) return;
    selectEmergency(emergencyRequest.type);
    if (emergencyRequest.outside) finishInstructions();
  }, [emergencyRequest?.id, selectEmergency, finishInstructions]);

  // Keep the screen on for the whole emergency (guide and navigation).
  useEffect(() => {
    if (stage === 'choose') return;
    void activateKeepAwakeAsync('emergency').catch(() => {});
    return () => { void deactivateKeepAwake('emergency').catch(() => {}); };
  }, [stage]);

  const instruction = useVoiceDirections(plan, stage === 'navigation' && !outsideCampus, voiceMuted);

  const changeEmergency = useCallback(() => {
    Alert.alert('Change emergency guide?', 'Live GPS navigation will stop. Select Fire or Earthquake again.', [
      {text:'Keep navigation',style:'cancel'},
      {text:'Change alert',onPress:() => {
        setLiveEnabled(false);
        setOutsideConfirmed(false);
        setOutsideCampus(false);
        resetRoute();
        setStage('choose');
        setEmergencyType(null);
      }},
    ]);
  }, [resetRoute]);

  const retryGps = useCallback(() => {
    // Android will not show the permission dialog again once location is blocked: open Settings.
    if (gps.phase === 'permission-denied' && gps.message.includes('Settings')) {
      void Linking.openSettings().catch(() => {});
    }
    // A retry must NEVER remove an already verified path.
    setRouteWarning(Boolean(lastCalculated.current));
    setLiveMessage('Retrying a fresh GPS fix...');
    setGpsRetryKey(key => key + 1);
  }, [gps.phase, gps.message]);

  /**
   * Shows the user marker without jitter: snapped onto the route while following it (with
   * hysteresis), never sliding backwards along it because of noise, and held still for tiny
   * changes when you are not walking. Trims the walked part of the route. Returns the progress.
   */
  const placeMarker = useCallback((point: Point, routePlan: PreviewPlan, moving: boolean): RouteProgress | null => {
    const m = markerState.current;
    const progress = routeProgress(routePlan.route, point, routeSegment.current, m.onRoute);
    let target = point;
    if (progress?.onRoute) {
      if (m.onRoute && progress.along < m.along && m.along - progress.along < BACKTRACK_LIMIT) return progress;
      routeSegment.current = progress.segment;
      m.along = progress.along;
      target = progress.snapped;
    }
    m.onRoute = Boolean(progress?.onRoute);
    if (!moving && m.shown && Math.hypot(target.x - m.shown.x, target.y - m.shown.y) < STILL_DEADBAND) return progress;
    m.shown = target;
    setStartPoint(target);
    if (progress?.onRoute && !activeFocus.current) {
      const remaining = trimPlan(routePlan, progress);
      setAnimateRoute(false);
      setPlan(remaining);
      setDisplayPlan(remaining);
    }
    return progress;
  }, []);

  // Each step moves the marker right away (dead reckoning); the next GPS fix corrects it.
  const onStep = useCallback((time: number) => {
    if (gpsTestRef.current) setStepCount(n => n + 1);
    lastStepAt.current = time;
    const estimate = gpsFilter.current.step(headingRef.current, time);
    const previous = lastCalculated.current;
    if (!estimate || !previous || floorRef.current.upperFloor) return;
    const point = gpsToCampusPoint(estimate.latitude, estimate.longitude);
    if (inCampusMap(point)) placeMarker(point, previous.plan, true);
  }, [placeMarker]);
  const stepsAvailable = useStepDetector(navigating, onStep);
  useEffect(() => { gpsFilter.current.stepDetector = stepsAvailable; }, [stepsAvailable]);

  // Map alignment: the tapped spot is where you really are. Saved on the phone; with points in
  // two or more places the alignment also corrects scale and rotation, not just an offset.
  const calibrateAt = useCallback((tap: Point) => {
    setCalibrating(false);
    const fix = gpsDebug?.smoothed;
    if (!fix) return;
    addAlignmentPoint(gpsToRawCampusPoint(fix.latitude, fix.longitude), tap);
    setAlignmentInfo(getAlignmentInfo());
  }, [gpsDebug]);
  const undoAlignment = useCallback(() => {
    setAlignmentPoints(getAlignmentPoints().slice(0, -1));
    setAlignmentInfo(getAlignmentInfo());
  }, []);
  const shareAlignment = useCallback(() => {
    void Share.share({ message: 'TomaSafe alignment points (paste into BUILT_IN_ALIGNMENT in src/location/campusGps.ts):\n' + JSON.stringify(getAlignmentPoints()) }).catch(() => {});
  }, []);

  const showPlan = useCallback((result: PreviewPlan) => {
    const id = ++focusSequence.current;
    activeFocus.current = { id, plan: result };
    setPlan(result);
    setDisplayPlan(null);
    setAnimateRoute(true);
    // Frame the whole route, so the start and the destination are both on screen.
    const xs = result.route.map(p => p.x), ys = result.route.map(p => p.y);
    setFocusRequest({ point: result.origin, id,
      bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) } });
  }, []);

  const finishFocus = useCallback((id: number) => {
    if (activeFocus.current?.id === id) {
      setDisplayPlan(activeFocus.current.plan);
      activeFocus.current = null;
    }
  }, []);

  // Foreground tracking is independent of route availability. Keep the last
  // VERIFIED route through ordinary GPS uncertainty, reflections near walls,
  // missing fixes, background/foreground transitions and reroute failures.
  // Never replace a valid route with an unverified one.
  useEffect(() => {
    if (!liveEnabled || !outsideConfirmed || stage !== 'navigation') return;

    if (gps.phase !== 'tracking' || !gps.fix) {
      setRouteWarning(Boolean(lastCalculated.current));
      setLiveMessage(lastCalculated.current
        ? 'GPS is updating. Keeping your last verified route.'
        : gps.message);
      return;
    }
    const raw = gps.fix;
    if (raw.timestamp <= mostRecentFix.current) return;
    mostRecentFix.current = raw.timestamp;
    if (Date.now() - raw.timestamp > 15000) {
      setRouteWarning(Boolean(lastCalculated.current));
      setLiveMessage('Waiting for fresh GPS. Last verified route remains visible.');
      return;
    }
    // Kalman-smoothed position; a sudden impossible jump is ignored (the estimate just moves on).
    const fix = gpsFilter.current.update(raw);
    if (fix.rejected) {
      setLiveMessage('Ignoring a GPS jump. Keeping your position steady.');
      return;
    }

    const check = screenOutdoorFix(fix);
    // The barometer learns ground level only from confident outdoor fixes.
    setAtGround(check.code === 'ok');
    if (gpsTestRef.current) setGpsDebug({ raw, smoothed: fix, point: check.point, screen: check.code });
    if (!check.usable || !check.point) {
      if (check.code === 'outside-campus') {
        outsideConsecutive.current += 1;
        // GPS drift can briefly put a real campus user outside the approximate
        // SVG rectangle. Require several consecutive high-quality fixes.
        if (outsideConsecutive.current >= 3) {
          setOutsideCampus(true);
          // The user is confidently outside the mapped region: routing must
          // not be shown as valid or active there.
          setDisplayPlan(null);
          setPlan(null);
          setStartPoint(null);
          setStart(null);
          setStartOnPath(false);
          activeFocus.current = null;
        }
      } else {
        outsideConsecutive.current = 0;
        setOutsideCampus(false);
      }
      setRouteWarning(Boolean(lastCalculated.current));
      setLiveMessage(check.reason);
      // Keep the last VERIFIED marker and route; do not trust a point that
      // falls into a roof polygon or has high reported uncertainty.
      return;
    }

    outsideConsecutive.current = 0;
    setOutsideCampus(false);
    setRouteWarning(false);
    const point = check.point;
    setGpsAccuracy(fix.accuracy);
    const previous = lastCalculated.current;
    const moved = previous ? distanceMeters(previous.fix, fix) : Infinity;
    const elapsedSeconds = previous
      ? Math.max(1, (fix.timestamp - previous.fix.timestamp) / 1000)
      : Infinity;
    if (previous && moved > Math.max(45, elapsedSeconds * 12)) {
      setRouteWarning(true);
      setLiveMessage('Unstable GPS position. Keeping your last verified route.');
      return;
    }
    // While near the current route, show the marker ON it and trim the walked part, instead of
    // redrawing the whole route on every GPS update; hold it still for tiny changes.
    const moving = fix.speed > 0.5 || Date.now() - lastStepAt.current < 1500;
    const progress = previous ? placeMarker(point, previous.plan, moving) : null;
    if (!previous) { markerState.current.shown = point; setStartPoint(point); }
    setLiveMessage(check.code === 'near-building' ? check.reason : previous
      ? `GPS ±${Math.round(fix.accuracy ?? 0)} m · Route updates as you walk`
      : 'Calculating nearest evacuation route...');
    if (floorRef.current.upperFloor) {
      // GPS cannot tell floors apart; the barometer can. Navigation starts at ground level.
      setRouteWarning(true);
      setLiveMessage('You seem to be on an upper floor. Go down and outside first.');
    }

    const elapsed = previous ? Date.now() - previous.at : Infinity;
    // On the route: keep it, and only re-check now and then whether another area became closer.
    if (previous && progress?.onRoute && elapsed < ON_ROUTE_RECHECK_MS) return;
    if (previous && !outsideCampus &&
        (moved < MIN_REROUTE_MOVEMENT_M || elapsed < MIN_REROUTE_INTERVAL_MS ||
         (animateRoute && Date.now() - previous.at < 3000))) return;

    const result = planEvacuation(point, {
      preferredAreaId: previous?.plan.area.id,
      switchMargin: previous ? Math.max(8, previous.plan.weightedDistance * 0.04) : 0,
      emergency: emergencyType,
    });
    if (!result.plan) {
      setRouteWarning(Boolean(previous));
      setLiveMessage('Cannot confirm a new safe route. Keeping the last verified route.');
      return;
    }
    setRouteWarning(false);
    setStart(result.plan.start);
    setStartOnPath(false);
    lastCalculated.current = {fix,plan:result.plan,at:Date.now()};
    routeSegment.current = 0;
    markerState.current = { ...markerState.current, onRoute: false, along: 0 };
    if (!previous || outsideCampus) {
      showPlan(result.plan);
    } else if (activeFocus.current) {
      // A GPS update during the first camera glide must not interrupt the
      // initial animated route: replace the pending plan and reveal at settle.
      activeFocus.current.plan = result.plan;
      setPlan(result.plan);
    } else {
      // Frequent reroutes are drawn immediately; replaying the entire path
      // on every GPS update creates visual flashes/stutter on Android.
      setAnimateRoute(false);
      setPlan(result.plan);
      setDisplayPlan(result.plan);
    }
  }, [liveEnabled, outsideConfirmed, stage, gps.fix?.timestamp, gps.phase,
    gps.message, showPlan, outsideCampus, animateRoute, emergencyType]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <CampusMap3D
        start={start}
        startPoint={startPoint}
        startOnPath={startOnPath}
        focusRequest={focusRequest}
        onFocusSettled={finishFocus}
        plan={displayPlan}
        liveGps={liveEnabled}
        animateRoute={animateRoute}
        insets={{ top: 70, bottom: stage === 'navigation' ? 250 : stage === 'instructions' ? guideHeight : 0 }}
        accuracyM={gpsAccuracy}
        heading={heading}
        onMapTap={calibrating ? calibrateAt : null}
      />
      {gpsTestOpen && stage === 'navigation' && (
        <GpsTestPanel
          raw={gpsDebug?.raw ?? null}
          smoothed={gpsDebug?.smoothed ?? null}
          mapPoint={gpsDebug?.point ?? null}
          alignment={alignmentInfo}
          sensors={{ steps: stepsAvailable ? stepCount : null, heading, floorHeightM: floor.available ? floor.heightM : undefined }}
          onUndo={undoAlignment}
          onShare={shareAlignment}
          calibrating={calibrating}
          screen={gpsDebug?.screen ?? 'waiting for GPS'}
          onCalibrate={() => setCalibrating(true)}
          onReset={() => { clearAlignment(); setAlignmentInfo(getAlignmentInfo()); }}
          onClose={() => { setGpsTestOpen(false); setCalibrating(false); }}
        />
      )}
      <HeaderBar emergency={stage === 'choose' ? null : emergencyType} />
      {!editorOpen && !gpsTestOpen && stage === 'navigation' && instruction && (
        <DirectionPill instruction={instruction} muted={voiceMuted} onToggleMute={toggleVoice} />
      )}
      {/* The map editor takes over the bottom of the screen while it is open. */}
      {!editorOpen && stage === 'navigation' && emergencyType && (
        <NavigationPanel
          plan={plan}
          emergencyMode={emergencyType}
          liveStatus={liveMessage}
          outsideCampus={outsideCampus}
          routeWarning={routeWarning}
          accuracyM={gpsAccuracy}
          onToggleGpsTest={() => setGpsTestOpen(v => !v)}
          onChangeEmergency={changeEmergency}
          onRetryGps={retryGps}
        />
      )}
      {!editorOpen && stage === 'choose' && <EmergencyChooser onSelect={selectEmergency} />}
      {!editorOpen && stage === 'instructions' && emergencyType && (
        <EmergencyInstructions
          key={instructionId}
          type={emergencyType}
          onFinished={finishInstructions}
          height={guideHeight}
          muted={voiceMuted}
          onToggleMute={toggleVoice}
        />
      )}
    </View>
  );
}
