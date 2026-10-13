import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { FollowCamera } from '../src/player/FollowCamera.js';

test('follow camera eases back to the wide view after an obstruction clears', () => {
  let blocked = true;
  const collision = {
    cameraCast: () =>
      blocked ? { fraction: 0.58, target: 'door-frame' } : { fraction: 1, target: null },
  };
  const camera = new FollowCamera(16 / 9);
  const position = new Vector3(0, 0, 0);

  camera.configure([8, 10, 11], position, collision, {
    mode: 'follow',
    distance: 14,
    minDistance: 7,
    maxDistance: 16,
    pitch: 0.8,
  });
  const compressed = camera.clearance;
  assert.ok(compressed < 9, `expected an obstructed camera, got ${compressed}`);

  blocked = false;
  camera.update(1 / 60, position, collision);
  assert.ok(camera.clearance > compressed, 'camera starts recovering as soon as the wall clears');
  assert.ok(camera.clearance < 12, 'camera does not pop straight back to the full wide distance');

  for (let i = 0; i < 180; i++) camera.update(1 / 60, position, collision);
  assert.ok(camera.clearance > 13.5, 'camera smoothly recovers the normal wide framing');
});

test('a door-frame edge uses a clear shoulder angle instead of collapsing the wide camera', () => {
  const collision = {
    cameraCast: (_from, to) =>
      to.x < 6.4 ? { fraction: 0.62, target: 'door-jamb' } : { fraction: 1, target: null },
  };
  const camera = new FollowCamera(16 / 9);
  const position = new Vector3(0, 0, 0);

  camera.configure([8, 10, 11], position, collision, {
    mode: 'follow',
    distance: 14,
    minDistance: 7,
    maxDistance: 16,
    pitch: 0.8,
  });

  assert.ok(Math.abs(camera.cameraYawOffset) >= 0.2, 'camera shifts around the door-frame edge');
  assert.ok(camera.clearance > 13, 'clear shoulder framing preserves the zoomed-out view');
});
