import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { CampusModel, CampusLabel, PlaceKind } from './modelTypes';
import { buildingHeight } from './modelTypes';
import { pointInPolygon } from './geometry';
import { cameraBasis, worldToScreen } from './cameraMath';
import type { CameraValues } from './useMapCamera';

/** Room names of every building appear once the camera is closer than this (map units, ~170 m). */
const ROOM_LABEL_DISTANCE = 360;
/** Key places (canteen, offices, clinic) appear once the camera is closer than this (~380 m). */
const PLACE_LABEL_DISTANCE = 800;
const BUILDING_FONT = 11;
const PLACE_FONT = 10;
const ROOM_FONT = 9;
/** Gap kept between label boxes, px. */
const PAD = 4;

type Kind = 'building' | 'place' | 'room';
type Item = { label: CampusLabel; height: number; kind: Kind; w: number; h: number };
type Placed = { x: number; y: number; on: number }[];

/** Icon and colour of each kind of key place. */
const PLACE_STYLE: Record<PlaceKind, { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string }> = {
  office: { icon: 'briefcase-variant', color: '#2563EB' },
  faculty: { icon: 'account-group', color: '#0F766E' },
  clinic: { icon: 'medical-bag', color: '#DC2626' },
};

/** Rough on-screen size of a label, from its text length (no layout pass needed). */
function boxSize(name: string, kind: Kind) {
  const font = kind === 'room' ? ROOM_FONT : kind === 'place' ? PLACE_FONT : BUILDING_FONT;
  const maxW = kind === 'room' ? 90 : 120;
  const oneLine = name.length * font * 0.58;
  if (kind === 'room') return { w: Math.min(maxW, oneLine) + 4, h: font + 4 };
  // Key places: icon dot, gap, one line of text.
  if (kind === 'place') return { w: Math.min(maxW, oneLine) + 20, h: 16 };
  const lines = Math.min(2, Math.ceil(oneLine / maxW));
  return { w: Math.min(maxW, oneLine) + 4, h: lines * (font + 2) + 2 };
}

/** One label; its position and visibility come from the shared placement pass. */
function Label({ item, index, placed, textColor }: {
  item: Item; index: number; placed: SharedValue<Placed>; textColor: string;
}) {
  const style = useAnimatedStyle(() => {
    const p = placed.value[index];
    if (!p) return { opacity: 0 };
    return { opacity: p.on, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  const { kind, label } = item;
  return (
    <Animated.View pointerEvents="none" style={[styles.anchor, style]}>
      {kind === 'room' ? (
        <View style={styles.centreSmall}>
          <View style={[styles.dot, { backgroundColor: textColor }]} />
          <Text numberOfLines={1} style={[styles.textSmall, { color: textColor }]}>{label.name}</Text>
        </View>
      ) : (
        <View style={styles.centre}>
          {kind === 'place' && label.place ? (
            // Coloured icon dot with the name beside it in the same colour.
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: PLACE_STYLE[label.place].color }]}>
                <MaterialCommunityIcons name={PLACE_STYLE[label.place].icon} size={9} color="#FFFFFF" />
              </View>
              <Text numberOfLines={1} style={[styles.textPlace, { color: PLACE_STYLE[label.place].color }]}>{label.name}</Text>
            </View>
          ) : (
            <Text numberOfLines={2} style={[styles.text, { color: textColor }]}>{label.name}</Text>
          )}
        </View>
      )}
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
 * Building names, key places and room names, decluttered every frame on the UI thread: labels are
 * placed in priority order (building names, then key places, then rooms) and any label whose box
 * would overlap one already placed is hidden, so the map never shows piled-up text. Key places
 * (canteen, offices, clinic) show once zoomed in a little; rooms show for the selected building on
 * the selected floor, or for every building (ground floor) when zoomed in close.
 */
export default function MapLabels({ model, camera, hidden, focusGroup = null, floor = 0 }: {
  model: CampusModel; camera: CameraValues; hidden: boolean; focusGroup?: string | null; floor?: number;
}) {
  const [near, setNear] = useState(false);
  useAnimatedReaction(
    () => camera.distance.value < ROOM_LABEL_DISTANCE,
    (isNear, wasNear) => { if (isNear !== wasNear) runOnJS(setNear)(isNear); },
  );
  const [placesOn, setPlacesOn] = useState(false);
  useAnimatedReaction(
    () => camera.distance.value < PLACE_LABEL_DISTANCE,
    (isNear, wasNear) => { if (isNear !== wasNear) runOnJS(setPlacesOn)(isNear); },
  );
  // Zoomed in, only rooms around the camera get a label view (there are a few hundred campus-wide,
  // and every mounted label is placed and moved each frame). The area follows the camera in steps.
  const [area, setArea] = useState({ x: 0, y: 0, r: 0 });
  const sent = useSharedValue({ x: 0, y: 0, r: 0 });
  useAnimatedReaction(
    () => ({ x: camera.targetX.value, y: camera.targetY.value, r: camera.distance.value * 1.4 + 60 }),
    now => {
      const last = sent.value;
      if (Math.hypot(now.x - last.x, now.y - last.y) > last.r * 0.3 || Math.abs(now.r - last.r) > last.r * 0.25) {
        sent.value = now;
        runOnJS(setArea)(now);
      }
    },
  );
  const roomGroups = useMemo(() => model.rooms.map(r => roomGroup(r, model)), [model]);
  const items: Item[] = useMemo(() => {
    const buildings = model.labels.filter(l => !l.place)
      .map(l => ({ label: l, height: roofHeight(l, model) + 1, kind: 'building' as const, ...boxSize(l.name, 'building') }));
    const places = model.labels.filter(l => l.place && (placesOn || focusGroup))
      .map(l => ({ label: l, height: roofHeight(l, model) + 1, kind: 'place' as const, ...boxSize(l.name, 'place') }));
    const rooms = model.rooms
      .map((l, i) => ({ l, g: roomGroups[i] }))
      .filter(({ l, g }) => (l.floor ?? 0) === (focusGroup ? floor : 0)
        && (focusGroup ? g === focusGroup : near && Math.hypot(l.x - area.x, l.y - area.y) < area.r))
      // Shorter names first: room numbers (T-105) are the most useful and the easiest to fit.
      .sort((a, b) => a.l.name.length - b.l.name.length)
      .map(({ l }) => ({ label: l, height: roofHeight(l, model) + 0.5, kind: 'room' as const, ...boxSize(l.name, 'room') }));
    // The selected building's own name stays; other names make way for its rooms.
    return focusGroup ? [...buildings.filter(b => roofGroupName(b.label, model) === focusGroup), ...places, ...rooms, ...buildings.filter(b => roofGroupName(b.label, model) !== focusGroup)]
      : [...buildings, ...places, ...rooms];
  }, [model, roomGroups, focusGroup, floor, near, placesOn, area]);

  const geometry = useMemo(() => items.map(i => [i.label.x, i.label.y, i.height, i.w, i.h, i.kind === 'room' ? 1 : 0]), [items]);
  const placed = useDerivedValue<Placed>(() => {
    const w = camera.width.value, h = camera.height.value;
    const b = cameraBasis(camera.rendered.value, w, h);
    const boxes: number[][] = [];
    const out: Placed = [];
    for (let i = 0; i < geometry.length; i++) {
      const g = geometry[i];
      const p = worldToScreen(b, g[0], g[1], g[2]);
      const bw = g[3], bh = g[4];
      // Rooms anchor at their dot; building and place names centre on their point.
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
        <Label key={it.label.id} item={it} index={i} placed={placed} textColor={it.kind === 'room' ? '#334155' : model.theme.labelText} />
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
  // Centred on the label point: a box wider and taller than any label, content in its middle.
  centre: { position: 'absolute', left: -75, width: 150, top: -30, height: 60, alignItems: 'center', justifyContent: 'center' },
  centreSmall: { position: 'absolute', left: -45, width: 90, top: -2, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', maxWidth: 140 },
  icon: {
    width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 3,
    borderWidth: 1, borderColor: '#FFFFFF',
  },
  dot: { width: 3, height: 3, borderRadius: 2, opacity: 0.55, marginBottom: 1 },
  // Plain text with a thin white outline, like a road map: no boxes over the scene.
  text: {
    fontSize: BUILDING_FONT, lineHeight: BUILDING_FONT + 2, fontWeight: '600', textAlign: 'center', maxWidth: 124,
    textShadowColor: '#FFFFFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2, includeFontPadding: false,
  },
  textPlace: {
    fontSize: PLACE_FONT, lineHeight: PLACE_FONT + 2, fontWeight: '600', flexShrink: 1,
    textShadowColor: '#FFFFFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2, includeFontPadding: false,
  },
  textSmall: {
    fontSize: ROOM_FONT, lineHeight: ROOM_FONT + 2, fontWeight: '600', textAlign: 'center',
    textShadowColor: '#FFFFFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3, includeFontPadding: false,
  },
});
