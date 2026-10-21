import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  position: {
    position: 'absolute',
    // Center the round icon on the map coordinate.
    transform: [{ translateX: -11 }, { translateY: -11 }],
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  text: {
    marginLeft: 5,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    maxWidth: 85,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
