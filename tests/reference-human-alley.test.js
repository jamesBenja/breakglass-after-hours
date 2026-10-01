import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
import { alleyLevel } from '../src/world/alley.js';

test('imported human test stays isolated beside the normal alley spawn with a procedural fallback', () => {
  const testNpc = alleyLevel.npcs.find((npc) => npc.id === 'reference-human-test');
  assert.ok(testNpc, 'reference NPC should be present in the alley definition');
  assert.equal(testNpc.visualStyle, 'reference');
  assert.equal(testNpc.importedAsset?.url, 'https://three.ws/avatars/michelle.glb');
  assert.equal(testNpc.importedAsset?.targetHeight, 1.78);
  assert.equal(testNpc.interactive, false);

  const [spawnX, , spawnZ] = alleyLevel.spawns.start;
  const [npcX, , npcZ] = testNpc.position;
  assert.ok(
    Math.hypot(npcX - spawnX, npcZ - spawnZ) < 4,
    'reference NPC should be immediately visible from the normal spawn',
  );

  const root = new Group();
  const npcs = new NpcSystem(root, {
    ...alleyLevel,
    npcs: [testNpc],
  });
  const model = npcs.get('reference-human-test');

  assert.equal(model.group.userData.visualStyle, 'reference');
  assert.equal(model.group.userData.highFidelity, true);
  assert.equal(model.importedVisual?.state, 'fallback');
  assert.equal(model.group.userData.importedVisualState, 'fallback');
  assert.equal(model.group.userData.importedVisualUrl, testNpc.importedAsset.url);
  assert.ok(model.head && model.leftHand && model.rightHand && model.leftKnee && model.rightKnee);

  let meshCount = 0;
  model.group.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 35, 'reference rig should contain substantially richer geometry');

  npcs.update(0.16, { playing: false, energy: 0 });
  npcs.dispose();
});
