
import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import {
  BUILDING_LABELS,
  type BuildingLabelData,
} from '../../data/buildingLabels';

import styles from '../../styles/map/BuildingLabels.styles';

type Props = {
  mapSize: number;
  cameraScale: SharedValue<number>;
  zoomLevel?: number;
  hidden?: boolean;
};

type Label = {
  building: BuildingLabelData;
  name: string;
  showIcon: boolean;
  detailed: boolean;
};

const SHORT_NAMES: Record<string, string> = {
  angelico: 'FRA. Angelico',
  aquinas: 'ST. Thomas',
  martin: 'ST. Martin',
  albert: 'ST. Albert',
  aquinas8: 'ST. Macias',
  pius: 'Pius V',
  'san-lorenzo': 'San Lorenzo',
  'rose-delima': 'STA. Rose De Lima',
  chapel: 'Chapel',
  dome: 'Dome',
  dominic: 'ST. Dominic',
  'label-mvltweem': 'ST. Raymond',
};

// Full building names and icons appear at 0.7x zoom.
const FULL_LABEL_ZOOM = 0.7;

function chooseLabels(zoom: number): Label[] {
  const detailed = zoom >= FULL_LABEL_ZOOM;

  return BUILDING_LABELS
    .filter((building) => {
      const isSecondary = building.kind === 'secondary';

      // Primary buildings are eligible from 0.22x.
      // Secondary buildings follow their configured minZoom.
      const minZoom = isSecondary
        ? (building.minZoom ?? 1.0)
        : 0.22;

      return zoom >= minZoom;
    })
    .sort(
      (a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0)
    )
    .map((building) => ({
      building,

      name: detailed
        ? building.name
        : SHORT_NAMES[building.id] ?? building.name,

      showIcon: detailed,
      detailed,
    }));
}

const BuildingMarker = memo(function BuildingMarker({
  item,
  mapSize,
  cameraScale,
}: {
  item: Label;
  mapSize: number;
  cameraScale: SharedValue<number>;
}) {
  const { building, name, showIcon, detailed } = item;

  // Keeps labels readable while the map zooms.
  const markerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: 1 / Math.max(cameraScale.value, 0.44),
      },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.position,
        {
          left: (building.x / 100) * mapSize,
          top: (building.y / 100) * mapSize,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.labelWrapper, markerStyle]}
      >
        {showIcon && (
          <View style={styles.iconContainer}>
            <Ionicons
              name="business"
              size={10}
              color="#FFFFFF"
            />
          </View>
        )}

        <Text
          numberOfLines={1}
          style={[
            styles.text,
            detailed && styles.detailText,
          ]}
        >
          {name}
        </Text>
      </Animated.View>
    </View>
  );
});

function BuildingLabels({
  mapSize,
  cameraScale,
  zoomLevel = 1,
  hidden = false,
}: Props) {
  const selected = useMemo(
    () => chooseLabels(zoomLevel),
    [zoomLevel],
  );

  if (hidden) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.layer,
        {
          width: mapSize,
          height: mapSize,
        },
      ]}
    >
      {selected.map((item) => (
        <BuildingMarker
          key={item.building.id}
          item={item}
          mapSize={mapSize}
          cameraScale={cameraScale}
        />
      ))}
    </View>
  );
}

export default memo(BuildingLabels);
