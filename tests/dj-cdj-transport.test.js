import test from 'node:test';
import assert from 'node:assert/strict';
import { DjMixer } from '../src/dj/DjMixer.js';
import { installDjPerformanceRealism } from '../src/gameplay/DjPerformanceRealismSystem.js';

function audioParam(value = 0) {
  return {
    value,
    setTargetAtTime(next) {
      this.value = next;
    },
  };
}

function node() {
  return {
    gain: audioParam(1),
    frequency: audioParam(0),
    connect() {},
    disconnect() {},
  };
}

function harness() {
  const context = {
    currentTime: 10,
    state: 'running',
    sampleRate: 48000,
    createGain: node,
    createBiquadFilter: node,
    createStereoPanner() {
      return {
        pan: audioParam(0),
        connect() {},
        disconnect() {},
      };
    },
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        onended: null,
      };
    },
  };
  const destination = node();
  const audio = {
    context,
    master: destination,
    environment: { gain: 1 },
    externalTransports: new Map(),
    sourceDestination: () => destination,
    sourceGain: () => 1,
    assets: {
      audio: async () => ({ duration: 240 }),
    },
    setExternalTransport() {},
    updateExternalTransport() {},
    clearExternalTransport() {},
  };
  const mixer = new DjMixer(audio, globalThis);
  installDjPerformanceRealism({ dj: mixer }, null);
  return { mixer, context };
}

test('CDJ play/pause resumes from the paused song position', async () => {
  const { mixer, context } = harness();

  assert.equal(await mixer.playDeck('A', 12), true);
  context.currentTime = 13;
  assert.equal(mixer.deckPosition('A'), 15);

  await mixer.togglePlayPause('A');
  assert.equal(mixer.decks.A.playing, false);
  assert.equal(mixer.deckPosition('A'), 15);

  context.currentTime = 20;
  assert.equal(await mixer.togglePlayPause('A'), true);
  context.currentTime = 21;
  assert.equal(mixer.deckPosition('A'), 16);
});

test('CDJ cue is gated playback that returns to the cue point on release', async () => {
  const { mixer, context } = harness();
  mixer.decks.A.cuePoint = 4;
  mixer.decks.A.transportOffset = 4;

  assert.equal(await mixer.cueDown('A'), true);
  assert.equal(mixer.decks.A.playing, true);
  context.currentTime = 10.5;
  assert.equal(mixer.deckPosition('A'), 4.5);

  assert.equal(mixer.cueUp('A'), 4);
  assert.equal(mixer.decks.A.playing, false);
  assert.equal(mixer.deckPosition('A'), 4);
});

test('pressing cue while paused establishes the main cue at the paused position', async () => {
  const { mixer, context } = harness();

  assert.equal(await mixer.playDeck('A', 12), true);
  context.currentTime = 13;
  await mixer.togglePlayPause('A');
  assert.equal(mixer.deckPosition('A'), 15);

  assert.equal(await mixer.cueDown('A'), true);
  assert.equal(mixer.decks.A.cuePoint, 15);
  mixer.cueUp('A');
  assert.equal(mixer.deckPosition('A'), 15);
});

test('pressing cue during playback jumps to cue and release leaves the CDJ cued there', async () => {
  const { mixer, context } = harness();
  mixer.decks.A.cuePoint = 3;

  assert.equal(await mixer.playDeck('A', 18), true);
  context.currentTime = 12;
  assert.equal(mixer.deckPosition('A'), 20);

  assert.equal(await mixer.cueDown('A'), true);
  assert.equal(mixer.decks.A.playing, true);
  assert.equal(mixer.deckPosition('A'), 3);

  context.currentTime = 12.25;
  assert.equal(mixer.deckPosition('A'), 3.25);
  mixer.cueUp('A');
  assert.equal(mixer.decks.A.playing, false);
  assert.equal(mixer.deckPosition('A'), 3);
});
