import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectraRecorder } from '../src/studio/SpectraRecorder.js';

function studioSession() {
  return {
    bpm: 120,
    loopEnabled: true,
    loopBars: 2,
    takeCounter: 0,
    stems: [],
    addTake(kind, label, source, processing = null) {
      this.takeCounter += 1;
      const stem = {
        id: `${kind}-${this.takeCounter}`,
        kind,
        label,
        source,
        processing,
        performance: null,
      };
      this.stems.push(stem);
      return stem;
    },
    attachPerformance(stemId, performance) {
      const stem = this.stems.find((item) => item.id === stemId);
      if (!stem) return false;
      stem.performance = performance;
      return true;
    },
  };
}

test('Spectra live recorder builds separate stems for simultaneous local and remote players', () => {
  const studio = studioSession();
  let saves = 0;
  let mixUpdates = 0;
  const remotePlayers = new Map([['remote-1', { avatar: { displayName: 'Nora' } }]]);
  const game = {
    studio,
    studioPlayback: {
      playing: true,
      position: () => 1.25,
      updateMix: () => {
        mixUpdates += 1;
      },
    },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers },
    save: () => {
      saves += 1;
    },
  };
  const recorder = new SpectraRecorder(game, {});

  recorder.arm();
  recorder.captureLocal(
    {
      mode: 'guitar',
      stemKind: 'guitar',
      label: 'Guitar → Twin',
      wave: 'triangle',
      volume: 0.06,
      duration: 0.5,
      processing: { amp: 'twin', eq: 'spectra-eq', compressor: 'fet-comp' },
    },
    { type: 'chord', midis: [48, 52, 55], direction: 'down' },
    { resourceId: 'upstairs:guitar-rack' },
  );
  recorder.captureRemote(
    {
      sceneId: 'upstairs',
      resourceId: 'upstairs:drums',
      config: { mode: 'drums', stemKind: 'drums', label: 'Drum kit' },
      event: { type: 'drum', name: 'kick' },
    },
    'remote-1',
  );

  const committed = recorder.stop({ commit: true });
  assert.equal(committed.length, 2);
  assert.equal(studio.stems.length, 2);
  assert.equal(studio.stems[0].label, 'James · Guitar → Twin');
  assert.equal(studio.stems[1].label, 'Nora · Drum kit');
  assert.equal(studio.stems[0].performance.events.length, 3);
  assert.deepEqual(
    studio.stems[0].performance.events.map((event) => event.midi),
    [48, 52, 55],
  );
  assert.equal(studio.stems[1].performance.events[0].drum, 'kick');
  assert.equal(studio.stems[0].processing.amp, 'twin');
  assert.equal(saves, 1);
  assert.equal(mixUpdates, 1);
});

test(
  'Spectra recorder ignores performances until armed and rejects remote events from another scene',
  () => {
  const studio = studioSession();
  const game = {
    studio,
    studioPlayback: { playing: false, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  assert.equal(
    recorder.captureLocal(
      { mode: 'synth', label: 'Synth' },
      { type: 'midi', midi: 60 },
      { resourceId: 'upstairs:synth' },
    ),
    false,
  );

  recorder.arm();
  assert.equal(
    recorder.captureRemote(
      {
        sceneId: 'downstairs',
        resourceId: 'downstairs:drums',
        config: { mode: 'drums', label: 'Drums' },
        event: { type: 'drum', name: 'snare' },
      },
      'remote-2',
    ),
    false,
  );
  assert.equal(recorder.stop({ commit: true }).length, 0);
    assert.equal(studio.stems.length, 0);
  },
);
