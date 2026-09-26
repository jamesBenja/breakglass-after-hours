import test from 'node:test';
import assert from 'node:assert/strict';
import { DjMixer } from '../src/dj/DjMixer.js';
import { installDjSyncEnhancements } from '../src/gameplay/djSyncEnhancements.js';
import { installDjPerformanceRealism } from '../src/gameplay/DjPerformanceRealismSystem.js';
import { installDjAccuracyEnhancements } from '../src/gameplay/DjAccuracyEnhancements.js';

function harness() {
  const timers = {
    callback: null,
    setInterval: () => 1,
    clearInterval() {},
    setTimeout(callback) {
      this.callback = callback;
      return 2;
    },
    clearTimeout() {
      this.callback = null;
    },
  };
  const context = { currentTime: 10, state: 'running' };
  const audio = {
    context,
    master: {},
    environment: { gain: 1 },
    externalTransports: new Map(),
    setExternalTransport() {},
    updateExternalTransport() {},
    clearExternalTransport() {},
  };
  const mixer = new DjMixer(audio, timers);
  const game = { dj: mixer };
  installDjSyncEnhancements(game, null);
  installDjPerformanceRealism(game, null);
  installDjAccuracyEnhancements(game, null);
  return { mixer, context, timers };
}

test('tempo changes preserve the exact source playhead instead of jumping transport position', () => {
  const { mixer } = harness();
  const deck = mixer.decks.A;
  deck.playing = true;
  deck.transportOffset = 20;
  deck.transportStartedAt = 5;
  const before = mixer.deckPosition('A');
  mixer.setBpm('A', 136);
  const after = mixer.deckPosition('A');
  assert.ok(Math.abs(after - before) < 1e-9, `playhead moved from ${before} to ${after}`);
});

test('pitch range reaches the CDJ-style +/-16 percent range with fine BPM resolution', () => {
  const { mixer } = harness();
  const base = mixer.snapshot().decks.A.baseBpm;
  assert.equal(base, 135);
  assert.equal(mixer.setBpm('A', 200), base * 1.16);
  assert.equal(mixer.setBpm('A', 20), base * 0.84);
  assert.equal(mixer.setBpm('A', base + 1.37), base + 1.37);
});

test('jog nudges bend playback rate momentarily without seeking the deck', () => {
  const { mixer, timers } = harness();
  const deck = mixer.decks.A;
  deck.playing = true;
  deck.transportOffset = 42;
  deck.transportStartedAt = 10;
  deck.source = { playbackRate: { value: 1 } };
  const beforeOffset = deck.transportOffset;
  assert.equal(mixer.jog('A', 0.125), true);
  assert.equal(deck.transportOffset, beforeOffset);
  assert.ok(deck.source.playbackRate.value > 1);
  const bentRate = deck.source.playbackRate.value;
  timers.callback?.();
  assert.ok(deck.source.playbackRate.value < bentRate);
  assert.equal(deck._jogBend, 0);
});

test('DJ channel strips expose a real mid EQ control in state and snapshots', () => {
  const { mixer } = harness();
  assert.equal(mixer.setEq('A', 'mid', -0.65), -0.65);
  assert.equal(mixer.snapshot().decks.A.mid, -0.65);
});
