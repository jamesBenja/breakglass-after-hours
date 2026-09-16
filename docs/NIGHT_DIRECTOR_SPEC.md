# Breakglass Night Director — Design Specification

Status: **design-only, isolated from the live game**

This document defines the intended architecture for a future `NightDirector` system. It must not be imported into `src/main.js` or deployed until baseline playtest telemetry has been collected and reviewed.

## Purpose

The Night Director should make Breakglass feel like a real night unfolding rather than a static collection of rooms and interactions.

It should coordinate:

- time-of-night progression
- synthetic crowd population and distribution
- named-character schedules and activities
- bar / Take A Break / alley activity
- DJ / dance-floor retention
- police pressure and responses
- lighting / atmosphere presets
- late-night / dawn transitions
- real-player population replacing simulated crowd

It should **not** become a conventional quest director. The player remains free to wander, ignore events, go upstairs early, stay at the bar, DJ, play arcade games, or spend the whole session petting Maddox.

The world should have a shape even when the player does not follow it.

---

## Core design principle

**Time creates opportunities, not mandatory objectives.**

The Night Director controls environmental conditions and character availability. Existing player-driven systems continue to matter.

The resulting club state should be a blend of:

```text
time of night
+ real players present
+ DJ / music quality
+ crowd retention
+ police / neighbour pressure
+ important story flags
+ player activity
= current Breakglass night state
```

This is deliberately different from a scripted quest chain.

---

## Operating modes

### 1. Story / Explorer Night

Default mode for ordinary invitation links.

- One Breakglass night lasts approximately **75 real minutes** by default.
- The session can begin at any point, but a fresh save starts near doors-open.
- The clock continues while the player moves between floors.
- The world progresses even if the player remains in one room.
- Important transitions should be gradual rather than snapping at exact timestamps.

Initial proposed mapping:

| Real elapsed | Virtual time | Phase |
| --- | --- | --- |
| 0–8 min | 22:30–23:15 | doors |
| 8–22 min | 23:15–00:45 | building |
| 22–45 min | 00:45–02:45 | peak |
| 45–62 min | 02:45–04:15 | late |
| 62–72 min | 04:15–05:30 | afterhours |
| 72+ min | 05:30–06:30 | dawn |

These durations are **starting assumptions only** and should be tuned from telemetry.

### 2. Live Event Night

For actual scheduled online events.

- Uses Montreal local event time supplied by the authoritative multiplayer server.
- All players in the same party share the same Night Director state.
- Event configuration can define doors, peak, last call, end time and special scheduled moments.
- Joining late means joining the party at its actual current phase.

The live game should never blindly follow real-world time outside an explicitly configured Live Event Night.

### 3. God Mode / Director Preview

God Mode should eventually expose a private control for:

- freeze / resume time
- jump to Doors / Building / Peak / Late / Afterhours / Dawn
- set target synthetic attendance
- preview named-character schedules
- force police / calm state
- simulate 0 / 10 / 25 / 50 / 100 real players

This is for testing and production, not normal players.

---

## Night phases

Phases are soft envelopes, not rigid scenes.

### Doors

Feeling:
- sparse
- slightly awkward
- people are arriving rather than fully settled

Club:
- low synthetic attendance
- house DJ or early set
- small pockets rather than one consolidated dance floor
- bar and Take A Break proportionally busier than dance floor

Alley:
- arrivals / smoking / greeting groups
- low neighbour pressure

Named characters:
- Sam focused on entry
- James circulating between entry / Below
- Courtney / Simla setting into service
- Nora occasional photos rather than rapid coverage
- upstairs staff more likely to be working than socializing

### Building

Feeling:
- momentum
- people recognize that the night is becoming busy

Club:
- arrival rate exceeds departure rate
- dance floor consolidates
- bar queue grows
- DJ quality begins influencing retention strongly

Named characters:
- James increasingly downstairs
- Nora begins active photography loop
- Devin / Beaver / Malaika become more socially visible
- some studio characters can migrate downstairs between tasks

### Peak

Feeling:
- crowded, physical, energized

Club:
- highest target population
- dance floor is difficult but possible to cross
- booth approach has crowd pressure
- bar and bathroom density elevated
- Take A Break becomes a decompression zone

Named characters:
- major DJ activity
- Nora / Malaika photo loop active
- James frequently dealing with booth / people / problems
- lower probability of long explanatory conversations in the main room

### Late

Feeling:
- crowd is smaller but more committed
- conversation becomes more important

Club:
- slow departure begins
- weaker DJing accelerates departures
- strong DJing can delay decline
- more people migrate to Take A Break / alley

Narrative opportunities:
- easier access to deeper conversations
- secrets more discoverable
- archive / studio routes become more attractive
- police risk increases if alley spill-out is high

### Afterhours

Feeling:
- the public night is dissolving into staff / friends / core dancers

Club:
- smaller dance floor
- bar service winding down
- fewer synthetic strangers
- named characters become disproportionately visible

Studio / roof:
- increased likelihood of studio exploration
- Jace / Boogaloo / Zander interactions become more intimate
- Maddox / roof payoff can become a natural late-night beat

### Dawn

Feeling:
- decompression / memory / aftermath

Club:
- almost empty
- cleanup / sitting / final tracks

World:
- roof and alley visually change toward morning
- founder / history conversations become available
- optional end-of-night recap can trigger

Dawn should never forcibly eject the player from the experience. It is a mood and state transition.

---

## PartyState extension

The existing party state should be extended rather than replaced.

Proposed serializable model:

```js
NightState = {
  mode: 'story' | 'live' | 'god',
  phase: 'doors' | 'building' | 'peak' | 'late' | 'afterhours' | 'dawn',
  virtualMinute: 0,
  elapsedSeconds: 0,
  paused: false,

  realPlayers: {
    total: 0,
    alley: 0,
    downstairs: 0,
    upstairs: 0,
    roof: 0,
  },

  population: {
    desiredTotal: 0,
    desiredSynthetic: 0,
    danceFloor: 0,
    bar: 0,
    takeABreak: 0,
    bathroom: 0,
    booth: 0,
    alley: 0,
    upstairsSocial: 0,
  },

  activity: {
    dance: 0,
    drinking: 0,
    talking: 0,
    photographing: 0,
    smokingOutside: 0,
    sitting: 0,
    leaving: 0,
  },

  pressure: {
    arrivals: 0,
    departures: 0,
    djRetention: 0,
    spillOut: 0,
    police: 0,
  },

  flags: {
    policePresent: false,
    evacuation: false,
    barClosing: false,
    dawnReached: false,
  },

  revision: 0,
  updatedAt: 0,
};
```

The authoritative multiplayer server should eventually own the shared NightState in Live Event mode.

---

## Population model

### Human players replace synthetic crowd

Synthetic attendance should represent the **missing bodies needed to achieve the desired atmosphere**, not an independent population layered on top of real players.

Conceptually:

```text
desired visible occupancy in a zone
- real players currently in that zone
= synthetic target for that zone
```

Example:

Peak target downstairs = 70 bodies

- 8 real people downstairs → target ~62 synthetic people
- 35 real people downstairs → target ~35 synthetic people
- 65 real people downstairs → target ~5 synthetic people

Use smoothing and hysteresis so NPCs do not pop in/out every time someone crosses a doorway.

### Population envelopes

Starting design targets for Story mode, to be tuned from analytics:

| Phase | Total synthetic target | Dance share | Bar | Take A Break | Alley |
| --- | ---: | ---: | ---: | ---: | ---: |
| Doors | 18–30 | 15–30% | high relative | high relative | medium |
| Building | 35–55 | 40–60% | high | medium | medium |
| Peak | 60–84 | 65–85% | high absolute | medium | low–medium |
| Late | 38–60 | 50–75% | medium | high relative | high |
| Afterhours | 18–35 | 45–70% | low | high relative | high relative |
| Dawn | 6–18 | 20–50% | closed / cleanup | medium | medium |

The current `CrowdSystem.max` of 84 already aligns well with the initial Peak envelope.

---

## DJ feedback loop

The Night Director should consume the existing crowd / DJ metrics instead of duplicating them.

Inputs:
- playing
- vibe
- mixQuality
- energy
- danceFloor share
- sustained silence
- abrupt failure / bad blend

Time defines a **baseline target**. DJ quality modifies retention around that baseline.

Example:

```text
phase baseline target
× retention modifier
+ scheduled-event modifier
- shutdown / police modifier
= desired attendance
```

Important behavior:

- Great DJing at 03:30 can hold the room above the normal Late curve.
- Weak DJing at Peak can cause people to drift to Take A Break / alley.
- Silence should not instantly empty the venue, but sustained silence should accelerate departures.
- Crowd changes should always feel like migration, not a scoreboard punishment.

---

## Police integration

The existing alley / police system becomes one of the Director's strongest emergent narrative inputs.

Rules:

- Night phase changes the **probability of spill-out**, not police rules themselves.
- Late / Afterhours naturally produce a larger outside share.
- Strong floor retention reduces spill-out.
- Police arrival should temporarily alter character schedules and crowd behavior.

When police arrive:

- some synthetic alley NPCs go inside or leave
- James becomes available for the police-resolution route if not already occupied by a critical interaction
- Sam / staff become more stationary and operational
- bar / DJ / named NPC dialogue can acknowledge the event
- lighting / music state may subtly respond if escalation becomes serious

If shutdown occurs:

- synthetic crowd departs in waves
- DJ state stops
- bar closes
- named characters change activities
- player retains freedom to explore allowed aftermath spaces rather than receiving an abrupt game-over screen

---

## Lighting / atmosphere integration

The Director should request high-level presets rather than manipulate fixtures directly.

Suggested presets:

- `doors-warm`
- `building-active`
- `peak-saturated`
- `late-deep`
- `afterhours-minimal`
- `dawn-cool`
- `police-interruption`
- `shutdown-worklight`

Existing lighting controls remain authoritative where a real player has explicitly taken control. The Director should not constantly fight a human lighting operator.

---

## Crowd activity states

Synthetic people should stop behaving as only `dance` vs `social`.

Future activity vocabulary:

```text
dance
stand-talk
walk
bar-queue
drink
sit
photo-pose
watch-dj
bathroom-queue
smoke
arrive
leave
```

A first implementation does not need unique animation for every state. The state model should exist first so visual sophistication can improve later without redesigning the director.

---

## Multiplayer authority model

Shared / authoritative:

- Night mode
- phase
- virtual time
- target populations per zone
- named-character current schedule slots
- major event flags
- police state

Client-derived:

- exact location / animation of incidental synthetic NPCs
- which individual synthetic dancer occupies which spot
- secondary crowd-bed variation
- haze / tiny visual effects

This is important for future 50–100-player scaling. We should synchronize **intent and state**, not every fake person's transform.

---

## Named-character presence

The Night Director owns **where named NPCs are allowed to exist**.

Each named character should have only one canonical active presence in the shared world, except where deliberately represented as archival footage / media rather than a live NPC.

A character schedule consists of weighted slots rather than exact minute-by-minute rails.

Example:

```js
{
  characterId: 'james',
  phase: 'building',
  options: [
    { zone: 'below:host-floor', activity: 'host', weight: 0.5 },
    { zone: 'below:dj-booth', activity: 'check-dj', weight: 0.25 },
    { zone: 'alley:entry', activity: 'door-check', weight: 0.15 },
    { zone: 'upstairs:control-room', activity: 'producer', weight: 0.1 },
  ],
}
```

Critical progression interactions override ordinary schedule movement when necessary.

See `NIGHT_DIRECTOR_CHARACTER_SCHEDULES.md`.

---

## Guidance without quest markers

Night Director can indirectly solve onboarding problems by changing character visibility.

Examples:

- A player who has not met James yet sees him in higher-traffic spaces during early phases.
- Jace becomes more likely to be near the tape-storage route after the player has reached upstairs but before archive access is granted.
- Boogaloo becomes more likely to be near the Dead Room corridor after repeated locked-door attempts.
- Easy mode can bias schedules toward discoverability.
- Hard mode does not alter schedules for the player's benefit unless required for basic progression.

This remains diegetic guidance rather than arrows / quest markers.

---

## Telemetry hooks needed before rollout

The existing telemetry should capture enough baseline information to tune this system.

Most important baseline measures:

- first-20-minute room distribution
- median time from invite → Sam → admission
- first named NPC spoken to
- time until James interaction
- time until upstairs arrival
- repeated locked-door attempts
- duration in Below vs alley vs upstairs
- session abandonment location
- DJ participation and duration
- police occurrence / resolution

After Night Director is tested, compare the exact same metrics against baseline.

Success is not simply 'players do more things.'

Success means:

- fewer unexplained stalls
- stronger movement between spaces
- meaningful differences between phases
- players still feel free rather than directed
- named characters feel like people with lives rather than terminals

---

## Rollout gates

Do not merge into the canonical live branch until all are true:

1. At least ~15–25 clean baseline sessions or ~5–10 aggregate hours of fresh play telemetry exist.
2. Baseline first-20-minute room distribution has been reviewed.
3. Character schedule conflicts are documented.
4. A pure-data phase simulation passes unit tests without touching rendering / audio.
5. God Mode can preview each phase safely.
6. Multiplayer authority behavior is defined for reconnect / late join.
7. A two-client test confirms both players see the same phase / named-character location.
8. Existing DJ/audio architecture remains untouched except through public metrics / preset interfaces.

---

## First implementation scope

The first deployed Night Director should be intentionally conservative.

Version 1:

- Story mode accelerated clock
- six phases
- phase-driven baseline attendance
- real-player subtraction from synthetic targets
- simple distribution among dance floor / social / alley
- named-character single-presence schedules for James, Jace, Boogaloo, Nora, Malaika, Devin, Beaver, Courtney, Simla, Zander, Sam
- high-level lighting preset requests
- police schedule override
- telemetry of phase transitions and population targets
- God Mode phase preview

Not Version 1:

- procedural architecture changes
- hundreds of unique NPC agents
- fully simulated individual needs
- calendar-aware real-world event programming
- weather integration
- machine-learning behavior

The goal is to make the existing world feel alive, not build a city simulator.
