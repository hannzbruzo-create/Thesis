import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Share, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import CampusMap3D from '../map3d/CampusMap3D';
import { useModelStore } from '../map3d/ModelStore';
import HeaderBar from '../components/ui/HeaderBar';
import NavigationPanel from '../components/ui/NavigationPanel';
import EmergencyInstructions from '../components/ui/EmergencyInstructions';
import EmergencyChooser from '../components/ui/EmergencyChooser';
import NoRouteWarning from '../components/ui/NoRouteWarning';
import SafeConfirmPopup from '../components/ui/SafeConfirmPopup';
import ProfileSheet from '../components/ui/ProfileSheet';
import { EVACUATION_AREAS, evacuationAreaAt, type EvacuationArea } from '../data/evacuationAreas';
import {
  getPushStatus, loadUser, onProfileChange, onPushStatus, registerForPush, reportStatus, saveProfile, setIncident,
  startReporting, type Profile, type PushStatus, type ReportArea,
} from '../services/safetyReports';
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
  emergencyRequest?: { id: number; type: EmergencyType; outside?: boolean; incidentId?: number } | null;
};
type Stage = 'choose' | 'instructions' | 'navigation';
type CalculatedAt = { fix: GpsFix; plan: PreviewPlan; at: number };
/** While following the route, still re-check for a better evacuation area this often (ms). */
const ON_ROUTE_RECHECK_MS = 10000;
/** Standing still, the marker ignores moves smaller than this (map units, ~1.2 m). */
const STILL_DEADBAND = 2.5;
/** Inside an evacuation area for this many GPS fixes over this long counts as having entered it. */
const AREA_CONFIRM_FIXES = 2;
const AREA_CONFIRM_MS = 4000;
/** After "Not now", ask "Are you safe?" again after this long if still inside. */
const ASK_AGAIN_MS = 120000;

/** How an evacuation area is named in safety reports (admin dashboard). */
const reportArea = (area: EvacuationArea): ReportArea => ({ id: area.id, name: `${area.name} · ${area.place}` });
/** On the route, GPS noise may not pull the marker backwards by less than this (map units, ~6 m);
 * a real turn-back is larger. */
const BACKTRACK_LIMIT = 12;
/**
 * The no-route warning never appears this soon after navigation starts (or after Retry): GPS
 * needs time to settle and the route needs a few good fixes before it can be calculated.
 */
const NO_ROUTE_GRACE_MS = 45000;
/** "Outside the campus" only when GPS keeps placing you outside for this long and this many fixes. */
const OUTSIDE_CONFIRM_MS = 20000;
const OUTSIDE_CONFIRM_FIXES = 8;
/** "No route" only after this many failed route attempts over this long, with no success between. */
const ROUTE_FAIL_CONFIRM_MS = 20000;
const ROUTE_FAIL_CONFIRM_TRIES = 6;

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
  // No evacuation route could be found (off campus, or routing kept failing): ask the user.
  const [noRoute, setNoRoute] = useState(false);
  // Safety reports: the phone owner's name / ID, "Are you safe?" popup, and a short status toast.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileSheet, setProfileSheet] = useState<'required' | 'edit' | null>(null);
  const [safePrompt, setSafePrompt] = useState<{ area: EvacuationArea | null } | null>(null);
  const safePromptOpen = useRef(false);
  safePromptOpen.current = Boolean(safePrompt);
  const [toast, setToast] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>(getPushStatus());
  // Geofence: the area the user is in (and since when), and the last "Not now".
  const areaDwell = useRef<{ id: string; since: number; count: number; reported: boolean } | null>(null);
  const promptDismissed = useRef<{ id: string; at: number } | null>(null);
  // When navigation (or the last Retry) started, and the running off-campus / failed-route streaks.
  const noRouteClock = useRef(0);
  const outsideStreak = useRef<{ since: number; count: number } | null>(null);
  const routeFails = useRef<{ since: number; count: number } | null>(null);
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
    outsideStreak.current = null;
    routeFails.current = null;
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
    setNoRoute(false);
    resetRoute();
    setLiveMessage('Waiting for GPS...');
    setEmergencyType(type);
    setInstructionId(id => id + 1);
    setStage('instructions');
  }, [resetRoute]);

  const finishInstructions = useCallback(() => {
    // Called when the user taps "I'm outside now" (available during the whole guide).
    resetRoute();
    setOutsideCampus(false);
    setNoRoute(false);
    setOutsideConfirmed(true);
    noRouteClock.current = Date.now();
    areaDwell.current = null;
    promptDismissed.current = null;
    setLiveMessage('Requesting your current GPS location...');
    setStage('navigation');
    setLiveEnabled(true);
    // Tell campus staff this phone is on its way to an evacuation area.
    startReporting();
  }, [resetRoute]);

  // The phone owner's name and ID: asked once on the first launch, then used for push
  // registration and safety reports.
  useEffect(() => {
    void loadUser().then(saved => {
      setProfile(saved);
      if (!saved) setProfileSheet(sheet => sheet ?? 'required');
      void registerForPush();
    });
    // Back in the app (e.g. after allowing notifications in Settings): try registering again.
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void registerForPush(); });
    const stopProfile = onProfileChange(setProfile);
    const stopPush = onPushStatus(setPushStatus);
    return () => { appState.remove(); stopProfile(); stopPush(); };
  }, []);

  // The status toast disappears after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Alert link or notification: open the guide, or go straight to the map ("I'm safe outside").
  useEffect(() => {
    if (!emergencyRequest) return;
    setIncident(emergencyRequest.incidentId);
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

  /** Stop navigation and the voice, and go back to choosing an alert. */
  const backToStart = useCallback(() => {
    void Speech.stop().catch(() => {});
    setLiveEnabled(false);
    setOutsideConfirmed(false);
    setOutsideCampus(false);
    setNoRoute(false);
    setSafePrompt(null);
    areaDwell.current = null;
    promptDismissed.current = null;
    resetRoute();
    setStage('choose');
    setEmergencyType(null);
  }, [resetRoute]);

  // The I'm safe button asks the same "Are you safe?" question (with the area, if inside one).
  const markSafe = useCallback(() => {
    const dwell = areaDwell.current;
    const area = dwell?.reported ? EVACUATION_AREAS.find(a => a.id === dwell.id) ?? null : null;
    setSafePrompt({ area });
  }, []);

  // Confirmed safe: report it to campus staff (retried in the background if offline) and end
  // navigation right away; the toast says whether it got through.
  const confirmSafe = useCallback((entered?: Profile) => {
    if (entered) saveProfile(entered);
    const area = safePrompt?.area ?? null;
    backToStart();
    setToast('Sending your safety confirmation...');
    void reportStatus('safe_confirmed', area ? reportArea(area) : undefined).then(result => {
      setToast(result === 'sent' ? 'You are marked safe. Campus staff have been notified.'
        : result === 'queued' ? 'Saved. It will be sent to campus staff when you are connected.'
        : 'You are marked safe.');
    });
  }, [safePrompt, backToStart]);

  const dismissSafePrompt = useCallback(() => {
    promptDismissed.current = { id: safePrompt?.area?.id ?? '', at: Date.now() };
    setSafePrompt(null);
  }, [safePrompt]);

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

  // "Retry" on the no-route warning: forget the streaks, give GPS and routing the full grace
  // period again, and ask for a fresh fix.
  const retryRoute = useCallback(() => {
    setNoRoute(false);
    noRouteClock.current = Date.now();
    outsideStreak.current = null;
    routeFails.current = null;
    setOutsideCampus(false);
    retryGps();
  }, [retryGps]);

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
    const now = Date.now();
    const warnAllowed = now - noRouteClock.current >= NO_ROUTE_GRACE_MS;
    // The barometer learns ground level only from confident outdoor fixes.
    setAtGround(check.code === 'ok');
    if (gpsTestRef.current) setGpsDebug({ raw, smoothed: fix, point: check.point, screen: check.code });
    if (!check.usable || !check.point) {
      if (check.code === 'outside-campus') {
        const streak = outsideStreak.current ?? (outsideStreak.current = { since: now, count: 0 });
        streak.count += 1;
        // GPS drift can put a real campus user outside the approximate campus rectangle for a
        // while. Require a sustained run of accurate outside fixes.
        if (streak.count >= OUTSIDE_CONFIRM_FIXES && now - streak.since >= OUTSIDE_CONFIRM_MS) {
          setOutsideCampus(true);
          if (warnAllowed) setNoRoute(true);
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
        outsideStreak.current = null;
        setOutsideCampus(false);
      }
      setRouteWarning(Boolean(lastCalculated.current));
      setLiveMessage(check.reason);
      // Keep the last VERIFIED marker and route; do not trust a point that
      // falls into a roof polygon or has high reported uncertainty.
      return;
    }

    outsideStreak.current = null;
    setOutsideCampus(false);
    setRouteWarning(false);
    const point = check.point;
    setGpsAccuracy(fix.accuracy);

    // Geofence: inside an evacuation area for a couple of fixes reports "arrived" and asks
    // "Are you safe?". After "Not now" it asks again later, or when the user comes back in.
    const inArea = evacuationAreaAt(point);
    if (!inArea) {
      areaDwell.current = null;
      promptDismissed.current = null;
    } else {
      if (areaDwell.current?.id !== inArea.id) areaDwell.current = { id: inArea.id, since: now, count: 0, reported: false };
      const dwell = areaDwell.current;
      dwell.count += 1;
      if (dwell.count >= AREA_CONFIRM_FIXES && now - dwell.since >= AREA_CONFIRM_MS) {
        if (!dwell.reported) {
          dwell.reported = true;
          void reportStatus('arrived', reportArea(inArea));
        }
        const dismissed = promptDismissed.current;
        if (!safePromptOpen.current && (!dismissed || dismissed.id !== inArea.id || now - dismissed.at >= ASK_AGAIN_MS)) {
          setSafePrompt({ area: inArea });
        }
      }
    }
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
      // No route and nothing verified to fall back on: keep trying with each fix; only after
      // repeated failures over a long enough time ask whether they are off campus.
      if (!previous) {
        const fails = routeFails.current ?? (routeFails.current = { since: now, count: 0 });
        fails.count += 1;
        if (warnAllowed && fails.count >= ROUTE_FAIL_CONFIRM_TRIES && now - fails.since >= ROUTE_FAIL_CONFIRM_MS) setNoRoute(true);
      }
      setRouteWarning(Boolean(previous));
      setLiveMessage(previous
        ? 'Cannot confirm a new safe route. Keeping the last verified route.'
        : 'Still calculating your route. Stay in an open area...');
      return;
    }
    routeFails.current = null;
    setRouteWarning(false);
    setNoRoute(false);
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
          routeWarning={routeWarning}
          onToggleGpsTest={() => setGpsTestOpen(v => !v)}
          onSafe={markSafe}
          onRetryGps={retryGps}
        />
      )}
      {!editorOpen && stage === 'navigation' && noRoute && (
        <NoRouteWarning onRetry={retryRoute} onOutsideCampus={backToStart} />
      )}
      {!editorOpen && stage === 'navigation' && safePrompt && (
        <SafeConfirmPopup area={safePrompt.area} needsProfile={!profile} onSafe={confirmSafe} onNotNow={dismissSafePrompt} />
      )}
      {!editorOpen && stage === 'choose' && (
        <EmergencyChooser onSelect={selectEmergency} profileName={profile?.name ?? null}
          onEditProfile={() => setProfileSheet('edit')} pushStatus={pushStatus} />
      )}
      {/* Never in the way during an emergency: the first-launch form waits for the chooser. */}
      {profileSheet && (profileSheet === 'edit' || stage === 'choose') && (
        <ProfileSheet initial={profile} required={profileSheet === 'required'}
          onSave={entered => { saveProfile(entered); setProfileSheet(null); }}
          onClose={() => setProfileSheet(null)} />
      )}
      {toast && (
        <View style={toastStyles.toast} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={toastStyles.text}>{toast}</Text>
        </View>
      )}
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

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 76, left: 16, right: 16, zIndex: 140, elevation: 140,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#14532D',
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
