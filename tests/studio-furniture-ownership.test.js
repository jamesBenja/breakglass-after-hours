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

  assert.ok(furnitureIds.length >= 2, 'expected Spectra suite furniture fixtures');

  for (const id of furnitureIds) {
    const matches = [];
    root.traverse((object) => {
      if (object.name === id) matches.push(object);
    });
    assert.equal(matches.length, 1, `${id} should have exactly one rendered owner`);
  }

  globalThis.document = previousDocument;
});
