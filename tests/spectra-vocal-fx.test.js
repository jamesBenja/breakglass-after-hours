import test from 'node:test';
import assert from 'node:assert/strict';

import { StudioPlayback } from '../src/studio/StudioPlayback.js';

class FakeParam {
  constructor(value = 0) {
    this.value = value;
  }
  setValueAtTime(value) {
    this.value = value;
  }
  setTargetAtTime(value) {
    this.value = value;
  }
  cancelScheduledValues() {}
}

class FakeNode {
  constructor() {
    this.connections = [];
    this.disconnected = false;
    this.gain = new FakeParam(1);
    this.frequency = new FakeParam(0);
    this.Q = new FakeParam(0);
    this.threshold = new FakeParam(0);
    this.ratio = new FakeParam(1);
    this.attack = new FakeParam(0);
    this.release = new FakeParam(0);
    this.delayTime = new FakeParam(0);
    this.pan = new FakeParam(0);
    this.curve = null;
    this.oversample = 'none';
  }
  connect(destination) {
    this.connections.push(destination);
    return destination;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeAnalyser extends FakeNode {
  constructor() {
    super();
    this.fftSize = 64;
  }
  getFloatTimeDomainData(data) {
    data.fill(0);
  }
}

function makeRuntime() {
  const sources = [];
  const destination = new FakeNode();
  const context = {
    state: 'running',
    currentTime: 1,
    sampleRate: 48000,
    destination,
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createDynamicsCompressor: () => new FakeNode(),
    createDelay: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
    createAnalyser: () => new FakeAnalyser(),
    createWaveShaper: () => new FakeNode(),
    createBufferSource: () => {
      const source = new FakeNode();
      source.buffer = null;
      source.loop = false;
      source.startArgs = null;
      source.start = (...args) => {
        source.startArgs = args;
      };
      source.stop = () => {};
      sources.push(source);
      return source;
    },
  };
  const audio = {
    context,
    master: destination,
    sourceDestination: () => destination,
  };
  let timerId = 0;
  const timers = {
    setTimeout: () => ++timerId,
    clearTimeout: () => {},
  };
  return { context, audio, timers, sources };
}

test('recorded Vocal keeps direct dry playback while feeding Spectra FX in parallel', () => {
  const { context, audio, timers, sources } = makeRuntime();
  const playback = new StudioPlayback(audio, timers);
  const vocal = {
    id: 'input-vocal-22',
    label: 'Vocal 1',
    kind: 'vocal',
    inputKey: 'vocal',
    source: 'browser-microphone',
    level: 0.72,
    pan: 0,
    low: 0,
    high: 0,
    reverb: 0.8,
    delay: 0.6,
    phaser: 0.5,
    distortion: 0.4,
    clipActive: true,
    mute: false,
    solo: false,
    fxSettings: {},
  };
  const session = {
    stems: [vocal],
    recordings: new Map(),
    recordingBlobs: new Map(),
    bpm: 118,
    loopEnabled: true,
    loopBars: 1,
  };

  playback.session = session;
  playback.updateMix(session, { immediate: true });
  const bus = playback.buses.get(vocal.id);
  const route = playback.createVocalDirectRoute(vocal);

  assert.ok(route);
  assert.ok(route.gain.connections.includes(context.destination));
  assert.ok(route.fxInput.connections.includes(bus.delaySend));
  assert.ok(route.fxInput.connections.includes(bus.reverbSend));
  assert.ok(route.fxInput.connections.includes(route.fxDrive));
  assert.ok(route.fxInsertWet.connections.includes(bus.channelSum));
  assert.equal(route.gain.gain.value, vocal.level);
  assert.equal(route.fxInput.gain.value, vocal.level);
  assert.equal(bus.reverbSend.gain.value, 0.8 * 0.3);
  assert.equal(bus.delaySend.gain.value, 0.6 * 0.42);
  assert.ok(route.fxInsertWet.gain.value > 0);
  assert.ok(route.fxDrive.curve instanceof Float32Array);

  const buffer = { duration: 2.5 };
  assert.equal(
    playback.scheduleVocalBufferLoop(vocal, buffer, route, context.currentTime + 0.05),
    1,
  );
  const source = sources.at(-1);
  assert.ok(source.connections.includes(route.gain));
  assert.ok(source.connections.includes(route.fxInput));

  vocal.reverb = 0;
  vocal.delay = 0;
  vocal.phaser = 0;
  vocal.distortion = 0;
  playback.updateStemMix(session, vocal.id, { immediate: true });
  assert.equal(bus.reverbSend.gain.value, 0);
  assert.equal(bus.delaySend.gain.value, 0);
  assert.equal(route.fxInsertWet.gain.value, 0);
  assert.equal(route.fxDrive.curve, null);

  vocal.level = 0.33;
  vocal.reverb = 1;
  vocal.delay = 1;
  playback.updateStemMix(session, vocal.id, { immediate: true });
  assert.equal(route.gain.gain.value, 0.33);
  assert.equal(route.fxInput.gain.value, 0.33);
  assert.equal(bus.reverbSend.gain.value, 0.3);
  assert.equal(bus.delaySend.gain.value, 0.42);

  vocal.mute = true;
  playback.updateStemMix(session, vocal.id, { immediate: true });
  assert.equal(route.gain.gain.value, 0);
  assert.equal(route.fxInput.gain.value, 0);

  playback.clearVocalDirectRoute(vocal.id);
  assert.equal(route.gain.disconnected, true);
  assert.equal(route.fxInput.disconnected, true);
  assert.equal(route.fxDrive.disconnected, true);
  assert.equal(route.fxPhaser.disconnected, true);
  assert.equal(route.fxInsertWet.disconnected, true);
});
