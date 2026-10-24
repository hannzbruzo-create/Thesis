
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },

  position: {
    position: 'absolute',
    zIndex: 30,
    transform: [
      { translateX: -1 },
      { translateY: -10 },
    ],
  },

  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 0,
    elevation: 0,
  },

  // Original green circular building icon.
  iconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#597663',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 3,
  },

  // White labels with subtle dark shadows.
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.05,
    includeFontPadding: false,

    textShadowColor: 'rgba(30, 40, 35, 0.9)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 2,
  },

  detailText: {
    fontSize: 10.5,
  },
});

export default styles;
