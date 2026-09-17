import { Vector3 } from 'three';
import { TAKE_A_BREAK_SPEAKERS } from '../gameplay/TakeABreakImmersiveSystem.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const INSTALLATION_VOICES = Object.freeze([
  { frequency: 82.41, wave: 'sine', lfo: 0.071, layer: 'low' },
  { frequency: 110, wave: 'triangle', lfo: 0.053, layer: 'low' },
  { frequency: 146.83, wave: 'sine', lfo: 0.043, layer: 'texture' },
  { frequency: 164.81, wave: 'triangle', lfo: 0.061, layer: 'texture' },
  { frequency: 220, wave: 'sine', lfo: 0.037, layer: 'texture' },
  { frequency: 293.66, wave: 'triangle', lfo: 0.047, layer: 'air' },
  { frequency: 329.63, wave: 'sine', lfo: 0.059, layer: 'air' },
  { frequency: 440, wave: 'triangle', lfo: 0.041, layer: 'air' },
]);

const INSTALLATION_EMITTERS = Object.freeze(
  TAKE_A_BREAK_SPEAKERS.map((position, index) => ({
    position,
    ...INSTALLATION_VOICES[index],
  })),
);

const DEFAULT_INSTALLATION_MIX = Object.freeze({
  low: 0.72,
  texture: 0.72,
  air: 0.62,
  motion: 0.68,
  space: 0.5,
});

/**
 * A lightweight binaural/spatial layer for the building.
 *
 * - updates the WebAudio listener from the player/camera
 * - applies room-to-room gain + low-pass transitions to the shared music bus
 * - creates an eight-position HRTF sound installation in Take A Break
 * - makes the club become quiet filtered wall bleed while the installation dominates the room
 * - keeps the existing installation mix/focus controls attached to the real eight-speaker field
 */
export class SpatialAudioSystem {
  constructor(audio) {
    this.audio = audio;
    this.installationEnabled = true;
    this.installationFocus = false;
    this.installationMix = { ...DEFAULT_INSTALLATION_MIX };
    this.installationBus = null;
    this.installationFilter = null;
    this.installationDry = null;
    this.installationDelay = null;
    this.installationFeedback = null;
    this.installationWet = null;
    this.emitters = [];
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

  ensureInstallation() {
    const context = this.audio.context;
    if (!context || this.installationBus) return;
    this.installationBus = context.createGain();
    this.installationBus.gain.value = 0;

    this.installationFilter = context.createBiquadFilter?.() ?? null;
    this.installationDry = context.createGain();
    if (this.installationFilter) {
      this.installationFilter.type = 'lowpass';
      this.installationFilter.frequency.value = 16500;
      this.installationBus.connect(this.installationFilter);
      this.installationFilter.connect(this.installationDry);
    } else this.installationBus.connect(this.installationDry);
    this.installationDry.connect(this.audio.master);

    if (typeof context.createDelay === 'function') {
      this.installationDelay = context.createDelay(1.2);
      this.installationFeedback = context.createGain();
      this.installationWet = context.createGain();
      const source = this.installationFilter ?? this.installationBus;
      source.connect(this.installationDelay);
      this.installationDelay.connect(this.installationWet);
      this.installationWet.connect(this.audio.master);
      this.installationDelay.connect(this.installationFeedback);
      this.installationFeedback.connect(this.installationDelay);
    }

    for (const config of INSTALLATION_EMITTERS) {
      const source = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const depth = context.createGain();
      const panner = typeof context.createPanner === 'function' ? context.createPanner() : null;
      source.type = config.wave;
      source.frequency.value = config.frequency;
      gain.gain.value = 0.0001;
      lfo.frequency.value = config.lfo;
      depth.gain.value = 0.004;
      lfo.connect(depth);
      depth.connect(gain.gain);
      source.connect(gain);
      if (panner) {
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.65;
        panner.maxDistance = 9;
        panner.rolloffFactor = 0.82;
        const [x, y, z] = config.position;
        if (panner.positionX) {
          panner.positionX.value = x;
          panner.positionY.value = y;
          panner.positionZ.value = z;
        } else panner.setPosition?.(x, y, z);
        gain.connect(panner);
        panner.connect(this.installationBus);
      } else gain.connect(this.installationBus);
      source.start();
      lfo.start();
      this.emitters.push({ source, gain, lfo, depth, panner, config });
    }
    this.applyInstallationMix();
  }

  applyInstallationMix() {
    if (!this.audio.context) return;
    const motion = this.installationMix.motion;
    for (const emitter of this.emitters) {
      this.setParam(emitter.depth.gain, 0.0015 + motion * 0.0065, 0.12);
      this.setParam(emitter.lfo.frequency, emitter.config.lfo * (0.55 + motion * 1.55), 0.12);
    }
    if (this.installationDelay) {
      this.setParam(
        this.installationDelay.delayTime,
        0.12 + this.installationMix.space * 0.42,
        0.12,
      );
      this.setParam(this.installationFeedback.gain, 0.08 + this.installationMix.space * 0.48, 0.12);
      this.setParam(this.installationWet.gain, this.installationMix.space * 0.58, 0.12);
    }
    if (this.installationDry) this.setParam(this.installationDry.gain, 0.96, 0.12);
    if (this.installationFilter)
      this.setParam(
        this.installationFilter.frequency,
        8500 + this.installationMix.air * 10000,
        0.12,
      );
  }

  updateInstallationField(active) {
    const motion = this.installationMix.motion;
    for (let index = 0; index < this.emitters.length; index++) {
      const emitter = this.emitters[index];
      const layer = this.installationMix[emitter.config.layer] ?? 0.7;
      const a = (Math.sin(this.elapsed * (0.34 + motion * 0.22) - index * 0.82) + 1) * 0.5;
      const b = (Math.sin(this.elapsed * 0.19 + index * 1.91) + 1) * 0.5;
      const c = (Math.sin(this.elapsed * (0.57 + motion * 0.2) - index * 0.37) + 1) * 0.5;
      const circulation = 0.18 + a * 0.48 + b * 0.2 + c * 0.14;
      const focus = this.installationFocus ? 1.12 : 1;
      const target = active ? (0.0025 + layer * 0.0125) * circulation * focus : 0.0001;
      this.setParam(emitter.gain.gain, target, 0.11);
      this.setParam(
        emitter.source.detune,
        active ? Math.sin(this.elapsed * 0.13 + index) * (4 + motion * 8) : 0,
        0.18,
      );
    }
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
            gain: 0.055,
            lowpassHz: 650,
            label: 'Take A Break · installation focus · club through wall',
          };
        return {
          gain: 0.095,
          lowpassHz: 920,
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

    // Upstairs sources behave like they live in a real room rather than following the listener.
    // This is intentionally broad until measured room impulse responses are available.
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
      this.setParam(
        this.installationBus.gain,
        installationActive ? (this.installationFocus ? 1.18 : 1.04) : 0,
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
    return {
      enabled: this.installationEnabled,
      focus: this.installationFocus,
      mix: { ...this.installationMix },
      environment: { ...this.audio.environment },
      emitters: INSTALLATION_EMITTERS.length,
    };
  }

  dispose() {
    for (const emitter of this.emitters) {
      try {
        emitter.source.stop();
        emitter.lfo.stop();
      } catch {
        // Already stopped.
      }
      emitter.source.disconnect();
      emitter.gain.disconnect();
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
    this.installationFeedback = null;
    this.installationWet = null;
    this.installationDelay = null;
    this.installationDry = null;
    this.installationFilter = null;
    this.installationBus = null;
  }
}
