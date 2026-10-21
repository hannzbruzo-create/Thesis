import { StyleSheet } from 'react-native';

/** Compact bottom-sheet emergency guide, leaving the map visible above it. */
export default StyleSheet.create({
  overlayRoot: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 90, elevation: 90,
  },
  backdrop: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    overflow: 'hidden',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.13, shadowRadius: 18, elevation: 12,
  },
  dragHandle: {
    width: 38, height: 4, borderRadius: 3, backgroundColor: '#D5DEE9',
    alignSelf: 'center', marginTop: 10, marginBottom: 5,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 11, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 11,
  },
  emergencyIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 2 },
  eyebrow: { color: '#8291A5', fontWeight: '800', fontSize: 9, letterSpacing: 1.0 },
  headerTitle: { color: '#132A42', fontWeight: '900', fontSize: 17 },
  headerSubtitle: { color: '#6B778C', fontSize: 11, fontWeight: '700' },
  alertDot: { width: 8, height: 8, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8 },
  guideStatus: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 9, paddingVertical: 8, paddingHorizontal: 18,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E9EFF5',
    backgroundColor: '#F6F9FD',
  },
  statusLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: '#475569' },
  progressRow: { width: 50, flexDirection: 'row', gap: 5 },
  progressSegment: { flex: 1, height: 5, borderRadius: 5, backgroundColor: '#DCE5F2' },
  progressActive: { backgroundColor: '#60A5FA' },
  progressDone: { backgroundColor: '#16A34A' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  sectionTitle: { color: '#182A42', fontSize: 14, fontWeight: '900' },
  stepCard: {
    borderWidth: 1, borderColor: '#E4EBF3', borderRadius: 13,
    backgroundColor: '#FFFFFF', paddingVertical: 9, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', gap: 9,
  },
  stepIcon: {
    width: 38, height: 38, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  stepCopy: { flex: 1, gap: 2 },
  stepTitle: { color: '#172A43', fontSize: 12, fontWeight: '900' },
  stepText: { color: '#556479', fontSize: 11, lineHeight: 16 },
  stepNumber: { fontSize: 10, fontWeight: '800', color: '#B5C0CE', alignSelf: 'flex-start' },
  notice: {
    backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#FCE1C7',
    borderRadius: 12, padding: 10,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  noticeText: { flex: 1, color: '#87501F', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E7EDF4', gap: 7,
  },
  footerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  replayButton: { paddingHorizontal: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  replayText: { color: '#1D4ED8', fontSize: 11, fontWeight: '800' },
  primaryButton: {
    backgroundColor: '#2063E9', minHeight: 54, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, gap: 12,
  },
  primaryButtonDisabled: { backgroundColor: '#94A3B8' },
  buttonCopy: { flex: 1, gap: 2 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  primaryButtonSubtext: { color: '#E7EFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
});
