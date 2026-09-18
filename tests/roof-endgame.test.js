import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOF_STORY_IDS,
  endgameChecklist,
  fullGameComplete,
  roofStoryComplete,
} from '../src/gameplay/RoofEndgameSystem.js';
import { validateSave } from '../src/state/GameState.js';
import { roofLevel } from '../src/world/roof.js';
import { alleyLevel } from '../src/world/alley.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';

const completeState = () => ({
  djLessonCompleted: true,
  mixingRewardKey: true,
  arcadeWins: 1,
  bathroomPlungeWins: 1,
  studio: { stems: [{ source: 'modular-synth' }] },
  studioSongs: [{ id: 'song-1' }],
  roofSecretUnlocked: true,
  deadRoomAccessGranted: true,
  tapeArchiveAccessGranted: true,
  threadedTape: 'dummy-tape',
  roofStoriesHeard: [...ROOF_STORY_IDS],
  roofAcFixed: true,
  gentrificationTransformed: true,
});

test('roof exposes throwables, AC, skyline lock and endgame hatch', () => {
  assert.equal(roofLevel.anchors.throwChair.action, 'roofThrow');
  assert.equal(roofLevel.anchors.throwBox.throwKind, 'box');
  assert.equal(roofLevel.anchors.throwLumber.throwKind, 'lumber');
  assert.equal(roofLevel.anchors.roofAc.action, 'roofAc');
  assert.equal(roofLevel.anchors.gentrificationTrigger.action, 'gentrificationTrigger');
  assert.equal(roofLevel.anchors.escapeHatch.action, 'roofEscape');
});

test('gold condo key lives on the high Live Room overlook and disappears after pickup', () => {
  const upstairs = createUpstairsDefinition('B');
  const key = upstairs.anchors.gentrificationKey;
  assert.equal(key.action, 'gentrificationKey');
  assert.deepEqual(key.position, [1.7, 3.1, 1.5]);
  assert.equal(key.requiresNot, 'gentrificationKey');
});

test('roof escape lands in the yard/alley garden', () => {
  assert.deepEqual(alleyLevel.spawns.roofEscape, [22.2, 0, 0.4]);
});

test('all founder stories are required for the roof story session', () => {
  assert.equal(roofStoryComplete({ roofStoriesHeard: ROOF_STORY_IDS.slice(0, -1) }), false);
  assert.equal(roofStoryComplete({ roofStoriesHeard: [...ROOF_STORY_IDS] }), true);
});

test('endgame ladder requires every current game and mission milestone', () => {
  const state = completeState();
  const checklist = endgameChecklist(state);
  assert.ok(checklist.length >= 10);
  assert.equal(fullGameComplete(state), true);

  for (const item of checklist) {
    const broken = completeState();
    if (item.id === 'dj') broken.djLessonCompleted = false;
    else if (item.id === 'mixing') broken.mixingRewardKey = false;
    else if (item.id === 'arcade') broken.arcadeWins = 0;
    else if (item.id === 'bathroom') broken.bathroomPlungeWins = 0;
    else if (item.id === 'modular') broken.studio = { stems: [] };
    else if (item.id === 'studio-song') broken.studioSongs = [];
    else if (item.id === 'maddox') broken.roofSecretUnlocked = false;
    else if (item.id === 'dead-room') broken.deadRoomAccessGranted = false;
    else if (item.id === 'archive') broken.threadedTape = null;
    else if (item.id === 'roof-stories') broken.roofStoriesHeard = [];
    else if (item.id === 'roof-ac') broken.roofAcFixed = false;
    else if (item.id === 'gentrification') broken.gentrificationTransformed = false;
    assert.equal(fullGameComplete(broken), false, item.id);
  }
});

test('new roof progression survives save validation', () => {
  const saved = validateSave({
    version: 1,
    djLessonCompleted: true,
    gentrificationKey: true,
    gentrificationTransformed: true,
    roofThrownItems: ['chair', 'box', 'lumber', 'invalid'],
    roofStoriesHeard: [...ROOF_STORY_IDS, 'invalid-story'],
    roofAcFixed: true,
    roofAcKicks: 7,
    roofAcRepairs: 1,
    roofEscapeUnlocked: true,
    roofEscapeEra: 'future',
    roofEscapeVisits: 2,
  });
  assert.equal(saved.djLessonCompleted, true);
  assert.equal(saved.gentrificationKey, true);
  assert.equal(saved.gentrificationTransformed, true);
  assert.deepEqual(saved.roofThrownItems, ['chair', 'box', 'lumber']);
  assert.deepEqual(saved.roofStoriesHeard, ROOF_STORY_IDS);
  assert.equal(saved.roofAcFixed, true);
  assert.equal(saved.roofAcKicks, 7);
  assert.equal(saved.roofAcRepairs, 1);
  assert.equal(saved.roofEscapeUnlocked, true);
  assert.equal(saved.roofEscapeEra, 'future');
  assert.equal(saved.roofEscapeVisits, 2);
});
