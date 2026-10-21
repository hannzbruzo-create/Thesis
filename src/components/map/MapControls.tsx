import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import styles from '../../styles/ui/ClassicUI.styles';

type Props = {
  zoom: number;
  tilted: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFitCampus: () => void;
  onToggleTilt: () => void;
};

/** Compact, fixed-position control stack copied from the old home screen. */
export default function MapControls({ zoom, tilted, onZoomIn, onZoomOut, onReset, onFitCampus, onToggleTilt }: Props) {
  return (
    <View style={[styles.mapControls, { bottom: 215 }]}>
      <Pressable style={styles.controlButton} onPress={onZoomIn} accessibilityRole="button" accessibilityLabel="Zoom in">
        <MaterialCommunityIcons name="plus" size={21} color="#334155" />
      </Pressable>
      <View style={styles.controlDivider} />
      <View style={styles.zoomIndicator}><Text style={styles.zoomIndicatorText}>{zoom.toFixed(1)}×</Text></View>
      <View style={styles.controlDivider} />
      <Pressable style={styles.controlButton} onPress={onZoomOut} accessibilityRole="button" accessibilityLabel="Zoom out">
        <MaterialCommunityIcons name="minus" size={21} color="#334155" />
      </Pressable>
      <View style={styles.controlDivider} />
      <Pressable style={styles.controlButton} onPress={onReset} accessibilityRole="button" accessibilityLabel="Reset view">
        <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#2563EB" />
      </Pressable>
      <View style={styles.controlDivider} />
      <Pressable style={styles.controlButton} onPress={onToggleTilt} accessibilityRole="button" accessibilityLabel={tilted ? 'Switch to 2D' : 'Switch to 2.5D'}>
        <Text style={{ color: tilted ? '#2563EB' : '#334155', fontSize: 13, fontWeight: '700' }}>{tilted ? '2D' : '3D'}</Text>
      </Pressable>
      <View style={styles.controlDivider} />
      <Pressable style={styles.controlButton} onPress={onFitCampus} accessibilityRole="button" accessibilityLabel="Fit campus to screen">
        <MaterialCommunityIcons name="fit-to-screen-outline" size={20} color="#334155" />
      </Pressable>
    </View>
  );
}
