import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StudioExporter,
  createStoredZip,
  encodeWav,
  studioExportDuration,
} from '../src/studio/StudioExporter.js';

function fakeBuffer(channels, sampleRate = 44_100) {
  const length = channels[0].length;
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData(index) {
      return channels[index];
    },
  };
}

test('encodeWav writes a valid stereo 16-bit PCM WAV', () => {
  const audio = fakeBuffer([
    Float32Array.from([0, 0.5, -0.5, 1]),
    Float32Array.from([0, -0.5, 0.5, -1]),
  ]);
  const wav = encodeWav(audio);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const ascii = (start, length) => String.fromCharCode(...wav.slice(start, start + length));

  assert.equal(ascii(0, 4), 'RIFF');
  assert.equal(ascii(8, 4), 'WAVE');
  assert.equal(ascii(12, 4), 'fmt ');
  assert.equal(ascii(36, 4), 'data');
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44_100);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 16);
  assert.equal(wav.byteLength, 60);
});

test('renderPerformanceStem freezes performance dry without applying console fader or mute', async () => {
  let oscillators = 0;

  class Param {
    constructor(value = 0) {
      this.value = value;
    }
    setValueAtTime(value) {
      this.value = value;
    }
    exponentialRampToValueAtTime(value) {
      this.value = value;
    }
  }

  class Node {
    constructor() {
      this.gain = new Param(1);
      this.frequency = new Param(440);
    }
    connect() {
      return this;
    }
    start() {}
    stop() {}
  }

  class FakeOfflineAudioContext {
    constructor(channels, frames, sampleRate) {
      this.numberOfChannels = channels;
      this.frames = frames;
      this.sampleRate = sampleRate;
      this.destination = new Node();
    }
    createGain() {
      return new Node();
    }
    createOscillator() {
      oscillators += 1;
      return new Node();
    }
    async startRendering() {
      return fakeBuffer([new Float32Array(this.frames)], this.sampleRate);
    }
  }

  const session = {
    bpm: 120,
    loopEnabled: true,
    loopBars: 1,
    recordings: new Map(),
    stems: [
      {
        id: 'input-synth',
        level: 0,
        mute: true,
        performance: {
          mode: 'synth',
          bpm: 120,
          duration: 2,
          noteDuration: 0.25,
          wave: 'triangle',
          volume: 0.06,
          events: [{ time: 0, midi: 60, frequency: 261.63 }],
        },
      },
    ],
  };

  const exporter = new StudioExporter({}, { OfflineAudioContext: FakeOfflineAudioContext });
  const rendered = await exporter.renderPerformanceStem(session, 'input-synth');

  assert.equal(oscillators, 1);
  assert.equal(rendered.buffer.duration, 2);
  assert.ok(rendered.blob);
  assert.equal(rendered.blob.type, 'audio/wav');
});

test('createStoredZip builds a standard single-file ZIP container', () => {
  const zip = createStoredZip([
    {
      name: 'session.json',
      data: '{"name":"Spectra"}',
    },
  ]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.byteLength - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.byteLength - 12, true), 1);
});

test('studioExportDuration uses exact loop length for loop exports', () => {
  const session = {
    bpm: 120,
    loopEnabled: true,
    loopBars: 8,
    stems: [],
    recordings: new Map(),
  };
  assert.equal(studioExportDuration(session), 16);
});

test('studioExportDuration follows the longest recorded or performed stem', () => {
  const session = {
    bpm: 120,
    loopEnabled: false,
    loopBars: 4,
    recordings: new Map([
      [
        'mic-1',
        {
          duration: 7.25,
        },
      ],
    ]),
    stems: [
      {
        id: 'mic-1',
      },
      {
        id: 'synth-1',
        performance: {
          duration: 5,
          noteDuration: 0.5,
          events: [{ time: 8.4, midi: 60 }],
        },
      },
    ],
  };

  assert.equal(studioExportDuration(session), 8.9);
});
