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

/** Size of the round location button and of each control button, px. */
const LOCATE_SIZE = 48;
const BUTTON_SIZE = 46;

/**
 * Map controls in one column on the right, low down where the thumb reaches: view and labels,
 * then zoom, then the round location button just above the bottom card. The location button
 * recentres on you; with live GPS it also starts/stops following your heading. Long-press it to
 * fit the whole campus.
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
      <View style={[s.column, { bottom: bottom + LOCATE_SIZE + 12 }]} pointerEvents="box-none">
        <View style={s.group}>
          <Pressable style={s.button} onPress={onToggleMode} accessibilityRole="button"
            accessibilityLabel={mode3D ? 'Switch to 2D top-down view' : 'Switch to 3D view'}>
            <Text style={s.modeText}>{mode3D ? '2D' : '3D'}</Text>
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.button} onPress={onToggleLabels} accessibilityRole="button"
            accessibilityLabel={showLabels ? 'Hide building names' : 'Show building names'}>
            <MaterialCommunityIcons name={showLabels ? 'label-outline' : 'label-off-outline'} size={20}
              color={showLabels ? '#2563EB' : '#94A3B8'} />
          </Pressable>
        </View>
        <View style={s.group}>
          <Pressable style={s.button} onPress={onZoomIn} accessibilityRole="button" accessibilityLabel="Zoom in">
            <MaterialCommunityIcons name="plus" size={22} color="#334155" />
          </Pressable>
          <View style={s.divider} />
          <Pressable style={s.button} onPress={onZoomOut} accessibilityRole="button" accessibilityLabel="Zoom out">
            <MaterialCommunityIcons name="minus" size={22} color="#334155" />
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
  column: { position: 'absolute', right: 12, gap: 10, zIndex: 25 },
  group: { width: BUTTON_SIZE, borderRadius: 14, backgroundColor: '#FFFFFF', overflow: 'hidden', ...shadow },
  button: { width: BUTTON_SIZE, height: BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#E2E8F0' },
  modeText: { color: '#2563EB', fontSize: 14, fontWeight: '800' },
  locate: {
    position: 'absolute', right: 11, width: LOCATE_SIZE, height: LOCATE_SIZE, borderRadius: LOCATE_SIZE / 2, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center', zIndex: 25, ...shadow,
  },
  locateOn: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#2563EB' },
});
