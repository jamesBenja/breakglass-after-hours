# Core Character Roster

These are not generic NPCs. Each recurring Breakglass character should have a clear functional role in the world and appear where that role makes sense. Their behavior should support gameplay first, then dialogue/personality.

Keep role/state data serializable so the same characters can later exist consistently in multiplayer sessions.

## Club characters

### Courtney — Bartender

Primary location: Below bar.

Gameplay role:

- serves drinks / water / non-alcoholic options
- accepts venue tokens / drink tickets
- can refuse service when participant intoxication is too high
- can suggest water or cooldown
- reacts to crowd intensity, time of night and DJ performance
- has short contextual dialogue rather than standing idle

Behavior:

- mostly anchored to the bar during service
- can move within the bar zone
- becomes busier as attendance rises
- visually interacts with glassware / counter / service objects where practical

### Simla — Bartender

Primary location: Below bar.

Gameplay role:

- same core service system as Courtney
- should feel like a distinct bartender rather than a duplicate service terminal
- dialogue/reactions can differ by time of night, crowd state and participant condition

Behavior:

- shares the bar workload with Courtney
- crowd density can determine which bartender is easier to reach
- future multiplayer sessions can distribute players naturally across both service points

### Nora — Club photographer

Primary locations:

- dance floor
- DJ booth edge
- bar
- Take A Break
- entry / quieter social corners

Gameplay role:

- takes candid and posed avatar photos
- generates in-world party photographs from her own camera position
- recent images can appear during the night in Take A Break or on a club display
- selected images can later surface upstairs / in the BG20 archive

See the dedicated photography-system design for persistence/privacy rules.

### James — Club host / artist / occasional DJ

James should not be locked to one station. He is a roaming presence and can appear in several valid roles across the same world.

Club roles:

- host / organizer walking through the venue
- hands out drink tickets or venue tokens at appropriate moments
- checks in on the bar / booth / Take A Break
- occasionally takes extra photos using a distinct "film camera" behavior
- can play occasional DJ sets in Below
- can act as a contextual guide to the event without becoming a tutorial character

Possible gameplay hooks:

- receive a small number of tickets from James on arrival or through an interaction
- encounter James shooting a limited number of slower, deliberate "film" photos
- special nights may schedule a James DJ set that changes PartyState / crowd affinity
- James can comment on transitions, crowd energy or an installation when nearby

Film-photo distinction:

- lower frequency than Nora's club photography
- deliberate pose/candid moments
- optional visual treatment / frame / delayed reveal
- photos could appear later in the night or only after the event to mimic film-development delay

## Studio characters

### James — Producer

Primary locations:

- Live Room
- Mixing Suite A / control room
- circulation between studio spaces

Gameplay role:

- producer / collaborator rather than static instructor
- can initiate or join recording tasks
- can suggest instruments / arrangement changes
- can help move a Live Room phrase into the current session
- can appear at the console during selected archival/session scenarios

Long-term multiplayer role:
James should be representable either as an NPC or, for special events, as a live human-controlled host/producer without changing the underlying interaction model.

### Jace — Studio guide

Primary location:

- upstairs studio floor

Gameplay role:

- orientation to the physical studio
- explains rooms / signal flow / distinctive equipment when relevant
- helps players discover less obvious spaces without resorting to floating wayfinding text
- can unlock or introduce technical interactions progressively

Behavior:

- moves through the studio rather than remaining at one help desk
- appears near equipment/rooms when contextual guidance is useful
- should not constantly interrupt the player

### Zander — Studio tech

Primary locations:

- Mixing Suite A
- patch / machine / setup areas
- Live Room during setup

Gameplay role:

- technical support
- helps with routing / patching / microphone or equipment setup
- can repair or reset certain game-state issues diegetically
- can introduce more technical studio mini-games later

Example interactions:

- patch a signal path
- set up a mic / input chain
- troubleshoot a missing signal
- prep additional studio gear for a session

### Boogaloo — Studio tech / artist-tech hybrid

Primary locations:

- Live Room
- control room
- studio circulation

Gameplay role:

- studio tech support with more artist-facing / creative interactions
- helps prep instruments and session gear
- can participate in music-making tasks
- can introduce unusual gear / sounds / workflow options

Possible longer-term role:

- playable or collaborative artist character in selected BG20 studio scenarios
- release/archive-related interactions tied to Breakglass Records material

## Character scheduling / presence

Characters should not all be visible everywhere all the time. Use a simple schedule / role-state system.

Suggested model:

```text
CharacterState
  id
  currentRole
  currentZone
  destinationZone
  activity
  availability
  dialogueContext
  relationshipState
  photoConsentState
  eventFlags
```

Examples:

- James can be `clubHost`, `filmPhotographer`, `dj`, or `producer` depending on event/time/scene.
- Nora can move from dance-floor photography to booth portrait to Take A Break.
- Courtney and Simla remain bar-focused but react to queue length and crowd state.
- Jace, Zander and Boogaloo roam only the studio zones appropriate to their current tasks.

## World-design principle

Recurring characters should make Breakglass feel staffed and lived-in.

They should:

- move with purpose
- react to the party/session state
- help the player do things
- remember a small amount of context
- appear in photographs / archive moments
- eventually synchronize cleanly in multiplayer

Avoid generic quest-marker behavior. The ideal interaction feels like running into someone who actually belongs in the building.
