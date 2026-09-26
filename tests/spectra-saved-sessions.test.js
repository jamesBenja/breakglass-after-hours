import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioSession } from '../src/studio/StudioSession.js';
import { SpectraProjectStore } from '../src/studio/SpectraProjectStore.js';
import { validateSave } from '../src/state/GameState.js';

test('added Spectra input tracks persist with their selected input', () => {
  const session = new StudioSession();
  const added = session.addInputTrack('drum-kit');
  assert.ok(added);
  assert.equal(added.label, 'Drum Kit 2');

  const reopened = new StudioSession(session.snapshot());
  const restored = reopened.stems.find((stem) => stem.id === added.id);
  assert.ok(restored);
  assert.equal(restored.inputKey, 'drum-kit');
  assert.equal(restored.monitor, true);
  assert.equal(restored.recordArm, false);
});

test('new Spectra projects start with seven monitored input channels including Vocal', () => {
  const session = new StudioSession();
  session.newProject('New Song', 124);
  session.clickEnabled = true;

  assert.equal(session.project, true);
  assert.equal(session.name, 'New Song');
  assert.equal(session.bpm, 124);
  assert.deepEqual(
    session.stems.map((stem) => stem.inputKey),
    ['drum-machine', 'drum-kit', 'synth', 'modular', 'guitar', 'piano', 'vocal'],
  );
  assert.ok(session.stems.every((stem) => stem.monitor === true));
  assert.ok(session.stems.every((stem) => stem.recordArm === false));
  assert.equal(session.loopEnabled, true);
  assert.equal(session.loopBars, 4);

  const reopened = new StudioSession(session.snapshot());
  assert.equal(reopened.project, true);
  assert.equal(reopened.stems.length, 7);
  assert.deepEqual(
    reopened.stems.map((stem) => stem.inputKey),
    ['drum-machine', 'drum-kit', 'synth', 'modular', 'guitar', 'piano', 'vocal'],
  );
  assert.equal(reopened.name, 'New Song');
  assert.equal(reopened.clickEnabled, true);
});

test('legacy Spectra input sessions regain missing Modular Synth and Vocal channels', () => {
  const oldFive = new StudioSession({
    project: true,
    name: 'Existing Session',
    stems: [
      {
        id: 'input-drum-machine',
        label: 'Drum Machine',
        kind: 'drums',
        inputKey: 'drum-machine',
        level: 0.72,
      },
      { id: 'input-drum-kit', label: 'Drum Kit', kind: 'drums', inputKey: 'drum-kit', level: 0.74 },
      { id: 'input-synth', label: 'Synth', kind: 'synth', inputKey: 'synth', level: 0.66 },
      { id: 'input-guitar', label: 'Guitar', kind: 'guitar', inputKey: 'guitar', level: 0.64 },
      { id: 'input-piano', label: 'Piano', kind: 'keys', inputKey: 'piano', level: 0.66 },
    ],
  });

  assert.deepEqual(
    oldFive.stems.map((stem) => stem.inputKey),
    ['drum-machine', 'drum-kit', 'synth', 'modular', 'guitar', 'piano', 'vocal'],
  );
  assert.equal(oldFive.stems.find((stem) => stem.inputKey === 'modular')?.label, 'Modular Synth');
  assert.equal(oldFive.stems.find((stem) => stem.inputKey === 'vocal')?.label, 'Vocal');
});

test('deleting the default Vocal track stays deleted after the new input schema is saved', () => {
  const session = new StudioSession();
  const vocal = session.stems.find((stem) => stem.id === 'input-vocal');
  assert.ok(vocal);

  session.removeTrack(vocal.id);
  const reopened = new StudioSession(session.snapshot());

  assert.equal(
    reopened.stems.some((stem) => stem.inputKey === 'vocal'),
    false,
  );
});

test('additional Vocal tracks persist as normal Spectra inputs', () => {
  const session = new StudioSession();
  const added = session.addInputTrack('vocal');
  assert.ok(added);
  assert.equal(added.label, 'Vocal 2');

  const reopened = new StudioSession(session.snapshot());
  const restored = reopened.stems.find((stem) => stem.id === added.id);
  assert.ok(restored);
  assert.equal(restored.inputKey, 'vocal');
  assert.equal(restored.kind, 'vocal');
});

test('saved Spectra projects survive normal game-save validation with instrument state', () => {
  const session = new StudioSession();
  session.newProject('Session A', 118);
  const saved = validateSave({
    version: 1,
    studio: session.snapshot(),
    activeStudioProjectId: 'project-a',
    studioProjects: [
      {
        id: 'project-a',
        name: 'Session A',
        createdAt: 10,
        updatedAt: 20,
        session: session.snapshot(),
        drumMachine: { kit: '909', selectedPattern: 'B' },
        modularSynth: { wave: 'square' },
      },
    ],
  });

  assert.equal(saved.studioProjects.length, 1);
  assert.equal(saved.activeStudioProjectId, 'project-a');
  assert.equal(saved.studioProjects[0].session.project, true);
  assert.equal(saved.studioProjects[0].session.stems.length, 7);
  assert.equal(saved.studioProjects[0].drumMachine.kit, '909');
  assert.equal(saved.studioProjects[0].modularSynth.wave, 'square');
});

test('Spectra project audio store persists frozen performance audio beside source events', async () => {
  const store = new SpectraProjectStore(null);
  const fakeBlob = { arrayBuffer: async () => new ArrayBuffer(16) };
  const session = {
    stems: [
      {
        id: 'input-drum-machine',
        source: 'spectra-live-capture',
        renderedAudio: true,
        performance: {
          events: [{ time: 0, drum: '909-kick' }],
        },
      },
    ],
    recordingBlobs: new Map([['input-drum-machine', fakeBlob]]),
    recordings: new Map([['input-drum-machine', { duration: 2 }]]),
  };

  const result = await store.saveSession('project-freeze', session);
  assert.equal(result.saved, 1);
  const items = await store.list('project-freeze');
  assert.equal(items.length, 1);
  assert.equal(items[0].stemId, 'input-drum-machine');
  assert.equal(session.stems[0].performance.events[0].drum, '909-kick');
});

test('Spectra project audio store keeps microphone blobs in its no-IndexedDB fallback', async () => {
  const store = new SpectraProjectStore(null);
  const fakeBlob = { arrayBuffer: async () => new ArrayBuffer(8) };
  const session = {
    stems: [{ id: 'vocal-1', source: 'browser-microphone' }],
    recordingBlobs: new Map([['vocal-1', fakeBlob]]),
    recordings: new Map([['vocal-1', {}]]),
  };

  const result = await store.saveSession('project-a', session);
  assert.equal(result.saved, 1);
  assert.equal((await store.list('project-a')).length, 1);

  session.recordingBlobs.clear();
  const second = await store.saveSession('project-a', session);
  assert.equal(second.missing, 0);
  assert.equal((await store.list('project-a')).length, 1);

  session.stems = [];
  await store.saveSession('project-a', session);
  assert.equal((await store.list('project-a')).length, 0);
});
