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

test('A9 color filter state is bipolar and exposed in snapshots', () => {
  const { mixer } = harness();
  assert.equal(mixer.setFilter('A', -0.75), -0.75);
  assert.equal(mixer.snapshot().decks.A.filter, -0.75);
  assert.equal(mixer.setFilter('A', 0.6), 0.6);
  assert.equal(mixer.snapshot().decks.A.filter, 0.6);
});

test('SL-1200 platter scrub persists the cue position while stopped', () => {
  const { mixer } = harness();
  const deck = mixer.decks.C;
  assert.equal(deck.deviceMode, 'vinyl');
  deck.playing = false;
  deck.transportOffset = 12;
  mixer.setPlatterHeld('C', true);
  assert.equal(mixer.scrubVinyl('C', 1.5), 13.5);
  assert.equal(mixer.deckPosition('C'), 13.5);
  mixer.setPlatterHeld('C', false);
  assert.equal(deck.transportOffset, 13.5);
  assert.equal(mixer.deckPosition('C'), 13.5);
});


test('CDJ jog backspin scrubs without changing the player into vinyl mode', () => {
  const { mixer } = harness();
  const deck = mixer.decks.A;
  assert.equal(deck.deviceMode, 'cdj');
  deck.playing = false;
  deck.transportOffset = 24;
  mixer.setJogHeld('A', true);
  assert.equal(mixer.scrubJog('A', -1.25), 22.75);
  assert.equal(mixer.deckPosition('A'), 22.75);
  mixer.setJogHeld('A', false);
  assert.equal(deck.deviceMode, 'cdj');
  assert.equal(deck.transportOffset, 22.75);
});

test('A9 Beat FX exposes channel routing, effect, beat and depth state', () => {
  const { mixer } = harness();
  assert.equal(mixer.setBeatFxTarget('CH4'), 'CH4');
  assert.equal(mixer.setBeatFxEffect('MOBIUS'), 'MOBIUS');
  assert.equal(mixer.setBeatFxBeat(2), 2);
  assert.equal(mixer.setBeatFxAmount(0.63), 0.63);
  assert.deepEqual(mixer.snapshot().beatFx, {
    enabled: false,
    target: 'CH4',
    effect: 'MOBIUS',
    beat: 2,
    amount: 0.63,
  });
});
