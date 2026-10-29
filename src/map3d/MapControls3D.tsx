import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = {
  mode3D: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleMode: () => void;
  onRecenter: () => void;
  onFit: () => void;
  hasLiveLocation: boolean;
  following: boolean;
  onToggleFollow: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  /** Distance of the location button from the bottom (above the bottom card). */
  bottom?: number;
};

/**
 * Map controls in two small groups under the header (zoom; view and labels) plus one round
 * location button above the bottom card. The location button recentres on you; with live GPS
 * it also starts/stops following your heading. Long-press it to fit the whole campus.
 */
export default function MapControls3D({ mode3D, onZoomIn, onZoomOut, onToggleMode, onRecenter, onFit,
  hasLiveLocation, following, onToggleFollow, showLabels, onToggleLabels, bottom = 230 }: Props) {
  const onLocate = () => {
    if (!hasLiveLocation) { onRecenter(); return; }
    if (!following) onRecenter();
    onToggleFollow();
  };
  return (
    <>
      <View style={s.column} pointerEvents="box-none">
        <View style={s.group}>
          <Pressable style={s.button} onPress={onZoomIn} accessibilityRole="button" accessibilityLabel="Zoom in">
            <MaterialCommunityIcons name="plus" size={20} color="#334155" />
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.button} onPress={onZoomOut} accessibilityRole="button" accessibilityLabel="Zoom out">
            <MaterialCommunityIcons name="minus" size={20} color="#334155" />
          </Pressable>
        </View>
        <View style={s.group}>
          <Pressable style={s.button} onPress={onToggleMode} accessibilityRole="button"
            accessibilityLabel={mode3D ? 'Switch to 2D top-down view' : 'Switch to 3D view'}>
            <Text style={s.modeText}>{mode3D ? '2D' : '3D'}</Text>
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.button} onPress={onToggleLabels} accessibilityRole="button"
            accessibilityLabel={showLabels ? 'Hide building names' : 'Show building names'}>
            <MaterialCommunityIcons name={showLabels ? 'label-outline' : 'label-off-outline'} size={19}
              color={showLabels ? '#2563EB' : '#94A3B8'} />
          </Pressable>
        </View>
      </View>
      <Pressable
        style={[s.locate, { bottom }, following && s.locateOn]}
        onPress={onLocate}
        onLongPress={onFit}
        accessibilityRole="button"
        accessibilityLabel={hasLiveLocation ? (following ? 'Stop following my heading' : 'Center on me and follow my heading') : 'Reset view'}
        accessibilityHint="Long-press to fit the whole campus"
      >
        <MaterialCommunityIcons name={following ? 'navigation' : 'crosshairs-gps'} size={21}
          color={following ? '#2563EB' : '#FFFFFF'} />
      </Pressable>
    </>
  );
}

const shadow = { elevation: 5, shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } };
const s = StyleSheet.create({
  column: { position: 'absolute', right: 12, top: 76, gap: 8, zIndex: 25 },
  group: { width: 42, borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden', ...shadow },
  button: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#E2E8F0' },
  modeText: { color: '#2563EB', fontSize: 13, fontWeight: '800' },
  locate: {
    position: 'absolute', right: 12, width: 46, height: 46, borderRadius: 23, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', zIndex: 25, ...shadow,
  },
  locateOn: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#2563EB' },
});
