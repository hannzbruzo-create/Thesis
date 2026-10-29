import { useEffect, useRef, useState } from 'react';
import { Barometer } from 'expo-sensors';

/** Height of one storey (m) and how long it must last before we believe it (ms). */
const UPPER_FLOOR_M = 2.5;
const HOLD_MS = 4000;
/** Air pressure falls about 0.12 hPa per metre near sea level. */
const HPA_PER_METRE = 0.12;

export type FloorState = {
  available: boolean;
  /** Height above the ground-level reference (m), or null before a reference exists. */
  heightM: number | null;
  /** True when the phone has been at least one storey above ground for a few seconds. */
  upperFloor: boolean;
};

/**
 * Barometer check for "are you upstairs?". Navigation is outdoor-only, and GPS cannot tell floors
 * apart, so when the pressure says you are a storey or more above the ground-level reference the
 * app asks you to go down and outside first.
 *
 * The ground reference is learned while `atGround` is true (a good outdoor GPS fix) and drifts
 * slowly with it, so normal weather changes in pressure do not build up.
 */
export default function useFloorDetector(enabled: boolean, atGround: boolean): FloorState {
  const [state, setState] = useState<FloorState>({ available: false, heightM: null, upperFloor: false });
  const ground = useRef(atGround);
  ground.current = atGround;

  useEffect(() => {
    if (!enabled) { setState({ available: false, heightM: null, upperFloor: false }); return; }
    let active = true;
    let sub: { remove: () => void } | null = null;
    let reference: number | null = null;
    let pressure: number | null = null;
    let aboveSince = 0;
    void Barometer.isAvailableAsync().then(ok => {
      if (!active || !ok) return;
      Barometer.setUpdateInterval(1000);
      sub = Barometer.addListener(({ pressure: hPa }) => {
        if (!Number.isFinite(hPa)) return;
        pressure = pressure == null ? hPa : pressure + (hPa - pressure) * 0.3;
        if (ground.current) reference = reference == null ? pressure : reference + (pressure - reference) * 0.05;
        if (reference == null) { setState({ available: true, heightM: null, upperFloor: false }); return; }
        const height = (reference - pressure) / HPA_PER_METRE;
        const now = Date.now();
        if (height > UPPER_FLOOR_M) aboveSince = aboveSince || now; else aboveSince = 0;
        setState({ available: true, heightM: height, upperFloor: aboveSince > 0 && now - aboveSince > HOLD_MS });
      });
    }).catch(() => {});
    return () => { active = false; sub?.remove(); };
  }, [enabled]);

  return state;
}
