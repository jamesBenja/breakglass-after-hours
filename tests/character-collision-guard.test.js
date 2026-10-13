import assert from 'node:assert/strict';
import test from 'node:test';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import {
  constrainCharacterMotion,
  constrainCrowdPositions,
} from '../src/collision/CharacterCollisionGuard.js';

const wallWorld = () =>
  new CollisionWorld({
    surfaces: [{ id: 'floor', x1: -5, x2: 5, z1: -5, z2: 5, y: 0 }],
    obstacles: [{ id: 'wall', x1: 0, x2: 0.08, z1: -5, z2: 5, y1: 0, y2: 3 }],
  });

test('ordinary NPC movement cannot cross an authored wall', () => {
  const world = wallWorld();
  const before = { x: -0.7, y: 0, z: 0 };
  const attempted = { x: 0.7, y: 0, z: 0 };
  assert.equal(constrainCharacterMotion(world, before, attempted), true);
  assert.ok(attempted.x <= -0.32, `character stopped at ${attempted.x}`);
});

test('large scripted position changes remain intentional teleports', () => {
  const world = wallWorld();
  const before = { x: -4, y: 0, z: 0 };
  const attempted = { x: 4, y: 0, z: 0 };
  assert.equal(constrainCharacterMotion(world, before, attempted), false);
  assert.equal(attempted.x, 4);
});

test('crowd member migration is resolved through the same wall collision', () => {
  const world = wallWorld();
  const crowd = { members: [{ currentX: 0.65, currentZ: 0 }] };
  const before = [{ x: -0.65, y: 0, z: 0 }];
  assert.equal(constrainCrowdPositions(world, crowd, before), true);
  assert.ok(crowd.members[0].currentX <= -0.32);
});
