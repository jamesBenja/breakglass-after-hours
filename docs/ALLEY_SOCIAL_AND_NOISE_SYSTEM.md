# Alley Social + Neighborhood Noise System

## Intent

The alley is both the club arrival route and a believable social spill-out zone during events. It should feel like a real venue relationship with its neighborhood, not a consequence-free outdoor extension of the dance floor.

The game should support people stepping outside to smoke / get air / talk, while staff periodically remind the group to keep voices down and avoid neighborhood disturbance.

## Core behavior

During party mode:

- a small percentage of attendees periodically migrate to the alley
- some are smoking, some are simply cooling off / talking / waiting for friends
- the alley crowd ebbs and flows with `PartyState.attendance`, time of night and indoor density
- players can step outside and re-enter without going through full admission again
- bass bleed from the club remains audible but attenuated and mostly low-frequency
- there are no outdoor loudspeakers

## Noise state

Keep a small serializable state model:

```text
AlleyState
  occupancy
  conversationLevel
  disturbance
  staffWarningLevel
  lastWarningAt
  neighborTolerance
```

`disturbance` rises with:

- number of people outside
- loud group conversation
- shouting / cheering
- repeated door openings
- very late time-of-night multiplier

It falls gradually when people lower their voices or return inside.

## Staff intervention

At low disturbance, no intervention.

At moderate disturbance, a staff character walks over / calls out a brief reminder such as:

- "Keep it down out here, please."
- "Quiet in the alley, neighbors are sleeping."
- "Bring the energy back inside."

At higher disturbance:

- staff becomes more direct
- the outside group begins dispersing
- the door may temporarily restrict additional spill-out
- repeated player behavior can lower social/venue standing or trigger a brief forced return indoors

The system should be readable and slightly funny/realistic, not punitive or preachy.

## Social gameplay

The alley should still be desirable:

- quieter conversations than the club
- chance encounters with characters / other players
- Nora may occasionally take exterior portraits
- James may pass through while checking the door / handing out drink tickets earlier in the night
- friends can regroup there
- a booked DJ can step out before or after a set

## Smoking representation

Smoking is ambient venue behavior, not a rewarded mechanic.

If the player chooses to smoke in a later implementation, do not provide buffs, bonuses or progression rewards. The core feature works even if player smoking is never implemented: NPC smoking and "going outside for a smoke" are enough to establish the real club behavior.

## Audio design

The alley is an important spatial-audio transition:

- club highs are strongly attenuated through the door/walls
- bass remains audible as low-frequency bleed
- opening the door briefly restores direct high-frequency content
- voices, footsteps and city/alley ambience become foreground sounds outside
- the player's position along the long alley changes how direct the club sounds

This should make the difference between inside and outside obvious even without UI labels.

## Multiplayer

In multiplayer, alley occupancy and disturbance should be shared at a coarse level. Individual voice chat does not need to be analyzed for loudness in V1; player actions / local emotes / scripted crowd noise can drive the simulation instead.

## Design rule

The alley is a social decompression space and an arrival corridor, but never a second dance floor. The neighborhood-noise constraint is part of its identity.
