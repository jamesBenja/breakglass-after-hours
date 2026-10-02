import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectraClipEngine } from '../src/studio/SpectraClipEngine.js';

function makeGame({ running = true } = {}) {
  let stepCallback = null;
  let mixUpdates = 0;
  let saves = 0;
  const studio = {
    recordings: new Map(),
    stems: [
      {
        id: 'drums-1',
        label: '909 pattern',
        kind: 'drums',
        source: 'spectra-drum-machine',
        clipActive: true,
        performance: { events: [{ time: 0, drum: '909-kick' }] },
      },
      {
        id: 'vocal-1',
        label: 'Vocal loop',
        kind: 'vocal',
        source: 'browser-microphone',
        clipActive: true,
      },
    ],
  };
  studio.recordings.set('vocal-1', { duration: 2 });
  const game = {
    studio,
    spectraTransport: {
      running,
      subscribe(_id, callback) {
        stepCallback = callback;
        return () => {
          stepCallback = null;
        };
      },
    },
    studioPlayback: {
      updateMix() {
        mixUpdates += 1;
      },
    },
    save() {
      saves += 1;
    },
  };
  return {
    game,
    step(event) {
      stepCallback?.(event);
    },
    mixUpdates: () => mixUpdates,
    saves: () => saves,
  };
}

test('Spectra clip launcher waits for a bar boundary while the clock is running', () => {
  const fixture = makeGame();
  const engine = new SpectraClipEngine(fixture.game);

  engine.queue('drums-1', false);
  assert.equal(fixture.game.studio.stems[0].clipActive, true);
  assert.equal(engine.clips()[0].queued, false);

  fixture.step({ loopStep: 7 });
  assert.equal(fixture.game.studio.stems[0].clipActive, true);

  fixture.step({ loopStep: 16 });
  assert.equal(fixture.game.studio.stems[0].clipActive, false);
  assert.equal(engine.clips()[0].queued, null);
  assert.equal(fixture.mixUpdates(), 1);
  assert.equal(fixture.saves(), 1);
});

test('Spectra clip launcher applies immediately when the master clock is stopped', () => {
  const fixture = makeGame({ running: false });
  const engine = new SpectraClipEngine(fixture.game);

  engine.queue('vocal-1', false);

  assert.equal(fixture.game.studio.stems[1].clipActive, false);
  assert.equal(fixture.mixUpdates(), 1);
});

test('Spectra clip descriptions distinguish step and recorded audio clips', () => {
  const fixture = makeGame();
  const engine = new SpectraClipEngine(fixture.game);
  const clips = engine.clips();

  assert.equal(clips[0].type, 'step');
  assert.equal(clips[1].type, 'audio');
});
