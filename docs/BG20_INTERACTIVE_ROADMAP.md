# BG20 Interactive Breakglass Roadmap

## Product idea

**Breakglass: After Hours** should evolve from a walkable prototype into a playable BG20 companion: part music game, part virtual venue, part collaborative studio, and part living archive of Breakglass history.

The building is the interface. The player should encounter music, broadcasts, parties, sessions, immersive pieces and people spatially rather than through a conventional archive menu.

## Product pillars

### 1. Breakglass as a fun 3D place

The real building plan remains the source of truth, but traversal should have the spatial pleasure of a strong 3D platformer/collectathon: readable landmarks, looping circulation, optional height, shortcuts, hidden nooks, rooms with distinct identities and movement that is enjoyable before objectives exist.

### 2. Music-making as gameplay

The Live Room should function as an instrument playground. The long-term loop is:

`play instrument → capture phrase → bring phrase into control room → arrange/mix → take material downstairs → DJ/play it for a crowd`

The game does not need to simulate a DAW or professional studio literally. Each interaction should teach itself quickly and preserve the feeling of being in the room.

### 3. Below as a real club game

Below needs a proper music/lighting/crowd feedback loop:

`track choice + timing + transition quality → crowd energy → dance animation + lighting + haze + laser behavior`

The physical booth is a destination, not a menu hotspot. The club should feel dramatically different from upstairs.

### 4. BG20 living archive

Historical media should be discovered in-world:

- old broadcasts playing on screens/projectors
- posters that unlock event material
- old sessions available from tape/session objects
- party recordings heard in the club
- immersive sound pieces experienced spatially
- releases discovered as records and added to the DJ crate
- photos/videos tied to rooms and events

The archive should feel collectible and explorable rather than like a website embedded inside a game.

### 5. Multiplayer Breakglass

Design state now so multiplayer can be layered on later without rewriting the game.

Three target modes:

1. **Hangout** — explore, talk, dance and watch/listen together.
2. **Club** — one or more users DJ while everyone shares music/lighting/crowd state.
3. **Studio** — users build a shared song by recording phrases/stems into one synchronized timeline.

## Architecture principles

Keep systems separated into small serializable state domains:

- `PlayerState`
- `DjState`
- `LightingState`
- `CrowdState`
- `SessionState`
- `MediaState`
- `ArchiveUnlockState`

The multiplayer layer should synchronize state, not own the game logic.

For shared music playback, synchronize **transport state and timestamps**, not a continuously streamed master mix where possible. Clients should schedule locally held audio against an agreed clock.

Remote studio recording should be phrase/loop oriented rather than promising impossible zero-latency internet jamming. Record locally, upload/transfer the take, then place it precisely on the shared musical grid.

## Near-term milestones

### Milestone A — Club identity and reactive lighting

- more Breakglass-like walls/floor/acoustic treatment
- real dance-floor ring landmark
- adjustable lighting presets
- adjustable haze
- laser beams
- strobe accents
- audio-energy analysis
- NPC dance intensity reacts to energy
- lighting state kept JSON-friendly for future multiplayer

### Milestone B — Actual DJ mini-game

Create a dedicated DJ system instead of overloading `AudioEngine`.

First version:

- two virtual decks
- track library / crate
- play/pause
- transport position
- simple BPM metadata
- cue/start position
- crossfader
- simplified sync/tempo relationship
- transition-quality / crowd-energy score
- lighting system listens to crowd/audio energy

Do not reproduce Rekordbox/CDJ complexity.

### Milestone C — Catalogue pipeline

Build a manifest for cleared James Benjamin / Breakglass catalogue material:

- title
- artist
- source file
- BPM
- optional key
- duration
- cue points / excerpt ranges
- artwork
- rights/public-release status
- browser asset URL

Keep source WAV masters in Drive. Put optimized game assets in the deployment/media pipeline, not giant source WAVs in Git.

### Milestone D — Control Room stem mixer

Use the existing four-stem candidate first:

- drums
- bass
- vocals
- synths / FX

Required engine behavior:

- one shared transport clock
- perfectly synchronized stems
- play/pause/restart
- per-stem mute/solo
- level controls
- optional scene/console camera mode

### Milestone E — Media/archive framework

Create a generic `MediaObject` model that can represent:

- video screen
- audio playback object
- photo/poster
- spatial audio zone
- collectible record/tape/session

The same framework should be reusable across 20 years of content.

### Milestone F — Studio phrase recorder

Playable instrument interactions gain a small recorder:

- record fixed musical length
- quantize/trim to phrase grid
- name/store phrase
- place phrase into current studio session
- hear it back in control room

### Milestone G — Multiplayer presence

Only after the single-player state models above are stable:

- authoritative room server
- join code / room id
- remote avatars
- synchronized player transforms at modest rate
- shared DJ / lighting / media state
- WebRTC voice as a separate media layer

Then add shared studio timeline and local high-quality recording transfer.

## What should use expensive Codex/Astra passes

Reserve large-model repo-wide work for:

- major multiplayer/server architecture
- difficult scene/collision refactors
- large test migrations
- complex deployment/infrastructure work
- final integration audits

Ordinary feature iteration, asset research, state design, smaller modules and targeted fixes should remain normal repo work.

## Success test

The project is succeeding when a person who has never been to Breakglass can enter the game and naturally understand that this is simultaneously:

- a real place
- a studio
- a club
- a playable music system
- a social space
- an archive with history worth discovering
