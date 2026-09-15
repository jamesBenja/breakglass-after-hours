import assert from 'node:assert/strict';
import test from 'node:test';
import { AlleySystem } from '../src/alley/AlleySystem.js';
import '../src/gameplay/partyPressureEnhancements.js';

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

test('a healthy indoor party does not call police just because the music is loud', () => {
  const alley = new AlleySystem({
    startOccupancy: 4,
    conversationLevel: 0.22,
    disturbance: 0.14,
    neighborTolerance: 0.55,
  });
  alley.setPartyContext({
    attendance: 92,
    capacity: 110,
    danceFloor: 78,
    danceShare: 0.85,
    mixQuality: 0.94,
  });

  for (let second = 0; second < 90; second += 1) alley.update(1, loudParty);

  assert.equal(alley.snapshot().policePresent, false);
  assert.equal(alley.snapshot().policeVisits, 0);
});

test('losing the floor creates spill-out pressure and sends more people outside', () => {
  const healthy = new AlleySystem({ startOccupancy: 4 });
  const failing = new AlleySystem({ startOccupancy: 4 });

  healthy.setPartyContext({
    attendance: 84,
    capacity: 110,
    danceFloor: 70,
    danceShare: 0.83,
    mixQuality: 0.92,
  });
  failing.setPartyContext({
    attendance: 84,
    capacity: 110,
    danceFloor: 18,
    danceShare: 0.21,
    mixQuality: 0.31,
  });

  for (let second = 0; second < 24; second += 1) {
    healthy.update(1, loudParty);
    failing.update(1, loudParty);
  }

  assert.ok(failing.snapshot().spillOutPressure > healthy.snapshot().spillOutPressure);
  assert.ok(failing.snapshot().occupancy > healthy.snapshot().occupancy);
});

test('sustained rowdy outside noise brings police and cooperation sends them away', () => {
  const alley = new AlleySystem({
    startOccupancy: 14,
    conversationLevel: 0.8,
    disturbance: 0.82,
    neighborTolerance: 0.3,
  });
  alley.setPartyContext({
    attendance: 90,
    capacity: 110,
    danceFloor: 14,
    danceShare: 0.16,
    mixQuality: 0.25,
  });
  alley.chat(0.44);

  for (let second = 0; second < 30 && !alley.snapshot().policePresent; second += 1) {
    alley.update(1, loudParty);
  }

  assert.equal(alley.snapshot().policePresent, true);
  assert.equal(alley.snapshot().policeVisits, 1);
  assert.equal(alley.interactionTargets()[0].action, 'police');

  alley.resolvePolice('cooperate');
  assert.equal(alley.snapshot().policePresent, false);
  assert.equal(alley.snapshot().evacuationRequired, false);
});

test('return police visits warn first, while arguing or ignoring still shuts down the party', () => {
  const argument = new AlleySystem({ disturbance: 0.9 });
  argument.arrivePolice();
  argument.resolvePolice('argue');
  assert.equal(argument.snapshot().evacuationRequired, true);

  const repeat = new AlleySystem({ disturbance: 0.9 });
  repeat.arrivePolice();
  repeat.resolvePolice('cooperate');
  repeat.policeCooldown = 0;
  repeat.arrivePolice();

  assert.equal(repeat.snapshot().policeVisits, 2);
  assert.equal(repeat.snapshot().policePresent, true);
  assert.equal(repeat.snapshot().evacuationRequired, false);

  repeat.update(34, loudParty);
  assert.equal(repeat.snapshot().evacuationRequired, true);
  assert.equal(repeat.snapshot().lastPoliceOutcome, 'ignored');
});
