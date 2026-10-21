import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Speech from 'expo-speech';
import type { EmergencyType } from '../../emergency/emergencyTypes';
import { EMERGENCY_CONTENT } from '../../emergency/emergencyTypes';
import styles from '../../styles/ui/EmergencyFlow.styles';

type Props = { type: EmergencyType; onFinished: () => void };
const REPEAT_COUNT = 2;

/**
 * Expo Go-safe emergency guide. Notification metadata is simulated elsewhere.
 * The map stays visible behind this half-height panel.
 * Voice reads the complete guidance twice unless the student confirms they
 * have already exited. Confirmation stops speech and opens GPS navigation at once.
 */
export default function EmergencyInstructions({ type, onFinished }: Props) {
  const content = EMERGENCY_CONTENT[type];
  const { height } = useWindowDimensions();
  const [round, setRound] = useState(1);
  const [activeLine, setActiveLine] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const session = useRef(0);
  const finished = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const lines = [
    `${content.title}. ${content.subtitle}`,
    ...content.steps.map(step => `${step.title}. ${step.description}`),
    content.finalInstruction,
  ];

  const stopPlayback = useCallback(() => {
    session.current += 1;
    return Speech.stop().catch(() => {});
  }, []);

  const proceedWhenOutside = useCallback(() => {
    // The student may already be safely outside. Never gate navigation on TTS.
    if (finished.current) return;
    finished.current = true;
    // Cancel both current speech and any pending onDone callbacks before navigation.
    void stopPlayback();
    onFinishedRef.current();
  }, [stopPlayback]);

  const playTwice = useCallback(() => {
    const stop = stopPlayback();
    const current = session.current;
    finished.current = false;
    setRound(1);
    setActiveLine(-1);
    // Once two complete cycles have played, keep Proceed enabled even on replay.
    setIsSpeaking(true);
    setVoiceError(false);

    const speakNext = (iteration: number, index: number) => {
      if (session.current !== current || finished.current) return;
      setRound(iteration);
      setActiveLine(index);

      try {
        Speech.speak(lines[index], {
          language: 'en-US',
          rate: 0.88,
          pitch: 1,
          onDone: () => {
            if (session.current !== current || finished.current) return;
            if (index + 1 < lines.length) {
              speakNext(iteration, index + 1);
            } else if (iteration < REPEAT_COUNT) {
              speakNext(iteration + 1, 0);
            } else {
              setCompleted(true);
              setIsSpeaking(false);
              setActiveLine(-1);
              // Deliberately stay on the instructions until user confirms outside.
            }
          },
          onError: () => {
            if (session.current !== current || finished.current) return;
            void stopPlayback();
            setVoiceError(true);
            setIsSpeaking(false);
            setActiveLine(-1);
          },
        });
      } catch (_error) {
        if (session.current !== current) return;
        void stopPlayback();
        setVoiceError(true);
        setIsSpeaking(false);
        setActiveLine(-1);
      }
    };

    void stop.then(() => {
      if (session.current === current) speakNext(1, 0);
    });
    // Component is remounted for each emergency; content/lines are stable per type.
  }, [type, stopPlayback]);

  useEffect(() => {
    playTwice();
    return () => { void stopPlayback(); };
  }, [playTwice, stopPlayback]);

  const spokenStatus = voiceError
    ? 'Voice unavailable · Read instructions'
    : isSpeaking
      ? `Voice guide · ${round} of ${REPEAT_COUNT}`
      : completed
        ? 'Instructions complete · 2 of 2'
        : 'Starting voice guide';

  return (
    <View style={styles.overlayRoot}>
      {/* Dims the map without hiding it, and blocks accidental taps during guidance. */}
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { height: Math.min(510, Math.round(height * 0.57)) }]}>
        <View style={styles.dragHandle} />
        <View style={styles.header}>
          <View style={[styles.emergencyIcon, { backgroundColor: content.light }]}>
            <MaterialCommunityIcons name={content.icon} size={25} color={content.tint} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TOMASAFE · EMERGENCY GUIDE</Text>
            <Text style={styles.headerTitle}>{content.title}</Text>
            <Text numberOfLines={2} style={styles.headerSubtitle}>{content.heading}</Text>
          </View>
          <View style={[styles.alertDot, { backgroundColor: content.tint }]} />
        </View>

        <View style={styles.guideStatus}>
          <View style={styles.statusLeft}>
            <MaterialCommunityIcons
              name={voiceError ? 'volume-off' : isSpeaking ? 'volume-high' : 'check-circle-outline'}
              size={17}
              color={voiceError ? '#B45309' : '#1D4ED8'}
            />
            <Text accessibilityLiveRegion="polite" numberOfLines={1} style={styles.statusLabel}>
              {spokenStatus}
            </Text>
          </View>
          <View style={styles.progressRow}>
            {[1, 2].map(n => (
              <View
                key={n}
                style={[
                  styles.progressSegment,
                  ((!isSpeaking && completed) || (round > n)) && styles.progressDone,
                  isSpeaking && round === n && styles.progressActive,
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <Text style={styles.sectionTitle}>Safety instructions</Text>
          {content.steps.map((step, index) => {
            const speaking = !voiceError && isSpeaking && activeLine === index + 1;
            return (
              <View
                key={step.title}
                style={[
                  styles.stepCard,
                  speaking && { borderColor: content.tint, backgroundColor: content.light },
                ]}
              >
                <View style={[styles.stepIcon, { backgroundColor: content.light }]}>
                  <MaterialCommunityIcons name={step.icon} size={21} color={content.tint} />
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepText}>{step.description}</Text>
                </View>
                <Text style={[styles.stepNumber, speaking && { color: content.tint }]}>
                  {speaking ? '●' : String(index + 1).padStart(2, '0')}
                </Text>
              </View>
            );
          })}
          <View style={styles.notice}>
            <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#9A3412" />
            <Text style={styles.noticeText}>{content.finalInstruction}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!isSpeaking && (completed || voiceError) && (
            <View style={styles.footerTop}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Replay voice instructions twice"
                onPress={playTwice}
                style={styles.replayButton}
              >
                <MaterialCommunityIcons name="replay" size={15} color="#1D4ED8" />
                <Text style={styles.replayText}>Replay</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I have exited the building, proceed to campus map"
            accessibilityHint="If you are outside the building, stop the voice guide and begin live GPS navigation now"
            onPress={proceedWhenOutside}
            style={styles.primaryButton}
          >
            <MaterialCommunityIcons name="door-open" size={24} color="#FFFFFF" />
            <View style={styles.buttonCopy}>
              <Text style={styles.primaryButtonText}>I'VE EXITED THE BUILDING</Text>
              <Text style={styles.primaryButtonSubtext}>PROCEED TO MAP</Text>
            </View>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
