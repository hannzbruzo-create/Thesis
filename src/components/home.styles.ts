import { StyleSheet } from 'react-native';

const MAP_SIZE = 1200;

export const styles = StyleSheet.create({
  // Compact dev controls: exit choices and route button share one row.
  testNavigationPanel: {
    marginBottom: 7,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  testNavigationHeading: {
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.25,
  },
  testExitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  testExitButton: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E9EEF4',
  },
  testExitButtonSelected: {
    backgroundColor: '#2563EB',
  },
  testExitButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  testExitButtonTextSelected: {
    color: '#FFFFFF',
  },
  testShowRouteButton: {
    flex: 2,
    height: 42,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testShowRouteText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },

  // Compact navigation banner: uses only about 50–55 dp of map height.
  devHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 26,
    gap: 7,
  },
  devSelectionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  devSelectionText: {
    fontSize: 9,
    color: '#2563EB',
    fontWeight: '900',
  },
  navInstructionDemo: {
    top: 105,
  },
  navDirectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  navInstruction: {
    position: 'absolute',
    top: 134,
    left: 14,
    right: 14,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#142D4B',
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 27,
    elevation: 6,
  },
  navInstructionLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  navInstructionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  navInstructionSub: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
    color: '#CBDDF0',
    marginTop: 1,
  },
  navDemoLabel: {
    color: '#FDE68A',
    fontWeight: '800',
  },
  navOverviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 9,
    marginLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.22)',
    gap: 6,
    minHeight: 34,
  },
  navInstructionDistance: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  userArrowBadge: {
    width: 30,
    height: 30,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // =====================================================
  // MAP
  // =====================================================
  mapViewport: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  gestureArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapPanLayer: {
    position: 'absolute',
    width: MAP_SIZE,
    height: MAP_SIZE,
    top: 0,
    left: 0,
  },
  mapZoomLayer: {
    width: MAP_SIZE,
    height: MAP_SIZE,
  },
  routeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  // =====================================================
  // USER MARKER
  // =====================================================
  userMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  accuracyGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(37,99,235,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.20)',
  },
  userDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 9,
  },
  userDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },

  // =====================================================
  // HEADER
  // =====================================================
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 5,
    minHeight: 50,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.97)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 6,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  brand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  brandAccent: {
    color: '#2563EB',
  },
  subText: {
    marginTop: 1,
    fontSize: 7,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
  },
  mapBadgeText: {
    marginLeft: 4,
    fontSize: 7,
    fontWeight: '900',
    color: '#2563EB',
  },

  // =====================================================
  // STATUS
  // =====================================================
  locationStatus: {
    position: 'absolute',
    top: 88,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    zIndex: 25,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  locationStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },

  // =====================================================
  // CONTROLS
  // =====================================================
  mapControls: {
    position: 'absolute',
    right: 14,
    width: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    elevation: 6,
    zIndex: 25,
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDivider: {
    height: 1,
    marginHorizontal: 7,
    backgroundColor: '#E2E8F0',
  },
  zoomIndicator: {
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  zoomIndicatorText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  recenterButton: {
    position: 'absolute',
    right: 14,
    bottom: 180,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 7,
    zIndex: 25,
  },
  fitCampusButton: {
    position: 'absolute',
    right: 14,
    bottom: 123,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 7,
    zIndex: 25,
  },

  // =====================================================
  // BOTTOM CARD
  // =====================================================
  bottomPanel: {
    position: 'absolute',
    bottom: 10,
    left: 14,
    right: 14,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 9,
    zIndex: 20,
  },
  compactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactLocationIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  compactLocationInfo: {
    flex: 1,
  },
  compactLocationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  compactLocationSubtext: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },

  // =====================================================
  // ROUTE BUTTON
  // =====================================================
  routeButton: {
    height: 42,
    marginTop: 8,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.65,
  },
  routeButtonText: {
    marginLeft: 7,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  // =====================================================
  // ACTIVE ROUTE
  // =====================================================
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#E8F8EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  routeTitle: {
    marginTop: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  routeDistance: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  stopButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});