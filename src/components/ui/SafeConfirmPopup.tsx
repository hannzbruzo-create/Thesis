import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { EvacuationArea } from '../../data/evacuationAreas';
import type { Profile } from '../../services/safetyReports';

type Props = {
  /** The evacuation area the user walked into; null when they pressed "I'm safe" elsewhere. */
  area: EvacuationArea | null;
  /** No name saved yet: ask for it here, so staff know who is safe. */
  needsProfile: boolean;
  onSafe: (profile?: Profile) => void;
  onNotNow: () => void;
};

/**
 * "Are you safe?" Shown when the user enters an evacuation area (and by the I'm safe button).
 * Confirming reports to campus staff and ends navigation; "Not now" asks again later.
 */
export default function SafeConfirmPopup({ area, needsProfile, onSafe, onNotNow }: Props) {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const ready = !needsProfile || name.trim().length >= 2;
  const confirm = () => {
    if (!ready) return;
    onSafe(needsProfile ? { name, idNumber } : undefined);
  };

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={s.backdrop} />
      <View style={s.card}>
        <View style={s.badge}>
          <MaterialCommunityIcons name="shield-check" size={30} color="#15803D" />
        </View>
        {area ? (
          <>
            <Text style={s.eyebrow}>YOU REACHED {area.name.toUpperCase()}</Text>
            <Text style={s.place}>{area.place}</Text>
          </>
        ) : (
          <Text style={s.eyebrow}>SAFETY CHECK</Text>
        )}
        <Text style={s.title} accessibilityRole="header">Are you safe?</Text>
        <Text style={s.body}>
          Your confirmation is sent to campus staff, and route guidance will stop.
        </Text>

        {needsProfile && (
          <>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your full name *"
              placeholderTextColor="#94A3B8" autoCapitalize="words" autoComplete="name" maxLength={80}
              accessibilityLabel="Full name" />
            <TextInput style={s.input} value={idNumber} onChangeText={setIdNumber} placeholder="ID number"
              placeholderTextColor="#94A3B8" autoCapitalize="characters" maxLength={40}
              accessibilityLabel="ID number" />
          </>
        )}

        <Pressable style={[s.primary, !ready && s.disabled]} onPress={confirm} disabled={!ready} accessibilityRole="button">
          <MaterialCommunityIcons name="check-bold" size={19} color="#FFFFFF" />
          <Text style={s.primaryText}>I'm safe</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={onNotNow} accessibilityRole="button"
          accessibilityHint="Closes this question; it is asked again later">
          <Text style={s.secondaryText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Elevation on a view without a background: a translucent view with elevation shows its own shadow.
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 70, elevation: 70,
    justifyContent: 'center', paddingHorizontal: 22,
  },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.5)' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, alignItems: 'center',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 18, elevation: 12,
  },
  badge: { width: 58, height: 58, borderRadius: 17, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { marginTop: 12, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#15803D', textAlign: 'center' },
  place: { marginTop: 2, fontSize: 13, fontWeight: '700', color: '#475569', textAlign: 'center' },
  title: { marginTop: 6, fontSize: 24, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  body: { marginTop: 6, fontSize: 13, lineHeight: 19, fontWeight: '600', color: '#475569', textAlign: 'center' },
  input: {
    alignSelf: 'stretch', marginTop: 10, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#CBD5E1',
    paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  primary: {
    alignSelf: 'stretch', marginTop: 16, height: 54, borderRadius: 14, backgroundColor: '#15803D',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  disabled: { backgroundColor: '#94A3B8' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secondary: {
    alignSelf: 'stretch', marginTop: 10, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
});
