import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Profile } from '../../services/safetyReports';

type Props = {
  initial: Profile | null;
  /** First launch: the name is required and the sheet cannot be closed without it. */
  required: boolean;
  onSave: (profile: Profile) => void;
  onClose: () => void;
};

/**
 * Asks once for the phone owner's name and ID number. They are sent with the push registration
 * and with safety reports, so campus staff can see who is safe during an alert.
 */
export default function ProfileSheet({ initial, required, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? '');
  const valid = name.trim().length >= 2;
  const save = () => { if (valid) onSave({ name, idNumber }); };

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={s.backdrop} />
      <View style={s.card}>
        <View style={s.badge}>
          <MaterialCommunityIcons name="account-check-outline" size={26} color="#1D4ED8" />
        </View>
        <Text style={s.title} accessibilityRole="header">Your details</Text>
        <Text style={s.body}>
          During an alert, campus staff see your name when you confirm you are safe.
        </Text>

        <Text style={s.label}>Full name *</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Juan Dela Cruz"
          placeholderTextColor="#94A3B8" autoCapitalize="words" autoComplete="name" maxLength={80}
          returnKeyType="next" accessibilityLabel="Full name" />

        <Text style={s.label}>ID number</Text>
        <TextInput style={s.input} value={idNumber} onChangeText={setIdNumber} placeholder="Student or employee ID"
          placeholderTextColor="#94A3B8" autoCapitalize="characters" maxLength={40}
          returnKeyType="done" onSubmitEditing={save} accessibilityLabel="ID number" />

        <Pressable style={[s.primary, !valid && s.disabled]} onPress={save} disabled={!valid} accessibilityRole="button">
          <Text style={s.primaryText}>Save</Text>
        </Pressable>
        {!required && (
          <Pressable style={s.secondary} onPress={onClose} accessibilityRole="button">
            <Text style={s.secondaryText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Elevation on a view without a background: a translucent view with elevation shows its own shadow.
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 130, elevation: 130,
    justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 90,
  },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.6)' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 18, elevation: 12,
  },
  badge: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { marginTop: 10, fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  body: { marginTop: 6, marginBottom: 6, fontSize: 13, lineHeight: 19, fontWeight: '600', color: '#475569', textAlign: 'center' },
  label: { marginTop: 12, marginBottom: 6, fontSize: 12, fontWeight: '800', color: '#334155' },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#CBD5E1', paddingHorizontal: 14,
    fontSize: 15, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  primary: { marginTop: 18, height: 50, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: '#94A3B8' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: { marginTop: 8, height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#475569', fontSize: 14, fontWeight: '800' },
});
