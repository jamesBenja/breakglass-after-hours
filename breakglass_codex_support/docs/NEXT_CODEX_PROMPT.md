# NEXT CODEX PROMPT — paste after Step 1 refactor is stable

The refactor is now the canonical codebase. I have added a folder named `breakglass_codex_support` to the project root.

Read, in this order:
1. `breakglass_codex_support/README.md`
2. `breakglass_codex_support/docs/ARCHITECTURE_SOURCE_OF_TRUTH.md`
3. `breakglass_codex_support/docs/SPATIAL_GAME_DESIGN_BRIEF.md`
4. `breakglass_codex_support/docs/ASSET_REFERENCE_INDEX.md`
5. `breakglass_codex_support/docs/ROOM_GRAPH.json`

Then inspect every image under `breakglass_codex_support/references/architecture/` and the key visual references under `references/visual/`.

Your next task is **not to add quests or lots of interactions**. Replace the inaccurate upstairs blockout with a recognizable, genuinely fun 3D-platformer interpretation of the actual Breakglass 3rd-floor plan.

Requirements:
- Use `03_upstairs_floor_plan.png` as the architectural source of truth.
- Preserve the real Live Room, Studio Mixing Suite A, Dead Room, central polygonal Closed Suite, storage, emergency hall/circulation, east suite chain, bar/kitchen, main entry and Clark stair in recognizable relationships.
- Make the central polygonal suite a major navigational landmark; surrounding circulation should create a satisfying loop.
- Do not make a literal CAD walkthrough. Apply landmarks, elevation, jumpable low structures, visible destinations, shortcuts, hidden nooks, strong silhouettes and spatial curiosity.
- Do not copy Mario 64 geometry/assets. Borrow only the broad lesson that movement and architecture should be intrinsically enjoyable.
- Add/tune a proper platformer controller if needed: jump, coyote time, input buffer, forgiving low-step traversal and reliable grounded state.
- Improve camera collision and camera feel before heavy decoration.
- Use the current control-room references: Spectra console, monitors, racks, patching and tape-machine character.
- Keep uncertain Closed Suite interiors modular rather than inventing detailed current uses.
- Visible doors/routes must correspond to traversable collision openings.
- Add a debug toggle showing scene, coordinates, grounded state, collision target and interaction target.

Work in two passes:

**Pass A — spatial blockout:** real topology, simple materials, playtest.
**Pass B — game-space pass:** once topology works, add elevation, landmarks and climbable/jumpable props while keeping the real plan underneath.

Repeatedly playtest:
spawn at real 3rd-floor entry → navigate around central suite → enter Live Room → reach Mixing Suite A → find Clark stair/floor transition → return to entry.

Fix confusing routes, collision and camera problems before finishing.

At the end, summarize which architectural relationships are faithful and which elements were intentionally exaggerated for gameplay.
