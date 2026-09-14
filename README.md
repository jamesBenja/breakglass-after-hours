# Breakglass: After Hours — V2.1

## What changed from V2
- Fixed the floor-overlap bug by using **two completely separate Three.js scenes**.
- Stairs now trigger a fade/load transition between upstairs and Below.
- Doorways upstairs are visibly framed, labeled, and have glowing thresholds.
- Navigation connectors are explicit instead of accidental gaps in collision geometry.
- Below's proportions/layout now begin from the real Breakglass venue technical diagram:
  - main club room
  - Take A Break
  - storage
  - kitchen/service
  - production suite
  - bar
  - coat check
  - Clark-side stairway
  - central/lower DJ booth position
- Below lighting is moving toward the red/purple atmosphere visible in real Breakglass photos.

## Run
Open `index.html` in Chrome and click **Enter Breakglass**.

Controls:
- WASD / arrows: move
- E: interact
- Space: dance
- M: stop looping audio

## Important
The upstairs layout is still an approximation pending conversion of the full floor-plan package into game geometry.
Below is now grounded in an actual Breakglass technical plan, but still simplified for playability.

See:
- `docs/CODEX_HANDOFF.md`
- `docs/DRIVE_ASSET_MANIFEST.md`
