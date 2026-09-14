# Architecture refactor plan

> Historical refactor plan. The canonical upstairs implementation and current controls are documented in [UPSTAIRS_SPATIAL_PLAN.md](UPSTAIRS_SPATIAL_PLAN.md).

1. **Establish the baseline.** Read all four original files and run V2.1 before edits. Preserve the original in Git as `v2.1-baseline` and as a byte-identical archived HTML file. Verify the upstairs → Below → upstairs loop in the browser.
2. **Introduce Vite and explicit ownership.** Bundle the same Three.js revision locally. Extract independent Upstairs/Below factories, a scene manager, player/input/camera, collision, interactions, audio, NPC/dialogue, UI, asset loading, and versioned saved state. Give systems update/dispose lifecycles; allow no geometry to migrate between floors except the player.
3. **Make architecture replaceable.** Keep the V2.1 blockouts intact as fallbacks. Store navigation, named spawns, interaction anchors, NPC placements, and source provenance in level data. Support optional GLB geometry, textures, and compressed audio through a manifest with visible failure diagnostics. Plans/models must be reconciled with navigation and anchors before enabling them; no inferred new building dimensions or unrelated NCG assets.
4. **Prepare for playful traversal.** Keep Space = dance. Support height-bearing navigation surfaces, ramps, steps, optional obstacles, and a separate jump input without redesigning the rooms. Keep architecture and optional gameplay additions separate so overlooks, shortcuts, musical discoveries, and secrets can be authored around verified Breakglass landmarks in a later pass.
5. **Verify and document.** Add targeted regression tests for transitions, movement/collision, interaction filtering, persistence, and audio lifecycle. Run production build and browser checks of both floors, controls, music, NPCs, reload/save, debug overlay, and errors. Document asset replacement and a reproducible QA checklist.

## Baseline observed before edits

- Ran the original via a local HTTP server and entered the game; both floors rendered and E completed the round trip.
- The browser reported only the deprecated Three.js global-build warning, with no application errors during this check.
- Source review: Below's lounge, storage, and service regions have gaps between walkable rectangles; some visual walls cross allowed routes. Preserve the existing blockout and document these pre-existing limitations rather than invent architectural connectors.
- Original controls: WASD/arrows move, E interacts, Space dances, M stops looping audio. All instrument, console, DJ, and dialogue actions must survive extraction.
- There was no Git repository. A local repository and `v2.1-baseline` tag now preserve the untouched four-file prototype.

## Scope

This pass establishes the architecture and preserves the prototype's visual layout. Real geometry, source audio conversion, stem mixing, new routes/secrets, and major visual changes remain future content work guided by the supplied Breakglass references.

## Completed verification

- Implemented the planned modules, level/asset contracts, save state, debug overlay and traversal foundation; kept the original visual layout and actions.
- `pnpm test`: **20 passed**, including 40 consecutive floor transitions and asset/transport ownership tests.
- `pnpm run format:check`, `pnpm build`, `git diff --check`, and launcher shell checks passed. The build has only the documented Three.js vendor-size advisory.
- The final browser integration runner passed **24 checks** across instruments, console, DJ, NPCs, dance/jump, floor travel, save data, and WebGL. No application errors were reported.
- Normal browser reload restored the saved downstairs position separately from the runner's isolated test state.
- The compiled production bundle was served locally under `/dist/` and checked for entry and both floors, exercising relative asset URLs without a CDN dependency.
- `archive/v2.1.html` and `git show v2.1-baseline:index.html` have matching SHA-256: `f0f12094d4796c9cdb8bb325327202f79e65ee9e7d3da4fa984b588f7ef705ff`.
