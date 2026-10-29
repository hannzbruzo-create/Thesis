import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const floorName = (f: number) => (f === 0 ? 'GF' : `${f + 1}F`);

/**
 * Small card under the header for the building you tapped: its name, how many rooms are named on
 * the chosen floor, and floor chips (GF, 2F, 3F...) that switch which floor's room names show.
 */
export default function BuildingCard({ name, floors, floor, roomCount, onFloor, onClose }: {
  name: string; floors: number; floor: number; roomCount: number; onFloor: (f: number) => void; onClose: () => void;
}) {
  return (
    <View style={s.card} pointerEvents="box-none">
      <View style={s.row}>
        <View style={s.icon}><MaterialCommunityIcons name="office-building-outline" size={18} color="#FFFFFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{roomCount ? `${roomCount} ROOMS ON ${floorName(floor)}` : `NO ROOM NAMES FOR ${floorName(floor)} YET`}</Text>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
        </View>
        <Pressable onPress={onClose} style={s.close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close building">
          <MaterialCommunityIcons name="close" size={16} color="#475569" />
        </Pressable>
      </View>
      {floors > 1 && (
        <View style={s.floors} accessibilityRole="tablist">
          {Array.from({ length: floors }, (_, f) => (
            <Pressable key={f} onPress={() => onFloor(f)} accessibilityRole="tab" accessibilityState={{ selected: f === floor }}
              style={[s.chip, f === floor && s.chipOn]}>
              <Text style={[s.chipText, f === floor && s.chipTextOn]}>{floorName(f)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute', left: 12, right: 64, top: 70, zIndex: 26, backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, elevation: 5,
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  icon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#C96A4A', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5, color: '#64748B' },
  name: { fontSize: 14, fontWeight: '900', color: '#0F172A', marginTop: 1 },
  close: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  floors: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipOn: { backgroundColor: '#2563EB' },
  chipText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  chipTextOn: { color: '#FFFFFF' },
});
