import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Vector3 } from 'three';
import { createStylizedHuman } from '../src/avatar/StylizedHuman.js';
import { NpcSystem, createNpcCharacter } from '../src/npcs/NpcSystem.js';
import { alleyLevel } from '../src/world/alley.js';

test('stylized human v2 keeps the lightweight NPC animation contract', () => {
  const model = createStylizedHuman({
    skin: 0xa87355,
    hair: 0x17171a,
    outfit: 0x22242a,
    trousers: 0x14161b,
    shoes: 0x111318,
    accent: 0x766458,
    hairStyle: 'textured',
  });

  assert.equal(model.group.userData.visualStyle, 'stylized-v2');
  assert.equal(model.group.userData.stylizedHuman, true);

  for (const key of [
    'body',
    'chest',
    'neck',
    'head',
    'hair',
    'leftArm',
    'rightArm',
    'leftForearm',
    'rightForearm',
    'leftHand',
    'rightHand',
    'leftLeg',
    'rightLeg',
    'leftKnee',
    'rightKnee',
    'leftShoe',
    'rightShoe',
  ]) {
    assert.ok(model[key], `stylized rig should expose ${key}`);
  }

  let meshCount = 0;
  model.group.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount >= 45, 'stylized rig should contain richer game-ready geometry');

  const box = new Box3().setFromObject(model.group);
  const size = box.getSize(new Vector3());
  assert.ok(size.y > 1.65 && size.y < 2.05, 'stylized rig should remain human-scale');
  assert.ok(size.x < 0.9, 'stylized rig should avoid the oversized legacy silhouette');
});

test('alley exposes a six-person stylized yard cohort with varied silhouettes', () => {
  const npc = alleyLevel.npcs.find((entry) => entry.id === 'stylized-human-test');
  assert.ok(npc);
  assert.equal(npc.visualStyle, 'stylized');
  assert.equal(npc.importedAsset, undefined);
  assert.equal(npc.interactive, false);
  assert.equal(
    alleyLevel.npcs.filter((entry) => entry.importedAsset).length,
    0,
    'photoreal imported-human experiments should stay out of the live alley',
  );

  const cohort = alleyLevel.npcs.filter((entry) => entry.visualStyle === 'stylized');
  assert.equal(cohort.length, 6);
  assert.equal(new Set(cohort.map((entry) => entry.appearance.hairStyle)).size, 5);
  assert.ok(cohort.some((entry) => entry.appearance.outerwear));
  assert.ok(cohort.some((entry) => entry.appearance.bag === false));
  assert.ok(cohort.some((entry) => entry.appearance.cargo === false));
  assert.ok(cohort.some((entry) => entry.appearance.necklace));
  assert.ok(cohort.some((entry) => entry.route?.length > 1));
  assert.ok(cohort.some((entry) => entry.companionId));

  const [spawnX, , spawnZ] = alleyLevel.spawns.start;
  const [npcX, , npcZ] = npc.position;
  assert.ok(Math.hypot(npcX - spawnX, npcZ - spawnZ) < 4);

  const model = createNpcCharacter(npc);
  assert.equal(model.group.userData.stylizedHuman, true);
  assert.equal(model.group.name, 'npc:stylized-human-test');

  const root = new Group();
  const system = new NpcSystem(root, { ...alleyLevel, npcs: cohort });
  assert.equal(system.get('stylized-human-test')?.group.userData.stylizedHuman, true);

  let meshCount = 0;
  root.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  assert.ok(meshCount < 420, 'six-person stylized cohort should stay within the yard mesh budget');

  const walker = system.get('stylized-human-test');
  const startX = walker.group.position.x;
  const startZ = walker.group.position.z;
  for (let i = 0; i < 80; i++) {
    system.update(0.1, { playing: false, energy: 0, bass: 0 });
  }
  assert.ok(
    Math.hypot(walker.group.position.x - startX, walker.group.position.z - startZ) > 0.5,
    'stylized cohort should exercise real route-driven movement',
  );

  const follower = system.get('smoker-2');
  assert.equal(follower.companionId, 'smoker-1');
  assert.ok(follower.group.userData.stylizedHuman);

  system.dispose();
});
