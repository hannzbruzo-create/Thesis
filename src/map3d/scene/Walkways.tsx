import React, { memo, useEffect, useMemo } from 'react';
import type { CampusTheme, CampusWalkway } from '../modelTypes';
import { METRES_PER_UNIT } from '../modelTypes';
import { coveredWalkway } from '../geometry';

const COLUMN_COLOR = '#F2EEE6';

/** Roof slab + columns for one covered walkway or building veranda. */
const CoveredWalk = memo(function CoveredWalk({ walk, roofColor }: { walk: CampusWalkway; roofColor: string }) {
  const geometry = useMemo(
    () => coveredWalkway(walk.points, walk.width, (walk.height ?? 3) / METRES_PER_UNIT),
    [walk.points, walk.width, walk.height],
  );
  useEffect(() => () => { geometry?.roof?.dispose(); geometry?.columns?.dispose(); }, [geometry]);
  if (!geometry) return null;
  return (
    <group>
      {geometry.roof && (
        <mesh geometry={geometry.roof}>
          <meshLambertMaterial color={roofColor} />
        </mesh>
      )}
      {geometry.columns && (
        <mesh geometry={geometry.columns}>
          <meshLambertMaterial color={COLUMN_COLOR} />
        </mesh>
      )}
    </group>
  );
});

/** Raised parts of covered walkways; their paving is drawn with the ground layers. */
export default function Walkways({ walkways, theme }: { walkways: CampusWalkway[]; theme: CampusTheme }) {
  return (
    <group>
      {walkways.filter(w => w.covered).map(w => (
        <CoveredWalk key={w.id} walk={w} roofColor={w.roofColor ?? theme.coveredWalkway} />
      ))}
    </group>
  );
}
