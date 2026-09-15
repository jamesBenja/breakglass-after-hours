# Breakglass Entry and Arrival Flow

## Principle

The player should not spawn abstractly inside a room. Arrival is part of the experience and should immediately communicate whether they are entering Breakglass for a club night, a studio session, or another event type.

The two primary arrival rituals are intentionally different.

---

## Club night arrival — alley / backyard side

### Core fantasy

A club night begins outside. The player approaches through the alley, hears the party before seeing it, encounters a lineup and door staff, gets admitted, and only then enters Below.

The alley should feel like a threshold between the city and the party.

### Suggested sequence

1. **Spawn / approach**
   - Player appears near the De Castelnau / alley approach rather than inside the venue.
   - Distant low-frequency club bleed is audible before the club is visible.
   - Exterior ambience, voices, smokers / people hanging out, occasional cars, weather / seasonal variation later.

2. **Lineup**
   - Depending on `PartyState.attendance`, there may be no line, a short line, or a substantial queue.
   - Queue length should visually foreshadow how busy the club is.
   - NPC conversations, outfits and group behaviour make the wait feel social rather than like a loading screen.
   - Multiplayer players can join the same queue together.

3. **Bouncer / door interaction**
   - Explicit recurring door-staff character or rotating door staff can check:
     - ticket / guestlist / event access
     - player event state
     - whether the venue is at capacity
     - whether the player was previously ejected from the current event
   - Door interaction should be quick and game-like, not bureaucratic.

4. **Ticket / guestlist scan**
   - A player can arrive with:
     - advance ticket
     - guestlist status
     - artist / staff credential
     - door purchase token/state in later versions
   - This system can later connect to real BG20 event unlocks without requiring that for the base game.

5. **Entry reward / orientation**
   - James may sometimes be near the entrance handing out drink tickets / tokens, greeting people, or circulating.
   - First-time visitors can receive subtle orientation through character dialogue rather than a tutorial modal.

6. **Coat check / first reveal**
   - Entry circulation can pass coat check or another transitional space.
   - Club music and lighting become progressively more direct.
   - Do not reveal the full dance floor immediately if the real geometry allows a stronger staged reveal.

7. **Club reveal**
   - The player reaches the main room and sees crowd density, lighting, DJ booth and dance-floor state for the first time.

### Dynamic lineup behaviour

Lineup length should correlate with but not exactly equal attendance.

Possible inputs:

- current attendance vs capacity
- arrival-rate wave
- time of night
- event popularity
- door-processing speed
- weather later
- scheduled artist set change

A busy line should make finally entering feel rewarding.

### Audio progression

The alley arrival is an ideal showcase for spatial audio:

- outside street/alley ambience
- sub-bass / low-frequency bleed through building surfaces
- more high-frequency content as exterior doors/openings are approached
- line chatter becomes local and directional
- door opens and the club spectrum expands dramatically

The audio transition should happen continuously through acoustic portal state, not as a binary music-volume switch.

---

## Studio session arrival — Clark Street front entrance

### Core fantasy

A studio session should feel completely different from nightlife entry: intentional, appointment-based, quieter and more professional/creative.

The real-world conceptual source is the Clark Street front entrance used for studio-session access.

### Suggested sequence

1. **Spawn on Clark Street / front entrance**
   - Day, evening and weather can vary independently of club state.
   - The building exterior should be quieter and less theatrical than the alley club entrance.

2. **Access / appointment state**
   - Player can arrive because they have:
     - scheduled studio session
     - producer / musician role opportunity
     - residency / workshop event
     - invitation from an in-world character
   - Keep this simple in early builds: the session state determines access.

3. **Front-door / stair transition**
   - Enter through the Clark-side building access.
   - Building stair sound should bridge exterior and studio interior.
   - If a club event is active below, distant club bleed may be audible depending on time and room path.

4. **Studio greeting**
   - Likely recurring characters:
     - Jace as studio guide
     - Zander / Boogaloo as techs depending on session
     - James as producer when relevant
   - The player should immediately understand what kind of session is happening through people, gear and sound rather than an abstract mission screen.

5. **Session setup**
   - Player can proceed to Live Room, Mixing Suite, or assigned activity.
   - Session-specific equipment / stems / instruments can load from event/session state.

### Studio arrival tone

- less crowded
- more room tone / HVAC / building sound
- instrument bleed, voices and setup noises
- brighter / more naturalistic lighting than Below
- no bouncer / club-line ritual

---

## Event-aware entry routing

The game should choose arrival mode based on a small event/session context rather than hard-coding one global spawn.

```text
ArrivalContext
  mode: club | studio | workshop | installation | staff
  eventId
  ticketStatus
  guestlistStatus
  credential
  scheduledStart
  assignedRole
  partyStateId
  studioSessionId
```

Examples:

- Club attendee → alley approach / lineup / door
- Booked DJ → alley or artist/staff variant, then booth check-in
- Studio musician → Clark front entrance
- Producer → Clark front entrance
- Workshop attendee → Clark or event-specific entrance
- Staff / bartender / photographer → staff route or shortened door flow

---

## Avatar onboarding placement

For a first-time player, avatar creation can happen before the physical arrival, but it should feel diegetically connected.

Possible structure:

1. Account / display name
2. Avatar creation and role selection
3. Choose first activity / event
4. World loads at the appropriate real-world approach
5. The player physically enters Breakglass

Do not spawn a newly created avatar directly in the middle of the Live Room or dance floor.

---

## Multiplayer implications

Arrival should be shared social space, not a private cutscene.

- Friends can meet outside and enter together.
- A real queue can contain multiple players plus NPC fillers.
- Capacity state is shared.
- Bouncer/door decisions that affect access are authoritative server state later.
- Exterior ambience and line NPCs can remain mostly client-derived.

The club queue can become a useful natural lobby while assets / shared party state finish loading.

---

## Future BG20 possibilities

- QR / ticket code from a physical BG20 event unlocks a matching virtual event or cosmetic.
- Real event posters appear in the alley / entry depending on selected night.
- Historical nights can recreate period-specific arrival atmosphere.
- Nora may photograph groups waiting outside on busy nights.
- James may hand out limited drink tickets near entry on certain events.
- Promoter-role players may help with guestlist / line flow in a future social-management mechanic.

## Design success test

The player should be able to tell, within the first 20 seconds and without reading a tutorial, whether they are arriving for a club night or a studio session.

Club arrival should build anticipation.
Studio arrival should build creative focus.
