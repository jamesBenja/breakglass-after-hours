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

test('Vocal capture resumes the full Spectra mix after committing a take', async () => {
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
    position() {
      calls.push('position');
      return 1.75;
    },
    async play(_session, offset, options) {
      calls.push(['play', offset, options]);
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
  const resumed = calls.find((call) => Array.isArray(call) && call[0] === 'play');
  assert.deepEqual(resumed, ['play', 1.75, { restartTransport: false }]);
  assert.ok(
    calls.indexOf('recorder-stop') < calls.findIndex((call) => Array.isArray(call) && call[0] === 'play'),
    'the mix resumes only after microphone capture has stopped and committed',
  );
  assert.equal(studioPlayback.playing, true);
});

test('every recorded Vocal track keeps an independently accessible scrubber', () => {
  const studio = new StudioSession();
  const first = studio.stems.find((stem) => stem.inputKey === 'vocal');
  first.source = 'browser-microphone';
  first.sourceDuration = 3;
  first.sourceOffset = 0.4;
  studio.recordings.set(first.id, {
    duration: 3,
    length: 30,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(30),
  });

  const second = studio.addInputTrack('vocal');
  second.source = 'browser-microphone';
  second.sourceDuration = 4;
  second.sourceOffset = 1.2;
  studio.recordings.set(second.id, {
    duration: 4,
    length: 40,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(40),
  });

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
      setAttribute(name, value) {
        this[name] = value;
      },
    };
    created.push(element);
    return element;
  };
  const ui = {
    lastPanel: null,
    document: { createElement: makeElement },
    buttons: {
      prepend() {},
      appendChild() {},
    },
    panel(title, text, actions) {
      this.lastPanel = { title, text, actions };
    },
    warning() {},
  };
  const studioPlayback = {
    playing: false,
    updateMix() {},
    stop() {},
    stopRawAudition() {},
    auditionRawRecording: async () => true,
    rawAuditionPosition: () => 0,
    rebuildRecordedStemPlayback: () => true,
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
  let selector = ui.lastPanel.actions.find(([label]) => label === 'Edit / scrub Vocal track…');
  assert.ok(selector);
  selector[1]();
  assert.equal(ui.lastPanel.title, 'SPECTRA VOCAL · TRACKS');

  const chooseSecond = ui.lastPanel.actions.find(([label]) => label.includes(second.label));
  assert.ok(chooseSecond);
  chooseSecond[1]();

  let editorTitle = [...created]
    .reverse()
    .find((element) => element.tag === 'strong' && element.textContent.includes('TAKE → SPECTRA LOOP'));
  let slider = [...created].reverse().find((element) => element.tag === 'input' && element.type === 'range');
  assert.equal(editorTitle.textContent, 'VOCAL 2 TAKE → SPECTRA LOOP');
  assert.equal(slider.value, '1.2');
  assert.equal(slider['aria-label'], 'Vocal 2 loop start');

  selector = ui.lastPanel.actions.find(([label]) => label === 'Edit / scrub Vocal track…');
  selector[1]();
  const chooseFirst = ui.lastPanel.actions.find(([label]) => label.startsWith('Vocal · recorded'));
  assert.ok(chooseFirst);
  chooseFirst[1]();

  editorTitle = [...created]
    .reverse()
    .find((element) => element.tag === 'strong' && element.textContent.includes('TAKE → SPECTRA LOOP'));
  slider = [...created].reverse().find((element) => element.tag === 'input' && element.type === 'range');
  assert.equal(editorTitle.textContent, 'VOCAL TAKE → SPECTRA LOOP');
  assert.equal(slider.value, '0.4');
  assert.equal(slider['aria-label'], 'Vocal loop start');
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
