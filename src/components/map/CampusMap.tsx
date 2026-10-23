import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import CampusSVG from '../../../assets/maps/ust.svg';
import CampusContext from './CampusContext';
import Building3D from './Building3D';
import BuildingLabels from './BuildingLabels';
import CampusFadeOverlay from './CampusFadeOverlay';
import MapControls from './MapControls';
import RoutePreviewOverlay from './RoutePreviewOverlay';
import EvacuationAreas from './EvacuationAreas';
import type { GraphNode, Point } from '../../navigation/walkableGraph';
import type { PreviewPlan } from '../../navigation/routePreview';
import useCampusCamera from '../../hooks/useCampusCamera';
import styles from '../../styles/map/CampusMap.styles';

// Original project rendered the 800x800 SVG into a 1200x1200 screen-space plane.
// 800x800 SOURCE COORDINATES ARE UNCHANGED.
const MAP_SIZE = 1200;

// GPS fixes can arrive every second. These huge/static map layers must not
// reconcile thousands of SVG elements each time the blue marker changes.
const StaticCampusBase = React.memo(function StaticCampusBase() {
  return (
    <>
      <CampusContext mapSize={MAP_SIZE} />
      <CampusSVG width={MAP_SIZE} height={MAP_SIZE} pointerEvents="none" style={styles.campus} />
    </>
  );
});
const StaticBuildings = React.memo(function StaticBuildings() {
  return <Building3D mapSize={MAP_SIZE} />;
});
const StaticMapFade = React.memo(function StaticMapFade() {
  return <CampusFadeOverlay mapSize={MAP_SIZE} />;
});

type Props = {
  start: GraphNode | null;
  startPoint?: Point | null;
  startOnPath?: boolean;
  focusRequest?: { point: Point; id: number } | null;
  onFocusSettled?: (id: number) => void;
  plan: PreviewPlan | null;
  showGraph: boolean;
  onMapTap: (point: Point) => void;
  liveGps?: boolean;
  animateRoute?: boolean;
};
export default function CampusMap({start,startPoint,startOnPath=false,focusRequest,onFocusSettled,plan,showGraph,onMapTap,liveGps=false,animateRoute=false}:Props) {
  const camera = useCampusCamera(onMapTap);

  useEffect(() => {
    if (focusRequest) {
      const id = focusRequest.id;
      camera.focusOnPoint(focusRequest.point, () => onFocusSettled?.(id));
    }
    // Triggered by the calculation counter, not by camera re-renders.
  }, [focusRequest?.id]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={camera.gesture}>
        <View style={styles.gestureArea} onLayout={camera.onLayout} collapsable={false}>
          {/* Single native layer: pan + zoom + perspective/tilt commit together.
              This avoids a one-frame wobble between separate native views. */}
          <Animated.View style={[styles.mapPanLayer, styles.mapZoomLayer, camera.mapStyle]}>
              <StaticCampusBase />
              <Animated.View pointerEvents="none" style={[styles.layer, camera.depthStyle]}>
                <StaticBuildings />
              </Animated.View>
              <StaticMapFade />
              <RoutePreviewOverlay mapSize={MAP_SIZE} start={start} startPoint={startPoint} startOnPath={startOnPath} plan={plan} showGraph={showGraph} liveGps={liveGps} animateRoute={animateRoute} />
              <BuildingLabels mapSize={MAP_SIZE} zoomLevel={camera.zoomDisplay} />
              {/* Keep the destination on the SAME native map plane as the route.
                  Do not project it into screen space separately: perspective +
                  scale transform order differs between Android native views and
                  the old projection helper, especially in 2.5D. Use the final
                  rendered route coordinate as the single source of truth. */}
              <EvacuationAreas
                mapSize={MAP_SIZE}
                center={plan?.route[plan.route.length - 1] ?? null}
              />
          </Animated.View>
        </View>
      </GestureDetector>
      <MapControls
        zoom={camera.zoomDisplay}
        tilted={camera.isTilted}
        onZoomIn={camera.zoomIn}
        onZoomOut={camera.zoomOut}
        onReset={liveGps && startPoint ? () => camera.focusOnPoint(startPoint) : camera.resetView}
        onFitCampus={camera.fitCampus}
        onToggleTilt={camera.toggleTilt}
        hasLiveLocation={Boolean(liveGps && startPoint)}
      />
    </GestureHandlerRootView>
  );
}
