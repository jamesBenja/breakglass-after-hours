import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTALLATION_PROGRAMS,
  availableInstallationPrograms,
} from '../src/audio/InstallationPrograms.js';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';

test('Take A Break exposes procedural studies plus the two real MFEOT listening banks', () => {
  const available = availableInstallationPrograms();
  assert.deepEqual(
    available.map((program) => program.id),
    [
      'abstract-drift',
      'rainforest-study',
      'beach-field',
      'mountain-snowstorm',
      'mfteot-nature',
      'mfteot-man',
    ],
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
  assert.equal(spatial.snapshot().program.id, 'rainforest-study');

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

function audioParam(value = 0) {
  return {
    value,
    setTargetAtTime(next) {
      this.value = next;
    },
  };
}

function audioNode(extra = {}) {
  return {
    connections: [],
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {},
    ...extra,
  };
}

test('installation output bypasses the room attenuation bus', () => {
  const destination = audioNode();
  const master = audioNode({ gain: audioParam(0.48) });
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination,
    createGain: () => audioNode({ gain: audioParam(1) }),
    createDynamicsCompressor: () =>
      audioNode({
        threshold: audioParam(),
        knee: audioParam(),
        ratio: audioParam(),
        attack: audioParam(),
        release: audioParam(),
      }),
    createBiquadFilter: () =>
      audioNode({ frequency: audioParam(4000), Q: audioParam(0.7), type: 'lowpass' }),
    createDelay: () => audioNode({ delayTime: audioParam() }),
    createOscillator: () =>
      audioNode({
        frequency: audioParam(110),
        detune: audioParam(),
        type: 'sine',
        start() {},
        stop() {},
      }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(64) }),
    createBufferSource: () => audioNode({ start() {}, stop() {}, buffer: null, loop: false }),
    createPanner: () =>
      audioNode({
        positionX: audioParam(),
        positionY: audioParam(),
        positionZ: audioParam(),
      }),
  };
  const spatial = new SpatialAudioSystem({
    context,
    master,
    environment: {},
    activeExternalTransport: { owner: 'dj' },
  });
  spatial.ensureInstallation();

  assert.ok(spatial.installationOutput.connections.includes(destination));
  assert.ok(spatial.installationLimiter.connections.includes(spatial.installationOutput));
  assert.equal(spatial.installationLimiter.connections.includes(master), false);
});

test('recorded MFEOT programs keep the same eight-speaker room and expose playlist assets', () => {
  const spatial = new SpatialAudioSystem({ environment: {} });
  const selected = spatial.setInstallationProgram('mfteot-nature');
  assert.equal(selected.kind, 'recorded-playlist');
  assert.equal(selected.assetIds.length, 5);
  assert.equal(spatial.snapshot().emitters, 8);
  assert.equal(spatial.snapshot().program.id, 'mfteot-nature');
});
