import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUIRED_GOOD_PLUNGES,
  adjustPlungerAngle,
  createPlungeChallenge,
  plungeToilet,
} from '../src/gameplay/ClubBathroomSystem.js';
import {
  createModularPerformance,
  modularPatchIsAudible,
  normalizeModularPatchState,
} from '../src/gameplay/ModularSynthSystem.js';
import { levels } from '../src/world/levels.js';
import { createUpstairsDefinition } from '../src/world/upstairs/definition.js';

test('Below bathroom is a navigable room with two toilets, urinal, sink and plunger', () => {
  const downstairs = levels.downstairs;
  assert.ok(downstairs.navigation.surfaces.some((surface) => surface.id === 'bathroom'));
  assert.equal(downstairs.anchors.bathroomStall1.fixtureKind, 'toilet');
  assert.equal(downstairs.anchors.bathroomStall2.fixtureKind, 'toilet');
  assert.equal(downstairs.anchors.bathroomStall2.clogged, true);
  assert.equal(downstairs.anchors.bathroomUrinal.fixtureKind, 'urinal');
  assert.equal(downstairs.anchors.bathroomSink.fixtureKind, 'sink');
  assert.equal(downstairs.anchors.bathroomPlunger.action, 'bathroomPlunge');
});

test('plunger minigame rewards the correct angle and can flood after bad plunges', () => {
  let challenge = createPlungeChallenge(0);
  while (challenge.angle < challenge.targetAngle)
    challenge = adjustPlungerAngle(challenge, Math.min(5, challenge.targetAngle - challenge.angle));
  for (let i = 0; i < REQUIRED_GOOD_PLUNGES; i++) challenge = plungeToilet(challenge);
  assert.equal(challenge.status, 'cleared');
  assert.equal(challenge.goodPlunges, REQUIRED_GOOD_PLUNGES);

  challenge = createPlungeChallenge(0);
  while (challenge.status === 'active') challenge = plungeToilet(challenge);
  assert.equal(challenge.status, 'flooded');
});

test('the patch rack beside Spectra is an interactable modular sequencer', () => {
  const upstairs = createUpstairsDefinition('B');
  assert.equal(upstairs.anchors.modularSynth.action, 'modularSynth');
  assert.ok(upstairs.anchors.modularSynth.name.toLowerCase().includes('modular'));
  assert.ok(upstairs.fixtures.some((fixture) => fixture.id === 'patch-rack'));
});

test('modular patch creates console-compatible performance events and respects broken signal paths', () => {
  const patch = normalizeModularPatchState({
    steps: [0, null, 7, null, 3, null, 10, null, 0, null, 12, null, 7, null, 3, null],
    lfoToVco: true,
  });
  assert.equal(modularPatchIsAudible(patch), true);
  const performance = createModularPerformance(patch, 120, 2);
  assert.equal(performance.mode, 'synth');
  assert.equal(performance.bpm, 120);
  assert.equal(performance.duration, 4);
  assert.ok(performance.events.length > 8);
  assert.ok(performance.events.every((event) => Number.isFinite(event.frequency)));

  patch.vcfToVca = false;
  assert.equal(modularPatchIsAudible(patch), false);
  assert.equal(createModularPerformance(patch, 120, 1).events.length, 0);
});
