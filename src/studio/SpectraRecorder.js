import { spectraInputStem } from './SpectraInputs.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const clockNow = () => globalThis.performance?.now?.() ?? Date.now();

function loopSeconds(session) {
  if (!session?.loopEnabled) return 0;
  return Math.max(
    0.25,
    ((Number(session.loopBars) || 4) * 4 * 60) / Math.max(1, Number(session.bpm) || 118),
  );
}

function kindFor(config = {}) {
  if (config.stemKind) return String(config.stemKind).slice(0, 24);
  if (config.mode === 'piano') return 'keys';
  if (['drums', 'guitar', 'bass', 'synth', 'keys'].includes(config.mode)) return config.mode;
  return 'synth';
}

function midiEvent(midi) {
  const safeMidi = clamp(Math.round(Number(midi) || 60), 24, 96);
  return { midi: safeMidi, frequency: 440 * Math.pow(2, (safeMidi - 69) / 12) };
}

function eventsForCapture(event = {}) {
  if (event.type === 'drum' && typeof event.name === 'string') {
    return [{ drum: event.name.slice(0, 24), delay: 0 }];
  }
  if (event.type === 'chord' && Array.isArray(event.midis)) {
    const notes = event.direction === 'up' ? [...event.midis].reverse() : [...event.midis];
    return notes.slice(0, 8).map((midi, index) => ({
      ...midiEvent(midi),
      delay: index * 0.021,
    }));
  }
  return [{ ...midiEvent(event.midi), delay: 0 }];
}

export class SpectraRecorder {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.armed = false;
    this.recording = false;
    this.startedAt = 0;
    this.transportOrigin = 0;
    this.lanes = new Map();
    this.lastCommitted = [];
    this.transportOwner = 'spectra-recorder';
  }

  status() {
    let events = 0;
    for (const lane of this.lanes.values()) events += lane.events.length;
    return {
      armed: this.armed,
      recording: this.recording,
      lanes: this.lanes.size,
      events,
      transport: this.game.spectraTransport?.snapshot?.() ?? null,
    };
  }

  arm() {
    const session = this.game.studio;
    const hasTrackArmModel = typeof session?.armedStems === 'function';
    const armedTracks = hasTrackArmModel ? session.armedStems() : [];
    if (hasTrackArmModel && !armedTracks.length) return false;

    // Spectra records musical loops, not open-ended takes. Keep every captured channel on the
    // same bar/grid geometry so stopping record always produces immediately playable clips.
    if (session) {
      session.loopEnabled = true;
      session.loopBars = [1, 2, 4, 8, 16].includes(Number(session.loopBars))
        ? Number(session.loopBars)
        : 4;
      session.quantize = ['1/4', '1/8', '1/16'].includes(session.quantize)
        ? session.quantize
        : '1/16';
    }

    this.armed = true;
    this.recording = false;
    this.startedAt = 0;
    this.transportOrigin = 0;
    this.lanes.clear();
    this.lastCommitted = [];
    this.game.spectraTransport?.acquire?.(this.transportOwner, { position: 0 });
    return this.status();
  }

  cancel() {
    this.armed = false;
    this.recording = false;
    this.startedAt = 0;
    this.transportOrigin = 0;
    this.lanes.clear();
    this.game.spectraTransport?.release?.(this.transportOwner);
    return true;
  }

  beginOnFirstEvent(offsetSeconds = 0) {
    if (!this.armed) return false;
    if (this.recording) return true;
    const offset = Math.max(0, Number(offsetSeconds) || 0);
    this.recording = true;
    this.startedAt = clockNow() + offset * 1000;
    const transport = this.game.spectraTransport;
    this.transportOrigin = transport?.running
      ? (transport.absolutePosition?.(offset) ?? transport.positionAtOffset(offset))
      : (this.game.studioPlayback?.position?.() ?? 0);
    return true;
  }

  eventTime(offsetSeconds = 0) {
    const offset = Math.max(0, Number(offsetSeconds) || 0);
    const session = this.game.studio;
    const transport = this.game.spectraTransport;
    if (transport?.running) {
      const timelinePosition = this.game.studioPlayback?.playing
        ? transport.positionAtOffset(offset)
        : Math.max(
            0,
            (transport.absolutePosition?.(offset) ?? transport.positionAtOffset(offset)) -
              this.transportOrigin,
          );
      return transport.quantizeTime(timelinePosition, {
        wrap: true,
        includeSwing: true,
      });
    }
    const loop = loopSeconds(session);
    if (loop > 0 && this.game.studioPlayback?.playing) {
      const position = (this.game.studioPlayback.position?.() ?? this.transportOrigin) + offset;
      return ((position % loop) + loop) % loop;
    }
    return Math.max(0, (clockNow() - this.startedAt) / 1000 + offset);
  }

  capture({
    playerId = 'local',
    playerName = 'Player',
    resourceId = 'instrument',
    config = {},
    event = {},
    offsetSeconds = 0,
    source = 'spectra-live-capture',
  } = {}) {
    if (!this.armed) return false;
    const hasTrackArmModel = typeof this.game.studio?.armedStems === 'function';
    const targetStem = hasTrackArmModel
      ? spectraInputStem(this.game.studio, config, resourceId, { armedOnly: true })
      : null;
    if (hasTrackArmModel && !targetStem) return false;
    this.beginOnFirstEvent(offsetSeconds);
    const laneId = [
      targetStem?.id || resourceId || config.mode || 'instrument',
      playerId || 'local',
    ]
      .join(':')
      .slice(0, 96);
    let lane = this.lanes.get(laneId);
    if (!lane) {
      lane = {
        id: laneId,
        playerId: String(playerId || 'local').slice(0, 64),
        playerName: String(playerName || 'Player').slice(0, 32),
        resourceId: String(resourceId || 'instrument').slice(0, 96),
        config: {
          mode: config.mode ?? 'synth',
          stemKind: config.stemKind ?? null,
          label: config.label ?? config.mode ?? 'Instrument',
          wave: config.wave ?? 'triangle',
          volume: clamp(config.volume ?? 0.065, 0.01, 0.22),
          duration: clamp(config.duration ?? 0.42, 0.06, 1.5),
          octaveLayer: config.octaveLayer === true,
          processing:
            config.processing && typeof config.processing === 'object'
              ? { ...config.processing }
              : null,
        },
        source,
        targetStemId: targetStem?.id ?? null,
        events: [],
      };
      this.lanes.set(laneId, lane);
    }
    const eventTime = this.eventTime(offsetSeconds);
    for (const captured of eventsForCapture(event)) {
      const { delay = 0, ...performanceEvent } = captured;
      lane.events.push({ time: eventTime + delay, ...performanceEvent });
    }
    if (lane.events.length > 512) lane.events.splice(0, lane.events.length - 512);
    return true;
  }

  captureLocal(config, event, { resourceId = 'local-instrument', offsetSeconds = 0 } = {}) {
    const multiplayer = this.game.multiplayer;
    return this.capture({
      playerId: multiplayer?.localId ?? 'local',
      playerName: this.game.state?.data?.avatar?.displayName ?? 'You',
      resourceId,
      config,
      event,
      offsetSeconds,
    });
  }

  captureRemote(data = {}, playerId = 'remote') {
    if (data.sceneId && data.sceneId !== this.game.sceneManager?.current?.definition?.id)
      return false;
    const remote = this.game.multiplayer?.remotePlayers?.get?.(playerId);
    return this.capture({
      playerId,
      playerName: remote?.avatar?.displayName ?? 'Guest musician',
      resourceId: data.resourceId ?? 'remote-instrument',
      config: data.config ?? {},
      event: data.event ?? {},
      source: 'spectra-collaborative-capture',
    });
  }

  stop({ commit = true } = {}) {
    if (!this.armed) return [];
    this.armed = false;
    this.recording = false;
    this.game.spectraTransport?.release?.(this.transportOwner);
    if (!commit) {
      this.lanes.clear();
      return [];
    }

    const session = this.game.studio;
    const duration = loopSeconds(session);
    const committed = [];
    for (const lane of this.lanes.values()) {
      if (!lane.events.length) continue;
      const kind = kindFor(lane.config);
      const target = session.stems.find((stem) => stem.id === lane.targetStemId);
      const label = target?.label || `${lane.playerName} · ${lane.config.label || kind}`;
      const stem = target ?? session.addTake(kind, label, lane.source, lane.config.processing);
      stem.source = lane.source;
      stem.processing = lane.config.processing ? { ...lane.config.processing } : stem.processing;
      stem.monitor = true;
      stem.clipActive = true;
      stem.clipStart = 0;
      session.recordings?.delete?.(stem.id);
      session.recordingBlobs?.delete?.(stem.id);
      session.attachPerformance(stem.id, {
        mode: lane.config.mode,
        label,
        baseMidi: 48,
        wave: lane.config.wave,
        volume: lane.config.volume,
        noteDuration: lane.config.duration,
        octaveLayer: lane.config.octaveLayer,
        bpm: session.bpm,
        duration,
        events: lane.events.map((event) => ({ ...event })),
      });
      committed.push(stem);
    }
    this.lastCommitted = committed;
    this.lanes.clear();
    if (committed.length) {
      this.game.save?.();
      this.game.studioPlayback?.updateMix?.(session);
    }
    return committed;
  }
}
