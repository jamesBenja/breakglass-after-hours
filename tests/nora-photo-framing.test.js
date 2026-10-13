import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { PhotoSystem } from '../src/photos/PhotoSystem.js';

const makeSystem = (playerPosition = new Vector3(0, 0, 0.5)) =>
  new PhotoSystem({
    renderer: {},
    state: { data: {} },
    sceneManager: {},
    player: { position: playerPosition },
    ui: {},
  });

const makeLevel = (source = new Vector3(0, 0, 0), rotationY = 0) => ({
  npcs: {
    positionOf: () => source.clone(),
    get: () => ({ group: { rotation: { y: rotationY } } }),
  },
});

test('Nora portrait camera backs up enough to keep a close avatar in frame', () => {
  const system = makeSystem();
  const level = makeLevel();
  const subject = new Vector3(0, 0, 0.45);
  const camera = system.cameraForTarget(level, 'nora', subject, {
    minDistance: 2.9,
    targetHeight: 1.02,
  });

  assert.ok(camera);
  const horizontalDistance = Math.hypot(
    camera.position.x - subject.x,
    camera.position.z - subject.z,
  );
  assert.ok(horizontalDistance >= 2.899);
  assert.equal(camera.userData.photographerId, 'nora');
  assert.deepEqual(camera.userData.photoTarget, subject.toArray());
});

test('standard portrait framing targets the player avatar with a tighter portrait lens', () => {
  const playerPosition = new Vector3(1.2, 0, -0.8);
  const system = makeSystem(playerPosition);
  const level = makeLevel(new Vector3(1.1, 0, -0.3));
  const camera = system.cameraFor(level, 'nora');

  assert.ok(camera);
  assert.equal(camera.fov, 46);
  assert.equal(camera.userData.photographerId, 'nora');
  assert.deepEqual(camera.userData.photoTarget, playerPosition.toArray());
});
