# A-103 upstairs implementation — two passes

## Reference reading

Read the five requested support documents in order, then all six architectural images and all seven visual references. `03_upstairs_floor_plan.png` (1275 × 1650) is the upstairs authority; the room graph is a topology aid. Below remains the separate canonical scene for this task.

## Pass A: topology and movement

- Trace A-103's irregular exterior, west Mixing Suite A, upper-left Dead Room, large upper Live Room, angular central suite, southern storage, east hall/suite chain, upper-right bar/kitchen, lower Closed Suite, southeast entry and west Clark stair.
- Use a single set of authored polygons, wall segments and door gaps to create both visible geometry and collision. Closed interiors remain sealed modular masses with plain labels.
- Widen circulation around the central polygon into a continuous playable gallery. This is a declared gameplay interpretation of the plan's thin circulation/acoustic margins; do not claim the widened gallery or all door apertures are surveyed as-built passages.
- Implement acceleration/braking, buffered/coyote jumping, low steps and stable landings. Preserve musical actions and dialogue; use Space/J to jump and F to dance for the platformer control scheme.
- Add a camera boom with volume clearance, obstruction-aware elevation, smooth recovery, manual orbit/recenter and movement relative to view. Expand F3 diagnostics with actual collision/ground/camera targets.
- Run the entry → central loop → Live Room → Mixing Suite A → Clark stair → Below → upstairs → entry route before adding elevated props. Keep a reproducible `?pass=A` view.

## Pass B: playable space

- Give the central suite a strong polygonal silhouette and distinct exterior treatment without inventing its current interior use.
- Add low cases/risers, a listening platform, an optional overlook route and a small nook/shortcut. All platforms derive render and collision from the same records. Keep primary routes usable without jumping.
- Build recognizable Spectra console, monitor, rack, patch and tape-machine forms using the 2026/2025 references; treat their placement as gameplay dressing, not measured current placement.
- Re-run the main route in both directions and repeat jump/camera tests. Record faithful relationships, deliberate exaggerations and any unresolved limitations in the final QA notes.

## Implemented result and architectural fidelity

| Relationship | Implementation |
| --- | --- |
| Main entry and east chain | Southeast spawn inside the main entry; east circulation runs past the separate Closed / Adjacent B / Closed / Adjacent A masses to the northeast bar/kitchen. |
| Live Room / emergency hall | Large upper room with its angled southwest shoulder, south emergency-hall doorway and east circulation connection. |
| Mixing Suite A / Dead Room | Mixing remains west of the central suite and south of the Dead Room. Each has a distinct, physically open gallery doorway. |
| Central polygon | Narrow upper shoulder and broader lower mass remain the main landmark; a continuous widened gallery wraps it. Interior use stays unspecified and sealed. |
| Storage / lower suite | Storage stays south of the polygon, with north/east access; the separate lower Closed Suite stays east of it. |
| Clark access | West/southwest of Mixing Suite A, reached through its southern door. Physical steps descend to the existing Below transition; return arrives on the upper landing. |

### Intentional gameplay exaggerations

- The central footprint is narrowed and its circulation widened. Door widths/clearances and the continuous outer gallery are authored for play, not asserted to be surveyed as-built passages.
- The polygon is heightened to 4.1 authoring units and given a teal/gold cornice. Roofs/ceilings are cut away for visual connections. Private suite masses use lower silhouettes without invented furnishings or current uses.
- Flight cases, a 0.28-unit listening deck, instrument riser, quiet nook behind a gobo, storage perches, and a four-hop **exterior** ascent to the polygon roof are GAME additions. The wall-top hop ledge and walkable roof are not claims about the building's current accessible upper surfaces. The main circulation works without jumping.
- Clark's landing/descending run is widened and simplified; its west-side relationship is sourced, its stair dimensions and extent are not surveyed.
- Spectra, monitors, side racks, wood-framed patching and reel-to-reel forms follow the current supplied photos. Equipment scale/placement and simple collision envelopes serve play; no detailed current use is assigned to private rooms.
- `plan.js` keeps the source pixel tracing; `gameSpace.js` keeps the exaggerations separate. Replace shell, collision and anchors together when surveyed model assets arrive. No Mario assets or level geometry are used.

### Two-pass playtest record

Pass A was run in the browser before adding the GAME kit. The full entry/loop/Live/Mixing/Clark/Below/return traversal, original musical actions and retained Below dialogue passed. Pass B was then replayed with equipment collision and elevation. Tests caught and corrected early step-up contact, approaches to the piano/synth, the console aisle, and close-wall camera crowding. The final routes visit every public room, traverse every open door, climb to the polygon perch and return to entry. See `QA.md` for the repeatable runner and manual route.

### Final verification

- 31 Node regression tests passed, including both spatial passes, every open doorway, all public-room branches, the four-hop ascent, coyote/buffer/step/ceiling behavior, close-wall camera orbits and 40 floor transitions.
- Final browser runs completed 113 assertions for Pass A and 128 for Pass B, with no application or WebGL errors. Original music, NPC dialogue, state and floor transitions remain functional.
- Formatting checks and the Vite production build passed. Three.js retains the existing vendor chunk-size advisory (541 kB / 139 kB gzip); no compile errors.
- Visual inspection covered the entry, polygon/room sightlines, Live Room ascent, Spectra/patch/tape arrangement and descending Clark stair.
- The compiled build was opened at `http://127.0.0.1:5174/`; entry, rendering and keyboard controls loaded without console errors. The default development game remains at port 5173.
