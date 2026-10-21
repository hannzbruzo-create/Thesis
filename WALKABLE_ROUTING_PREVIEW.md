# TomaSafe — Full Outdoor Walkable Graph Preview

This iteration corrects the **road-only** interpretation. Dijkstra searches a **combined graph** built from:

- The original `src/data/roadGraph.json`, containing the user's edited, precise road centerlines. The original input is unchanged.
- A 16-unit grid across apparently open portions of the same 800×800 SVG, including the fields. Eight-directional grid links and road-to-grid links are only added when the visual obstacle mask is clear.
- Approximate building footprints identified from the SVG roof colors and 10 old building-boundary polygons. Water is blocked as well.

The simulated route ends **inside** a mapped evacuation polygon, not at a disconnected road endpoint. A Dijkstra min-heap keeps searches efficient.

## Testing in Expo Go

1. Start the app with `npx expo start`.
2. Tap a road, grass/open map section or assembly field to select a simulated start location.
3. Use **SHOW GRAPH** to inspect road nodes and the cyan outdoor grid.
4. Tap **FIND EVACUATION DESTINATION · PREVIEW**. The blue route includes permitted roads and/or grid edges, ending at the green marker within a designated polygon.
5. Pinch and 2.5D toggle work exactly as in the prior project; the camera code is unchanged.

## Data and regeneration

`src/data/fullWalkableGraph.json` is derived from the user's road JSON and a **fixed visual obstacle mask**. The map's original 800×800 coordinates and SVG art are not altered.

**After editing roads:** replace `src/data/roadGraph.json` with the new exported JSON, then run `node tools/regenerate-walkable-graph.cjs`. No extra npm packages required.

`tools/routingMask800.b64` is a precomputed bitmask made from the **currently provided** `assets/maps/ust.svg`. If the map artwork/buildings change, this mask and `src/data/visualObstacles.json` **must be reviewed and regenerated** to match.

## Critical limitations

- **Open green/grass pixels are assumed walkable for prototype testing only.** Fences, hedges, access gates, inaccessible lawns, and terrain hazards cannot be determined from the SVG. This graph therefore **cannot** be used for real emergency directions yet.
- One road node, `N0111`, falls into the estimated roof mask, so it and its incident edges are excluded **in the generated preview**. The original road JSON is not edited. Inspect this visually against the campus's actual walkway.
- Old evacuation-area polygons may include parts of buildings and should be rechecked with University safety/facilities staff. The algorithm selects only sampled nodes still marked open inside these polygons.
- Distances are **weighted SVG units, not meters**. Road links have cost multiplier 1.0; open-space grid edges 1.1; road-grid links 1.05. The displayed "nearest" means lowest weighted routing cost, not official safest area.
- No GPS, indoor navigation, hazard-based blocking, emergency notifications, live access verification or approved evacuation guidance is present. The preview actions are disabled in production (`__DEV__` gating).
- The SVG's full outer bounding square is **not** proof of campus access. Further explicit walkability/perimeter polygons should replace this visual approximation before campus testing.

No test folder is required to run the application.
