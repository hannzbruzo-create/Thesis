import React, { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CampusBuilding, CampusTheme } from '../modelTypes';
import { buildBuilding, flatPolygon, mergeAll, offsetPolygon, ribbon } from '../geometry';
import { FlatLayer, LAYER } from './Ground';
import { groundTextures } from './textures';

const OUTLINE = new THREE.Color('#3B2F2A');

/** Wall texture for the building's facade style ('plain' walls only sample the window-free pier). */
export function facadeMap(b: CampusBuilding) {
  const f = groundTextures().facades;
  return f[b.facade ?? 'windows'] ?? f.windows;
}
/** Sidewalk border around each building, map units (~1.4 m). */
const APRON_WIDTH = 3;

/** One building; geometry is rebuilt only when this building's data changes. */
const Building = memo(function Building({ building, selected, lift }: { building: CampusBuilding; selected: boolean; lift: number }) {
  const geometry = useMemo(() => buildBuilding(building), [building.footprint, building.holes, building.roofParts, building.canopy, building.floors, building.level,
    building.floorHeight, building.eave, building.facade, building.parapet, building.postSpacing, building.postSize, building.postColor, building.postBase, building.groundArcade, building.plinth, building.balcony, building.balconyGround, building.roof.style, building.roof.pitch, building.roof.ridgeAngle]);
  useEffect(() => () => {
    geometry?.walls.dispose(); geometry?.roof.dispose(); geometry?.outline.dispose();
  }, [geometry]);
  if (!geometry) return null;
  const highlight = selected ? '#2563EB' : '#000000';
  return (
    <group position={[0, lift, 0]}>
      <mesh geometry={geometry.walls}>
        {/* window bays from the facade texture; vertexColors darken the wall foot and the shade under the eaves */}
        <meshLambertMaterial color={building.wallColor} map={facadeMap(building)} vertexColors emissive={highlight} emissiveIntensity={selected ? 0.35 : 0} />
      </mesh>
      <mesh geometry={geometry.roof}>
        <meshLambertMaterial color={building.roofColor} map={groundTextures().roof} emissive={highlight} emissiveIntensity={selected ? 0.35 : 0} />
      </mesh>
      <lineSegments geometry={geometry.outline}>
        <lineBasicMaterial color={selected ? '#1D4ED8' : OUTLINE} transparent opacity={selected ? 0.9 : 0.2} />
      </lineSegments>
    </group>
  );
});

/**
 * Where buildings meet the ground: a light sidewalk border (apron) with a
 * thin curb line, plus a soft dark band hugging the walls (contact shade).
 */
function BuildingBases({ buildings, theme }: { buildings: CampusBuilding[]; theme: CampusTheme }) {
  // Upper-floor pieces don't touch the ground, so they get no sidewalk.
  const grounded = useMemo(() => buildings.filter(b => !b.level), [buildings]);
  // Courtyard sidewalks run inside each hole.
  const aprons = useMemo(() => mergeAll(grounded.map(b => flatPolygon(offsetPolygon(b.footprint, APRON_WIDTH), 0.09,
    (b.holes ?? []).map(h => offsetPolygon(h, -APRON_WIDTH))))), [grounded]);
  const apronEdges = useMemo(() => mergeAll(grounded.flatMap(b => [offsetPolygon(b.footprint, APRON_WIDTH),
    ...(b.holes ?? []).map(h => offsetPolygon(h, -APRON_WIDTH))].map(o => ribbon([...o, o[0]], 0.7, 0.1)))), [grounded]);
  const contact = useMemo(() => mergeAll(grounded.filter(b => !b.canopy).flatMap(b => [b.footprint, ...(b.holes ?? [])]
    .map(f => ribbon([...f, f[0]], 2.2, 0.11)))), [grounded]);
  useEffect(() => () => { aprons?.dispose(); apronEdges?.dispose(); contact?.dispose(); }, [aprons, apronEdges, contact]);
  // Solid colours (not transparency) so overlapping corner pieces never show darker blotches.
  const edgeColor = useMemo(() => '#' + new THREE.Color(theme.apron).multiplyScalar(0.82).getHexString(), [theme.apron]);
  const contactColor = useMemo(() => '#' + new THREE.Color(theme.apron).multiplyScalar(0.72).getHexString(), [theme.apron]);
  return (
    <group>
      <FlatLayer geometry={aprons} color={theme.apron} order={LAYER.apron} map={groundTextures().asphalt} />
      <FlatLayer geometry={apronEdges} color={edgeColor} order={LAYER.apron} />
      <FlatLayer geometry={contact} color={contactColor} order={LAYER.contact} />
    </group>
  );
}

export default function Buildings({ buildings, selectedId, theme }: {
  buildings: CampusBuilding[]; selectedId: string | null; theme: CampusTheme;
}) {
  const selected = buildings.find(b => b.id === selectedId);
  const isSelected = (b: CampusBuilding) =>
    !!selected && (b.id === selected.id || (!!selected.group && b.group === selected.group));
  return (
    <group>
      <BuildingBases buildings={buildings} theme={theme} />
      {/* A tiny per-building lift stops overlapping roof pieces of equal height from flickering. */}
      {buildings.map((b, i) => <Building key={b.id} building={b} selected={isSelected(b)} lift={(i % 9) * 0.05} />)}
    </group>
  );
}
