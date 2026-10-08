# House DJ Feeder

The gameplay source of truth is `src/gameplay/houseDjFeeder.js`. Edit that file to tune how each
house DJ behaves without rewriting the booth system.

Each DJ has six gameplay controls:

- **style**: short human-readable direction shown at the production desk.
- **transitionSeconds**: minimum/maximum overlap between the outgoing and incoming track. There is
  always overlap, so NPC sets do not stop between songs.
- **phraseBars**: intended phrasing character for future phrase-aware cue-point logic.
- **vibe**: baseline dance-floor attraction while that house DJ is playing.
- **mixQuality**: baseline blend quality used by crowd and party-pressure systems.
- **risk**: how assertive/adventurous the gameplay model should become as transition logic expands.
- **animationEnergy**: physical booth movement.

These are editable game-direction defaults, not ratings or claims about the real artists. They are
kept separate from audio routing so changing a DJ personality cannot alter the shared spatial buses,
the Take A Break eight-speaker installation, studio playback, or multiplayer transport ownership.

## Current roster

Lunice, Kaytranada, James Benjamin, DJ FLLEUR / Malaika, Siren Mars, Monib, Hydra, Bootyspoon,
Marie Davidson, and Frankie Teardrop all have feeder entries.

## Audio rule

House DJ tracks use one logical `house-dj` acoustic source bus. Transitions run two local decoded
sources briefly on that same bus and crossfade them. That means a blend can overlap musically while
still behaving as one spatially zoned club source in the alley, bathroom, studio floor and Take A
Break.
