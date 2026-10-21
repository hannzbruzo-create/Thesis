/**
 * Camera projection equations copied from the user's working legacy
 * src/app/index.tsx. Keep these paired with the SAME transform sequence:
 * [{ perspective: 2000 }, { scale }, { rotateX }].
 *
 * Coordinates passed here are map-center-relative, not raw SVG coordinates.
 * The underlying original campus SVG viewBox is unchanged (800 x 800),
 * rendered at MAP_SIZE=1200 like in the legacy project.
 */
export const MAP_PERSPECTIVE = 2000;

export type MapPoint = { x: number; y: number };

/** Screen-space displacement -> unprojected displacement from map center. */
export function screenToMapOffset(
  x: number,
  y: number,
  zoom: number,
  degrees: number
): MapPoint {
  'worklet';
  const angle = (degrees * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);

  const worldY = y / (zoom * (cosine + (y * sine) / MAP_PERSPECTIVE));
  const depth = 1 - (zoom * worldY * sine) / MAP_PERSPECTIVE;

  return { x: (x * depth) / zoom, y: worldY };
}

/** Unprojected displacement from map center -> screen-space displacement. */
export function mapToScreenOffset(
  x: number,
  y: number,
  zoom: number,
  degrees: number
): MapPoint {
  'worklet';
  const angle = (degrees * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const depth = Math.max(0.15, 1 - (zoom * y * sine) / MAP_PERSPECTIVE);

  return { x: (x * zoom) / depth, y: (y * zoom * cosine) / depth };
}
