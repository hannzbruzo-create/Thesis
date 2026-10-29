import React, { useEffect, useMemo } from 'react';
import type { CampusEmblem } from '../modelTypes';
import { emblemParts } from '../geometry';

/** Round seals mounted on building walls (e.g. the one over St. Dominic's stage). */
export default function Emblems({ emblems }: { emblems: CampusEmblem[] }) {
  const parts = useMemo(() => emblems.flatMap(emblemParts), [emblems]);
  useEffect(() => () => parts.forEach(p => p.geometry.dispose()), [parts]);
  return (
    <group>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry}>
          <meshLambertMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
}
