import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DJ_BOOTH_POV_POSITION,
  DJ_DANCE_FLOOR_FOCUS,
  djBoothPovYaw,
  enterDjBoothPov,
  exitDjBoothPov,
} from '../src/gameplay/DjBoothView.js';

function harness() {
  let spawnCount = 0;
  const game = {
    sceneManager: {
      current: {
        definition: { id: 'downstairs' },
        collision: {},
      },
    },
    player: {
      object: { rotation: { y: 1.2 } },
      spawn(position, collision) {
        spawnCount += 1;
        this.spawnedAt = [...position];
        this.collision = collision;
      },
    },
    camera: {
      mode: 'follow',
      preferredMode: 'follow',
      yaw: 0,
      yawTarget: 0,
      cameraYawOffset: 1,
      cameraYawOffsetTarget: 1,
      initialized: true,
      setMode(mode) {
        this.mode = mode;
        return mode;
      },
    },
    input: {
      clearCount: 0,
      clear() {
        this.clearCount += 1;
      },
    },
  };
  return { game, spawnCount: () => spawnCount };
}

test('DJ booth POV places the local DJ behind the booth and faces the dance-floor centre', () => {
  const { game, spawnCount } = harness();

  assert.equal(enterDjBoothPov(game), true);
  assert.equal(spawnCount(), 1);
  assert.deepEqual(game.player.spawnedAt, [...DJ_BOOTH_POV_POSITION]);
  assert.equal(game.player.object.rotation.y, 0);
  assert.equal(game.camera.mode, 'first');

  const yaw = game.camera.yaw;
  assert.equal(yaw, djBoothPovYaw());
  const viewX = -Math.sin(yaw);
  const viewZ = -Math.cos(yaw);
  const dx = DJ_DANCE_FLOOR_FOCUS[0] - DJ_BOOTH_POV_POSITION[0];
  const dz = DJ_DANCE_FLOOR_FOCUS[2] - DJ_BOOTH_POV_POSITION[2];
  const length = Math.hypot(dx, dz);
  assert.ok(Math.abs(viewX - dx / length) < 1e-9);
  assert.ok(Math.abs(viewZ - dz / length) < 1e-9);
});

test('re-rendering the DJ controls does not keep snapping the booth POV', () => {
  const { game, spawnCount } = harness();

  enterDjBoothPov(game);
  game.camera.yaw += 0.4;
  enterDjBoothPov(game);

  assert.equal(spawnCount(), 1);
  assert.notEqual(game.camera.yaw, djBoothPovYaw());
});

test('closing the DJ interface restores the previous camera mode', () => {
  const { game } = harness();

  enterDjBoothPov(game);
  assert.equal(exitDjBoothPov(game), true);
  assert.equal(game.camera.mode, 'follow');
  assert.equal(game._djBoothPov, null);
});
