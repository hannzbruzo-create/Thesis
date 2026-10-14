import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

type BuildingLabel = {
  id: string;
  name: string;
  x: number;
  y: number;
};

type BuildingLabelsProps = {
  mapSize: number;
  zoomLevel?: number;
};

export const BUILDING_LABELS: BuildingLabel[] = [
  {
    id: 'angelico',
    name: 'Fra. Angelico BLDG',
    x: 26.48,
    y: 83.97,
  },
  {
    id: 'aquinas',
    name: 'ST. Thomas Aquinas BLDG',
    x: 77.72,
    y: 66.90,
  },
  {
    id: 'martin',
    name: 'ST. Martin BLDG',
    x: 67.35,
    y: 15.50,
  },
  {
    id: 'albert',
    name: 'Albert',
    x: 78.10,
    y: 86.97,
  },
  {
    id: 'aquinas8',
    name: 'Aquinas 8',
    x: 59.85,
    y: 85.10,
  },
  {
    id: 'pius',
    name: 'ST. Pius V Hall',
    x: 51.10,
    y: 38.73,
  },
  {
    id: 'san-lorenzo',
    name: 'San Lorenzo',
    x: 24.60,
    y: 22.50,
  },
  {
    id: 'rose-delima',
    name: 'STA. Rose de Lima BLDG',
    x: 32.85,
    y: 9.25,
  },
  {
    id: 'chapel',
    name: 'ST. Thomas Chapel',
    x: 25.60,
    y: 52.75,
  },
  {
    id: 'dome',
    name: 'AQ Dome',
    x: 45.60,
    y: 84.12,
  },
  {
    id: 'dominic',
    name: 'ST. Dominic BLDG',
    x: 70.47,
    y: 39.75,
  },
];

export default function BuildingLabels({
  mapSize,
  zoomLevel = 1,
}: BuildingLabelsProps) {
  // Hide everything when zoomed too far out.
  if (zoomLevel < 0.45) {
    return null;
  }

  // Hide only the text when slightly zoomed out.
  const showText = zoomLevel >= 0.7;

  // Prevent labels/icons from becoming too large
  // while zooming out.
  const safeZoom = Math.max(
    zoomLevel,
    0.7
  );

  return (
    <>
      {BUILDING_LABELS.map((building) => (
        <View
          key={building.id}
          pointerEvents="none"
          style={[
            styles.position,
            {
              left:
                (building.x / 100) *
                mapSize,

              top:
                (building.y / 100) *
                mapSize,
            },
          ]}
        >
          <View
            style={[
              styles.labelWrapper,
              {
                transform: [
                  {
                    scale:
                      1 / safeZoom,
                  },
                ],
              },
            ]}
          >
            <View
              style={
                styles.iconContainer
              }
            >
              <Ionicons
                name="business"
                size={11}
                color="#FFFFFF"
              />
            </View>

            {showText && (
              <Text
                numberOfLines={1}
                style={styles.text}
              >
                {building.name}
              </Text>
            )}
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',

    transform: [
      {
        translateX: -11,
      },
      {
        translateY: -11,
      },
    ],

    zIndex: 30,
  },

  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 22,
    height: 22,

    borderRadius: 11,

    backgroundColor: '#8B3A3A',

    borderWidth: 2,
    borderColor: '#FFFFFF',

    alignItems: 'center',
    justifyContent: 'center',

    elevation: 3,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  text: {
    marginLeft: 5,

    color: '#FFFFFF',

    fontSize: 9,

    fontWeight: '800',

    maxWidth: 85,

    textShadowColor:
      'rgba(0, 0, 0, 0.85)',

    textShadowOffset: {
      width: 0,
      height: 1,
    },

    textShadowRadius: 2,
  },
});