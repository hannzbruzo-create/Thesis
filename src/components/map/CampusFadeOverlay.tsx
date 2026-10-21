import React from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import styles from '../../styles/map/CampusFadeOverlay.styles';

/** Restores the light edge fade from the original project. */
export default function CampusFadeOverlay({ mapSize }: { mapSize: number }) {
  return (
    <Svg width={mapSize} height={mapSize} viewBox="0 0 100 100" pointerEvents="none" style={styles.overlay}>
      <Defs>
        <LinearGradient id="edgeLeft" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F8FAFC" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#F8FAFC" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="edgeRight" x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor="#F8FAFC" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#F8FAFC" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="edgeTop" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F8FAFC" stopOpacity={0.7} />
          <Stop offset="1" stopColor="#F8FAFC" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="edgeBottom" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#F8FAFC" stopOpacity={0.7} />
          <Stop offset="1" stopColor="#F8FAFC" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={4} height={100} fill="url(#edgeLeft)" />
      <Rect x={94} y={0} width={6} height={100} fill="url(#edgeRight)" />
      <Rect x={0} y={0} width={100} height={6} fill="url(#edgeTop)" />
      <Rect x={0} y={94} width={100} height={6} fill="url(#edgeBottom)" />
    </Svg>
  );
}
