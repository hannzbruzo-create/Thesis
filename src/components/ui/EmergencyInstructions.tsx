import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import type { EmergencyType } from '../../emergency/emergencyTypes';
import { EMERGENCY_CONTENT, GUIDE_PHASES, MAP_STEP_LABEL } from '../../emergency/emergencyTypes';

type Props = {
  type: EmergencyType;
  /** The user is outside: stop the voice and open navigation. */
  onFinished: () => void;
  /** Sheet height in px (the map frames the campus in the space above it). */
  height: number;
  muted: boolean;
  onToggleMute: () => void;
};

/**
 * Step-by-step emergency voice guide. One phase is shown at a time in large type, and the voice
 * repeats only that phase (one sentence at a time, highlighted on screen) until the user moves
 * on. "I'm outside now" only appears on the last phase, so nobody is told to run out during
 * shaking; people already outside can skip straight to the map with the small link.
 */
export default function EmergencyInstructions({ type, onFinished, height, muted, onToggleMute }: Props) {
  const content = EMERGENCY_CONTENT[type];
  const phases = GUIDE_PHASES[type];
  const [index, setIndex] = useState(0);
  const [spoken, setSpoken] = useState(-1);
  const [voiceError, setVoiceError] = useState(false);
  const session = useRef(0);
  const finished = useRef(false);
  const phase = phases[index];
  const last = index === phases.length - 1;
  const steps = phases.length + 1; // the map is the final step

  // Speak the current phase sentence by sentence, then pause and repeat, until it changes.
  useEffect(() => {
    const id = ++session.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSpoken(-1);
    void Speech.stop().catch(() => {});
    if (muted) return () => { session.current++; };
    const speak = (i: number) => {
      if (session.current !== id || finished.current) return;
      if (i >= phase.speech.length) {
        setSpoken(-1);
        timer = setTimeout(() => speak(0), phase.repeatAfter * 1000);
        return;
      }
      setSpoken(i);
      try {
        Speech.speak(phase.speech[i], {
          language: 'en-US',
          rate: 0.9,
          onDone: () => speak(i + 1),
          onError: () => { if (session.current === id) { setVoiceError(true); setSpoken(-1); } },
        });
      } catch {
        setVoiceError(true);
        setSpoken(-1);
      }
    };
    timer = setTimeout(() => speak(0), 300);
    return () => {
      session.current++;
      if (timer) clearTimeout(timer);
      void Speech.stop().catch(() => {});
    };
  }, [phase, muted]);

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
    ? 'Voice unavailable · read the steps'
    : muted
      ? 'Voice off · tap the speaker to turn it on'
      : spoken >= 0
        ? `Speaking · repeats every ${phase.repeatAfter} s`
        : `Repeats in a moment`;

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
            <Text style={s.bandTitle}>Step {index + 1} of {steps}</Text>
          </View>
          <Pressable style={s.mute} onPress={onToggleMute} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={muted ? 'Turn voice on' : 'Turn voice off'}>
            <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={17} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={s.phases}>
          {[...phases.map(p => p.label), MAP_STEP_LABEL].map((label, i) => {
            const state = i < index ? 'done' : i === index ? 'now' : 'todo';
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
          <View style={[s.pict, { backgroundColor: content.light }]}>
            <MaterialCommunityIcons name={phase.icon as any} size={46} color={content.tint} />
          </View>
          <Text style={s.title} accessibilityRole="header">{phase.title}</Text>
          {phase.checklist ? (
            <View style={s.list}>
              {phase.checklist.map((item, i) => (
                <View key={item.bold} style={[s.listRow, i > 0 && s.listRule]}>
                  <MaterialCommunityIcons name={item.icon as any} size={18} color={content.tint} />
                  <Text style={s.listText}><Text style={s.listBold}>{item.bold}</Text> {item.text}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.say}>
              {phase.speech.slice(1).map((line, i) => (
                <Text key={line} style={spoken === i + 1 ? s.mark : undefined}>{line}{' '}</Text>
              ))}
            </Text>
          )}
          {phase.checklist && spoken >= 0 && (
            <Text style={s.caption} numberOfLines={2}>“{phase.speech[spoken]}”</Text>
          )}
          {phase.reminder && <Text style={s.reminder}>{phase.reminder}</Text>}
          <View style={s.voice} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name={voiceError || muted ? 'volume-off' : 'waveform'} size={14} color="#1D4ED8" />
            <Text style={s.voiceText}>{voiceText}</Text>
          </View>
        </ScrollView>

        <View style={s.footer}>
          {phase.next ? (
            <>
              <Pressable style={[s.button, { backgroundColor: content.tint }]} onPress={() => setIndex(i => i + 1)} accessibilityRole="button">
                <Text style={s.buttonText}>{phase.next}</Text>
              </Pressable>
              <Pressable onPress={goOutside} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>Already outside? Open the map</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={[s.button, s.outside]} onPress={goOutside} accessibilityRole="button"
              accessibilityLabel="I'm outside now. Show the route to the evacuation area">
              <MaterialCommunityIcons name="door-open" size={22} color="#FFFFFF" />
              <View>
                <Text style={s.buttonText}>I'M OUTSIDE NOW</Text>
                <Text style={s.buttonSub}>SHOW ROUTE TO EVACUATION AREA</Text>
              </View>
            </Pressable>
          )}
          {last && index > 0 && (
            <Pressable onPress={() => setIndex(i => i - 1)} hitSlop={8} accessibilityRole="button">
              <Text style={[s.link, { color: '#64748B' }]}>Back</Text>
            </Pressable>
          )}
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
  hero: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  pict: { width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 26, lineHeight: 30, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  say: { marginTop: 10, fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#475569', textAlign: 'center' },
  mark: { backgroundColor: '#FDE68A', color: '#0F172A' },
  list: { alignSelf: 'stretch', marginTop: 12 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  listRule: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  listText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#334155' },
  listBold: { fontWeight: '900', color: '#0F172A' },
  caption: { marginTop: 8, fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#0F172A', backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, textAlign: 'center', overflow: 'hidden' },
  reminder: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F1F5F9', fontSize: 12, fontWeight: '800', color: '#475569', overflow: 'hidden' },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  voiceText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 10 },
  button: { minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 },
  outside: { backgroundColor: '#1D4ED8' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  buttonSub: { color: '#DBEAFE', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 1 },
  link: { textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#1D4ED8' },
});
