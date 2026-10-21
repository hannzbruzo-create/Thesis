# TomaSafe — SVG map restored (pre-Google Maps)

This is a clean copy of the last supplied precision-editor project BEFORE the Google Maps/EAS experiments. Your original 800×800 SVG map, pinch/tilt camera, road+open-space graph, Dijkstra preview, evacuation polygons, and precision editing tool are included.

## Start
1. Extract into a NEW folder. Don't overwrite your newer local files if you've edited walkability data since uploading the ZIP.
2. Run `npm ci` in the extracted `TomaSafe` folder.
3. Run `npx expo start -c`, and use Expo Go.

No Google Maps SDK, API key, or EAS development client is required for this version.

## Preserve any more recent local edits
If you've changed `src/data/walkabilityEdits.json`, `src/data/roadGraph.json`, or `src/data/fullWalkableGraph.json` since your ZIP upload, keep those files. Better: run the accompanying rollback patch against your CURRENT working folder; it changes only Google-related files and the screen renderer.

This project does not contain the EAS registration settings added afterward. Those account settings are not needed for Expo Go. The EAS project itself still exists online and can be reused later.

This app is a navigation preview for your university thesis, not verified emergency directions.
