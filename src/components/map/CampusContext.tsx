
import React from 'react';

import OuterCampusSVG from '../../../assets/maps/ust-context-gps-light.svg';
import styles from '../../styles/map/CampusContext.styles';

type CampusContextProps = {
  mapSize: number;
};

const CAMPUS_SIZE = 800;
const OUTER_SIZE = 1200;

export default function CampusContext({
  mapSize,
}: CampusContextProps) {
  const scale = mapSize / CAMPUS_SIZE;
  const contextSize = OUTER_SIZE * scale;
  const offset = ((OUTER_SIZE - CAMPUS_SIZE) / 2) * scale;

  return (
    <OuterCampusSVG
      width={contextSize}
      height={contextSize}
      pointerEvents="none"
      style={[
        styles.context,
        { left: -offset, top: -offset },
      ]}
    />
  );
}
