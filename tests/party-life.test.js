import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { LIVE_ARCHIVE_IDS } from '../src/archive/liveArchive.js';
import { HOUSE_DJS } from '../src/gameplay/HouseDjSystem.js';
import { LIVE_BANDS } from '../src/gameplay/LiveBandSystem.js';
import { preparePartyLifeWorld } from '../src/gameplay/partyLifeEnhancements.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
import { validateSave } from '../src/state/GameState.js';
import { levels } from '../src/world/levels.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';

const requestedHouseDjs = [
  'Lunice',
  'Kaytranada',
  'James Benjamin',
  'Siren Mars',
  'Monib',
  'Hydra',
  'Bootyspoon',
  'Marie Davidson',
  'Frankie Teardrop',
];

test('party-life world puts Nora in the alley and cached studio definition', () => {
  preparePartyLifeWorld();
  assert.ok(levels.alley.npcs.some((npc) => npc.id === 'nora'));
  assert.ok(levels.upstairs.npcs.some((npc) => npc.id === 'nora'));
  assert.equal(levels.upstairs.anchors.houseDjDesk.action, 'houseDjDesk');
  assert.equal(levels.upstairs.anchors.photoFridge.action, 'photoFridge');
});

test('fresh upstairs scene definition contains runtime party-life anchors and Nora', () => {
  const upstairs = createUpstairsDefinition('B');
  assert.equal(upstairs.anchors.houseDjDesk.action, 'houseDjDesk');
  assert.equal(upstairs.anchors.photoFridge.action, 'photoFridge');
  assert.ok(Array.isArray(upstairs.anchors.houseDjDesk.position));
  assert.ok(Array.isArray(upstairs.anchors.photoFridge.position));
  assert.ok(upstairs.npcs.some((npc) => npc.id === 'nora' && npc.role === 'photographer'));
});

test('the complete requested house-DJ roster is available', () => {
  assert.deepEqual(
    HOUSE_DJS.map((dj) => dj.name),
    requestedHouseDjs,
  );
});

test('every Live From Breakglass archive selection has an in-room band mapping', () => {
  for (const id of LIVE_ARCHIVE_IDS) assert.ok(LIVE_BANDS[id], id);
});

test('directed photography stops Nora and pulls a nearby person toward the shot', () => {
  const definition = {
    anchors: {},
    npcs: [
      { id: 'nora', name: 'Nora', role: 'photographer', position: [0, 0, 0] },
      { id: 'friend-a', name: 'Friend A', role: 'guest', position: [1, 0, 0] },
    ],
  };
  const npcs = new NpcSystem(new Group(), definition);
  assert.equal(npcs.triggerPhoto('nora', [0, 0, 2], 1.8), true);
  assert.deepEqual(npcs.gatherForPhoto('nora', [0, 0, 2], 1.8), ['friend-a']);
  npcs.update(0.1, { playing: false, energy: 0, bass: 0 });
  assert.equal(npcs.get('nora').moving, false);
  assert.ok(npcs.get('nora').photoPulse > 0);
  assert.ok(npcs.get('friend-a').photoJoinTarget);
  npcs.dispose();
});

test('party-life state persists the house DJ, smoke count and 18-photo roll', () => {
  const photos = Array.from({ length: 22 }, (_, index) => ({
    id: `photo-${index}`,
    dataUrl: 'data:image/jpeg;base64,AA==',
    tags: index % 2 ? ['upstairs'] : ['downstairs'],
  }));
  const state = validateSave({
    version: 1,
    houseDjId: 'kaytranada',
    smokesShared: 4,
    photos,
  });
  assert.equal(state.houseDjId, 'kaytranada');
  assert.equal(state.smokesShared, 4);
  assert.equal(state.photos.length, 18);
  assert.equal(state.photos[0].id, 'photo-4');
});
