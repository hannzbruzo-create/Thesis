import React from 'react';
import BuildingDepthSVG from '../../../assets/maps/ust-building-depth-25d.svg';
import styles from '../../styles/map/Building3D.styles';

/** Always mounted; the old camera animates the layer opacity as tilt changes. */
export default function Building3D({ mapSize }: { mapSize: number }) {
  return <BuildingDepthSVG width={mapSize} height={mapSize} pointerEvents="none" style={styles.overlay} />;
}
