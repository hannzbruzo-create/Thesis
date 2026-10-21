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
    const stop = () => { ++serial; subscription?.remove(); subscription = null; };

    const begin = async () => {
      const turn = ++serial;
      setState(previous => ({...previous, phase:'requesting', message:'Requesting GPS access...'}));
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active || turn !== serial) return;
        if (status !== 'granted') {
          setState({phase:'permission-denied', fix:null,
            message:'Location permission denied. Allow TomaSafe to access location in Settings.'});
          return;
        }
        if (!await Location.hasServicesEnabledAsync()) {
          if (active) setState({phase:'unavailable', fix:null, message:'Turn on device Location services.'});
          return;
        }
        if (!active || turn !== serial) return;
        setState({phase:'searching', fix:null, message:'Waiting for a fresh GPS position...'});
        const watcher = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 2500,
          distanceInterval: 2.5,
          mayShowUserSettingsDialog: true,
        }, location => {
          if (!active || turn !== serial) return;
          const { latitude, longitude, accuracy } = location.coords;
          // Never use an invalid or cached bad fix to redraw a route.
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          setState({phase:'tracking', message:'Receiving live GPS updates',
            fix:{latitude,longitude,accuracy,timestamp:location.timestamp}});
        });
        if (!active || turn !== serial) watcher.remove();
        else subscription = watcher;
      } catch (err) {
        if (active && turn === serial) setState({phase:'error', fix:null,
          message:err instanceof Error ? err.message : 'GPS unavailable on this device.'});
      }
    };

    const appSub = AppState.addEventListener('change', next => {
      if (!active) return;
      if (next !== 'active') {
        stop();
        setState({phase:'background', fix:null, message:'GPS paused while the app is in the background.'});
      } else {
        void begin(); // restart with a fresh fix after returning to foreground
      }
    });
    if (AppState.currentState === 'active') void begin();
    else setState({phase:'background',fix:null,message:'GPS starts when TomaSafe is in the foreground.'});
    return () => { active=false; stop(); appSub.remove(); };
  }, [enabled, retryKey]);
  return state;
}
