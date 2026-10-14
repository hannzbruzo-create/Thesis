import UstBuildingDepthSvg from '../../assets/images/ust-building-depth-25d.svg';

type BuildingDepthLayerProps = {
  mapSize: number;
};

/** Decorative 2.5D building rendering. Does not change routing or GPS coordinates. */
export default function BuildingDepthLayer({ mapSize }: BuildingDepthLayerProps) {
  return (
    <UstBuildingDepthSvg
      width={mapSize}
      height={mapSize}
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0 }}
    />
  );
}
