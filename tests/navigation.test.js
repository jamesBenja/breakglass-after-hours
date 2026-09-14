import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { levels } from '../src/world/levels.js';

test('Below landing and main room connect, disconnected legacy side rooms remain documented boundaries', () => {
  const world = new CollisionWorld(levels.downstairs.navigation);
  const position = new Vector3(-5.9, 0, -2.25);
  world.move(position, 3, 0);
  assert.equal(world.surfaceAt(position.x, position.z).surface.id, 'club');
  position.set(0, 0, 3);
  world.move(position, 0, 3);
  assert.ok(position.z <= 3.25, 'do not tunnel across the storage gap');
});

test('all gameplay anchors can be approached on their floor and spawns are valid', () => {
  for (const level of Object.values(levels)) {
    const world = new CollisionWorld(level.navigation);
    for (const [id, position] of Object.entries(level.spawns)) {
      assert.ok(
        world.isValidPosition(new Vector3(...position)),
        `${level.id}/${id} spawn ${position.join(', ')}`,
      );
    }
    for (const [id, anchor] of Object.entries(level.anchors)) {
      assert.ok(world.surfaceAt(anchor.position[0], anchor.position[2]), `${level.id}/${id}`);
    }
  }
});

test('thin obstacles block fast motion and permit sliding along their edge', () => {
  const world = new CollisionWorld({
    surfaces: [{ id: 'floor', x1: -5, x2: 5, z1: -5, z2: 5, y: 0 }],
    obstacles: [{ x1: 0, x2: 0.05, z1: -5, z2: 5, y1: 0, y2: 3 }],
  });
  const position = new Vector3(-2, 0, 0);
  world.move(position, 4, 2);
  assert.ok(position.x <= -0.32);
  assert.ok(Math.abs(position.z - 2) < 1e-6);
});

test('ramps and small steps raise the player, tall steps block, stacked floors select by height', () => {
  const world = new CollisionWorld({
    surfaces: [
      { id: 'ramp', x1: 0, x2: 4, z1: -1, z2: 1, ramp: { axis: 'x', from: 0, to: 1 } },
      { id: 'step', x1: 4, x2: 5, z1: -1, z2: 1, y: 1.2 },
      { id: 'high', x1: 5, x2: 6, z1: -1, z2: 1, y: 3 },
      { id: 'overlook', x1: 0, x2: 4, z1: -1, z2: 1, y: 4 },
    ],
  });
  const position = new Vector3(0, 0, 0);
  world.move(position, 4.5, 0);
  assert.ok(Math.abs(position.y - 1.2) < 1e-6);
  world.move(position, 2, 0);
  assert.ok(position.x <= 5);
  assert.equal(world.surfaceAt(2, 0, 2).surface.id, 'ramp');
  assert.equal(world.surfaceAt(2, 0, 5).surface.id, 'overlook');
});

test('jump lands on its floor and dancing has the same duration at different frame rates', () => {
  const world = new CollisionWorld(levels.upstairs.navigation);
  const player = new PlayerController();
  player.spawn(levels.upstairs.spawns.start, world);
  const idle = { x: 0, z: 0 };
  player.update(1 / 60, idle, world, true);
  assert.ok(player.position.y > 0);
  for (let i = 0; i < 120; i++) player.update(1 / 60, idle, world);
  assert.equal(player.position.y, 0);
  assert.equal(player.grounded, true);
  for (const fps of [30, 144]) {
    player.dance(1);
    for (let i = 0; i < fps + 1; i++) player.animate(1 / fps);
    assert.equal(player.danceRemaining, 0);
    assert.equal(player.object.rotation.z, 0);
  }
  player.dispose();
});