import assert from 'node:assert/strict';
import test from 'node:test';
import { AlleySystem } from '../src/alley/AlleySystem.js';

const loudParty = { playing: true, energy: 1, vibe: 1 };

test('larger alley crowds create more disturbance', () => {
  const small = new AlleySystem({
    startOccupancy: 3,
    conversationLevel: 0.35,
    disturbance: 0.2,
    neighborTolerance: 0.55,
  });
  const large = new AlleySystem({
    startOccupancy: 16,
    conversationLevel: 0.35,
    disturbance: 0.2,
    neighborTolerance: 0.55,
  });

  small.update(1, { playing: false, energy: 0, vibe: 0 });
  large.update(1, { playing: false, energy: 0, vibe: 0 });

  assert.ok(large.snapshot().disturbance > small.snapshot().disturbance);
});

test('sustained alley noise brings police and cooperation sends them away with a warning', () => {
  const alley = new AlleySystem({
    startOccupancy: 18,
    conversationLevel: 0.95,
    disturbance: 0.92,
    neighborTolerance: 0.3,
  });

  alley.update(9, loudParty);
  assert.equal(alley.snapshot().policePresent, true);
  assert.equal(alley.snapshot().policeVisits, 1);
  assert.equal(alley.interactionTargets()[0].action, 'police');

  alley.resolvePolice('cooperate');
  assert.equal(alley.snapshot().policePresent, false);
  assert.equal(alley.snapshot().evacuationRequired, false);
  assert.ok(alley.snapshot().occupancy < 18);
});

test('arguing or a return police visit shuts down the party', () => {
  const argument = new AlleySystem({ disturbance: 0.9 });
  argument.arrivePolice();
  argument.resolvePolice('argue');
  assert.equal(argument.snapshot().evacuationRequired, true);

  const repeat = new AlleySystem({ disturbance: 0.9 });
  repeat.arrivePolice();
  repeat.resolvePolice('cooperate');
  repeat.policeCooldown = 0;
  repeat.occupancy = 18;
  repeat.conversationLevel = 1;
  repeat.disturbance = 0.95;
  repeat.highNoiseTime = 8;
  repeat.update(0.1, loudParty);

  assert.equal(repeat.snapshot().policeVisits, 2);
  assert.equal(repeat.snapshot().evacuationRequired, true);
});
