import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import type { EmergencyType } from '../../emergency/emergencyTypes';
import { EMERGENCY_CONTENT, GUIDE_LOOPS, GUIDE_PHASES, MAP_STEP_LABEL } from '../../emergency/emergencyTypes';
import GuideVisual from './GuideVisual';

type Props = {
  type: EmergencyType;
  /** The user is outside: stop the voice and open navigation. */
  onFinished: () => void;
  /** Sheet height in px (the map frames the campus in the space above it). */
  height: number;
  muted: boolean;
  onToggleMute: () => void;
};

/** Pause between the two plays of a phase, and before the next phase starts (ms). */
const LOOP_PAUSE_MS = 1200;
/** Time a step stays on screen when the voice is off (ms, roughly reading speed). */
const readingTime = (text: string) => Math.max(2500, text.split(/\s+/).length * 420);

/**
 * Emergency voice guide. Each step of a phase is spoken with a matching animation and a short
 * caption; the phase plays GUIDE_LOOPS times and then the guide moves on to the next phase by
 * itself (on a timer when the voice is off). "I'm outside now" is always available.
 */
export default function EmergencyInstructions({ type, onFinished, height, muted, onToggleMute }: Props) {
  const content = EMERGENCY_CONTENT[type];
  const phases = GUIDE_PHASES[type];
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [loop, setLoop] = useState(0);
  const [done, setDone] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  // Where the guide is, so muting or a voice error continues from the same step.
  const position = useRef({ step: 0, loop: 0 });
  const session = useRef(0);
  const finished = useRef(false);
  const phase = phases[index];
  const last = index === phases.length - 1;
  const steps = phases.length + 1; // the map is the final step
  const current = done ? null : phase.steps[step];

  // Play the phase step by step (voice, or a reading timer), twice, then move on.
  useEffect(() => {
    if (done) return;
    const id = ++session.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const alive = () => session.current === id && !finished.current;
    void Speech.stop().catch(() => {});

    const play = (s: number, l: number) => {
      if (!alive()) return;
      if (s >= phase.steps.length) {
        if (l + 1 < GUIDE_LOOPS) { timer = setTimeout(() => play(0, l + 1), LOOP_PAUSE_MS); return; }
        if (last) { setDone(true); return; }
        timer = setTimeout(() => {
          if (!alive()) return;
          position.current = { step: 0, loop: 0 };
          setStep(0);
          setLoop(0);
          setIndex(i => i + 1);
        }, LOOP_PAUSE_MS);
        return;
      }
      position.current = { step: s, loop: l };
      setStep(s);
      setLoop(l);
      const text = phase.steps[s].say;
      let moved = false;
      const next = () => {
        if (moved || !alive()) return;
        moved = true;
        if (timer) clearTimeout(timer);
        play(s + 1, l);
      };
      if (muted || voiceError) { timer = setTimeout(next, readingTime(text)); return; }
      // Safety net: some devices never report the end of speech.
      timer = setTimeout(next, readingTime(text) * 2 + 4000);
      try {
        Speech.speak(text, {
          language: 'en-US',
          rate: 0.9,
          onDone: next,
          onError: () => { if (alive()) setVoiceError(true); },
        });
      } catch {
        setVoiceError(true);
      }
    };
    timer = setTimeout(() => play(position.current.step, position.current.loop), 300);
    return () => {
      session.current++;
      if (timer) clearTimeout(timer);
      void Speech.stop().catch(() => {});
    };
  }, [phase, muted, voiceError, done]);

  // A strong buzz on each new phase, so people notice the change without looking.
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [index]);

  const goOutside = () => {
    if (finished.current) return;
    finished.current = true;
    session.current++;
    void Speech.stop().catch(() => {});
    onFinished();
  };

  const voiceText = voiceError
    ? 'Voice unavailable · follow the pictures'
    : muted
      ? 'Voice off · tap the speaker to turn it on'
      : done
        ? 'Guide finished'
        : `Playing ${loop + 1} of ${GUIDE_LOOPS}`;
  const visualSize = Math.max(110, Math.min(180, Math.round(height * 0.32)));

  return (
    <View style={s.root} pointerEvents="box-none">
      <View style={s.backdrop} />
      <View style={[s.sheet, { height }]}>
        <View style={[s.band, { backgroundColor: content.tint }]}>
          <View style={s.bandIcon}>
            <MaterialCommunityIcons name={content.icon} size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bandKicker}>{type === 'earthquake' ? 'EARTHQUAKE ALERT' : 'FIRE ALERT'}</Text>
            <Text style={s.bandTitle}>Step {done ? steps : index + 1} of {steps}</Text>
          </View>
          <Pressable style={s.mute} onPress={onToggleMute} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={muted ? 'Turn voice on' : 'Turn voice off'}>
            <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={17} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={s.phases}>
          {[...phases.map(p => p.label), MAP_STEP_LABEL].map((label, i) => {
            const at = done ? phases.length : index;
            const state = i < at ? 'done' : i === at ? 'now' : 'todo';
            const color = state === 'done' ? '#15803D' : state === 'now' ? content.tint : '#94A3B8';
            return (
              <View key={label} style={{ flex: 1 }}>
                <View style={[s.phaseBar, { backgroundColor: state === 'todo' ? '#E2E8F0' : color }]} />
                <Text style={[s.phaseLabel, { color }]} numberOfLines={1}>{state === 'done' ? `${label} ✓` : label}</Text>
              </View>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.hero}>
          <Text style={[s.kicker, { color: content.tint }]}>{done ? 'NEXT' : phase.title.toUpperCase()}</Text>
          <View style={[s.visual, { backgroundColor: content.light, width: visualSize + 24, height: visualSize + 24 }]}>
            <GuideVisual key={done ? 'done' : `${index}-${loop}-${step}`} kind={current?.visual ?? 'outside'}
              tint={content.tint} size={visualSize} />
          </View>
          <Text style={s.caption} accessibilityRole="header" accessibilityLiveRegion="polite">
            {current?.caption ?? 'Get outside safely'}
          </Text>
          <Text style={s.say} numberOfLines={2}>
            {current?.say ?? "When you are out of the building, tap I'M OUTSIDE NOW."}
          </Text>
          {!done && (
            <View style={s.dots}>
              {phase.steps.map((_, i) => (
                <View key={i} style={[s.dot, i === step && { backgroundColor: content.tint, width: 18 }, i < step && { backgroundColor: '#94A3B8' }]} />
              ))}
            </View>
          )}
          {!done && phase.reminder && <Text style={s.reminder}>{phase.reminder}</Text>}
          <View style={s.voice} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name={voiceError || muted ? 'volume-off' : 'waveform'} size={14} color="#1D4ED8" />
            <Text style={s.voiceText}>{voiceText}</Text>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <Pressable style={[s.button, s.outside]} onPress={goOutside} accessibilityRole="button"
            accessibilityLabel="I'm outside now. Show the route to the evacuation area">
            <MaterialCommunityIcons name="door-open" size={22} color="#FFFFFF" />
            <View>
              <Text style={s.buttonText}>I'M OUTSIDE NOW</Text>
              <Text style={s.buttonSub}>SHOW ROUTE TO EVACUATION AREA</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 90, elevation: 90 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.28)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
  },
  band: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  bandIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bandKicker: { color: '#FFFFFF', opacity: 0.85, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  bandTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  mute: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  phases: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  phaseBar: { height: 4, borderRadius: 2 },
  phaseLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginTop: 4 },
  hero: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 10 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
  visual: { borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  caption: { marginTop: 12, fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  say: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 5, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E2E8F0' },
  reminder: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F1F5F9', fontSize: 12, fontWeight: '800', color: '#475569', overflow: 'hidden' },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  voiceText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  button: { minHeight: 58, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  outside: { backgroundColor: '#1D4ED8' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  buttonSub: { color: '#DBEAFE', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 },
});
