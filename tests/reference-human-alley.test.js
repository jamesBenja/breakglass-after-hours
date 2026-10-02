import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Bone,
  BufferGeometry,
  Group,
  MeshBasicMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
} from 'three';
import {
  poseImportedSkeletonsToBind,
  resolveImportedAnimationState,
} from '../src/avatar/ImportedHumanVisual.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
import { alleyLevel } from '../src/world/alley.js';

test('realistic NPC cohort stays beside the alley spawn with procedural fallbacks', () => {
  const testNpc = alleyLevel.npcs.find((npc) => npc.id === 'reference-human-test');
  assert.ok(testNpc, 'reference NPC should be present in the alley definition');
  assert.equal(testNpc.visualStyle, 'reference');
  assert.equal(testNpc.importedAsset?.url, 'https://three.ws/avatars/michelle.glb');
  assert.equal(testNpc.importedAsset?.targetHeight, 1.78);
  assert.equal(testNpc.importedAsset?.demoCycle, undefined);
  assert.equal(testNpc.importedAsset?.clipSet, 'feminine');
  assert.equal(testNpc.route.length, 2);
  assert.equal(testNpc.interactive, false);

  const [spawnX, , spawnZ] = alleyLevel.spawns.start;
  const [npcX, , npcZ] = testNpc.position;
  assert.ok(
    Math.hypot(npcX - spawnX, npcZ - spawnZ) < 4,
    'reference NPC should be immediately visible from the normal spawn',
  );

  const cohort = alleyLevel.npcs.filter((npc) => npc.importedAsset);
  assert.equal(cohort.length, 4);
  assert.equal(new Set(cohort.map((npc) => npc.importedAsset.url)).size, 4);
  assert.ok(
    cohort.every((npc) => Math.hypot(npc.position[0] - spawnX, npc.position[2] - spawnZ) < 10),
    'all realistic NPCs should remain within the initial alley view',
  );
  assert.ok(
    cohort.some((npc) => npc.route?.length > 1),
    'cohort should exercise route-driven walking',
  );
  assert.ok(
    cohort.some((npc) => npc.companionId),
    'cohort should exercise companion-follow behavior through the same NPC system',
  );
  const posedNpc = cohort.find(
    (npc) => npc.importedAsset.url === 'https://three.ws/avatars/selfie-girl.glb',
  );
  assert.equal(posedNpc?.importedAsset.animationMode, 'bind-authored');

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

test('bind-authored imports reset a posed skeleton to its inverse-bind rest before retargeting', () => {
  const root = new Group();
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
  const hips = new Bone();
  const spine = new Bone();

  hips.name = 'Hips';
  spine.name = 'Spine';
  hips.position.set(0, 1, 0);
  spine.position.set(0, 0.6, 0);
  hips.add(spine);
  mesh.add(hips);
  root.add(mesh);
  root.updateMatrixWorld(true);

  const skeleton = new Skeleton([hips, spine]);
  skeleton.calculateInverses();
  mesh.bind(skeleton, mesh.matrixWorld);

  const hipsBind = hips.quaternion.clone();
  const spineBind = spine.quaternion.clone();

  hips.quaternion.setFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.55);
  spine.quaternion.setFromAxisAngle({ x: 0, y: 0, z: 1 }, -0.8);
  root.updateMatrixWorld(true);

  assert.ok(hips.quaternion.angleTo(hipsBind) > 0.5);
  assert.ok(spine.quaternion.angleTo(spineBind) > 0.7);
  assert.equal(poseImportedSkeletonsToBind(root), 1);
  assert.ok(hips.quaternion.angleTo(hipsBind) < 1e-6);
  assert.ok(spine.quaternion.angleTo(spineBind) < 1e-6);

  mesh.geometry.dispose();
  mesh.material.dispose();
});

test('imported human animation state follows real NPC behavior', () => {
  assert.equal(resolveImportedAnimationState({ time: 1 }), 'idle');
  assert.equal(resolveImportedAnimationState({ moving: true, demoCycle: true, time: 10 }), 'walk');
  assert.equal(resolveImportedAnimationState({ dancing: true, demoCycle: true, time: 1 }), 'dance');
  assert.equal(
    resolveImportedAnimationState({
      socialGesture: 'highfive',
      moving: true,
      dancing: true,
      demoCycle: true,
      time: 8,
    }),
    'highfive',
  );
});

test('legacy demo cycle still remains available for isolated animation diagnostics', () => {
  assert.equal(resolveImportedAnimationState({ demoCycle: true, time: 1 }), 'idle');
  assert.equal(resolveImportedAnimationState({ demoCycle: true, time: 5 }), 'walk');
  assert.equal(resolveImportedAnimationState({ demoCycle: true, time: 10 }), 'dance');
  assert.equal(resolveImportedAnimationState({ demoCycle: true, time: 14 }), 'highfive');
  assert.equal(resolveImportedAnimationState({ demoCycle: true, time: 17 }), 'idle');
});
