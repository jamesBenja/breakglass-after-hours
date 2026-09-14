import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';
import { mainRoute, loopRoute, waypoints } from '../src/world/upstairs/plan.js';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { overlookRoute, secondaryRoute } from './spatial-routes.js';
import { FollowCamera } from '../src/player/FollowCamera.js';

function follow(player, world, route, camera) {
  for (const id of route) {
    const [x, , z] = waypoints[id];
    let reached = false;
    for (let i = 0; i < 900; i++) {
      const dx = x - player.position.x,
        dz = z - player.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.14) {
        reached = true;
        break;
      }
      const strength = Math.min(1, d / 0.55);
      player.update(1 / 60, { x: (dx / d) * strength, z: (dz / d) * strength }, world);
      if (camera) {
        camera.update(1 / 60, player.position, world);
        assert.equal(
          world.cameraCast(camera.target, camera.camera.position, 0.2).target,
          null,
          `camera clips at ${id}`,
        );
      }
    }
    assert.ok(
      reached,
      `route blocked at ${id}: ${player.position.toArray()} (${player.collisionTarget})`,
    );
  }
}

for (const pass of ['A', 'B'])
  test(`Pass ${pass}: entry, full polygon loop, Live Room, Mixing Suite, Clark and return`, () => {
    const level = createUpstairsDefinition(pass),
      world = new CollisionWorld(level.navigation),
      player = new PlayerController(),
      camera = new FollowCamera(16 / 9);
    player.spawn(level.spawns.start, world);
    camera.configure(level.cameraOffset, player.position, world);
    follow(player, world, mainRoute, camera);
    follow(player, world, [...mainRoute].reverse(), camera);
    follow(player, world, ['eastJunction', ...loopRoute, 'eastJunction', 'entry'], camera);
    follow(player, world, secondaryRoute, camera);
    player.dispose();
  });

for (const pass of ['A', 'B'])
  test(`Pass ${pass}: every visible open door is traversable`, () => {
    const level = createUpstairsDefinition(pass),
      world = new CollisionWorld(level.navigation);
    for (const door of level.doors) {
      const position = new Vector3(
        door.center[0] + door.normal[0] * 0.7,
        0,
        door.center[1] + door.normal[1] * 0.7,
      );
      assert.ok(world.isValidPosition(position), `door approach ${door.id}`);
      world.move(position, -door.normal[0] * 1.4, -door.normal[1] * 1.4);
      assert.ok(
        Math.hypot(
          position.x - door.center[0] + door.normal[0] * 0.7,
          position.z - door.center[1] + door.normal[1] * 0.7,
        ) < 0.03,
        `blocked ${door.id}`,
      );
    }
  });

test('historic Neve suite is enterable while remaining private suites stay solid', () => {
  const world = new CollisionWorld(createUpstairsDefinition('A').navigation);
  const neveInterior = new Vector3(-3.5, 0, 2);
  assert.ok(!world.blocked(neveInterior.x, neveInterior.y, neveInterior.z));
  assert.ok(world.isValidPosition(neveInterior));
  assert.ok(world.blocked(15, 0, -5));
  assert.ok(!world.isValidPosition(new Vector3(15, 0, -5)));
});

test('coyote time accepts a late jump and rejects jumps after the grace period', () => {
  const world = new CollisionWorld({
    allowAirborne: true,
    surfaces: [{ x1: -4, x2: 0, z1: -2, z2: 2, y: 1 }],
  });
  for (const delay of [0.06, 0.2]) {
    const player = new PlayerController();
    player.spawn([-0.03, 1, 0], world);
    player.velocity.x = 5.8;
    for (let i = 0; i < 4; i++) player.update(1 / 60, { x: 1, z: 0 }, world);
    assert.equal(player.grounded, false);
    for (let t = 0; t < delay; t += 1 / 120) player.update(1 / 120, { x: 1, z: 0 }, world);
    player.update(1 / 120, { x: 1, z: 0 }, world, true);
    assert.equal(player.verticalVelocity > 0, delay < 0.13);
    player.dispose();
  }
});

test('jump input immediately before landing is buffered; it does not create repeated air jumps', () => {
  const world = new CollisionWorld({ surfaces: [{ x1: -4, x2: 4, z1: -4, z2: 4, y: 0 }] });
  const player = new PlayerController();
  player.spawn([0, 0.2, 0], world);
  player.verticalVelocity = -2;
  player.update(1 / 120, { x: 0, z: 0 }, world, true);
  for (let i = 0; i < 14; i++) player.update(1 / 120, { x: 0, z: 0 }, world);
  assert.ok(player.verticalVelocity > 0);
  player.update(1 / 120, { x: 0, z: 0 }, world, true);
  assert.ok(player.verticalVelocity < 7.5, 'new key press must not reset the airborne velocity');
  player.dispose();
});

test('ground contact is stable on a platform, low steps auto-climb and the edge can be left', () => {
  const world = new CollisionWorld({
    allowAirborne: true,
    surfaces: [
      { x1: -10, x2: 10, z1: -2, z2: 2, y: 0 },
      { id: 'step', x1: 0, x2: 2, z1: -2, z2: 2, y: 0.3 },
    ],
    obstacles: [{ id: 'step', x1: 0, x2: 2, z1: -2, z2: 2, y1: 0, y2: 0.3 }],
  });
  const player = new PlayerController();
  player.spawn([-1, 0, 0], world);
  for (let i = 0; i < 25; i++) player.update(1 / 60, { x: 1, z: 0 }, world);
  assert.ok(player.position.x > 0);
  assert.equal(player.position.y, 0.3);
  assert.equal(player.grounded, true);
  for (let i = 0; i < 60; i++) player.update(1 / 60, { x: 1, z: 0 }, world);
  assert.equal(player.position.y, 0);
  assert.equal(player.grounded, true);
  player.dispose();
});

test('camera clears diagonal walls and recovers after a tight corridor orbit', () => {
  const level = createUpstairsDefinition('A'),
    world = new CollisionWorld(level.navigation),
    camera = new FollowCamera(16 / 9),
    position = new Vector3(...waypoints.galleryW);
  camera.configure(level.cameraOffset, position, world);
  for (let i = 0; i < 240; i++) {
    camera.orbit(0.022);
    camera.update(1 / 60, position, world);
    assert.equal(world.cameraCast(camera.target, camera.camera.position, 0.2).target, null);
  }
  position.fromArray(waypoints.live);
  for (let i = 0; i < 180; i++) camera.update(1 / 60, position, world);
  assert.ok(camera.clearance > 5);
});

test('optional four-hop route reaches the polygon roof and descends by the same overlook path', () => {
  const level = createUpstairsDefinition('B'),
    world = new CollisionWorld(level.navigation),
    player = new PlayerController(),
    camera = new FollowCamera(16 / 9);
  player.spawn(waypoints.live, world);
  camera.configure(level.cameraOffset, player.position, world);
  for (const [x, y, z, jump] of overlookRoute) {
    let landed = false;
    for (let i = 0; i < 300; i++) {
      const dx = x - player.position.x,
        dz = z - player.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.1 && player.grounded && Math.abs(player.position.y - y) < 0.05) {
        landed = true;
        break;
      }
      const strength = Math.min(1, d / 0.35);
      player.update(
        1 / 60,
        { x: d ? (dx / d) * strength : 0, z: d ? (dz / d) * strength : 0 },
        world,
        jump && i === 0,
      );
      camera.update(1 / 60, player.position, world);
      assert.equal(
        world.cameraCast(camera.target, camera.camera.position, 0.2).target,
        null,
        'camera clears hop route',
      );
    }
    assert.ok(
      landed,
      `hop ${x},${y},${z} blocked: ${player.position.toArray()} / ${player.collisionTarget}`,
    );
  }
  assert.equal(player.groundTarget, 'polygon-perch');

  for (const [x, y, z] of [...overlookRoute].reverse().slice(1)) {
    let landed = false;
    for (let i = 0; i < 360; i++) {
      const dx = x - player.position.x,
        dz = z - player.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.12 && player.grounded && Math.abs(player.position.y - y) < 0.06) {
        landed = true;
        break;
      }
      const strength = Math.min(1, d / 0.35);
      player.update(
        1 / 60,
        { x: d ? (dx / d) * strength : 0, z: d ? (dz / d) * strength : 0 },
        world,
      );
      camera.update(1 / 60, player.position, world);
    }
    assert.ok(
      landed,
      `descent ${x},${y},${z} blocked: ${player.position.toArray()} / ${player.collisionTarget}`,
    );
  }

  follow(player, world, ['live', 'galleryNE', 'galleryE', 'gallerySE', 'eastJunction', 'entry'], camera);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
  player.dispose();
});

test('orbiting close to a wall preserves a useful camera distance', () => {
  const world = new CollisionWorld(createUpstairsDefinition('B').navigation),
    camera = new FollowCamera(16 / 9),
    position = new Vector3(-7.8, 0, -0.7);
  assert.ok(world.isValidPosition(position));
  camera.configure([8, 10, 11], position, world);
  for (let i = 0; i < 400; i++) {
    camera.orbit(0.025);
    camera.update(1 / 60, position, world);
    assert.ok(camera.clearance > 3, 'camera must not collapse into the player');
    assert.equal(world.cameraCast(camera.target, camera.camera.position, 0.2).target, null);
  }
});

test('a jump hits an overhead platform underside and returns to the floor', () => {
  const world = new CollisionWorld({
    allowAirborne: true,
    surfaces: [{ x1: -3, x2: 3, z1: -3, z2: 3, y: 0 }],
    obstacles: [{ id: 'overhead', x1: -2, x2: 2, z1: -2, z2: 2, y1: 2.5, y2: 2.8 }],
  });
  const player = new PlayerController();
  player.spawn([0, 0, 0], world);
  let maximum = 0;
  let hit = false;
  for (let i = 0; i < 90; i++) {
    player.update(1 / 60, { x: 0, z: 0 }, world, i === 0);
    maximum = Math.max(maximum, player.position.y);
    hit ||= player.collisionTarget === 'overhead';
  }
  assert.ok(hit);
  assert.ok(maximum <= 0.55 + 1e-6);
  assert.equal(player.position.y, 0);
  assert.equal(player.grounded, true);
  player.dispose();
});
