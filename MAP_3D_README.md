# TomaSafe 2D / 3D campus map

The campus map is a real 3D scene drawn with Three.js (`@react-three/fiber/native` + `expo-gl`). It runs in Expo Go. The old SVG map files are still in the project but are no longer used.

## Using the map
- **One finger**: pan. **Pinch**: zoom. **Two-finger twist**: rotate. **Two fingers up/down**: tilt (3D only). **Double-tap**: zoom in.
- **2D / 3D button**: switches between a straight-down top view and the tilted 3D view.
- **Label button**: shows or hides the building names.
- Panning stops at the campus edge, and you can only zoom out a little past the whole-campus view.
- **Navigation arrow** (only with live GPS): follow mode. The map keeps you centred and turns to match the way your phone is facing. Dragging the map turns it off.

## Editing buildings, roofs and colours
Everything lives in **`src/map3d/campusModel.ts`**. The comment at the top of that file explains each field.

| Field | Meaning |
|---|---|
| `floors`, `floorHeight` | height = floors × floorHeight (metres, default 3.5) |
| `wallColor`, `roofColor` | any hex colour |
| `roof.style` | `'flat'`, `'gable'`, `'hip'` or `'pyramid'` (`pitch` in degrees, optional `ridgeAngle`) |
| `group` | pieces of one building; the editor changes them together |
| `level` | storeys below this piece, for upper floors with their own outline (e.g. St. Dominic's 3-storey block sits on its ground floor with `level: 1`) |
| `holes` | enclosed courtyards cut out of one footprint (e.g. St. Martin); the courtyard gets its own sidewalk |
| `roofParts` | pitched roof sections (`{ poly, style }`) over one footprint, so a single-shape building can have one gable or hip per wing |
| `canopy` | `true` for open covered walkways: a thin roof on posts instead of a solid block |
| `theme` | sky, ground, grass, fields, roads, curbs, road lines, parking, sidewalks, water, label colours, light direction, light contrast |
| `areas` | ground shapes: `grass`, `field` (mown lawn with stripes), `dirt`, `court` (with painted lines), `plaza`, `water`, `parking` (asphalt with stall lines) |

### In-app editor (development builds only)
1. **Long-press the TomaSafe logo** in the header.
2. Tap a building. Change its name, floors, roof style, pitch, ridge direction, and wall or roof colour. Changes show up live.
3. **Edit shape** switches to 2D. Drag a corner to move it, tap a small dot to add a corner, long-press a corner to delete it.
4. The **Theme** tab covers every ground colour, light direction and light contrast. There are no cast shadows; contrast only changes how much lit and shaded walls differ.
5. **Export** opens the share sheet with the full `campusModel.ts`. The same text is also printed in the Metro terminal. Paste it over `src/map3d/campusModel.ts`.

Edits only live in memory until you export and paste.

## Regenerating from the satellite tracing
The current model comes from `tools/build-campus-from-photo.cjs`. It holds a hand tracing of a top-down satellite screenshot (`reference/campus-top.webp`, kept out of git) in photo pixels: building outlines, roof types, ground areas and straightened roads. It converts them to map units with a north-up scale and offset fitted on known landmarks (worst error about 4 m). Building names come from `src/data/buildingLabels.ts`.

- `node tools/build-campus-from-photo.cjs` writes `src/map3d/campusModel.draft.ts` to compare against.
- Add `--force` to overwrite `campusModel.ts`. This keeps the theme but **throws away hand edits** to buildings, so put lasting changes into the tracing instead, or re-apply them in the editor.
- Floors are still placeholders (2 for most buildings, 1 for huts and covered walks) until the real list is added.

### Floor plans
AutoCAD floor-plan PDFs in `reference/plans/` give exact building outlines. The script's `PLANS` table holds, for each plan, a uniform scale and offset that places plan units (PDF points, page rotated north-up) on the photo. These are fitted on matching wall corners and need no known dimensions. Outlines are then written with `fromPlan('<plan>', rect(...))`.

- **Done:** St. Thomas (`aquinas-ground.pdf`, the whole south quadrangle), St. Martin + Preschool & Elementary (`martin-elementary-ground.pdf`), St. Albert, Fra. Angelico, St. Pius, the Student Pavilion (`macias-ground.pdf`, used for the John Macias building) and the AQ Dome.
- **Still traced from the photo:** the chapel and the St. Raymond convent. Their plans are mostly landscaping and curved outlines that matched the roofs worse than the tracing. Also traced: Dominic, San Lorenzo, Rose de Lima, the gym and the smaller structures, which have no plan yet.
- **Roof overhang:** buildings fitted on wall corners can set `eave` (metres) so the roof extends past the walls; the Martin plan uses 1.5 m.
- **To add a building:** put its ground-floor plan in `reference/plans/`, fit its scale and offset the same way, and replace that building's traced rectangles.
- **Room names:** run `node tools/extract-plan-rooms.mjs reference/plans/<plan>.pdf <rotation> tools/plans/<plan>.rooms.json`, then add `rooms: 'tools/plans/<plan>.rooms.json'` to that plan's `PLANS` entry. The tool joins letter-spaced and multi-line names, skips fine print and corridor text, and tidies capitalisation. On the map, room names are small and appear only when zoomed in closer than about 170 m. The label button hides them too. They're stored in `rooms[]` in `campusModel.ts`, where you can rename or delete them.
- **Corridors:** corridors are kept inside the building outline, under the main roof, the way the real roofs look from above. They aren't drawn separately.

**Editable map.** Run `node tools/build-campus-from-photo.cjs --force --editor` to write `reference/map-editor.html`, then open it in a browser. Click any shape to see its name and ID. Drag corners or whole buildings, double-click an edge to add a corner, right-click a corner to delete it. **+ Building / + Ground area / + Road / + Walkway** draws a new shape: click each corner or point, then double-click or press Enter. The panel on the right edits a selected shape's name, roof and floors (buildings), type (areas) or width (roads). **Export edits** saves `map-edits.json`: put it in `tools/` and run the build with `--force` to apply it to the app.

**Campus directory board.** `reference/campus-directory-board.jpg` (north points right on the board) is the reference for the road and walkway network. It's a schematic, so positions are snapped to the satellite photo.

**Routing follows the 3D map.** After changing buildings, roads or walkways, run `node tools/build-walkable-graph.cjs`. It rebuilds `src/data/fullWalkableGraph.json` (open-ground grid, road and path centrelines, covered walkways) and `src/data/visualObstacles.json` (ground-floor footprints, courtyards cut out) from `campusModel.ts`. Restricted/blocked zones in `src/data/walkabilityEdits.json` still apply. Evacuation areas are in `src/data/evacuationAreas.ts` (0–100 units, ×8 for map units; drawn on `map-for-evac-areas.png`, not shown in the app). The old `tools/regenerate-walkable-graph.cjs` (SVG roof mask) is superseded.

How a route is chosen (`src/navigation/routePreview.ts`):
- Open ground is an 8-unit (~4 m) grid linked in 16 directions. The graph stores each link's length and, within 5 m of a wall, its distance to the wall; costs are applied per emergency in `src/navigation/routingProfiles.ts`:
  - **Earthquake:** roads 1.0, covered walkways 1.3, open ground 1.6; up to double cost right at a wall; evacuation areas boxed in by buildings get a penalty.
  - **Fire:** roads 1.0, open ground 1.45, covered walkways 4.0 (smoke under roofs); light wall penalty (up to 20%).
  - No emergency selected yet: earthquake rules. Both use the same evacuation areas.
- Dijkstra picks the cheapest reachable evacuation area; the route ends where it enters the area.
- The route is then straightened: corners are cut wherever a straight line stays clear of buildings by ~1.4 m.
- Snapping uses a spatial index, so each GPS update only checks nearby links.
- A closed-off pocket is kept only if it contains an evacuation area (e.g. the St. Albert courtyard, Area 8).
- `src/location/campusGps.ts`: a GPS fix that drifts into a building, within its accuracy (at least 8 m) of the wall, starts the route from the nearest outdoor point instead of being rejected.
- **Outdoor-only navigation** (`planEvacuation`): people inside a building are told by SMS / push notification to go outside first. A GPS fix inside a building is ignored ("Go outside first") unless it is just drift within the GPS accuracy of a wall, in which case the route starts from the nearest outdoor point.
- `src/location/gpsFilter.ts`: walking GPS goes through a constant-velocity Kalman filter first (weighted by each fix's accuracy; implausible jumps are rejected; restarts after 15 s without fixes).
- `src/navigation/routeFollow.ts`: within 8 m of the current route the user marker is shown on it and the walked part is trimmed; the route is only recalculated when the walker leaves it (or every 10 s, to catch a closer area). The marker (a simple dark-blue 3D person on a white ring, with a ground arrow for the heading) glides between GPS updates (`scene/RouteOverlay.tsx`; sizes in the `PERSON`/`BODY_*`/`HEAD_*` constants).

The older `tools/extract-campus-model.cjs` (outlines from `ust.svg`) is superseded but kept for reference.

## Labels, floors, camera and GPS testing
- **Labels never overlap.** Every frame, building names are placed first and room names after (shortest first); any label that would touch one already placed is hidden until you zoom in (`MapLabels.tsx`).
- **Rooms by building and floor.** Tap a building to outline it and show its room names; the card under the header has floor chips (GF, 2F, 3F…) and says when a floor has no room names yet. Tap empty ground or × to close. With no building selected, ground-floor room names of all buildings appear when zoomed in close.
- **Upper-floor room names:** add `floors: [{ floor: 1, rooms: 'tools/plans/<x>-2f.rooms.json', s, tx, ty }]` to that building's `PLANS` entry (s/tx/ty place the upper sheet on the photo, fitted like the ground floor) and rebuild. Rooms carry `floor` in `campusModel.ts` (0 = ground floor).
- **Opening view:** the whole campus, tilted, framed between the header and the bottom card. When a route appears the camera frames the whole route (you and the destination). Long-press the location button to frame the campus again.
- **GPS test panel:** long-press the GPS line in the bottom card. It shows the phone fix, the smoothed accuracy, the map position and the screening status. **Calibrate:** stand on a spot you can point to on the map, tap Calibrate, then tap that spot; the offset is applied at once and printed in the Metro log. Copy it into `GPS_CALIBRATION` in `src/location/campusGps.ts` to keep it. The blue ring around the dot shows the GPS accuracy.

## Emergency voice guide, alerts and spoken directions

- **Guide** (`src/components/ui/EmergencyInstructions.tsx`, phases in `GUIDE_PHASES` in `src/emergency/emergencyTypes.ts`): one phase at a time in large type. The voice speaks the phase one sentence at a time (highlighted on screen), pauses `repeatAfter` seconds and repeats, until the user taps the phase button. Earthquake: during shaking → after shaking → map. Fire: get out now → map. "I'm outside now" only shows on the last phase; "Already outside? Open the map" skips ahead. The phone buzzes on each new phase and the screen stays on during the whole emergency (`expo-keep-awake`).
- **Voice on/off**: one setting shared by the guide and the map directions (speaker button in the guide band and in the direction pill).
- **Alert links** (`src/emergency/alertLinks.ts`, scheme `tomasafe` in `app.json`): `tomasafe://alert/EQ-1028` (EQ = earthquake, FR = fire), `tomasafe://alert?type=fire`, and `&outside=1` to open the map directly. Test on a connected phone with `adb shell am start -a android.intent.action.VIEW -d "tomasafe://alert/EQ-1"`. Most SMS apps only make http(s) links tappable, so for the SMS use an https page on your server that redirects to the `tomasafe://` link (or set up Android App Links on that domain).
- **Push notifications** (builds only, not Expo Go): send FCM data `{ "emergencyType": "earthquake" }` with category `emergency-alert` and Android channel `emergency`. The notification shows "Open guide" and "I'm safe outside"; tapping opens the guide or the map. Remote push also needs the Firebase `google-services.json` set up in EAS.
- **Spoken directions** (`src/navigation/voiceDirections.ts`, `src/hooks/useVoiceDirections.ts`, `src/components/ui/DirectionPill.tsx`): the next bend over 30° on the route ("In 30 m, turn left"; "bear" for 30–60°), or "Straight ahead · 80 m to …". Spoken on a new route or area, ~30 m before a turn, at the turn, and on arrival; at most one announcement every 3.5 s. Shown as a slim one-line pill under the header.

## GPS accuracy: fused location, sensors and map alignment

- **Fused Location Provider**: expo-location reads positions from Google's Fused Location Provider on Android (GPS + Wi-Fi + cell). The app asks to turn on Google Location Accuracy when it is off (`enableNetworkProviderAsync` in `useLiveCampusLocation.ts`). Raw fused fixes go straight into the filter (no second smoothing).
- **Steps + compass** (`useStepDetector.ts`, `usePhoneHeading.ts`, `GpsKalmanFilter.step`): each accelerometer step moves the estimate 0.7 m along the compass heading, so the marker moves with you between fixes. With the step detector on and no steps for 2 s, you are standing still and fixes are averaged. If GPS keeps disagreeing with "still" (steps missed, e.g. phone in a bag), stillness is ignored for 15 s. Simulated with ±6 m GPS noise: standing still 4.6 m → 1.3 m average error; walking 3.2 m → 1.4 m.
- **Barometer** (`useFloorDetector.ts`): learns ground-level pressure from confident outdoor fixes; 2.5 m+ above it for 4 s shows "You seem to be on an upper floor. Go down and outside first." Phones without a barometer skip this.
- **Map alignment** (`campusGps.ts`): `CAMPUS_BOUNDS` is an estimate, so positions can be shifted, scaled or rotated against the map. In the GPS test panel, stand still ~15 s, tap **Add point**, then tap your true spot. One point fixes an offset; 2+ spread-out points also fix scale and rotation (least-squares similarity). Points are saved on the phone; **Share** sends them so they can be pasted into `BUILT_IN_ALIGNMENT`.
