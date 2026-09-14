# Exterior Block / Alley / Police Interaction Design

## Intent

The exterior should feel like a small urban open-world layer surrounding Breakglass rather than a decorative loading screen.

Reference GTA only for the feeling of street-level freedom, ambient city activity and the contrast between indoor venues and the neighborhood outside. Do not copy GTA missions, vehicles, characters, UI, combat systems or map geometry.

Upstairs, Below and the exterior can intentionally feel like different game genres that still share one continuous world:

- **Studio:** exploratory creative playground
- **Below:** immersive first-person / near-POV nightlife simulation
- **Exterior:** small urban open-world / social simulation

## Geographic scope

Initial exterior scope should remain modest:

- the real Breakglass alley / garden
- the Clark Street frontage / studio entrance
- the block immediately surrounding the building
- enough adjacent streets/sidewalks to make the venue feel embedded in a city

Use actual map/building references when we begin detailed modeling. Do not invent specific real businesses or neighboring occupants unless verified from sources.

The exterior should be expandable later without requiring the entire city.

## Exterior activities

Possible low-stakes activities:

- walk around the block
- meet friends before entering
- join / observe club lineup
- smoke / cool off / chat in alley
- wait for booked DJ slot
- Nora takes exterior portraits
- James takes occasional film photos
- hear music bleed through walls / doors
- encounter arriving/leaving attendees
- studio-session arrival from Clark Street
- find small archive / BG20 easter eggs around the exterior

The purpose is atmosphere and social context, not crime gameplay.

## Ambient city simulation

Use lightweight ambient systems:

- pedestrians
- cyclists
- occasional cars / parked cars
- distant traffic bed
- footsteps
- weather / time-of-night lighting later
- venue queue that grows/shrinks with `PartyState`
- people arriving in groups and leaving after the party

For mobile, use aggressive LOD / despawning outside the active block.

## Noise / neighborhood system

The existing alley social system feeds a broader neighborhood state.

```text
NeighborhoodState
  timeOfNight
  exteriorPopulation
  alleyOccupancy
  queueLength
  streetNoise
  alleyNoise
  bassBleed
  complaintPressure
  staffWarningLevel
  policeAttention
  shutdownRisk
```

Noise can rise from:

- too many people lingering outside
- loud conversations / yelling
- repeated door opening
- excessive club spill / bass bleed
- long queue congestion
- late-night crowd behavior

Staff should first handle problems socially:

- ask people to keep voices down
- reduce exterior occupancy
- close / manage doors
- move people back inside or along
- pause new alley access

## Police / authority interaction

Police interaction should be grounded in venue-management consequences rather than combat or evasion.

Possible escalation:

1. **No issue** — ordinary nightlife ambience.
2. **Neighborhood pressure** — staff warnings and quieter alley behavior.
3. **Complaint event** — a call / notification raises `policeAttention`.
4. **Police arrival** — car / officers arrive outside and speak with staff.
5. **De-escalation** — staff lowers noise, clears alley, adjusts door / music management.
6. **Warning** — party continues under stricter exterior/noise limits.
7. **Shutdown** — if problems persist, music stops, crowd exits and the event ends early.

The player can witness this from different roles. Staff/host characters may have direct dialogue/actions; ordinary attendees mostly experience the consequences.

Do not make avoiding police a stealth/chase mechanic. The interesting game tension is whether the venue can keep a great night going while respecting neighborhood constraints.

## DJ / party consequences

Exterior pressure can feed back into the club:

- door kept closed more often changes acoustic bleed
- haze / lighting may continue while sound level is temporarily reduced
- bar / Take A Break become more crowded if people are asked back inside
- a warning can subtly alter crowd mood
- shutdown cuts the DJ set and triggers a mass-exit state

This creates a venue-simulation challenge beyond pure DJ performance.

## Entry contrast

### Club night

Alley / block feels alive:

- queue
- door staff
- bass bleed
- groups arriving
- smokers / people cooling off
- possible Nora exterior photos

### Studio session

Clark entrance is calmer:

- little or no queue
- quieter street ambience
- appointment/session arrival
- player enters through the real studio-side route

This contrast helps the same building feel different depending on why the player is there.

## Multiplayer

Exterior is a useful social lobby:

- friends can meet before entering
- queue state is shared
- police/noise events are shared
- photo moments can include multiple avatars
- players can move between studio and club entrances according to access state

Synchronize high-level exterior state, not every ambient pedestrian.

## Future expansion

Once the core block works, possible additions include:

- more of the surrounding neighborhood
- bikes / simple transport
- weather
- day/night cycle
- event posters / flyering
- promoter gameplay around arrivals / guestlist
- delivery / load-in moments
- exterior archive points tied to Breakglass history

The block should remain dense and meaningful rather than becoming a huge empty open world.
