import React, { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CampusBuilding, CampusTheme } from '../modelTypes';
import { buildBuilding, flatPolygon, mergeAll, offsetPolygon, ribbon, type BuildingGeometry } from '../geometry';
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

/**
 * Geometry per building object, built once. Edits replace the building object (the store is
 * immutable), so a changed building gets fresh geometry and unchanged ones are reused.
 */
const geometryCache = new WeakMap<CampusBuilding, BuildingGeometry | null>();
function geometryOf(b: CampusBuilding) {
  if (!geometryCache.has(b)) geometryCache.set(b, buildBuilding(b));
  return geometryCache.get(b)!;
}

/** Copy of a mesh part with the building colour baked into vertex colours, raised by `lift`. */
function tinted(g: THREE.BufferGeometry, color: THREE.Color, lift: number) {
  const out = (g.index ? g.toNonIndexed() : g.clone()).translate(0, lift, 0);
  const count = out.getAttribute('position').count;
  const base = out.getAttribute('color');
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = (base ? base.getX(i) : 1) * color.r;
    colors[i * 3 + 1] = (base ? base.getY(i) : 1) * color.g;
    colors[i * 3 + 2] = (base ? base.getZ(i) : 1) * color.b;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (!out.getAttribute('uv')) out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  return out;
}

/**
 * Every building that is not selected, merged into one mesh per wall texture plus one for roofs,
 * floors and outlines: a handful of draw calls instead of three or four per building, which is
 * what kept phones from drawing the map smoothly.
 */
function MergedBuildings({ buildings }: { buildings: { b: CampusBuilding; lift: number }[] }) {
  const merged = useMemo(() => {
    const walls = new Map<string, { map: THREE.Texture | null; parts: THREE.BufferGeometry[] }>();
    const roofs: THREE.BufferGeometry[] = [], floors: THREE.BufferGeometry[] = [], upper: THREE.BufferGeometry[] = [], lines: THREE.BufferGeometry[] = [];
    const floorPart = (g: THREE.BufferGeometry, lift: number) => {
      const f = (g.index ? g.toNonIndexed() : g.clone()).translate(0, lift, 0);
      if (!f.getAttribute('normal')) f.computeVertexNormals();
      return f;
    };
    for (const { b, lift } of buildings) {
      const g = geometryOf(b);
      if (!g) continue;
      const key = b.facade ?? 'windows';
      if (!walls.has(key)) walls.set(key, { map: facadeMap(b), parts: [] });
      walls.get(key)!.parts.push(tinted(g.walls, new THREE.Color(b.wallColor), lift));
      roofs.push(tinted(g.roof, new THREE.Color(b.roofColor), lift));
      if (g.floor) floors.push(floorPart(g.floor, lift));
      if (g.upperFloors) upper.push(floorPart(g.upperFloors, lift));
      lines.push(g.outline.clone().translate(0, lift, 0));
    }
    const done = (list: THREE.BufferGeometry[]) => { const m = mergeAll(list); list.forEach(p => p.dispose()); return m; };
    return {
      walls: [...walls.entries()].map(([key, w]) => ({ key, map: w.map, geometry: done(w.parts) })),
      roof: done(roofs), floor: done(floors), upperFloors: done(upper), outline: done(lines),
    };
  }, [buildings]);
  useEffect(() => () => {
    merged.walls.forEach(w => w.geometry?.dispose()); merged.roof?.dispose(); merged.floor?.dispose(); merged.upperFloors?.dispose(); merged.outline?.dispose();
  }, [merged]);
  const tex = groundTextures();
  return (
    <group>
      {merged.walls.map(w => w.geometry && (
        <mesh key={w.key} geometry={w.geometry}><meshLambertMaterial map={w.map} vertexColors /></mesh>
      ))}
      {merged.roof && <mesh geometry={merged.roof}><meshLambertMaterial map={tex.roof} vertexColors /></mesh>}
      {/* Ground-level floors draw before the route (LAYER.raised) so the route lies on top of them. */}
      {merged.floor && <mesh geometry={merged.floor} renderOrder={LAYER.raised}><meshLambertMaterial map={tex.tile} /></mesh>}
      {merged.upperFloors && <mesh geometry={merged.upperFloors}><meshLambertMaterial map={tex.tile} /></mesh>}
      {merged.outline && (
        <lineSegments geometry={merged.outline}><lineBasicMaterial color={OUTLINE} transparent opacity={0.2} /></lineSegments>
      )}
    </group>
  );
}

/** The selected building, drawn on its own so it can be highlighted. */
const Building = memo(function Building({ building, selected, lift }: { building: CampusBuilding; selected: boolean; lift: number }) {
  const geometry = geometryOf(building);
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
      {geometry.floor && (
        <mesh geometry={geometry.floor} renderOrder={LAYER.raised}>
          <meshLambertMaterial map={groundTextures().tile} />
        </mesh>
      )}
      {geometry.upperFloors && (
        <mesh geometry={geometry.upperFloors}>
          <meshLambertMaterial map={groundTextures().tile} />
        </mesh>
      )}
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
  const selectedKey = selected ? (selected.group ?? selected.id) : null;
  // A tiny per-building lift stops overlapping roof pieces of equal height from flickering.
  const { rest, picked } = useMemo(() => {
    const all = buildings.map((b, i) => ({ b, lift: (i % 9) * 0.05 }));
    const isPicked = ({ b }: { b: CampusBuilding }) => !!selectedKey && (b.id === selectedKey || b.group === selectedKey);
    return { rest: all.filter(x => !isPicked(x)), picked: all.filter(isPicked) };
  }, [buildings, selectedKey]);
  return (
    <group>
      <BuildingBases buildings={buildings} theme={theme} />
      <MergedBuildings buildings={rest} />
      {picked.map(({ b, lift }) => <Building key={b.id} building={b} selected lift={lift} />)}
    </group>
  );
}
