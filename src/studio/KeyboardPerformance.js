import { TouchPerformanceSurface } from '../ui/TouchPerformanceSurface.js';

const TONAL_KEYS = {
  z: 0,
  s: 1,
  x: 2,
  d: 3,
  c: 4,
  v: 5,
  g: 6,
  b: 7,
  h: 8,
  n: 9,
  j: 10,
  m: 11,
  ',': 12,
  l: 13,
  '.': 14,
  ';': 15,
  '/': 16,
};

const DRUM_KEYS = {
  z: 'kick',
  x: 'snare',
  c: 'closed-hat',
  v: 'open-hat',
  b: 'low-tom',
  n: 'high-tom',
  m: 'crash',
};

const midiToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const now = () => globalThis.performance?.now?.() ?? Date.now();
const isTouchDevice = () => {
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
  return globalThis.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches === true;
};

/**
 * Lightweight playable studio instrument engine.
 *
 * Desktop uses the physical keyboard. Touch devices automatically get an instrument-specific
 * performance surface: piano keys for piano/synth/organ, pads for drums, and a tappable
 * fretboard for guitar/bass. Both input paths record the exact same event stream into takes.
 */
export class KeyboardPerformance {
  constructor(audio, target = globalThis.window, document = globalThis.document) {
    this.audio = audio;
    this.target = target;
    this.active = false;
    this.recording = false;
    this.config = null;
    this.events = [];
    this.startedAt = 0;
    this.spectraTransport = null;
    this.transportOwner = 'keyboard-performance';
    this.touchSurface = new TouchPerformanceSurface(document);
    this.onKeyDown = (event) => {
      if (!this.active || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'escape') {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        this.stop();
        return;
      }
      const handled = this.config?.mode === 'drums' ? key in DRUM_KEYS : key in TONAL_KEYS;
      if (!handled) return;
      event.preventDefault();
      // Some performance keys overlap movement/camera shortcuts. This listener is registered
      // before InputController, so stopping propagation keeps Z-M exclusively musical while
      // performance mode is active.
      event.stopImmediatePropagation?.();
      this.playKey(key);
    };
    target?.addEventListener?.('keydown', this.onKeyDown);
  }

  get instructions() {
    if (isTouchDevice()) {
      if (this.config?.mode === 'drums') return 'Use the drum pads below';
      if (this.config?.mode === 'guitar' || this.config?.mode === 'bass')
        return 'Tap strings and frets on the instrument below';
      return 'Play the touch keyboard below';
    }
    return this.config?.mode === 'drums'
      ? 'Z kick · X snare · C closed hat · V open hat · B low tom · N high tom · M crash · Esc stop'
      : 'Z S X D C V G B H N J M , L . ; / play chromatically · Esc stop';
  }

  start(config = {}, { record = false } = {}) {
    this.stop(false);
    this.config = {
      mode: config.mode ?? 'synth',
      label: config.label ?? 'Instrument',
      baseMidi: clamp(Number(config.baseMidi) || 48, 24, 84),
      wave: config.wave ?? 'triangle',
      volume: clamp(Number(config.volume) || 0.065, 0.01, 0.22),
      duration: clamp(Number(config.duration) || 0.42, 0.06, 1.5),
      octaveLayer: config.octaveLayer === true,
      stemKind: config.stemKind ?? config.mode ?? 'synth',
      processing:
        config.processing && typeof config.processing === 'object'
          ? { ...config.processing }
          : null,
      instrumentVoice: config.instrumentVoice,
      ampCharacter: config.ampCharacter,
    };
    this.active = true;
    this.recording = !!record;
    this.events = [];
    this.startedAt = now();
    if (this.recording) this.spectraTransport?.acquire?.(this.transportOwner, { position: 0 });
    this.touchSurface.show(this);
    return this.config;
  }

  eventTime() {
    if (this.spectraTransport?.running) return this.spectraTransport.position();
    return Math.max(0, (now() - this.startedAt) / 1000);
  }

  record(event) {
    if (!this.recording) return;
    const rawTime = this.eventTime();
    const time = this.spectraTransport?.running
      ? this.spectraTransport.quantizeTime(rawTime, {
          wrap: this.spectraTransport.session?.loopEnabled === true,
          includeSwing: true,
        })
      : rawTime;
    this.events.push({ time, ...event });
  }

  playDrum(name) {
    switch (name) {
      case 'kick':
        this.audio.kick();
        break;
      case 'snare':
        this.audio.tone(185, 0.09, 'triangle', 0.075);
        this.audio.hat(0.008);
        break;
      case 'closed-hat':
        this.audio.hat();
        break;
      case 'open-hat':
        this.audio.hat();
        this.audio.hat(0.065);
        break;
      case 'low-tom':
        this.audio.tone(112, 0.22, 'sine', 0.1);
        break;
      case 'high-tom':
        this.audio.tone(176, 0.18, 'sine', 0.085);
        break;
      case 'crash':
        this.audio.hat();
        this.audio.hat(0.04);
        this.audio.hat(0.09);
        this.audio.tone(420, 0.34, 'triangle', 0.035);
        break;
      default:
        return false;
    }
    return true;
  }

  triggerDrum(name) {
    if (!this.active || this.config?.mode !== 'drums' || !this.playDrum(name)) return false;
    this.record({ drum: name });
    return true;
  }

  playMidi(midi) {
    if (!this.active || !this.config || this.config.mode === 'drums') return false;
    const safeMidi = clamp(Math.round(Number(midi) || this.config.baseMidi), 24, 96);
    const frequency = midiToFrequency(safeMidi);
    this.audio.tone(frequency, this.config.duration, this.config.wave, this.config.volume);
    if (this.config.octaveLayer) {
      this.audio.tone(
        frequency * 2,
        this.config.duration * 0.72,
        'triangle',
        this.config.volume * 0.22,
        0.012,
      );
    }
    this.record({ midi: safeMidi, frequency });
    return true;
  }

  playKey(key) {
    if (!this.active || !this.config) return false;
    if (this.config.mode === 'drums') {
      const drum = DRUM_KEYS[key];
      return drum ? this.triggerDrum(drum) : false;
    }
    const semitone = TONAL_KEYS[key];
    return semitone == null ? false : this.playMidi(this.config.baseMidi + semitone);
  }

  stop(returnTake = true) {
    if (!this.active && !this.recording) {
      this.touchSurface.clear();
      return null;
    }
    const duration = this.spectraTransport?.running
      ? this.spectraTransport.session?.loopEnabled
        ? Math.max(
            0.25,
            this.spectraTransport.session.loopBars * 4 * (60 / this.spectraTransport.session.bpm),
          )
        : Math.max(0, this.spectraTransport.position())
      : Math.max(0, (now() - this.startedAt) / 1000);
    const take =
      returnTake && this.recording && this.config
        ? {
            mode: this.config.mode,
            label: this.config.label,
            baseMidi: this.config.baseMidi,
            wave: this.config.wave,
            volume: this.config.volume,
            noteDuration: this.config.duration,
            octaveLayer: this.config.octaveLayer,
            bpm: this.spectraTransport?.session?.bpm ?? 118,
            duration,
            events: this.events.map((event) => ({ ...event })),
          }
        : null;
    if (this.recording) this.spectraTransport?.release?.(this.transportOwner);
    this.active = false;
    this.recording = false;
    this.config = null;
    this.events = [];
    this.startedAt = 0;
    this.touchSurface.clear();
    return take;
  }

  dispose() {
    this.stop(false);
    this.touchSurface.dispose();
    this.target?.removeEventListener?.('keydown', this.onKeyDown);
  }
}
