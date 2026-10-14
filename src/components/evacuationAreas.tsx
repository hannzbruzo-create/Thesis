import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { EVACUATION_AREAS } from './evacuationData';

type Props = {
  mapSize: number;
  activeAreaId?: string | null;
  /** Show all OTHER polygons faintly when a route is active. Default false. */
  showAllAreas?: boolean;
};
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** SVG-only, simple, lightweight area visualization. Hidden before navigation. */
export default function EvacuationAreas({ mapSize, activeAreaId = null, showAllAreas = false }: Props) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (activeAreaId) {
      pulse.value = withRepeat(withTiming(1, {
        duration: 2800,
        easing: Easing.inOut(Easing.ease),
      }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [activeAreaId]);

  const highlightedProps = useAnimatedProps(() => ({
    fillOpacity: 0.085 + pulse.value * 0.04,
    strokeOpacity: 0.36 + pulse.value * 0.10,
  }));
  const ringProps = useAnimatedProps(() => ({
    r: 1.65 + pulse.value * 0.65,
    strokeOpacity: 0.22 - pulse.value * 0.14,
  }));

  // TomaSafe currently hides evacuation polygons before route calculation.
  if (!activeAreaId) return null;

  const selected = EVACUATION_AREAS.find(a => a.id === activeAreaId);
  const displayed = showAllAreas ? EVACUATION_AREAS : EVACUATION_AREAS.filter(a => a.id === activeAreaId);
  const polygonPoints = (p: { x: number; y: number }[]) => p.map(v => `${v.x},${v.y}`).join(' ');

  return (
    <>
      <Svg
        width={mapSize} height={mapSize} viewBox="0 0 100 100"
        pointerEvents="none" style={StyleSheet.absoluteFill}
      >
        {displayed.filter(a => a.id !== activeAreaId).map(area => (
          <Polygon
            key={area.id}
            points={polygonPoints(area.polygon)}
            fill="#16A34A" fillOpacity={0.055}
            stroke="#15803D" strokeOpacity={0.35}
            strokeWidth={0.18} strokeLinejoin="round"
          />
        ))}
        {selected && (
          <>
            <AnimatedPolygon
              points={polygonPoints(selected.polygon)}
              fill="#16A34A" stroke="#15803D" strokeWidth={0.25}
              strokeLinejoin="round" animatedProps={highlightedProps}
            />
            <AnimatedCircle
              cx={selected.center.x} cy={selected.center.y}
              fill="none" stroke="#16A34A" strokeWidth={0.19}
              animatedProps={ringProps}
            />
          </>
        )}
      </Svg>
      {selected && (
        <View pointerEvents="none" style={[
          styles.markerPosition,
          { left: selected.center.x / 100 * mapSize, top: selected.center.y / 100 * mapSize },
        ]}>
          <View style={styles.activeMarker}><Text style={styles.activeCheck}>✓</Text></View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  markerPosition: { position: 'absolute', transform: [{ translateX: -14 }, { translateY: -14 }], zIndex: 25 },
  activeMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#16A34A', borderWidth: 2,
    borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  activeCheck: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
