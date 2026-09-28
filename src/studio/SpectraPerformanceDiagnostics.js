const round = (value, digits = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const scale = 10 ** digits;
  return Math.round(number * scale) / scale;
};

const percentile = (values, amount) => {
  const safe = values
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number)
    .sort((a, b) => a - b);
  if (!safe.length) return 0;
  const index = Math.max(0, Math.min(safe.length - 1, Math.ceil(safe.length * amount) - 1));
  return safe[index];
};

const bufferBytes = (buffer) => {
  if (!buffer) return 0;
  const frames = Math.max(0, Number(buffer.length) || 0);
  const channels = Math.max(0, Number(buffer.numberOfChannels) || 0);
  return frames * channels * 4;
};

const mb = (bytes) => round(Math.max(0, Number(bytes) || 0) / (1024 * 1024), 2);

const isVocalStem = (stem) =>
  stem?.kind === 'vocal' || stem?.inputKey === 'vocal' || stem?.source === 'browser-microphone';

export class SpectraPerformanceDiagnostics {
  constructor(
    game,
    {
      intervalMs = 250,
      maxDurationMs = 30000,
      postMarkMs = 5000,
      now = () => globalThis.performance?.now?.() ?? Date.now(),
      wallNow = () => Date.now(),
      timers = globalThis,
    } = {},
  ) {
    this.game = game;
    this.intervalMs = Math.max(100, Number(intervalMs) || 250);
    this.maxDurationMs = Math.max(5000, Number(maxDurationMs) || 30000);
    this.postMarkMs = Math.max(1000, Number(postMarkMs) || 5000);
    this.now = now;
    this.wallNow = wallNow;
    this.timers = timers;

    this.active = false;
    this.startedAt = 0;
    this.startedWallTime = 0;
    this.lastTickAt = 0;
    this.samples = [];
    this.events = [];
    this.marks = [];
    this.sourceCreates = new Map();
    this.sourceEnds = new Map();
    this.intervalHandle = null;
    this.stopHandle = null;
    this.postMarkHandle = null;
    this.stopReason = null;
    this.lastReport = '';
  }

  start() {
    this.stop('restart');
    this.active = true;
    if (this.game?.studioPlayback) this.game.studioPlayback.performanceDiagnostics = this;
    this.startedAt = this.now();
    this.startedWallTime = this.wallNow();
    this.lastTickAt = this.startedAt;
    this.samples = [];
    this.events = [];
    this.marks = [];
    this.sourceCreates.clear();
    this.sourceEnds.clear();
    this.stopReason = null;
    this.lastReport = '';

    this.captureSample('start');
    this.intervalHandle = this.timers.setInterval?.(
      () => this.captureSample('sample'),
      this.intervalMs,
    );
    this.stopHandle = this.timers.setTimeout?.(
      () => this.stop('30-second limit'),
      this.maxDurationMs,
    );
    return this.status();
  }

  stop(reason = 'manual') {
    if (!this.active) return false;
    this.captureSample('stop');
    this.active = false;
    if (this.game?.studioPlayback?.performanceDiagnostics === this) {
      this.game.studioPlayback.performanceDiagnostics = null;
    }
    this.stopReason = reason;
    if (this.intervalHandle != null) this.timers.clearInterval?.(this.intervalHandle);
    if (this.stopHandle != null) this.timers.clearTimeout?.(this.stopHandle);
    if (this.postMarkHandle != null) this.timers.clearTimeout?.(this.postMarkHandle);
    this.intervalHandle = null;
    this.stopHandle = null;
    this.postMarkHandle = null;
    this.lastReport = this.report();
    return this.lastReport;
  }

  clear() {
    if (this.active) this.stop('cleared');
    this.samples = [];
    this.events = [];
    this.marks = [];
    this.sourceCreates.clear();
    this.sourceEnds.clear();
    this.stopReason = null;
    this.lastReport = '';
    return true;
  }

  markGlitch(label = 'manual glitch mark') {
    if (!this.active) return false;
    const mark = {
      atMs: Math.max(0, this.now() - this.startedAt),
      wallTime: this.wallNow(),
      label,
    };
    this.marks.push(mark);
    this.events.push({ type: 'glitch-mark', ...mark });
    if (this.postMarkHandle != null) this.timers.clearTimeout?.(this.postMarkHandle);
    this.postMarkHandle = this.timers.setTimeout?.(
      () => this.stop('5 seconds after glitch mark'),
      this.postMarkMs,
    );
    return mark;
  }

  noteSourceCreated(type = 'source', stemId = null) {
    if (!this.active) return;
    const key = String(type || 'source');
    this.sourceCreates.set(key, (this.sourceCreates.get(key) || 0) + 1);
    if (stemId)
      this.events.push({ type: 'source-create', sourceType: key, stemId, atMs: this.elapsedMs() });
  }

  noteSourceEnded(type = 'source', stemId = null) {
    if (!this.active) return;
    const key = String(type || 'source');
    this.sourceEnds.set(key, (this.sourceEnds.get(key) || 0) + 1);
    if (stemId)
      this.events.push({ type: 'source-end', sourceType: key, stemId, atMs: this.elapsedMs() });
  }

  noteSchedulerCallback(kind, expectedContextTime, actualContextTime, stemId = null) {
    if (!this.active) return;
    const expected = Number(expectedContextTime);
    const actual = Number(actualContextTime);
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) return;
    const latenessMs = (actual - expected) * 1000;
    this.events.push({
      type: 'scheduler',
      kind,
      stemId,
      atMs: this.elapsedMs(),
      latenessMs: round(latenessMs, 2),
    });
  }

  noteSkippedCycles(kind, count, stemId = null) {
    if (!this.active || !(Number(count) > 0)) return;
    this.events.push({
      type: 'skipped-cycles',
      kind,
      stemId,
      count: Math.max(1, Math.floor(Number(count))),
      atMs: this.elapsedMs(),
    });
  }

  elapsedMs() {
    if (!(this.startedAt > 0)) return 0;
    return Math.max(0, this.now() - this.startedAt);
  }

  audioMemorySnapshot() {
    const session = this.game?.studio;
    const playback = this.game?.studioPlayback;
    let originalBytes = 0;
    let arrangedBytes = 0;
    const tracks = [];

    for (const stem of session?.stems ?? []) {
      const original = session.recordings?.get?.(stem.id) ?? null;
      const arranged = playback?.arrangedRecordingBuffers?.get?.(stem.id)?.value?.buffer ?? null;
      const originalTrackBytes = bufferBytes(original);
      const arrangedTrackBytes = arranged && arranged !== original ? bufferBytes(arranged) : 0;
      originalBytes += originalTrackBytes;
      arrangedBytes += arrangedTrackBytes;
      if (originalTrackBytes || arrangedTrackBytes) {
        tracks.push({
          id: stem.id,
          label: stem.label,
          originalMB: mb(originalTrackBytes),
          arrangedMB: mb(arrangedTrackBytes),
        });
      }
    }

    return {
      originalMB: mb(originalBytes),
      arrangedMB: mb(arrangedBytes),
      totalMB: mb(originalBytes + arrangedBytes),
      tracks,
    };
  }

  captureSample(reason = 'sample') {
    if (!this.active && reason !== 'stop') return null;
    const now = this.now();
    const elapsed = Math.max(0, now - this.startedAt);
    const tickDelta = this.lastTickAt ? now - this.lastTickAt : this.intervalMs;
    const eventLoopLateMs = Math.max(0, tickDelta - this.intervalMs);
    this.lastTickAt = now;

    const session = this.game?.studio;
    const playback = this.game?.studioPlayback;
    const context = this.game?.audio?.context;
    const stems = session?.stems ?? [];
    const vocalStems = stems.filter(isVocalStem);
    const memory = this.audioMemorySnapshot();
    const activeVocalSources = [...(playback?.vocalBufferSources?.values?.() ?? [])].reduce(
      (total, sources) => total + (sources?.size ?? 0),
      0,
    );
    const transport = this.game?.spectraTransport?.snapshot?.() ?? null;

    const sample = {
      reason,
      atMs: round(elapsed, 1),
      wallTime: this.wallNow(),
      eventLoopLateMs: round(eventLoopLateMs, 1),
      contextState: context?.state ?? null,
      audioContextTime: round(context?.currentTime, 4),
      baseLatencyMs: round((Number(context?.baseLatency) || 0) * 1000, 2),
      outputLatencyMs: round((Number(context?.outputLatency) || 0) * 1000, 2),
      tracks: stems.length,
      vocalTracks: vocalStems.length,
      recordedTracks: stems.filter((stem) => session?.recordings?.has?.(stem.id)).length,
      eventTracks: stems.filter((stem) => stem.performance?.events?.length).length,
      activeSources: playback?.sources?.size ?? 0,
      frozenSources: playback?.frozenSources?.size ?? 0,
      activeVocalSources,
      vocalTimers: playback?.vocalBufferLoopTimers?.size ?? 0,
      buses: playback?.buses?.size ?? 0,
      blobPlayers: playback?.blobStems?.size ?? 0,
      nativePlayers: playback?.nativeStems?.size ?? 0,
      arrangementBuffers: playback?.arrangedRecordingBuffers?.size ?? 0,
      originalAudioMB: memory.originalMB,
      arrangedAudioMB: memory.arrangedMB,
      totalAudioMB: memory.totalMB,
      bpm: round(session?.bpm, 2),
      loopBars: Number(session?.loopBars) || 0,
      arrangementBars: Number(session?.arrangementBars) || Number(session?.loopBars) || 0,
      transportRunning: transport?.running === true,
      transportStep: Number(transport?.absoluteStep) || 0,
    };
    this.samples.push(sample);
    if (this.samples.length > 160) this.samples.shift();
    return sample;
  }

  summary() {
    const scheduler = this.events.filter((event) => event.type === 'scheduler');
    const schedulerLateness = scheduler.map((event) => Math.max(0, Number(event.latenessMs) || 0));
    const loopLate = this.samples.map((sample) => Number(sample.eventLoopLateMs) || 0);
    const skippedCycles = this.events
      .filter((event) => event.type === 'skipped-cycles')
      .reduce((total, event) => total + (Number(event.count) || 0), 0);
    const max = (key) => Math.max(0, ...this.samples.map((sample) => Number(sample[key]) || 0));
    const latest = this.samples.at(-1) ?? null;

    return {
      durationSec: round((latest?.atMs ?? this.elapsedMs()) / 1000, 2),
      samples: this.samples.length,
      marks: this.marks.length,
      eventLoopLateP95Ms: round(percentile(loopLate, 0.95), 1),
      eventLoopLateMaxMs: round(Math.max(0, ...loopLate), 1),
      schedulerLateP95Ms: round(percentile(schedulerLateness, 0.95), 1),
      schedulerLateMaxMs: round(Math.max(0, ...schedulerLateness), 1),
      skippedCycles,
      maxTracks: max('tracks'),
      maxVocalTracks: max('vocalTracks'),
      maxActiveSources: max('activeSources'),
      maxActiveVocalSources: max('activeVocalSources'),
      maxVocalTimers: max('vocalTimers'),
      maxAudioMB: max('totalAudioMB'),
      maxArrangedAudioMB: max('arrangedAudioMB'),
      sourceCreates: Object.fromEntries(this.sourceCreates),
      sourceEnds: Object.fromEntries(this.sourceEnds),
    };
  }

  samplesAroundMarks() {
    if (!this.marks.length) return this.samples.slice(-80);
    const included = new Set();
    for (const mark of this.marks) {
      for (let index = 0; index < this.samples.length; index += 1) {
        const sample = this.samples[index];
        if (Math.abs((Number(sample.atMs) || 0) - mark.atMs) <= 5000) included.add(index);
      }
    }
    return [...included].sort((a, b) => a - b).map((index) => this.samples[index]);
  }

  status() {
    return {
      active: this.active,
      elapsedSec: round(this.elapsedMs() / 1000, 1),
      samples: this.samples.length,
      marks: this.marks.length,
      summary: this.summary(),
    };
  }

  statusText() {
    const status = this.status();
    const summary = status.summary;
    if (!status.active && !this.samples.length) {
      return 'Idle. Start a capture, reproduce the playback glitch, then tap MARK GLITCH when you hear it.';
    }
    return [
      status.active ? `CAPTURING · ${status.elapsedSec}s` : `CAPTURED · ${summary.durationSec}s`,
      `${summary.maxTracks} tracks · ${summary.maxVocalTracks} vocal`,
      `max ${summary.maxActiveSources} active sources · ${summary.maxActiveVocalSources} vocal sources`,
      `audio buffers ${summary.maxAudioMB} MB · arranged ${summary.maxArrangedAudioMB} MB`,
      `main-thread late p95 ${summary.eventLoopLateP95Ms} ms · max ${summary.eventLoopLateMaxMs} ms`,
      `vocal scheduler late p95 ${summary.schedulerLateP95Ms} ms · max ${summary.schedulerLateMaxMs} ms`,
      `${summary.skippedCycles} skipped vocal cycles · ${status.marks} glitch mark${status.marks === 1 ? '' : 's'}`,
    ].join(' · ');
  }

  report() {
    const memory = this.audioMemorySnapshot();
    const report = {
      version: 1,
      capturedAt: this.wallNow(),
      stopReason: this.stopReason,
      summary: this.summary(),
      session: {
        name: this.game?.studio?.name ?? null,
        bpm: Number(this.game?.studio?.bpm) || null,
        loopBars: Number(this.game?.studio?.loopBars) || null,
        arrangementBars:
          Number(this.game?.studio?.arrangementBars) || Number(this.game?.studio?.loopBars) || null,
        tracks: (this.game?.studio?.stems ?? []).map((stem) => ({
          id: stem.id,
          label: stem.label,
          input: stem.inputKey ?? stem.kind ?? null,
          vocal: isVocalStem(stem),
          renderedAudio: stem.renderedAudio === true,
          eventCount: stem.performance?.events?.length ?? 0,
          sourceOffset: round(stem.sourceOffset, 4),
        })),
      },
      memory,
      marks: this.marks,
      events: this.events.filter(
        (event) =>
          event.type === 'glitch-mark' ||
          event.type === 'scheduler' ||
          event.type === 'skipped-cycles',
      ),
      samples: this.samplesAroundMarks(),
    };
    return JSON.stringify(report, null, 2);
  }
}
