import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';
import { encodeWav } from '../src/studio/StudioExporter.js';
import { StudioSession } from '../src/studio/StudioSession.js';
import {
  SPECTRA_SPATIAL_SPEAKERS,
  normalizeSpatialPosition,
  spatialSpeakerGains,
} from '../src/studio/SpectraSpatialLayout.js';
import { createGameSpace } from '../src/world/upstairs/gameSpace.js';

test('Spectra spatial room mirrors Take A Break with exactly eight authored speakers', () => {
  assert.equal(SPECTRA_SPATIAL_SPEAKERS.length, 8);
  const gameSpace = createGameSpace();
  const fixtures = gameSpace.fixtures.filter((fixture) =>
    fixture.id.startsWith('spectra-spatial-speaker-'),
  );
  assert.equal(fixtures.length, 8);
  assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, 8);
  assert.ok(fixtures.every((fixture) => fixture.player === false && fixture.camera === false));
});

test('per-track spatial gains are eight-channel and equal-power normalized', () => {
  const gains = spatialSpeakerGains({ x: 0.18, y: 0.2, spread: 0.22 });
  assert.equal(gains.length, 8);
  const power = Math.sqrt(gains.reduce((sum, gain) => sum + gain * gain, 0));
  assert.ok(Math.abs(power - 1) < 1e-9);
  assert.ok(gains[0] > gains[4]);

  const wide = spatialSpeakerGains({ x: 0.5, y: 0.5, spread: 1 });
  assert.equal(wide.length, 8);
  assert.ok(Math.max(...wide) - Math.min(...wide) < 0.2);
});

test('Spectra sessions persist each track spatial position and spread', () => {
  const session = new StudioSession();
  const stem = session.stems[0];
  stem.spatial = normalizeSpatialPosition({ x: 0.82, y: 0.31, spread: 0.47, enabled: true });

  const restored = new StudioSession(session.snapshot());
  const saved = restored.stems.find((item) => item.id === stem.id);
  assert.deepEqual(saved.spatial, {
    enabled: true,
    x: 0.82,
    y: 0.31,
    spread: 0.47,
  });
});

test('Take A Break accepts saved Spectra spatial programs without changing its eight emitters', () => {
  const spatial = new SpatialAudioSystem({
    environment: {},
    activeExternalTransport: { owner: 'dj' },
  });
  spatial.setSpectraPrograms([
    {
      id: 'spectra-installation-test',
      label: 'Test spatial song',
      artist: 'Spectra',
      description: 'Eight-channel test',
      kind: 'spectra-spatial',
    },
  ]);
  const selected = spatial.setInstallationProgram('spectra-installation-test');

  assert.equal(selected.kind, 'spectra-spatial');
  assert.equal(spatial.snapshot().emitters, 8);
  assert.equal(spatial.snapshot().program.id, 'spectra-installation-test');
  assert.ok(
    spatial.snapshot().programs.some((program) => program.id === 'spectra-installation-test'),
  );
});

test('WAV encoder preserves all eight channels for installation renders', () => {
  const channels = Array.from({ length: 8 }, (_, channel) =>
    Float32Array.from([channel / 16, -channel / 16]),
  );
  const buffer = {
    numberOfChannels: 8,
    length: 2,
    sampleRate: 44100,
    getChannelData(index) {
      return channels[index];
    },
  };
  const bytes = encodeWav(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint16(22, true), 8);
  assert.equal(view.getUint32(40, true), 2 * 8 * 2);
});
