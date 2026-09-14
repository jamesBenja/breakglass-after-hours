# Audio Integration Plan

## Best first Control Room source
**DANCE SHOES BG MIX STEMS** in Drive has four synchronized consolidated stems:
- drums
- bass
- vocals
- synths / sound FX

That is ideal for the first mixer mechanic.

### Browser asset strategy
Do not ship the ~77 MB source WAVs directly.
1. choose a useful 20–40 second synchronized excerpt
2. render the exact same range from all four
3. preserve musical relative balance
4. encode browser-ready files
5. preload/decode before mixer mode
6. use one shared transport clock

## Secondary experimental source
**James Benjamin x Jashim soundscape stems** include ARP 2600, Jup-8, bass, percussion, vocals, kalimba/flutes and field/environment material. Great later for ambient zones, playable objects and secret-room audio. Originals are huge; use excerpts/derived assets.

## Below / DJ
Start with two explicitly approved prototype tracks/excerpts. Support:
- two decks
- start/stop
- cue/start positions
- simple tempo relationship
- crossfader
- crowd-energy model

Keep it game-like, not a Rekordbox/CDJ simulator.

## Public-release hygiene
Before a public web release, confirm collaborator/artist material is cleared for this use.
