# Nora — Club Photographer System

## Core idea

Nora is not a static club NPC. She moves through the venue as the in-world photographer, documenting the night as it unfolds.

Her photos should become part of the game world itself: the party produces its own evolving archive.

## Player-facing behavior

Nora should:

- roam between the main dance floor, DJ booth edge, bar, Take A Break, entry, and quieter social pockets
- seek out visually interesting clusters of avatars rather than photographing at fixed intervals
- occasionally approach the player or other avatars for a portrait
- react to crowd energy, lighting, DJ moments, outfits/avatar appearance, installations, and social groupings
- sometimes capture candid moments automatically
- sometimes visibly raise the camera / flash so players know a photo was taken

At very high crowd density, Nora should navigate like a real photographer: work around the edges, squeeze toward the floor for shots, then retreat to clearer sightlines.

## Photo capture model

The game should support a real render capture from Nora's camera position, not merely save gameplay screenshots from the player's view.

Each photo record should include JSON-friendly metadata:

```text
PhotoState
  id
  eventId
  timestamp
  photographerId = nora
  roomId
  cameraTransform
  avatarIds
  djTrackIds
  partyEnergy
  attendance
  lightingPreset
  haze
  installationId
  tags
  approvedForSharing
```

For single-player prototypes, photos can remain local/browser-generated. For multiplayer, the server should assign canonical IDs/metadata while the capture/render can remain client-side or be uploaded to a media service.

## Visual treatment

Photos should feel like club photography rather than sterile game screenshots.

Potential treatment:

- slight flash falloff
- strong foreground subjects with darker room behind
- haze / laser / moving-light exposure character
- occasional motion blur or grain as a stylistic post effect
- optional date/event stamp only in gallery/archive contexts, not baked destructively into every image

Do not make every image heavily filtered. Variety is better, and some shots should remain clean enough to function as genuine avatar portraits.

## In-world sharing / display

Photos should circulate through Breakglass after they are taken.

Possible surfaces:

1. **Take A Break photo wall / projector**
   - recent shots rotate during the same party
   - social decompression space becomes where people notice themselves and friends

2. **Upstairs Breakglass gallery / hallway**
   - selected shots from previous nights appear as prints/posters/contact sheets
   - BG20 history accumulates over time

3. **Control-room / studio screensaver**
   - very occasional rotating party images when no session is loaded

4. **Event recap wall / archive object**
   - each virtual night generates a browsable contact sheet or photo album

5. **Player collection**
   - photographs containing the player's avatar can be saved to their personal in-game archive

6. **External share**
   - later, users can explicitly choose to export/share selected images outside the game
   - multiplayer/privacy rules must require clear consent before public sharing

## Gameplay hooks

Photography can become more than decoration.

Examples:

- Nora asks groups to gather for a photo
- being photographed with certain NPCs marks a social-memory event
- rare lighting / DJ moments generate special tagged photos
- photos document attendance milestones or peak-party moments
- installations can create unique portrait effects
- arcade high-score winners can pose beside the cabinet
- DJs can receive an end-of-night booth/gallery set
- the BG20 archive can gradually populate from actual player sessions

Avoid turning photography into a grind or collectible checklist. It should emerge naturally from the night.

## Dynamic party integration

Nora's behavior should respond to `PartyState`.

- **early:** portraits, arrivals, bar/social interactions
- **building:** small groups, dance-floor edges
- **peak:** action shots, booth, lasers, crowd moments
- **late:** intimate portraits, Take A Break, tired/funny end-of-night images

She can also react to `LightingState`, preferring certain positions when haze/lasers or strong lighting presets are active.

## Multiplayer privacy / consent

For public multiplayer, avatar photography must be transparent and controllable.

Recommended model:

- avatars are game characters, not webcam images by default
- players can opt out of appearing in saved/exportable photos
- local/in-world ephemeral rendering may be broader, but persistent/public export should honor consent flags
- real usernames/private account data should not be stamped onto exported images unless the user explicitly enables it

If future modes allow user webcam/video textures, treat that as a separate, explicit opt-in system with stricter consent.

## Mobile

Photo capture must work on mobile without forcing the player to stop or open a heavy interface.

- render captures at a bounded resolution appropriate to device capability
- avoid freezing gameplay during capture
- queue image encoding asynchronously where possible
- thumbnail/contact-sheet browsing should be touch-friendly

## BG20 potential

This system can become a powerful bridge between the virtual world and the real BG20 season.

A virtual party can leave behind its own photographic history in the same way real Breakglass nights do. Over time, the game world literally accumulates memories of the people who inhabited it.

Long-term possibility: curated virtual photos and real Nora Breakglass photography can coexist in the same in-world archive, clearly labelled by source, creating a hybrid history of physical and virtual Breakglass.
