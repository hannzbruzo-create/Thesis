import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber/native';
import type { PreviewPlan } from '../../navigation/routePreview';
import { buildContinuousRoute } from '../../navigation/routeDisplay';
import type { Point } from '../../navigation/walkableGraph';
import { mergeAll, ribbon } from '../geometry';
import { MAP_CENTER } from '../cameraMath';
import { LAYER } from './Ground';

const ROUTE_WIDTH = 4.2;
const STEP = 2; // resample spacing, map units, so the reveal animation is smooth

/** Route as many short ribbon pieces in path order; drawRange reveals it progressively. */
function routeGeometry(points: Point[], width: number, y: number) {
  const pieces: (THREE.BufferGeometry | null)[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / STEP));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps, t1 = (s + 1) / steps;
      pieces.push(ribbon([
        [a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0],
        [a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1],
      ], width, y));
    }
  }
  return mergeAll(pieces);
}

function RouteLine({ plan, animate }: { plan: PreviewPlan; animate: boolean }) {
  const points = useMemo(() => buildContinuousRoute(plan.route).points, [plan]);
  const casing = useMemo(() => routeGeometry(points, ROUTE_WIDTH + 2.4, 0.3), [points]);
  const line = useMemo(() => routeGeometry(points, ROUTE_WIDTH, 0.35), [points]);
  useEffect(() => () => { casing?.dispose(); line?.dispose(); }, [casing, line]);
  const started = useRef<number | null>(null);
  const length = useMemo(() => points.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0, 0), [points]);

  useEffect(() => { started.current = animate ? null : -1; }, [plan, animate]);

  useFrame(({ clock }) => {
    if (!casing || !line) return;
    let progress = 1;
    if (started.current !== -1) {
      if (started.current === null) started.current = clock.elapsedTime;
      const duration = Math.max(1.4, Math.min(2.3, length * 0.0034));
      const t = Math.min(1, (clock.elapsedTime - started.current) / duration);
      progress = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
    }
    for (const g of [casing, line]) {
      const total = g.getAttribute('position').count;
      g.setDrawRange(0, Math.floor((total * progress) / 3) * 3);
    }
  });

  if (!casing || !line) return null;
  return (
    <group>
      <mesh geometry={casing} renderOrder={LAYER.routeCasing}>
        <meshBasicMaterial color="#FFFFFF" depthWrite={false} />
      </mesh>
      <mesh geometry={line} renderOrder={LAYER.route}>
        <meshBasicMaterial color="#2563EB" depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Ground pad at the goal (the middle of the evacuation area): a solid green disc with a slowly
 * pulsing ring. The upright pin with the assembly-point icon is drawn on top by GoalMarker.
 */
function DestinationPad({ point }: { point: Point }) {
  const pulse = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const t = (clock.elapsedTime % 2.2) / 2.2;
    pulse.current.scale.setScalar(1 + t * 1.8);
    (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t);
  });
  const onGround = { transparent: true, depthWrite: false } as const;
  return (
    <group position={[point.x - MAP_CENTER, 0.3, point.y - MAP_CENTER]}>
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} renderOrder={LAYER.route}>
        <ringGeometry args={[5.5, 7, 40]} />
        <meshBasicMaterial color="#16A34A" opacity={0.45} {...onGround} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={LAYER.route}>
        <circleGeometry args={[5, 40]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.95} {...onGround} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={LAYER.route}>
        <circleGeometry args={[3.6, 40]} />
        <meshBasicMaterial color="#16A34A" {...onGround} />
      </mesh>
    </group>
  );
}

// Simple person marker (map units): a rounded body and a head, drawn larger than life so it
// reads at the follow zoom. Dark blue so it stands out from the brighter route line.
const PERSON = '#1E3A8A';
const BODY_RADIUS = 1.35, BODY_LENGTH = 2.9, BODY_Y = 2.8;
const HEAD_RADIUS = 1.2, HEAD_Y = 6.85;
const OUTLINE = 1.2; // white edge: back faces of a slightly larger copy

/** Heading arrow on the ground, in front of the feet; points toward +Y in its own plane. */
function arrowShape(scale: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 8.6 * scale); s.lineTo(2.4 * scale, 5.8 * scale); s.lineTo(0, 6.7 * scale); s.lineTo(-2.4 * scale, 5.8 * scale);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/**
 * The user: a simple 3D person standing on a white ring, with a ground arrow for the heading and
 * a soft disc for GPS accuracy. Always drawn on top so buildings never hide it.
 */
function UserMarker({ point, heading, accuracyM }: { point: Point; heading: number | null; accuracyM: number | null }) {
  const pulse = useRef<THREE.Mesh>(null);
  const arrow = useMemo(() => arrowShape(1), []);
  const arrowEdge = useMemo(() => {
    const g = arrowShape(1.25);
    g.translate(0, -1.6, 0); // keep the larger copy centred on the arrow
    return g;
  }, []);
  useEffect(() => () => { arrow.dispose(); arrowEdge.dispose(); }, [arrow, arrowEdge]);
  // The marker glides to each new position instead of jumping (GPS updates about once a second).
  const dot = useRef<THREE.Group>(null);
  const placed = useRef(false);
  useFrame(({ clock }, delta) => {
    const g = dot.current;
    if (g) {
      const tx = point.x - MAP_CENTER, tz = point.y - MAP_CENTER;
      const far = Math.hypot(g.position.x - tx, g.position.z - tz) > 60; // big jumps (reroute, first fix) snap
      if (!placed.current || far) { g.position.set(tx, 0.6, tz); placed.current = true; }
      else {
        // Same pace as the follow camera glide, so the marker stays steady on screen.
        const k = 1 - Math.exp(-Math.min(delta, 0.1) * 3.5);
        g.position.x += (tx - g.position.x) * k;
        g.position.z += (tz - g.position.z) * k;
      }
    }
    if (!pulse.current) return;
    const t = (clock.elapsedTime % 1.8) / 1.8;
    pulse.current.scale.setScalar(1 + t * 1.6);
    (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
  });
  const onTop = { depthTest: false, depthWrite: false, transparent: true } as const;
  return (
    <group ref={dot}>
      {/* GPS uncertainty: you are probably somewhere inside this ring. */}
      {accuracyM != null && accuracyM > 3 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
          <circleGeometry args={[accuracyM / 0.48, 48]} />
          <meshBasicMaterial color="#3B82F6" opacity={0.12} {...onTop} />
        </mesh>
      )}
      {/* Ground ring the person stands on, with a slow pulse. */}
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
        <ringGeometry args={[3.8, 4.7, 40]} />
        <meshBasicMaterial color="#3B82F6" opacity={0.3} {...onTop} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={21}>
        <ringGeometry args={[2.9, 3.8, 40]} />
        <meshBasicMaterial color="#2563EB" opacity={0.3} {...onTop} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={22}>
        <ringGeometry args={[3.8, 4.7, 40]} />
        <meshBasicMaterial color="#FFFFFF" opacity={0.95} {...onTop} />
      </mesh>
      {heading != null && (
        // Shape points toward +Y in its own plane; after laying flat that is map-up, then rotate by heading.
        <group rotation={[-Math.PI / 2, 0, -(heading * Math.PI) / 180]}>
          <mesh geometry={arrowEdge} renderOrder={23}>
            <meshBasicMaterial color="#FFFFFF" {...onTop} />
          </mesh>
          <mesh geometry={arrow} renderOrder={24}>
            <meshBasicMaterial color={PERSON} {...onTop} />
          </mesh>
        </group>
      )}
      {/* Contact shadow, white edge, then body and head (drawn in this order, no depth test). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={25} position={[0, 0.02, 0]}>
        <circleGeometry args={[2.3, 24]} />
        <meshBasicMaterial color="#0F172A" opacity={0.25} {...onTop} />
      </mesh>
      <mesh position={[0, BODY_Y, 0]} scale={OUTLINE} renderOrder={26}>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 6, 16]} />
        <meshBasicMaterial color="#FFFFFF" side={THREE.BackSide} {...onTop} />
      </mesh>
      <mesh position={[0, HEAD_Y, 0]} scale={OUTLINE} renderOrder={26}>
        <sphereGeometry args={[HEAD_RADIUS, 18, 14]} />
        <meshBasicMaterial color="#FFFFFF" side={THREE.BackSide} {...onTop} />
      </mesh>
      <mesh position={[0, BODY_Y, 0]} renderOrder={27}>
        <capsuleGeometry args={[BODY_RADIUS, BODY_LENGTH, 6, 16]} />
        <meshLambertMaterial color={PERSON} {...onTop} />
      </mesh>
      <mesh position={[0, HEAD_Y, 0]} renderOrder={28}>
        <sphereGeometry args={[HEAD_RADIUS, 18, 14]} />
        <meshLambertMaterial color={PERSON} {...onTop} />
      </mesh>
    </group>
  );
}

type Props = { plan: PreviewPlan | null; marker: Point | null; heading: number | null; accuracyM?: number | null; animateRoute: boolean };

export default function RouteOverlay({ plan, marker, heading, accuracyM = null, animateRoute }: Props) {
  const end = plan?.route[plan.route.length - 1] ?? null;
  return (
    <group>
      {plan && <RouteLine plan={plan} animate={animateRoute} />}
      {end && <DestinationPad point={end} />}
      {marker && <UserMarker point={marker} heading={heading} accuracyM={accuracyM} />}
    </group>
  );
}
