import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { CampusModel, CampusLabel } from './modelTypes';
import { buildingHeight } from './modelTypes';
import { pointInPolygon } from './geometry';
import { cameraBasis, worldToScreen } from './cameraMath';
import type { CameraValues } from './useMapCamera';

/** Room names of every building appear once the camera is closer than this (map units, ~170 m). */
const ROOM_LABEL_DISTANCE = 360;
const BUILDING_FONT = 11;
const ROOM_FONT = 9;
/** Gap kept between label boxes, px. */
const PAD = 3;

type Item = { label: CampusLabel; height: number; room: boolean; w: number; h: number };
type Placed = { x: number; y: number; on: number }[];

/** Rough on-screen size of a label, from its text length (no layout pass needed). */
function boxSize(name: string, room: boolean) {
  const font = room ? ROOM_FONT : BUILDING_FONT;
  const maxW = room ? 90 : 130;
  const oneLine = name.length * font * 0.56;
  const lines = room ? 1 : Math.min(2, Math.ceil(oneLine / maxW));
  return { w: Math.min(maxW, oneLine) + 4, h: lines * (font + 2) + 2 };
}

/** One label; its position and visibility come from the shared placement pass. */
function Label({ item, index, placed, color, halo }: {
  item: Item; index: number; placed: SharedValue<Placed>; color: string; halo: string;
}) {
  const style = useAnimatedStyle(() => {
    const p = placed.value[index];
    if (!p) return { opacity: 0 };
    return { opacity: p.on, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  const room = item.room;
  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, style]}>
      <View style={[room ? styles.centreSmall : styles.centre]}>
        {room && <View style={[styles.dot, { backgroundColor: color }]} />}
        <Text numberOfLines={room ? 1 : 2} style={[room ? styles.textSmall : styles.text, { color, textShadowColor: halo }]}>
          {item.label.name}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Height of the roof under a label, so it sits on top of its building. */
function roofHeight(l: CampusLabel, model: CampusModel) {
  const b = model.buildings.find(bb => pointInPolygon(l.x, l.y, bb.footprint));
  return b ? buildingHeight(b) : 0;
}

/** Building group a room belongs to (the building whose footprint contains it). */
export function roomGroup(l: CampusLabel, model: CampusModel): string | null {
  const b = model.buildings.find(bb => !bb.level && pointInPolygon(l.x, l.y, bb.footprint));
  return b ? (b.group ?? b.id) : null;
}

/**
 * Building names and room names, decluttered every frame on the UI thread: labels are placed in
 * priority order (building names first, then rooms) and any label whose box would overlap one
 * already placed is hidden, so the map never shows piled-up text. Rooms show for the selected
 * building on the selected floor, or for every building (ground floor) when zoomed in close.
 */
export default function MapLabels({ model, camera, hidden, focusGroup = null, floor = 0 }: {
  model: CampusModel; camera: CameraValues; hidden: boolean; focusGroup?: string | null; floor?: number;
}) {
  const [near, setNear] = useState(false);
  useAnimatedReaction(
    () => camera.distance.value < ROOM_LABEL_DISTANCE,
    (isNear, wasNear) => { if (isNear !== wasNear) runOnJS(setNear)(isNear); },
  );
  const roomGroups = useMemo(() => model.rooms.map(r => roomGroup(r, model)), [model]);
  const items: Item[] = useMemo(() => {
    const buildings = model.labels.map(l => ({ label: l, height: roofHeight(l, model) + 1, room: false, ...boxSize(l.name, false) }));
    const rooms = model.rooms
      .map((l, i) => ({ l, g: roomGroups[i] }))
      .filter(({ l, g }) => (l.floor ?? 0) === (focusGroup ? floor : 0) && (focusGroup ? g === focusGroup : near))
      // Shorter names first: room numbers (T-105) are the most useful and the easiest to fit.
      .sort((a, b) => a.l.name.length - b.l.name.length)
      .map(({ l }) => ({ label: l, height: roofHeight(l, model) + 0.5, room: true, ...boxSize(l.name, true) }));
    // The selected building's own name stays; other names make way for its rooms.
    return focusGroup ? [...buildings.filter(b => roofGroupName(b.label, model) === focusGroup), ...rooms, ...buildings.filter(b => roofGroupName(b.label, model) !== focusGroup)]
      : [...buildings, ...rooms];
  }, [model, roomGroups, focusGroup, floor, near]);

  const geometry = useMemo(() => items.map(i => [i.label.x, i.label.y, i.height, i.w, i.h, i.room ? 1 : 0]), [items]);
  const placed = useDerivedValue<Placed>(() => {
    const w = camera.width.value, h = camera.height.value;
    const b = cameraBasis(camera.rendered.value, w, h);
    const boxes: number[][] = [];
    const out: Placed = [];
    for (let i = 0; i < geometry.length; i++) {
      const g = geometry[i];
      const p = worldToScreen(b, g[0], g[1], g[2]);
      const bw = g[3], bh = g[4];
      // Rooms anchor at their dot; building names centre on their point.
      const x0 = p.x - bw / 2, y0 = g[5] ? p.y - 2 : p.y - bh / 2;
      let on = p.visible && p.x > -bw && p.x < w + bw && p.y > -bh && p.y < h + bh ? 1 : 0;
      if (on) {
        for (let k = 0; k < boxes.length; k++) {
          const q = boxes[k];
          if (x0 < q[2] + PAD && x0 + bw + PAD > q[0] && y0 < q[3] + PAD && y0 + bh + PAD > q[1]) { on = 0; break; }
        }
        if (on) boxes.push([x0, y0, x0 + bw, y0 + bh]);
      }
      out.push({ x: p.x, y: p.y, on });
    }
    return out;
  }, [geometry]);

  if (hidden) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it, i) => (
        <Label key={it.label.id} item={it} index={i} placed={placed}
          color={it.room ? '#1E293B' : model.theme.labelText} halo={model.theme.labelHalo} />
      ))}
    </View>
  );
}

/** Group of the building a building-name label sits on. */
function roofGroupName(l: CampusLabel, model: CampusModel): string | null {
  const b = model.buildings.find(bb => pointInPolygon(l.x, l.y, bb.footprint));
  return b ? (b.group ?? b.id) : null;
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
  centre: { position: 'absolute', left: -65, width: 130, top: -14, alignItems: 'center' },
  centreSmall: { position: 'absolute', left: -45, width: 90, top: -2, alignItems: 'center' },
  dot: { width: 3, height: 3, borderRadius: 2, opacity: 0.55, marginBottom: 1 },
  text: {
    fontSize: BUILDING_FONT, lineHeight: BUILDING_FONT + 2, fontWeight: '800', letterSpacing: 0.15, textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4, includeFontPadding: false,
  },
  textSmall: {
    fontSize: ROOM_FONT, lineHeight: ROOM_FONT + 2, fontWeight: '600', textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3, includeFontPadding: false,
  },
});
