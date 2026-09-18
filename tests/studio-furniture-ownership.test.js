import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';
import { buildStudioEquipment } from '../src/scenes/geometry/upstairsFixtures.js';
import { buildStudioFurniture } from '../src/scenes/geometry/roomFurniture.js';

test('Spectra suite furniture is rendered once, not duplicated by the equipment pass', () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            font: '',
            fillText() {},
          };
        },
      };
    },
  };

  const root = new Group();
  const definition = createUpstairsDefinition('B');

  buildStudioEquipment(root, definition);
  buildStudioFurniture(root, definition);

  const furnitureIds = definition.fixtures
    .map((fixture) => fixture.id)
    .filter((id) => id?.startsWith('mix-sofa-') || id === 'mix-coffee-table');

  assert.equal(
    definition.fixtures.some((fixture) => fixture.id === 'mix-sofa-side'),
    false,
    'the Spectra doorway area should not contain a loveseat fixture',
  );
  assert.ok(furnitureIds.length >= 2, 'expected remaining Spectra suite furniture fixtures');

  for (const id of furnitureIds) {
    const matches = [];
    root.traverse((object) => {
      if (object.name === id) matches.push(object);
    });
    assert.equal(matches.length, 1, `${id} should have exactly one rendered owner`);
  }

  globalThis.document = previousDocument;
});

test('Spectra outboard rack sits beside the modular synth without blocking tape machines', () => {
  const definition = createUpstairsDefinition('B');
  const modularFixture = definition.fixtures.find((fixture) => fixture.id === 'patch-rack');
  const rackFixture = definition.fixtures.find((fixture) => fixture.id === 'side-rack');
  const tapeBank = definition.fixtures.find((fixture) => fixture.id === 'tape-bank');

  assert.ok(modularFixture, 'expected modular synth fixture');
  assert.ok(rackFixture, 'expected Spectra outboard rack fixture');
  assert.ok(tapeBank, 'expected tape machine bank fixture');

  const modularCenterX = (modularFixture.x1 + modularFixture.x2) / 2;
  const modularCenterZ = (modularFixture.z1 + modularFixture.z2) / 2;
  const rackCenterX = (rackFixture.x1 + rackFixture.x2) / 2;
  const rackCenterZ = (rackFixture.z1 + rackFixture.z2) / 2;
  const tapeCenterZ = (tapeBank.z1 + tapeBank.z2) / 2;

  assert.ok(rackCenterX > modularCenterX, 'rack should sit beside the modular synth');
  assert.ok(
    rackFixture.x1 - modularFixture.x2 < 0.6,
    'rack should be directly adjacent to the modular synth',
  );
  assert.ok(
    Math.abs(rackCenterZ - modularCenterZ) < 0.05,
    'rack should share the modular synth axis',
  );
  assert.equal(rackFixture.rotationY ?? 0, 0, 'rack orientation should remain unchanged');
  assert.ok(
    Math.abs(rackCenterZ - tapeCenterZ) > (rackFixture.z2 - rackFixture.z1) / 2,
    'rack should no longer block the tape machine bank',
  );
});

test('Neve outboard rack sits beside the tape machine and clear of the console', () => {
  const definition = createUpstairsDefinition('B');
  const consoleFixture = definition.fixtures.find((fixture) => fixture.id === 'neve-console');
  const rackFixture = definition.fixtures.find((fixture) => fixture.id === 'neve-side-rack');
  const tapeFixture = definition.fixtures.find((fixture) => fixture.id === 'neve-tape-machine');

  assert.ok(consoleFixture, 'expected Neve console fixture');
  assert.ok(rackFixture, 'expected Neve outboard rack fixture');
  assert.ok(tapeFixture, 'expected Neve tape machine fixture');

  const rackCenterX = (rackFixture.x1 + rackFixture.x2) / 2;
  const rackCenterZ = (rackFixture.z1 + rackFixture.z2) / 2;
  const tapeCenterX = (tapeFixture.x1 + tapeFixture.x2) / 2;
  const tapeCenterZ = (tapeFixture.z1 + tapeFixture.z2) / 2;
  const consoleCenterZ = (consoleFixture.z1 + consoleFixture.z2) / 2;

  assert.ok(rackCenterX > tapeCenterX, 'rack should sit directly beside the tape machine');
  assert.ok(rackFixture.x1 - tapeFixture.x2 < 0.3, 'rack should be adjacent to the tape machine');
  assert.ok(Math.abs(rackCenterZ - tapeCenterZ) < 0.05, 'rack should share the tape machine axis');
  assert.equal(rackFixture.rotationY ?? 0, Math.PI, 'rack orientation should stay unchanged');
  assert.ok(
    Math.abs(rackCenterZ - consoleCenterZ) > (rackFixture.z2 - rackFixture.z1) / 2,
    'rack should no longer obstruct the Neve console',
  );
});
