# CODEX HANDOFF — Breakglass: After Hours

## Goal

Turn the current browser prototype into a maintainable 3D mini-game set inside the real Breakglass Studios / Below Breakglass ecosystem.

The player should eventually be able to:

- navigate recognizable Breakglass spaces
- play instruments in the Live Room
- load, play, solo/mute, and lightly mix actual sessions in the Control Room
- DJ music downstairs in Below
- talk to people, make friends, invite people to jam/dance
- carry musical material from one room/activity into another
- discover small Breakglass stories/tasks

## Current build

The canonical Vite + Three.js refactor now includes the A-103 upstairs spatial pass (package version 2.2.0). Start it with `./dev.sh`; see `README.md`, `ARCHITECTURE.md`, and `QA.md` for setup, module ownership, asset integration, and verification.

- V2.1 was run before edits and preserved under Git tag `v2.1-baseline` and `archive/v2.1.html`.
- Upstairs and Below have independent scenes, with modular player/input/camera, collision, interactions, audio, NPC/dialogue, asset loading, UI and saved state.
- Original musical/session/DJ/dialogue/dancing actions are retained. Space/J jump, F dances, Q/R or right-drag orbit, C recenters, wheel zooms, and F3 shows contact/camera diagnostics.
- Real GLB shells, textures and short audio excerpts can be configured through the asset manifest. The current URLs remain pending and use procedural geometry/synthesized sounds.
- Upstairs now uses hand-traced A-103 polygons and shared doorway render/collision records. Read `UPSTAIRS_SPATIAL_PLAN.md` for the real relationships, widened gallery and declared gameplay elevations. Below is unchanged. No detailed private suite uses are invented.
- Existing Below side-room connectivity and mesh/collision mismatches are documented in `QA.md` for reconciliation with the actual plans.

## Next engineering priorities

1. Validate the A-103 tracing and gameplay clearances against current plans/models, then replace the procedural shell with reconciled GLB geometry. Keep GAME props separate and verify all door openings.
2. Encode short, owned audio excerpts for browser playback. Do not ship giant source WAV stems directly.
3. Build synchronized stem mixing on the shared audio engine, preserving transport ownership and stop/cancellation behavior.
4. Refine the existing upstairs loop, case jumps and polygon perch with human playtests. Preserve camera/grounding checks. No copied Mario assets or levels.

## Design direction

Stylized, low-poly, slightly miniature/diorama-like Breakglass rather than photorealism.
Recognizable architecture, equipment and atmosphere matter more than graphical realism.

The experience should be a playful exploratory 3D music game, with the spatial legibility, verticality and curiosity of classic platformers/collectathons. The actual Breakglass building remains the underlying source of truth. Do not turn source-plan fidelity into a flat CAD walkthrough; express play through authored routes and musical discoveries while respecting the real relationships between spaces.

The game should feel like a music toy / studio sim / tiny social RPG, not a combat game.

## Next playable milestone

A recognizable upstairs + Below loop:

1. walk through actual studio geometry
2. play a real instrument/loop
3. go to control room
4. load a real Breakglass session represented by 4 stems
5. mute/solo/mix stems
6. go downstairs
7. DJ one or two actual owned tracks/loops
8. crowd reacts
9. talk to 2–3 NPCs
10. return upstairs without state loss

## Asset sourcing

See `DRIVE_ASSET_MANIFEST.md`.

Do not assume every Drive item containing "Breakglass" is the current building.
The `NCG_MAINROOM` Vectorworks/DWG folder discovered during search appears unrelated and must not be used unless confirmed.

## Coding quality

- Keep asset references configurable.
- No monolithic single-file architecture after refactor.
- Scene transitions should have tests or a reproducible QA checklist.
- Add an in-game debug overlay toggle for current scene, coordinates, interaction target and collision region.
