const INSTRUMENT_ACTIONS = new Set(['drums', 'piano', 'synth', 'instruments', 'amps']);
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
    this.patchInteractionOwnership();
    this.patchPerformance();
    this.patchIncomingEvents();
  }

  patchInteractionOwnership() {
    const baseUseTarget = this.world.useTarget.bind(this.world);
    this.world.useTarget = async (target, action) => {
      const resourceId = this.world.resourceForTarget(target);
      const used = await baseUseTarget(target, action);
      if (used && resourceId && INSTRUMENT_ACTIONS.has(target?.action)) {
        this.activeResourceId = resourceId;
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

  publish(event) {
    const config = this.configSnapshot();
    if (!config || !this.canPublish()) return;
    const claim = this.world.localClaims?.get?.(this.activeResourceId);
    const playerPosition = this.game.player?.position;
    const position =
      claim?.position ??
      (playerPosition ? [playerPosition.x, playerPosition.y, playerPosition.z] : null);
    this.client.send({
      type: 'object_update',
      objectId: 'live-instrument-event',
      data: {
        nonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        resourceId: this.activeResourceId,
        sceneId: this.game.sceneManager.current?.definition?.id,
        position,
        config,
        event,
      },
    });
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
    if (event.type === 'drum') {
      playDrum(audio, event.name, remoteGain);
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
      this.activeResourceId = null;
    }
  }

  dispose() {
    this.disposed = true;
    this.activeResourceId = null;
  }
}
