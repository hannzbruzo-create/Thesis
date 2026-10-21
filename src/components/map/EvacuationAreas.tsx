import React, { useEffect } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Point } from '../../navigation/walkableGraph';
import styles from '../../styles/map/EvacuationFlag.styles';

type Props = {
  mapSize: number;
  center: Point | null;
};

/**
 * Draw the destination in EXACTLY the same 800x800 map plane as the blue route.
 *
 * The old version calculated an independent SCREEN-SPACE projection for the
 * flag. With 3D perspective enabled, that was not guaranteed to match the
 * React Native map transform, so the flag could sit in the middle of the line.
 *
 * Place the target at the last route point INSIDE the animated map layer.
 * The shared native pan/zoom/tilt transform then moves the route and target
 * together with zero possibility of a separate projection offset.
 */
export default function EvacuationAreas({ mapSize, center }: Props) {
  const pulse = useSharedValue(0);
  const bob = useSharedValue(0);
  const visible = center != null;
  const x = center?.x ?? 0;
  const y = center?.y ?? 0;

  useEffect(() => {
    cancelAnimation(pulse);
    cancelAnimation(bob);
    pulse.value = 0;
    bob.value = 0;
    if (visible) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
        -1,
        false,
      );
      bob.value = withRepeat(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(bob);
    };
  }, [visible, x, y]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.23 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.9 }],
  }));
  const flagFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * bob.value }],
  }));
  const tetherStyle = useAnimatedStyle(() => ({
    top: -38 - 5 * bob.value,
    height: 29 + 5 * bob.value,
  }));

  if (!center) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.anchor,
        { left: (x / 800) * mapSize, top: (y / 800) * mapSize },
      ]}
    >
      <Animated.View style={[styles.aura, auraStyle]} />
      <View style={styles.innerAura} />
      <Animated.View style={[styles.tether, tetherStyle]} />
      <Animated.View style={[styles.flag, flagFloatStyle]}>
        <MaterialCommunityIcons name="flag-variant" size={23} color="#FFFFFF" />
      </Animated.View>
      <View style={styles.targetRing} />
      <View style={styles.targetCore} />
    </View>
  );
}
