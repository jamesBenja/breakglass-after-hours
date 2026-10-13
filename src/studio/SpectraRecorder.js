import { spectraInputStems } from './SpectraInputs.js';

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
    this.armedServerAt = 0;
    this.lanes = new Map();
    this.lastCommitted = [];
    this.transportOwner = 'spectra-recorder';
    this.multiplayerTrace = [];
    this.traceSequence = 0;
  }

  trace(event, detail = {}) {
    const entry = {
      seq: ++this.traceSequence,
      event,
      at: Date.now(),
      armed: this.armed,
      recording: this.recording,
      visibilityState: globalThis.document?.visibilityState ?? null,
      documentHidden: globalThis.document?.hidden === true,
      armedStemIds: this.game.studio?.armedStems?.().map((stem) => stem.id) ?? [],
      laneEventCounts: Object.fromEntries(
        [...this.lanes.entries()].map(([id, lane]) => [id, lane.events.length]),
      ),
      ...detail,
    };
    this.multiplayerTrace.push(entry);
    if (this.multiplayerTrace.length > 200) this.multiplayerTrace.shift();
    return entry;
  }

  diagnosticReport() {
    return this.multiplayerTrace.map((entry) => JSON.stringify(entry)).join('\n');
  }

  clearDiagnosticReport() {
    this.multiplayerTrace.length = 0;
    this.traceSequence = 0;
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
    this.startedAt = clockNow();
    this.transportOrigin = 0;
    this.armedServerAt = this.game.multiplayer?.serverNow?.() ?? Date.now();
    this.lanes.clear();
    this.lastCommitted = [];
    this.trace('record:armed');
    const transport = this.game.spectraTransport;
    transport?.acquire?.(this.transportOwner, { position: 0 });
    this.transportOrigin = transport?.absolutePosition?.() ?? 0;
    return this.status();
  }

  cancel() {
    this.armed = false;
    this.recording = false;
    this.startedAt = 0;
    this.transportOrigin = 0;
    this.armedServerAt = 0;
    this.lanes.clear();
    this.game.spectraTransport?.release?.(this.transportOwner);
    return true;
  }

  beginOnFirstEvent(offsetSeconds = 0) {
    if (!this.armed) return false;
    if (this.recording) return true;
    const offset = Math.max(0, Number(offsetSeconds) || 0);
    this.recording = true;
    // Recording time is anchored when RECORD is pressed, not on the first played note. This keeps
    // live overdubs phase-aligned with Drum Machine, Modular and any already-playing Spectra loop.
    if (!(this.startedAt > 0)) this.startedAt = clockNow() + offset * 1000;
    return true;
  }

  eventTime(offsetSeconds = 0) {
    const offset = Math.max(0, Number(offsetSeconds) || 0);
    const session = this.game.studio;
    const transport = this.game.spectraTransport;
    if (transport?.running) {
      return transport.quantizeTime(transport.positionAtOffset(offset), {
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

  remoteEventTime(performedAt) {
    const remoteTime = Number(performedAt);
    if (!(remoteTime > 0) || !(this.armedServerAt > 0)) return null;
    const elapsed = Math.max(0, (remoteTime - this.armedServerAt) / 1000);
    const session = this.game.studio;
    const transport = this.game.spectraTransport;
    if (transport?.running) {
      return transport.quantizeTime(this.transportOrigin + elapsed, {
        wrap: true,
        includeSwing: true,
      });
    }
    const loop = loopSeconds(session);
    const position = this.transportOrigin + elapsed;
    if (loop > 0) return ((position % loop) + loop) % loop;
    return position;
  }

  capture({
    playerId = 'local',
    playerName = 'Player',
    resourceId = 'instrument',
    config = {},
    event = {},
    offsetSeconds = 0,
    eventTimeOverride = null,
    source = 'spectra-live-capture',
  } = {}) {
    if (!this.armed) {
      this.trace('capture:rejected-not-armed', {
        playerId,
        resourceId,
        eventType: event?.type ?? null,
        midi: Number.isFinite(Number(event?.midi)) ? Number(event.midi) : null,
      });
      return false;
    }
    const hasTrackArmModel = typeof this.game.studio?.armedStems === 'function';
    const targetStems = hasTrackArmModel
      ? spectraInputStems(this.game.studio, config, resourceId, { armedOnly: true })
      : [];
    if (hasTrackArmModel && !targetStems.length) {
      this.trace('capture:rejected-no-target', {
        playerId,
        resourceId,
        inputKey: config?.inputKey ?? null,
        mode: config?.mode ?? null,
        eventType: event?.type ?? null,
        midi: Number.isFinite(Number(event?.midi)) ? Number(event.midi) : null,
      });
      return false;
    }
    this.beginOnFirstEvent(offsetSeconds);

    const targets = hasTrackArmModel ? targetStems : [null];
    const hasEventTimeOverride = eventTimeOverride != null;
    const override = hasEventTimeOverride ? Number(eventTimeOverride) : Number.NaN;
    const eventTime =
      Number.isFinite(override) && override >= 0 ? override : this.eventTime(offsetSeconds);
    const capturedEvents = eventsForCapture(event);
    this.trace('capture:accepted', {
      playerId,
      resourceId,
      inputKey: config?.inputKey ?? null,
      mode: config?.mode ?? null,
      eventType: event?.type ?? null,
      midi: Number.isFinite(Number(event?.midi)) ? Number(event.midi) : null,
      eventTime,
      targetStemIds: targetStems.map((stem) => stem.id),
    });

    for (const targetStem of targets) {
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
            inputKey: config.inputKey ?? null,
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
      for (const captured of capturedEvents) {
        const { delay = 0, ...performanceEvent } = captured;
        lane.events.push({ time: eventTime + delay, ...performanceEvent });
      }
      if (lane.events.length > 512) lane.events.splice(0, lane.events.length - 512);
    }
    this.trace('capture:stored', {
      playerId,
      resourceId,
      storedEvents: capturedEvents.length,
    });
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
    this.trace('remote:event', {
      playerId,
      nonce: data?.nonce ?? null,
      resourceId: data?.resourceId ?? null,
      sceneId: data?.sceneId ?? null,
      eventType: data?.event?.type ?? null,
      midi: Number.isFinite(Number(data?.event?.midi)) ? Number(data.event.midi) : null,
    });
    if (data.sceneId && data.sceneId !== this.game.sceneManager?.current?.definition?.id) {
      this.trace('remote:rejected-scene', {
        playerId,
        nonce: data?.nonce ?? null,
        sceneId: data?.sceneId ?? null,
      });
      return false;
    }
    const remote = this.game.multiplayer?.remotePlayers?.get?.(playerId);
    const performerTime = this.remoteEventTime(data.performedAt);
    this.trace('remote:timing', {
      playerId,
      nonce: data?.nonce ?? null,
      performedAt: Number(data?.performedAt) || null,
      armedServerAt: this.armedServerAt || null,
      transportOrigin: this.transportOrigin,
      performerTime,
    });
    return this.capture({
      playerId,
      playerName: remote?.avatar?.displayName ?? 'Guest musician',
      resourceId: data.resourceId ?? 'remote-instrument',
      config: data.config ?? {},
      event: data.event ?? {},
      eventTimeOverride: performerTime,
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
      this.armedServerAt = 0;
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
    this.trace('record:commit', {
      committed: committed.map((stem) => ({
        id: stem.id,
        label: stem.label,
        eventCount: stem.performance?.events?.length ?? 0,
      })),
    });
    this.lastCommitted = committed;
    this.lanes.clear();
    this.armedServerAt = 0;
    if (committed.length) {
      this.game.save?.();
      this.game.studioPlayback?.updateMix?.(session);
    }
    return committed;
  }
}
