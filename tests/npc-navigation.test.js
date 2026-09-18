import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import { NpcNavigator } from '../src/npcs/NpcNavigator.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
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

test('NPC route failures back off instead of rerunning A* every frame behind locked gates', () => {
  const world = new CollisionWorld({
    surfaces: [{ id: 'floor', x1: -4, x2: 4, z1: -4, z2: 4, y: 0 }],
    obstacles: [{ id: 'locked-gate', x1: -0.2, x2: 0.2, z1: -4, z2: 4, y1: 0, y2: 3 }],
  });
  const root = new Group();
  const system = new NpcSystem(
    root,
    {
      anchors: {},
      npcs: [
        {
          id: 'test-route-npc',
          name: 'Test Route NPC',
          interactive: false,
          position: [-2, 0, 0],
          route: [
            [2, 0, 0],
            [2, 0, 1],
          ],
          speed: 0.5,
        },
      ],
    },
    world,
  );

  let plans = 0;
  const basePlan = system.navigator.plan.bind(system.navigator);
  system.navigator.plan = (...args) => {
    plans += 1;
    return basePlan(...args);
  };

  system.update(0.01, false);
  assert.equal(plans, 1, 'first blocked route leg should perform one path search');
  assert.equal(system.npcs[0].routeIndex, 1, 'the blocked leg should be skipped once');

  for (let frame = 0; frame < 20; frame++) system.update(0.01, false);
  assert.equal(plans, 1, 'locked gate should not trigger another A* search every frame');
  assert.equal(
    system.npcs[0].routeIndex,
    1,
    'route should not spin through every leg during backoff',
  );

  system.update(0.5, false);
  assert.equal(plans, 2, 'navigation should retry after the backoff window');
  system.dispose();
});
