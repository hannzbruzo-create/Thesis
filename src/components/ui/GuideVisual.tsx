import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { GuideVisualKind } from '../../emergency/emergencyTypes';
import {
  CHAINS, FIGURE, GUIDE_SCENES, jointPath, sampleFigure, sampleView,
  type Color, type NormLayer, type Shape,
} from './guideScenes';

type Props = { kind: GuideVisualKind; tint: string; size: number };

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const COLORS: Record<Exclude<Color, 'tint'>, string> = {
  ink: '#1E293B', limb: '#7C8BA1', muted: '#CBD5E1', no: '#DC2626', ok: '#16A34A', light: '#E2E8F0',
  dark: '#0F172A', glass: '#E0F2FE', smoke: '#94A3B8', white: '#FFFFFF', grass: '#86EFAC', sun: '#FCD34D',
  wood: '#A16207', leaf: '#4ADE80', fire: '#EA580C', flame: '#F59E0B', skin: '#F8FAFC',
};

/**
 * Small looping animation for one guide step ("Drop", "Stay low under smoke", ...), like a GIF
 * drawn in code. The scenes themselves (poses, timing, props) are data in guideScenes.ts; this
 * plays them on the UI thread: each layer is an SVG in an Animated.View, and figures bend their
 * joints by tweening between poses.
 */
export default function GuideVisual({ kind, tint, size }: Props) {
  const scene = GUIDE_SCENES[kind];
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: scene.ms, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(p);
  }, [scene]);
  const color = (c?: Color) => (c == null ? 'none' : c === 'tint' ? tint : COLORS[c]);
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {scene.layers.map((layer, i) => <LayerView key={i} layer={layer} p={p} size={size} color={color} />)}
    </View>
  );
}

function LayerView({ layer, p, size, color }: {
  layer: NormLayer; p: SharedValue<number>; size: number; color: (c?: Color) => string;
}) {
  const u = size / 100;
  const { keys, shake, origin } = layer;
  const moves = Boolean(keys || shake);
  const style = useAnimatedStyle(() => {
    if (!moves) return {};
    const [x, y, s, sx, r, o] = sampleView(keys, shake, p.value);
    return {
      opacity: o,
      transform: [{ translateX: x * u }, { translateY: y * u }, { rotate: `${r}deg` }, { scaleX: s * sx }, { scaleY: s }],
    };
  });
  return (
    <Animated.View pointerEvents="none"
      style={[StyleSheet.absoluteFill, origin && { transformOrigin: `${origin[0]}% ${origin[1]}% 0` }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {layer.shapes.map((shape, i) => <ShapeView key={i} shape={shape} color={color} />)}
        {layer.figure && <Figure keys={layer.figure} p={p} />}
      </Svg>
    </Animated.View>
  );
}

function ShapeView({ shape: s, color }: { shape: Shape; color: (c?: Color) => string }) {
  if (s.k === 'text') return <SvgText x={s.x} y={s.y} fontSize={s.size} fontWeight="900" fill={color(s.fill)}>{s.text}</SvgText>;
  const paint = { fill: color(s.fill), stroke: color(s.stroke), strokeWidth: s.sw };
  switch (s.k) {
    case 'rect': return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...paint} />;
    case 'circle': return <Circle cx={s.cx} cy={s.cy} r={s.r} {...paint} />;
    case 'path': return <Path d={s.d} {...paint} strokeLinecap="round" strokeLinejoin="round" />;
  }
}

function limbProps(j: number[], chain: number[], width: number) {
  'worklet';
  return { d: jointPath(j, chain), strokeWidth: width * j[22], opacity: j[23] };
}

/** A jointed figure: far limbs lighter, then torso, near limbs and head. */
function Figure({ keys, p }: { keys: NonNullable<NormLayer['figure']>; p: SharedValue<number> }) {
  const j = useDerivedValue(() => sampleFigure(keys, p.value));
  const backArm = useAnimatedProps(() => limbProps(j.value, CHAINS.backArm, FIGURE.limb));
  const backLeg = useAnimatedProps(() => limbProps(j.value, CHAINS.backLeg, FIGURE.limb));
  const torso = useAnimatedProps(() => limbProps(j.value, CHAINS.torso, FIGURE.torso));
  const frontLeg = useAnimatedProps(() => limbProps(j.value, CHAINS.frontLeg, FIGURE.limb));
  const frontArm = useAnimatedProps(() => limbProps(j.value, CHAINS.frontArm, FIGURE.limb));
  const head = useAnimatedProps(() => ({ cx: j.value[0], cy: j.value[1], r: FIGURE.head * j.value[22], opacity: j.value[23] }));
  const line = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <G>
      <AnimatedPath animatedProps={backArm} stroke={COLORS.limb} {...line} />
      <AnimatedPath animatedProps={backLeg} stroke={COLORS.limb} {...line} />
      <AnimatedPath animatedProps={torso} stroke={COLORS.ink} {...line} />
      <AnimatedPath animatedProps={frontLeg} stroke={COLORS.ink} {...line} />
      <AnimatedPath animatedProps={frontArm} stroke={COLORS.ink} {...line} />
      <AnimatedCircle animatedProps={head} fill={COLORS.ink} />
    </G>
  );
}
