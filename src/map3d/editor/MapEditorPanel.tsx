import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useModelStore } from '../ModelStore';
import { exportCampusModel } from './exportModel';
import type { CampusTheme, RoofStyle } from '../modelTypes';
import { DEFAULT_FLOOR_HEIGHT, DEFAULT_ROOF_PITCH } from '../modelTypes';

const SWATCHES = ['#F3ECE3', '#FFFFFF', '#E8E1D6', '#D9D4CC', '#C9CED3', '#9AA5B1', '#E2845E', '#C8553D',
  '#B5523B', '#8E3B2F', '#F1C7A6', '#D9A066', '#7A8B6F', '#4F6D7A', '#2F4858', '#3B2F2A'];
const HEX = /^#[0-9A-Fa-f]{6}$/;

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <View style={s.block}>
      <View style={s.rowBetween}>
        <Text style={s.label}>{label}</Text>
        <View style={s.hexBox}>
          <View style={[s.hexDot, { backgroundColor: HEX.test(text) ? text : value }]} />
          <TextInput
            value={text}
            onChangeText={t => { setText(t); if (HEX.test(t)) onChange(t.toUpperCase()); }}
            autoCapitalize="characters" autoCorrect={false} maxLength={7} style={s.hexInput}
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatches}>
        {SWATCHES.map(c => (
          <Pressable key={c} onPress={() => onChange(c)} accessibilityLabel={`Colour ${c}`}
            style={[s.swatch, { backgroundColor: c }, value.toUpperCase() === c && s.swatchActive]} />
        ))}
      </ScrollView>
    </View>
  );
}

function Stepper({ label, value, display, onChange, step = 1, min = 0, max = 99 }: {
  label: string; value: number; display?: string; onChange: (v: number) => void; step?: number; min?: number; max?: number;
}) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 100) / 100);
  return (
    <View style={[s.rowBetween, s.block]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stepper}>
        <Pressable style={s.stepButton} onPress={() => set(value - step)} accessibilityLabel={`Decrease ${label}`}>
          <MaterialCommunityIcons name="minus" size={16} color="#1E293B" />
        </Pressable>
        <Text style={s.stepValue}>{display ?? value}</Text>
        <Pressable style={s.stepButton} onPress={() => set(value + step)} accessibilityLabel={`Increase ${label}`}>
          <MaterialCommunityIcons name="plus" size={16} color="#1E293B" />
        </Pressable>
      </View>
    </View>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segmented}>
      {options.map(o => (
        <Pressable key={o} onPress={() => onChange(o)} style={[s.segment, value === o && s.segmentActive]}>
          <Text style={[s.segmentText, value === o && s.segmentTextActive]}>{o.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const THEME_COLOURS: { key: keyof CampusTheme; label: string }[] = [
  { key: 'sky', label: 'Sky / background' }, { key: 'ground', label: 'Ground (outside campus)' },
  { key: 'grass', label: 'Grass' }, { key: 'field', label: 'Fields & quadrangles' },
  { key: 'road', label: 'Roads' }, { key: 'curb', label: 'Road curbs' },
  { key: 'roadEdge', label: 'Road edge shade' }, { key: 'roadLine', label: 'Road centre lines' },
  { key: 'parking', label: 'Parking' }, { key: 'parkingLine', label: 'Parking lines' },
  { key: 'dirt', label: 'Dirt / sand fields' }, { key: 'court', label: 'Courts' }, { key: 'courtLine', label: 'Court lines' },
  { key: 'apron', label: 'Sidewalk around buildings' },
  { key: 'walkway', label: 'Open walkways' }, { key: 'coveredWalkway', label: 'Covered walkways' },
  { key: 'plaza', label: 'Plazas' }, { key: 'water', label: 'Water' }, { key: 'tree', label: 'Trees' },
  { key: 'labelText', label: 'Label text' },
];

type Props = { shapeMode: boolean; onShapeMode: (on: boolean) => void };

/** Dev-only editor sheet. Opened by long-pressing the TomaSafe header. */
export default function MapEditorPanel({ shapeMode, onShapeMode }: Props) {
  const { model, selectedId, setSelectedId, updateBuilding, updateTheme, setEditorOpen, resetModel, dirty } = useModelStore();
  const [tab, setTab] = useState<'building' | 'theme'>('building');
  const building = model.buildings.find(b => b.id === selectedId) ?? null;
  const pieces = building?.group ? model.buildings.filter(b => b.group === building.group).length : 1;

  const exportFile = async () => {
    const text = exportCampusModel(model);
    console.log('----- campusModel.ts (copy everything below) -----\n' + text);
    try {
      await Share.share({ message: text, title: 'campusModel.ts' });
    } catch {
      Alert.alert('Export', 'Sharing failed. The full file was printed in the Metro terminal instead.');
    }
  };

  const close = () => {
    onShapeMode(false);
    setSelectedId(null);
    setEditorOpen(false);
  };

  return (
    <View style={s.sheet}>
      <View style={s.header}>
        <View style={s.headerTitle}>
          <MaterialCommunityIcons name="pencil-ruler" size={18} color="#2563EB" />
          <Text style={s.title}>Map editor</Text>
          {dirty && <Text style={s.unsaved}>UNSAVED</Text>}
        </View>
        <View style={s.headerActions}>
          <Pressable onPress={() => Alert.alert('Discard all edits?', 'The map goes back to campusModel.ts.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: resetModel },
          ])} style={s.iconButton} accessibilityLabel="Discard edits">
            <MaterialCommunityIcons name="restore" size={19} color="#64748B" />
          </Pressable>
          <Pressable onPress={exportFile} style={s.exportButton} accessibilityLabel="Export campusModel.ts">
            <MaterialCommunityIcons name="export-variant" size={15} color="#FFFFFF" />
            <Text style={s.exportText}>EXPORT</Text>
          </Pressable>
          <Pressable onPress={close} style={s.iconButton} accessibilityLabel="Close editor">
            <MaterialCommunityIcons name="close" size={20} color="#334155" />
          </Pressable>
        </View>
      </View>

      <Segmented options={['building', 'theme'] as const as ('building' | 'theme')[]} value={tab} onChange={setTab} />

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {tab === 'building' && !building && (
          <View style={s.empty}>
            <MaterialCommunityIcons name="gesture-tap" size={26} color="#94A3B8" />
            <Text style={s.emptyText}>Tap a building on the map to edit it.</Text>
          </View>
        )}
        {tab === 'building' && building && (
          <>
            <View style={s.block}>
              <Text style={s.label}>Name</Text>
              <TextInput value={building.name} onChangeText={name => updateBuilding(building.id, { name })} style={s.textInput} />
              <Text style={s.hint}>{building.id}{pieces > 1 ? ` · ${pieces} pieces edited together` : ''}</Text>
            </View>
            <Stepper label="Floors" value={building.floors} min={1} max={20}
              onChange={floors => updateBuilding(building.id, { floors })} />
            <Stepper label="Floor height" value={building.floorHeight ?? DEFAULT_FLOOR_HEIGHT} step={0.25} min={2.5} max={8}
              display={`${(building.floorHeight ?? DEFAULT_FLOOR_HEIGHT).toFixed(2)} m`}
              onChange={floorHeight => updateBuilding(building.id, { floorHeight })} />
            <View style={s.block}>
              <Text style={[s.label, { marginBottom: 6 }]}>Roof</Text>
              <Segmented options={['flat', 'gable', 'hip', 'pyramid'] as RoofStyle[]} value={building.roof.style}
                onChange={style => updateBuilding(building.id, { roof: { ...building.roof, style } })} />
            </View>
            {building.roof.style !== 'flat' && (
              <>
                <Stepper label="Roof pitch" value={building.roof.pitch ?? DEFAULT_ROOF_PITCH} step={5} min={5} max={60}
                  display={`${building.roof.pitch ?? DEFAULT_ROOF_PITCH}°`}
                  onChange={pitch => updateBuilding(building.id, { roof: { ...building.roof, pitch } })} />
                <View style={[s.rowBetween, s.block]}>
                  <Text style={s.label}>Ridge direction</Text>
                  <View style={s.stepper}>
                    <Pressable style={s.chip} onPress={() => updateBuilding(building.id, {
                      roof: { ...building.roof, ridgeAngle: ((building.roof.ridgeAngle ?? 0) + 15) % 180 },
                    })}>
                      <Text style={s.chipText}>{building.roof.ridgeAngle == null ? 'AUTO' : `${building.roof.ridgeAngle}°`} ↻</Text>
                    </Pressable>
                    {building.roof.ridgeAngle != null && (
                      <Pressable style={s.chip} onPress={() => updateBuilding(building.id, {
                        roof: { style: building.roof.style, pitch: building.roof.pitch },
                      })}>
                        <Text style={s.chipText}>AUTO</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </>
            )}
            <ColorRow label="Wall colour" value={building.wallColor} onChange={wallColor => updateBuilding(building.id, { wallColor })} />
            <ColorRow label="Roof colour" value={building.roofColor} onChange={roofColor => updateBuilding(building.id, { roofColor })} />
            <Pressable onPress={() => onShapeMode(!shapeMode)} style={[s.shapeButton, shapeMode && s.shapeButtonActive]}>
              <MaterialCommunityIcons name="vector-polygon" size={17} color={shapeMode ? '#FFFFFF' : '#2563EB'} />
              <Text style={[s.shapeText, shapeMode && { color: '#FFFFFF' }]}>
                {shapeMode ? 'DONE EDITING SHAPE' : 'EDIT SHAPE (this piece)'}
              </Text>
            </Pressable>
            {shapeMode && (
              <Text style={s.hint}>Drag a corner to move it · tap a small dot to add a corner · long-press a corner to delete it.</Text>
            )}
          </>
        )}
        {tab === 'theme' && (
          <>
            {THEME_COLOURS.map(({ key, label }) => (
              <ColorRow key={key} label={label} value={String(model.theme[key])}
                onChange={hex => updateTheme({ [key]: hex } as Partial<CampusTheme>)} />
            ))}
            <Stepper label="Light direction" value={model.theme.sunAzimuth} step={15} min={0} max={345}
              display={`${model.theme.sunAzimuth}°`} onChange={sunAzimuth => updateTheme({ sunAzimuth })} />
            <Stepper label="Light height" value={model.theme.sunElevation} step={5} min={15} max={85}
              display={`${model.theme.sunElevation}°`} onChange={sunElevation => updateTheme({ sunElevation })} />
            <Stepper label="Light contrast" value={model.theme.lightContrast} step={0.05} min={0} max={0.8}
              display={model.theme.lightContrast.toFixed(2)} onChange={lightContrast => updateTheme({ lightContrast })} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 10, right: 10, bottom: 10, maxHeight: '52%',
    backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0',
    padding: 12, elevation: 12, zIndex: 50,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  unsaved: { fontSize: 8, fontWeight: '900', color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  exportButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#2563EB', paddingHorizontal: 11, height: 34, borderRadius: 10 },
  exportText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  body: { marginTop: 10 },
  block: { marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '800', color: '#334155' },
  hint: { fontSize: 10, color: '#64748B', marginTop: 4 },
  textInput: { marginTop: 5, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: '#0F172A' },
  hexBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, paddingLeft: 7 },
  hexDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  hexInput: { width: 82, paddingHorizontal: 6, paddingVertical: 4, fontSize: 12, fontWeight: '700', color: '#0F172A' },
  swatches: { gap: 7, paddingTop: 7 },
  swatch: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  swatchActive: { borderWidth: 3, borderColor: '#2563EB' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 54, textAlign: 'center', fontSize: 13, fontWeight: '800', color: '#0F172A' },
  segmented: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#FFFFFF', elevation: 2 },
  segmentText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  segmentTextActive: { color: '#2563EB' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  shapeButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, borderRadius: 11,
    borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF',
  },
  shapeButtonActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  shapeText: { fontSize: 11, fontWeight: '900', color: '#2563EB' },
  empty: { alignItems: 'center', paddingVertical: 22, gap: 6 },
  emptyText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
});
