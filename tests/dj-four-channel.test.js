import test from 'node:test';
import assert from 'node:assert/strict';
import { DjMixer } from '../src/dj/DjMixer.js';

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
  const sources = [];
  const context = {
    currentTime: 10,
    state: 'running',
    createGain: node,
    createBiquadFilter: node,
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
        onended: null,
      };
      sources.push(source);
      return source;
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
  return { mixer: new DjMixer(audio, globalThis), sources };
}

test('DJ booth exposes four independent physical sources', () => {
  const { mixer } = harness();
  assert.deepEqual(Object.keys(mixer.decks), ['A', 'B', 'C', 'D']);
  assert.equal(mixer.decks.A.deviceMode, 'cdj');
  assert.equal(mixer.decks.B.deviceMode, 'cdj');
  assert.equal(mixer.decks.C.deviceMode, 'vinyl');
  assert.equal(mixer.decks.D.deviceMode, 'vinyl');
  assert.equal(mixer.decks.A.crossSide, 'A');
  assert.equal(mixer.decks.C.crossSide, 'A');
  assert.equal(mixer.decks.B.crossSide, 'B');
  assert.equal(mixer.decks.D.crossSide, 'B');
});

test('all four DJ sources can load and play different tracks simultaneously', async () => {
  const { mixer } = harness();
  mixer.load('A', 'got-you-dancin');
  mixer.load('B', 'in-flux-just-be');
  mixer.load('C', 'atrakar');
  mixer.load('D', 'dubki');

  const started = await Promise.all([
    mixer.playDeck('A'),
    mixer.playDeck('B'),
    mixer.playDeck('C'),
    mixer.playDeck('D'),
  ]);

  assert.deepEqual(started, [true, true, true, true]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(mixer.decks).map(([id, deck]) => [id, deck.trackId])),
    {
      A: 'got-you-dancin',
      B: 'in-flux-just-be',
      C: 'atrakar',
      D: 'dubki',
    },
  );
  assert.equal(Object.values(mixer.decks).filter((deck) => deck.playing).length, 4);
  assert.equal(new Set(Object.values(mixer.decks).map((deck) => deck.source)).size, 4);
});

test('changing one channel does not mutate any other player', () => {
  const { mixer } = harness();
  mixer.load('A', 'got-you-dancin');
  mixer.load('C', 'atrakar');
  mixer.setLevel('C', 0.31);
  mixer.setEq('C', 'low', -0.8);

  assert.equal(mixer.decks.C.trackId, 'atrakar');
  assert.equal(mixer.decks.C.level, 0.31);
  assert.equal(mixer.decks.C.low, -0.8);
  assert.equal(mixer.decks.A.trackId, 'got-you-dancin');
  assert.equal(mixer.decks.A.level, 0.82);
  assert.equal(mixer.decks.A.low, 0);
});

test('crossfader groups both left players separately from both right players', () => {
  const { mixer } = harness();
  mixer.setCrossfader(-1);
  assert.equal(mixer.nativeCrossGain('A'), 1);
  assert.equal(mixer.nativeCrossGain('C'), 1);
  assert.ok(mixer.nativeCrossGain('B') < 1e-9);
  assert.ok(mixer.nativeCrossGain('D') < 1e-9);

  mixer.setCrossfader(1);
  assert.ok(mixer.nativeCrossGain('A') < 1e-9);
  assert.ok(mixer.nativeCrossGain('C') < 1e-9);
  assert.equal(mixer.nativeCrossGain('B'), 1);
  assert.equal(mixer.nativeCrossGain('D'), 1);
});

test('stopping the booth stops every independent source', async () => {
  const { mixer } = harness();
  await Promise.all(Object.keys(mixer.decks).map((deckId) => mixer.playDeck(deckId)));
  mixer.stop();
  assert.equal(Object.values(mixer.decks).some((deck) => deck.playing), false);
});
