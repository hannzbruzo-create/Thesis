import React from 'react';
import { Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import styles from '../../styles/ui/ClassicUI.styles';

/** The old TomaSafe header, with no GPS or notification state attached yet. */
export default function HeaderBar() {
  return (
    <View style={styles.headerWrapper} pointerEvents="box-none">
      <View style={styles.headerCard}>
        <View style={styles.brandContainer}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.brand}>Toma<Text style={styles.brandAccent}>Safe</Text></Text>
            <Text style={styles.subText}>UST–LEGAZPI · RAWIS CAMPUS</Text>
          </View>
        </View>
        <View style={styles.mapBadge}>
          <MaterialCommunityIcons name="map-outline" size={13} color="#2563EB" />
          <Text style={styles.mapBadgeText}>CAMPUS MAP</Text>
        </View>
      </View>
    </View>
  );
}
