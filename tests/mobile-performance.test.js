import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardPerformance } from '../src/studio/KeyboardPerformance.js';

const target = () => ({
  addEventListener() {},
  removeEventListener() {},
});

const audio = () => {
  const calls = [];
  return {
    calls,
    tone(...args) {
      calls.push(['tone', ...args]);
    },
    kick() {
      calls.push(['kick']);
    },
    hat(...args) {
      calls.push(['hat', ...args]);
    },
  };
};

test('touch-note API plays and records the same event format as keyboard input', () => {
  const engine = audio();
  const performance = new KeyboardPerformance(engine, target(), undefined);
  performance.start(
    { mode: 'synth', label: 'Touch Synth', baseMidi: 48, wave: 'triangle', duration: 0.3 },
    { record: true },
  );

  assert.equal(performance.playMidi(60), true);
  assert.equal(performance.playKey('x'), true);
  const take = performance.stop();

  assert.equal(take.mode, 'synth');
  assert.equal(take.events.length, 2);
  assert.equal(take.events[0].midi, 60);
  assert.equal(take.events[1].midi, 50);
  assert.equal(engine.calls.filter(([type]) => type === 'tone').length, 2);
  performance.dispose();
});

test('touch drum pads play and record named drum events', () => {
  const engine = audio();
  const performance = new KeyboardPerformance(engine, target(), undefined);
  performance.start({ mode: 'drums', label: 'Touch Drums' }, { record: true });

  assert.equal(performance.triggerDrum('kick'), true);
  assert.equal(performance.triggerDrum('snare'), true);
  assert.equal(performance.triggerDrum('not-a-drum'), false);
  const take = performance.stop();

  assert.deepEqual(
    take.events.map((event) => event.drum),
    ['kick', 'snare'],
  );
  assert.ok(engine.calls.some(([type]) => type === 'kick'));
  assert.ok(engine.calls.some(([type]) => type === 'tone'));
  performance.dispose();
});
