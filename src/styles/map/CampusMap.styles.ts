import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  root: { flex: 1 },
  gestureArea: { flex: 1, width: '100%', height: '100%', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  mapPanLayer: { position: 'absolute', width: 1200, height: 1200, top: 0, left: 0 },
  mapZoomLayer: { width: 1200, height: 1200 },
  campus: { position: 'absolute', top: 0, left: 0 },
  layer: { position: 'absolute', top: 0, left: 0, width: 1200, height: 1200 },
});
