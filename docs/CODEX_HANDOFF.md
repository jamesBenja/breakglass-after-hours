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
`index.html` is V2.1:
- plain Three.js browser prototype
- separate upstairs and downstairs scenes
- stair transition
- simple collision/walkable zones
- synthesized placeholder audio
- basic interactions and NPC dancing
- Below geometry partly grounded in the actual venue technical diagram

## Immediate engineering priorities
1. Preserve V2.1 as a tagged baseline.
2. Convert project to Vite + Three.js modules.
3. Split code into:
   - scene manager
   - player/controller
   - collision/navigation
   - audio engine
   - interaction system
   - NPC/dialogue system
   - asset loader
   - Upstairs scene
   - Below scene
4. Add a local dev server and one-command run workflow.
5. Add saveable game state.
6. Keep scenes independent so no geometry leaks between floors.
7. Use source-of-truth geometry from Drive assets, not guessed dimensions.
8. Optimize audio assets for browser playback. Do not ship giant source WAV stems directly.

## Design direction
Stylized, low-poly, slightly miniature/diorama-like Breakglass rather than photorealism.
Recognizable architecture, equipment and atmosphere matter more than graphical realism.

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
