import test from 'node:test';
import assert from 'node:assert/strict';
import { MicrophoneRecorder } from '../src/studio/MicrophoneRecorder.js';
import { AudioEngine } from '../src/audio/AudioEngine.js';

function makeNode() {
  return {
    connect() {},
    disconnect() {},
  };
}

class FakeMediaRecorder {
  static isTypeSupported(type) {
    return type === 'audio/mp4';
  }

  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'audio/mp4';
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onerror = null;
  }

  start(...args) {
    this.startArgs = args;
    this.state = 'recording';
  }

  requestData() {
    this.requestDataCalled = true;
  }

  stop() {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob(['mic-data'], { type: this.mimeType }),
      });
      this.onstop?.();
    });
  }
}

test('MicrophoneRecorder prefers AudioWorklet PCM capture on modern Safari', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalAudioWorkletNode = globalThis.AudioWorkletNode;
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  const stream = { getTracks: () => [track] };
  const audioSession = { type: 'playback' };
  let workletNode = null;
  let moduleUrl = null;

  class FakeAudioWorkletNode {
    constructor() {
      workletNode = this;
      this.port = {
        onmessage: null,
        postMessage: (message) => {
          if (message === 'flush') {
            queueMicrotask(() => this.port.onmessage?.({ data: { type: 'flushed' } }));
          }
        },
      };
    }

    connect() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      audioSession,
      mediaDevices: {
        async getUserMedia() {
          return stream;
        },
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;
  globalThis.AudioWorkletNode = FakeAudioWorkletNode;

  try {
    const context = {
      state: 'running',
      sampleRate: 48000,
      destination: {},
      audioWorklet: {
        async addModule(url) {
          moduleUrl = url;
        },
      },
      createMediaStreamSource() {
        return makeNode();
      },
      createGain() {
        return { ...makeNode(), gain: { value: 1 } };
      },
      createBuffer(channels, length, sampleRate) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData(channel) {
            return data[channel];
          },
        };
      },
      async decodeAudioData() {
        throw new Error('encoded fallback should not be needed');
      },
    };
    const audio = {
      context,
      async resume() {
        return true;
      },
      async recoverAfterMicrophoneCapture() {
        audioSession.type = 'playback';
        return true;
      },
    };

    const recorder = new MicrophoneRecorder(audio);
    assert.equal(await recorder.start(), true);
    assert.ok(String(moduleUrl).includes('MicrophoneCaptureWorklet'));
    assert.ok(workletNode);

    workletNode.port.onmessage({
      data: new Float32Array([0.12, -0.24, 0.36, -0.48]),
    });
    workletNode.port.onmessage({
      data: new Float32Array([0.6, -0.72]),
    });

    const result = await recorder.stop();
    assert.equal(result.captureMode, 'worklet');
    assert.equal(result.pcmFrames, 6);
    assert.equal(result.buffer.length, 6);
    assert.deepEqual(
      [...result.buffer.getChannelData(0)].map((value) => Number(value.toFixed(2))),
      [0.12, -0.24, 0.36, -0.48, 0.6, -0.72],
    );
    assert.equal(track.stopped, true);
    assert.equal(audioSession.type, 'playback');
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    globalThis.MediaRecorder = originalMediaRecorder;
    globalThis.AudioWorkletNode = originalAudioWorkletNode;
  }
});

test('MicrophoneRecorder uses PCM when MediaRecorder decode fails', async () => {
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

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      audioSession,
      mediaDevices: {
        async getUserMedia() {
          return stream;
        },
      },
    },
  });
  globalThis.MediaRecorder = FakeMediaRecorder;

  try {
    let processor = null;
    let recovered = 0;
    const context = {
      sampleRate: 48000,
      destination: {},
      createMediaStreamSource() {
        return makeNode();
      },
      createScriptProcessor() {
        processor = { ...makeNode(), onaudioprocess: null };
        return processor;
      },
      createGain() {
        return { ...makeNode(), gain: { value: 1 } };
      },
      createBuffer(channels, length, sampleRate) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData(channel) {
            return data[channel];
          },
        };
      },
      async decodeAudioData() {
        throw new Error('Safari MediaRecorder container not decodable');
      },
    };
    const audio = {
      context,
      async recoverAfterMicrophoneCapture() {
        recovered += 1;
        audioSession.type = 'playback';
        return true;
      },
    };

    const recorder = new MicrophoneRecorder(audio);
    assert.equal(await recorder.start(), true);
    assert.equal(audioSession.type, 'play-and-record');

    processor.onaudioprocess({
      inputBuffer: {
        getChannelData() {
          return new Float32Array([0.1, -0.2, 0.3, -0.4]);
        },
      },
    });
    processor.onaudioprocess({
      inputBuffer: {
        getChannelData() {
          return new Float32Array([0.5, -0.6]);
        },
      },
    });

    const mediaRecorder = recorder.recorder;
    const result = await recorder.stop();
    assert.deepEqual(mediaRecorder.startArgs, []);
    assert.equal(mediaRecorder.requestDataCalled, undefined);
    assert.ok(result.buffer);
    assert.equal(result.buffer.length, 6);
    assert.deepEqual(
      [...result.buffer.getChannelData(0)].map((value) => Number(value.toFixed(2))),
      [0.1, -0.2, 0.3, -0.4, 0.5, -0.6],
    );
    assert.ok(result.blob.size > 0);
    assert.equal(result.type, 'audio/mp4');
    assert.equal(track.stopped, true);
    assert.equal(audioSession.type, 'playback');
    assert.equal(recovered, 1);
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
    };
    engine.environment = { gain: 0.9, lowpassHz: 18000, label: 'room' };
    engine.environmentGain = {
      gain: {
        setTargetAtTime(value) {
          values.push(['gain-target', value]);
        },
        setValueAtTime(value) {
          values.push(['gain', value]);
        },
      },
    };
    engine.environmentFilter = {
      frequency: {
        setTargetAtTime(value) {
          values.push(['filter-target', value]);
        },
        setValueAtTime(value) {
          values.push(['filter', value]);
        },
      },
    };
    const sourceGain = {
      gain: {
        setTargetAtTime(value) {
          values.push(['source-target', value]);
        },
        setValueAtTime(value) {
          values.push(['source', value]);
        },
      },
    };
    const sourceFilter = {
      frequency: {
        setTargetAtTime(value) {
          values.push(['source-filter-target', value]);
        },
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
