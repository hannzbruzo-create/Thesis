import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { AlignmentInfo, GpsFix } from '../../location/campusGps';
import type { Point } from '../../navigation/walkableGraph';

type Sensors = {
  /** Steps counted while this panel is open, or null when there is no accelerometer. */
  steps: number | null;
  heading: number | null;
  /** Height above ground level (m); undefined = no barometer, null = not learned yet. */
  floorHeightM: number | null | undefined;
};

/**
 * Field-test panel (long-press the GPS line in the bottom card). Shows the fused phone fix, the
 * filtered position and the sensors used with it, and aligns the map: stand still on a spot you
 * can find on the map for ~15 s, tap "Add point", then tap that spot. Points in 2–4 places far
 * apart (opposite corners of campus) fix offset, scale and rotation.
 */
export default function GpsTestPanel({ raw, smoothed, mapPoint, alignment, sensors, calibrating, screen,
  onCalibrate, onUndo, onReset, onShare, onClose }: {
  raw: GpsFix | null; smoothed: GpsFix | null; mapPoint: Point | null; alignment: AlignmentInfo; sensors: Sensors;
  calibrating: boolean; screen: string;
  onCalibrate: () => void; onUndo: () => void; onReset: () => void; onShare: () => void; onClose: () => void;
}) {
  const f = (v: number | null | undefined, d = 6) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
  const floor = sensors.floorHeightM === undefined ? 'no barometer'
    : sensors.floorHeightM === null ? 'learning ground level…' : `${sensors.floorHeightM.toFixed(1)} m above ground`;
  const aligned = alignment.points
    ? `${alignment.points} pt · shift ${alignment.offsetM.toFixed(1)} m · scale ${alignment.scale.toFixed(3)} · ${alignment.rotationDeg.toFixed(1)}°` +
      (alignment.points > 1 ? ` · fit ±${alignment.residualM.toFixed(1)} m` : '')
    : 'none yet';
  return (
    <View style={s.card}>
      <View style={s.head}>
        <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#1D4ED8" />
        <Text style={s.title}>GPS test</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close GPS test">
          <MaterialCommunityIcons name="close" size={16} color="#475569" />
        </Pressable>
      </View>
      <Row k="Fused fix" v={`${f(raw?.latitude)}, ${f(raw?.longitude)}  ±${f(raw?.accuracy, 0)} m`} />
      <Row k="Filtered" v={`±${f(smoothed?.accuracy, 1)} m`} />
      <Row k="On map" v={mapPoint ? `x ${mapPoint.x.toFixed(1)}  y ${mapPoint.y.toFixed(1)}` : '—'} />
      <Row k="Status" v={screen} />
      <Row k="Sensors" v={`steps ${sensors.steps ?? 'n/a'} · compass ${sensors.heading == null ? '—' : `${Math.round(sensors.heading)}°`}`} />
      <Row k="Barometer" v={floor} />
      <Row k="Alignment" v={aligned} />
      {calibrating
        ? <Text style={s.hint}>Tap the map exactly where you are standing.</Text>
        : (
          <>
            <View style={s.actions}>
              <Pressable style={s.primary} onPress={onCalibrate} accessibilityRole="button"><Text style={s.primaryText}>Add point</Text></Pressable>
              <Pressable style={s.ghost} onPress={onUndo} disabled={!alignment.points} accessibilityRole="button"><Text style={s.ghostText}>Undo</Text></Pressable>
              <Pressable style={s.ghost} onPress={onReset} accessibilityRole="button"><Text style={s.ghostText}>Clear</Text></Pressable>
              <Pressable style={s.ghost} onPress={onShare} disabled={!alignment.points} accessibilityRole="button"><Text style={s.ghostText}>Share</Text></Pressable>
            </View>
          </>
        )}
      <Text style={s.note}>Stand still ~15 s before adding a point. Use 2–4 spots far apart. Points are saved on this phone; "Share" sends them so they can be built into the app.</Text>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute', left: 12, right: 64, top: 70, zIndex: 27, backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 14, padding: 10, elevation: 6,
    shadowColor: '#0F172A', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: '900', color: '#0F172A' },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  k: { width: 70, fontSize: 10.5, fontWeight: '700', color: '#64748B' },
  v: { flex: 1, fontSize: 10.5, fontWeight: '600', color: '#0F172A', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  primary: { flex: 1.4, paddingVertical: 8, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  ghost: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center' },
  ghostText: { color: '#1D4ED8', fontWeight: '800', fontSize: 12 },
  hint: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#1D4ED8', textAlign: 'center' },
  note: { marginTop: 6, fontSize: 9.5, color: '#64748B' },
});
