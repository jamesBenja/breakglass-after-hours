import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { FollowCamera } from '../src/player/FollowCamera.js';
import { CollisionWorld } from '../src/collision/CollisionWorld.js';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';
import {
  buildTakeABreakFurniture,
  TAKE_A_BREAK_SEATS,
} from '../src/scenes/geometry/roomFurniture.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';
import { levels } from '../src/world/levels.js';

test('camera view cycles follow, close and POV without doorway-driven mode changes', () => {
  const camera = new FollowCamera(16 / 9);
  const collision = { cameraCast: () => ({ fraction: 1, target: null }) };
  camera.configure([8, 10, 11], new Vector3(0, 0, 0), collision, {
    mode: 'follow',
    fov: 54,
    distance: 14,
    minDistance: 7,
    maxDistance: 16,
    pitch: 0.8,
  });

  assert.equal(camera.mode, 'follow');
  assert.equal(camera.toggleMode(), 'close');
  assert.equal(camera.toggleMode(), 'first');
  assert.equal(camera.toggleMode(), 'follow');

  camera.setMode('first');
  camera.update(1 / 60, new Vector3(1, 0, 1), collision);
  assert.equal(camera.mode, 'first', 'normal camera updates do not change the chosen perspective');
});

test('camera-only walls block the view but not player movement', () => {
  const collision = new CollisionWorld({
    surfaces: [{ id: 'floor', x1: -4, x2: 4, z1: -4, z2: 4, y: 0 }],
    obstacles: [
      {
        id: 'camera-wall',
        x1: -0.15,
        x2: 0.15,
        z1: -2,
        z2: 2,
        y1: 0,
        y2: 3,
        player: false,
      },
    ],
  });

  assert.equal(collision.blocked(0, 0, 0), false);
  const hit = collision.cameraCast(new Vector3(-2, 1.4, 0), new Vector3(2, 1.4, 0), 0.1);
  assert.ok(hit.fraction < 1);
  assert.equal(hit.target, 'camera-wall');
});

test('the furnished studio and Take A Break expose real seating', () => {
  const upstairs = createUpstairsDefinition('B');
  const fixtureIds = new Set(upstairs.fixtures.map((fixture) => fixture.id));
  const platformIds = new Set(upstairs.platforms.map((platform) => platform.id));

  assert.ok(fixtureIds.has('mix-sofa-rear'));
  assert.equal(fixtureIds.has('mix-sofa-side'), false);
  assert.ok(fixtureIds.has('mix-coffee-table'));
  assert.ok(platformIds.has('mix-rug'));
  assert.ok(
    TAKE_A_BREAK_SEATS.length >= 5,
    'expanded Take A Break exposes additional real seating',
  );
  assert.ok(
    levels.downstairs.navigation.obstacles.some((obstacle) => obstacle.player === false),
    'Below includes camera-only wall volumes',
  );
});

test('the smaller Take A Break loveseat leaves Nora photo-room doorway clear', () => {
  const root = new Group();
  buildTakeABreakFurniture(root);
  const couch = root.getObjectByName('take-a-break-front-couch');
  assert.ok(couch, 'expected the front Take A Break couch');
  const body = couch.children[0];
  const width = body.geometry.parameters.width;
  const leftEdge = couch.position.x - width / 2;

  assert.ok(width <= 1.2, 'front couch should be a compact loveseat');
  assert.ok(leftEdge > 7.44, 'couch should not intrude into the 6.0–7.44 photo-room doorway');
});

test('installation focus further attenuates the already-quiet club and exposes adjustable layers', () => {
  const spatial = new SpatialAudioSystem({ activeExternalTransport: { owner: 'dj' } });
  const level = { definition: { id: 'downstairs' } };
  const normal = spatial.environmentFor(level, 'lounge');

  assert.ok(normal.gain <= 0.1);
  assert.ok(normal.lowpassHz <= 1000);

  spatial.setInstallationFocus(true);
  const focused = spatial.environmentFor(level, 'lounge');
  assert.ok(focused.gain < normal.gain);
  assert.ok(focused.lowpassHz < normal.lowpassHz);

  const before = spatial.snapshot().mix.space;
  const after = spatial.adjustInstallation('space', 0.12);
  assert.ok(after > before);
  assert.equal(spatial.snapshot().focus, true);
});
