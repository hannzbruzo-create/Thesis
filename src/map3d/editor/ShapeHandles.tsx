import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { CampusBuilding, XY } from '../modelTypes';
import { buildingHeight } from '../modelTypes';
import { cameraBasis, screenToGround, worldToScreen } from '../cameraMath';
import { readCamera, type CameraValues } from '../useMapCamera';

const HIT = 36; // touch box size around each handle

type HandleProps = {
  x: number; y: number; height: number; camera: CameraValues; kind: 'corner' | 'add';
  onMove?: (p: XY) => void; onPress?: () => void; onLongPress?: () => void;
};

/** A draggable dot pinned to a roof corner (or an edge midpoint for adding a corner). */
function Handle({ x, y, height, camera, kind, onMove, onPress, onLongPress }: HandleProps) {
  // Position lives in shared values and callbacks in a ref, so the gesture
  // object is created once and is not torn down mid-drag by re-renders.
  const px = useSharedValue(x), py = useSharedValue(y), ph = useSharedValue(height);
  useEffect(() => { px.value = x; py.value = y; ph.value = height; }, [x, y, height]);
  const callbacks = useRef({ onMove, onPress, onLongPress });
  callbacks.current = { onMove, onPress, onLongPress };
  const move = useCallback((p: XY) => callbacks.current.onMove?.(p), []);
  const press = useCallback(() => callbacks.current.onPress?.(), []);
  const longPress = useCallback(() => callbacks.current.onLongPress?.(), []);

  const style = useAnimatedStyle(() => {
    const b = cameraBasis(readCamera(camera), camera.width.value, camera.height.value);
    const p = worldToScreen(b, px.value, py.value, ph.value);
    return { opacity: p.visible ? 1 : 0, transform: [{ translateX: p.x - HIT / 2 }, { translateY: p.y - HIT / 2 }] };
  });
  const gesture = useMemo(() => {
    const drag = Gesture.Pan()
      .enabled(kind === 'corner')
      .onChange(e => {
        const b = cameraBasis(readCamera(camera), camera.width.value, camera.height.value);
        // The touch is relative to this handle's box; rebuild the finger's map-view position.
        const at = worldToScreen(b, px.value, py.value, ph.value);
        const p = screenToGround(b, at.x - HIT / 2 + e.x, at.y - HIT / 2 + e.y, ph.value);
        if (!p) return;
        px.value = p.x; py.value = p.y; // move the dot immediately; JS catches up
        runOnJS(move)([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
      });
    const tap = Gesture.Tap().onEnd(() => { runOnJS(press)(); });
    const hold = Gesture.LongPress().minDuration(450).onStart(() => { runOnJS(longPress)(); });
    return Gesture.Exclusive(drag, hold, tap);
  }, [kind]);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.anchor, style]}>
        <View style={kind === 'corner' ? styles.corner : styles.add} />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Corner editing for one footprint: drag a corner to move it, tap a small
 * midpoint dot to add a corner there, long-press a corner to delete it.
 */
export default function ShapeHandles({ building, camera, onChange }: {
  building: CampusBuilding; camera: CameraValues; onChange: (footprint: XY[]) => void;
}) {
  const fp = building.footprint;
  const h = buildingHeight(building);
  const moveCorner = (i: number) => (p: XY) => onChange(fp.map((q, k) => (k === i ? p : q)));
  const removeCorner = (i: number) => () => { if (fp.length > 3) onChange(fp.filter((_, k) => k !== i)); };
  const addCorner = (i: number) => () => {
    const a = fp[i], b = fp[(i + 1) % fp.length];
    onChange([...fp.slice(0, i + 1), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...fp.slice(i + 1)]);
  };
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {fp.map((a, i) => {
        const b = fp[(i + 1) % fp.length];
        return (
          <Handle key={`m${i}-${fp.length}`} kind="add" camera={camera} height={h}
            x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2} onPress={addCorner(i)} />
        );
      })}
      {fp.map((p, i) => (
        <Handle key={`c${i}-${fp.length}`} kind="corner" camera={camera} height={h} x={p[0]} y={p[1]}
          onMove={moveCorner(i)} onLongPress={removeCorner(i)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  corner: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#2563EB',
  },
  add: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(37,99,235,0.55)', borderWidth: 1.5, borderColor: '#FFFFFF',
  },
});
