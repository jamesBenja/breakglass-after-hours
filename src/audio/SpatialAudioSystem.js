import { Vector3 } from 'three';
import { TAKE_A_BREAK_SPEAKERS } from '../gameplay/TakeABreakImmersiveSystem.js';
import {
  DEFAULT_INSTALLATION_PROGRAM_ID,
  INSTALLATION_PROGRAMS,
  availableInstallationPrograms,
  installationProgramById,
} from './InstallationPrograms.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const INSTALLATION_VOICES = Object.freeze([
  { lfo: 0.071, layer: 'low' },
  { lfo: 0.053, layer: 'low' },
  { lfo: 0.043, layer: 'texture' },
  { lfo: 0.061, layer: 'texture' },
  { lfo: 0.037, layer: 'texture' },
  { lfo: 0.047, layer: 'air' },
  { lfo: 0.059, layer: 'air' },
  { lfo: 0.041, layer: 'air' },
]);

const INSTALLATION_EMITTERS = Object.freeze(
  TAKE_A_BREAK_SPEAKERS.map((position, index) => ({
    position,
    ...INSTALLATION_VOICES[index],
  })),
);

const DEFAULT_INSTALLATION_MIX = Object.freeze({
  low: 0.78,
  texture: 0.8,
  air: 0.7,
  motion: 0.72,
  space: 0.62,
});

function createNoiseBuffer(context, seconds = 4) {
  if (typeof context.createBuffer !== 'function' || !Number.isFinite(context.sampleRate))
    return null;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < channel.length; index++) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.86 + white * 0.14;
    channel[index] = white * 0.58 + previous * 0.42;
  }
  return buffer;
}

/**
 * Eight-position binaural/spatial installation system for Take A Break.
 *
 * The room behaves like a small digital sound gallery. One fixed eight-speaker virtual array can
 * present different programs without changing the room geometry. Procedural studies are included
 * now; recorded ambisonic works and guest compositions can be attached to the same catalog later.
 */
export class SpatialAudioSystem {
  constructor(audio) {
    this.audio = audio;
    this.installationEnabled = true;
    this.installationFocus = false;
    this.installationMix = { ...DEFAULT_INSTALLATION_MIX };
    this.installationProgramId = DEFAULT_INSTALLATION_PROGRAM_ID;
    this.installationLevel = 1.15;
    this.installationBus = null;
    this.installationFilter = null;
    this.installationDry = null;
    this.installationDelay = null;
    this.installationFeedback = null;
    this.installationWet = null;
    this.installationLimiter = null;
    this.installationOutput = null;
    this.emitters = [];
    this.noiseBuffer = null;
    this.lastEnvironmentKey = '';
    this.forward = new Vector3();
    this.elapsed = 0;
  }

  setParam(parameter, value, timeConstant = 0.08) {
    if (!parameter || !this.audio.context) return;
    if (typeof parameter.setTargetAtTime === 'function')
      parameter.setTargetAtTime(value, this.audio.context.currentTime, timeConstant);
    else parameter.value = value;
  }

  installationProgram() {
    return installationProgramById(this.installationProgramId);
  }

  ensureInstallation() {
    const context = this.audio.context;
    if (!context || this.installationBus) return;
    this.installationBus = context.createGain();
    this.installationBus.gain.value = 0;

    this.installationFilter = context.createBiquadFilter?.() ?? null;
    this.installationDry = context.createGain();
    this.installationLimiter = context.createDynamicsCompressor?.() ?? null;
    this.installationOutput = context.createGain();
    this.installationOutput.gain.value = 0.78;
    this.installationOutput.connect(context.destination);
    const output = this.installationLimiter ?? this.installationOutput;
    if (this.installationLimiter) {
      this.installationLimiter.threshold.value = -8;
      this.installationLimiter.knee.value = 10;
      this.installationLimiter.ratio.value = 6;
      this.installationLimiter.attack.value = 0.005;
      this.installationLimiter.release.value = 0.24;
      this.installationLimiter.connect(this.installationOutput);
    }

    if (this.installationFilter) {
      this.installationFilter.type = 'lowpass';
      this.installationFilter.frequency.value = 18500;
      this.installationBus.connect(this.installationFilter);
      this.installationFilter.connect(this.installationDry);
    } else this.installationBus.connect(this.installationDry);
    this.installationDry.connect(output);

    if (typeof context.createDelay === 'function') {
      this.installationDelay = context.createDelay(1.6);
      this.installationFeedback = context.createGain();
      this.installationWet = context.createGain();
      const source = this.installationFilter ?? this.installationBus;
      source.connect(this.installationDelay);
      this.installationDelay.connect(this.installationWet);
      this.installationWet.connect(output);
      this.installationDelay.connect(this.installationFeedback);
      this.installationFeedback.connect(this.installationDelay);
    }

    this.noiseBuffer = createNoiseBuffer(context);

    for (let index = 0; index < INSTALLATION_EMITTERS.length; index++) {
      const config = INSTALLATION_EMITTERS[index];
      const speakerGain = context.createGain();
      const toneSource = context.createOscillator();
      const toneGain = context.createGain();
      const lfo = context.createOscillator();
      const depth = context.createGain();
      const panner = typeof context.createPanner === 'function' ? context.createPanner() : null;
      const noiseSource = this.noiseBuffer && context.createBufferSource?.();
      const noiseFilter = noiseSource && context.createBiquadFilter?.();
      const noiseGain = noiseSource ? context.createGain() : null;

      speakerGain.gain.value = 0.0001;
      toneSource.type = 'sine';
      toneSource.frequency.value = 110;
      toneGain.gain.value = 0.001;
      lfo.frequency.value = config.lfo;
      depth.gain.value = 3;
      lfo.connect(depth);
      depth.connect(toneSource.detune);
      toneSource.connect(toneGain);
      toneGain.connect(speakerGain);

      if (noiseSource && noiseGain) {
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.loop = true;
        noiseGain.gain.value = 0;
        if (noiseFilter) {
          noiseFilter.type = 'lowpass';
          noiseFilter.frequency.value = 4000;
          noiseFilter.Q.value = 0.7;
          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
        } else noiseSource.connect(noiseGain);
        noiseGain.connect(speakerGain);
      }

      if (panner) {
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.65;
        panner.maxDistance = 9;
        panner.rolloffFactor = 0.72;
        const [x, y, z] = config.position;
        if (panner.positionX) {
          panner.positionX.value = x;
          panner.positionY.value = y;
          panner.positionZ.value = z;
        } else panner.setPosition?.(x, y, z);
        speakerGain.connect(panner);
        panner.connect(this.installationBus);
      } else speakerGain.connect(this.installationBus);

      toneSource.start();
      lfo.start();
      noiseSource?.start();
      this.emitters.push({
        toneSource,
        toneGain,
        noiseSource,
        noiseFilter,
        noiseGain,
        speakerGain,
        lfo,
        depth,
        panner,
        config,
        index,
      });
    }
    this.applyInstallationProgram();
    this.applyInstallationMix();
  }

  applyInstallationProgram() {
    if (!this.audio.context) return;
    const program = this.installationProgram();
    for (const emitter of this.emitters) {
      const index = emitter.index;
      const frequency = program.toneFrequencies?.[index] ?? 110;
      const wave = program.toneWaves?.[index] ?? 'sine';
      emitter.toneSource.type = wave;
      this.setParam(emitter.toneSource.frequency, frequency, 0.18);
      this.setParam(emitter.toneGain.gain, 0.06 * (program.toneLevel ?? 0), 0.22);
      if (emitter.noiseGain)
        this.setParam(emitter.noiseGain.gain, 0.055 * (program.noiseLevel ?? 0), 0.22);
      if (emitter.noiseFilter) {
        emitter.noiseFilter.type = program.noiseFilter ?? 'lowpass';
        const spread = program.noiseSpread ?? 0;
        const offset = (index / Math.max(1, this.emitters.length - 1) - 0.5) * spread;
        this.setParam(
          emitter.noiseFilter.frequency,
          Math.max(120, (program.noiseFrequency ?? 4000) + offset),
          0.22,
        );
        this.setParam(emitter.noiseFilter.Q, program.noiseFilter === 'bandpass' ? 1.4 : 0.7, 0.22);
      }
    }
    if (this.installationFilter)
      this.setParam(this.installationFilter.frequency, program.lowpassHz ?? 18000, 0.22);
    this.applyInstallationMix();
  }

  applyInstallationMix() {
    if (!this.audio.context) return;
    const motion = this.installationMix.motion;
    const program = this.installationProgram();
    for (const emitter of this.emitters) {
      this.setParam(emitter.depth.gain, 2 + motion * 12 * (program.movementDepth ?? 1), 0.12);
      this.setParam(
        emitter.lfo.frequency,
        emitter.config.lfo * (0.55 + motion * 1.55) * (program.movementRate ?? 1),
        0.12,
      );
    }
    if (this.installationDelay) {
      const space = clamp(this.installationMix.space * (program.space ?? 0.6), 0, 1);
      this.setParam(this.installationDelay.delayTime, 0.11 + space * 0.54, 0.12);
      this.setParam(this.installationFeedback.gain, 0.1 + space * 0.46, 0.12);
      this.setParam(this.installationWet.gain, 0.16 + space * 0.62, 0.12);
    }
    if (this.installationDry) this.setParam(this.installationDry.gain, 1.12, 0.12);
  }

  updateInstallationField(active) {
    const motion = this.installationMix.motion;
    const program = this.installationProgram();
    const rate = program.movementRate ?? 1;
    const depth = program.movementDepth ?? 1;
    for (let index = 0; index < this.emitters.length; index++) {
      const emitter = this.emitters[index];
      const layer = this.installationMix[emitter.config.layer] ?? 0.75;
      const a = (Math.sin(this.elapsed * (0.28 + motion * 0.3) * rate - index * 0.82) + 1) * 0.5;
      const b = (Math.sin(this.elapsed * 0.17 * rate + index * 1.91) + 1) * 0.5;
      const c = (Math.sin(this.elapsed * (0.49 + motion * 0.24) * rate - index * 0.37) + 1) * 0.5;
      const circulation = 0.32 + (a * 0.42 + b * 0.18 + c * 0.16) * depth;
      const focus = this.installationFocus ? 1.12 : 1;
      const target = active ? (0.2 + layer * 0.42) * circulation * focus : 0.0001;
      this.setParam(emitter.speakerGain.gain, target, 0.13);
      this.setParam(
        emitter.toneSource.detune,
        active ? Math.sin(this.elapsed * 0.11 * rate + index) * (5 + motion * 11) * depth : 0,
        0.18,
      );
    }
  }

  setInstallationProgram(id) {
    const program = INSTALLATION_PROGRAMS.find((candidate) => candidate.id === id);
    if (!program?.available) return null;
    this.installationProgramId = program.id;
    this.applyInstallationProgram();
    return program;
  }

  setInstallationLevel(value) {
    this.installationLevel = clamp(value, 0.35, 1.6);
    return this.installationLevel;
  }

  adjustInstallationLevel(amount) {
    return this.setInstallationLevel(this.installationLevel + amount);
  }

  setInstallationFocus(active) {
    this.installationFocus = !!active;
    this.installationEnabled = true;
    this.lastEnvironmentKey = '';
    return this.installationFocus;
  }

  adjustInstallation(parameter, amount) {
    if (!(parameter in this.installationMix)) return null;
    this.installationMix[parameter] = clamp(this.installationMix[parameter] + amount, 0, 1);
    this.applyInstallationMix();
    return this.installationMix[parameter];
  }

  resetInstallationMix() {
    this.installationMix = { ...DEFAULT_INSTALLATION_MIX };
    this.installationLevel = 1.15;
    this.applyInstallationMix();
    return { ...this.installationMix };
  }

  updateListener(player, camera) {
    const context = this.audio.context;
    if (!context) return;
    const listener = context.listener;
    const { x, y, z } = player.position;
    if (listener.positionX) {
      this.setParam(listener.positionX, x, 0.025);
      this.setParam(listener.positionY, y + 1.35, 0.025);
      this.setParam(listener.positionZ, z, 0.025);
    } else listener.setPosition?.(x, y + 1.35, z);

    camera?.camera?.getWorldDirection?.(this.forward);
    if (!Number.isFinite(this.forward.x)) this.forward.set(0, 0, -1);
    if (listener.forwardX) {
      this.setParam(listener.forwardX, this.forward.x, 0.025);
      this.setParam(listener.forwardY, this.forward.y, 0.025);
      this.setParam(listener.forwardZ, this.forward.z, 0.025);
      this.setParam(listener.upX, 0, 0.025);
      this.setParam(listener.upY, 1, 0.025);
      this.setParam(listener.upZ, 0, 0.025);
    } else listener.setOrientation?.(this.forward.x, this.forward.y, this.forward.z, 0, 1, 0);
  }

  environmentFor(level, surfaceId) {
    const owner = this.audio.activeExternalTransport?.owner;
    if (level.definition.id === 'alley')
      return { gain: 0.3, lowpassHz: 1700, label: 'outside · club through walls/door' };

    if (level.definition.id === 'downstairs') {
      if (surfaceId === 'club') return { gain: 1, lowpassHz: 20000, label: 'club floor' };
      if (surfaceId === 'lounge' || surfaceId === 'lounge-door') {
        if (this.installationFocus)
          return {
            gain: 0.025,
            lowpassHz: 520,
            label: 'Take A Break · installation focus · club far through wall',
          };
        return {
          gain: 0.045,
          lowpassHz: 780,
          label: 'Take A Break · immersive installation · club through wall',
        };
      }
      if (surfaceId === 'service' || surfaceId === 'bar-door')
        return { gain: 0.72, lowpassHz: 6200, label: 'bar / service room' };
      if (surfaceId === 'storage')
        return { gain: 0.57, lowpassHz: 3900, label: 'downstairs storage' };
      if (surfaceId === 'coat-check')
        return { gain: 0.63, lowpassHz: 4300, label: 'coat check / alley stair' };
      if (surfaceId === 'stair-landing')
        return { gain: 0.5, lowpassHz: 2800, label: 'Clark stair landing' };
      return { gain: 0.78, lowpassHz: 9000, label: 'Below circulation' };
    }

    if (owner === 'dj') return { gain: 0.16, lowpassHz: 1050, label: 'club heard upstairs' };
    if (owner === 'archive') {
      if (surfaceId === 'neve-suite')
        return { gain: 1, lowpassHz: 19000, label: 'Neve tape playback' };
      if (surfaceId === 'mixing-suite')
        return { gain: 0.58, lowpassHz: 5200, label: 'tape through control-room wall' };
      if (surfaceId === 'live-room')
        return { gain: 0.42, lowpassHz: 3600, label: 'tape through studio walls' };
      return { gain: 0.34, lowpassHz: 2600, label: 'archive bleed' };
    }
    if (owner === 'studio') {
      if (surfaceId === 'mixing-suite')
        return { gain: 1, lowpassHz: 20000, label: 'Spectra control room' };
      if (surfaceId === 'live-room')
        return { gain: 0.78, lowpassHz: 12000, label: 'live room monitor bleed' };
      if (surfaceId === 'dead-room') return { gain: 0.62, lowpassHz: 7200, label: 'dead room' };
      if (surfaceId === 'neve-suite') return { gain: 0.52, lowpassHz: 5200, label: 'Neve room' };
      if (surfaceId === 'storage')
        return { gain: 0.32, lowpassHz: 2600, label: 'upstairs storage' };
      return { gain: 0.5, lowpassHz: 4800, label: 'studio hallway' };
    }
    return { gain: 1, lowpassHz: 20000, label: 'upstairs' };
  }

  update(level, player, camera) {
    if (!this.audio.context || !level) return;
    this.elapsed += 1 / 60;
    this.ensureInstallation();
    this.updateListener(player, camera);
    const ground = level.collision.surfaceAt(
      player.position.x,
      player.position.z,
      player.position.y + 0.3,
    );
    const surfaceId = ground?.surface?.id ?? level.definition.id;
    const inLounge =
      level.definition.id === 'downstairs' &&
      (surfaceId === 'lounge' || surfaceId === 'lounge-door');
    if (this.installationFocus && !inLounge) this.installationFocus = false;
    const environment = this.environmentFor(level, surfaceId);
    const key = `${level.definition.id}:${surfaceId}:${this.audio.activeExternalTransport?.owner ?? 'none'}:${this.installationFocus ? 'focus' : 'room'}`;
    if (key !== this.lastEnvironmentKey) {
      this.audio.setEnvironment(environment);
      this.lastEnvironmentKey = key;
    }
    const installationActive = inLounge && this.installationEnabled;
    this.updateInstallationField(installationActive);
    if (this.installationBus) {
      const roomLevel = this.installationFocus ? 1.48 : 1.3;
      this.setParam(
        this.installationBus.gain,
        installationActive ? roomLevel * this.installationLevel : 0,
        0.18,
      );
    }
  }

  toggleInstallation(force) {
    this.installationEnabled = force == null ? !this.installationEnabled : !!force;
    if (!this.installationEnabled) this.installationFocus = false;
    return this.installationEnabled;
  }

  snapshot() {
    const program = this.installationProgram();
    return {
      enabled: this.installationEnabled,
      focus: this.installationFocus,
      level: this.installationLevel,
      mix: { ...this.installationMix },
      environment: { ...this.audio.environment },
      emitters: INSTALLATION_EMITTERS.length,
      program: {
        id: program.id,
        label: program.label,
        artist: program.artist,
        description: program.description,
      },
      programs: availableInstallationPrograms().map(({ id, label, artist, description }) => ({
        id,
        label,
        artist,
        description,
      })),
      catalogSlots: INSTALLATION_PROGRAMS.filter((item) => !item.available).map(
        ({ id, label, artist, description }) => ({ id, label, artist, description }),
      ),
    };
  }

  dispose() {
    for (const emitter of this.emitters) {
      try {
        emitter.toneSource.stop();
        emitter.lfo.stop();
        emitter.noiseSource?.stop();
      } catch {
        // Already stopped.
      }
      emitter.toneSource.disconnect();
      emitter.toneGain.disconnect();
      emitter.noiseSource?.disconnect();
      emitter.noiseFilter?.disconnect();
      emitter.noiseGain?.disconnect();
      emitter.speakerGain.disconnect();
      emitter.lfo.disconnect();
      emitter.depth.disconnect();
      emitter.panner?.disconnect();
    }
    this.emitters = [];
    this.installationFeedback?.disconnect();
    this.installationWet?.disconnect();
    this.installationDelay?.disconnect();
    this.installationDry?.disconnect();
    this.installationFilter?.disconnect();
    this.installationBus?.disconnect();
    this.installationLimiter?.disconnect();
    this.installationOutput?.disconnect();
    this.installationFeedback = null;
    this.installationWet = null;
    this.installationDelay = null;
    this.installationDry = null;
    this.installationFilter = null;
    this.installationBus = null;
    this.installationLimiter = null;
    this.installationOutput = null;
    this.noiseBuffer = null;
  }
}
