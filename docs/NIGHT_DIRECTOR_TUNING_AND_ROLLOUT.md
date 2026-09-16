# Breakglass Night Director — Telemetry Tuning & Rollout Plan

Status: **design-only**

This plan is intentionally separated from the live build so the new telemetry system can first establish a clean baseline.

## Why wait for baseline data

The Night Director is meant to improve flow without over-directing players. If it is deployed immediately, we lose the ability to distinguish:

- problems already present in the static/current world
- improvements or regressions caused by the Director

The baseline should therefore be treated like an A/B control period.

---

## Baseline collection target

Begin implementation tuning once either threshold is met:

- **15–25 fresh completed play sessions**, or
- **5–10 aggregate hours of play**

Prefer at least:

- 5 Participant / Explorer invite sessions
- 3 Guestlist sessions
- 2 DJ sessions
- 2 Producer / Musician sessions
- 1 Promoter session
- 2 multiplayer sessions with at least 2 real people together

These are not statistical-significance requirements. They are enough to expose obvious flow problems before we bake assumptions into the Director.

---

## Baseline dashboard questions

### First 5 minutes

Measure:
- invitation opened → avatar complete
- avatar complete → first movement
- time to Sam
- number of Sam interactions before admission
- whether James guestlist recovery was needed
- first named NPC spoken to
- first room entered after admission

Questions:
- Are people stuck before the actual party starts?
- Do they understand that green names mean interactable characters?
- Is the invitation guidance sufficient?

### First 20 minutes

Measure time distribution across:
- alley
- Below main room
- Take A Break
- bar / social areas if separately measurable
- stairs / circulation
- studio floor
- roof

Also measure:
- James found / not found
- DJ access attempted
- upstairs attempted
- Zander spoken to
- Jace spoken to
- Boogaloo spoken to
- locked-door attempts
- arcade use
- photo interactions

Questions:
- Which spaces dominate too much?
- Which spaces are effectively invisible?
- Which NPCs are naturally discovered?
- Where do players repeatedly hit progression locks?

### Session end

Measure:
- total duration
- final room
- inactivity before departure
- deepest progression flag reached
- number of named NPCs interacted with
- whether player DJed
- whether player reached upstairs
- whether player found a secret
- whether police occurred

Questions:
- Where do people stop caring?
- What predicts a long session?
- Are secrets being discovered naturally or not at all?

---

## Metrics that should tune Night Director V1

### 1. Room distribution

If baseline players spend >70% of early play in one room, the Director should not automatically increase that room's attraction.

Instead consider:
- character placement
- visible movement between rooms
- social migration
- late-night changes that create contrast

### 2. Time to James

If players who need James regularly take too long to find him:
- increase early discoverability weight
- do not add a giant quest arrow

### 3. Studio reach rate

If very few ordinary players reach upstairs:
- increase late-phase migration upstairs
- make Zander / studio traffic more visible
- schedule occasional named-character movement toward stairs

Do not simply unlock upstairs for everyone.

### 4. Repeated locked-door attempts

If players repeatedly hit Storage / Dead Room without finding the relevant person:
- bias Jace / Boogaloo schedules after repeated attempts
- scale bias by difficulty

### 5. Alley overuse / underuse

If players already spend large amounts of time in alley:
- Early / Building phases should not overpopulate it
- Late spill-out should remain meaningful by contrast

If nobody uses alley:
- late-night migration / Beaver / police events can create a stronger reason to go there

### 6. DJ participation

If DJ access is rare because players cannot find James:
- fix discoverability through schedule

If DJ access is rare because players simply are not interested:
- do not over-force DJing

Telemetry should distinguish these two cases.

---

## Implementation stages

### Stage A — pure simulation, no rendering

Build a pure-data `NightDirectorModel` on the isolated design branch.

Inputs:
- elapsed time
- mode
- real-player counts by scene
- crowd metrics
- DJ metrics
- police state
- progression summary

Outputs:
- phase
- desired zone populations
- high-level activities
- named-character schedule recommendations
- atmosphere preset

Requirements:
- deterministic tests with seed / fixed inputs
- no imports from Three.js
- no DOM
- no audio changes
- no `src/main.js` installation

This is safe to build before deployment because it cannot affect the live game.

### Stage B — God Mode preview harness

Still isolated from public gameplay.

Add a private preview panel capable of feeding Stage A with:
- phase override
- simulated real-player counts
- DJ quality values
- police state

Goal:
- inspect outputs before connecting to world rendering

### Stage C — synthetic crowd adapter

Connect desired populations to the existing CrowdSystem through a new public method rather than rewriting CrowdSystem behavior.

Suggested interface:

```js
crowd.setDirectorTarget({
  attendance,
  danceShare,
  zoneWeights,
  activityMix,
});
```

The current music-driven crowd logic should remain available as a modifier / fallback.

### Stage D — named-character schedule adapter

Introduce a canonical shared CharacterState registry.

Do not change dialogue content first. Change presence/location only after schedule simulation is stable.

### Stage E — multiplayer authority

Server owns:
- NightState
- named-character schedule slots
- phase transitions

Clients own:
- incidental synthetic NPC placement / animation

Late join receives current NightState in the welcome snapshot.

### Stage F — closed playtest

Use invitation links with selected testers only.

Compare against baseline.

### Stage G — canonical deploy

Only after telemetry comparison and manual multiplayer QA.

---

## Initial success criteria

A successful first Night Director test should show most of the following without harming session length or causing confusion:

- first-time players still get inside reliably
- time to required characters decreases where currently problematic
- room distribution becomes less static over a full session
- more players naturally revisit rooms later in the night
- upstairs discovery improves without simply granting access
- repeated locked-door frustration drops
- late-night sessions show more alley / Take A Break / upstairs movement than early sessions
- players notice the party feels different over time
- players do not report feeling railroaded

---

## Guardrails

Do not let the Director:

- move a character away during active dialogue
- break an escort interaction
- override a human player's DJ / lighting control
- create / destroy real players
- change room architecture
- change audio routing internals
- interfere with Party Phone private calls
- overwrite save progression
- hide progression-critical characters indefinitely
- spawn synthetic crowd directly on top of real players
- exceed mobile crowd budget

---

## Mobile performance budget

The Director should manage atmosphere by changing target counts, not by increasing the current render ceiling without evidence.

Initial rule:
- preserve current `CrowdSystem.max` budget unless profiling justifies change
- real players count toward perceived occupancy
- synthetic crowd should fall as real-player density rises

At future 50–100 player scale, client interest management should ensure each phone only renders the locally relevant remote players plus a reduced synthetic crowd.

---

## Telemetry additions for the future Director test

When we are ready to test the Director, add anonymous events such as:

```text
night_phase_entered
night_population_target_changed
night_character_slot_changed
night_schedule_override
night_real_player_substitution
night_police_override
night_dawn_reached
```

Do not log chat content, voice/video content, names, or other personal media.

Recommended fields:
- playtest ID
- session elapsed seconds
- phase
- current scene
- invite type
- difficulty
- numeric target counts
- anonymous character ID where relevant

---

## Evaluation comparison

Compare baseline vs Director test cohort on:

| Metric | Baseline | Director test | Desired interpretation |
| --- | --- | --- | --- |
| Median admission time | TBD | TBD | no worse |
| Median time to James | TBD | TBD | lower when James is needed |
| Reach upstairs by 20 min | TBD | TBD | modest increase |
| Repeated locked-door attempts | TBD | TBD | decrease |
| Unique rooms visited | TBD | TBD | increase without forced routing |
| Session duration | TBD | TBD | stable or higher |
| Abandonment in alley | TBD | TBD | decrease if currently high |
| Late-session room revisits | TBD | TBD | increase |
| Players reporting “world feels alive” | qualitative | qualitative | strong increase |

Numbers should guide tuning, not become artificial targets that flatten the weirdness / freedom of the game.

---

## Recommendation once baseline threshold is reached

1. Pull dashboard summary.
2. Review 5–10 representative session timelines, especially sessions that ended quickly and sessions that lasted a long time.
3. Update phase durations / schedule weights in this design branch.
4. Build Stage A pure simulation.
5. Run deterministic tests.
6. Preview through God Mode.
7. Only then connect the Director to crowd / named-character rendering.

The goal is to preserve a clean causal story: **we observed X, so the Director is designed to improve X**.
