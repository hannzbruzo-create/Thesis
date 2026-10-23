import React, { useEffect, useMemo } from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { ROAD_EDGES, ROAD_NODES, ROAD_NODES_BY_ID } from '../../navigation/roadGraph';
import {
  WALKABLE_NODES, WALKABLE_EDGES, WALKABLE_NODES_BY_ID, type GraphNode, type Point,
} from '../../navigation/walkableGraph';
import type { PreviewPlan } from '../../navigation/routePreview';
import { buildContinuousRoute } from '../../navigation/routeDisplay';
import styles from '../../styles/map/RoutePreview.styles';
import usePhoneHeading from '../../hooks/usePhoneHeading';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  mapSize: number;
  start: GraphNode | null;
  startPoint?: Point | null;
  startOnPath?: boolean; // retained for compatibility with CampusMap.tsx
  plan: PreviewPlan | null;
  showGraph: boolean;
  liveGps?: boolean;
  animateRoute?: boolean;
};

// Debug graph is independent of the calculated route; only visible via SHOW GRAPH.
const allowedRoadEdges = new Set(
  WALKABLE_EDGES.filter(e => e.from.startsWith('N') && e.to.startsWith('N'))
    .map(e => [e.from, e.to].sort().join('|'))
);
const gridDots = WALKABLE_NODES.filter(n => n.kind === 'open')
  .map(n => `M${n.x.toFixed(0)} ${n.y.toFixed(0)}h0.01`).join('');

export default function RoutePreviewOverlay({mapSize, start, startPoint, plan, showGraph, liveGps=false, animateRoute=false}: Props) {
  const animation = useSharedValue(0);
  const phoneHeading = usePhoneHeading(liveGps);

  // A single source of truth: route[0] IS the simulated user's marker.
  // We never draw the marker from a snapped graph node once a route exists.
  const marker = liveGps ? (startPoint ?? plan?.route[0] ?? start) : (plan?.route[0] ?? startPoint ?? start);
  const route = useMemo(
    () => buildContinuousRoute(plan?.route ?? []),
    [plan]
  );

  const pathData = useMemo(() => route.points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  ).join(' '), [route]);
  // Animate an entire solid path via dash OFFSET (not small dashed segments).
  // Unlike rebuilding hundreds of SVG commands every frame, this is cheap
  // enough to remain smooth while the campus is rendered in 2.5D.
  const animatedRouteProps = useAnimatedProps(() => ({
    strokeDashoffset: animation.value,
  }));

  useEffect(() => {
    cancelAnimation(animation);
    animation.value = route.length;
    if (plan && route.length > 0 && animateRoute) {
      animation.value = withTiming(0, {
        duration: Math.max(1400, Math.min(2300, route.length * 3.4)),
        easing: Easing.inOut(Easing.cubic),
      });
    } else if (plan && route.length > 0) {
      animation.value = 0;
    }
    return () => cancelAnimation(animation);
  }, [plan, route.length, animateRoute]);

  return (
    <Svg pointerEvents="none" width={mapSize} height={mapSize}
      viewBox="0 0 800 800" style={styles.overlay}>
      {showGraph && (
        <Path d={gridDots} fill="none" stroke="#0891B2" strokeWidth={2.5}
          strokeLinecap="round" opacity={0.45} />
      )}
      {showGraph && ROAD_EDGES.filter(e => allowedRoadEdges.has([e.from,e.to].sort().join('|'))).map((e, i) => {
        const a = ROAD_NODES_BY_ID[e.from], b = ROAD_NODES_BY_ID[e.to];
        return <Line key={`e${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke="#64748B" strokeWidth={2} strokeOpacity={0.55} />;
      })}
      {showGraph && ROAD_NODES.filter(n => WALKABLE_NODES_BY_ID[n.id]).map(n => (
        <Circle key={n.id} cx={n.x} cy={n.y} r={2.8}
          fill="#475569" fillOpacity={0.85} />
      ))}

      {/* A single continuous two-layer path, not separate strokes per surface. */}
      {plan && route.points.length > 1 && (
        <>
          <AnimatedPath animatedProps={animatedRouteProps} fill="none"
            d={pathData} strokeDasharray={[route.length, route.length]}
            stroke="#FFFFFF" strokeWidth={8.5}
            strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath animatedProps={animatedRouteProps} fill="none"
            d={pathData} strokeDasharray={[route.length, route.length]}
            stroke="#2563EB" strokeWidth={5.2}
            strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* Compass-facing translucent cone. The campus SVG is north-up;
          the cone stays in the same transformed map plane as the GPS dot. */}
      {liveGps && marker && phoneHeading !== null && (() => {
        const direction = phoneHeading * Math.PI / 180;
        const spread = 24 * Math.PI / 180;
        const radius = 39;
        const leftX = marker.x + Math.sin(direction - spread) * radius;
        const leftY = marker.y - Math.cos(direction - spread) * radius;
        const rightX = marker.x + Math.sin(direction + spread) * radius;
        const rightY = marker.y - Math.cos(direction + spread) * radius;
        return (
          <Path
            d={`M ${marker.x} ${marker.y} L ${leftX} ${leftY} A ${radius} ${radius} 0 0 1 ${rightX} ${rightY} Z`}
            fill="#3B82F6"
            fillOpacity={0.23}
            stroke="#3B82F6"
            strokeOpacity={0.34}
            strokeWidth={1.3}
          />
        );
      })()}
      {/* Above the line so its very first coordinate is visibly at the dot center. */}
      {marker && (
        <>
          <Circle cx={marker.x} cy={marker.y} r={13}
            fill="#2563EB" fillOpacity={0.15} />
          <Circle cx={marker.x} cy={marker.y} r={6.5}
            fill="#2563EB" stroke="#FFFFFF" strokeWidth={2.8} />
        </>
      )}
    </Svg>
  );
}
