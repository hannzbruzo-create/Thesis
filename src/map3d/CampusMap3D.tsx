import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import type { GraphNode, Point } from '../navigation/walkableGraph';
import type { PreviewPlan } from '../navigation/routePreview';
import CampusScene from './scene/CampusScene';
import MapLabels, { roomGroup } from './MapLabels';
import BuildingCard from './BuildingCard';
import GoalMarker from './GoalMarker';
import MapControls3D from './MapControls3D';
import useMapCamera, { type MapBounds } from './useMapCamera';
import { useModelStore } from './ModelStore';
import { pointInPolygon, polygonCentroid } from './geometry';
import ShapeHandles from './editor/ShapeHandles';
import MapEditorPanel from './editor/MapEditorPanel';

type Props = {
  start: GraphNode | null;
  startPoint?: Point | null;
  startOnPath?: boolean; // kept for prop compatibility with the old CampusMap
  /** Glide to a point, or frame a rectangle (e.g. the whole route), then report back with the id. */
  focusRequest?: { point: Point; id: number; bounds?: MapBounds } | null;
  onFocusSettled?: (id: number) => void;
  plan: PreviewPlan | null;
  liveGps?: boolean;
  animateRoute?: boolean;
  /** Screen space covered by the header (top) and bottom card (bottom), px; the camera frames around them. */
  insets?: { top: number; bottom: number };
  /** Smoothed GPS accuracy (m), drawn as a ring around the blue dot. */
  accuracyM?: number | null;
  /** Compass heading (degrees from north) for the marker arrow and follow mode. */
  heading?: number | null;
  /** When set, a tap on the map goes here instead (GPS calibration). */
  onMapTap?: ((p: Point) => void) | null;
};

function polygonArea(poly: [number, number][]) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(a / 2);
}

/** Part of the campus (each way, around its middle) framed when navigation starts, before a route. */
const NAV_START_SPAN = 0.55;

/** The 2D / 3D campus map. Drop-in replacement for components/map/CampusMap. */
export default function CampusMap3D({ start, startPoint, focusRequest, onFocusSettled, plan, liveGps = false, animateRoute = false,
  insets = { top: 70, bottom: 0 }, accuracyM = null, heading = null, onMapTap = null }: Props) {
  const { model, editorOpen, selectedId, setSelectedId, setFootprint } = useModelStore();
  const [following, setFollowing] = useState(false);
  const [shapeMode, setShapeMode] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const { height: screenHeight } = useWindowDimensions();

  // Tapped building (by group) whose room names are shown, and the floor being viewed.
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [floor, setFloor] = useState(0);
  const onTap = useCallback((p: Point) => {
    if (onMapTap) { onMapTap(p); return; }
    if (!editorOpen) {
      const hit = model.buildings.filter(b => !b.level && !b.canopy && pointInPolygon(p.x, p.y, b.footprint))
        .sort((a, b) => polygonArea(a.footprint) - polygonArea(b.footprint))[0];
      const group = hit ? (hit.group ?? hit.id) : null;
      setFocusGroup(g => (group && g !== group ? group : group === g ? g : null));
      if (group) setFloor(0);
      return;
    }
    // Smallest footprint under the finger wins (pieces can sit inside larger ones).
    const hits = model.buildings.filter(b => pointInPolygon(p.x, p.y, b.footprint));
    hits.sort((a, b) => polygonArea(a.footprint) - polygonArea(b.footprint));
    setShapeMode(false);
    setSelectedId(hits[0]?.id ?? null);
  }, [editorOpen, model.buildings, setSelectedId, onMapTap]);
  const stopFollowing = useCallback(() => setFollowing(false), []);
  // The campus itself (buildings, plus a margin), not the whole 800 x 800 map square.
  const campusBounds = useMemo<MapBounds>(() => {
    const pts = model.buildings.flatMap(b => b.footprint);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { minX: Math.min(...xs) - 10, minY: Math.min(...ys) - 10, maxX: Math.max(...xs) + 10, maxY: Math.max(...ys) + 10 };
  }, [model.buildings]);
  const insetsRef = React.useRef(insets);
  insetsRef.current = insets;
  const cameraRef = React.useRef<ReturnType<typeof useMapCamera> | null>(null);
  // Opening view: the whole campus, tilted, framed between the header and the bottom card.
  const openingView = useCallback(() => {
    cameraRef.current?.fitBounds(campusBounds, insetsRef.current, { animate: false, padding: 0.04 });
  }, [campusBounds]);
  const cam = useMapCamera({ onTap, onUserMove: stopFollowing, onFirstLayout: openingView });
  cameraRef.current = cam;

  // Same marker rule as the old overlay: live GPS position first, then the route start.
  const goal = plan?.route[plan.route.length - 1] ?? null;
  const marker = liveGps ? (startPoint ?? plan?.route[0] ?? start) : (plan?.route[0] ?? startPoint ?? start);

  useEffect(() => {
    if (focusRequest) {
      const id = focusRequest.id;
      if (liveGps) {
        // Navigation starts: tilt into 3D, close in on you, and turn the map the way you are
        // facing (follow mode keeps it centred and turning as you walk).
        cam.setMode(true);
        cam.focusOnPoint(focusRequest.point, () => { setFollowing(true); onFocusSettled?.(id); }, 260);
      } else if (focusRequest.bounds) cam.fitBounds(focusRequest.bounds, insets, { padding: 0.35, done: () => onFocusSettled?.(id) });
      else cam.focusOnPoint(focusRequest.point, () => onFocusSettled?.(id));
    }
    // Triggered by the calculation counter, not by camera re-renders.
  }, [focusRequest?.id]);

  // Navigation started: until a route frames the camera, tilt into 3D and close in on the middle
  // of the campus (the guide left the map zoomed far out above its tall sheet).
  // Navigation ended (emergency changed or reset): back to the flat overview.
  useEffect(() => {
    if (liveGps) {
      if (focusRequest) return;
      cam.setMode(true);
      const cx = (campusBounds.minX + campusBounds.maxX) / 2, cy = (campusBounds.minY + campusBounds.maxY) / 2;
      const hx = (campusBounds.maxX - campusBounds.minX) * NAV_START_SPAN / 2, hy = (campusBounds.maxY - campusBounds.minY) * NAV_START_SPAN / 2;
      cam.fitBounds({ minX: cx - hx, minY: cy - hy, maxX: cx + hx, maxY: cy + hy }, insets, { padding: 0 });
      return;
    }
    setFollowing(false);
    if (cam.mode3D) { cam.setMode(false); cam.fitBounds(campusBounds, insets, { padding: 0.04 }); }
  }, [liveGps]);
  // Follow mode: position and heading are separate, so compass updates (many per second) do not
  // restart the position glide, and small compass wobble does not turn the map.
  useEffect(() => {
    if (following && startPoint) cam.follow(startPoint);
  }, [following, startPoint?.x, startPoint?.y]);
  useEffect(() => {
    if (following) cam.followHeading(heading);
  }, [heading]);
  // Turning follow back on (locate button) re-applies the heading even if it barely changed.
  useEffect(() => {
    if (following) cam.followHeading(heading, true);
  }, [following]);

  useEffect(() => { if (!editorOpen) setShapeMode(false); }, [editorOpen]);
  // When the bottom panel changes size (emergency guide opens or closes), frame the campus in
  // the space that is left, unless live navigation is controlling the camera.
  useEffect(() => {
    if (!liveGps) cam.fitBounds(campusBounds, insets, { padding: 0.04 });
  }, [insets.bottom]);
  const selected = model.buildings.find(b => b.id === selectedId) ?? null;
  const toggleShapeMode = useCallback((on: boolean) => {
    setShapeMode(on);
    if (on && selected) {
      // Corner editing is easiest straight from above.
      cam.setMode(false);
      const [x, y] = polygonCentroid(selected.footprint);
      cam.focusOnPoint({ x, y }, undefined, 260);
    }
  }, [selected]);

  // The selected building: name, number of floors and how many rooms are named per floor.
  const focus = useMemo(() => {
    if (!focusGroup) return null;
    const pieces = model.buildings.filter(b => (b.group ?? b.id) === focusGroup);
    const floors = Math.max(1, ...pieces.map(b => (b.level ?? 0) + b.floors));
    const label = model.labels.find(l => pieces.some(b => pointInPolygon(l.x, l.y, b.footprint)));
    const rooms = model.rooms.filter(r => roomGroup(r, model) === focusGroup);
    const perFloor = Array.from({ length: floors }, (_, f) => rooms.filter(r => (r.floor ?? 0) === f).length);
    return { name: label?.name ?? pieces[0]?.name ?? focusGroup, floors, perFloor, firstId: pieces[0]?.id ?? null };
  }, [focusGroup, model]);
  useEffect(() => { if (editorOpen) setFocusGroup(null); }, [editorOpen]);

  const recenter = () => {
    if (liveGps && startPoint) cam.focusOnPoint(startPoint);
    else cam.fitBounds(campusBounds, insets, { padding: 0.04 });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} onLayout={cam.onLayout}>
        <CampusScene
          model={model}
          camera={cam.camera}
          selectedId={editorOpen ? selectedId : focus?.firstId ?? null}
          plan={plan}
          marker={marker}
          heading={liveGps ? heading : null}
          accuracyM={liveGps ? accuracyM : null}
          animateRoute={animateRoute}
        />
        <GestureDetector gesture={cam.gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false} />
        </GestureDetector>
        <MapLabels model={model} camera={cam.camera} hidden={!showLabels && !focusGroup} focusGroup={focusGroup} floor={floor} />
        {goal && <GoalMarker point={goal} name={plan!.area.name} camera={cam.camera} />}
        {editorOpen && shapeMode && selected && (
          <ShapeHandles building={selected} camera={cam.camera} onChange={fp => setFootprint(selected.id, fp)} />
        )}
      </View>
      <MapControls3D
        mode3D={cam.mode3D}
        onZoomIn={cam.zoomIn}
        onZoomOut={cam.zoomOut}
        onToggleMode={() => cam.setMode(!cam.mode3D)}
        onRecenter={recenter}
        onFit={() => cam.fitBounds(campusBounds, insets, { padding: 0.04 })}
        hasLiveLocation={Boolean(liveGps && startPoint)}
        following={following}
        onToggleFollow={() => setFollowing(f => !f)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels(v => !v)}
        bottom={editorOpen ? Math.round(screenHeight * 0.52) + 24 : insets.bottom + 20}
      />
      {!editorOpen && focus && (
        <BuildingCard name={focus.name} floors={focus.floors} floor={floor} roomCount={focus.perFloor[floor] ?? 0}
          onFloor={setFloor} onClose={() => setFocusGroup(null)} />
      )}
      {editorOpen && <MapEditorPanel shapeMode={shapeMode} onShapeMode={toggleShapeMode} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAF2F8' },
});
