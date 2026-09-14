# Verification and regression checklist

Run `pnpm test`, `pnpm run format:check`, and `pnpm build`.

## Repeatable spatial/browser test

1. Start `./dev.sh`.
2. Open `http://127.0.0.1:5173/tests/browser.html?pass=A`, then click **Run browser regression**. Keep the tab active until **ALL BROWSER CHECKS PASSED** appears.
3. Repeat with `?pass=B`. The runner uses memory storage, so it does not overwrite the normal game save.
4. After success, use the inspection buttons for entry, polygon, Live Room, Mixing A and Clark. Move/jump/orbit manually from those locations. F3 restores diagnostic information.

The runner drives the actual controller, scene manager, renderer, input actions, Web Audio and UI with a deterministic clock. It traverses entry → full polygon loop → Live Room instruments → Mixing Suite A / Spectra → descending Clark stair → Below → return to entry, then the reverse loop and Dead Room / bar / storage branches. Pass B also executes the four-hop ascent to the polygon perch and drops back to the entry route. Camera volume clearance is checked during movement and jumps. Original DJ choices, dialogue, dance, stop, music continuity, scene membership and saving are exercised. This development runner is excluded from the production build.

The Node suite additionally covers every visible upstairs doorway in both passes, sealed suite boundaries, step-up/edge support, coyote expiry, buffered landing jumps, air-jump rejection, ceiling/obstacle handling, camera orbit and recovery, low-step stability, ramps/stacked surfaces, 40 consecutive scene transitions, invalid saves/spawns, audio races and model ownership/fallback.

## Manual release route

- Start at the southeast main entry. Follow the east hall north to the emergency hall, then take the gallery left around the polygon. The gold-framed door in the angled wall enters the Live Room.
- Circle the polygon in both directions. Enter the Dead Room at its north-side gallery door; enter Mixing Suite A through the west door. Use the east aisle around the console to reach the Clark door at the southwest end.
- In the Live Room, approach the instrument fronts. Space/J jumps, F dances. The south door opens into the emergency hall. Continue along the east circulation to bar/kitchen. Private suite panels remain closed and solid.
- In storage, enter from the north gallery and exit east; inspect the case nook without blocking the through-route.
- Optional ascent: jump onto the Live Room overlook, then the taller case, wall-top hop ledge, and central polygon perch. Walk or jump down into the gallery. The underlying central interior stays closed.
- E at the bottom of the Clark steps fades to Below. Use the existing Below stair interaction to return to the upper landing. Music should continue; M should stop it and the crowd response.
- Q/R or right-drag orbit; C recenters; wheel zooms. Hug a wall and orbit through a full turn. The camera should rise for clearance, keep the player visible and recover in open rooms.
- F3 shows scene/pass, XYZ, grounded state, blocking collision ID, ground support, camera obstruction/distance and interaction target.
- Reload on each floor: location and contacts persist, with playback stopped. Old upstairs layout positions reset to the real entry while preserving contacts and music choice. Resize/background/focus changes must not leave movement stuck.
- Production: `pnpm preview` serves the compiled app at `http://127.0.0.1:5174`. Enter, inspect the floor and confirm local assets load without the old CDN script.

## Scope and remaining limits

See `UPSTAIRS_SPATIAL_PLAN.md` for source fidelity and deliberate gameplay exaggerations. These tests verify authored routes and static collision, not exact surveyed dimensions or every possible human movement sequence. Equipment has simple blocking envelopes; arbitrary imported mesh collision and moving platforms are not implemented.

Below's inherited lounge/storage/service connectivity and decorative stairs remain unchanged. This task reconciles upstairs. Sounds remain the existing synthesized fallbacks; Web Audio state/transport behavior is tested, while subjective listening and wider device coverage remain manual work.
