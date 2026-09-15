# Avatar Onboarding, Roles and DJ Access

## Intent

Every player should arrive in Breakglass as a distinct person, not a generic capsule avatar. First-run onboarding should establish identity, visual presentation and the player's relationship to the music/community world before they enter the building.

Avatar appearance is also persistent media identity: Nora/James photography, multiplayer presence, posters/screens and event albums should render the player's chosen avatar consistently.

## First-run flow

Keep onboarding fast enough to reach the building in a few minutes, with a clear **Skip / randomize / edit later** path.

Suggested flow:

1. **Name / display name**
2. **Identity (optional)**
3. **Avatar body + face / presentation**
4. **Hair / basic features**
5. **Clothing / accessories**
6. **Primary scene role(s)**
7. **Photo/privacy preference**
8. **Enter Breakglass**

Players can revisit an upstairs mirror/dressing-room object or profile menu later to edit appearance.

## Identity and avatar design

Do not make gender a hard body-template switch.

Keep these independent:

```text
PlayerProfile
  displayName
  pronouns (optional)
  genderIdentity (optional)
  roles[]
  photographyPreference

AvatarAppearance
  bodyPreset
  bodyShape
  heightPreset
  skinTone
  facePreset
  hairStyle
  hairColor
  facialHair
  top
  bottom
  outerwear
  shoes
  accessories[]
  palette / material variations
```

### Gender / presentation

Offer inclusive options such as:

- woman
- man
- non-binary / gender-neutral
- self-described / custom
- prefer not to say

But all body, hair and clothing controls remain available regardless of the selected identity.

Do not infer pronouns from appearance or gender. Pronouns can be selected independently or omitted.

### Visual style

Target a stylized low-poly / game-readable avatar rather than photorealism. This keeps performance manageable on mobile, photographs visually coherent and customization combinatorial without requiring hundreds of bespoke meshes.

The avatar must remain recognizable in:

- third-person studio play
- crowded club scenes
- Nora photos
- James film photos
- multiplayer
- in-world screens/gallery walls

## Photography preference

Because club photography is a major system, make the player's preference explicit during onboarding and editable later.

Suggested options:

- **Yes — photograph my avatar and include me in event galleries**
- **In-game only — photos may appear during my session but are not persistent/shared**
- **No photography — Nora/James should avoid framing my avatar in stored shots**

This refers only to the virtual avatar. No webcam/photo capture should be implied by default.

## Scene roles

A player can choose one primary identity and optionally one or two secondary roles.

Initial roles:

- **DJ**
- **Producer**
- **Dancer**
- **Musician**
- **Promoter**
- **VJ / visual artist**
- **Photographer**
- **Listener / explorer**

These are **social/gameplay affinities, not rigid character classes**. Choosing DJ should make DJ opportunities easier to discover, but a producer can still dance and a dancer can still learn to DJ.

Store roles as an array plus optional experience/reputation values rather than one enum.

```text
RoleState
  selectedRoles[]
  reputationByRole{}
  unlocksByRole{}
  currentGig / activity
```

## Role-specific opportunities

### DJ

- sign up for open-deck slots
- get booked for scheduled sets
- receive requests / invitations from characters
- build reputation from coherent sets and crowd response
- unlock more catalogue / booth access / longer slots over time

### Producer

- easier introduction to control-room / studio interactions
- session invitations
- save/remix studio projects
- collaborate with musician players/NPCs

### Dancer

- stronger dance-expression controls / emotes
- social/crowd interactions
- dance-floor challenges or photo moments
- no mechanical penalty for not producing/DJing

### Musician

- playable Live Room instruments
- recording invitations
- phrase / loop contributions
- ensemble interactions

### Promoter

- invite NPCs / players
- influence crowd composition or event concept
- later create/schedule community nights
- may receive guest-list / drink-ticket tools in hosted events

### VJ / visual artist

- access visual controls / projection / lighting-adjacent systems
- load approved visual scenes
- collaborate with DJ / installation state

### Photographer

- optional player-camera system distinct from Nora's NPC photography
- event assignments / archive unlocks

### Listener / explorer

- neutral/default path with no pressure to perform
- full access to social/archive/exploration systems

## DJ access should feel socially real

The booth should not be an always-open videogame workstation. DJing should feel like getting an opportunity at a real club.

Support two main access models.

## 1. Open decks / wait-in-line

At certain party states or specific events, an **open decks list** is active.

Possible flow:

1. player talks to James / booth host / sign-up object
2. choose `Join DJ queue`
3. system shows approximate place in line and expected slot length
4. player continues hanging out while waiting
5. when slot approaches, player receives an in-world notification / character prompt
6. player must reach booth within a grace period
7. current DJ finishes / handoff occurs
8. player's slot begins

Queue should not trap the player in a menu.

```text
DjQueueState
  eventId
  active
  entries[]
  currentDjId
  currentSlotEndsAt
  defaultSlotDuration
  gracePeriod
```

For a single-player game, queue entries can include believable NPC DJs. In multiplayer, remote players occupy the same shared queue.

If the player misses their slot, they can be moved down the queue or lose it rather than causing the party to freeze.

## 2. Booked sets

Players can earn/request scheduled slots through role reputation, event narrative, promoter relationships or specific BG20 nights.

Booked sets should feel meaningfully different from open decks:

- named set time
- potentially longer slot
- access to a broader crate / prepared playlist
- event poster / schedule presence
- Nora more likely to photograph the booth
- crowd may arrive specifically for the set
- James / promoter NPC can remind the player before set time

```text
Booking
  id
  djPlayerId
  eventId
  startTime
  duration
  status: offered | accepted | active | completed | missed
  billing / rewards (game-only if used)
  crateRules
```

## DJ reputation without grind

Do not turn Breakglass into an XP treadmill.

Reputation can be a soft record of meaningful events:

- completed open-deck set
- successful transition streak
- retained/growing crowd
- invited back by a promoter/NPC
- played a booked set
- collaborative B2B

Higher reputation can produce more opportunities, not raw stat boosts.

## B2B / multiplayer direction

Future multiplayer should allow:

- two players booked for the same set
- B2B handoffs
- one player selecting while another mixes
- shared booth presence
- crowd/lighting response to the combined set

The queue/booking model should already support `performerIds[]` rather than assuming exactly one DJ forever.

## Event/check-in flow

For a more immersive start than a generic login screen:

1. account/session authentication happens quietly
2. avatar creation occurs in a stylized Breakglass/BG20 dressing/check-in scene
3. choose role badges/interests
4. receive initial drink tickets / event credential where relevant
5. enter the building through the actual entry

This can later vary by event. A club-night spawn may begin at coat check/door; a studio session may begin upstairs; an archive-only visit may begin in a quieter daytime state.

## Mobile requirements

Avatar creation must work comfortably on phones:

- swipe/rotate avatar
- large category tabs
- limited high-quality presets rather than tiny sliders everywhere
- randomize button
- outfit preview performs well on mobile GPU
- saved appearance loads before photography/multiplayer begins

## Data / multiplayer requirements

The networked avatar state should synchronize compact IDs/options, not full mesh files.

```text
AvatarNetState
  playerId
  displayName
  appearancePresetIds{}
  roles[]
  currentRoleActivity
  photographyPreference
```

Each client resolves the same preset IDs into local meshes/materials.

## Success criteria

The system works when:

- two players entering Breakglass can immediately look meaningfully different
- identity is inclusive without tying appearance to gender stereotypes
- Nora's photos preserve each player's recognizable chosen look
- role selection changes what opportunities they notice without locking off the world
- becoming the DJ feels like a social/event process rather than walking up and pressing E
- open decks and booked sets both work in single-player and can later become shared multiplayer state
