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
  }
  setTargetAtTime(value) {
    this.value = value;
  }
  setValueAtTime(value) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
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

function fakeAudio() {
  const context = {
    currentTime: 0,
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createDynamicsCompressor: () => new FakeNode(),
    createDelay: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
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
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0);

  first.mute = false;
  second.solo = true;
  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0);
  assert.equal(playback.buses.get(second.id).fader.gain.value, 0.64);
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
