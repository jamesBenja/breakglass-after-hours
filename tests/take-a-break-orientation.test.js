import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { buildTakeABreakFurniture } from '../src/scenes/geometry/roomFurniture.js';

test('Take A Break couches face toward the room interior', () => {
  const root = new Group();
  buildTakeABreakFurniture(root);
  const front = root.getObjectByName('take-a-break-front-couch');
  const back = root.getObjectByName('take-a-break-back-couch');
  const side = root.getObjectByName('take-a-break-side-couch');
  assert.ok(front && back && side);
  assert.equal(front.rotation.y, Math.PI);
  assert.equal(back.rotation.y, 0);
  assert.equal(side.rotation.y, Math.PI / 2);
});
