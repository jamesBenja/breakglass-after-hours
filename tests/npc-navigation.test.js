import test from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import { NpcNavigator } from '../src/npcs/NpcNavigator.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';

function followPath(world, start, path, speed = 0.08) {
  const position = { x: start.x, y: start.y ?? 0, z: start.z };
  for (const waypoint of path) {
    for (let i = 0; i < 1500; i++) {
      const dx = waypoint.x - position.x;
      const dz = waypoint.z - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.09) break;
      const amount = Math.min(speed, distance);
      world.move(position, (dx / distance) * amount, (dz / distance) * amount, {
        grounded: true,
      });
    }
    assert.ok(
      Math.hypot(position.x - waypoint.x, position.z - waypoint.z) < 0.12,
      `failed to reach waypoint ${waypoint.x},${waypoint.z}`,
    );
  }
  return position;
}

test('NPC navigator routes through a doorway instead of walking into the wall', () => {
  const world = new CollisionWorld({
    surfaces: [{ id: 'floor', x1: -5, x2: 5, z1: -5, z2: 5, y: 0 }],
    obstacles: [
      { id: 'wall-a', x1: -0.12, x2: 0.12, z1: -5, z2: 0.85, y1: 0, y2: 3 },
      { id: 'wall-b', x1: -0.12, x2: 0.12, z1: 2.15, z2: 5, y1: 0, y2: 3 },
    ],
  });
  const navigator = new NpcNavigator(world);
  const start = { x: -3.5, y: 0, z: -2.5 };
  const goal = { x: 3.5, y: 0, z: -2.5 };

  assert.equal(navigator.lineClear(start, goal), false);
  const path = navigator.plan(start, goal);
  assert.ok(path.length >= 2, 'path should detour through the door opening');
  const end = followPath(world, start, path);
  assert.ok(Math.hypot(end.x - goal.x, end.z - goal.z) < 0.15);
});

test('every authored studio NPC route leg has a collision-safe walking path', () => {
  const definition = createUpstairsDefinition('B');
  const world = new CollisionWorld(definition.navigation);
  const navigator = new NpcNavigator(world);

  for (const npc of definition.npcs) {
    if (!npc.route?.length) continue;
    let start = {
      x: npc.position?.[0] ?? npc.route[0][0],
      y: npc.position?.[1] ?? npc.route[0][1] ?? 0,
      z: npc.position?.[2] ?? npc.route[0][2],
    };

    for (let index = 0; index < npc.route.length; index++) {
      navigator.clearCache();
      const [x, y = 0, z] = npc.route[index];
      const goal = { x, y, z };
      const path = navigator.plan(start, goal);
      assert.ok(
        path.length > 0 || Math.hypot(start.x - x, start.z - z) < 0.18,
        `${npc.id} route ${index} has no path`,
      );
      if (path.length) {
        const end = followPath(world, start, path);
        assert.ok(
          Math.hypot(end.x - x, end.z - z) < 0.7,
          `${npc.id} route ${index} ended too far from target`,
        );
        start = { ...end };
      }
    }
  }
});

test('locked or impossible destinations can fail cleanly without returning a wall-crossing path', () => {
  const world = new CollisionWorld({
    surfaces: [{ id: 'floor', x1: -4, x2: 4, z1: -4, z2: 4, y: 0 }],
    obstacles: [{ id: 'sealed-wall', x1: -0.2, x2: 0.2, z1: -4, z2: 4, y1: 0, y2: 3 }],
  });
  const navigator = new NpcNavigator(world);
  const path = navigator.plan({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 });
  assert.deepEqual(path, []);
});
