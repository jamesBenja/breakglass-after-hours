import test from 'node:test';
import assert from 'node:assert/strict';
import { SpectraPerformanceDiagnostics } from '../src/studio/SpectraPerformanceDiagnostics.js';

function fakeBuffer(length, channels = 2) {
  return {
    length,
    numberOfChannels: channels,
    duration: length / 48000,
    sampleRate: 48000,
  };
}

function fakeTimers() {
  let nextId = 1;
  const intervals = new Map();
  const timeouts = new Map();
  return {
    intervals,
    timeouts,
    setInterval(callback, delay) {
      const id = nextId++;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    setTimeout(callback, delay) {
      const id = nextId++;
      timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
  };
}

function fakeGame() {
  const vocal = {
    id: 'vocal-1',
    label: 'Vocal 1',
    kind: 'vocal',
    inputKey: 'vocal',
    source: 'browser-microphone',
    sourceOffset: 0.5,
    renderedAudio: true,
    performance: null,
  };
  const guitar = {
    id: 'guitar-1',
    label: 'Guitar',
    kind: 'guitar',
    inputKey: 'guitar',
    source: 'spectra-live-capture',
    renderedAudio: true,
    performance: { events: [{ time: 0, midi: 48 }] },
  };
  const vocalBuffer = fakeBuffer(48000 * 4, 1);
  const guitarBuffer = fakeBuffer(48000 * 4, 2);
  const arranged = fakeBuffer(48000 * 16, 2);

  return {
    audio: {
      context: {
        state: 'running',
        currentTime: 12,
        baseLatency: 0.01,
        outputLatency: 0.02,
      },
    },
    studio: {
      name: 'Diagnostic test',
      bpm: 120,
      loopBars: 4,
      arrangementBars: 16,
      stems: [vocal, guitar],
      recordings: new Map([
        [vocal.id, vocalBuffer],
        [guitar.id, guitarBuffer],
      ]),
    },
    studioPlayback: {
      sources: new Set([{}, {}, {}]),
      frozenSources: new Map([[vocal.id, {}]]),
      vocalBufferSources: new Map([[vocal.id, new Set([{}])]]),
      vocalBufferLoopTimers: new Map([[vocal.id, 1]]),
      buses: new Map([
        [vocal.id, {}],
        [guitar.id, {}],
      ]),
      blobStems: new Map(),
      nativeStems: new Map(),
      arrangedRecordingBuffers: new Map([[guitar.id, { value: { buffer: arranged } }]]),
    },
    spectraTransport: {
      snapshot: () => ({ running: true, absoluteStep: 64 }),
    },
  };
}

test('Spectra diagnostics stay idle until explicitly started and report controlled audio memory', () => {
  let now = 1000;
  const timers = fakeTimers();
  const diagnostics = new SpectraPerformanceDiagnostics(fakeGame(), {
    now: () => now,
    wallNow: () => 1700000000000 + now,
    timers,
  });

  assert.equal(diagnostics.active, false);
  assert.equal(timers.intervals.size, 0);
  assert.equal(timers.timeouts.size, 0);

  const memory = diagnostics.audioMemorySnapshot();
  assert.equal(memory.originalMB > 0, true);
  assert.equal(memory.arrangedMB > memory.originalMB, true);

  diagnostics.start();
  assert.equal(diagnostics.active, true);
  assert.equal(timers.intervals.size, 1);
  assert.equal(timers.timeouts.size, 1);
  assert.equal(diagnostics.samples.length, 1);

  diagnostics.stop('test');
  assert.equal(diagnostics.active, false);
  assert.equal(timers.intervals.size, 0);
  assert.equal(timers.timeouts.size, 0);
});

test('Spectra diagnostics capture event-loop delay, vocal scheduler lateness and glitch marks', () => {
  let now = 2000;
  const timers = fakeTimers();
  const game = fakeGame();
  const diagnostics = new SpectraPerformanceDiagnostics(game, {
    intervalMs: 250,
    now: () => now,
    wallNow: () => 1700000000000 + now,
    timers,
  });

  diagnostics.start();
  now += 420;
  game.audio.context.currentTime += 0.42;
  diagnostics.captureSample();

  diagnostics.noteSourceCreated('vocal-buffer', 'vocal-1');
  diagnostics.noteSchedulerCallback('vocal-loop', 12.3, 12.36, 'vocal-1');
  diagnostics.noteSkippedCycles('vocal-loop', 2, 'vocal-1');
  const mark = diagnostics.markGlitch();
  assert.equal(mark.label, 'manual glitch mark');
  assert.equal(diagnostics.marks.length, 1);

  const summary = diagnostics.summary();
  assert.equal(summary.eventLoopLateMaxMs >= 170, true);
  assert.equal(summary.schedulerLateMaxMs, 60);
  assert.equal(summary.skippedCycles, 2);
  assert.equal(summary.sourceCreates['vocal-buffer'], 1);

  diagnostics.stop('test complete');
  const report = JSON.parse(diagnostics.lastReport);
  assert.equal(report.stopReason, 'test complete');
  assert.equal(report.summary.marks, 1);
  assert.equal(report.session.tracks.length, 2);
  assert.equal(report.memory.totalMB > 0, true);
  assert.equal(
    report.events.some((event) => event.type === 'scheduler'),
    true,
  );
  assert.equal(
    report.events.some((event) => event.type === 'skipped-cycles'),
    true,
  );
});
