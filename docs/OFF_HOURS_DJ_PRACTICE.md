# Off-Hours DJ Practice Mode

## Intent

Below Breakglass should exist as a usable venue even when there is no party. This mirrors the real-world pattern where the club can be used for DJ rehearsal/practice outside event hours and makes the building feel like one connected creative ecosystem rather than two unrelated levels.

## World states

The club should support at least three broad operating modes:

### 1. Party mode

- active crowd / dynamic attendance
- bouncer / lineup / coat-check flow
- staffed bar
- DJ schedule / queue
- lighting, haze, lasers, crowd feedback
- Nora photography

### 2. Off-hours / rehearsal mode

- little or no crowd
- no bouncer line
- club access available from inside the building to authorized/current players
- booth powered up for practice
- PA can run at a practice-safe level
- lighting defaults to work/rehearsal state, with optional lighting practice controls
- no bar service unless a specific event/session state enables it
- club acoustics remain spatial and fully simulated

### 3. Closed / unavailable mode

- booth or room inaccessible because of another booking, maintenance, event prep, or story condition
- state should be communicated through the environment rather than a generic error where possible

## Access from the studio

A player in the studio should be able to decide to go downstairs and practice DJing when Below is available.

This should feel physical:

`studio floor → Clark-side circulation/stairs → Below → empty/quiet club → booth`

The emotional contrast is useful. During a party, Below feels crowded and difficult to cross. Off-hours, the same room feels large, empty and available for experimentation.

## DJ practice gameplay

Practice mode should expose the same core `DjState` and deck engine used during parties, but without crowd pressure.

Possible activities:

- free-mix tracks from unlocked crate
- practice cueing and transitions
- learn controls with no failure consequence
- audition catalogue tracks in the actual spatial PA
- test lighting presets / haze / lasers when allowed
- save a rehearsal mix or personal best transition streak
- prepare for a future booked set

The same physical booth should be used in all modes. Do not create a separate tutorial UI-only DJ system.

## Role integration

Players who chose DJ as one of their roles should naturally receive prompts like:

- `Below is free right now — want to practice?`
- `Your booked set starts later; you can rehearse downstairs.`

Non-DJ players can still discover and use practice mode unless a specific event/booking state restricts access.

## Multiplayer

Off-hours practice can support:

- B2B rehearsal with another player
- one player DJing while friends listen/dance in an otherwise empty club
- remote collaborators testing a set before an event

Because party systems are absent or minimal, this is also a good early multiplayer test environment.

## Audio / spatial identity

The empty club should sound dramatically different from party mode:

- less crowd absorption/noise
- more audible room/reverb character
- clearer footsteps and booth mechanics
- spatial PA image remains active
- room-to-room muffling still works

Crowd density may eventually affect effective room damping so a packed party and empty rehearsal night have subtly different acoustic signatures.

## Scheduling / booking state

Long term, availability can be driven by a simple venue schedule state:

```text
ClubAvailabilityState
  mode: party | rehearsal | closed
  currentBookingId
  availableUntil
  nextEventAt
  accessRoles
```

This can later connect naturally to the wider BG20 event calendar / multiplayer room system without changing the booth gameplay code.
