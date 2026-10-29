import React from 'react';
import type { CampusTheme } from '../modelTypes';

/**
 * Soft sky light plus one directional light. No cast shadows: they looked
 * wrong when rotating; walls still get gentle light/shade from the direction.
 */
export default function Lighting({ theme }: { theme: CampusTheme }) {
  const az = (theme.sunAzimuth * Math.PI) / 180;
  const el = (theme.sunElevation * Math.PI) / 180;
  const position: [number, number, number] = [
    Math.sin(az) * Math.cos(el) * 900,
    Math.sin(el) * 900,
    -Math.cos(az) * Math.cos(el) * 900,
  ];
  const contrast = Math.min(0.8, Math.max(0, theme.lightContrast));
  return (
    <>
      <hemisphereLight args={[theme.sky, theme.ground, 2.2 - contrast * 1.3]} />
      <directionalLight position={position} intensity={0.9 + contrast * 2.4} />
    </>
  );
}
