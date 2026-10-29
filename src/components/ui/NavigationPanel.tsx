import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { PreviewPlan } from '../../navigation/routePreview';
import type { EmergencyType } from '../../emergency/emergencyTypes';
import { routeLengthMetres } from '../../navigation/routeFollow';

type Props = {
  plan: PreviewPlan | null;
  emergencyMode: EmergencyType;
  liveStatus: string;
  outsideCampus: boolean;
  routeWarning?: boolean;
  /** Smoothed GPS accuracy in metres, when known. */
  accuracyM?: number | null;
  onChangeEmergency: () => void;
  onRetryGps: () => void;
  /** Long-press the GPS line to open the GPS test panel (field testing). */
  onToggleGpsTest?: () => void;
};

/** Within this many metres of the goal the walker has arrived. */
const ARRIVED_METRES = 8;
/** Typical evacuation walking speed (m/s) for the time estimate. */
const WALK_SPEED = 1.2;

const TIPS: Record<EmergencyType, { walking: string; arrived: string }> = {
  earthquake: {
    walking: 'Keep away from buildings, walls and glass. Watch for aftershocks.',
    arrived: 'Stay in this area, away from buildings and trees. Wait for the all-clear from campus staff.',
  },
  fire: {
    walking: 'Stay low and away from smoke. Do not go back for belongings.',
    arrived: 'Stay in this area, away from smoke. Wait for the all-clear from campus staff.',
  },
};

/**
 * Bottom card for live navigation, in one of four states: finding your location, outside the
 * campus, walking to the evacuation area, and arrived. Only the action that matters for the
 * current state is a button; changing the emergency is a small link.
 */
export default function NavigationPanel({ plan, emergencyMode, liveStatus, outsideCampus, routeWarning = false,
  accuracyM, onChangeEmergency, onRetryGps, onToggleGpsTest }: Props) {
  const remaining = plan ? routeLengthMetres(plan.route) : null;
  const arrived = remaining != null && remaining <= ARRIVED_METRES;
  const gpsText = accuracyM != null && Number.isFinite(accuracyM) ? `GPS ±${Math.max(1, Math.round(accuracyM))} m` : 'GPS —';

  let body: React.ReactNode;
  if (outsideCampus) {
    body = (
      <>
        <Head icon={<Badge bg="#FEF3C7"><MaterialCommunityIcons name="map-marker-off" size={21} color="#B45309" /></Badge>}
          eyebrow="OUTSIDE THE CAMPUS MAP" title="No route here" />
        <Tip tone="warn" icon="alert-circle-outline">
          TomaSafe navigation only works inside UST–Legazpi Rawis Campus. Move onto campus to get a route.
        </Tip>
      </>
    );
  } else if (!plan) {
    body = (
      <>
        <Head icon={<Badge bg="#EFF6FF"><ActivityIndicator size="small" color="#2563EB" /></Badge>}
          eyebrow="FINDING YOUR LOCATION" title="Getting a GPS fix…" />
        <Tip tone="info" icon="information-outline">{liveStatus || 'Stay in an open area. This usually takes a few seconds.'}</Tip>
        <Pressable style={s.primary} onPress={onRetryGps} accessibilityRole="button">
          <MaterialCommunityIcons name="refresh" size={17} color="#FFFFFF" />
          <Text style={s.primaryText}>Retry GPS</Text>
        </Pressable>
      </>
    );
  } else if (arrived) {
    body = (
      <>
        <Head icon={<Badge bg="#15803D"><MaterialCommunityIcons name="check-bold" size={22} color="#FFFFFF" /></Badge>}
          eyebrow="YOU HAVE ARRIVED" title={plan.area.name} />
        <Tip tone="ok" icon="check-circle-outline">{TIPS[emergencyMode].arrived}</Tip>
      </>
    );
  } else {
    const metres = Math.round(remaining!);
    const minutes = Math.max(1, Math.ceil(remaining! / WALK_SPEED / 60));
    body = (
      <>
        <Head icon={<Badge bg="#15803D"><MaterialCommunityIcons name="account-group" size={22} color="#FFFFFF" /></Badge>}
          eyebrow="WALK TO" title={plan.area.name} />
        <View style={s.stats}>
          <Stat value={metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`} label="DISTANCE" />
          <Stat value={`${minutes} min`} label="WALKING" />
        </View>
        {routeWarning
          ? <Tip tone="warn" icon="alert-outline">{liveStatus}</Tip>
          : <Tip tone="safety" icon="alert-outline">{TIPS[emergencyMode].walking}</Tip>}
      </>
    );
  }

  return (
    <View style={s.sheet} accessibilityLiveRegion="polite">
      <View style={s.grab} />
      {body}
      <View style={s.footer}>
        <Pressable style={{ flex: 1 }} onLongPress={onToggleGpsTest} delayLongPress={600} accessibilityHint="Long-press for the GPS test panel">
          <Text style={s.footerText} numberOfLines={1}>{outsideCampus ? 'Outside campus' : plan ? `${gpsText} · updates as you walk` : gpsText}</Text>
        </Pressable>
        <Pressable onPress={onChangeEmergency} accessibilityRole="button" hitSlop={10}>
          <Text style={s.link}>Change emergency</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Badge({ bg, children }: { bg: string; children: React.ReactNode }) {
  return <View style={[s.badge, { backgroundColor: bg }]}>{children}</View>;
}
function Head({ icon, eyebrow, title }: { icon: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <View style={s.head}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      </View>
    </View>
  );
}
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}
const TONES = {
  info: { bg: '#EFF6FF', fg: '#1E3A8A' },
  warn: { bg: '#FFF7ED', fg: '#9A3412' },
  safety: { bg: '#FFFBEB', fg: '#78350F' },
  ok: { bg: '#ECFDF5', fg: '#065F46' },
} as const;
function Tip({ tone, icon, children }: { tone: keyof typeof TONES; icon: string; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <View style={[s.tip, { backgroundColor: t.bg }]}>
      <MaterialCommunityIcons name={icon as any} size={16} color={t.fg} style={{ marginTop: 1 }} />
      <Text style={[s.tipText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    elevation: 12, shadowColor: '#0F172A', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: -3 },
  },
  grab: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  badge: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: '#64748B' },
  title: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 1 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 11 },
  statValue: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, color: '#64748B', marginTop: 1 },
  tip: { flexDirection: 'row', gap: 8, marginTop: 10, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  primary: {
    marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#2563EB',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footerText: { flex: 1, fontSize: 10.5, fontWeight: '700', color: '#64748B' },
  link: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
});
