const NOTE = {
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  G2: 98.0,
  A2: 110,
  C3: 130.81,
  E3: 164.81,
  G3: 196,
  A3: 220,
  C4: 261.63,
  E4: 329.63,
  G4: 392,
};

/**
 * Small multitrack transport for the prototype. Generated stems are intentionally simple,
 * but each stem has its own gain/pan bus so the Spectra UI is already a real mixer.
 * Recorded AudioBuffers can replace generated parts without changing the session model.
 */
export class StudioPlayback {
  constructor(audio, timers = globalThis) {
    this.audio = audio;
    this.timers = timers;
    this.timer = null;
    this.nextTime = 0;
    this.step = 0;
    this.session = null;
    this.buses = new Map();
    this.sources = new Set();
    this.bpm = 118;
  }

  get playing() {
    return this.timer !== null;
  }

  ensureBus(stem) {
    let bus = this.buses.get(stem.id);
    if (bus) return bus;
    const context = this.audio.context;
    const gain = context.createGain();
    const pan = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    gain.connect(pan ?? this.audio.master);
    pan?.connect(this.audio.master);
    bus = { gain, pan };
    this.buses.set(stem.id, bus);
    return bus;
  }

  updateMix(session = this.session) {
    if (!session || !this.audio.context) return;
    const time = this.audio.context.currentTime;
    const activeIds = new Set();
    for (const stem of session.stems) {
      activeIds.add(stem.id);
      const bus = this.ensureBus(stem);
      const target = stem.mute ? 0 : stem.level;
      bus.gain.gain.setTargetAtTime(target, time, 0.025);
      if (bus.pan) bus.pan.pan.setTargetAtTime(stem.pan ?? 0, time, 0.025);
    }
    for (const [id, bus] of this.buses) {
      if (activeIds.has(id)) continue;
      bus.gain.disconnect();
      bus.pan?.disconnect();
      this.buses.delete(id);
    }
  }

  oscillator(freq, duration, destination, { type = 'triangle', volume = 0.12, when = 0 } = {}) {
    const context = this.audio.context;
    const source = context.createOscillator();
    const gain = context.createGain();
    source.type = type;
    source.frequency.value = freq;
    const start = context.currentTime + when;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.sources.delete(source);
    };
    this.sources.add(source);
    source.start(start);
    source.stop(start + duration + 0.04);
  }

  kick(destination, when = 0) {
    const context = this.audio.context;
    const source = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + when;
    source.frequency.setValueAtTime(125, start);
    source.frequency.exponentialRampToValueAtTime(42, start + 0.18);
    gain.gain.setValueAtTime(0.23, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
    source.connect(gain);
    gain.connect(destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.sources.delete(source);
    };
    this.sources.add(source);
    source.start(start);
    source.stop(start + 0.22);
  }

  noise(destination, when = 0, duration = 0.05, volume = 0.05) {
    const context = this.audio.context;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'highpass';
    filter.frequency.value = 3200;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.sources.delete(source);
    };
    this.sources.add(source);
    source.start(context.currentTime + when);
  }

  renderStem(stem, step, when) {
    const bus = this.ensureBus(stem).gain;
    if (stem.mute) return;
    if (stem.kind === 'drums') {
      if (step % 4 === 0) this.kick(bus, when);
      if (step % 2 === 1) this.noise(bus, when + 0.01, 0.035, 0.055);
      if (step % 8 === 4) this.noise(bus, when, 0.11, 0.095);
      return;
    }
    if (stem.kind === 'bass') {
      if (step % 2 === 0) {
        const notes = [NOTE.C2, NOTE.C2, NOTE.G2, NOTE.A2, NOTE.E2, NOTE.G2, NOTE.D2, NOTE.A2];
        this.oscillator(notes[(step / 2) % notes.length], 0.22, bus, {
          type: 'sawtooth',
          volume: 0.08,
          when,
        });
      }
      return;
    }
    if (stem.kind === 'guitar') {
      if (step % 4 === 0) {
        const roots = [NOTE.C3, NOTE.A2, NOTE.G2, NOTE.E2];
        const root = roots[(step / 4) % roots.length];
        for (const ratio of [1, 1.25, 1.5])
          this.oscillator(root * ratio, 0.34, bus, {
            type: 'triangle',
            volume: 0.045,
            when,
          });
      }
      return;
    }
    if (stem.kind === 'synth' || stem.kind === 'keys') {
      if (step % 8 === 0) {
        const root = step % 16 === 0 ? NOTE.C4 : NOTE.A3;
        for (const ratio of [1, 1.25, 1.5])
          this.oscillator(root * ratio, 0.7, bus, {
            type: 'sawtooth',
            volume: 0.035,
            when,
          });
      }
      return;
    }

    const recording = this.session?.recordings.get(stem.id);
    if (recording && step === 0) {
      const source = this.audio.context.createBufferSource();
      source.buffer = recording;
      source.connect(bus);
      source.onended = () => {
        source.disconnect();
        this.sources.delete(source);
      };
      this.sources.add(source);
      source.start(this.audio.context.currentTime + when);
    }
  }

  async play(session) {
    if (!this.audio.context) return false;
    this.stop();
    this.session = session;
    this.updateMix(session);
    this.nextTime = this.audio.context.currentTime;
    this.step = 0;
    const interval = 60 / this.bpm / 4;
    this.audio.setExternalTransport?.('studio', 'Studio session mix', interval, { vibe: 0.48 });
    const schedule = () => {
      if (!this.audio.context || this.audio.context.state !== 'running') return;
      this.nextTime = Math.max(this.nextTime, this.audio.context.currentTime);
      this.updateMix(session);
      while (this.nextTime < this.audio.context.currentTime + 0.1) {
        const when = this.nextTime - this.audio.context.currentTime;
        for (const stem of session.stems) this.renderStem(stem, this.step, when);
        this.step = (this.step + 1) % 16;
        this.nextTime += interval;
      }
    };
    schedule();
    this.timer = this.timers.setInterval(schedule, 25);
    return true;
  }

  stop() {
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already-ended one shots only need disconnection.
      }
      source.disconnect();
    }
    this.sources.clear();
    this.audio.clearExternalTransport?.('studio');
  }

  dispose() {
    this.stop();
    for (const bus of this.buses.values()) {
      bus.gain.disconnect();
      bus.pan?.disconnect();
    }
    this.buses.clear();
    this.session = null;
  }
}
