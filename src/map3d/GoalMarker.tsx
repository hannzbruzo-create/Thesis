import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cameraBasis, worldToScreen } from './cameraMath';
import type { CameraValues } from './useMapCamera';
import type { Point } from '../navigation/walkableGraph';

/**
 * Destination pin at the middle of the chosen evacuation area: the green "assembly point"
 * style (people under a pin), like the green safe-condition signs used on campus. Drawn as a
 * native overlay so it stays crisp and upright while the map rotates and tilts.
 */
export default function GoalMarker({ point, name, camera }: { point: Point; name: string; camera: CameraValues }) {
  const style = useAnimatedStyle(() => {
    const w = camera.width.value, h = camera.height.value;
    const b = cameraBasis(camera.rendered.value, w, h);
    const p = worldToScreen(b, point.x, point.y, 0);
    const onScreen = p.visible && p.x > -60 && p.x < w + 60 && p.y > -10 && p.y < h + 90;
    return { opacity: onScreen ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, style]}>
      {/* The pin's tip sits exactly on the goal point. */}
      <View style={styles.pin}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="account-group" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.tip} />
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
      </View>
    </Animated.View>
  );
}

const GREEN = '#15803D';
const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  pin: { position: 'absolute', left: -60, width: 120, top: -44, alignItems: 'center' },
  badge: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 4,
  },
  tip: {
    width: 0, height: 0, marginTop: -1,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: GREEN,
  },
  name: {
    marginTop: 6, fontSize: 10, fontWeight: '800', color: '#14532D', textAlign: 'center',
    textShadowColor: '#FFFFFF', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 }, includeFontPadding: false,
  },
});
