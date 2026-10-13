# DJ lesson, crowd reading and trainwreck game

## Intent

The first meaningful use of the Below Breakglass DJ booth should teach a player how DJing works rather than behave like a decorative music selector. The lesson uses the same decks, transport, EQ, sync/jog, audio and crowd systems as normal play. Nothing learned here becomes obsolete after the tutorial.

The goals are:

- teach transferable DJ instincts to players who have never touched a booth;
- let experienced DJs prove familiarity quickly instead of sitting through basic instruction;
- make the crowd a readable consequence of the player's decisions, not a generic score meter;
- allow genuinely bad DJing to clear the floor;
- make mistakes recoverable so losing and rebuilding the room becomes part of the story;
- preserve free experimentation for anyone who does not want a tutorial right now.

## First-use flow

The first booth interaction offers three routes:

1. **Learn the booth** — the full seven-step lesson.
2. **I already DJ · proficiency check** — one clean two-deck transition proves familiarity and permanently unlocks normal booth access.
3. **Free mix for now** — opens normal DJ mode immediately, but does not permanently dismiss the lesson. The first-use prompt returns on a later booth visit until the lesson or proficiency check is passed.

Completion is stored separately per game save namespace so God Mode / invitation saves do not accidentally unlock the normal save.

## Seven-step lesson

### 1. Start with one record

Deck A begins as the room. The player starts one record before touching a second deck.

Real-world idea: hear what is happening first. A DJ is managing an existing room, not just triggering sounds.

### 2. Prepare the next record

The player starts Deck B while the crossfader is still on A.

Real-world idea: cue/preparation. The next record can be running while the audience still hears the current record.

### 3. Match tempo

The two records begin at deliberately different BPM values. The player can move the tempo control or use SYNC.

Pass condition: <= 0.3 BPM difference.

Real-world idea: tempo agreement is necessary for a stable blend, but it is not sufficient by itself.

### 4. Align the beats

The player uses the phase display, JOG controls or another sync correction until the kicks are in the same place.

Pass condition: >= 90% beat alignment.

The coaching text explicitly introduces phrasing as the next musical layer: DJs normally make important changes at sensible phrase boundaries rather than arbitrary instants. Phrase alignment is measured by the diagnostic system and can become a stronger scoring input as catalogue beat-grid/phrase metadata improves.

### 5. Make space for the blend

The player exposes both decks and discovers that two full low ends create a bass clash. Cutting the LOW on one deck cleans the blend.

Pass condition: both decks meaningfully exposed, bass clash <= 18%, one deck's low EQ substantially reduced.

Real-world idea: frequency management matters. Beatmatching alone does not make a mix clean.

### 6. Read the room

The player must change one deck to a moderate-energy record. The lesson rejects both a sharp energy collapse and an automatic jump to the hardest available record.

Pass band for the lesson's warm-room scenario: track energy 0.64–0.80.

Real-world idea: selection is contextual. The technically perfect transition can still be the wrong musical decision.

### 7. Hold the floor

All systems remain active. The player gets the mix into a stable state and explicitly checks the floor.

Pass conditions:

- floor vibe >= 65%;
- mix quality >= 70%;
- trainwreck risk < 20%.

Passing permanently unlocks direct normal DJ access for that save.

## Experienced-DJ proficiency route

The proficiency check does not ask an experienced player to identify buttons. It asks for a result:

- both decks playing;
- BPM difference <= 0.5;
- beat alignment >= 82%;
- mix quality >= 68%;
- floor vibe >= 62%;
- trainwreck risk < 24%;
- sensible low-end management whenever both records are substantially exposed.

Passing unlocks the booth exactly like completing the lesson.

## Mix diagnostics

The existing `DjMixer.metrics()` output is augmented, not replaced. The normal crowd system therefore responds to the same mechanics during the tutorial and every later set.

Additional diagnostics:

- `beatAlignment` — circular quarter-note phase agreement;
- `phraseAlignment` — relative position inside a 16-beat phrase window;
- `tempoMatch` / `bpmDistance`;
- `overlap` — how substantially both decks are audible at once;
- `bassClash` — overlap with low end left open on both decks;
- `overload` — excessive summed deck level during overlap;
- `deadAir` — an active deck routed to effectively inaudible output;
- `trainwreck` — stacked-error severity;
- `floorState` — quiet / holding / filling / slipping / trainwreck.

## Trainwreck philosophy

One imperfect move should not empty Below. Trainwreck severity is deliberately based on stacked failures.

Examples that become dangerous together:

- badly misaligned beats;
- large tempo disagreement;
- both basses fully open during a central blend;
- excessive combined level;
- cutting the active music to near silence.

A severe trainwreck sharply reduces both mix quality and vibe. The existing crowd simulation already loses attendance faster than it gains attendance and physically migrates dancers away from the floor, so the consequence is visible in the room rather than existing only as a number.

## Recovery

There is no irreversible fail state. The player can:

- pull the crossfader back to one safe record;
- correct tempo/phase;
- remove a clashing low end;
- restore sensible level;
- select a more appropriate record;
- rebuild the floor.

This is intentional. Recovering from a bad room is more representative of DJing and creates better player stories than a binary tutorial failure.

## Future depth

The current implementation is a complete first playable lesson, but the architecture supports later upgrades without replacing it:

- explicit phrase markers / breakdown / drop metadata per catalogue track;
- headphones/PFL cue simulation;
- gain trim and redline behavior distinct from channel fader level;
- crowd subgroups with different genre/taste preferences;
- visible micro-reactions such as head turns, phones, cheers and exits tied to specific events;
- event-specific crowd profiles (warmup, peak, afterhours, unfamiliar audience, genre-focused audience);
- scoring recovery quality and longest successful floor hold;
- B2B lesson / mentor mode in multiplayer;
- optional advanced lessons for vinyl, loops, cue points, harmonic mixing and long blends.
