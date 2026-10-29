import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber/native';
import type { CampusModel } from '../modelTypes';
import type { PreviewPlan } from '../../navigation/routePreview';
import type { Point } from '../../navigation/walkableGraph';
import { cameraBasis, FOV_DEGREES, MAP_CENTER } from '../cameraMath';
import { readCamera, type CameraValues } from '../useMapCamera';
import Lighting from './Lighting';
import Ground from './Ground';
import Buildings from './Buildings';
import Walkways from './Walkways';
import Emblems from './Emblems';
import RouteOverlay from './RouteOverlay';

/** Copies the Reanimated camera values onto the Three.js camera every frame. */
function CameraRig({ camera }: { camera: CameraValues }) {
  const last = React.useRef<ReturnType<typeof readCamera> | null>(null);
  useFrame(({ camera: cam, size, scene }) => {
    const s = readCamera(camera);
    const b = cameraBasis(s, size.width, size.height);
    cam.position.set(b.eye[0], b.eye[1], b.eye[2]);
    cam.up.set(Math.sin(s.bearing), 0, -Math.cos(s.bearing));
    cam.lookAt(s.targetX - MAP_CENTER, 0, s.targetY - MAP_CENTER);
    const persp = cam as THREE.PerspectiveCamera;
    // Keep near/far tight around the scene for good depth precision on phones.
    const near = Math.max(1, s.distance * 0.05);
    const far = s.distance * 4 + 2500;
    if (persp.near !== near || persp.far !== far) {
      persp.near = near; persp.far = far; persp.updateProjectionMatrix();
    }
    // Fog only softens the horizon when tilted; it scales with the zoom level.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = s.distance * 1.4 + 300;
      scene.fog.far = s.distance * 3.5 + 1200;
    }
    // Tell the screen overlays which camera this frame was drawn with (only when it changed).
    const p = last.current;
    if (!p || p.targetX !== s.targetX || p.targetY !== s.targetY || p.distance !== s.distance || p.bearing !== s.bearing || p.pitch !== s.pitch) {
      last.current = s;
      camera.rendered.value = s;
    }
  });
  return null;
}

type Props = {
  model: CampusModel;
  camera: CameraValues;
  selectedId: string | null;
  plan: PreviewPlan | null;
  marker: Point | null;
  heading: number | null;
  accuracyM?: number | null;
  animateRoute: boolean;
};

export default function CampusScene({ model, camera, selectedId, plan, marker, heading, accuracyM = null, animateRoute }: Props) {
  return (
    <Canvas
      camera={{ fov: FOV_DEGREES, near: 1, far: 6000, position: [0, 1000, 0] }}
      style={{ flex: 1 }}
      pointerEvents="none"
    >
      <color attach="background" args={[model.theme.sky]} />
      <fog attach="fog" args={[model.theme.sky, 1600, 4200]} />
      <CameraRig camera={camera} />
      <Lighting theme={model.theme} />
      <Ground model={model} />
      <RouteOverlay plan={plan} marker={marker} heading={heading} accuracyM={accuracyM} animateRoute={animateRoute} />
      <Buildings buildings={model.buildings} selectedId={selectedId} theme={model.theme} />
      <Walkways walkways={model.walkways} theme={model.theme} />
      {!!model.emblems?.length && <Emblems emblems={model.emblems} />}
    </Canvas>
  );
}
