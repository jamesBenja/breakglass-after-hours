import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_DJ_FEEDER,
  houseDjProfile,
  transitionSecondsForHouseDj,
} from '../src/gameplay/houseDjFeeder.js';

const EXPECTED_HOUSE_DJS = [
  'lunice',
  'kaytranada',
  'james-benjamin',
  'malaika',
  'siren-mars',
  'monib',
  'hydra',
  'bootyspoon',
  'marie-davidson',
  'frankie-teardrop',
];

test('house DJ feeder covers every current house DJ with overlap transitions', () => {
  assert.deepEqual(Object.keys(HOUSE_DJ_FEEDER).sort(), [...EXPECTED_HOUSE_DJS].sort());
  for (const id of EXPECTED_HOUSE_DJS) {
    const profile = houseDjProfile(id);
    assert.ok(profile.style.length > 8);
    assert.ok(profile.transitionSeconds[0] >= 2.5);
    assert.ok(profile.transitionSeconds[1] >= profile.transitionSeconds[0]);
    assert.ok(profile.vibe > 0 && profile.vibe <= 1);
    assert.ok(profile.mixQuality > 0 && profile.mixQuality <= 1);
  }
});

test('transition timing stays inside each DJs feeder range', () => {
  for (const id of EXPECTED_HOUSE_DJS) {
    const profile = houseDjProfile(id);
    assert.equal(
      transitionSecondsForHouseDj(id, () => 0),
      profile.transitionSeconds[0],
    );
    assert.equal(
      transitionSecondsForHouseDj(id, () => 1),
      profile.transitionSeconds[1],
    );
  }
});
