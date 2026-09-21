import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectraRecorder } from '../src/studio/SpectraRecorder.js';
import { StudioSession } from '../src/studio/StudioSession.js';

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

test('Spectra master record writes only armed inputs into their standing console channels', () => {
  const studio = new StudioSession();
  const synth = studio.stems.find((stem) => stem.inputKey === 'synth');
  const guitar = studio.stems.find((stem) => stem.inputKey === 'guitar');
  studio.toggleRecordArm(synth.id);

  const game = {
    studio,
    studioPlayback: { playing: false, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  assert.ok(recorder.arm());
  assert.equal(
    recorder.captureLocal(
      { mode: 'guitar', stemKind: 'guitar', label: 'Guitar' },
      { type: 'midi', midi: 55 },
      { resourceId: 'local:guitar' },
    ),
    false,
  );
  assert.equal(
    recorder.captureLocal(
      { mode: 'synth', stemKind: 'synth', label: 'Synth' },
      { type: 'midi', midi: 60 },
      { resourceId: 'local:synth' },
    ),
    true,
  );

  const committed = recorder.stop({ commit: true });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].id, synth.id);
  assert.equal(studio.stems.length, 5);
  assert.equal(synth.performance.events[0].midi, 60);
  assert.equal(guitar.performance, null);
  assert.equal(synth.recordArm, true);
  assert.ok(studio.stems.every((stem) => stem.monitor === true));
});

test('Spectra recorder ignores performances until armed and rejects remote events from another scene', () => {
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
});

test('standalone master recording starts the take clock on the first played event', () => {
  const studio = new StudioSession();
  const synth = studio.stems.find((stem) => stem.inputKey === 'synth');
  studio.toggleRecordArm(synth.id);

  let transportPosition = 8;
  const transport = {
    running: true,
    acquire: () => {},
    release: () => {},
    positionAtOffset(offset = 0) {
      return transportPosition + offset;
    },
    quantizeTime(time) {
      return time;
    },
    snapshot() {
      return { running: true };
    },
  };
  const game = {
    studio,
    spectraTransport: transport,
    studioPlayback: { playing: false, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  assert.ok(recorder.arm());
  assert.equal(
    recorder.captureLocal(
      { mode: 'synth', stemKind: 'synth', label: 'Synth' },
      { type: 'midi', midi: 60 },
      { resourceId: 'local:synth' },
    ),
    true,
  );
  transportPosition = 9.25;
  assert.equal(
    recorder.captureLocal(
      { mode: 'synth', stemKind: 'synth', label: 'Synth' },
      { type: 'midi', midi: 64 },
      { resourceId: 'local:synth' },
    ),
    true,
  );

  const [committed] = recorder.stop({ commit: true });
  assert.deepEqual(
    committed.performance.events.map((event) => event.time),
    [0, 1.25],
  );
});

test('master recording forces a fixed quantized loop and wraps events inside it', () => {
  const studio = new StudioSession();
  studio.loopEnabled = false;
  studio.loopBars = 1;
  studio.quantize = '1/16';
  const synth = studio.stems.find((stem) => stem.inputKey === 'synth');
  studio.toggleRecordArm(synth.id);

  let absolute = 0;
  const transport = {
    running: true,
    acquire: () => {},
    release: () => {},
    absolutePosition(offset = 0) {
      return absolute + offset;
    },
    positionAtOffset(offset = 0) {
      return (absolute + offset) % 2;
    },
    quantizeTime(time) {
      return ((Math.round(time / 0.125) * 0.125) % 2 + 2) % 2;
    },
    snapshot: () => ({ running: true }),
  };
  const game = {
    studio,
    spectraTransport: transport,
    studioPlayback: { playing: false, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  assert.ok(recorder.arm());
  assert.equal(studio.loopEnabled, true);
  absolute = 7.8;
  recorder.captureLocal(
    { mode: 'synth', stemKind: 'synth', label: 'Synth' },
    { type: 'midi', midi: 60 },
    { resourceId: 'local:synth' },
  );
  absolute = 10.05;
  recorder.captureLocal(
    { mode: 'synth', stemKind: 'synth', label: 'Synth' },
    { type: 'midi', midi: 64 },
    { resourceId: 'local:synth' },
  );

  const [committed] = recorder.stop({ commit: true });
  assert.equal(committed.performance.duration, 2);
  assert.deepEqual(
    committed.performance.events.map((event) => event.time),
    [0, 0.25],
  );
  assert.equal(committed.clipActive, true);
  assert.equal(committed.clipStart, 0);
});

test('Spectra recorder uses the shared transport grid for attached live instruments', () => {
  const studio = studioSession();
  studio.quantize = '1/16';
  studio.swing = 0.24;
  const owners = new Set();
  const transport = {
    running: true,
    session: studio,
    acquire(owner) {
      owners.add(owner);
    },
    release(owner) {
      owners.delete(owner);
    },
    snapshot() {
      return { running: true, bar: 1, beat: 2, sixteenth: 1 };
    },
    positionAtOffset(offset = 0) {
      return 0.14 + offset;
    },
    quantizeTime(time) {
      return time < 0.16 ? 0.155 : time;
    },
  };
  const game = {
    studio,
    spectraTransport: transport,
    studioPlayback: { playing: true, position: () => 0, updateMix: () => {} },
    state: { data: { avatar: { displayName: 'James' } } },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    multiplayer: { localId: 'local-1', remotePlayers: new Map() },
    save: () => {},
  };
  const recorder = new SpectraRecorder(game, {});

  recorder.arm();
  assert.equal(owners.has('spectra-recorder'), true);
  recorder.captureLocal(
    { mode: 'synth', stemKind: 'synth', label: 'Piano' },
    { type: 'midi', midi: 60 },
    { resourceId: 'upstairs:piano' },
  );
  const [stem] = recorder.stop({ commit: true });

  assert.equal(stem.performance.events[0].time, 0.155);
  assert.equal(owners.has('spectra-recorder'), false);
});
