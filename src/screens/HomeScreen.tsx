import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StatusBar, View } from 'react-native';
import CampusMap from '../components/map/CampusMap';
import HeaderBar from '../components/ui/HeaderBar';
import NavigationPanel from '../components/ui/NavigationPanel';
import EmergencyInstructions from '../components/ui/EmergencyInstructions';
import EmergencyChooser from '../components/ui/EmergencyChooser';
import type { EmergencyType } from '../emergency/emergencyTypes';
import { snapPreviewStart, calculatePreview, type PreviewPlan } from '../navigation/routePreview';
import type { Point, GraphNode } from '../navigation/walkableGraph';
import useLiveCampusLocation from '../hooks/useLiveCampusLocation';
import {
  screenOutdoorFix, distanceMeters, MIN_REROUTE_INTERVAL_MS,
  MIN_REROUTE_MOVEMENT_M, type GpsFix,
} from '../location/campusGps';
import styles from '../styles/screens/HomeScreen.styles';

type Props = {
  /** Reserved for future FCM tap handler. Expo Go does not import notifications. */
  emergencyRequest?: { id: number; type: EmergencyType } | null;
};
type Stage = 'choose' | 'instructions' | 'navigation';
type CalculatedAt = { fix: GpsFix; plan: PreviewPlan; at: number };

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
  const [focusRequest, setFocusRequest] = useState<{ point: Point; id: number } | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [gpsRetryKey, setGpsRetryKey] = useState(0);
  const [outsideConfirmed, setOutsideConfirmed] = useState(false);
  const [outsideCampus, setOutsideCampus] = useState(false);
  const [liveMessage, setLiveMessage] = useState('GPS starts after you confirm you are outside.');
  const gps = useLiveCampusLocation(liveEnabled, gpsRetryKey);
  const ignoreMapTap = useCallback((_point: Point) => {}, []);
  const lastCalculated = useRef<CalculatedAt | null>(null);
  const mostRecentFix = useRef(0);
  const outsideConsecutive = useRef(0);

  const resetRoute = useCallback(() => {
    activeFocus.current = null;
    lastCalculated.current = null;
    mostRecentFix.current = 0;
    outsideConsecutive.current = 0;
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

  // Future FCM integration can supply the same event without introducing a
  // notification listener into Expo Go's unsupported native environment.
  useEffect(() => {
    if (emergencyRequest) selectEmergency(emergencyRequest.type);
  }, [emergencyRequest?.id, selectEmergency]);

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
    // A retry must NEVER remove an already verified path.
    setRouteWarning(Boolean(lastCalculated.current));
    setLiveMessage('Retrying a fresh GPS fix...');
    setGpsRetryKey(key => key + 1);
  }, []);

  const showPlan = useCallback((result: PreviewPlan) => {
    const id = ++focusSequence.current;
    activeFocus.current = { id, plan: result };
    setPlan(result);
    setDisplayPlan(null);
    setAnimateRoute(true);
    setFocusRequest({ point: result.origin, id });
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
    const fix = gps.fix;
    if (fix.timestamp <= mostRecentFix.current) return;
    mostRecentFix.current = fix.timestamp;
    if (Date.now() - fix.timestamp > 15000) {
      setRouteWarning(Boolean(lastCalculated.current));
      setLiveMessage('Waiting for fresh GPS. Last verified route remains visible.');
      return;
    }

    const check = screenOutdoorFix(fix);
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
    // Marker follows current reliable GPS, independently of route throttling.
    setStartPoint(point);
    setLiveMessage(previous
      ? `GPS ±${Math.round(fix.accuracy ?? 0)} m · Route updates as you walk`
      : 'Calculating nearest evacuation route...');

    const elapsed = previous ? Date.now() - previous.at : Infinity;
    if (previous && !outsideCampus &&
        (moved < MIN_REROUTE_MOVEMENT_M || elapsed < MIN_REROUTE_INTERVAL_MS ||
         (animateRoute && Date.now() - previous.at < 3000))) return;

    const snapped = snapPreviewStart(point);
    if (!snapped.node) {
      setRouteWarning(Boolean(previous));
      setLiveMessage('GPS is near a restricted area. Keeping the last verified route.');
      return;
    }
    const result = calculatePreview(snapped.node.id, point, {
      preferredAreaId: previous?.plan.area.id,
      switchMargin: previous ? Math.max(8, previous.plan.weightedDistance * 0.04) : 0,
    });
    if (!result.plan) {
      setRouteWarning(Boolean(previous));
      setLiveMessage('Cannot confirm a new safe route. Keeping the last verified route.');
      return;
    }
    setRouteWarning(false);
    setStart(snapped.node);
    setStartOnPath(snapped.onPath);
    lastCalculated.current = {fix,plan:result.plan,at:Date.now()};
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
    gps.message, showPlan, outsideCampus, animateRoute]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <CampusMap
        start={start}
        startPoint={startPoint}
        startOnPath={startOnPath}
        focusRequest={focusRequest}
        onFocusSettled={finishFocus}
        plan={displayPlan}
        showGraph={false}
        onMapTap={ignoreMapTap}
        liveGps={liveEnabled}
        animateRoute={animateRoute}
      />
      <HeaderBar />
      {stage === 'navigation' && emergencyType && (
        <NavigationPanel
          plan={plan}
          emergencyMode={emergencyType}
          liveStatus={liveMessage}
          outsideCampus={outsideCampus}
          routeWarning={routeWarning}
          onChangeEmergency={changeEmergency}
          onRetryGps={retryGps}
        />
      )}
      {stage === 'choose' && <EmergencyChooser onSelect={selectEmergency} />}
      {stage === 'instructions' && emergencyType && (
        <EmergencyInstructions
          key={instructionId}
          type={emergencyType}
          onFinished={finishInstructions}
        />
      )}
    </View>
  );
}
