import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.js';
import { installAudioReliabilityEnhancements } from '../src/gameplay/audioReliabilityEnhancements.js';

function createHarness() {
  const params = () => ({
    value: 0,
    setTargetAtTime(value) {
      this.value = value;
    },
  });
  const sources = [];
  const node = () => ({
    gain: params(),
    frequency: params(),
    Q: params(),
    connect() {},
    disconnect() {},
  });
  const source = () => {
    const value = {
      ...node(),
      buffer: null,
      started: false,
      stopped: false,
      start() {
        this.started = true;
      },
      stop() {
        this.stopped = true;
      },
    };
    sources.push(value);
    return value;
  };

  let finishResume;
  let resumeCalls = 0;
  const context = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createGain: node,
    createBiquadFilter: node,
    createBufferSource: source,
    createBuffer: (_, length) => ({ getChannelData: () => new Float32Array(length) }),
    resume() {
      resumeCalls += 1;
      return new Promise((resolve) => {
        finishResume = () => {
          context.state = 'running';
          resolve();
        };
      });
    },
    async suspend() {
      context.state = 'suspended';
    },
    async close() {
      context.state = 'closed';
    },
  };

  const engine = new AudioEngine({ contextFactory: () => context });
  return {
    engine,
    context,
    sources,
    resumeCalls: () => resumeCalls,
    finishResume: () => finishResume?.(),
  };
}

test('mobile unlock primes an output source during the gesture before resume settles', async () => {
  const listeners = new Map();
  const originalWindow = globalThis.window;
  globalThis.window = {
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  const h = createHarness();
  const game = { audio: h.engine, dj: {}, async dispose() {} };
  installAudioReliabilityEnhancements(game, { warning() {} });

  const unlocking = h.engine.unlock();
  assert.equal(h.resumeCalls(), 1);
  assert.ok(
    h.sources.some((source) => source.started),
    'silent unlock source starts immediately',
  );
  assert.equal(h.engine._outputPrimed, true);
  assert.equal(h.context.state, 'suspended');

  h.finishResume();
  assert.equal(await unlocking, true);
  assert.equal(h.context.state, 'running');
  assert.equal(h.engine._audioReady, true);

  await h.engine.suspend();
  assert.equal(h.engine._outputPrimed, false, 'background suspension re-arms gesture priming');
  assert.equal(h.engine._audioReady, false);

  await game.dispose();
  globalThis.window = originalWindow;
});

test('DJ STOP cancels a PLAY that is still waiting for the iPhone audio unlock', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
  };

  let finishUnlock;
  let starts = 0;
  let stops = 0;
  const audio = {
    context: { state: 'suspended' },
    _audioReady: false,
    unlock() {
      return new Promise((resolve) => {
        finishUnlock = resolve;
      });
    },
  };
  const dj = {
    decks: { A: {}, B: {} },
    async playDeck(deckId) {
      starts += 1;
      this.decks[deckId].playing = true;
      return true;
    },
    stopDeck(deckId) {
      stops += 1;
      this.decks[deckId].playing = false;
    },
  };
  const game = { audio, dj, async dispose() {} };
  installAudioReliabilityEnhancements(game, { warning() {} });

  const pendingPlay = game.dj.playDeck('B');
  game.dj.stopDeck('B');
  finishUnlock(true);

  assert.equal(await pendingPlay, false);
  assert.equal(starts, 0, 'late unlock must not resurrect the stopped deck');
  assert.equal(stops, 1);
  assert.equal(game.dj.decks.B.playing, false);

  await game.dispose();
  globalThis.window = originalWindow;
});
