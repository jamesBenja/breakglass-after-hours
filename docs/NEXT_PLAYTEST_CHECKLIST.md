# Next Playtest Checklist

## Purpose

Freeze feature growth for one playtest. The goal is to evaluate the current branch as a game, not to inspect every future idea at once.

## Before playing

- Fetch/switch to `feat/club-lighting-foundation`.
- Start the dev build normally.
- Use headphones for at least one pass if convenient.
- Do not merge the PR yet.

## Playtest pass 1 — move through the world

Ignore most interactions for the first few minutes.

Ask:

- Does upstairs now feel recognizably based on Breakglass rather than a generic studio?
- Is moving/jumping around intrinsically enjoyable?
- Are doors, circulation and stairs obvious without labels doing all the work?
- Does the studio feel too game-like, too architectural, or roughly right?
- Which room or surface immediately looks fake/generic because of material/texture?

## Playtest pass 2 — Below

Go downstairs and spend a few minutes only in the club.

Ask:

- Does Below feel dramatically different from upstairs?
- Does it feel remotely like the real club yet?
- Is the DJ booth physically readable as a destination?
- Is the dance-floor ring helping the room identity?
- Do the speaker positions / acoustic slats / darker treatment help?
- Does the current camera feel too detached? Would first-person or close-shoulder be better?
- Imagine the room full of bodies: does the architecture still make sense for a packed-club simulation?

## Playtest pass 3 — lighting

At the DJ booth, try:

- Warmup
- Party
- Peak
- lasers on/off
- haze up/down
- both placeholder tracks

Ask:

- Are the differences between presets obvious enough?
- Are the lasers legible and fun or cheap-looking?
- Is haze helping depth?
- Is anything visually overwhelming or hard to navigate?
- Does the room feel like it wants a more realistic fixture layout?

## Playtest pass 4 — audio / atmosphere thought experiment

The current build does not yet implement the full spatial-audio system. While moving, note where you expect the sound to change strongly:

- stairwell
- club floor
- booth
- Take A Break
- bar
- bathroom / hallway
- upstairs bleed
- exterior / alley

These notes will define the first room/portal acoustic model.

## Screenshots / feedback

The highest-value feedback is simple and visual. Capture screenshots of anything that feels wrong and annotate in plain language, for example:

- “this wall should be brick / darker / wood”
- “this should feel much tighter”
- “I want to see the booth from here”
- “this looks nothing like the real club”
- “I want to climb onto that”
- “camera should become first-person here”

No technical diagnosis is required.

## Explicitly NOT being judged yet

Do not judge the current branch for missing future systems already planned:

- mobile controls
- full spatial audio / room occlusion
- crowds and dynamic attendance
- avatar creation
- club entry / lineup / bouncer
- bar / drink-state system
- Nora photography
- persistent Take A Break installations
- arcade cabinet game
- exterior block / GTA-like urban layer
- police/noise response
- off-hours DJ rehearsal
- real catalogue tracks / two-deck DJ engine
- multiplayer

Those are now part of the product plan, but should not distract from evaluating the current architectural / lighting baseline.

## Decision after playtest

After this playtest, choose the next implementation branch based on what feels weakest in practice, not what sounds coolest on paper.

Likely candidates:

1. `feat/below-identity-camera` — make Below recognizably real + settle first-person / close-POV camera.
2. `feat/spatial-audio-world` — room/portal filtering, real PA emitters, headphone HRTF path.
3. `feat/dj-engine-v1` — real two-deck interaction and catalogue manifest.
4. `feat/mobile-foundation` — touch controls, responsive UI, mobile performance budget.

Default recommendation if the current club still feels visually generic: do **Below identity + camera first**, then spatial audio, then DJ engine, with mobile constraints kept active throughout.
