import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PHONE_PATTERN, RECIPIENT_TYPE, type Profile } from '../../services/safetyReports';

type Props = {
  initial: Profile | null;
  /** First launch (or an older sign-in without a mobile number): cannot be closed until complete. */
  required: boolean;
  onSave: (profile: Profile) => void;
  onClose: () => void;
};

/**
 * Sign in once: name, mobile number and student ID. Sent with the push registration and safety
 * reports, and makes you a recipient of SMS alerts in the admin panel (recipients are students
 * only). Kept even if the app is uninstalled and installed again.
 */
export default function ProfileSheet({ initial, required, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const phoneValid = PHONE_PATTERN.test(phone.trim());
  const valid = name.trim().length >= 2 && phoneValid;
  const save = () => { if (valid) onSave({ name, idNumber, phone: phone.trim(), recipientType: RECIPIENT_TYPE }); };

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={s.backdrop} />
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <View style={s.badge}>
              <MaterialCommunityIcons name="account-check-outline" size={26} color="#1D4ED8" />
            </View>
            <Text style={s.title} accessibilityRole="header">{required ? 'Sign in' : 'Your details'}</Text>
            <Text style={s.body}>
              Emergency alerts come as push notifications and by SMS to your number. Campus staff see
              your name when you confirm you are safe.
            </Text>

            <Text style={s.label}>Full name *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Juan Dela Cruz"
              placeholderTextColor="#94A3B8" autoCapitalize="words" autoComplete="name" maxLength={80}
              returnKeyType="next" accessibilityLabel="Full name" />

            <Text style={s.label}>Mobile number *</Text>
            <TextInput style={[s.input, phone.length === 11 && !phoneValid && s.inputError]} value={phone}
              onChangeText={text => setPhone(text.replace(/[^0-9]/g, ''))} placeholder="09XXXXXXXXX"
              placeholderTextColor="#94A3B8" keyboardType="phone-pad" autoComplete="tel" maxLength={11}
              returnKeyType="next" accessibilityLabel="Mobile number" />
            <Text style={[s.hint, phone.length > 0 && !phoneValid && s.hintError]}>
              11 digits starting with 09, for SMS alerts.
            </Text>

            <Text style={s.label}>ID number</Text>
            <TextInput style={s.input} value={idNumber} onChangeText={setIdNumber} placeholder="Student ID"
              placeholderTextColor="#94A3B8" autoCapitalize="characters" maxLength={40}
              returnKeyType="done" onSubmitEditing={save} accessibilityLabel="ID number" />

            <Pressable style={[s.primary, !valid && s.disabled]} onPress={save} disabled={!valid} accessibilityRole="button">
              <Text style={s.primaryText}>{required ? 'Continue' : 'Save'}</Text>
            </Pressable>
            {!required && (
              <Pressable style={s.secondary} onPress={onClose} accessibilityRole="button">
                <Text style={s.secondaryText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  // Elevation on a view without a background: a translucent view with elevation shows its own shadow.
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 130, elevation: 130 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.6)' },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 30 },
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
  inputError: { borderColor: '#DC2626' },
  hint: { marginTop: 5, fontSize: 11, fontWeight: '600', color: '#64748B' },
  hintError: { color: '#B42318' },
  primary: { marginTop: 18, height: 50, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  disabled: { backgroundColor: '#94A3B8' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: { marginTop: 8, height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#475569', fontSize: 14, fontWeight: '800' },
});
