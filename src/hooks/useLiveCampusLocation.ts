import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import type { GpsFix } from '../location/campusGps';

type Phase = 'off' | 'requesting' | 'searching' | 'tracking' |
  'permission-denied' | 'unavailable' | 'error' | 'background';
export type LiveLocationState = {
  phase: Phase;
  fix: GpsFix | null;
  message: string;
};
const OFF: LiveLocationState = { phase:'off', fix:null, message:'GPS is off' };

/** Foreground GPS watcher: Expo Go compatible (expo-location).
 * No network dependency, no background service, and no FCM requirement. */
export default function useLiveCampusLocation(enabled: boolean, retryKey = 0): LiveLocationState {
  const [state, setState] = useState<LiveLocationState>(OFF);

  useEffect(() => {
    if (!enabled) { setState(OFF); return; }
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    let serial = 0;
    let lastSmoothed: GpsFix | null = null;
    const stop = () => { ++serial; subscription?.remove(); subscription = null; };

    const begin = async () => {
      const turn = ++serial;
      setState(previous => ({...previous, phase:'requesting', message:'Requesting GPS access...'}));
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active || turn !== serial) return;
        if (status !== 'granted') {
          setState(previous=>({...previous,phase:'permission-denied',
            message:'Location permission denied. Allow TomaSafe to access location in Settings.'}));
          return;
        }
        if (!await Location.hasServicesEnabledAsync()) {
          if (active) setState(previous=>({...previous,phase:'unavailable',message:'Turn on device Location services.'}));
          return;
        }
        if (!active || turn !== serial) return;
        setState(previous => ({...previous, phase:'searching', message:'Waiting for a fresh GPS position...'}));
        const watcher = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
          mayShowUserSettingsDialog: true,
        }, location => {
          if (!active || turn !== serial) return;
          const { latitude, longitude, accuracy } = location.coords;
          // Never use an invalid or cached bad fix to redraw a route.
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          const now = Date.now();
          // Drop stale/out-of-order provider samples; keep live marker responsive.
          if (now - location.timestamp > 12000 ||
              (lastSmoothed && location.timestamp <= lastSmoothed.timestamp)) return;
          const raw: GpsFix = {latitude, longitude, accuracy, timestamp:location.timestamp};
          let fix = raw;
          if (lastSmoothed) {
            const dt = Math.max(0.1, (raw.timestamp-lastSmoothed.timestamp)/1000);
            const meters = Math.hypot(
              (raw.latitude-lastSmoothed.latitude)*111000,
              (raw.longitude-lastSmoothed.longitude)*108000
            );
            // Reject one-off physically implausible jumps but allow reacquisition
            // after the device has been without a GPS fix for several seconds.
            if (dt < 5 && meters > Math.max(40, dt * 12 + 25)) return;
            // Light adaptive smoothing, not a multi-second lagging average.
            const alpha = accuracy != null && accuracy > 12 ? 0.60 : 0.85;
            fix = {
              ...raw,
              latitude:lastSmoothed.latitude+(latitude-lastSmoothed.latitude)*alpha,
              longitude:lastSmoothed.longitude+(longitude-lastSmoothed.longitude)*alpha,
            };
          }
          lastSmoothed=fix;
          setState({phase:'tracking', message:'Receiving live GPS updates', fix});
        });
        if (!active || turn !== serial) watcher.remove();
        else subscription = watcher;
      } catch (err) {
        if (active && turn === serial) setState(previous=>({...previous,phase:'error',
          message:err instanceof Error ? err.message : 'GPS unavailable on this device.'}));
      }
    };

    const appSub = AppState.addEventListener('change', next => {
      if (!active) return;
      if (next !== 'active') {
        stop();
        setState(previous=>({...previous, phase:'background', message:'GPS paused. Keeping the last verified route.'}));
      } else {
        void begin(); // restart with a fresh fix after returning to foreground
      }
    });
    if (AppState.currentState === 'active') void begin();
    else setState(previous=>({...previous,phase:'background',message:'GPS starts when TomaSafe is in the foreground.'}));
    return () => { active=false; stop(); appSub.remove(); };
  }, [enabled, retryKey]);
  return state;
}
