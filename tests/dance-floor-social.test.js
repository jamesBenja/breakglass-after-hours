import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DANCE_CIRCLE_RADIUS,
  isDanceFloorPosition,
  withinDanceCircle,
} from '../src/gameplay/DanceFloorSocial.js';

const definition = {
  id: 'downstairs',
  crowd: {
    zones: [
      { x1: -4.7, x2: 4.7, z1: -2.15, z2: 2.75, kind: 'dance' },
      { x1: 6.35, x2: 8.55, z1: 1.05, z2: 5.9, kind: 'social' },
    ],
  },
};

test('dance floor detection only accepts the downstairs dance zone', () => {
  assert.equal(isDanceFloorPosition(definition, { x: 0, z: 0 }), true);
  assert.equal(isDanceFloorPosition(definition, { x: 5.2, z: 0 }), false);
  assert.equal(isDanceFloorPosition({ ...definition, id: 'upstairs' }, { x: 0, z: 0 }), false);
});

test('dance circle range uses horizontal player distance', () => {
  assert.equal(withinDanceCircle({ x: 0, z: 0 }, { x: DANCE_CIRCLE_RADIUS, z: 0 }), true);
  assert.equal(withinDanceCircle({ x: 0, z: 0 }, { x: DANCE_CIRCLE_RADIUS + 0.01, z: 0 }), false);
});
