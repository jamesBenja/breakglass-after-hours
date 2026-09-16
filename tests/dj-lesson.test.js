import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDjMix, DJ_LESSON_STAGES } from '../src/gameplay/DjLessonSystem.js';

function mixerFixture({ crossfader = 0, phaseA = 0, phaseB = 0, a = {}, b = {} } = {}) {
  const decks = {
    A: {
      id: 'A',
      trackId: 'in-flux-just-be',
      playing: true,
      bpm: 126,
      level: 0.82,
      low: 0,
      ...a,
    },
    B: {
      id: 'B',
      trackId: 'in-flux-break',
      playing: true,
      bpm: 126,
      level: 0.82,
      low: -1,
      ...b,
    },
  };
  return {
    decks,
    crossfader,
    phase: (deck) => (deck.id === 'A' ? phaseA : phaseB),
    deckPosition: () => 0,
  };
}

test('DJ lesson has a complete seven-step learning arc', () => {
  assert.deepEqual(DJ_LESSON_STAGES, [
    'one-deck',
    'second-deck',
    'tempo',
    'phase',
    'bass',
    'selection',
    'floor',
  ]);
});

test('clean aligned blend keeps trainwreck risk low', () => {
  const mixer = mixerFixture({ phaseA: 0.04, phaseB: 0.05 });
  const result = analyzeDjMix(mixer, { playing: true, mixQuality: 0.95, energy: 0.76 });
  assert.ok(result.beatAlignment > 0.95);
  assert.equal(result.tempoMatch, 1);
  assert.ok(result.bassClash < 0.05);
  assert.ok(result.trainwreck < 0.2);
  assert.ok(result.vibe > 0.6);
});

test('stacked timing, tempo, bass and level mistakes create a real trainwreck', () => {
  const mixer = mixerFixture({
    phaseA: 0,
    phaseB: 0.5,
    a: { bpm: 124, level: 1, low: 0 },
    b: { bpm: 132, level: 1, low: 0 },
  });
  const result = analyzeDjMix(mixer, { playing: true, mixQuality: 0.38, energy: 0.86 });
  assert.ok(result.bpmDistance >= 8);
  assert.ok(result.bassClash > 0.9);
  assert.ok(result.overload > 0.7);
  assert.ok(result.trainwreck > 0.7);
  assert.ok(result.vibe < 0.15);
  assert.equal(result.floorState, 'trainwreck');
});

test('one exposed deck is not punished for not blending', () => {
  const mixer = mixerFixture({
    crossfader: -1,
    b: { playing: false, low: 0 },
  });
  const result = analyzeDjMix(mixer, { playing: true, mixQuality: 0.82, energy: 0.7 });
  assert.equal(result.overlap, 0);
  assert.equal(result.bassClash, 0);
  assert.equal(result.trainwreck, 0);
  assert.ok(result.vibe > 0.5);
});

test('an audible deck cut to silence is treated as dead air', () => {
  const mixer = mixerFixture({
    crossfader: -1,
    a: { level: 0 },
    b: { playing: false },
  });
  const result = analyzeDjMix(mixer, { playing: true, mixQuality: 0.82, energy: 0.7 });
  assert.equal(result.deadAir, true);
  assert.equal(result.trainwreck, 1);
  assert.ok(result.vibe <= 0.02);
});
