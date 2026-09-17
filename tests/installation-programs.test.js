import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTALLATION_PROGRAMS,
  availableInstallationPrograms,
} from '../src/audio/InstallationPrograms.js';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';

test('Take A Break exposes four playable installation programs plus future catalog slots', () => {
  const available = availableInstallationPrograms();
  assert.deepEqual(
    available.map((program) => program.id),
    ['abstract-drift', 'rainforest-study', 'beach-field', 'mountain-snowstorm'],
  );
  assert.ok(INSTALLATION_PROGRAMS.some((program) => program.id === 'breakglass-compositions'));
  assert.ok(INSTALLATION_PROGRAMS.some((program) => program.id === 'guest-pieces'));
});

test('installation program can switch without changing the eight-speaker room architecture', () => {
  const spatial = new SpatialAudioSystem({
    environment: {},
    activeExternalTransport: { owner: 'dj' },
  });
  assert.equal(spatial.snapshot().emitters, 8);
  assert.equal(spatial.snapshot().program.id, 'abstract-drift');

  const selected = spatial.setInstallationProgram('rainforest-study');
  assert.equal(selected.id, 'rainforest-study');
  assert.equal(spatial.snapshot().program.id, 'rainforest-study');
  assert.equal(spatial.snapshot().emitters, 8);

  assert.equal(spatial.setInstallationProgram('guest-pieces'), null);
  assert.equal(spatial.snapshot().program.id, 'rainforest-study');
});

test('installation level is substantially raised and remains user-adjustable within safe bounds', () => {
  const spatial = new SpatialAudioSystem({ environment: {} });
  assert.ok(spatial.snapshot().level > 1);
  assert.equal(spatial.setInstallationLevel(4), 1.6);
  assert.equal(spatial.adjustInstallationLevel(-4), 0.35);
});

test('club becomes extremely quiet filtered bleed in Take A Break', () => {
  const spatial = new SpatialAudioSystem({
    environment: {},
    activeExternalTransport: { owner: 'dj' },
  });
  const level = { definition: { id: 'downstairs' } };
  const room = spatial.environmentFor(level, 'lounge');
  assert.ok(room.gain <= 0.05);
  assert.ok(room.lowpassHz <= 800);

  spatial.setInstallationFocus(true);
  const focus = spatial.environmentFor(level, 'lounge');
  assert.ok(focus.gain < room.gain);
  assert.ok(focus.lowpassHz < room.lowpassHz);
});
