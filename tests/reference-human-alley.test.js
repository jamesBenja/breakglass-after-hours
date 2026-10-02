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
