import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = {
  /** Ask for a fresh GPS fix and try the route again. */
  onRetry: () => void;
  /** The user is not on campus: leave navigation and go back to the alert chooser. */
  onOutsideCampus: () => void;
};

/**
 * Shown when no evacuation route can be found from the current position (usually because the
 * phone is outside the campus map). The user either retries or confirms they are off campus.
 */
export default function NoRouteWarning({ onRetry, onOutsideCampus }: Props) {
  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={s.backdrop} />
      <View style={s.card}>
        <View style={s.badge}>
          <MaterialCommunityIcons name="map-marker-off" size={28} color="#B45309" />
        </View>
        <Text style={s.eyebrow}>NO ROUTE FOUND</Text>
        <Text style={s.title} accessibilityRole="header">Are you outside the campus?</Text>
        <Text style={s.body}>
          No evacuation route could be found from where you are. You may be outside UST–Legazpi
          campus, or your GPS needs another try.
        </Text>
        <Pressable style={s.primary} onPress={onRetry} accessibilityRole="button">
          <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
          <Text style={s.primaryText}>Retry</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={onOutsideCampus} accessibilityRole="button"
          accessibilityHint="Stops navigation and returns to the alert screen">
          <Text style={s.secondaryText}>I'm outside the campus</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // The elevation (needed on Android to sit above the bottom card) is on a view with no
  // background: a translucent view with elevation shows its own shadow through itself.
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 60, elevation: 60,
    justifyContent: 'center', paddingHorizontal: 22,
  },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.5)' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, alignItems: 'center',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 18, elevation: 12,
  },
  badge: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { marginTop: 12, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#B45309' },
  title: { marginTop: 3, fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  body: { marginTop: 8, fontSize: 13, lineHeight: 19, fontWeight: '600', color: '#475569', textAlign: 'center' },
  primary: {
    alignSelf: 'stretch', marginTop: 16, height: 50, borderRadius: 14, backgroundColor: '#2563EB',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: {
    alignSelf: 'stretch', marginTop: 10, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
});
