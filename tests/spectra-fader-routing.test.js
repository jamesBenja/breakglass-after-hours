// These regressions keep Spectra mixing local to its own channel strips and room surfaces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';
import { stopSpectraLiveInputsForMix } from '../src/gameplay/StudioLoopEnhancements.js';
import { StudioPlayback } from '../src/studio/StudioPlayback.js';
import { StudioSession } from '../src/studio/StudioSession.js';
import { createGameSpace } from '../src/world/upstairs/gameSpace.js';

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.lastWrite = null;
    this.cancelled = 0;
  }
  setTargetAtTime(value) {
    this.value = value;
    this.lastWrite = 'target';
  }
  setValueAtTime(value) {
    this.value = value;
    this.lastWrite = 'value';
  }
  exponentialRampToValueAtTime(value) {
    this.value = value;
  }
  cancelScheduledValues() {
    this.cancelled += 1;
  }
}

class FakeNode {
  constructor() {
    this.gain = new FakeParam(1);
    this.frequency = new FakeParam(0);
    this.Q = new FakeParam(0);
    this.threshold = new FakeParam(0);
    this.ratio = new FakeParam(1);
    this.attack = new FakeParam(0);
    this.release = new FakeParam(0);
    this.delayTime = new FakeParam(0);
    this.pan = new FakeParam(0);
  }
  connect() {
    return this;
  }
  disconnect() {}
}

class FakeAnalyser extends FakeNode {
  constructor() {
    super();
    this.fftSize = 128;
    this.smoothingTimeConstant = 0;
  }
  getFloatTimeDomainData(data) {
    data.fill(0.2);
  }
}

function fakeAudio(createdSources = [], { mediaSources = null } = {}) {
  const context = {
    state: 'running',
    currentTime: 0,
    sampleRate: 10,
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createDynamicsCompressor: () => new FakeNode(),
    createDelay: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
    createAnalyser: () => new FakeAnalyser(),
    createBuffer: (channels, length, sampleRate) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        duration: length / sampleRate,
        numberOfChannels: channels,
        sampleRate,
        getChannelData: (channel) => data[channel],
      };
    },
    createBufferSource: () => {
      const source = new FakeNode();
      source.buffer = null;
      source.startArgs = null;
      source.stopped = false;
      source.start = (...args) => {
        source.startArgs = args;
      };
      source.stopArgs = null;
      source.scheduledStopAt = null;
      source.stop = (...args) => {
        source.stopArgs = args;
        if (!args.length || Number(args[0]) <= context.currentTime) source.stopped = true;
        else source.scheduledStopAt = Number(args[0]);
      };
      createdSources.push(source);
      return source;
    },
    ...(mediaSources
      ? {
          createMediaElementSource: (media) => {
            const source = new FakeNode();
            source.media = media;
            mediaSources.push(source);
            return source;
          },
        }
      : {}),
  };
  const destination = new FakeNode();
  return {
    context,
    master: destination,
    sourceDestination: () => destination,
    sourceGain: () => 1,
  };
}

function manualTimers() {
  let nextId = 1;
  const pending = [];
  return {
    pending,
    setTimeout(callback, delay = 0) {
      const item = { id: nextId++, callback, delay, cancelled: false };
      pending.push(item);
      return item.id;
    },
    clearTimeout(id) {
      const item = pending.find((entry) => entry.id === id);
      if (item) item.cancelled = true;
    },
    setInterval() {
      return null;
    },
    clearInterval() {},
    runNext() {
      const item = pending.shift();
      if (!item || item.cancelled) return false;
      item.callback();
      return true;
    },
  };
}

function stem(id, level = 0.7) {
  return {
    id,
    label: id,
    kind: 'synth',
    level,
    pan: 0,
    low: 0,
    high: 0,
    fx: 0,
    mute: false,
    solo: false,
    clipActive: true,
    performance: {
      mode: 'synth',
      bpm: 120,
      duration: 2,
      noteDuration: 0.2,
      wave: 'triangle',
      volume: 0.06,
      events: [{ time: 0, midi: 60, frequency: 261.63 }],
    },
  };
}

test('recorded Spectra stems use the same mute path for MUTE and SOLO', () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession({
    project: true,
    stems: [stem('recorded-one', 0.82), stem('recorded-two', 0.64)],
  });
  const first = session.stems.find((item) => item.id === 'recorded-one');
  const second = session.stems.find((item) => item.id === 'recorded-two');

  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0.82);
  assert.equal(playback.buses.get(second.id).fader.gain.value, 0.64);

  first.level = 0.21;
  session.toggleMute(first.id);
  playback.updateMix(session);
  assert.equal(playback.buses.get(first.id).fader.gain.value, 0.21);
  assert.equal(playback.buses.get(first.id).hardMute.gain.value, 0);
  assert.equal(playback.buses.get(second.id).hardMute.gain.value, 1);

  session.toggleMute(first.id);
  session.toggleSolo(second.id);
  playback.updateMix(session);
  assert.equal(first.mute, true, 'non-solo track is literally muted');
  assert.equal(second.mute, false, 'soloed track is literally unmuted');
  assert.equal(playback.buses.get(first.id).hardMute.gain.value, 0);
  assert.equal(playback.buses.get(second.id).hardMute.gain.value, 1);
  assert.equal(playback.buses.get(second.id).fader.gain.value, 0.64);

  session.toggleSolo(second.id);
  playback.updateMix(session);
  assert.equal(first.mute, false, 'manual mute state is restored after solo clears');
  assert.equal(second.mute, false);
  assert.equal(playback.buses.get(first.id).hardMute.gain.value, 1);
  assert.equal(playback.buses.get(second.id).hardMute.gain.value, 1);
});

test('muted recorded performance keeps its timeline running for live unmute', () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession({
    project: true,
    stems: [stem('recorded-performance', 0.75)],
  });
  const recorded = session.stems[0];
  recorded.mute = true;

  let renderCalls = 0;
  playback.renderPerformance = () => {
    renderCalls += 1;
    return true;
  };
  playback.session = session;
  playback.updateMix(session);

  playback.renderStem(recorded, 0, 0);
  assert.equal(
    renderCalls,
    1,
    'muted recorded/event tracks must keep advancing underneath the mixer',
  );
  assert.equal(playback.buses.get(recorded.id).hardMute.gain.value, 0);

  recorded.mute = false;
  playback.applyChannelAudibility(session);
  assert.equal(
    playback.buses.get(recorded.id).hardMute.gain.value,
    1,
    'live unmute should open the existing channel gate without restarting PLAY',
  );

  const legacyGenerated = {
    ...stem('legacy-generated', 0.7),
    performance: null,
    inputKey: null,
    kind: 'bass',
    mute: true,
  };
  playback.session = { stems: [legacyGenerated], recordings: new Map() };
  let generatedNotes = 0;
  playback.oscillator = () => {
    generatedNotes += 1;
  };
  playback.renderStem(legacyGenerated, 0, 0);
  assert.equal(
    generatedNotes,
    0,
    'legacy generated backing voices stay mute-aware to avoid the prior transient regression',
  );
});

test('Vocal scrubber auditions canonical PCM before the MediaRecorder fallback', async () => {
  const OriginalAudio = globalThis.Audio;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createdMedia = [];
  const createdSources = [];

  class FakeMedia {
    constructor() {
      this.src = '';
      this.volume = 1;
      this.loop = false;
      this.playsInline = false;
      this.readyState = 1;
      this.duration = 5;
      this.currentTime = 0;
      createdMedia.push(this);
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    }
    load() {}
    addEventListener() {}
  }

  globalThis.Audio = FakeMedia;
  URL.createObjectURL = () => 'blob:raw-vocal';
  URL.revokeObjectURL = () => {};

  try {
    const playback = new StudioPlayback(fakeAudio(createdSources));
    const session = new StudioSession();
    const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
    vocal.source = 'browser-microphone';
    vocal.sourceOffset = 1.25;
    vocal.sourceDuration = 5;

    const samples = Float32Array.from({ length: 50 }, (_, index) => index / 100);
    const recording = {
      duration: 5,
      length: 50,
      numberOfChannels: 1,
      sampleRate: 10,
      getChannelData: () => samples,
    };
    const rawBlob = new Blob(['raw-vocal'], { type: 'audio/webm' });
    session.replaceRecording(vocal.id, recording, rawBlob);
    playback.session = session;

    assert.equal(
      await playback.startBlobRecordings(session, 0),
      0,
      'MediaRecorder Vocal Blob must never be used by the Spectra mixer',
    );
    assert.equal(playback.blobStems.has(vocal.id), false);
    assert.equal(createdMedia.length, 0);

    assert.equal(await playback.auditionRawRecording(session, vocal.id, vocal.sourceOffset), true);
    assert.equal(
      createdMedia.length,
      0,
      'PCM audition must not instantiate the MediaRecorder file',
    );
    assert.equal(createdSources.length, 1);
    assert.equal(createdSources[0].buffer, recording);
    assert.deepEqual(createdSources[0].startArgs, [0.01, 1.25]);
    assert.equal(
      session.recordingBlobs.get(vocal.id),
      rawBlob,
      'raw file remains available as fallback',
    );

    playback.stopRawAudition();
  } finally {
    globalThis.Audio = OriginalAudio;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('Vocal scrubber falls back to the raw MediaRecorder file only when PCM is unavailable', async () => {
  const OriginalAudio = globalThis.Audio;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const createdMedia = [];

  class FakeMedia {
    constructor() {
      this.src = '';
      this.volume = 1;
      this.muted = false;
      this.defaultMuted = false;
      this.loop = false;
      this.playsInline = false;
      this.readyState = 1;
      this.duration = 5;
      this.currentTime = 0;
      createdMedia.push(this);
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
    removeAttribute(name) {
      if (name === 'src') this.src = '';
    }
    load() {}
    addEventListener() {}
  }

  globalThis.Audio = FakeMedia;
  URL.createObjectURL = () => 'blob:raw-vocal';
  URL.revokeObjectURL = () => {};

  try {
    const playback = new StudioPlayback(fakeAudio());
    const session = new StudioSession();
    const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
    vocal.source = 'browser-microphone';
    vocal.sourceOffset = 1.25;
    vocal.sourceDuration = 5;
    session.replaceRecording(vocal.id, null, new Blob(['raw-vocal'], { type: 'audio/webm' }));

    assert.equal(await playback.auditionRawRecording(session, vocal.id, vocal.sourceOffset), true);
    assert.equal(createdMedia.length, 1);
    assert.equal(createdMedia[0].src, 'blob:raw-vocal');
    assert.equal(createdMedia[0].currentTime, 1.25);
    assert.equal(createdMedia[0].volume, 1);
    assert.equal(createdMedia[0].muted, false);

    playback.stopRawAudition();
  } finally {
    globalThis.Audio = OriginalAudio;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('Spectra PLAY restores an interrupted output route before starting sources', async () => {
  const audio = fakeAudio();
  audio.context.state = 'interrupted';
  let recoverCalls = 0;
  audio.recoverAfterMicrophoneCapture = async () => {
    recoverCalls += 1;
    audio.context.state = 'running';
    return true;
  };

  const playback = new StudioPlayback(audio);
  const session = new StudioSession();
  playback.startBlobRecordings = () => Promise.resolve(0);
  playback.loadAlignedAssets = async () => null;
  playback.startNativeAssets = async () => false;
  playback.startFrozenRecordings = () => 0;
  playback.hasEventPlayback = () => false;

  assert.equal(await playback.play(session, 0, { restartTransport: true }), true);
  assert.equal(recoverCalls, 1);
  assert.equal(audio.context.state, 'running');
  playback.stop();
});

test('a stale asynchronous Spectra PLAY cannot overwrite a newer playback request', async () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession();
  let releaseFirstLoad = null;
  let loadCalls = 0;
  let frozenStarts = 0;

  playback.startBlobRecordings = () => Promise.resolve(0);
  playback.loadAlignedAssets = async () => {
    loadCalls += 1;
    if (loadCalls === 1) {
      await new Promise((resolve) => {
        releaseFirstLoad = resolve;
      });
    }
    return null;
  };
  playback.startNativeAssets = async () => false;
  playback.startFrozenRecordings = () => {
    frozenStarts += 1;
    return 0;
  };
  playback.hasEventPlayback = () => false;

  const firstPlay = playback.play(session, 0, { restartTransport: true });
  await Promise.resolve();
  const secondPlay = playback.play(session, 0, { restartTransport: true });
  await Promise.resolve();
  releaseFirstLoad();

  assert.equal(await secondPlay, true);
  assert.equal(
    await firstPlay,
    false,
    'older PLAY must abort after a newer request takes ownership',
  );
  assert.equal(frozenStarts, 1, 'only the newest PLAY may create recorded sources');
  playback.stop();
});

test('Spectra creates microphone PCM playback before the first asset-loading await', async () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  audio.recoverAfterMicrophoneCapture = async () => true;
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 118;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';
  const recording = {
    duration: 2.9,
    length: 29,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => Float32Array.from({ length: 29 }, () => 0.2),
  };
  session.recordings.set(vocal.id, recording);

  let releaseAssetLoad = null;
  playback.loadAlignedAssets = async () =>
    new Promise((resolve) => {
      releaseAssetLoad = () => resolve(null);
    });
  playback.startNativeAssets = async () => false;

  playback.spectraTransport = {
    running: true,
    position: () => 0,
    positionAtOffset: (offset) => Math.max(0, Number(offset) || 0),
    subscribe: () => () => {},
    acquire: () => true,
    restart: () => true,
    release: () => true,
  };

  const playPromise = playback.play(session, 0, { restartTransport: true });

  // Let PLAY cross only its route-recovery await. It must create Vocal before entering the
  // deliberately blocked asset loader.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(typeof releaseAssetLoad, 'function');
  assert.equal(
    createdSources.length,
    1,
    'microphone PCM must already have a live BufferSource while asset loading is still pending',
  );
  const earlyVocal = createdSources[0];
  assert.equal(earlyVocal.buffer, recording);
  assert.equal(earlyVocal.stopped, false);
  assert.deepEqual(earlyVocal.startArgs, [0.06, 0]);
  assert.equal(playback.frozenSources.get(vocal.id), earlyVocal);
  assert.equal(playback.vocalPlaybackDiagnostics.get(vocal.id)?.stage, 'pre-asset-await');

  releaseAssetLoad();
  assert.equal(await playPromise, true);

  assert.equal(
    createdSources.length,
    1,
    'the post-await frozen-recording pass must not replace the gesture-bound Vocal source',
  );
  assert.equal(playback.frozenSources.get(vocal.id), earlyVocal);
  assert.equal(earlyVocal.stopped, false);
  assert.deepEqual(playback.lastRecordedStartCounts, {
    microphoneBeforeAwait: 1,
    nonMicrophoneAfterAwait: 0,
  });

  playback.stop();
});

test('Spectra starts browser-recorded media before any asynchronous asset loading', async () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession();
  const calls = [];

  playback.startBlobRecordings = () => {
    calls.push('blob-play');
    return Promise.resolve(1);
  };
  playback.loadAlignedAssets = async () => {
    calls.push('asset-load');
    return null;
  };
  playback.startNativeAssets = async () => {
    calls.push('native-assets');
    return false;
  };
  playback.startFrozenRecordings = () => 0;
  playback.hasEventPlayback = () => false;

  await playback.play(session, 0, { restartTransport: true });

  assert.equal(calls[0], 'blob-play');
  assert.equal(
    calls[1],
    'asset-load',
    'native microphone play must be invoked before the first asset-loading await',
  );
  playback.stop();
});

test('recorded microphone audio uses the original PCM buffer in one-shot Spectra cycles', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';
  vocal.sourceOffset = 1.2;
  vocal.sourceDuration = 5;

  const samples = Float32Array.from({ length: 50 }, (_, index) => index / 100);
  const recording = {
    duration: 5,
    length: 50,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => samples,
  };
  session.replaceRecording(
    vocal.id,
    recording,
    new Blob(['same-complete-vocal-take'], { type: 'audio/webm' }),
  );
  playback.session = session;
  playback.updateMix(session);

  assert.equal(playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 }), 1);

  const source = createdSources[0];
  assert.equal(source.loop, false);
  assert.equal(
    source.buffer,
    recording,
    'Spectra must play the exact captured PCM AudioBuffer that the scrubber uses',
  );
  assert.deepEqual(
    source.startArgs,
    [0, 1.2],
    'Spectra must use the same start(time, sourceOffset) primitive as the scrubber',
  );
  assert.equal(source.scheduledStopAt, null, 'a take shorter than the loop ends naturally');

  assert.equal(playback.frozenSources.get(vocal.id), source);
  assert.equal(playback.vocalBufferLoopTimers.has(vocal.id), true);
  assert.equal(playback.vocalPlaybackDiagnostics.get(vocal.id).mode, 'original-pcm-cycle');
  assert.equal(playback.vocalPlaybackDiagnostics.get(vocal.id).sourceOffset, 1.2);
  assert.equal(playback.vocalDirectRoutes.has(vocal.id), true);
  assert.equal(playback.vocalDirectRoutes.get(vocal.id).destination, audio.master);
  assert.equal(playback.vocalDirectRoutes.get(vocal.id).gain.gain.value, vocal.level);
  assert.equal(playback.vocalDirectRoutes.get(vocal.id).pan, null);
  assert.equal(playback.blobStems.has(vocal.id), false);

  vocal.mute = true;
  playback.applyChannelAudibility(session);
  assert.equal(playback.vocalDirectRoutes.get(vocal.id).gain.gain.value, 0);
  vocal.mute = false;
  vocal.level = 0.31;
  playback.updateStemMix(session, vocal.id, { immediate: true });
  assert.equal(playback.vocalDirectRoutes.get(vocal.id).gain.gain.value, 0.31);

  playback.stop();
  assert.equal(source.stopped, true);
  assert.equal(playback.vocalBufferLoopTimers.has(vocal.id), false);
});

test('Vocal joins a running Spectra cycle by advancing the original PCM source offset', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';
  vocal.sourceOffset = 0;

  const samples = Float32Array.from({ length: 20 }, (_, index) => (index + 1) / 100);
  const recording = {
    duration: 2,
    length: 20,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => samples,
  };
  session.recordings.set(vocal.id, recording);

  playback.session = session;
  playback.updateMix(session);
  assert.equal(playback.startFrozenRecordings(session, 1.5, { startTime: 0, phaseOffset: 1.5 }), 1);

  const source = createdSources[0];
  assert.equal(source.buffer, recording);
  assert.equal(source.loop, false);
  assert.deepEqual(source.startArgs, [0, 1.5]);
  assert.equal(playback.vocalPlaybackDiagnostics.get(vocal.id).phase, 1.5);
});

test('one-shot Vocal scheduler starts the original PCM again at the next Spectra boundary', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';
  const recording = {
    duration: 3,
    length: 30,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => Float32Array.from({ length: 30 }, () => 0.2),
  };
  session.recordings.set(vocal.id, recording);

  playback.session = session;
  playback.updateMix(session);
  assert.equal(playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 }), 1);

  const first = createdSources[0];
  assert.equal(first.buffer, recording);
  assert.deepEqual(first.startArgs, [0, 0]);
  assert.equal(timers.pending.length, 1);

  audio.context.currentTime = 3.82;
  assert.equal(timers.runNext(), true);

  const second = createdSources[1];
  assert.ok(second);
  assert.notEqual(second, first);
  assert.equal(second.buffer, recording);
  assert.equal(second.loop, false);
  assert.deepEqual(second.startArgs, [4, 0]);
  assert.equal(timers.pending.length, 1);
});

test('a Vocal take longer than the Spectra cycle is stopped exactly at the bar boundary', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';
  const recording = {
    duration: 6,
    length: 60,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(60),
  };
  session.recordings.set(vocal.id, recording);

  playback.session = session;
  playback.updateMix(session);
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });

  const source = createdSources[0];
  assert.deepEqual(source.startArgs, [0, 0]);
  assert.equal(source.stopped, false);
  assert.equal(source.scheduledStopAt, 4);
});

test('changing Vocal source offset replaces only its original-PCM cycle scheduler', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';
  vocal.sourceOffset = 1.2;

  const samples = Float32Array.from({ length: 50 }, (_, index) => index / 100);
  const recording = {
    duration: 5,
    length: 50,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => samples,
  };
  session.recordings.set(vocal.id, recording);
  playback.session = session;
  playback.updateMix(session);

  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });
  const firstSource = createdSources[0];
  assert.deepEqual(firstSource.startArgs, [0, 1.2]);

  vocal.sourceOffset = 0.5;
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });

  const secondSource = createdSources[1];
  assert.equal(firstSource.stopped, true);
  assert.equal(secondSource.buffer, recording);
  assert.deepEqual(secondSource.startArgs, [0, 0.5]);
  assert.equal(secondSource.loop, false);
  assert.equal(playback.frozenSources.get(vocal.id), secondSource);

  playback.stopRecordedStemPlayback(vocal.id);
  assert.equal(secondSource.stopped, true);
  assert.equal(playback.frozenSources.has(vocal.id), false);
  assert.equal(playback.vocalDirectRoutes.has(vocal.id), false);
});

test('live Vocal scrub rebuild preserves every other frozen source', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  const other = session.stems.find((stem) => stem.id !== vocal.id);
  vocal.source = 'browser-microphone';
  vocal.sourceOffset = 0;

  const vocalSamples = Float32Array.from({ length: 50 }, (_, index) => index / 100);
  const vocalRecording = {
    duration: 5,
    length: 50,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => vocalSamples,
  };
  session.recordings.set(vocal.id, vocalRecording);
  session.recordings.set(other.id, {
    duration: 4,
    length: 40,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(40),
  });

  playback.session = session;
  playback.updateMix(session);
  playback.spectraTransport = {
    running: true,
    positionAtOffset(offset) {
      return 1.5 + offset;
    },
  };

  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });
  const firstVocal = playback.frozenSources.get(vocal.id);
  const untouchedOther = playback.frozenSources.get(other.id);

  audio.context.currentTime = 5;
  vocal.sourceOffset = 0.7;
  assert.equal(playback.rebuildRecordedStemPlayback(session, vocal.id), true);

  const rebuiltVocal = playback.frozenSources.get(vocal.id);
  assert.notEqual(rebuiltVocal, firstVocal);
  assert.equal(firstVocal.stopped, true);
  assert.equal(playback.frozenSources.get(other.id), untouchedOther);
  assert.equal(untouchedOther.stopped, false);
  assert.equal(rebuiltVocal.buffer, vocalRecording);
  assert.equal(rebuiltVocal.loop, false);
  assert.ok(Math.abs(rebuiltVocal.startArgs[0] - 5.018) < 0.001);
  assert.ok(Math.abs(rebuiltVocal.startArgs[1] - 2.218) < 0.001);
  assert.ok(Math.abs(rebuiltVocal.scheduledStopAt - 7.5) < 0.001);
});

test('iOS microphone route resync rebuilds original-PCM Vocal scheduler only', async () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  const other = session.stems.find((stem) => stem.id !== vocal.id);
  vocal.source = 'browser-microphone';
  const vocalRecording = {
    duration: 3,
    length: 30,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => Float32Array.from({ length: 30 }, () => 0.2),
  };
  session.recordings.set(vocal.id, vocalRecording);
  session.recordings.set(other.id, {
    duration: 4,
    length: 40,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => Float32Array.from({ length: 40 }, () => 0.15),
  });

  playback.session = session;
  playback.updateMix(session);
  playback.spectraTransport = {
    running: true,
    positionAtOffset(offset) {
      return 1.25 + offset;
    },
    position() {
      return 1.25;
    },
  };
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });

  const originalVocal = playback.frozenSources.get(vocal.id);
  const originalVocalRoute = playback.vocalDirectRoutes.get(vocal.id);
  const untouchedOther = playback.frozenSources.get(other.id);

  audio.context.state = 'suspended';
  audio.resume = async () => {
    audio.context.state = 'running';
    return true;
  };

  assert.equal(await playback.resyncRecordedVocalPlayback(session, { settleMs: 0 }), 1);

  const rebuiltVocal = playback.frozenSources.get(vocal.id);
  const rebuiltVocalRoute = playback.vocalDirectRoutes.get(vocal.id);
  assert.notEqual(rebuiltVocal, originalVocal);
  assert.notEqual(rebuiltVocalRoute, originalVocalRoute);
  assert.equal(rebuiltVocal.buffer, vocalRecording);
  assert.equal(rebuiltVocalRoute.destination, audio.master);
  assert.equal(originalVocal.stopped, true);
  assert.equal(rebuiltVocal.stopped, false);
  assert.equal(playback.frozenSources.get(other.id), untouchedOther);
  assert.equal(untouchedOther.stopped, false);
  assert.equal(audio.context.state, 'running');
});

test('adding another Vocal channel leaves the existing original-PCM scheduler untouched', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;
  session.loopEnabled = true;

  const first = session.stems.find((stem) => stem.inputKey === 'vocal');
  first.source = 'browser-microphone';
  const recording = {
    duration: 3,
    length: 30,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => Float32Array.from({ length: 30 }, () => 0.2),
  };
  session.recordings.set(first.id, recording);

  playback.session = session;
  playback.updateMix(session);
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });

  const originalSource = playback.frozenSources.get(first.id);
  const originalRoute = playback.vocalDirectRoutes.get(first.id);
  const originalTimer = playback.vocalBufferLoopTimers.get(first.id);

  const second = session.addInputTrack('vocal');
  assert.ok(second);
  playback.updateMix(session, { immediate: true });

  assert.equal(playback.frozenSources.get(first.id), originalSource);
  assert.equal(originalSource.stopped, false);
  assert.equal(originalSource.buffer, recording);
  assert.equal(playback.vocalDirectRoutes.get(first.id), originalRoute);
  assert.equal(playback.vocalBufferLoopTimers.get(first.id), originalTimer);
  assert.equal(originalRoute.gain.gain.value, first.level);
});

test('replacement Vocal recording cannot inherit the previous original-PCM scheduler', () => {
  const createdSources = [];
  const timers = manualTimers();
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio, timers);
  const session = new StudioSession();
  session.bpm = 60;
  session.loopBars = 1;

  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.source = 'browser-microphone';

  const firstRecording = {
    duration: 3,
    length: 30,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(30),
  };
  session.replaceRecording(vocal.id, firstRecording);
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });
  const firstSource = createdSources[0];

  playback.stopRecordedStemPlayback(vocal.id);
  const secondRecording = {
    duration: 6,
    length: 60,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(60),
  };
  vocal.sourceOffset = 2;
  session.replaceRecording(vocal.id, secondRecording);
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });

  const secondSource = createdSources[1];
  assert.equal(firstSource.stopped, true);
  assert.equal(secondSource.buffer, secondRecording);
  assert.deepEqual(secondSource.startArgs, [0, 2]);
  assert.equal(secondSource.loop, false);
  playback.stop();
});

test('raw vocal audition starts at the selected source point without looping', async () => {
  const createdSources = [];
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio);
  const session = new StudioSession();
  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  const recording = {
    duration: 5,
    length: 50,
    numberOfChannels: 1,
    sampleRate: 10,
    getChannelData: () => new Float32Array(50),
  };
  session.recordings.set(vocal.id, recording);

  assert.equal(await playback.auditionRawRecording(session, vocal.id, 1.5), true);
  const source = createdSources[0];
  assert.deepEqual(source.startArgs, [0.01, 1.5]);
  assert.equal(source.loop, undefined);
  assert.equal(playback.rawAuditionPosition(), 1.5);

  audio.context.currentTime = 0.51;
  assert.equal(playback.rawAuditionPosition(), 2);
  playback.stopRawAudition();
});

test('Vocal source selection survives a Spectra session snapshot', () => {
  const session = new StudioSession();
  const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
  vocal.sourceOffset = 1.37;
  vocal.sourceDuration = 8.25;

  const restored = new StudioSession(session.snapshot());
  const restoredVocal = restored.stems.find((stem) => stem.inputKey === 'vocal');
  assert.equal(restoredVocal.sourceOffset, 1.37);
  assert.equal(restoredVocal.sourceDuration, 8.25);
});

test('Spectra exposes independent reverb and delay sends with persistent FX detail settings', () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession();
  const synth = session.stems.find((stem) => stem.inputKey === 'synth');

  session.setReverb(synth.id, 0.4);
  session.setDelay(synth.id, 0.7);
  session.setFxParam(synth.id, 'reverbSize', 0.8);
  session.setFxParam(synth.id, 'reverbDamping', 0.5);
  session.setFxParam(synth.id, 'delayTime', 0.5);
  session.setFxParam(synth.id, 'delayFeedback', 0.45);

  playback.updateMix(session, { immediate: true });
  const bus = playback.buses.get(synth.id);
  assert.equal(bus.reverbSend.gain.value, 0.12);
  assert.equal(bus.delaySend.gain.value, 0.294);
  assert.equal(bus.delayNode.delayTime.value, 0.5);
  assert.equal(bus.delayFeedback.gain.value, 0.45);
  assert.equal(bus.reverbDampingA.frequency.value, 8250);

  const reopened = new StudioSession(session.snapshot());
  const restored = reopened.stems.find((stem) => stem.id === synth.id);
  assert.equal(restored.reverb, 0.4);
  assert.equal(restored.delay, 0.7);
  assert.equal(restored.fxSettings.reverbSize, 0.8);
  assert.equal(restored.fxSettings.delayTime, 0.5);
});

test('Spectra channel and stereo master meters report live post-fader signal', () => {
  const playback = new StudioPlayback(fakeAudio());
  const first = stem('meter-one', 0.8);
  first.pan = -1;
  const second = stem('meter-two', 0.8);
  second.pan = 1;
  const session = { stems: [first, second], recordings: new Map() };

  playback.updateMix(session);
  const snapshot = playback.meterSnapshot(session);

  assert.ok(snapshot.channels[first.id] > 0);
  assert.ok(snapshot.channels[second.id] > 0);
  assert.ok(snapshot.master.left > 0);
  assert.ok(snapshot.master.right > 0);
});

test('frozen Spectra audio uses one persistent looping source through the live channel strip', () => {
  const createdSources = [];
  const playback = new StudioPlayback(fakeAudio(createdSources));
  const frozen = {
    ...stem('input-drum-machine', 0.72),
    kind: 'drums',
    inputKey: 'drum-machine',
    renderedAudio: true,
    performance: {
      mode: 'drums',
      bpm: 120,
      duration: 2,
      events: [{ time: 0, drum: '909-kick' }],
    },
  };
  const audioBuffer = { duration: 2 };
  const session = {
    stems: [frozen],
    recordings: new Map([[frozen.id, audioBuffer]]),
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
  };
  playback.session = session;
  playback.updateMix(session);

  assert.equal(playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 }), 1);
  assert.equal(createdSources.length, 1);
  assert.equal(createdSources[0].buffer, audioBuffer);
  assert.equal(createdSources[0].loop, true);
  assert.equal(createdSources[0].loopStart, 0);
  assert.equal(createdSources[0].loopEnd, 2);
  assert.deepEqual(createdSources[0].startArgs, [0, 0]);

  let performanceCalls = 0;
  playback.renderPerformance = () => {
    performanceCalls += 1;
    return true;
  };
  playback.renderStem(frozen, 0, 0);
  playback.renderStem(frozen, 8, 0);
  assert.equal(createdSources.length, 1);
  assert.equal(performanceCalls, 0);

  frozen.mute = true;
  assert.equal(playback.applyChannelAudibility(session), true);
  assert.equal(playback.frozenGates.get(frozen.id).gain.value, 0);
  assert.equal(playback.buses.get(frozen.id).hardMute.gain.value, 1);
  frozen.mute = false;
  playback.applyChannelAudibility(session);
  assert.equal(playback.frozenGates.get(frozen.id).gain.value, 1);
  assert.equal(playback.buses.get(frozen.id).hardMute.gain.value, 1);
  assert.equal(createdSources.length, 1);
});

test('SOLO on frozen recordings literally drives the working frozen MUTE gates', () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession({
    project: true,
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
    stems: [stem('frozen-a', 0.81), stem('frozen-b', 0.57)],
  });
  const first = session.stems.find((item) => item.id === 'frozen-a');
  const second = session.stems.find((item) => item.id === 'frozen-b');
  session.recordings.set(first.id, { duration: 2 });
  session.recordings.set(second.id, { duration: 2 });

  playback.session = session;
  playback.updateMix(session);
  playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 });

  session.toggleSolo(second.id);
  playback.applyChannelAudibility(session);

  assert.equal(first.mute, true);
  assert.equal(second.mute, false);
  assert.equal(playback.frozenGates.get(first.id).gain.value, 0);
  assert.equal(playback.frozenGates.get(second.id).gain.value, 1);
  assert.equal(playback.buses.get(first.id).fader.gain.value, first.level);
  assert.equal(playback.buses.get(second.id).fader.gain.value, second.level);
});

test('solo restores previous manual mute states when the last solo is cleared', () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession({
    project: true,
    stems: [stem('a', 0.7), stem('b', 0.7)],
  });
  const a = session.stems.find((item) => item.id === 'a');
  const b = session.stems.find((item) => item.id === 'b');

  session.toggleMute(b.id);
  playback.updateMix(session);
  const aBus = playback.buses.get(a.id);
  const bBus = playback.buses.get(b.id);
  assert.equal(aBus.hardMute.gain.value, 1);
  assert.equal(bBus.hardMute.gain.value, 0);

  session.toggleSolo(b.id);
  playback.applyChannelAudibility(session);
  assert.equal(a.mute, true);
  assert.equal(b.mute, false, 'solo overrides a prior manual mute while solo is active');
  assert.equal(aBus.hardMute.gain.value, 0);
  assert.equal(bBus.hardMute.gain.value, 1);

  session.clearSolos();
  playback.applyChannelAudibility(session);
  assert.equal(a.mute, false);
  assert.equal(b.mute, true, 'the original manual mute comes back after solo clears');
  assert.equal(aBus.hardMute.gain.value, 1);
  assert.equal(bBus.hardMute.gain.value, 0);
});

test('fully frozen Spectra playback does not subscribe to sixteenth-note render callbacks', async () => {
  const createdSources = [];
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio);
  const frozen = {
    ...stem('input-drum-machine', 0.72),
    kind: 'drums',
    inputKey: 'drum-machine',
    renderedAudio: true,
  };
  const session = {
    stems: [frozen],
    recordings: new Map([[frozen.id, { duration: 2 }]]),
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
  };
  let subscriptions = 0;
  playback.spectraTransport = {
    running: true,
    position: () => 0,
    positionAtOffset: () => 0,
    subscribe() {
      subscriptions += 1;
      return () => {};
    },
    acquire: () => true,
    restart: () => true,
    release: () => true,
  };

  assert.equal(await playback.play(session, 0, { restartTransport: true }), true);
  assert.equal(subscriptions, 0);
  assert.equal(createdSources.length, 1);
  assert.equal(playback.frozenSources.size, 1);
  assert.equal(playback.playing, true);
});

test('monitored hits reuse the existing Spectra channel graph without a full mixer refresh', () => {
  const playback = new StudioPlayback(fakeAudio());
  const input = {
    ...stem('input-synth', 0.5),
    inputKey: 'synth',
    performance: null,
    monitor: true,
  };
  const session = { stems: [input], recordings: new Map() };
  playback.updateMix(session);

  let mixRefreshes = 0;
  playback.updateMix = () => {
    mixRefreshes += 1;
    return true;
  };
  playback.oscillator = () => {};

  assert.equal(
    playback.monitorLiveEvent(
      session,
      { mode: 'synth', stemKind: 'synth', wave: 'triangle', volume: 0.08, duration: 0.4 },
      { type: 'midi', midi: 60 },
      { resourceId: 'local:synth' },
    ),
    true,
  );
  assert.equal(mixRefreshes, 0);
});

test('recorded drum-machine clips restart at bar one and render through the same channel strip', async () => {
  const audio = fakeAudio();
  const playback = new StudioPlayback(audio);
  const drum = {
    ...stem('input-drum-machine', 0.72),
    kind: 'drums',
    inputKey: 'drum-machine',
    performance: {
      mode: 'drums',
      bpm: 120,
      duration: 2,
      noteDuration: 0.1,
      wave: 'triangle',
      volume: 0.09,
      events: [{ time: 0, drum: '909-kick' }],
    },
  };
  const session = {
    stems: [drum],
    recordings: new Map(),
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
  };

  let subscriber = null;
  const order = [];
  playback.spectraTransport = {
    running: true,
    position: () => 0,
    positionAtOffset: () => 0,
    subscribe(_id, callback) {
      order.push('subscribe');
      subscriber = callback;
      return () => {
        subscriber = null;
      };
    },
    acquire() {
      order.push('acquire');
      return true;
    },
    restart() {
      order.push('restart');
      subscriber?.({ loopStep: 0, when: 0, position: 0 });
      return true;
    },
    release() {
      order.push('release');
      return true;
    },
  };

  const rendered = [];
  playback.renderDrumEvent = (name, bus, when) => rendered.push({ name, bus, when });

  assert.equal(await playback.play(session, 0, { restartTransport: true }), true);
  assert.deepEqual(order.slice(-3), ['subscribe', 'acquire', 'restart']);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].name, '909-kick');
  assert.equal(rendered[0].bus, playback.buses.get(drum.id).input);

  drum.level = 0.23;
  drum.reverb = 0.4;
  drum.delay = 0.66;
  playback.applyLiveMix(session);
  assert.equal(playback.buses.get(drum.id).fader.gain.value, 0.23);
  assert.equal(playback.buses.get(drum.id).reverbSend.gain.value, 0.4 * 0.3);
  assert.equal(playback.buses.get(drum.id).delaySend.gain.value, 0.66 * 0.42);
});

test('Spectra reuses one white-noise buffer for repeated drum hits', () => {
  let bufferCreates = 0;
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: () => new FakeNode(),
    createBiquadFilter: () => new FakeNode(),
    createDynamicsCompressor: () => new FakeNode(),
    createDelay: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
    createAnalyser: () => new FakeAnalyser(),
    createBuffer(_channels, length, sampleRate) {
      bufferCreates += 1;
      const data = new Float32Array(length);
      return {
        duration: length / sampleRate,
        getChannelData: () => data,
      };
    },
  };
  const playback = new StudioPlayback({
    context,
    master: new FakeNode(),
    sourceDestination: () => new FakeNode(),
    sourceGain: () => 1,
  });

  const first = playback.sharedNoiseBuffer();
  const second = playback.sharedNoiseBuffer();

  assert.equal(first, second);
  assert.equal(bufferCreates, 1);
});

test('per-channel Spectra updates do not rewrite untouched channel automation', () => {
  const playback = new StudioPlayback(fakeAudio());
  const first = stem('channel-a', 0.8);
  const second = stem('channel-b', 0.6);
  const session = { stems: [first, second], recordings: new Map() };

  playback.updateMix(session, { immediate: true });
  const firstBus = playback.buses.get(first.id);
  const secondBus = playback.buses.get(second.id);
  secondBus.fader.gain.lastWrite = null;
  secondBus.pan.pan.lastWrite = null;

  first.level = 0.22;
  first.pan = 0.45;
  assert.equal(playback.updateStemMix(session, first.id, { immediate: true }), true);

  assert.equal(firstBus.fader.gain.value, 0.22);
  assert.equal(firstBus.pan.pan.value, 0.45);
  assert.equal(secondBus.fader.gain.lastWrite, null);
  assert.equal(secondBus.pan.pan.lastWrite, null);
});

test('a shared live input monitors through every matching added Spectra track', () => {
  const playback = new StudioPlayback(fakeAudio());
  const session = new StudioSession();
  const original = session.stems.find((stem) => stem.inputKey === 'synth');
  const added = session.addInputTrack('synth');
  const destinations = [];
  playback.oscillator = (_frequency, _duration, destination) => destinations.push(destination);

  assert.equal(
    playback.monitorLiveEvent(
      session,
      { mode: 'synth', stemKind: 'synth', inputKey: 'synth', wave: 'triangle' },
      { type: 'midi', midi: 60 },
      { resourceId: 'local:synth' },
    ),
    true,
  );

  assert.equal(destinations.length, 2);
  assert.equal(destinations.includes(playback.buses.get(original.id).input), true);
  assert.equal(destinations.includes(playback.buses.get(added.id).input), true);
});

test('live Spectra console moves immediately override active playback automation', () => {
  const playback = new StudioPlayback(fakeAudio());
  const recorded = stem('recorded-live', 0.78);
  recorded.pan = -0.2;
  recorded.low = 0.1;
  recorded.high = -0.1;
  recorded.reverb = 0.22;
  recorded.delay = 0.22;
  const session = { stems: [recorded], recordings: new Map() };

  playback.updateMix(session);
  playback.timer = 1;

  recorded.level = 0.17;
  recorded.pan = 0.64;
  recorded.low = -0.52;
  recorded.high = 0.43;
  recorded.reverb = 0.54;
  recorded.delay = 0.81;
  playback.applyLiveMix(session);

  const bus = playback.buses.get(recorded.id);
  assert.equal(bus.fader.gain.value, 0.17);
  assert.equal(bus.pan.pan.value, 0.64);
  assert.ok(Math.abs(bus.low.gain.value - -7.8) < 1e-9);
  assert.ok(Math.abs(bus.high.gain.value - 6.45) < 1e-9);
  assert.equal(bus.reverbSend.gain.value, 0.54 * 0.3);
  assert.equal(bus.delaySend.gain.value, 0.81 * 0.42);
  for (const parameter of [
    bus.fader.gain,
    bus.pan.pan,
    bus.low.gain,
    bus.high.gain,
    bus.reverbSend.gain,
    bus.delaySend.gain,
  ]) {
    assert.equal(parameter.lastWrite, 'value');
    assert.ok(parameter.cancelled > 0);
  }

  recorded.mute = true;
  playback.applyLiveMix(session);
  assert.equal(bus.hardMute.gain.value, 0);

  playback.timer = null;
  recorded.mute = false;
  recorded.level = 0.55;
  playback.applyLiveMix(session);
  assert.equal(bus.fader.gain.value, 0.55);
  assert.equal(bus.hardMute.gain.value, 1);
});

test('live monitored inputs enter the real Spectra channel bus', () => {
  const playback = new StudioPlayback(fakeAudio());
  const input = {
    ...stem('input-synth', 0.41),
    inputKey: 'synth',
    performance: null,
    monitor: true,
  };
  const session = { stems: [input], recordings: new Map() };
  const calls = [];
  playback.oscillator = (...args) => calls.push(args);

  assert.equal(
    playback.monitorLiveEvent(
      session,
      { mode: 'synth', stemKind: 'synth', wave: 'triangle', volume: 0.08, duration: 0.4 },
      { type: 'midi', midi: 60 },
      { resourceId: 'local:synth' },
    ),
    true,
  );

  const bus = playback.buses.get(input.id);
  assert.equal(bus.fader.gain.value, 0.41);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], bus.input);
});

test('empty monitored input channels do not generate canned playback', () => {
  const playback = new StudioPlayback(fakeAudio());
  const input = {
    ...stem('input-drum-machine', 0.72),
    inputKey: 'drum-machine',
    kind: 'drums',
    performance: null,
    monitor: true,
  };
  const session = {
    stems: [input],
    recordings: new Map(),
    bpm: 118,
    loopEnabled: true,
    loopBars: 4,
  };
  playback.session = session;
  let generated = 0;
  playback.kick = () => {
    generated += 1;
  };
  playback.noise = () => {
    generated += 1;
  };

  playback.renderStem(input, 0, 0);
  assert.equal(generated, 0);
});

test('starting Spectra mixer playback releases only live Spectra input generators', () => {
  const calls = [];
  stopSpectraLiveInputsForMix({
    drumMachine: { stopLoop: (refresh) => calls.push(['drum', refresh]) },
    modularSynth: { stopLoop: (refresh) => calls.push(['modular', refresh]) },
    keyboardPerformance: { stop: (returnTake) => calls.push(['keyboard', returnTake]) },
  });

  assert.deepEqual(calls, [
    ['drum', false],
    ['modular', false],
    ['keyboard', false],
  ]);
});

test('Spectra listening platform and rug inherit only the mixing-suite acoustic identity', () => {
  const gameSpace = createGameSpace();
  const deck = gameSpace.platforms.find((surface) => surface.id === 'listening-deck');
  const rug = gameSpace.platforms.find((surface) => surface.id === 'mix-rug');
  assert.equal(deck?.acousticSurfaceId, 'mixing-suite');
  assert.equal(rug?.acousticSurfaceId, 'mixing-suite');

  const listenerSurfaceId = SpatialAudioSystem.prototype.listenerSurfaceId;
  const player = { position: { x: 0, y: 0, z: 0 } };
  const levelFor = (surface) => ({
    definition: { id: 'upstairs' },
    collision: { surfaceAt: () => ({ surface }) },
  });

  assert.equal(listenerSurfaceId.call({}, levelFor(deck), player), 'mixing-suite');
  assert.equal(listenerSurfaceId.call({}, levelFor(rug), player), 'mixing-suite');
  assert.equal(listenerSurfaceId.call({}, levelFor({ id: 'live-room' }), player), 'live-room');
});
