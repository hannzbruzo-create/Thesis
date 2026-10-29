import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CampusModel, XY } from '../modelTypes';
import { courtMarkings, dashedLine, flatPolygon, mergeAll, parkingStripes, ribbon } from '../geometry';
import { MAP_CENTER } from '../cameraMath';
import { groundTextures } from './textures';

/**
 * Flat ground layers. They are drawn in a fixed order (renderOrder) without
 * writing depth, so overlapping shapes never flicker; buildings draw after.
 */
export const LAYER = {
  ground: -40, lawn: -39, field: -38, area: -36, parkingLine: -35, walkway: -34,
  apron: -33, contact: -32, roadEdge: -31, curb: -30, road: -29, roadLine: -28,
  routeCasing: -14, route: -13,
} as const;

function useDisposable<T extends THREE.BufferGeometry | null>(factory: () => T, deps: unknown[]): T {
  const geometry = useMemo(factory, deps);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

type LayerProps = {
  geometry: THREE.BufferGeometry | null; color: string; order: number;
  opacity?: number; map?: THREE.Texture; y?: number;
};

export function FlatLayer({ geometry, color, order, opacity = 1, map, y = 0 }: LayerProps) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} renderOrder={order} position={[0, y, 0]}>
      <meshLambertMaterial color={color} map={map ?? null} depthWrite={false}
        transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

const closed = (p: XY[]) => [...p, p[0]];

/** Trunk height below the crown, map units (~2 m). */
const TREE_TRUNK = 2 / 0.48;

export default function Ground({ model }: { model: CampusModel }) {
  const { theme, areas, roads, walkways, trees } = model;
  const tex = groundTextures();

  const groundPlane = useDisposable(() => flatPolygon([[-2600, -2600], [3400, -2600], [3400, 3400], [-2600, 3400]], -0.05), []);
  const campusLawn = useDisposable(() => flatPolygon([[0, 0], [800, 0], [800, 800], [0, 800]], 0.01), []);
  const byKind = (kind: string, y = 0.02) => mergeAll(areas.filter(a => a.kind === kind).map(a => flatPolygon(a.polygon, y)));
  const grass = useDisposable(() => byKind('grass'), [areas]);
  const water = useDisposable(() => byKind('water'), [areas]);
  const plazas = useDisposable(() => byKind('plaza'), [areas]);
  const parking = useDisposable(() => byKind('parking', 0.06), [areas]);
  const parkingCurbs = useDisposable(() => mergeAll(areas.filter(a => a.kind === 'parking').map(a => ribbon(closed(a.polygon), 1.3, 0.07))), [areas]);
  const parkingLines = useDisposable(() => mergeAll(areas.filter(a => a.kind === 'parking').map(a => parkingStripes(a.polygon, 0.08))), [areas]);

  const fields = useDisposable(() => byKind('field', 0.03), [areas]);
  const dirt = useDisposable(() => byKind('dirt', 0.03), [areas]);
  const courts = useDisposable(() => byKind('court', 0.04), [areas]);
  const courtLines = useDisposable(() => mergeAll(areas.filter(a => a.kind === 'court').map(a => courtMarkings(a.polygon, 0.05))), [areas]);

  const openWalks = useDisposable(() => mergeAll(walkways.filter(w => !w.covered).map(w => ribbon(w.points, w.width, 0.03))), [walkways]);
  const coveredWalks = useDisposable(() => mergeAll(walkways.filter(w => w.covered).map(w => ribbon(w.points, w.width, 0.03))), [walkways]);

  const roadEdges = useDisposable(() => mergeAll(roads.map(r => ribbon(r.points, r.width + 3.6, 0.04))), [roads]);
  const roadCurbs = useDisposable(() => mergeAll(roads.map(r => ribbon(r.points, r.width + 1.7, 0.05))), [roads]);
  const roadSurface = useDisposable(() => mergeAll(roads.map(r => ribbon(r.points, r.width, 0.06))), [roads]);
  const roadLines = useDisposable(() => mergeAll(roads.filter(r => r.width >= 8).map(r => dashedLine(r.points, 0.45, 0.07))), [roads]);

  const treeGeometry = useDisposable(() => new THREE.IcosahedronGeometry(1, 1), []);
  const trunkGeometry = useDisposable(() => new THREE.CylinderGeometry(0.5, 0.65, 1, 6).translate(0, 0.5, 0), []);
  const treeMesh = useMemo(() => {
    if (!trees.length || !treeGeometry || !trunkGeometry) return null;
    const crowns = new THREE.InstancedMesh(treeGeometry, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), trees.length);
    const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshLambertMaterial({ color: '#7A5A3C' }), trees.length);
    const m = new THREE.Matrix4(), base = new THREE.Color(theme.tree), c = new THREE.Color();
    trees.forEach((t, i) => {
      const trunk = TREE_TRUNK + t.r * 0.35;
      m.makeScale(t.r, t.r * 0.85, t.r);
      m.setPosition(t.x - MAP_CENTER, trunk + t.r * 0.6, t.y - MAP_CENTER);
      crowns.setMatrixAt(i, m);
      // Small, stable per-tree shade change (lighter/darker greens).
      const k = 0.86 + ((Math.sin(t.x * 12.9898 + t.y * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.28;
      crowns.setColorAt(i, c.copy(base).multiplyScalar(k));
      m.makeScale(Math.max(0.5, t.r * 0.14), trunk + t.r * 0.3, Math.max(0.5, t.r * 0.14));
      m.setPosition(t.x - MAP_CENTER, 0, t.y - MAP_CENTER);
      trunks.setMatrixAt(i, m);
    });
    const group = new THREE.Group();
    group.add(trunks, crowns);
    return group;
  }, [trees, treeGeometry, trunkGeometry, theme.tree]);

  return (
    <group>
      <FlatLayer geometry={groundPlane} color={theme.ground} order={LAYER.ground} map={tex.land} />
      <FlatLayer geometry={campusLawn} color={theme.grass} order={LAYER.lawn} map={tex.grass} />
      <FlatLayer geometry={grass} color={theme.grass} order={LAYER.lawn} map={tex.grass} />
      <FlatLayer geometry={fields} color={theme.field} order={LAYER.field} map={tex.field} />
      <FlatLayer geometry={dirt} color={theme.dirt} order={LAYER.field} map={tex.grass} />
      <FlatLayer geometry={plazas} color={theme.plaza} order={LAYER.area} map={tex.asphalt} />
      <FlatLayer geometry={water} color={theme.water} order={LAYER.area} />
      <FlatLayer geometry={parkingCurbs} color={theme.curb} order={LAYER.area} />
      <FlatLayer geometry={parking} color={theme.parking} order={LAYER.area} map={tex.asphalt} />
      <FlatLayer geometry={courts} color={theme.court} order={LAYER.area} map={tex.asphalt} />
      <FlatLayer geometry={courtLines} color={theme.courtLine} order={LAYER.parkingLine} opacity={0.9} />
      <FlatLayer geometry={parkingLines} color={theme.parkingLine} order={LAYER.parkingLine} opacity={0.9} />
      <FlatLayer geometry={openWalks} color={theme.walkway} order={LAYER.walkway} map={tex.asphalt} />
      <FlatLayer geometry={coveredWalks} color={theme.walkway} order={LAYER.walkway} map={tex.asphalt} />
      <FlatLayer geometry={roadEdges} color={theme.roadEdge} order={LAYER.roadEdge} />
      <FlatLayer geometry={roadCurbs} color={theme.curb} order={LAYER.curb} />
      <FlatLayer geometry={roadSurface} color={theme.road} order={LAYER.road} map={tex.asphalt} />
      <FlatLayer geometry={roadLines} color={theme.roadLine} order={LAYER.roadLine} opacity={0.95} />
      {treeMesh && <primitive object={treeMesh} />}
    </group>
  );
}
