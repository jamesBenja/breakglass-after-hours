# Runtime architecture and asset contract

## Ownership and lifecycle

`main.js` creates the HUD and `Game`. The Game composition root owns one renderer, camera controller, player, input controller, state store, audio engine, asset loader, and scene manager. Dependencies are passed explicitly; no game singleton is exposed on `window`.

Each floor factory returns an independent Three.js Scene plus its definition, collision world, NPC system, and `update`/`dispose` methods. Both floor objects are created once. Only the player transfers between them. The manager changes membership after a 300 ms fade-out and locks interaction until the 60 ms entry interval is complete. The camera snaps to the destination under the fade. Repeated transition requests are rejected. Audio is owned by Game, so it continues between floors.

Every floor has three roots:

- `architecture`: the building shell, supplied by a GLB or the plan-derived walls/floors/labels.
- `fixtures`: fallback instruments, console, booth, furnishings and the upstairs GAME platforms/landmark treatment. A furnished model can explicitly replace these too.
- `gameplay`: NPCs now; a home for future collectibles, tasks, and other actors independent of the shell.

Lighting is in the level definition and added to the scene separately. A shell replacement does not remove the scene's red/purple club lights. Resource disposal handles mesh geometry, materials, textures, shadows, input listeners, render loop, and audio voices/timers. Asset instances own cloned geometry/materials/textures; the loader owns cached originals. Scenes stay allocated during ordinary travel and are disposed only when the game ends/reloads.

## Source of truth and geometry replacement

`src/world/upstairs/plan.js` traces source pixel coordinates from `breakglass_codex_support/references/architecture/03_upstairs_floor_plan.png`. It owns room relationships, walls, door apertures and circulation waypoints. One authoring unit corresponds to 20 source pixels; this is not a surveyed metric scale. `compile.js` splits walls into convex collision/render prisms around shared doorway records. `definition.js` assembles Pass A or B. `gameSpace.js` contains removable gameplay platforms, equipment envelopes and the exaggerated Clark stair run. Closed suites have footprint/confidence records without invented interior uses.

`src/world/levels.js` retains the Below definition and exposes the default upstairs definition. The local support pack is now the upstairs architecture authority; the original Drive manifest remains a source inventory. Optional GLB/audio URLs remain `null`; the supplied photos guide procedural equipment geometry rather than being shipped as textures.

To replace geometry:

1. Reconcile the supplied Breakglass plan/model with the current named rooms, doorways, and Clark-side access. Record the specific source/revision in the manifest and level provenance. Do not use the quarantined `NCG_MAINROOM` files without confirmation.
2. Export a browser-sized, Y-up GLB (or glTF with relative dependencies) into `public/assets/models/`. Plain glTF/GLB is supported; Draco, KTX2 and Meshopt decoder pipelines are not configured yet.
3. Set the appropriate model `url` in `src/assets/manifest.js`, relative to the public root: `assets/models/below.glb`. Configure `position`, `rotation` (XYZ radians), and scalar or XYZ `scale`. Upstairs uses A-103 authoring coordinates; Below preserves V2.1 units. Neither should be assumed to be metres.
4. Leave `includesFixtures: false` for a shell-only model; fallback musical fixtures remain. Set it to `true` only when the export includes the fixture geometry you want to use. The model transform applies to that visual model; it does **not** transform navigation, light, NPC, or interaction data automatically.
5. Reconcile `navigation`, `spawns`, `anchors`, and `lights` in the upstairs definition/GAME kit (or `levels.js` for Below) into the same world coordinates. Update fallback fixtures when moving an interaction anchor; do not leave a piano sound target detached from the piano mesh. Run QA before enabling the replacement.

The loader caches requests, reports progress, and exposes readable warnings if a configured asset fails. A missing/failed model uses the blockout and fixtures. `null` means intentionally pending, makes no network request, and displays no failure. Loaded models get independent instances; they are never reparented from one floor into another.

`AssetLoader.texture(id)` supports manifest entries `{ type: 'texture', url: 'assets/textures/example.webp' }` and returns an sRGB texture instance. Assign it to an owned material in a fixture/geometry builder. Dispose an unused instance yourself; textures attached to scene materials are disposed with the scene.

## Collision and traversal

Upstairs room floors may be concave polygons; blocking solids are convex prisms with `points`, `y1`, `y2`, and an ID. Rendering uses those same prisms. Open doorway posts/lintels derive from the same compiled gaps tested by collision. The central suite is a solid shell; only its exterior roof is a Pass B support surface. Plain closed panels do not advertise traversable openings.

Surface records have polygon `points` or rectangular bounds and `y`, optionally a ramp `{ axis, from, to }`. Highest eligible support wins; explicit priorities resolve floor labels. Upstairs feet use a 0.32-radius support footprint so low risers engage before side contact. Horizontal motion is substepped and slides along obstacles. Grounded steps up to 0.34 units auto-climb. A 120 Hz maximum physics step, acceleration/braking, gravity 21, jump impulse 7.5, 130 ms coyote time and 160 ms input buffer provide forgiving jumps. Ceilings stop upward motion; descending feet land on matching platform surfaces. Walking off edges and air control are supported. The authored outer boundary prevents leaving the building; falling below the recovery limit uses the last grounded position.

The camera uses an expanded segment/prism cast for volume clearance. It raises the boom in narrow halls, immediately clamps against obstructions, then eases back out. Orbit/recenter/zoom are independent of player movement; WASD is transformed by camera yaw. The look direction anticipates ahead while the collision boom stays anchored at the player. Camera interpolation is checked too, including on the jump route. This remains authored static collision, not a general triangle-mesh physics engine; moving platforms and arbitrary imported mesh collision are outside this pass.

Below keeps its original rectangular movement bounds. Future model replacement must update geometry, support surfaces, blocking solids, anchors and spawns together. Pass A stays available with `?pass=A`; default Pass B overlays the GAME kit without changing the real room/wall graph. The development runner uses an explicit optional movement argument to `Game.update`, with actual player physics/rendering and normal keyboard dispatch for actions; no production debug mutation API is exposed.

## Interactions and NPCs

Stable anchor IDs supply position, radius, name and action. The interaction system selects the closest eligible anchor on the active floor. `createActions.js` binds those IDs to instruments, console/DJ panels, travel, and NPC dialogue. Panel buttons capture their originating floor and cannot trigger a stale action after travel. NPC render positions use the same anchors as dialogue targeting. NPC animation responds to the shared transport and stops when music stops.

To add an interaction, author its anchor and a handler in `createActions.js`; keep world coordinates out of action handlers. Use stable IDs for future discoveries/quests and add a save migration when persisted schema changes.

## Audio assets and transport

One AudioContext is created/resumed by entry. The original drum, piano, synth, Night Bus, Glass Floor, and 3AM Tool sounds remain synthesized fallbacks. The looping transport uses a short Web Audio lookahead; sources release their nodes on completion. Stop cancels timers, scheduled voices and pending asynchronous playback selections. New track selections win over older slow downloads. Hidden tabs suspend audio and clear input.

Set an audio entry's URL to a short, owned, browser-decodable MP3/OGG excerpt to replace that loop. Fetch/decode failures warn and fall back to the original synthesis. Loops currently restart at selection and use the decoded buffer's full duration; prepare clean loop boundaries in the exported file. Check formats in each target browser.

Do not place source WAV stems (~77 MB each or larger) in `public/`. Keep source material in Drive, edit excerpts, encode browser assets, and record provenance in the asset manifest. Four-stem synchronized mixing, mute/solo, gain controls, and spatial room audio are future features; this pass does not claim to implement them.

## Save data and diagnostics

Version 1, with an optional upstairs layout revision, is stored under `breakglass.after-hours.v1`: floor, position, visited floors, NPC contacts, last selection, and debug preference. Old upstairs coordinates reset to the real entry when the layout revision changes, preserving contacts and music choices. Saves occur every two active seconds, on track selection/travel, visibility changes, and page exit. Scene IDs, positions, lists and track IDs are validated on load. Invalid geometry positions fall back to a named spawn; malformed/future saves reset safely. Storage failures warn once and let play continue. Playback never autostarts from a save.

F3 shows the active scene, transition phase, XYZ coordinates, grounded state, collision region, blocking solid, ground support, camera obstruction/boom, target anchor, geometry provenance, audio state, contacts, visited floors and frame rate. The isolated development browser runner uses injected memory storage so regression runs do not overwrite normal gameplay saves.
