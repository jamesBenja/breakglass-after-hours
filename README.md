# Breakglass: After Hours

A playable 3D music prototype built with Vite and Three.js. Explore the studio, play instruments, start a session, visit Below, DJ, talk, and dance.

## Run locally

```sh
./dev.sh
```

Open **http://127.0.0.1:5173** and click **Enter Breakglass**. The launcher uses your installed Node/pnpm or the bundled Codex runtime, installs dependencies if needed, and starts Vite. First-time installation needs internet; normal play uses local bundled dependencies and synthesized sound.

For a standard development setup, use Node.js **22.12+** and pnpm **11**:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Do not open the new `index.html` directly from disk: it is a Vite module entry point.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move relative to the camera |
| E | Interact with the nearby target shown in the HUD |
| Space / J | Jump (buffered input and coyote time) |
| F | Dance |
| M | Stop music and active sounds |
| Q / R or right-drag | Orbit camera |
| C | Recenter camera |
| Mouse wheel | Zoom |
| F3 | Toggle scene, position, grounded/contact state, camera, interaction, audio, and save diagnostics |

Click the game view to restore game-key focus after keyboard navigation through buttons. Input starts after entry and clears when focus is lost. Location, visited floors, NPC contacts, last music selection, and debug preference save automatically in this browser. Reload restores your visit; playback starts only after a user gesture and a new music selection.

## Development checks

```sh
pnpm test
pnpm run format:check
pnpm build
pnpm preview
```

The production preview runs at **http://127.0.0.1:5174**. `dist/` is the deployable static build and supports a relative base path. The Three.js vendor bundle currently produces Vite's advisory 500 kB chunk-size warning (~134 kB gzipped); the build succeeds.

For the reproducible browser integration test, run the dev server, open **http://127.0.0.1:5173/tests/browser.html**, and click **Run browser regression**. Append `?pass=A` or `?pass=B` to test either version. The runner uses isolated memory storage and exercises the renderer/audio/UI, the complete loop and side-room routes, studio–club travel, and the Pass B jumping route. Inspection buttons appear after success. It is not included in the production build.

## Project structure

```text
src/
  core/           Game lifecycle and render loop
  scenes/         Scene manager, independent floor factories, disposal
    geometry/     Plan-derived shells, studio equipment, platform/landmark builders
  world/          Level provenance, navigation, anchors, spawns, lighting
    upstairs/     A-103 room/wall tracing, door compiler, separate GAME kit
  player/         Keyboard input, player movement/dance/jump, follow camera
  collision/      Navigation surfaces, height/ramps/steps, optional obstacles
  interactions/   Proximity targeting and music/travel/dialogue actions
  audio/          Shared Web Audio context, transport, synthesis, sample playback
  npcs/           NPC actors, dance response, dialogue data
  assets/         Configurable manifest and model/texture/audio loader
  state/          Versioned, validated save data
  ui/             HUD, panels, entry screen, diagnostics, styles
public/assets/    Future exported models, compressed audio, textures
tests/          System regression tests and browser integration runner
archive/         Untouched original V2.1 HTML
```

## Architecture and design direction

The canonical Vite refactor now has a third floor traced from the supplied **A-103 upstairs plan**. The west Mixing Suite A, northwest Dead Room, large Live Room, central polygonal suite, southern storage, emergency hall, east suite chain, bar/kitchen, southeast entry and west Clark access retain recognizable relationships.

The central gallery is widened into a loop. Optional cases, risers, a listening platform and a four-hop route onto the polygon perch make movement part of exploration. These are declared gameplay exaggerations, with private interiors kept sealed. No quests or new interaction types were added. Spectra console, monitors, racks, patching and tape-machine forms use the current supplied photo references.

- **Pass B, playable space:** http://127.0.0.1:5173/
- **Pass A, simple topology:** http://127.0.0.1:5173/?pass=A
- **Plan, fidelity and QA notes:** [Upstairs spatial implementation](docs/UPSTAIRS_SPATIAL_PLAN.md)

Building geometry, equipment, navigation, controls, music and scenes remain separate modules. Source tracing uses pixel coordinates and authoring units, not surveyed metres. A future model must be reconciled with the corresponding collision and anchors. Below retains its canonical scene and known side-room connectivity limitations; this pass rebuilds upstairs.

## Documentation and baseline

- [Original refactor plan](docs/IMPLEMENTATION_PLAN.md)
- [Upstairs two-pass plan and fidelity notes](docs/UPSTAIRS_SPATIAL_PLAN.md)
- [Architecture and asset replacement](docs/ARCHITECTURE.md)
- [Verification and manual QA](docs/QA.md)
- [Handoff and future milestones](docs/CODEX_HANDOFF.md)
- [Drive asset manifest](docs/DRIVE_ASSET_MANIFEST.md)

The unchanged original four-file prototype is tagged **`v2.1-baseline`**. `archive/v2.1.html` is byte-identical to its original `index.html`; it still uses the original Three.js CDN script and can be served independently for comparison.
