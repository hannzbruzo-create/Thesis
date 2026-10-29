import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { DirectionKind, Instruction } from '../../navigation/voiceDirections';

const ICON: Record<DirectionKind, string> = {
  straight: 'arrow-up', 'slight-left': 'arrow-top-left', 'slight-right': 'arrow-top-right', left: 'arrow-left', right: 'arrow-right',
};

/**
 * Slim one-line direction under the header ("In 30 m, turn left"), with the voice on/off
 * button. Small type and a narrow strip, so the map stays visible.
 */
export default function DirectionPill({ instruction, muted, onToggleMute }: {
  instruction: Instruction; muted: boolean; onToggleMute: () => void;
}) {
  return (
    <View style={s.pill} accessibilityLiveRegion="polite">
      <View style={s.icon}>
        <MaterialCommunityIcons name={ICON[instruction.kind] as any} size={15} color="#FFFFFF" />
      </View>
      <Text style={s.text} numberOfLines={1}>{instruction.text}</Text>
      <Pressable onPress={onToggleMute} hitSlop={10} style={s.mute} accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn voice directions on' : 'Turn voice directions off'}>
        <MaterialCommunityIcons name={muted ? 'volume-off' : 'volume-high'} size={15} color={muted ? '#94A3B8' : '#1D4ED8'} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    position: 'absolute', top: 62, left: 12, right: 64, zIndex: 26, height: 34, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingRight: 4,
    backgroundColor: 'rgba(255,255,255,0.95)', elevation: 4,
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  icon: { width: 24, height: 24, borderRadius: 8, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: 12, fontWeight: '800', color: '#0F172A' },
  mute: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
});
