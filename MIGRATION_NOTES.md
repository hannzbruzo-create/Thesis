# TomaSafe — Original Map & UI Migration

## What's restored from the original Thesis-1 project

- Original `ust.svg`, `ust-context-gps-light.svg`, `ust-building-depth-25d.svg` (identical assets to old project).
- Original 1200-pixel map render surface over its original 800x800 SVG source coordinates.
- Original 24-degree 2.5D tilt, fixed 2000-pixel perspective, and progressive building-depth opacity; NO 48-degree tilt and NO label counter-tilt.
- Original building label coordinates, font sizes, icon style, text thresholds (0.45/0.7 zoom) and scale handling.
- Original pinch centered around the fingers under the active tilt, panning momentum, zoom controls, fit view, original map control stack.
- Original compact header and bottom card layouts, moved into reusable components with styles separate.
- Original light edge fade.

## Deliberately not included

- Old indoor/outdoor graph files, test nodes, or Dijkstra helpers.
- GPS location tracking, building detection, route calculation, evacuation zones, notification code, Firebase configuration.
- A simulated GPS marker or simulated live data. The bottom card clearly says **Map Preview** and the route button is disabled until navigation is implemented.
- Old Expo Router setup. `App.tsx` is still the entry point for this existing blank Expo project.

## New organization

- `src/screens/HomeScreen.tsx` — screen composition
- `src/components/ui/{HeaderBar,NavigationPanel}.tsx` — original header and panel
- `src/components/map/{CampusMap,CampusContext,CampusFadeOverlay,Building3D,BuildingLabels,MapControls}.tsx` — map layers and controls
- `src/hooks/useCampusCamera.ts` — gesture and perspective math, based on the old `src/app/index.tsx`
- `src/data/buildingLabels.ts` — original label positions
- `src/styles/{App.styles.ts,map/*,ui/ClassicUI.styles.ts,screens/HomeScreen.styles.ts}` — visual styles separated from TSX

## Running the migrated project

```bash
npm install
npx expo start
```

Use Expo Go on the phone as with the previously working project. No additional packages beyond those in `package.json` are introduced.

## Verification

- TypeScript: `tsc --noEmit` passed in the migration environment.
- Metro: Android JS bundle export passed using `--no-bytecode`; the Hermes binary shipped in the test environment lacked execute permissions, so native Hermes bytecode packaging was not tested here.
- Physical-device visual behavior was **not** tested here. Inspect the 2.5D toggle, label alignment, pinch, pan and controls on your Android phone.

## Important

The old geometry is **2.5D artwork viewed from one fixed direction**, not a fully dynamic 3D building renderer. Tilt is deliberately restored to the old 24 degrees, not 48 degrees. If any marker still appears away from its building on-device, compare it with the original project at the same view position/zoom and send a screenshot so we can tune its original 800x800 anchor; do not alter the SVG coordinate system.
