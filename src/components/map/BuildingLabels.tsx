import React from 'react';
import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BUILDING_LABELS } from '../../data/buildingLabels';
import styles from '../../styles/map/BuildingLabels.styles';

/** Restored original labels: no counter-tilt, original icon offsets and scaling. */
export default function BuildingLabels({ mapSize, zoomLevel = 1 }: { mapSize: number; zoomLevel?: number }) {
  if (zoomLevel < 0.45) return null;
  const showText = zoomLevel >= 0.7;
  const safeZoom = Math.max(zoomLevel, 0.7);
  return (
    <View pointerEvents="none" style={[styles.layer, { width: mapSize, height: mapSize }]}>
      {BUILDING_LABELS.map(building => (
        <View key={building.id} pointerEvents="none" style={[styles.position, {
          left: (building.x / 100) * mapSize, top: (building.y / 100) * mapSize,
        }]}>
          <View style={[styles.labelWrapper, { transform: [{ scale: 1 / safeZoom }] }]}>
            <View style={styles.iconContainer}><Ionicons name="business" size={11} color="#FFFFFF" /></View>
            {showText && <Text numberOfLines={1} style={styles.text}>{building.name}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}
