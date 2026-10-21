# Precision editor — covered and walkable areas

Use `TomaSafe_Precision_Walkability_Builder.html` in Chrome (works without internet). It displays the original 800 x 800 SVG. Its red overlay represents the older automatically detected roof mask; **red does not necessarily mean an actual solid building**.

1. Use Covered path and trace the centerline of a roofed *walkable* corridor, specify usable width. Use Walkable field for large accessible outdoor regions. Trace true buildings/restricted areas with polygon tools.
2. Vertices can be dragged and set numerically. Undo/redo is included. The builder autosaves in that browser, but always **Export project** to maintain a portable backup.
3. Export `walkabilityEdits.json` from the HTML editor and put it at `src/data/walkabilityEdits.json`, replacing the empty starter file.
4. Run `node tools/regenerate-walkable-graph.cjs` from the project root. The generator uses the initial mask as a baseline, unblocks **manually annotated covered/walkable/field areas**, then blocks all explicitly marked solid buildings/restricted polygons. It adds extra nodes to narrow covered paths.
5. Restart Expo (`npx expo start -c`). The simulation will use the newly generated `fullWalkableGraph.json` and inspect tap locations using the overrides.
6. If you edited the evacuation polygons, additionally export `evacuationAreas.ts` into `src/data/evacuationAreas.ts` and regenerate/restart.

Notes:
- The app is a **development preview**. Roofs, fences, corridors, physical barriers and access must be verified with campus facilities before emergency use.
- Weight units are SVG-derived, *not* meters.
- Do not hand-edit `routingMask800.b64`; it remains the initial auto-inferred mask.
- The road centerline graph `src/data/roadGraph.json` is not altered by edits in the precision zoning editor.
- Each covered passage is drawn as a centerline with an explicit corridor width; if it is 8 units wide, for example, it is 4 units to either side.
- Walkability is intentionally not inferred from roof appearance once a user override is supplied. Explicit blocked zones outrank overrides.
