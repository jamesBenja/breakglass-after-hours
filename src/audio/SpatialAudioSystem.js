import { Vector3 } from 'three';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const INSTALLATION_EMITTERS = [
  { position: [-9.15, 1.25, 0.35], frequency: 110, wave: 'sine', lfo: 0.071 },
  { position: [-7.05, 1.45, 0.55], frequency: 164.81, wave: 'triangle', lfo: 0.053 },
  { position: [-9.2, 1.6, 2.95], frequency: 246.94, wave: 'sine', lfo: 0.043 },
  { position: [-7.0, 1.25, 3.0], frequency: 329.63, wave: 'triangle', lfo: 0.061 },
];

/**
 * A lightweight binaural/spatial layer for the building.
 *
 * - updates the WebAudio listener from the player/camera
 * - applies room-to-room gain + low-pass transitions to the shared music bus
 * - creates a quiet four-emitter HRTF sound installation in Take A Break
 *
 * The installation is intentionally procedural until a final spatial master is supplied. It is
 * kept as a separate system so a stereo, quad or ambisonic asset can replace the oscillators
 * without changing room logic.
 */
export class SpatialAudioSystem {
  constructor(audio) {
    this.audio = audio;
    this.installationEnabled = true;
    this.installationBus = null;
    this.emitters = [];
    this.lastEnvironmentKey = '';
    this.forward = new Vector3();
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
    this.installationBus.connect(this.audio.master);

    for (const config of INSTALLATION_EMITTERS) {
      const source = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const depth = context.createGain();
      const panner = typeof context.createPanner === 'function' ? context.createPanner() : null;
      source.type = config.wave;
      source.frequency.value = config.frequency;
      gain.gain.value = 0.012;
      lfo.frequency.value = config.lfo;
      depth.gain.value = 0.006;
      lfo.connect(depth);
      depth.connect(gain.gain);
      source.connect(gain);
      if (panner) {
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.8;
        panner.maxDistance = 11;
        panner.rolloffFactor = 1.35;
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
      this.emitters.push({ source, gain, lfo, depth, panner });
    }
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
      if (surfaceId === 'lounge' || surfaceId === 'lounge-door')
        return { gain: 0.82, lowpassHz: 12500, label: 'Take A Break' };
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
      if (surfaceId === 'neve-suite') return { gain: 1, lowpassHz: 19000, label: 'Neve tape playback' };
      if (surfaceId === 'mixing-suite') return { gain: 0.58, lowpassHz: 5200, label: 'tape through control-room wall' };
      if (surfaceId === 'live-room') return { gain: 0.42, lowpassHz: 3600, label: 'tape through studio walls' };
      return { gain: 0.34, lowpassHz: 2600, label: 'archive bleed' };
    }
    if (owner === 'studio') {
      if (surfaceId === 'mixing-suite') return { gain: 1, lowpassHz: 20000, label: 'Spectra control room' };
      if (surfaceId === 'live-room') return { gain: 0.78, lowpassHz: 12000, label: 'live room monitor bleed' };
      if (surfaceId === 'dead-room') return { gain: 0.62, lowpassHz: 7200, label: 'dead room' };
      if (surfaceId === 'neve-suite') return { gain: 0.52, lowpassHz: 5200, label: 'Neve room' };
      if (surfaceId === 'storage') return { gain: 0.32, lowpassHz: 2600, label: 'upstairs storage' };
      return { gain: 0.5, lowpassHz: 4800, label: 'studio hallway' };
    }
    return { gain: 1, lowpassHz: 20000, label: 'upstairs' };
  }

  update(level, player, camera) {
    if (!this.audio.context || !level) return;
    this.ensureInstallation();
    this.updateListener(player, camera);
    const ground = level.collision.surfaceAt(player.position.x, player.position.z, player.position.y + 0.3);
    const surfaceId = ground?.surface?.id ?? level.definition.id;
    const environment = this.environmentFor(level, surfaceId);
    const key = `${level.definition.id}:${surfaceId}:${this.audio.activeExternalTransport?.owner ?? 'none'}`;
    if (key !== this.lastEnvironmentKey) {
      this.audio.setEnvironment(environment);
      this.lastEnvironmentKey = key;
    }
    if (this.installationBus) {
      const active = level.definition.id === 'downstairs' && this.installationEnabled;
      this.setParam(this.installationBus.gain, active ? 0.78 : 0, 0.18);
    }
  }

  toggleInstallation(force) {
    this.installationEnabled = force == null ? !this.installationEnabled : !!force;
    return this.installationEnabled;
  }

  snapshot() {
    return {
      enabled: this.installationEnabled,
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
    this.installationBus?.disconnect();
    this.installationBus = null;
  }
}
