import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSave } from '../src/state/GameState.js';
import { levels } from '../src/world/levels.js';
import { dialogues } from '../src/npcs/dialogues.js';

test('Zander stair core is the normal alley route and Clark stair is emergency-only', () => {
  assert.ok(levels.downstairs.anchors.alleyExit.position[0] < 0);
  assert.equal(levels.downstairs.anchors.alleyExit.target, 'alley@clubDoor');
  assert.equal(levels.downstairs.anchors.clarkEmergencyExit.action, 'clarkEmergencyExit');
  assert.ok(levels.downstairs.anchors.clarkEmergencyExit.position[0] > 0);
});

test('Take A Break is expanded and Nora photo wall is in the adjacent east room', () => {
  const lounge = levels.downstairs.navigation.surfaces.find((surface) => surface.id === 'lounge');
  assert.ok(lounge.z1 <= 0.8);
  assert.ok(levels.downstairs.anchors.photoWall.position[0] > 6);
  assert.ok(levels.downstairs.anchors.photoWall.position[2] < 0.8);
});

test('the old east-side service opening is physically blocked', () => {
  const wall = levels.downstairs.navigation.obstacles.find(
    (obstacle) => obstacle.id === 'east-service-wall',
  );
  assert.ok(wall);
  assert.notEqual(wall.player, false);
});

test('David gates the secret storage passage and storage progression saves', () => {
  assert.ok(levels.downstairs.npcs.some((npc) => npc.id === 'david'));
  assert.equal(levels.downstairs.anchors.storagePassage.action, 'storagePassage');
  assert.equal(levels.downstairs.anchors.storageExit.action, 'storageExit');
  assert.equal(dialogues.david.title, 'DAVID · FURNITURE DEALER');
  const saved = validateSave({
    version: 1,
    storageAccessGranted: true,
    hotDogsEaten: 3,
    tacosEaten: 2,
  });
  assert.equal(saved.storageAccessGranted, true);
  assert.equal(saved.hotDogsEaten, 3);
  assert.equal(saved.tacosEaten, 2);
});

test('Beaver and the BBQ are permanent alley interactions', () => {
  assert.ok(levels.alley.npcs.some((npc) => npc.id === 'beaver'));
  assert.equal(levels.alley.anchors.beaverBbq.action, 'beaverBbq');
  assert.equal(dialogues.beaver.title, 'BEAVER · BACK ALLEY BBQ');
});
