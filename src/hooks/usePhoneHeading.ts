import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

/** Compass heading in degrees clockwise from north. Null if unavailable.
 * Uses the foreground location permission already requested for live GPS.
 */
export default function usePhoneHeading(enabled: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) { setHeading(null); return; }
    let active = true;
    let generation = 0;
    let watcher: Location.LocationSubscription | null = null;
    let smoothed: number | null = null;

    const stop = () => {
      generation += 1;
      watcher?.remove();
      watcher = null;
      smoothed = null;
      setHeading(null);
    };

    const start = async () => {
      const current = ++generation;
      try {
        const permissions = await Location.getForegroundPermissionsAsync();
        if (!active || generation !== current || permissions.status !== 'granted') return;
        const sub = await Location.watchHeadingAsync(({ trueHeading, magHeading, accuracy }) => {
          if (!active || generation !== current) return;
          // Expo heading accuracy: 0 unreliable, 1 low, 2 moderate, 3 high.
          if (accuracy < 2) { smoothed = null; setHeading(null); return; }
          const raw = trueHeading >= 0 ? trueHeading : magHeading;
          if (!Number.isFinite(raw) || raw < 0) return;
          const normalized = ((raw % 360) + 360) % 360;
          if (smoothed === null) smoothed = normalized;
          else {
            // Shortest signed angle avoids jumping through 360°/0°.
            const delta = ((normalized - smoothed + 540) % 360) - 180;
            smoothed = (smoothed + delta * 0.24 + 360) % 360;
          }
          setHeading(smoothed);
        });
        if (!active || generation !== current) sub.remove();
        else watcher = sub;
      } catch {
        if (active && generation === current) setHeading(null);
      }
    };

    const stateListener = AppState.addEventListener('change', state => {
      if (state !== 'active') stop();
      else void start();
    });
    if (AppState.currentState === 'active') void start();
    return () => { active = false; stop(); stateListener.remove(); };
  }, [enabled]);

  return heading;
}
