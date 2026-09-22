import test from 'node:test';
import assert from 'node:assert/strict';
import { collectGodModeTeleportDestinations, teleportGodMode } from '../src/gameplay/GodMode.js';

function makeLevel(id = 'upstairs') {
  return {
    definition: {
      id,
      title: id === 'upstairs' ? 'UPSTAIRS — BREAKGLASS STUDIOS' : 'BELOW BREAKGLASS',
      cameraOffset: [4, 3, 4],
      camera: { mode: 'close' },
      rooms:
        id === 'upstairs'
          ? [
              {
                id: 'mixing',
                name: 'Mixing Suite',
                points: [
                  [0, 0],
                  [4, 0],
                  [4, 4],
                  [0, 4],
                ],
              },
            ]
          : [],
      navigation:
        id === 'downstairs'
          ? {
              surfaces: [
                { id: 'club', name: 'Below Breakglass', x1: -5, x2: 5, z1: -3, z2: 3, y: 0 },
              ],
            }
          : undefined,
      anchors: {
        console: {
          name: 'Spectra console',
          position: [-12.3, 0.28, -0.55],
          radius: 1.8,
          action: 'console',
        },
        locked: {
          name: 'Storage · locked',
          position: [2, 0, 2],
          radius: 1,
          action: 'progressionDoor',
        },
      },
      spawns: {
        start: [0, 0, 0],
      },
    },
    collision: {
      surfaceAt(x, z) {
        return { surface: { id: 'floor' }, height: x < -10 ? 0.28 : 0 };
      },
      isValidPosition(position) {
        return (
          Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)
        );
      },
    },
  };
}

test('God Mode teleport list includes live rooms, anchors and spawns with Spectra featured', () => {
  const upstairs = makeLevel('upstairs');
  const downstairs = makeLevel('downstairs');
  const game = {
    scenes: new Map([
      ['upstairs', upstairs],
      ['downstairs', downstairs],
    ]),
  };

  const destinations = collectGodModeTeleportDestinations(game);
  const spectra = destinations.find((destination) => destination.id === 'upstairs:anchor:console');

  assert.ok(spectra);
  assert.equal(spectra.featured, true);
  assert.equal(spectra.label, 'Spectra console');
  assert.ok(destinations.some((destination) => destination.id === 'upstairs:room:mixing'));
  assert.ok(destinations.some((destination) => destination.id === 'downstairs:room:club'));
  assert.ok(destinations.some((destination) => destination.id === 'upstairs:spawn:start'));
  assert.equal(
    destinations.some((destination) => destination.id === 'upstairs:anchor:locked'),
    false,
  );
});

test('God Mode teleports across floors through SceneManager at a collision-safe height', () => {
  const upstairs = makeLevel('upstairs');
  const downstairs = makeLevel('downstairs');
  const calls = [];
  const game = {
    godMode: true,
    scenes: new Map([
      ['upstairs', upstairs],
      ['downstairs', downstairs],
    ]),
    sceneManager: {
      changing: false,
      current: downstairs,
      enter(...args) {
        calls.push(args);
      },
    },
    input: { clear() {} },
  };

  const destination = teleportGodMode(game, 'upstairs:anchor:console', { warning() {} });

  assert.equal(destination?.label, 'Spectra console');
  assert.deepEqual(destination?.position, [-12.3, 0.28, -0.55]);
  assert.deepEqual(calls, [['upstairs', 'start', [-12.3, 0.28, -0.55]]]);
});

test('God Mode same-floor teleport moves the player without re-entering the scene', () => {
  const upstairs = makeLevel('upstairs');
  const spawns = [];
  const cameraCalls = [];
  const game = {
    godMode: true,
    scenes: new Map([['upstairs', upstairs]]),
    sceneManager: {
      changing: false,
      current: upstairs,
      enter() {
        throw new Error('same-floor teleport should not re-enter the scene');
      },
    },
    player: {
      position: { x: 0, y: 0, z: 0 },
      spawn(position) {
        spawns.push(position);
        [this.position.x, this.position.y, this.position.z] = position;
      },
    },
    camera: {
      configure(...args) {
        cameraCalls.push(args);
      },
    },
    interactions: { setLevel() {} },
    input: { clear() {} },
    save() {},
  };

  const destination = teleportGodMode(game, 'upstairs:anchor:console', { warning() {} });

  assert.equal(destination?.id, 'upstairs:anchor:console');
  assert.deepEqual(spawns, [[-12.3, 0.28, -0.55]]);
  assert.equal(cameraCalls.length, 1);
});
