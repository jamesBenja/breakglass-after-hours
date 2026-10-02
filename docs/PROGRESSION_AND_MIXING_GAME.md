# Guided progression + Spectra mixing game

## Readable characters

Named characters that expose gameplay interactions receive camera-facing green nameplates. Maddox uses the same treatment because petting/following him participates in secret-level progression. Generic crowd actors remain unlabelled.

## Studio progression gates

The studio now has explicit state-driven access gates rather than relying on the player discovering every room accidentally.

- `tapeArchiveAccessGranted`: Jace explains the tape archive, escorts the player to upstairs Storage and unlocks both Storage entrances. The tape archive interaction is unavailable until this state is true. The hidden roof route remains its own Easter egg after Storage has been opened.
- `storageAccessGranted`: remains reserved for David's separate disguised furniture-storage passage downstairs. This intentionally cannot unlock Jace's upstairs archive room, including for existing saves.
- `deadRoomAccessGranted`: Boogaloo explains guitar/amp pairing, escorts the player to the Dead Room and unlocks the room. Guitar and amp interactions are unavailable until this state is true.
- `alleyShortcutUnlocked`: the reward service stair connects the studio floor directly to the alley in both directions.

Locked-door clue anchors use `requiresNot`, while the unlocked room interactions use `requires`. This allows the same topology to support future Easy / Medium / Hard hint density without duplicating rooms.

## Difficulty architecture

`GameState.difficulty` defaults to `medium` and accepts `easy`, `medium`, or `hard`. The first pass only uses it to control clue specificity and Spectra feedback. A future start-screen selector can set this field without changing save structure or room logic.

## Spectra mix challenge

The Spectra console can launch sequential mix-matching challenges. Each challenge points to a normal Breakglass studio session and defines:

- a starting mix
- a hidden reference mix
- the controls that count for that level
- per-control tolerances

The current placeholder source is **Dance Shoes** because four synchronized stems are already in the game. Level 1 scores fader balance, Level 2 adds panning, and Level 3 adds low/high shelves plus an FX send. The player can audition the hidden reference, return to their own mix, and submit for scoring. Difficulty controls how specific the feedback is.

Completing every challenge awards `mixingRewardKey` and opens `alleyShortcutUnlocked`. The architecture is session-agnostic: new multitrack Breakglass mixes can replace the Dance Shoes training entries by adding a studio session and a challenge target profile.

## Stem handoff for future levels

For each future mix challenge, the most useful delivery is a folder of synchronized stems exported from the same zero point at the same sample rate, plus either the approved stereo reference mix or enough information to reconstruct the target. Stems should not be normalized individually after export. A rough title/BPM and any special intent (for example “vocal dry in verse, wide FX in chorus”) is also useful for authoring the target and clues.
