// These regressions keep Spectra mixing local to its own channel strips and room surfaces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';
import { stopSpectraLiveInputsForMix } from '../src/gameplay/StudioLoopEnhancements.js';
import { StudioPlayback } from '../src/studio/StudioPlayback.js';
import { createGameSpace } from '../src/world/upstairs/gameSpace.js';

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.lastWrite = null;
    this.cancelled = 0;
  }
  setTargetAtTime(value) {
    this.value = value;
    this.lastWrite = 'target';
  }
  setValueAtTime(value) {
    this.value = value;
    this.lastWrite = 'value';
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
  }
  cancelScheduledValues() {
    this.cancelled += 1;
  }
}

class FakeNode {
  constructor() {
    this.gain = new FakeParam(1);
    this.frequency = new FakeParam(0);
    this.Q = new FakeParam(0);
    this.threshold = new FakeParam(0);
    this.ratio = new FakeParam(1);
    this.attack = new FakeParam(0);
    this.release = new FakeParam(0);
    this.delayTime = new FakeParam(0);
    this.pan = new FakeParam(0);
  }
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeAnalyser extends FakeNode {
  constructor() {
    super();
    this.fftSize = 128;
    this.smoothingTimeConstant = 0;
  }
  getFloatTimeDomainData(data) {
    data.fill(0.2);
  }
}

function fakeAudio(createdSources = []) {
  const context = {
    currentTime: 0,
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createDynamicsCompressor: () => new FakeNode(),
    createDelay: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
    createAnalyser: () => new FakeAnalyser(),
    createBufferSource: () => {
      const source = new FakeNode();
      source.buffer = null;
      source.startArgs = null;
      source.start = (...args) => {
        source.startArgs = args;
      };
      createdSources.push(source);
      return source;
    },
  };
  const destination = new FakeNode();
  return {
    context,
    master: destination,
    sourceDestination: () => destination,
    sourceGain: () => 1,
  };
}

function stem(id, level = 0.7) {
  return {
    id,
    label: id,
    kind: 'synth',
    level,
    pan: 0,
    low: 0,
    high: 0,
    fx: 0,
    mute: false,
    solo: false,
    clipActive: true,
    performance: {
      mode: 'synth',
      bpm: 120,
      duration: 2,
      noteDuration: 0.2,
      wave: 'triangle',
      volume: 0.06,
      events: [{ time: 0, midi: 60, frequency: 261.63 }],
    },
  };
}

test('recorded Spectra stems are controlled by their actual fader, mute and solo buses', () => {
  const playback = new StudioPlayback(fakeAudio());
  const first = stem('recorded-one', 0.82);
  const second = stem('recorded-two', 0.64);
  const session = { stems: [first, second], recordings: new Map() };

  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0.82);
  assert.equal(playback.buses.get(second.id).fader.gain.value, 0.64);

  first.level = 0.21;
  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0.21);

  first.mute = true;
  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0.21);
  assert.equal(playback.buses.get(first.id).gate.gain.value, 0);
  assert.equal(playback.buses.get(second.id).gate.gain.value, 1);

  first.mute = false;
  second.solo = true;
  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0.21);
  assert.equal(playback.buses.get(second.id).fader.gain.value, 0.64);
  assert.equal(playback.buses.get(first.id).gate.gain.value, 0);
  assert.equal(playback.buses.get(second.id).gate.gain.value, 1);

  second.solo = false;
  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).gate.gain.value, 1);
  assert.equal(playback.buses.get(second.id).gate.gain.value, 1);
});

test('Spectra channel and stereo master meters report live post-fader signal', () => {
  const playback = new StudioPlayback(fakeAudio());
  const first = stem('meter-one', 0.8);
  first.pan = -1;
  const second = stem('meter-two', 0.8);
  second.pan = 1;
  const session = { stems: [first, second], recordings: new Map() };

  playback.updateMix(session);
  const snapshot = playback.meterSnapshot(session);

  assert.ok(snapshot.channels[first.id] > 0);
  assert.ok(snapshot.channels[second.id] > 0);
  assert.ok(snapshot.master.left > 0);
  assert.ok(snapshot.master.right > 0);
});

test('frozen Spectra audio is the sole playback source while retained performance stays editable', () => {
  const createdSources = [];
  const playback = new StudioPlayback(fakeAudio(createdSources));
  const frozen = {
    ...stem('input-drum-machine', 0.72),
    kind: 'drums',
    inputKey: 'drum-machine',
    renderedAudio: true,
    performance: {
      mode: 'drums',
      bpm: 120,
      duration: 2,
      events: [{ time: 0, drum: '909-kick' }],
    },
  };
  const audioBuffer = { duration: 2 };
  const session = {
    stems: [frozen],
    recordings: new Map([[frozen.id, audioBuffer]]),
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
  };
  playback.session = session;
  playback.updateMix(session);

  let performanceCalls = 0;
  playback.renderPerformance = () => {
    performanceCalls += 1;
    return true;
  };

  playback.renderStem(frozen, 0, 0);

  assert.equal(createdSources.length, 1);
  assert.equal(createdSources[0].buffer, audioBuffer);
  assert.equal(createdSources[0].startArgs.length, 1);
  assert.equal(performanceCalls, 0);

  frozen.mute = true;
  assert.equal(playback.applyLiveMix(session), true);
  assert.equal(playback.buses.get(frozen.id).gate.gain.value, 0);
});

test('recorded drum-machine clips restart at bar one and render through the same channel strip', async () => {
  const audio = fakeAudio();
  const playback = new StudioPlayback(audio);
  const drum = {
    ...stem('input-drum-machine', 0.72),
    kind: 'drums',
    inputKey: 'drum-machine',
    performance: {
      mode: 'drums',
      bpm: 120,
      duration: 2,
      noteDuration: 0.1,
      wave: 'triangle',
      volume: 0.09,
      events: [{ time: 0, drum: '909-kick' }],
    },
  };
  const session = {
    stems: [drum],
    recordings: new Map(),
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
  };

  let subscriber = null;
  const order = [];
  playback.spectraTransport = {
    running: true,
    position: () => 0,
    positionAtOffset: () => 0,
    subscribe(_id, callback) {
      order.push('subscribe');
      subscriber = callback;
      return () => {
        subscriber = null;
      };
    },
    acquire() {
      order.push('acquire');
      return true;
    },
    restart() {
      order.push('restart');
      subscriber?.({ loopStep: 0, when: 0, position: 0 });
      return true;
    },
    release() {
      order.push('release');
      return true;
    },
  };

  const rendered = [];
  playback.renderDrumEvent = (name, bus, when) => rendered.push({ name, bus, when });

  assert.equal(await playback.play(session, 0, { restartTransport: true }), true);
  assert.deepEqual(order.slice(-3), ['subscribe', 'acquire', 'restart']);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].name, '909-kick');
  assert.equal(rendered[0].bus, playback.buses.get(drum.id).input);

  drum.level = 0.23;
  drum.fx = 0.66;
  playback.applyLiveMix(session);
  assert.equal(playback.buses.get(drum.id).fader.gain.value, 0.23);
  assert.equal(playback.buses.get(drum.id).fxGain.gain.value, 0.66 * 0.38);
});

test('Spectra reuses one white-noise buffer for repeated drum hits', () => {
  let bufferCreates = 0;
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createDynamicsCompressor: () => new FakeNode(),
    createDelay: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
    createAnalyser: () => new FakeAnalyser(),
    createBuffer(_channels, length, sampleRate) {
      bufferCreates += 1;
      const data = new Float32Array(length);
      return {
        duration: length / sampleRate,
        getChannelData: () => data,
      };
    },
  };
  const playback = new StudioPlayback({
    context,
    master: new FakeNode(),
    sourceDestination: () => new FakeNode(),
    sourceGain: () => 1,
  });

  const first = playback.sharedNoiseBuffer();
  const second = playback.sharedNoiseBuffer();

  assert.equal(first, second);
  assert.equal(bufferCreates, 1);
});

test('live Spectra console moves immediately override active playback automation', () => {
  const playback = new StudioPlayback(fakeAudio());
  const recorded = stem('recorded-live', 0.78);
  recorded.pan = -0.2;
  recorded.low = 0.1;
  recorded.high = -0.1;
  recorded.fx = 0.22;
  const session = { stems: [recorded], recordings: new Map() };

  playback.updateMix(session);
  playback.timer = 1;

  recorded.level = 0.17;
  recorded.pan = 0.64;
  recorded.low = -0.52;
  recorded.high = 0.43;
  recorded.fx = 0.81;
  playback.applyLiveMix(session);

  const bus = playback.buses.get(recorded.id);
  assert.equal(bus.fader.gain.value, 0.17);
  assert.equal(bus.pan.pan.value, 0.64);
  assert.ok(Math.abs(bus.low.gain.value - -7.8) < 1e-9);
  assert.ok(Math.abs(bus.high.gain.value - 6.45) < 1e-9);
  assert.equal(bus.fxGain.gain.value, 0.81 * 0.38);
  for (const parameter of [
    bus.fader.gain,
    bus.pan.pan,
    bus.low.gain,
    bus.high.gain,
    bus.fxGain.gain,
  ]) {
    assert.equal(parameter.lastWrite, 'value');
    assert.ok(parameter.cancelled > 0);
  }

  recorded.mute = true;
  playback.applyLiveMix(session);
  assert.equal(bus.gate.gain.value, 0);

  playback.timer = null;
  recorded.mute = false;
  recorded.level = 0.55;
  playback.applyLiveMix(session);
  assert.equal(bus.fader.gain.value, 0.55);
  assert.equal(bus.gate.gain.value, 1);
});

test('live monitored inputs enter the real Spectra channel bus', () => {
  const playback = new StudioPlayback(fakeAudio());
  const input = {
    ...stem('input-synth', 0.41),
    inputKey: 'synth',
    performance: null,
    monitor: true,
  };
  const session = { stems: [input], recordings: new Map() };
  const calls = [];
  playback.oscillator = (...args) => calls.push(args);

  assert.equal(
    playback.monitorLiveEvent(
      session,
      { mode: 'synth', stemKind: 'synth', wave: 'triangle', volume: 0.08, duration: 0.4 },
      { type: 'midi', midi: 60 },
      { resourceId: 'local:synth' },
    ),
    true,
  );

  const bus = playback.buses.get(input.id);
  assert.equal(bus.fader.gain.value, 0.41);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], bus.input);
});

test('empty monitored input channels do not generate canned playback', () => {
  const playback = new StudioPlayback(fakeAudio());
  const input = {
    ...stem('input-drum-machine', 0.72),
    inputKey: 'drum-machine',
    kind: 'drums',
    performance: null,
    monitor: true,
  };
  const session = {
    stems: [input],
    recordings: new Map(),
    bpm: 118,
    loopEnabled: true,
    loopBars: 4,
  };
  playback.session = session;
  let generated = 0;
  playback.kick = () => {
    generated += 1;
  };
  playback.noise = () => {
    generated += 1;
  };

  playback.renderStem(input, 0, 0);
  assert.equal(generated, 0);
});

test('starting Spectra mixer playback releases only live Spectra input generators', () => {
  const calls = [];
  stopSpectraLiveInputsForMix({
    drumMachine: { stopLoop: (refresh) => calls.push(['drum', refresh]) },
    modularSynth: { stopLoop: (refresh) => calls.push(['modular', refresh]) },
    keyboardPerformance: { stop: (returnTake) => calls.push(['keyboard', returnTake]) },
  });

  assert.deepEqual(calls, [
    ['drum', false],
    ['modular', false],
    ['keyboard', false],
  ]);
});

test('Spectra listening platform and rug inherit only the mixing-suite acoustic identity', () => {
  const gameSpace = createGameSpace();
  const deck = gameSpace.platforms.find((surface) => surface.id === 'listening-deck');
  const rug = gameSpace.platforms.find((surface) => surface.id === 'mix-rug');
  assert.equal(deck?.acousticSurfaceId, 'mixing-suite');
  assert.equal(rug?.acousticSurfaceId, 'mixing-suite');

  const listenerSurfaceId = SpatialAudioSystem.prototype.listenerSurfaceId;
  const player = { position: { x: 0, y: 0, z: 0 } };
  const levelFor = (surface) => ({
    definition: { id: 'upstairs' },
    collision: { surfaceAt: () => ({ surface }) },
  });

  assert.equal(listenerSurfaceId.call({}, levelFor(deck), player), 'mixing-suite');
  assert.equal(listenerSurfaceId.call({}, levelFor(rug), player), 'mixing-suite');
  assert.equal(listenerSurfaceId.call({}, levelFor({ id: 'live-room' }), player), 'live-room');
});
