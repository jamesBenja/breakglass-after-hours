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


test('Spectra outboard rack sits beside and faces with the console', () => {
  const definition = createUpstairsDefinition('B');
  const consoleFixture = definition.fixtures.find((fixture) => fixture.id === 'spectra-console');
  const rackFixture = definition.fixtures.find((fixture) => fixture.id === 'side-rack');

  assert.ok(consoleFixture, 'expected Spectra console fixture');
  assert.ok(rackFixture, 'expected Spectra outboard rack fixture');

  const consoleCenterX = (consoleFixture.x1 + consoleFixture.x2) / 2;
  const consoleCenterZ = (consoleFixture.z1 + consoleFixture.z2) / 2;
  const rackCenterX = (rackFixture.x1 + rackFixture.x2) / 2;
  const rackCenterZ = (rackFixture.z1 + rackFixture.z2) / 2;
  const consoleRightEdge = consoleFixture.x2;
  const rackLeftEdge = rackFixture.x1;

  assert.ok(rackCenterX > consoleCenterX, 'rack should sit to the right of the console');
  assert.ok(rackLeftEdge - consoleRightEdge < 0.8, 'rack should be directly beside the console');
  assert.ok(Math.abs(rackCenterZ - consoleCenterZ) < 0.05, 'rack should share the console axis');
  assert.equal(rackFixture.rotationY ?? 0, consoleFixture.rotationY ?? 0);
});
