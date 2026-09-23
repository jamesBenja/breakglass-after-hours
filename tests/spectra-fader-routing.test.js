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
      source.stop = () => {
        source.stopped = true;
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

test('blob-only vocal takes are treated as playable Spectra audio', async () => {
  const OriginalAudio = globalThis.Audio;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const created = [];

  class FakeMedia {
    constructor() {
      this.src = '';
      this.volume = 0;
      this.loop = false;
      this.playsInline = false;
      this.readyState = 1;
      this.duration = 2;
      this.currentTime = 0;
      this.played = false;
      this.playCount = 0;
      this.paused = false;
      created.push(this);
    }

    play() {
      this.played = true;
      this.playCount += 1;
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
    }

    removeAttribute(name) {
      if (name === 'src') this.src = '';
    }

    load() {}
    addEventListener() {}
  }

  globalThis.Audio = FakeMedia;
  URL.createObjectURL = () => 'blob:recorded-vocal';
  URL.revokeObjectURL = () => {};

  try {
    const mediaSources = [];
    const playback = new StudioPlayback(fakeAudio([], { mediaSources }));
    const session = new StudioSession();
    const vocal = session.stems.find((stem) => stem.inputKey === 'vocal');
    assert.ok(vocal, 'default Spectra session should expose a Vocal input channel');
    vocal.source = 'browser-microphone';
    vocal.sourceOffset = 0.5;
    session.bpm = 60;
    session.loopBars = 1;
    session.replaceRecording(vocal.id, null, new Blob(['voice'], { type: 'audio/mp4' }));
    playback.session = session;

    const started = await playback.startBlobRecordings(session, 0);
    assert.equal(started, 1);
    assert.equal(created.length, 1);
    assert.equal(created[0].src, 'blob:recorded-vocal');
    assert.equal(created[0].played, true);
    assert.equal(created[0].playCount, 1, 'the native Vocal file should be started only once');
    assert.equal(created[0].loop, true, 'the native file stays alive while Spectra gates its loop');
    assert.equal(created[0].currentTime, 0.5);
    assert.equal(playback.blobStems.get(vocal.id), created[0]);
    assert.equal(mediaSources.length, 1, 'Safari Vocal fallback should enter the WebAudio mixer');
    assert.equal(playback.blobRoutes.get(vocal.id)?.gate?.gain?.value, 1);
    assert.equal(created[0].volume, 1, 'WebAudio-routed media leaves level to the channel fader');

    vocal.mute = true;
    playback.applyChannelAudibility(session);
    assert.equal(playback.buses.get(vocal.id).hardMute.gain.value, 0);
    assert.equal(created[0].volume, 1);
    playback.stop();
    assert.equal(playback.blobRoutes.size, 0);
  } finally {
    globalThis.Audio = OriginalAudio;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test('recorded microphone audio becomes one continuous fixed-length Spectra loop source', () => {
  const createdSources = [];
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio);
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
  session.recordings.set(vocal.id, recording);
  playback.session = session;
  playback.updateMix(session);

  assert.equal(playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 }), 1);

  const source = createdSources[0];
  assert.equal(source.loop, true);
  assert.equal(source.loopStart, 0);
  assert.equal(source.loopEnd, 4);
  assert.equal(source.buffer.duration, 4);
  assert.notEqual(source.buffer, recording);
  assert.deepEqual(source.startArgs, [0, 0]);

  const loop = source.buffer.getChannelData(0);
  assert.equal(loop[0], samples[12]);
  assert.equal(loop[37], samples[49]);
  assert.equal(loop[38], 0);
  assert.equal(loop[39], 0);

  assert.equal(playback.frozenSources.get(vocal.id), source);
  assert.equal(playback.frozenGates.has(vocal.id), true);
  assert.equal(playback.vocalBufferLoopTimers.has(vocal.id), false);

  vocal.mute = true;
  playback.applyChannelAudibility(session);
  assert.equal(playback.frozenGates.get(vocal.id).gain.value, 0);
  vocal.mute = false;
  playback.applyChannelAudibility(session);
  assert.equal(playback.frozenGates.get(vocal.id).gain.value, 1);

  playback.stop();
  assert.equal(source.stopped, true);
});

test('changing Vocal source offset replaces the continuous loop source cleanly', () => {
  const createdSources = [];
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio);
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

  assert.equal(playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 }), 1);
  const firstSource = createdSources[0];
  assert.equal(firstSource.buffer.getChannelData(0)[0], samples[12]);

  vocal.sourceOffset = 0.5;
  assert.equal(playback.startFrozenRecordings(session, 0, { startTime: 0, phaseOffset: 0 }), 1);

  const secondSource = createdSources[1];
  assert.equal(firstSource.stopped, true, 'old Vocal loop source must stop on scrubber rebuild');
  assert.equal(secondSource.buffer.getChannelData(0)[0], samples[5]);
  assert.equal(secondSource.loop, true);
  assert.equal(playback.frozenSources.get(vocal.id), secondSource);

  playback.stopRecordedStemPlayback(vocal.id);
  assert.equal(secondSource.stopped, true);
  assert.equal(playback.frozenSources.has(vocal.id), false);
  assert.equal(playback.frozenGates.has(vocal.id), false);
});

test('a replacement Vocal recording cannot inherit the previous take playback state', () => {
  const createdSources = [];
  const audio = fakeAudio(createdSources);
  const playback = new StudioPlayback(audio);
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
  assert.notEqual(secondSource.buffer, secondRecording);
  assert.equal(secondSource.buffer.duration, 4);
  assert.deepEqual(secondSource.startArgs, [0, 0]);
  assert.equal(secondSource.loop, true);
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
