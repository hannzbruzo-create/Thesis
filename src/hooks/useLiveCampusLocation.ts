import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';
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
    // True while a system dialog we opened (permission, "turn on precise location") is showing.
    // Those dialogs briefly move the app out of 'active'; that must not pause or restart GPS,
    // or the app asks again as soon as the dialog closes and loops forever.
    let asking = false;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => { ++serial; subscription?.remove(); subscription = null; };

    const begin = async () => {
      if (subscription || asking) return; // already tracking, or a request is in flight
      const turn = ++serial;
      asking = true;
      setState(previous => ({...previous, phase:'requesting', message:'Requesting GPS access...'}));
      try {
        // Only show the permission dialog when it is needed (and still allowed to be shown).
        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' && permission.canAskAgain) {
          permission = await Location.requestForegroundPermissionsAsync();
        }
        if (!active || turn !== serial) return;
        if (permission.status !== 'granted') {
          setState(previous=>({...previous,phase:'permission-denied',
            message: permission.canAskAgain
              ? 'Location permission denied. Tap Retry GPS and choose "While using the app".'
              : 'Location is blocked for TomaSafe. Tap Retry GPS to open Settings, then allow Location.'}));
          return;
        }
        // expo-location reads positions from Google's Fused Location Provider on Android. Its best
        // accuracy needs Google Location Accuracy (Wi-Fi + cell + GPS); if that is off, Android
        // shows its one-tap "Turn on" dialog here.
        if (Platform.OS === 'android') await Location.enableNetworkProviderAsync().catch(() => {});
        if (!active || turn !== serial) return;
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
          // Raw fused fix: smoothing, jump rejection and step/compass fusion happen in one place
          // (GpsKalmanFilter), so the position is not smoothed twice (which made it lag behind).
          const fix: GpsFix = {latitude, longitude, accuracy, timestamp:location.timestamp};
          lastSmoothed=fix;
          setState({phase:'tracking', message:'Receiving live GPS updates', fix});
        });
        if (!active || turn !== serial) watcher.remove();
        else subscription = watcher;
      } catch (err) {
        if (active && turn === serial) setState(previous=>({...previous,phase:'error',
          message:err instanceof Error ? err.message : 'GPS unavailable on this device.'}));
      } finally {
        asking = false; // only one request runs at a time, so this is always ours
      }
    };

    const appSub = AppState.addEventListener('change', next => {
      if (!active) return;
      if (next === 'active') {
        if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
        void begin(); // no-op if GPS is still running; otherwise restart with a fresh fix
        return;
      }
      // Ignore short trips out of 'active' (system dialogs, notification shade, our own requests);
      // pause only when the user has really left the app for a few seconds.
      if (asking || next !== 'background' || pauseTimer) return;
      pauseTimer = setTimeout(() => {
        pauseTimer = null;
        if (!active || AppState.currentState === 'active') return;
        stop();
        setState(previous=>({...previous, phase:'background', message:'GPS paused. Keeping the last verified route.'}));
      }, 3000);
    });
    if (AppState.currentState === 'active') void begin();
    else setState(previous=>({...previous,phase:'background',message:'GPS starts when TomaSafe is in the foreground.'}));
    return () => { active=false; stop(); appSub.remove(); if (pauseTimer) clearTimeout(pauseTimer); };
  }, [enabled, retryKey]);
  return state;
}
