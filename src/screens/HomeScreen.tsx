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

  const resetRoute = useCallback(() => {
    activeFocus.current = null;
    lastCalculated.current = null;
    mostRecentFix.current = 0;
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
    resetRoute();
    setOutsideCampus(false);
    setLiveMessage('Retrying a fresh GPS fix...');
    setGpsRetryKey(key => key + 1);
  }, [resetRoute]);

  const showPlan = useCallback((result: PreviewPlan) => {
    const id = ++focusSequence.current;
    activeFocus.current = { id, plan: result };
    setPlan(result);
    setDisplayPlan(null);
    setFocusRequest({ point: result.origin, id });
  }, []);

  const finishFocus = useCallback((id: number) => {
    if (activeFocus.current?.id === id) {
      setDisplayPlan(activeFocus.current.plan);
    }
  }, []);

  // Foreground GPS updates the marker. Recalculate only after meaningful
  // movement; hysteresis retains a destination through small near-ties.
  useEffect(() => {
    if (!liveEnabled || !outsideConfirmed || stage !== 'navigation') return;
    if (!gps.fix) {
      setLiveMessage(gps.message);
      if (gps.phase === 'background' || gps.phase === 'error' ||
          gps.phase === 'unavailable' || gps.phase === 'permission-denied') {
        resetRoute();
        setOutsideCampus(false);
      }
      return;
    }
    const fix = gps.fix;
    if (fix.timestamp <= mostRecentFix.current) return;
    mostRecentFix.current = fix.timestamp;
    if (Date.now() - fix.timestamp > 15000) {
      setLiveMessage('GPS is outdated. Waiting for a fresh location.');
      setOutsideCampus(false);
      resetRoute();
      return;
    }
    const check = screenOutdoorFix(fix);
    if (!check.usable || !check.point) {
      setOutsideCampus(check.code === 'outside-campus');
      setLiveMessage(check.reason);
      resetRoute();
      return;
    }

    setOutsideCampus(false);
    const point = check.point;
    const previous = lastCalculated.current;
    const moved = previous ? distanceMeters(previous.fix, fix) : Infinity;
    const elapsedSeconds = previous ? Math.max(1, (fix.timestamp - previous.fix.timestamp) / 1000) : Infinity;
    if (previous && moved > Math.max(45, elapsedSeconds * 12)) {
      setLiveMessage('GPS changed unexpectedly. Waiting for a stable position...');
      return;
    }
    // This is the *actual* GPS point, not the selected graph node.
    setStartPoint(point);
    setLiveMessage(
      `GPS accuracy ±${Math.round(fix.accuracy ?? 0)} m · ${previous?'Route updates as you walk':'Calculating the nearest evacuation route...'}`
    );
    const elapsed = previous ? Date.now() - previous.at : Infinity;
    if (previous && (moved < MIN_REROUTE_MOVEMENT_M || elapsed < MIN_REROUTE_INTERVAL_MS)) return;

    const snapped = snapPreviewStart(point);
    if (!snapped.node) {
      setLiveMessage(snapped.blocked ? 'Location overlaps a blocked building area. Routing paused.' :
        'No mapped walkable path nearby. Routing paused.');
      resetRoute();
      return;
    }
    const result = calculatePreview(snapped.node.id, point, {
      preferredAreaId: previous?.plan.area.id,
      switchMargin: previous ? Math.max(8, previous.plan.weightedDistance * 0.04) : 0,
    });
    if (!result.plan) {
      setLiveMessage(`Route unavailable: ${result.message}`);
      resetRoute();
      return;
    }
    setStart(snapped.node);
    setStartOnPath(snapped.onPath);
    lastCalculated.current = {fix,plan:result.plan,at:Date.now()};
    if (!previous) showPlan(result.plan);
    else {
      // Reuse camera and avoid replaying its focus animation on GPS updates.
      activeFocus.current = null;
      setPlan(result.plan);
      setDisplayPlan(result.plan);
    }
  }, [liveEnabled, outsideConfirmed, stage, gps.fix?.timestamp, gps.phase, gps.message, showPlan, resetRoute]);

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
      />
      <HeaderBar />
      {stage === 'navigation' && emergencyType && (
        <NavigationPanel
          plan={plan}
          emergencyMode={emergencyType}
          liveStatus={liveMessage}
          outsideCampus={outsideCampus}
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
