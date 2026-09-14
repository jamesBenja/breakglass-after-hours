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

/**
 * Turns the computer keyboard into a lightweight playable instrument while the player is
 * standing at a studio station. Tonal instruments use a familiar Z-M chromatic keyboard;
 * drums use Z-M as seven pads. Performance capture is event-based, so takes can be saved
 * without recording the whole game mix.
 */
export class KeyboardPerformance {
  constructor(audio, target = globalThis.window) {
    this.audio = audio;
    this.target = target;
    this.active = false;
    this.recording = false;
    this.config = null;
    this.events = [];
    this.startedAt = 0;
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
    };
    this.active = true;
    this.recording = !!record;
    this.events = [];
    this.startedAt = performance.now();
    return this.config;
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
    }
  }

  playKey(key) {
    if (!this.active || !this.config) return false;
    const time = Math.max(0, (performance.now() - this.startedAt) / 1000);
    if (this.config.mode === 'drums') {
      const drum = DRUM_KEYS[key];
      if (!drum) return false;
      this.playDrum(drum);
      if (this.recording) this.events.push({ time, drum });
      return true;
    }

    const semitone = TONAL_KEYS[key];
    if (semitone == null) return false;
    const midi = this.config.baseMidi + semitone;
    const frequency = midiToFrequency(midi);
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
    if (this.recording) this.events.push({ time, midi, frequency });
    return true;
  }

  stop(returnTake = true) {
    if (!this.active && !this.recording) return null;
    const duration = Math.max(0, (performance.now() - this.startedAt) / 1000);
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
            bpm: 118,
            duration,
            events: this.events.map((event) => ({ ...event })),
          }
        : null;
    this.active = false;
    this.recording = false;
    this.config = null;
    this.events = [];
    this.startedAt = 0;
    return take;
  }

  dispose() {
    this.stop(false);
    this.target?.removeEventListener?.('keydown', this.onKeyDown);
  }
}
