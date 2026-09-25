import test from 'node:test';
import assert from 'node:assert/strict';
import { createActions } from '../src/interactions/createActions.js';
import { StudioSession } from '../src/studio/StudioSession.js';
import { spectraInputKey, spectraInputStem } from '../src/studio/SpectraInputs.js';
import { SPECTRA_ADD_TRACK_CHOICES } from '../src/ui/Hud.js';

test('Vocal is a first-class Spectra input routed to the default Vocal channel', () => {
  const session = new StudioSession();
  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');

  assert.ok(vocal);
  assert.equal(vocal.id, 'input-vocal');
  assert.equal(vocal.kind, 'vocal');
  assert.equal(spectraInputKey({ mode: 'vocal', stemKind: 'vocal', label: 'Vocal' }), 'vocal');
  assert.equal(
    spectraInputStem(session, { mode: 'vocal', stemKind: 'vocal', inputKey: 'vocal' })?.id,
    'input-vocal',
  );
});

test('Vocal appears in the Spectra + ADD TRACK source menu', () => {
  assert.deepEqual(
    SPECTRA_ADD_TRACK_CHOICES.find(([, inputKey]) => inputKey === 'vocal'),
    ['VOCAL / PHONE MIC', 'vocal'],
  );
});

test('Vocal capture commits to the raw scrubber before Spectra can resume playback', async () => {
  const studio = new StudioSession();
  const vocalStem = studio.stems.find((stem) => stem.inputKey === 'vocal');
  const rawBlob = new Blob(['captured-vocal'], { type: 'audio/webm' });
  const calls = [];
  const ui = {
    lastPanel: null,
    warning() {},
    panel(title, text, actions) {
      this.lastPanel = { title, text, actions };
    },
  };
  const sceneManager = {
    current: {
      definition: { id: 'upstairs' },
    },
  };
  const studioPlayback = {
    playing: true,
    stop() {
      calls.push('stop-playback');
      this.playing = false;
    },
    stopRawAudition() {
      calls.push('stop-raw-audition');
    },
    stopRecordedStemPlayback() {
      calls.push('stop-recorded-stem');
    },
    updateMix() {
      calls.push('update-mix');
    },
    async play() {
      calls.push('play');
      this.playing = true;
      return true;
    },
  };
  const micRecorder = {
    supported: true,
    async start() {
      calls.push('recorder-start');
      return true;
    },
    async stop() {
      calls.push('recorder-stop');
      return {
        blob: rawBlob,
        buffer: null,
        duration: 2.5,
      };
    },
    cancel() {},
  };
  const audio = {
    async recoverAfterMicrophoneCapture() {
      calls.push('recover-audio');
      return true;
    },
  };
  const state = { data: {} };

  createActions({
    audio,
    spatialAudio: null,
    sceneManager,
    player: null,
    ui,
    state,
    studio,
    studioPlayback,
    micRecorder,
    keyboardPerformance: null,
    photos: null,
    dj: null,
    saveState() {},
    canAct: () => true,
  });

  ui._spectraStudioNavigation.vocal();
  const recordAction = ui.lastPanel.actions.find(([label]) => label.startsWith('Record to'));
  assert.ok(recordAction);
  await recordAction[1]();

  assert.equal(ui.lastPanel.title, 'SPECTRA VOCAL MIC · RECORDING');
  assert.ok(calls.indexOf('stop-playback') < calls.indexOf('recorder-start'));

  const commitAction = ui.lastPanel.actions.find(([label]) => label.startsWith('Stop + commit'));
  assert.ok(commitAction);
  await commitAction[1]();

  assert.equal(studio.recordingBlobs.get(vocalStem.id), rawBlob);
  assert.equal(vocalStem.sourceDuration, 2.5);
  assert.equal(vocalStem.sourceOffset, 0);
  assert.equal(vocalStem.source, 'browser-microphone');
  assert.equal(
    calls.includes('play'),
    false,
    'committing a Vocal take must not auto-restart Spectra and steal the raw scrubber Blob',
  );
});

test('Vocal take audition overlays the running Spectra loop', async () => {
  const studio = new StudioSession();
  const vocal = studio.stems.find((stem) => stem.inputKey === 'vocal');
  const blob = new Blob(['raw-vocal'], { type: 'audio/webm' });
  studio.replaceRecording(vocal.id, null, blob);
  vocal.source = 'browser-microphone';
  vocal.sourceDuration = 3;
  vocal.sourceOffset = 0.75;

  const created = [];
  const makeElement = (tag) => {
    const element = {
      tag,
      children: [],
      textContent: '',
      value: '',
      style: {},
      append(...items) {
        this.children.push(...items);
      },
      appendChild(item) {
        this.children.push(item);
      },
      setAttribute() {},
    };
    created.push(element);
    return element;
  };

  const ui = {
    document: { createElement: makeElement },
    buttons: {
      prepend() {},
      appendChild() {},
    },
    panel() {},
    warning() {},
  };
  const calls = [];
  const studioPlayback = {
    playing: true,
    stop() {
      calls.push(['stop']);
      this.playing = false;
    },
    async auditionRawRecording(_session, stemId, offset) {
      calls.push(['audition', stemId, offset]);
      return true;
    },
    rebuildRecordedStemPlayback(_session, stemId) {
      calls.push(['rebuild', stemId]);
      return true;
    },
    stopRawAudition() {
      calls.push(['stop-raw-audition']);
    },
    rawAuditionPosition() {
      return 1.25;
    },
    updateMix() {},
  };

  createActions({
    audio: {},
    spatialAudio: null,
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    player: null,
    ui,
    state: { data: {} },
    studio,
    studioPlayback,
    micRecorder: { supported: true },
    keyboardPerformance: null,
    photos: null,
    dj: null,
    saveState() {},
    canAct: () => true,
  });

  ui._spectraStudioNavigation.vocal();

  const fromStart = created.find(
    (element) => element.textContent === '▶ AUDITION TAKE FROM START',
  );
  const selected = created.find(
    (element) => element.textContent === '▶ AUDITION TAKE FROM SELECTED POINT',
  );
  assert.ok(fromStart);
  assert.ok(selected);

  await fromStart.onclick();
  await selected.onclick();

  assert.equal(
    calls.some(([name]) => name === 'stop'),
    false,
    'Vocal take audition must not stop the running Spectra loop',
  );
  assert.deepEqual(calls[0], ['audition', vocal.id, 0]);
  assert.deepEqual(calls[1], ['audition', vocal.id, 0.75]);
  assert.equal(studioPlayback.playing, true);

  const slider = created.find((element) => element.tag === 'input' && element.type === 'range');
  assert.ok(slider);
  slider.value = '1.1';
  await slider.onchange();

  assert.deepEqual(
    calls.find(([name]) => name === 'rebuild'),
    ['rebuild', vocal.id],
    'moving the scrubber must rebuild only the Vocal source',
  );
  assert.equal(
    calls.some(([name]) => name === 'play'),
    false,
    'moving the scrubber must never restart the whole Spectra transport',
  );
  assert.equal(studioPlayback.playing, true);

  const setCurrent = created.find(
    (element) => element.textContent === 'SET LOOP START TO CURRENT AUDITION',
  );
  assert.ok(setCurrent);
  await setCurrent.onclick();

  assert.equal(
    calls.filter(([name]) => name === 'rebuild').length,
    2,
    'setting the audition point while Spectra is running must also rebuild only Vocal',
  );
  assert.equal(studioPlayback.playing, true);
});
