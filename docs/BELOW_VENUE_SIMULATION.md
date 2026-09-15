# Below Breakglass — Venue Simulation Design

## Intent

Below should feel like a real night unfolding inside a recognizable club, not a static room with a DJ interaction. The player should experience crowd pressure, changing attendance, room-to-room acoustics, social side spaces, drinks, lighting, installations, and an arcade cabinet as parts of one venue simulation.

The main club can use a tighter first-person / near-POV presentation than upstairs. This is a deliberate genre shift: upstairs is exploratory and creative; Below is bodily, crowded, immediate nightlife simulation.

## Core state domains

Keep these JSON-friendly so they can later be synchronized in multiplayer:

```text
PartyState
  timeOfNight
  attendance
  targetAttendance
  arrivalRate
  departureRate
  energy
  danceFloorDensity
  barDensity
  takeABreakDensity
  bathroomDensity
  boothDensity
  crowdMood

AudioWorldState
  activeTrackIds
  transportTime
  masterEnergy
  bassEnergy
  beat
  listenerRoom
  doorPortalStates

LightingState
  preset
  haze
  lasers
  strobe
  intensity

EconomyState
  tokens
  tickets
  drinksPurchased

ParticipantState
  hydration
  intoxication
  stamina
  visionEffect
  coordinationPenalty
  socialConfidence
  ejected

InstallationState
  activeInstallationId
  installationProgress
  discoveredInstallations

ArcadeState
  credits
  highScore
  cabinetGameId
```

## Dynamic attendance

Attendance should change during a night instead of being a fixed NPC count.

Suggested arc:

- **Doors / early:** sparse room, awkward pockets, arrivals concentrated around bar / Take A Break.
- **Building:** dance floor starts consolidating and circulation becomes busier.
- **Peak:** main room feels physically difficult to cross; booth approach becomes a crowd-navigation challenge.
- **Late / decline:** crowd thins, some people migrate to chill/social zones, others leave.

Attendance should react to more than time. Inputs can include:

- DJ transition quality
- track/crowd affinity
- sustained dance-floor energy
- silence / bad transitions
- party narrative/event state
- time of night

Do not make departures instantaneous or obviously score-driven. People should drift between zones and out of the venue.

## Crowd navigation

At high density, crossing Below should feel like pushing through a real crowd.

Design goals:

- NPCs loosely part rather than forming hard walls.
- Player movement slows as local density rises.
- Camera receives small damped shoulder/jostle impulses, never nausea-inducing random shake.
- Nearby dancers turn or react when displaced.
- Clear edge routes remain possible for accessibility and frustration control.
- The booth feels rewarding partly because reaching it opens the player's sightline over the room.

For mobile performance, visual crowd size should use instancing / simplified animation / LOD rather than hundreds of expensive individual actors.

## Spatial audio as navigation

The venue should be understandable by ear.

### Main club

Use the real PA positions as spatial emitters or as anchors for a perceptually convincing multi-emitter model. Listener position changes level, stereo/binaural image, direct-to-reverberant ratio and bass relationship.

### Doors and rooms

Treat doors as acoustic portals rather than binary scene switches.

Examples:

- Enter Take A Break: club high frequencies attenuate, direct PA falls, bass bleed remains, nearby chatter becomes dominant.
- Bathroom: strong low-pass / wall transmission plus a short hard tiled reverb for local sounds.
- Open a door: restore direct high-frequency energy continuously rather than snapping.
- Clark stair: club becomes progressively more distant and reflective while ascending.
- Upstairs: Below should remain audible only as plausible distant bleed where architecture permits.

### Crowd sound

Do not make every NPC an audio source. Use a few spatial crowd beds/zones whose density and character respond to `PartyState`:

- dance-floor body / cheer layer
- bar conversation layer
- Take A Break social layer
- bathroom / hallway chatter layer
- entry / coat-check layer

## DJ feedback loop

The club simulation should make DJing consequential without relying on a visible numeric score.

```text
track choice + timing + transition quality
  → musical coherence / energy
  → crowd movement and retention
  → attendance / dance-floor density
  → cheering / crowd sound
  → lighting / haze / laser response
```

A weak set should visibly and audibly thin the dance floor over time. A strong set should pull people inward and hold them there.

## Usable bar

The bar should be physically usable.

First implementation:

- player receives or earns a small number of event tokens / drink tickets
- approach bartender / bar point
- choose from a short fictionalized menu
- spend token
- participant state changes gradually rather than instantly

Avoid real-world price simulation at first. Tokens keep it playful and avoid turning the game into point-of-sale software.

### Drink effects

Intoxication can alter gameplay, but effects should be readable and not glamorized as a power-up.

Possible effects as `intoxication` rises:

- mild visual bloom / focus lag
- slightly delayed camera recentering
- increased input smoothing / coordination penalty
- DJ timing window becomes narrower or crossfader control becomes less precise
- reduced stamina / slower crowd navigation at high levels
- dialogue / NPC reactions change

At excessive levels:

- staff warning
- service refusal
- forced cooldown / water option
- possible ejection from the venue

Ejection should be a funny but consequential failure state, not a punishment loop.

The player should always be able to choose non-alcoholic drinks / water; these can reduce or stabilize state over time.

## Take A Break as installation / chill room

Take A Break should host rotating immersive works and archival pieces.

Potential installation object types:

- multichannel / binaural sound work
- reactive visual projection
- AV archive piece
- interactive field-recording environment
- artist-specific room takeover

Entering an installation can temporarily alter the room's sound routing and visuals without affecting the club transport. The same `MediaObject` / spatial-audio framework should power both archival material and commissioned immersive works.

Take A Break also remains a social decompression zone. People migrate there naturally when they want to talk, rest, or leave the main dance floor.

## Arcade cabinet behind the curtain

The real arcade cabinet location should become a discoverable nested game.

First version:

- cabinet sits in its real approximate corner behind curtain
- interact to switch to a cabinet camera / control mode
- spend no real currency; optionally use one venue token as a playful credit later
- ship one original tiny arcade game created specifically for Breakglass
- local high-score table
- exit returns player to the club at the cabinet

Long-term possibilities:

- multiple unlockable cabinet games
- BG20 high-score challenges
- multiplayer spectators around the cabinet
- archive easter eggs / artist cameos

Do not emulate copyrighted arcade ROMs. The cabinet games should be original.

## First-person / near-POV club camera

Below should support a more immediate perspective than upstairs.

Target feeling:

- lower camera height / closer body relationship
- crowd fills more of the view
- booth reveal feels dramatic
- narrow passages feel physical
- strong chunky silhouettes and readable architecture

Reference early FPS games only for spatial immediacy and readable perspective, not for copied assets, weapons, combat or level geometry.

A pure first-person mode may be optional if mobile camera/navigation proves easier with a very close third-person camera. Evaluate both experimentally.

## Mobile requirements

All venue systems must degrade gracefully on phones:

- touch movement + camera
- simplified crowd LOD
- capped dynamic lights
- reduced laser geometry where necessary
- spatial audio falls back to stereo positioning / room filtering on phone speakers
- binaural/HRTF headphone mode when available
- UI controls large enough for one-thumb use

## Multiplayer implications

When multiplayer arrives, synchronize state rather than hundreds of incidental effects.

Authoritative/shared:

- PartyState
- DJ transport / mixer state
- LightingState
- important door/portal states
- bar inventory/token transactions
- installation active state
- arcade high score / active player

Client-derived:

- most crowd animation
- local haze particles
- light-beam interpolation
- local room reverb / filtering
- secondary crowd-bed variation

This keeps shared club nights coherent without sending every dancer and audio sample across the network.
