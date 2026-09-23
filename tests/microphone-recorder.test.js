import test from 'node:test';
import assert from 'node:assert/strict';
import { MicrophoneRecorder } from '../src/studio/MicrophoneRecorder.js';
import { AudioEngine } from '../src/audio/AudioEngine.js';

class FakeMediaRecorder {
  static lastOptions = Symbol('unset');

  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = 'audio/mp4';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
    this.startArgs = null;
    this.requestDataCalls = 0;
    FakeMediaRecorder.lastOptions = options;
  }

  start(...args) {
    this.startArgs = args;
    this.state = 'recording';
  }

  requestData() {
    this.requestDataCalls += 1;
  }

  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob(['native-safari-vocal'], { type: this.mimeType }),
      });
      this.onstop?.();
    });
  }
}

test('MicrophoneRecorder keeps the full capture duration when Safari decodes only a prefix', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMediaRecorder = globalThis.MediaRecorder;
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track] };
  const audioSession = { type: 'playback' };
  let recovered = 0;

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      audioSession,
      mediaDevices: {
        async getUserMedia(constraints) {
          assert.deepEqual(constraints, { audio: true });
          return stream;
        },
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;

  try {
    const decoded = { duration: 1.25, numberOfChannels: 1 };
    const audio = {
      context: {
        decodeAudioData(_bytes, success) {
          success?.(decoded);
          return Promise.resolve(decoded);
        },
      },
      async recoverAfterMicrophoneCapture() {
        recovered += 1;
        audioSession.type = 'playback';
        return true;
      },
    };
    const recorder = new MicrophoneRecorder(audio);

    assert.equal(await recorder.start(), true);
    // Model Safari returning a one-second decode for a much longer native microphone file.
    recorder.startedAt = performance.now() - 5000;
    const nativeRecorder = recorder.recorder;
    assert.equal(FakeMediaRecorder.lastOptions, undefined);
    assert.deepEqual(nativeRecorder.startArgs, [250]);
    assert.equal(audioSession.type, 'play-and-record');

    const result = await recorder.stop();
    assert.equal(nativeRecorder.requestDataCalls, 1);
    assert.equal(result.buffer, decoded);
    assert.ok(
      result.duration >= 4.9,
      'raw capture duration must not collapse to the shorter decoded AudioBuffer duration',
    );
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.blob.size > 0);
    assert.equal(result.bytes, result.blob.size);
    assert.equal(result.type, 'audio/mp4');
    assert.equal(track.stopped, true);
    assert.equal(audioSession.type, 'playback');
    assert.equal(recovered, 1);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    globalThis.MediaRecorder = originalMediaRecorder;
    FakeMediaRecorder.lastOptions = Symbol('unset');
  }
});

test('MicrophoneRecorder forces the Spectra loop grid on before capturing a vocal take', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMediaRecorder = globalThis.MediaRecorder;
  const stream = { getTracks: () => [{ stop() {} }] };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          return stream;
        },
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;

  try {
    const session = { loopEnabled: false, loopBars: 3 };
    const calls = [];
    const recorder = new MicrophoneRecorder({});
    recorder.spectraTransport = {
      session,
      acquire(owner, options) {
        calls.push(['acquire', owner, options]);
      },
      position() {
        return 6.4;
      },
      quantizeTime(position, options) {
        calls.push(['quantize', position, options]);
        return 2.5;
      },
      release(owner) {
        calls.push(['release', owner]);
      },
    };

    assert.equal(await recorder.start(), true);
    assert.equal(session.loopEnabled, true);
    assert.equal(session.loopBars, 4);
    assert.equal(recorder.timelineStart, 2.5);
    assert.deepEqual(calls[1], ['quantize', 6.4, { wrap: true, includeSwing: true }]);
    recorder.cancel();
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    globalThis.MediaRecorder = originalMediaRecorder;
  }
});

test('MicrophoneRecorder keeps the native vocal Blob when WebAudio decoding is unavailable', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMediaRecorder = globalThis.MediaRecorder;
  const stream = { getTracks: () => [{ stop() {} }] };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          return stream;
        },
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;

  try {
    const recorder = new MicrophoneRecorder({
      context: {
        decodeAudioData() {
          return Promise.reject(new Error('unsupported container'));
        },
      },
      async recoverAfterMicrophoneCapture() {
        return true;
      },
    });

    assert.equal(await recorder.start(), true);
    const result = await recorder.stop();
    assert.equal(result.buffer, null);
    assert.ok(result.blob instanceof Blob);
    assert.ok(result.blob.size > 0);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    globalThis.MediaRecorder = originalMediaRecorder;
  }
});

test('AudioEngine restores playback mode after mic capture', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const audioSession = { type: 'play-and-record' };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { audioSession },
  });

  try {
    const engine = new AudioEngine();
    const values = [];
    engine.context = {
      state: 'running',
      currentTime: 1,
      async suspend() {
        this.state = 'suspended';
      },
      async resume() {
        this.state = 'running';
      },
    };
    engine.environment = { gain: 0.9, lowpassHz: 18000, label: 'room' };
    engine.environmentGain = {
      gain: {
        cancelScheduledValues() {},
        setValueAtTime(value) {
          values.push(['gain', value]);
        },
      },
    };
    engine.environmentFilter = {
      frequency: {
        cancelScheduledValues() {},
        setValueAtTime(value) {
          values.push(['filter', value]);
        },
      },
    };
    const sourceGain = {
      gain: {
        cancelScheduledValues() {},
        setValueAtTime(value) {
          values.push(['source', value]);
        },
      },
    };
    const sourceFilter = {
      frequency: {
        cancelScheduledValues() {},
        setValueAtTime(value) {
          values.push(['source-filter', value]);
        },
      },
    };
    engine.sourceBuses.set('studio', { gain: sourceGain, filter: sourceFilter });
    engine.sourceEnvironments.set('studio', {
      gain: 0.8,
      lowpassHz: 16000,
      label: 'studio',
    });
    engine.prioritySource = 'microphone';

    const result = await engine.recoverAfterMicrophoneCapture({ settleMs: 0 });
    assert.equal(result, true);
    assert.equal(audioSession.type, 'playback');
    assert.equal(engine.prioritySource, null);
    assert.ok(values.some(([name, value]) => name === 'gain' && value === 0.9));
    assert.ok(values.some(([name, value]) => name === 'source' && value === 0.8));
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
