const INSTRUMENT_ACTIONS = new Set([
  'drums',
  'piano',
  'synth',
  'instruments',
  'amps',
  'modularSynth',
  'drumMachine',
]);
const midiToFrequency = (midi) => 440 * Math.pow(2, (Number(midi) - 69) / 12);

function playDrum(audio, name, gain = 1) {
  const level = Math.max(0, Math.min(1, Number(gain) || 0));
  if (!(level > 0)) return;
  if (name === 'kick') audio.kick(0, 0.22 * level);
  else if (name === 'snare') {
    audio.tone(185, 0.09, 'triangle', 0.075 * level);
    audio.hat(0.008, 0.07 * level);
  } else if (name === 'closed-hat') audio.hat(0, 0.07 * level);
  else if (name === 'open-hat') {
    audio.hat(0, 0.07 * level);
    audio.hat(0.065, 0.07 * level);
  } else if (name === 'low-tom') audio.tone(112, 0.22, 'sine', 0.1 * level);
  else if (name === 'high-tom') audio.tone(176, 0.18, 'sine', 0.085 * level);
  else if (name === 'crash') {
    audio.hat(0, 0.07 * level);
    audio.hat(0.04, 0.07 * level);
    audio.hat(0.09, 0.07 * level);
    audio.tone(420, 0.34, 'triangle', 0.035 * level);
  }
}

export class InstrumentSync {
  constructor(client) {
    this.client = client;
    this.game = client.game;
    this.world = client.world;
    this.performance = this.game.keyboardPerformance;
    this.activeResourceId = null;
    this.disposed = false;
    this.multiplayerTrace = [];
    this.traceSequence = 0;
    this.publishAttemptSequence = 0;
    this.patchInteractionOwnership();
    this.patchPerformance();
    this.patchIncomingEvents();
  }

  trace(event, detail = {}) {
    const entry = {
      seq: ++this.traceSequence,
      event,
      at: Date.now(),
      localId: this.client.localId ?? null,
      joined: this.client.joined === true,
      activeResourceId: this.activeResourceId,
      activeResourceOwned: this.activeResourceId ? this.world.owns(this.activeResourceId) : false,
      ...detail,
    };
    this.multiplayerTrace.push(entry);
    if (this.multiplayerTrace.length > 240) this.multiplayerTrace.shift();
    return entry;
  }

  diagnosticReport() {
    return this.multiplayerTrace.map((entry) => JSON.stringify(entry)).join('\n');
  }

  clearDiagnosticReport() {
    this.multiplayerTrace.length = 0;
    this.traceSequence = 0;
  }

  appendDiagnosticControls() {
    const ui = this.client.ui;
    const container = ui?.buttons;
    const document = ui?.document;
    if (!container?.appendChild || !document?.createElement) return false;
    if (container.querySelector?.('.spectra-instrument-multiplayer-diagnostics')) return true;

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'spectra-instrument-multiplayer-diagnostics';
    copy.textContent = 'COPY MULTIPLAYER RECORDING DIAGNOSTICS';
    copy.onclick = async () => {
      const report = this.diagnosticReport() || 'No multiplayer instrument events yet.';
      try {
        await globalThis.navigator?.clipboard?.writeText?.(report);
        ui.warning?.('Instrument multiplayer diagnostics copied. Paste them into the chat.');
      } catch {
        globalThis.prompt?.('Copy multiplayer instrument diagnostics:', report);
      }
    };

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'spectra-instrument-multiplayer-diagnostics-clear';
    clear.textContent = 'CLEAR MULTIPLAYER RECORDING DIAGNOSTICS';
    clear.onclick = () => {
      this.clearDiagnosticReport();
      ui.warning?.('Instrument multiplayer diagnostics cleared.');
    };

    container.appendChild(copy);
    container.appendChild(clear);
    return true;
  }

  patchInteractionOwnership() {
    const baseUseTarget = this.world.useTarget.bind(this.world);
    this.world.useTarget = async (target, action) => {
      const resourceId = this.world.resourceForTarget(target);
      const used = await baseUseTarget(target, action);
      if (used && resourceId && INSTRUMENT_ACTIONS.has(target?.action)) {
        this.activeResourceId = resourceId;
        this.trace('instrument:claimed', {
          resourceId,
          targetAction: target?.action ?? null,
          targetId: target?.id ?? null,
        });
        this.appendDiagnosticControls();
      } else if (resourceId && INSTRUMENT_ACTIONS.has(target?.action)) {
        this.trace('instrument:claim-failed', {
          resourceId,
          targetAction: target?.action ?? null,
          targetId: target?.id ?? null,
        });
      }
      return used;
    };
  }

  configSnapshot() {
    const config = this.performance?.config;
    if (!config) return null;
    return {
      mode: config.mode,
      wave: config.wave,
      volume: config.volume,
      duration: config.duration,
      octaveLayer: config.octaveLayer === true,
      label: config.label,
      stemKind: config.stemKind,
      inputKey: config.inputKey,
      processing: config.processing,
      instrumentVoice: config.instrumentVoice,
      ampCharacter: config.ampCharacter,
    };
  }

  canPublish() {
    return (
      !this.disposed &&
      this.client.joined &&
      this.activeResourceId &&
      this.world.owns(this.activeResourceId)
    );
  }

  publishWithConfig(
    config,
    event,
    { resourceId = this.activeResourceId, offsetSeconds = 0, captureLocal = true } = {},
  ) {
    const attemptSequence = ++this.publishAttemptSequence;
    if (!config) {
      this.trace('publish:rejected-no-config', {
        resourceId,
        eventType: event?.type ?? null,
        attemptSequence,
      });
      return false;
    }

    let localCaptured = null;
    if (captureLocal) {
      localCaptured =
        this.game.spectraRecorder?.captureLocal?.(config, event, {
          resourceId: resourceId ?? 'local-instrument',
          offsetSeconds,
        }) ?? false;
    }

    const rejectReason = this.disposed
      ? 'disposed'
      : !this.client.joined
        ? 'not-joined'
        : !resourceId
          ? 'no-resource'
          : !this.world.owns(resourceId)
            ? 'resource-not-owned'
            : null;
    if (rejectReason) {
      this.trace('publish:rejected', {
        reason: rejectReason,
        resourceId,
        eventType: event?.type ?? null,
        midi: Number.isFinite(Number(event?.midi)) ? Number(event.midi) : null,
        drum: event?.name ?? null,
        inputKey: config?.inputKey ?? null,
        mode: config?.mode ?? null,
        localCaptured,
        attemptSequence,
      });
      return false;
    }

    const claim = this.world.localClaims?.get?.(resourceId);
    const playerPosition = this.game.player?.position;
    const position =
      claim?.position ??
      (playerPosition ? [playerPosition.x, playerPosition.y, playerPosition.z] : null);
    const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const sent = this.client.send({
      type: 'object_update',
      objectId: 'live-instrument-event',
      data: {
        nonce,
        attemptSequence,
        resourceId,
        sceneId: this.game.sceneManager.current?.definition?.id,
        position,
        config,
        event,
      },
    });
    this.trace(sent ? 'publish:sent' : 'publish:send-failed', {
      nonce,
      attemptSequence,
      resourceId,
      eventType: event?.type ?? null,
      midi: Number.isFinite(Number(event?.midi)) ? Number(event.midi) : null,
      drum: event?.name ?? null,
      inputKey: config?.inputKey ?? null,
      mode: config?.mode ?? null,
      localCaptured,
    });
    return sent;
  }

  publish(event) {
    return this.publishWithConfig(this.configSnapshot(), event, {
      resourceId: this.activeResourceId,
      captureLocal: false,
    });
  }

  publishExternal(config, event, options = {}) {
    return this.publishWithConfig(config, event, options);
  }

  patchPerformance() {
    if (!this.performance || this.performance._multiplayerInstrumentSync) return;
    this.performance._multiplayerInstrumentSync = true;

    const basePlayMidi = this.performance.playMidi.bind(this.performance);
    this.performance.playMidi = (midi) => {
      const played = basePlayMidi(midi);
      if (played) this.publish({ type: 'midi', midi: Number(midi) });
      return played;
    };

    const baseTriggerDrum = this.performance.triggerDrum.bind(this.performance);
    this.performance.triggerDrum = (name) => {
      const played = baseTriggerDrum(name);
      if (played) this.publish({ type: 'drum', name });
      return played;
    };

    if (typeof this.performance.strumChord === 'function') {
      const baseStrumChord = this.performance.strumChord.bind(this.performance);
      this.performance.strumChord = (midis, direction = 'down') => {
        const played = baseStrumChord(midis, direction);
        if (played)
          this.publish({
            type: 'chord',
            midis: Array.isArray(midis) ? midis.map(Number).slice(0, 8) : [],
            direction,
          });
        return played;
      };
    }
  }

  patchIncomingEvents() {
    const baseHandle = this.world.handleObjectState.bind(this.world);
    this.world.handleObjectState = (message) => {
      baseHandle(message);
      if (
        message.objectId === 'live-instrument-event' &&
        message.by !== this.client.localId &&
        message.data?.event
      ) {
        this.trace('remote:received', {
          fromId: message.by ?? null,
          nonce: message.data?.nonce ?? null,
          attemptSequence: Number(message.data?.attemptSequence) || null,
          resourceId: message.data?.resourceId ?? null,
          eventType: message.data?.event?.type ?? null,
          midi: Number.isFinite(Number(message.data?.event?.midi))
            ? Number(message.data.event.midi)
            : null,
          drum: message.data?.event?.name ?? null,
          inputKey: message.data?.config?.inputKey ?? null,
          mode: message.data?.config?.mode ?? null,
        });
        const captured =
          this.game.spectraRecorder?.captureRemote?.(message.data, message.by) ?? false;
        this.trace(captured ? 'remote:captured' : 'remote:not-captured', {
          fromId: message.by ?? null,
          nonce: message.data?.nonce ?? null,
          attemptSequence: Number(message.data?.attemptSequence) || null,
          resourceId: message.data?.resourceId ?? null,
        });
        this.playRemote(message.data);
      }
    };
  }

  remoteGain(data) {
    const sceneId = this.game.sceneManager.current?.definition?.id;
    if (!sceneId || !data?.sceneId || sceneId !== data.sceneId) return 0;
    const listener = this.game.player?.position;
    const source = data.position;
    if (!listener || !Array.isArray(source) || source.length < 3) return 0.55;
    const dx = listener.x - Number(source[0]);
    const dy = listener.y - Number(source[1]);
    const dz = listener.z - Number(source[2]);
    const distance = Math.hypot(dx, dy, dz);
    if (distance >= 28) return 0;
    if (distance <= 1.5) return 1;
    return Math.max(0.04, 1 / (1 + Math.pow((distance - 1.5) / 6.5, 1.35)));
  }

  playRemote(data) {
    const { config = {}, event = {} } = data;
    const audio = this.game.audio;
    if (!audio) return;
    const remoteGain = this.remoteGain(data);
    if (!(remoteGain > 0)) return;
    if (
      this.game.studioPlayback?.monitorLiveEvent?.(this.game.studio, config, event, {
        resourceId: data.resourceId ?? 'remote-instrument',
        level: remoteGain,
      })
    )
      return;
    if (event.type === 'drum') {
      const machineVoice = /^(808|909|dmx|linn)-/i.test(String(event.name || ''));
      if (machineVoice && this.game.studioPlayback?.playDrumEvent) {
        this.game.studioPlayback.playDrumEvent(event.name, 0, remoteGain);
      } else {
        playDrum(audio, event.name, remoteGain);
      }
      return;
    }

    const playMidi = (midi, when = 0) => {
      const frequency = midiToFrequency(midi);
      if (config.mode === 'guitar' || config.mode === 'bass') {
        audio.pluckedString?.(frequency, {
          mode: config.mode,
          voice: config.instrumentVoice,
          amp: config.ampCharacter,
          volume:
            (config.mode === 'bass'
              ? Math.max(0.085, Number(config.volume) || 0.085)
              : Math.max(0.065, Number(config.volume) || 0.065)) * remoteGain,
          duration: config.mode === 'bass' ? 1.55 : 1.22,
          when,
        });
        return;
      }
      audio.tone(
        frequency,
        Number(config.duration) || 0.42,
        config.wave || 'triangle',
        (Number(config.volume) || 0.065) * remoteGain,
        when,
      );
      if (config.octaveLayer) {
        audio.tone(
          frequency * 2,
          (Number(config.duration) || 0.42) * 0.72,
          'triangle',
          (Number(config.volume) || 0.065) * 0.22 * remoteGain,
          when + 0.012,
        );
      }
    };

    if (event.type === 'midi') playMidi(event.midi);
    else if (event.type === 'chord') {
      const notes =
        event.direction === 'up' ? [...(event.midis ?? [])].reverse() : (event.midis ?? []);
      notes.forEach((midi, index) =>
        playMidi(midi, index * (config.mode === 'bass' ? 0.032 : 0.021)),
      );
    }
  }

  update() {
    if (this.activeResourceId && !this.world.owns(this.activeResourceId)) {
      this.trace('instrument:ownership-lost', { resourceId: this.activeResourceId });
      this.activeResourceId = null;
    }
  }

  dispose() {
    this.disposed = true;
    this.activeResourceId = null;
  }
}
