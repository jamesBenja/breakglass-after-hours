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

test('iOS interrupted WebAudio does not block house-DJ media from resuming', async () => {
  let resumeCalls = 0;
  const context = {
    state: 'interrupted',
    currentTime: 0,
    async resume() {
      resumeCalls += 1;
      if (resumeCalls === 1) throw new Error('Failed to start the audio device');
      this.state = 'running';
    },
  };
  const audio = new AudioEngine({ contextFactory: () => context });
  audio.context = context;

  let mediaPlayCalls = 0;
  const element = {
    paused: true,
    volume: 0,
    async play() {
      mediaPlayCalls += 1;
      this.paused = false;
    },
  };
  audio.nativeMedia.set('house-dj', {
    element,
    baseVolume: 0.8,
    owner: 'house-dj',
    resumeAfterSuspend: true,
  });

  assert.equal(
    await audio.resume(),
    false,
    'device recovery can remain pending after visibility return',
  );
  assert.equal(audio._contextResumePending, true);
  assert.equal(audio._nativeMediaResumePending, false);
  assert.equal(mediaPlayCalls, 1, 'native house-DJ media still restarts despite WebAudio failure');
  assert.equal(element.paused, false);

  assert.equal(
    await audio.resume(),
    true,
    'a later gesture can recover the interrupted AudioContext',
  );
  assert.equal(context.state, 'running');
  assert.equal(audio._contextResumePending, false);
  assert.equal(resumeCalls, 2);
});
