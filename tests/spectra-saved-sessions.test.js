import test from 'node:test';
import assert from 'node:assert/strict';
import { StudioSession } from '../src/studio/StudioSession.js';
import { SpectraProjectStore } from '../src/studio/SpectraProjectStore.js';
import { validateSave } from '../src/state/GameState.js';

test('new Spectra projects start as genuinely blank editable sessions', () => {
  const session = new StudioSession();
  session.newProject('New Song', 124);

  assert.equal(session.project, true);
  assert.equal(session.name, 'New Song');
  assert.equal(session.bpm, 124);
  assert.equal(session.stems.length, 0);
  assert.equal(session.loopEnabled, true);
  assert.equal(session.loopBars, 4);

  const reopened = new StudioSession(session.snapshot());
  assert.equal(reopened.project, true);
  assert.equal(reopened.stems.length, 0);
  assert.equal(reopened.name, 'New Song');
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
  assert.equal(saved.studioProjects[0].session.stems.length, 0);
  assert.equal(saved.studioProjects[0].drumMachine.kit, '909');
  assert.equal(saved.studioProjects[0].modularSynth.wave, 'square');
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
