import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

/** Sample rate (ms) and step thresholds on the acceleration magnitude (in g, 1 g = gravity). */
const INTERVAL_MS = 20;
const PEAK_G = 1.12;
const RESET_G = 1.02;
/** Fastest plausible walking/running cadence: at most one step per this many ms. */
const MIN_STEP_MS = 280;

/**
 * Detects walking steps from the accelerometer (no extra permission needed): each step shows up
 * as a peak in the smoothed acceleration magnitude. Calls `onStep(time)` per step and returns
 * whether the sensor is available.
 */
export default function useStepDetector(enabled: boolean, onStep: (time: number) => void): boolean {
  const [available, setAvailable] = useState(false);
  const callback = useRef(onStep);
  callback.current = onStep;

  useEffect(() => {
    if (!enabled) { setAvailable(false); return; }
    let active = true;
    let sub: { remove: () => void } | null = null;
    let smooth = 1, armed = true, lastStep = 0;
    void Accelerometer.isAvailableAsync().then(ok => {
      if (!active || !ok) return;
      setAvailable(true);
      Accelerometer.setUpdateInterval(INTERVAL_MS);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const g = Math.sqrt(x * x + y * y + z * z);
        smooth += (g - smooth) * 0.3; // light low-pass against hand jitter
        const now = Date.now();
        if (armed && smooth > PEAK_G && now - lastStep > MIN_STEP_MS) {
          armed = false;
          lastStep = now;
          callback.current(now);
        } else if (smooth < RESET_G) {
          armed = true;
        }
      });
    }).catch(() => {});
    return () => { active = false; sub?.remove(); };
  }, [enabled]);

  return available;
}
