import {
  SPECTRA_SPATIAL_SPEAKERS,
  normalizeSpatialPosition,
  spatialSpeakerGains,
} from './SpectraSpatialLayout.js';

function setParam(parameter, value, time = 0, timeConstant = 0.02) {
  if (!parameter) return;
  if (parameter.setTargetAtTime) parameter.setTargetAtTime(value, time, timeConstant);
  else parameter.value = value;
}

export class SpectraSpatialMixer {
  constructor(game) {
    this.game = game;
    this.previewEnabled = false;
    this.speakerInputs = [];
    this.speakerPanners = [];
    this.trackRoutes = new Map();
    this.context = null;
  }

  ensureOutputs() {
    const context = this.game.audio?.context;
    if (!context) return false;
    if (this.context === context && this.speakerInputs.length === 8) return true;
    this.disposeAudio();
    this.context = context;
    const destination = this.game.audio.sourceDestination?.('studio') ?? this.game.audio.master;
    if (!destination) return false;

    for (const speaker of SPECTRA_SPATIAL_SPEAKERS) {
      const input = context.createGain();
      input.gain.value = 1;
      const panner = typeof context.createPanner === 'function' ? context.createPanner() : null;
      if (panner) {
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 0.75;
        panner.maxDistance = 14;
        panner.rolloffFactor = 0.8;
        const [x, y, z] = speaker.world;
        if (panner.positionX) {
          panner.positionX.value = x;
          panner.positionY.value = y;
          panner.positionZ.value = z;
        } else panner.setPosition?.(x, y, z);
        input.connect(panner);
        panner.connect(destination);
      } else input.connect(destination);
      this.speakerInputs.push(input);
      this.speakerPanners.push(panner);
    }
    return true;
  }

  ensureTrackRoute(stem, bus) {
    const source = bus?.spatialPost ?? bus?.fader;
    if (!this.ensureOutputs() || !stem || !source) return null;
    let route = this.trackRoutes.get(stem.id);
    if (route?.source !== source || route.context !== this.context) {
      if (route) this.disconnectRoute(route);
      const gains = this.speakerInputs.map((speakerInput) => {
        const gain = this.context.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(speakerInput);
        return gain;
      });
      route = { source, gains, context: this.context };
      this.trackRoutes.set(stem.id, route);
    }
    return route;
  }

  updateStem(stem, bus) {
    if (!stem || !bus) return;
    const spatial = normalizeSpatialPosition(stem.spatial);
    const active = this.previewEnabled && spatial.enabled;
    if (bus.dry?.gain) setParam(bus.dry.gain, active ? 0 : 1, this.context?.currentTime ?? 0);
    if (!active) {
      const route = this.trackRoutes.get(stem.id);
      if (route) {
        for (const gain of route.gains)
          setParam(gain.gain, 0, this.context?.currentTime ?? 0, 0.015);
      }
      return;
    }
    const route = this.ensureTrackRoute(stem, bus);
    if (!route) return;
    const gains = spatialSpeakerGains(spatial);
    for (let index = 0; index < route.gains.length; index += 1) {
      setParam(
        route.gains[index].gain,
        gains[index] ?? 0,
        this.context?.currentTime ?? 0,
        0.015,
      );
    }
  }

  sync(session, buses) {
    const active = new Set((session?.stems ?? []).map((stem) => stem.id));
    for (const [id, route] of this.trackRoutes) {
      if (active.has(id) && buses?.has?.(id)) continue;
      this.disconnectRoute(route);
      this.trackRoutes.delete(id);
    }
  }

  setPreview(enabled) {
    this.previewEnabled = enabled === true;
    this.game.studioPlayback?.updateMix?.(this.game.studio);
    return this.previewEnabled;
  }

  togglePreview() {
    return this.setPreview(!this.previewEnabled);
  }

  updatePosition(stemId, patch = {}) {
    const stem = this.game.studio?.stems?.find?.((item) => item.id === stemId);
    if (!stem) return false;
    stem.spatial = normalizeSpatialPosition({ ...stem.spatial, ...patch });
    this.game.studioPlayback?.updateMix?.(this.game.studio);
    this.game.save?.();
    return stem.spatial;
  }

  disconnectRoute(route) {
    for (const gain of route?.gains ?? []) {
      try {
        route.source?.disconnect?.(gain);
      } catch {
        // Already disconnected or source replaced.
      }
      gain.disconnect?.();
    }
  }

  disposeAudio() {
    for (const route of this.trackRoutes.values()) this.disconnectRoute(route);
    this.trackRoutes.clear();
    for (const node of this.speakerInputs) node.disconnect?.();
    for (const node of this.speakerPanners) node?.disconnect?.();
    this.speakerInputs = [];
    this.speakerPanners = [];
    this.context = null;
  }

  dispose() {
    this.previewEnabled = false;
    this.disposeAudio();
  }
}
