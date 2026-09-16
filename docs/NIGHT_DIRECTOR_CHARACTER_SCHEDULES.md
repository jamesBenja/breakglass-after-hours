# Breakglass Night Director — Character Schedules

Status: **design-only**

This document proposes the first single-presence schedule model for recurring Breakglass characters. It is deliberately conservative: characters should feel mobile and purposeful without becoming difficult to find or breaking progression.

## Rules

1. A named character has **one canonical active location at a time** in the shared world.
2. Progression-critical interactions can temporarily override the ordinary schedule.
3. Characters do not teleport visibly. Moves should happen when off-camera / across scene transitions / through plausible routes whenever practical.
4. Easy mode may bias important characters toward discoverable locations.
5. Hard mode should preserve believable schedules without extra discoverability bias.
6. A player already in a dialogue / escort sequence should not lose the NPC because the phase changed.
7. Police / shutdown and explicit scripted events can override schedules.
8. Human-controlled host mode can temporarily replace the NPC representation of James or another supported character later.

---

## CharacterState proposal

```js
CharacterState = {
  id: 'james',
  phase: 'building',
  role: 'clubHost',
  zone: 'below:floor',
  destinationZone: null,
  activity: 'circulate',
  available: true,
  busyReason: null,
  scheduleLockedUntil: 0,
  progressionOverride: null,
  revision: 0,
};
```

Named-character schedules should be server-authoritative in shared multiplayer sessions.

---

# Core schedules

## Sam — front-door security

Sam should be the most stationary named character because his location communicates game structure.

### Doors
- primary: `alley:front-door`
- activity: checking arrivals / guestlist
- availability: high

### Building
- primary: `alley:front-door`
- activity: security / occasional short conversation

### Peak
- primary: `alley:front-door`
- activity: busy security
- dialogue should become slightly shorter / operational

### Late
- primary: `alley:front-door`
- activity: door + alley awareness

### Afterhours
- primary: `alley:front-door` or just inside entry
- activity: fewer arrivals, more neighbour / exit awareness

### Dawn
- primary: entry / alley
- activity: winding down / watching departures

Overrides:
- police: stays operational near front door / alley
- evacuation: directs people out

---

## James — host / producer / DJ / problem-solver

James is the character whose schedule most strongly communicates the night changing.

### Doors
Weighted options:
- 45% `alley:entry-social` — greeting people / guestlist problem solving
- 35% `below:host-floor` — checking the room
- 20% `below:bar-edge` — staff / guest interaction

Progression bias:
- before player admission / guestlist resolution, James should remain reasonably findable in alley / Below circulation

### Building
Weighted options:
- 50% `below:host-floor`
- 20% `below:dj-booth-edge`
- 15% `below:take-a-break`
- 10% `alley:entry-social`
- 5% `upstairs:control-room`

Activities:
- host
- check DJ
- film photo moment
- quick bar / guest check

### Peak
Weighted options:
- 55% `below:dj-booth-edge`
- 30% `below:host-floor`
- 10% `below:take-a-break`
- 5% `alley:entry-social`

Peak should make James feel busy. Long technical / archive conversation belongs elsewhere unless progression requires it.

### Late
Weighted options:
- 35% `below:host-floor`
- 20% `below:take-a-break`
- 20% `alley:social`
- 15% `upstairs:control-room`
- 10% `upstairs:live-room`

### Afterhours
Weighted options:
- 35% `upstairs:control-room`
- 20% `upstairs:live-room`
- 20% `below:floor`
- 15% `alley:social`
- 10% `roof:founders`

### Dawn
Weighted options:
- 45% `roof:founders`
- 25% `alley:wind-down`
- 20% `upstairs:control-room`
- 10% `below:cleanup`

Overrides:
- guestlist referral: become reachable in alley / Below
- player asks to DJ: remain in conversation until access resolved
- police: if player chooses “find James”, James temporarily becomes available to resolve shared police state
- active James DJ set: booth locked as his schedule location
- roof founder scene: schedule locked to roof for scene duration

---

## Jace — studio guide / tape archive gate

Jace should mostly belong upstairs and become increasingly conversational later in the night.

### Doors
- `upstairs:control-room` / `upstairs:circulation`
- activity: working / setup

### Building
Weighted:
- 45% `upstairs:control-room`
- 30% `upstairs:main-circulation`
- 15% `upstairs:live-room`
- 10% `below:brief-social`

### Peak
Weighted:
- 50% `upstairs:control-room`
- 25% `upstairs:main-circulation`
- 15% `below:take-a-break`
- 10% `upstairs:live-room`

### Late
Weighted:
- 40% `upstairs:main-circulation`
- 25% `upstairs:control-room`
- 20% `upstairs:storage-corridor`
- 15% `below:take-a-break`

### Afterhours
Weighted:
- 35% `upstairs:storage-corridor`
- 30% `upstairs:control-room`
- 20% `upstairs:live-room`
- 15% `roof:founders`

### Dawn
- `roof:founders` or `upstairs:control-room`

Progression bias:
- if upstairs reached but tape archive is locked, increase probability of `main-circulation` / `storage-corridor`
- repeated storage-door attempts should strengthen that bias on Easy / Medium

Override:
- “tell me about the tape archives” escort locks schedule until escort completes

---

## Boogaloo — artist / studio tech / Dead Room gate

### Doors
- upstairs, likely Live Room / gear setup

### Building
Weighted:
- 45% `upstairs:live-room`
- 30% `upstairs:control-room`
- 15% `upstairs:circulation`
- 10% `below:brief-social`

### Peak
Weighted:
- 40% `below:floor-social`
- 25% `below:take-a-break`
- 20% `upstairs:live-room`
- 15% `upstairs:control-room`

### Late
Weighted:
- 40% `upstairs:dead-room-corridor`
- 25% `upstairs:live-room`
- 20% `below:take-a-break`
- 15% `upstairs:control-room`

### Afterhours
- mostly upstairs around guitars / amps / session areas

### Dawn
- upstairs social / roof possibility

Progression bias:
- repeated Dead Room attempts increase discoverability near `dead-room-corridor`

Override:
- amp/guitar conversation + escort locks schedule until Dead Room unlock sequence completes

---

## Zander — studio tech / upstairs access figure

### Doors
- upstairs technical setup

### Building
- mostly `upstairs:entry` / `control-room` / technical zones

### Peak
- still upstairs, occasionally Live Room

### Late
- studio circulation / patch / machine areas

### Afterhours
- Live Room / control room

### Dawn
- cleanup / studio wind-down

Invitation behavior:
- producer/musician invite receives immediate studio access when speaking to Zander
- ordinary access continues to use existing question / progression rules

Zander should remain easier to locate than Jace / Boogaloo because he communicates studio access and technical orientation.

---

## Nora — photographer

Nora should have one of the most visibly dynamic schedules.

### Doors
Weighted:
- 45% `alley:arrival-photos`
- 30% `below:entry-social`
- 25% `below:take-a-break`

### Building
Weighted:
- 40% `below:dance-floor-edge`
- 25% `below:bar`
- 20% `below:take-a-break`
- 15% `alley:social`

### Peak
Weighted:
- 55% `below:dance-floor-edge`
- 25% `below:dj-booth-edge`
- 15% `below:take-a-break`
- 5% `bar`

### Late
Weighted:
- 30% `below:take-a-break`
- 25% `below:dance-floor-edge`
- 20% `alley:social`
- 15% `bar`
- 10% `upstairs:studio-visit`

### Afterhours
Weighted:
- 30% `alley:social`
- 25% `below:take-a-break`
- 20% `upstairs:studio-visit`
- 15% `below:late-floor`
- 10% `roof`

### Dawn
- roof / alley / last-photo moments

Overrides:
- active group-photo sequence locks Nora temporarily
- photo consent rules remain authoritative

---

## Malaika / FLLEUR — hype / DJ / photo-social character

### Doors
- Below / alley social

### Building
- often with Nora or circulating Below

### Peak
- dance floor / DJ booth / Nora-photo hype loop
- if scheduled to DJ, booth becomes exclusive location

### Late
- Take A Break / dance floor / alley

### Afterhours
- smaller social groups / potential DJ set / photo involvement

### Dawn
- alley / roof / late social

Important:
- when “with Nora,” she should occupy a nearby but separate social position rather than physically overlapping Nora

---

## Devin — sound / arcade guide / candy exchange

### Doors
- technical sound check / club edge

### Building
Weighted:
- 50% `below:sound-position`
- 25% `below:floor-edge`
- 15% `below:arcade-corner`
- 10% `take-a-break`

### Peak
- sound position / floor edge; less likely to be at arcade unless player asks

### Late
- increased `arcade-corner` / Take A Break probability

### Afterhours
- arcade / sound / social

### Dawn
- wind-down / technical talk

Overrides:
- player asks about old arcade games → Devin escorts to Mortal Kombat cabinet and schedule locks until escort finishes
- candy interactions do not need schedule lock beyond current conversation

---

## Beaver — alley food stand / social

### Doors
- setup near alley stand

### Building
- food stand primary

### Peak
- food stand busy

### Late
- food stand / nearby alley social

### Afterhours
- stand winding down / sitting nearby / social

### Dawn
- cleanup / last food / alley wind-down

Beaver should remain relatively anchored because the stand is itself a landmark and service point.

---

## Courtney — bartender

### Doors
- bar setup / light service

### Building
- bar service

### Peak
- bar service, high activity

### Late
- bar service, medium activity

### Afterhours
- winding down / water / final service depending event state

### Dawn
- cleanup / service closed

The schedule changes **activity and intensity**, not room location.

---

## Simla — bartender

Same broad bar anchoring as Courtney, but offset behavior can reduce crowd bottlenecks.

Possible distinction:
- Courtney handles more main drink requests
- Simla shifts more toward water / quick service / conversations late

This is flavor and queue distribution, not a hard restriction.

---

## David — furniture / secret-room access

David should not be over-scheduled. His appearance is more special if he is not always standing at the secret route.

Suggested:
- Doors: absent / elsewhere
- Building: low chance downstairs / social
- Peak: low chance Take A Break / social
- Late: increased chance near furniture / secret-room route
- Afterhours: high chance near furniture / route
- Dawn: social / winding down

Progression override:
- once the player has triggered David's access discussion, keep him available long enough to complete it

Keep `david` distinct from founder `dave` at all times.

---

## Dave — founder / roof bonus character

Dave should primarily remain a roof / late-night payoff character.

- Doors: not present as active roaming NPC
- Building: not present
- Peak: not present
- Late: very low chance elsewhere only if specifically designed later
- Afterhours: roof founder scene
- Dawn: roof founder scene

This preserves the roof reveal as special.

---

## Maddox — companion / roof discovery

Maddox is not scheduled like a human NPC.

Rules:
- before companion unlock, follows existing discovery / affection logic
- once following player, player relationship takes priority over Night Director
- roof discovery can be phase-sensitive in presentation but should not be impossible because the player arrived “too early”
- God Mode still spawns Maddox following immediately

---

# Schedule selection algorithm

Initial non-ML approach:

```text
1. Determine current phase.
2. Gather allowed schedule options for character.
3. Apply progression overrides.
4. Apply live-event overrides.
5. Apply police / evacuation overrides.
6. Apply discoverability bias from difficulty and player state.
7. Remove invalid / occupied / conflicting zones.
8. Weighted-randomly choose next slot.
9. Keep slot for a minimum dwell time.
10. Move only through plausible transitions / off-camera swaps.
```

Suggested dwell times:
- stationary service roles: 8–20 minutes
- roaming host / photographer: 2–7 minutes
- studio guides: 4–10 minutes
- special escort / progression: until sequence completion

Do not resample every frame or every minute. Characters should feel intentional, not jittery.

---

# Discoverability bias

This should be subtle and only affect schedule weights.

Examples:

### James not yet met
- Easy: +100% weight to high-traffic Below / alley positions
- Medium: +40%
- Hard: no special bias

### Jace archive not unlocked after upstairs arrival
- Easy: strong bias toward circulation / storage corridor
- Medium: moderate bias
- Hard: natural schedule only

### Boogaloo Dead Room not unlocked after multiple failed attempts
- Easy: strong bias near Dead Room / Live Room
- Medium: moderate bias
- Hard: no rescue bias

### Police active
- James availability becomes high for all difficulties because police resolution is a live-world event, not a puzzle.

---

# Multiplayer conflict rules

When multiple players have different progression states, the character exists once but dialogue can branch per player.

Example:
- Player A already unlocked Jace's archive.
- Player B has not.
- Jace's physical location is shared.
- Player B sees the archive-introduction option.
- Player A sees return / history dialogue.

If Player B starts an escort, Jace is temporarily busy in shared world state. Player A can still see him but should not be able to start a conflicting escort until the sequence releases.

This avoids cloning named people for convenience.

---

# First-playtest questions

When schedules eventually enter a test branch, telemetry should answer:

- Did single-presence characters become harder to find?
- Did players encounter James naturally before needing a hint?
- Did Jace / Boogaloo schedule bias reduce repeated locked-door frustration?
- Did Nora feel more alive by moving, or simply less reliable?
- Did players notice that the same people appeared in different spaces over time?
- Did Late / Afterhours naturally encourage upstairs / roof exploration?

The target is **believability with sufficient discoverability**, not simulation purity.
