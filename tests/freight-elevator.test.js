import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREIGHT_ALIGNMENT_TOLERANCE,
  FREIGHT_FLOORS,
  freightAligned,
  freightLandingTapeLabel,
  historicalLayerAt,
  stepFreightPosition,
} from '../src/gameplay/FreightElevatorSystem.js';
import { createGameSpace } from '../src/world/upstairs/gameSpace.js';

test('manual freight can overshoot a floor and must be corrected back to the landing tape', () => {
  let position = FREIGHT_FLOORS.roof;
  for (let i = 0; i < 160; i++) position = stepFreightPosition(position, 1, 0.68);
  assert.ok(position > FREIGHT_FLOORS.alley);
  assert.equal(freightAligned(position, FREIGHT_FLOORS.alley), false);

  while (position > FREIGHT_FLOORS.alley + FREIGHT_ALIGNMENT_TOLERANCE / 2) {
    position = stepFreightPosition(position, -1, 0.34);
  }
  assert.equal(freightAligned(position, FREIGHT_FLOORS.alley), true);
});

test('freight historical excavation changes as the cage passes through the shaft', () => {
  const roof = historicalLayerAt(0);
  const middle = historicalLayerAt(55);
  const yard = historicalLayerAt(100);
  assert.match(roof.title, /ROOF/);
  assert.notEqual(middle.title, roof.title);
  assert.match(yard.title, /YARD|FOUNDATION/);
  assert.match(middle.detail, /Breakglass|freight|building|rooms/i);
});

test('Spectra rear couch faces back toward the console', () => {
  const space = createGameSpace();
  const couch = space.fixtures.find((fixture) => fixture.id === 'mix-sofa-rear');
  assert.ok(couch);
  assert.equal(couch.rotationY, Math.PI);
});


test('freight tape labels distinguish the moving elevator from each landing', () => {
  assert.equal(freightLandingTapeLabel(FREIGHT_FLOORS.roof), 'ROOF TAPE');
  assert.equal(freightLandingTapeLabel(FREIGHT_FLOORS.alley), 'ALLEY TAPE');
});
