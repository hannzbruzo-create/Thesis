import { useEffect, useMemo, useRef } from 'react';
import * as Speech from 'expo-speech';
import type { PreviewPlan } from '../navigation/routePreview';
import { nextInstruction, type Instruction } from '../navigation/voiceDirections';
import { routeLengthMetres } from '../navigation/routeFollow';

/** Announce a turn when it is this close (m), then again as "now" at NOW_METRES. */
const AHEAD_METRES = 30;
const NOW_METRES = 8;
const ARRIVED_METRES = 8;
/** Minimum gap between announcements (ms), so GPS jitter cannot make the voice chatter. */
const MIN_GAP_MS = 3500;

/**
 * Spoken walking directions on the map. The voice speaks only when something changes: a new
 * route or evacuation area, a turn coming up (about 30 m before, and again when you reach it),
 * and arrival. Returns the current instruction for the on-map pill.
 */
export default function useVoiceDirections(plan: PreviewPlan | null, active: boolean, muted: boolean): Instruction | null {
  const instruction = useMemo(() => (plan ? nextInstruction(plan.route, plan.area.name) : null), [plan]);
  const remaining = plan ? routeLengthMetres(plan.route) : null;
  const arrived = remaining != null && remaining <= ARRIVED_METRES;
  const area = useRef<string | null>(null);
  const announced = useRef(new Set<string>());
  const lastAt = useRef(0);
  const arrivedSaid = useRef(false);

  // Leaving navigation resets everything, so the next emergency starts fresh.
  useEffect(() => {
    if (active) return;
    area.current = null;
    announced.current.clear();
    arrivedSaid.current = false;
  }, [active]);
  useEffect(() => { if (muted) void Speech.stop().catch(() => {}); }, [muted]);

  useEffect(() => {
    if (!active || !plan || !instruction) return;
    const say = (text: string, force = false) => {
      if (muted || (!force && Date.now() - lastAt.current < MIN_GAP_MS)) return false;
      lastAt.current = Date.now();
      void Speech.stop().catch(() => {}).then(() => Speech.speak(text, { language: 'en-US', rate: 0.95 }));
      return true;
    };
    if (arrived) {
      if (!arrivedSaid.current && say(`You have arrived at ${plan.area.name}. Stay here and wait for the all-clear.`, true)) arrivedSaid.current = true;
      return;
    }
    arrivedSaid.current = false;
    const stage = (s: string) => `${instruction.turnId}:${s}`;
    if (area.current !== plan.area.id) {
      // New route, or a closer evacuation area was found: say where we are going and the first step.
      const first = area.current === null;
      const intro = first ? `Route found to ${plan.area.name}.` : `New route to ${plan.area.name}.`;
      if (say(`${intro} ${instruction.spoken}`, true)) {
        area.current = plan.area.id;
        announced.current.clear();
        announced.current.add(stage(instruction.metres <= NOW_METRES ? 'now' : 'ahead'));
      }
      return;
    }
    if (instruction.kind === 'straight') return;
    if (instruction.metres <= NOW_METRES && !announced.current.has(stage('now'))) {
      if (say(instruction.spoken)) announced.current.add(stage('now')).add(stage('ahead'));
    } else if (instruction.metres <= AHEAD_METRES && !announced.current.has(stage('ahead'))) {
      if (say(instruction.spoken)) announced.current.add(stage('ahead'));
    }
  }, [active, plan, instruction, arrived, muted]);

  return active ? instruction : null;
}
