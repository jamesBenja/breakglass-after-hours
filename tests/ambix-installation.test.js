import test from 'node:test';
import assert from 'node:assert/strict';
import { ambixFirstOrderDecodeWeights } from '../src/audio/SpatialAudioSystem.js';
import { installationProgramById } from '../src/audio/InstallationPrograms.js';
import { TAKE_A_BREAK_SPEAKERS } from '../src/gameplay/TakeABreakImmersiveSystem.js';

test('rainforest program uses a real first-order AmbiX runtime asset with procedural fallback', () => {
  const program = installationProgramById('rainforest-study');
  assert.equal(program.kind, 'ambix-recorded');
  assert.equal(program.assetId, 'rainforest-ambix-dawn-loop');
  assert.equal(program.ambixFormat, 'ACN/SN3D');
  assert.equal(program.ambixOrder, 1);
  assert.equal(program.fallbackKind, 'procedural');
});

test('first-order AmbiX decoder emits finite W/Y/Z/X coefficients for all eight speakers', () => {
  const weights = TAKE_A_BREAK_SPEAKERS.map(ambixFirstOrderDecodeWeights);
  assert.equal(weights.length, 8);
  for (const speaker of weights) {
    assert.equal(speaker.length, 4);
    assert.ok(speaker.every(Number.isFinite));
  }

  const omniEnergy = weights.reduce((sum, speaker) => sum + speaker[0] ** 2, 0);
  assert.ok(Math.abs(omniEnergy - 1) < 1e-9);

  const left = weights[0];
  const right = weights[4];
  assert.notEqual(Math.sign(left[3]), Math.sign(right[3]));
});
