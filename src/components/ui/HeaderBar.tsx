import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useModelStore } from '../../map3d/ModelStore';
import type { EmergencyType } from '../../emergency/emergencyTypes';

const CHIP: Record<EmergencyType, { label: string; bg: string; fg: string }> = {
  earthquake: { label: 'EARTHQUAKE', bg: '#FEF3C7', fg: '#92400E' },
  fire: { label: 'FIRE', bg: '#FEE2E2', fg: '#B91C1C' },
};

/**
 * Compact header: brand on the left, the active emergency as a coloured chip on the right.
 * In development builds, long-press the brand to open the map editor.
 */
export default function HeaderBar({ emergency }: { emergency?: EmergencyType | null }) {
  const { editorOpen, setEditorOpen } = useModelStore();
  const chip = emergency ? CHIP[emergency] : null;
  return (
    <View style={s.wrapper} pointerEvents="box-none">
      <View style={s.card}>
        <Pressable style={s.brand} onLongPress={__DEV__ ? () => setEditorOpen(!editorOpen) : undefined} delayLongPress={600}>
          <View style={s.logo}>
            <MaterialCommunityIcons name="shield-check-outline" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={s.title}>Toma<Text style={s.accent}>Safe</Text></Text>
            <Text style={s.sub}>UST–LEGAZPI · RAWIS</Text>
          </View>
        </Pressable>
        {editorOpen ? (
          <View style={[s.chip, { backgroundColor: '#EFF6FF' }]}>
            <MaterialCommunityIcons name="pencil-ruler" size={12} color="#2563EB" />
            <Text style={[s.chipText, { color: '#2563EB' }]}>EDITING MAP</Text>
          </View>
        ) : chip && (
          <View style={[s.chip, { backgroundColor: chip.bg }]} accessibilityLabel={`Active emergency: ${chip.label}`}>
            <View style={[s.dot, { backgroundColor: chip.fg }]} />
            <Text style={[s.chipText, { color: chip.fg }]}>{chip.label}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
  card: {
    marginHorizontal: 12, marginTop: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.97)', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', elevation: 5,
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '900', color: '#0F172A', lineHeight: 17 },
  accent: { color: '#2563EB' },
  sub: { fontSize: 8, fontWeight: '700', color: '#64748B', letterSpacing: 0.6, marginTop: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
});
