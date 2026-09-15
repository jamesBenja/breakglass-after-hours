# Take A Break — Persistent Installation Space

Take A Break remains an active immersive-installation / chill room in **all** venue operating states, not only during parties.

## Venue-state behavior

### Party mode

- installation remains active while Below operates as a crowded club
- Take A Break functions as decompression/social space plus immersive work
- club sound enters as filtered bass/high-frequency bleed through the room/door acoustic model
- crowd migration into the room varies with party energy and density

### Off-hours / DJ rehearsal mode

- installation remains available even when the main club is empty or being used for DJ practice
- the quieter building allows the installation's spatial-audio detail to become more prominent
- players can move freely between booth practice and the installation
- this mode is useful for experiencing longer works without party crowd pressure

### Studio-day / session mode

- studio visitors can go downstairs and experience the current installation when venue access allows
- Take A Break becomes part of the broader Breakglass creative campus rather than a party-only room
- studio collaborators can take breaks there, hear/watch archive works, or encounter commissioned pieces

### Closed / restricted club state

- `Below` and `Take A Break` access should be independently controllable
- a closed main club does not automatically imply the installation room is unavailable

## Installation continuity

`InstallationState` should persist independently of `PartyState` and `VenueMode`.

Suggested fields:

```text
InstallationState
  activeInstallationId
  availability
  playbackState
  progress
  discoveredInstallations
  roomLightingState
  roomAudioState
```

The current installation can therefore survive transitions such as:

`studio day → DJ rehearsal → party doors → peak club → after-hours`

without being torn down or reset unless the work itself specifies a schedule.

## Design principle

Take A Break is the permanent home for rotating immersive / archival works. The main club changes personality throughout the day; the installation room remains a consistent cultural destination inside Breakglass.
