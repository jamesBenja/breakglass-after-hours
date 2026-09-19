import { Vector3 } from 'three';
import {
  SPATIAL_TRANSPORT_OWNERS,
  acousticEnvironmentFor,
  acousticEnvironmentKey,
} from './AcousticZones.js';
import {
  TAKE_A_BREAK_SPEAKERS,
  isTakeABreakPosition,
} from '../gameplay/TakeABreakImmersiveSystem.js';
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
    this.recordedGain = null;
    this.installationFeedback = null;
    this.installationWet = null;
    this.installationLimiter = null;
    this.installationOutput = null;
    this.emitters = [];
    this.noiseBuffer = null;
    this.recordedSource = null;
    this.recordedGain = null;
    this.recordedProgramIndex = 0;
    this.recordedGeneration = 0;
    this.spectraPrograms = [];
    this.spectraProgramProvider = null;
    this.spectraSource = null;
    this.spectraSplitter = null;
    this.spectraGeneration = 0;
    this.lastEnvironmentKey = '';
    this.lastSourceEnvironmentKeys = new Map();
    this.forward = new Vector3();
    this.elapsed = 0;
    this.pointMachines = new Map();
    this.pointShots = new Set();
  }

  setParam(parameter, value, timeConstant = 0.08) {
    if (!parameter || !this.audio.context) return;
    if (typeof parameter.setTargetAtTime === 'function')
      parameter.setTargetAtTime(value, this.audio.context.currentTime, timeConstant);
    else parameter.value = value;
  }

  setPannerPosition(panner, position = [0, 0, 0]) {
    if (!panner) return;
    const [x = 0, y = 0, z = 0] = position;
    if (panner.positionX) {
      this.setParam(panner.positionX, x, 0.015);
      this.setParam(panner.positionY, y, 0.015);
      this.setParam(panner.positionZ, z, 0.015);
    } else panner.setPosition?.(x, y, z);
  }

  createPointPanner(position, { refDistance = 1.25, maxDistance = 18, rolloffFactor = 1.1 } = {}) {
    const context = this.audio.context;
    if (!context || typeof context.createPanner !== 'function') return null;
    const panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = rolloffFactor;
    this.setPannerPosition(panner, position);
    return panner;
  }

  setPointMachine(
    owner,
    {
      position = [0, 0, 0],
      baseFrequency = 96,
      secondaryFrequency = 151,
      volume = 0.024,
      pulseRate = 7.6,
      pulseDepth = 0.005,
      wave = 'triangle',
      refDistance = 1.3,
      maxDistance = 18,
      rolloffFactor = 1.05,
    } = {},
  ) {
    const context = this.audio.context;
    if (!context || !this.audio.master || !owner) return false;
    let machine = this.pointMachines.get(owner);

    if (!machine) {
      const base = context.createOscillator();
      const secondary = context.createOscillator();
      const baseGain = context.createGain();
      const secondaryGain = context.createGain();
      const bus = context.createGain();
      const lfo = context.createOscillator();
      const lfoDepth = context.createGain();
      const panner = this.createPointPanner(position, {
        refDistance,
        maxDistance,
        rolloffFactor,
      });

      baseGain.gain.value = 0.78;
      secondaryGain.gain.value = 0.22;
      bus.gain.value = 0.0001;
      lfoDepth.gain.value = 0;
      lfo.type = 'sine';

      base.connect(baseGain);
      secondary.connect(secondaryGain);
      baseGain.connect(bus);
      secondaryGain.connect(bus);
      lfo.connect(lfoDepth);
      lfoDepth.connect(bus.gain);
      if (panner) {
        bus.connect(panner);
        panner.connect(this.audio.master);
      } else bus.connect(this.audio.master);

      base.start();
      secondary.start();
      lfo.start();
      machine = {
        base,
        secondary,
        baseGain,
        secondaryGain,
        bus,
        lfo,
        lfoDepth,
        panner,
      };
      this.pointMachines.set(owner, machine);
    }

    machine.base.type = wave;
    machine.secondary.type = 'sine';
    this.setParam(machine.base.frequency, Math.max(35, Number(baseFrequency) || 96), 0.08);
    this.setParam(
      machine.secondary.frequency,
      Math.max(50, Number(secondaryFrequency) || 151),
      0.08,
    );
    this.setParam(machine.bus.gain, Math.max(0.0001, Number(volume) || 0.024), 0.12);
    this.setParam(machine.lfo.frequency, Math.max(0.05, Number(pulseRate) || 7.6), 0.08);
    this.setParam(machine.lfoDepth.gain, Math.max(0, Number(pulseDepth) || 0), 0.08);
    this.setPannerPosition(machine.panner, position);
    return true;
  }

  stopPointMachine(owner, fade = 0.12) {
    const machine = this.pointMachines.get(owner);
    if (!machine) return false;
    this.pointMachines.delete(owner);
    const context = this.audio.context;
    const now = context?.currentTime ?? 0;
    const duration = Math.max(0, Number(fade) || 0);

    if (machine.bus?.gain) {
      if (machine.bus.gain.cancelScheduledValues) machine.bus.gain.cancelScheduledValues(now);
      if (
        duration > 0 &&
        machine.bus.gain.setValueAtTime &&
        machine.bus.gain.exponentialRampToValueAtTime
      ) {
        machine.bus.gain.setValueAtTime(Math.max(0.0001, machine.bus.gain.value || 0.0001), now);
        machine.bus.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      } else machine.bus.gain.value = 0.0001;
    }

    for (const source of [machine.base, machine.secondary, machine.lfo]) {
      try {
        source.stop(now + duration + 0.02);
      } catch {
        // Already stopped.
      }
    }
    const cleanup = () => {
      machine.base.disconnect?.();
      machine.secondary.disconnect?.();
      machine.lfo.disconnect?.();
      machine.baseGain.disconnect?.();
      machine.secondaryGain.disconnect?.();
      machine.lfoDepth.disconnect?.();
      machine.bus.disconnect?.();
      machine.panner?.disconnect?.();
    };
    if (duration <= 0) cleanup();
    else this.audio.timers?.setTimeout?.(cleanup, (duration + 0.04) * 1000);
    return true;
  }

  pointTone(
    position,
    {
      frequency = 180,
      duration = 0.12,
      volume = 0.08,
      wave = 'triangle',
      when = 0,
      refDistance = 1.2,
      maxDistance = 16,
      rolloffFactor = 1.15,
      endFrequency = null,
    } = {},
  ) {
    const context = this.audio.context;
    if (!context || !this.audio.master) return false;
    const source = context.createOscillator();
    const gain = context.createGain();
    const panner = this.createPointPanner(position, {
      refDistance,
      maxDistance,
      rolloffFactor,
    });
    const time = context.currentTime + Math.max(0, Number(when) || 0);
    const length = Math.max(0.025, Number(duration) || 0.12);
    source.type = wave;
    source.frequency.setValueAtTime?.(Math.max(30, Number(frequency) || 180), time);
    if (source.frequency.value != null && !source.frequency.setValueAtTime)
      source.frequency.value = Math.max(30, Number(frequency) || 180);
    if (endFrequency != null && source.frequency.exponentialRampToValueAtTime)
      source.frequency.exponentialRampToValueAtTime(
        Math.max(30, Number(endFrequency) || frequency),
        time + length,
      );

    gain.gain.setValueAtTime?.(0.0001, time);
    gain.gain.exponentialRampToValueAtTime?.(
      Math.max(0.0002, Number(volume) || 0.08),
      time + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime?.(0.0001, time + length);
    if (!gain.gain.setValueAtTime) gain.gain.value = Number(volume) || 0.08;

    source.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(this.audio.master);
    } else gain.connect(this.audio.master);

    const shot = { source, gain, panner };
    this.pointShots.add(shot);
    source.onended = () => {
      source.disconnect?.();
      gain.disconnect?.();
      panner?.disconnect?.();
      this.pointShots.delete(shot);
    };
    source.start(time);
    source.stop(time + length + 0.03);
    return true;
  }

  installationProgram() {
    return (
      this.spectraPrograms.find((program) => program.id === this.installationProgramId) ??
      installationProgramById(this.installationProgramId)
    );
  }

  setSpectraPrograms(programs = []) {
    this.spectraPrograms = (Array.isArray(programs) ? programs : [])
      .filter((program) => program?.id && program?.kind === 'spectra-spatial')
      .map((program) => ({ ...program, available: true, kind: 'spectra-spatial' }))
      .slice(-12);
    if (
      this.installationProgramId &&
      !INSTALLATION_PROGRAMS.some((program) => program.id === this.installationProgramId) &&
      !this.spectraPrograms.some((program) => program.id === this.installationProgramId)
    ) {
      this.installationProgramId = DEFAULT_INSTALLATION_PROGRAM_ID;
    }
    return this.spectraPrograms;
  }

  setSpectraProgramProvider(provider) {
    this.spectraProgramProvider = typeof provider === 'function' ? provider : null;
    if (this.installationProgram()?.kind === 'spectra-spatial') this.applyInstallationProgram();
  }

  ensureInstallation() {
    const context = this.audio.context;
    if (!context || this.installationBus) return;
    this.installationBus = context.createGain();
    this.installationBus.gain.value = 0;
    this.recordedGain = context.createGain();
    this.recordedGain.gain.value = 0.0001;
    this.recordedGain.connect(this.installationBus);

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

  stopRecordedProgram({ resetIndex = false } = {}) {
    this.recordedGeneration++;
    if (this.recordedSource) {
      this.recordedSource.onended = null;
      try {
        this.recordedSource.stop();
      } catch {
        // Already ended.
      }
      this.recordedSource.disconnect();
      this.recordedSource = null;
    }
    if (resetIndex) this.recordedProgramIndex = 0;
  }

  async startRecordedProgram({ resetIndex = false } = {}) {
    const context = this.audio.context;
    const program = this.installationProgram();
    if (!context || program.kind !== 'recorded-playlist' || !program.assetIds?.length) return false;
    if (!this.audio.assets?.audio) return false;
    if (resetIndex) this.recordedProgramIndex = 0;
    if (!this.installationBus) this.ensureInstallation();

    this.stopRecordedProgram();
    const generation = this.recordedGeneration;
    const index = this.recordedProgramIndex % program.assetIds.length;
    const assetId = program.assetIds[index];
    const buffer = await this.audio.assets.audio(assetId, context);
    if (
      !buffer ||
      generation !== this.recordedGeneration ||
      this.installationProgramId !== program.id
    )
      return false;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.recordedGain);
    this.recordedSource = source;
    source.onended = () => {
      if (this.recordedSource !== source) return;
      source.disconnect();
      this.recordedSource = null;
      this.recordedProgramIndex = (index + 1) % program.assetIds.length;
      void this.startRecordedProgram();
    };
    source.start();
    return true;
  }

  stopSpectraProgram() {
    this.spectraGeneration += 1;
    if (this.spectraSource) {
      this.spectraSource.onended = null;
      try {
        this.spectraSource.stop();
      } catch {
        // Already stopped.
      }
      this.spectraSource.disconnect?.();
      this.spectraSource = null;
    }
    this.spectraSplitter?.disconnect?.();
    this.spectraSplitter = null;
  }

  async startSpectraProgram() {
    const context = this.audio.context;
    const program = this.installationProgram();
    if (
      !context ||
      program?.kind !== 'spectra-spatial' ||
      !this.spectraProgramProvider ||
      typeof context.createChannelSplitter !== 'function'
    )
      return false;
    if (!this.installationBus) this.ensureInstallation();
    this.stopSpectraProgram();
    const generation = this.spectraGeneration;
    const buffer = await this.spectraProgramProvider(program.id, context);
    if (
      !buffer ||
      generation !== this.spectraGeneration ||
      this.installationProgramId !== program.id
    )
      return false;

    const source = context.createBufferSource();
    const splitter = context.createChannelSplitter(8);
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = Math.max(
      0.05,
      Math.min(buffer.duration, Number(program.duration) || buffer.duration),
    );
    source.connect(splitter);
    for (let index = 0; index < Math.min(8, this.emitters.length); index += 1) {
      splitter.connect(this.emitters[index].speakerGain, index, 0);
    }
    source.onended = () => {
      if (this.spectraSource !== source) return;
      source.disconnect?.();
      splitter.disconnect?.();
      this.spectraSource = null;
      this.spectraSplitter = null;
    };
    this.spectraSource = source;
    this.spectraSplitter = splitter;
    source.start();
    return true;
  }

  applyInstallationProgram() {
    if (!this.audio.context) return;
    const program = this.installationProgram();
    if (program.kind === 'spectra-spatial') {
      this.stopRecordedProgram({ resetIndex: true });
      for (const emitter of this.emitters) {
        this.setParam(emitter.toneGain.gain, 0, 0.12);
        if (emitter.noiseGain) this.setParam(emitter.noiseGain.gain, 0, 0.12);
      }
      if (!this.spectraSource) void this.startSpectraProgram();
      this.applyInstallationMix();
      return;
    }
    this.stopSpectraProgram();
    if (program.kind === 'recorded-playlist') {
      for (const emitter of this.emitters) {
        this.setParam(emitter.toneGain.gain, 0, 0.18);
        if (emitter.noiseGain) this.setParam(emitter.noiseGain.gain, 0, 0.18);
      }
      if (!this.recordedSource) void this.startRecordedProgram();
      this.applyInstallationMix();
      return;
    }
    this.stopRecordedProgram({ resetIndex: true });
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
    const program =
      this.spectraPrograms.find((candidate) => candidate.id === id) ??
      INSTALLATION_PROGRAMS.find((candidate) => candidate.id === id);
    if (!program?.available) return null;
    const changed = this.installationProgramId !== program.id;
    if (changed) {
      this.stopRecordedProgram({ resetIndex: true });
      this.stopSpectraProgram();
    }
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

  listenerSurfaceId(level, player) {
    if (!level) return '';
    const sceneId = level.definition?.id ?? '';
    const position = player?.position;
    const ground =
      position && level.collision?.surfaceAt?.(position.x, position.z, position.y + 0.3);
    let surfaceId = ground?.surface?.id ?? sceneId;

    // Take A Break is a physical acoustic room, not merely a navigation-surface label.
    // Multiplayer entry profiles, God Mode and future navigation passes can all alter how the
    // collision graph reports a listener without changing where that listener actually is.
    // Keep the room's real bounds authoritative so the eight-speaker installation and the
    // heavily filtered club bleed can never split apart again.
    if (sceneId === 'downstairs' && position && isTakeABreakPosition(position))
      surfaceId = 'lounge';

    return surfaceId;
  }

  sourceEnvironmentFor(owner, level, surfaceId) {
    return acousticEnvironmentFor(owner, level?.definition?.id ?? '', surfaceId, {
      installationFocus: this.installationFocus,
    });
  }

  environmentFor(level, surfaceId) {
    const owner = this.audio.activeExternalTransport?.owner;
    if (SPATIAL_TRANSPORT_OWNERS.includes(owner))
      return this.sourceEnvironmentFor(owner, level, surfaceId);
    return { gain: 1, lowpassHz: 20000, label: level?.definition?.id ?? 'local' };
  }

  update(level, player, camera) {
    if (!this.audio.context || !level) return;
    this.elapsed += 1 / 60;
    this.ensureInstallation();
    this.updateListener(player, camera);
    const surfaceId = this.listenerSurfaceId(level, player);
    const inLounge =
      level.definition.id === 'downstairs' &&
      (surfaceId === 'lounge' || surfaceId === 'lounge-door');
    if (this.installationFocus && !inLounge) this.installationFocus = false;
    for (const owner of SPATIAL_TRANSPORT_OWNERS) {
      const key = acousticEnvironmentKey(owner, level.definition.id, surfaceId, {
        installationFocus: this.installationFocus,
      });
      if (this.lastSourceEnvironmentKeys.get(owner) === key) continue;
      this.audio.setSourceEnvironment?.(owner, this.sourceEnvironmentFor(owner, level, surfaceId));
      this.lastSourceEnvironmentKeys.set(owner, key);
    }

    // Room coloration for long-running music now lives on independent source buses. Keep the
    // legacy master path neutral so local point sources, UI cues and gameplay SFX are not muted
    // merely because somebody else started a tape or a DJ deck elsewhere in the building.
    const key = `${level.definition.id}:${surfaceId}:neutral`;
    if (key !== this.lastEnvironmentKey) {
      this.audio.setEnvironment({ gain: 1, lowpassHz: 20000, label: surfaceId });
      this.lastEnvironmentKey = key;
    }
    const installationActive = inLounge && this.installationEnabled;
    const installationKind = this.installationProgram().kind;
    const recordedProgram = installationKind === 'recorded-playlist';
    const spectraProgram = installationKind === 'spectra-spatial';
    this.updateInstallationField(installationActive && installationKind === 'procedural');
    if (spectraProgram) {
      for (const emitter of this.emitters)
        this.setParam(emitter.speakerGain.gain, installationActive ? 1 : 0.0001, 0.08);
    }
    if (this.recordedGain)
      this.setParam(
        this.recordedGain.gain,
        installationActive && recordedProgram ? 0.82 : 0.0001,
        0.18,
      );
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
      programs: [
        ...availableInstallationPrograms().map(({ id, label, artist, description }) => ({
          id,
          label,
          artist,
          description,
        })),
        ...this.spectraPrograms.map(({ id, label, artist, description }) => ({
          id,
          label,
          artist,
          description,
        })),
      ],
      catalogSlots: INSTALLATION_PROGRAMS.filter((item) => !item.available).map(
        ({ id, label, artist, description }) => ({ id, label, artist, description }),
      ),
    };
  }

  dispose() {
    for (const owner of [...this.pointMachines.keys()]) this.stopPointMachine(owner, 0);
    for (const shot of this.pointShots) {
      try {
        shot.source.stop();
      } catch {
        // Already ended.
      }
      shot.source.disconnect?.();
      shot.gain.disconnect?.();
      shot.panner?.disconnect?.();
    }
    this.pointShots.clear();
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
    this.stopRecordedProgram({ resetIndex: true });
    this.stopSpectraProgram();
    this.recordedGain?.disconnect();
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
