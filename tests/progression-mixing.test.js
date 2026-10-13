import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractionSystem } from '../src/interactions/InteractionSystem.js';
import { validateSave } from '../src/state/GameState.js';
import { StudioSession } from '../src/studio/StudioSession.js';
import {
  MIXING_CHALLENGES,
  createReferenceMix,
  mixingGameComplete,
  scoreMix,
  startMixingChallenge,
} from '../src/studio/MixingChallenge.js';
import { alleyLevel } from '../src/world/alley.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';

test('Jace and Boogaloo progression gates protect the archive and Dead Room', () => {
  const upstairs = createUpstairsDefinition('B');
  assert.equal(upstairs.anchors.tapeArchive.requires, 'tapeArchiveAccessGranted');
  assert.equal(upstairs.anchors.instruments.requires, 'deadRoomAccessGranted');
  assert.equal(upstairs.anchors.amps.requires, 'deadRoomAccessGranted');
  assert.equal(upstairs.anchors.storageLock.progression, 'storage');
  assert.equal(upstairs.anchors.deadRoomLock.progression, 'dead-room');
  assert.ok(
    upstairs.progressionGates.filter((gate) => gate.requires === 'tapeArchiveAccessGranted')
      .length >= 2,
  );
  assert.ok(upstairs.progressionGates.some((gate) => gate.requires === 'deadRoomAccessGranted'));
});

test('David downstairs storage access does not bypass Jace tape archive access', () => {
  const saved = validateSave({
    version: 1,
    storageAccessGranted: true,
    tapeArchiveAccessGranted: false,
  });
  assert.equal(saved.storageAccessGranted, true);
  assert.equal(saved.tapeArchiveAccessGranted, false);
});

test('service stair is a bidirectional reward gated by the mixing key state', () => {
  const upstairs = createUpstairsDefinition('B');
  assert.equal(upstairs.anchors.alleyShortcut.requires, 'alleyShortcutUnlocked');
  assert.equal(upstairs.anchors.alleyShortcut.target, 'alley@studioShortcut');
  assert.ok(upstairs.spawns.alleyShortcut);
  assert.equal(alleyLevel.anchors.studioShortcut.requires, 'alleyShortcutUnlocked');
  assert.equal(alleyLevel.anchors.studioShortcut.target, 'upstairs@alleyShortcut');
  assert.ok(alleyLevel.spawns.studioShortcut);
});

test('requiresNot hides clue anchors after their progression gate opens', () => {
  const state = { data: { opened: false } };
  const interactions = new InteractionSystem(() => {}, state);
  assert.equal(interactions.unlocked({ requiresNot: 'opened' }), true);
  state.data.opened = true;
  assert.equal(interactions.unlocked({ requiresNot: 'opened' }), false);
});

test('Spectra challenge engine starts wrong and exact reference mixes pass', () => {
  const session = new StudioSession();
  for (const challenge of MIXING_CHALLENGES) {
    startMixingChallenge(session, challenge.id);
    assert.equal(scoreMix(session, challenge.id).pass, false, `${challenge.id} should need work`);
    const reference = createReferenceMix(challenge.id);
    const result = scoreMix(reference, challenge.id);
    assert.equal(result.pass, true, `${challenge.id} reference should pass`);
    assert.equal(result.score, 100);
  }
});

test('all Spectra levels are required for the reward', () => {
  const ids = MIXING_CHALLENGES.map((challenge) => challenge.id);
  assert.equal(mixingGameComplete(ids.slice(0, -1)), false);
  assert.equal(mixingGameComplete(ids), true);
});

test('door and guestlist progression survives save validation', () => {
  const state = validateSave({
    version: 1,
    clubEntranceUnlocked: true,
    guestlistApproved: true,
    guestlistReferralPending: true,
    guestlistAddedByJames: true,
  });
  assert.equal(state.clubEntranceUnlocked, true);
  assert.equal(state.guestlistApproved, true);
  assert.equal(state.guestlistReferralPending, false);
  assert.equal(state.guestlistAddedByJames, true);
});

test('new progression state survives save validation', () => {
  const firstChallenge = MIXING_CHALLENGES[0].id;
  const state = validateSave({
    version: 1,
    difficulty: 'easy',
    tapeArchiveAccessGranted: true,
    deadRoomAccessGranted: true,
    mixingChallengeCompleted: [firstChallenge],
    mixingRewardKey: true,
    alleyShortcutUnlocked: true,
  });
  assert.equal(state.difficulty, 'easy');
  assert.equal(state.tapeArchiveAccessGranted, true);
  assert.equal(state.deadRoomAccessGranted, true);
  assert.deepEqual(state.mixingChallengeCompleted, [firstChallenge]);
  assert.equal(state.mixingRewardKey, true);
  assert.equal(state.alleyShortcutUnlocked, true);
});
