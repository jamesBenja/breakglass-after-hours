const NOTE = {
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  G2: 98.0,
  A2: 110,
  C3: 130.81,
  A3: 220,
  C4: 261.63,
};

const MIC_COLOR = {
  'dynamic-57': { frequency: 3200, gain: 3.5, q: 1.1 },
  ribbon: { frequency: 5200, gain: -2.5, q: 0.7 },
  'fet-condenser': { frequency: 6500, gain: 2.8, q: 0.8 },
  'tube-condenser': { frequency: 900, gain: 2.4, q: 0.65 },
  'dynamic-7b': { frequency: 2200, gain: 1.2, q: 0.9 },
};

const COMP = {
  'fet-comp': { threshold: -24, ratio: 7, attack: 0.003, release: 0.12 },
  'opto-comp': { threshold: -18, ratio: 3.2, attack: 0.03, release: 0.35 },
  'vca-comp': { threshold: -20, ratio: 4.5, attack: 0.012, release: 0.18 },
  none: { threshold: 0, ratio: 1, attack: 0.003, release: 0.1 },
};

/**
 * Multitrack transport. Every stem owns a real WebAudio channel strip:
 * input -> modeled mic/EQ color -> low shelf -> high shelf -> compressor -> fader -> pan.
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
    this.assetBuffers = new Map();
    this.realSessionPlaying = false;
    this.bpm = 118;
  }

  get playing() {
    return this.timer !== null || this.realSessionPlaying;
  }

  ensureBus(stem) {
    let bus = this.buses.get(stem.id);
    if (bus) return bus;
    const context = this.audio.context;
    const input = context.createGain();
    const color = context.createBiquadFilter();
    color.type = 'peaking';
    color.frequency.value = 1800;
    color.Q.value = 0.8;
    color.gain.value = 0;
    const low = context.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 180;
    low.gain.value = 0;
    const high = context.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 4200;
    high.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    const fader = context.createGain();
    const pan = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    input.connect(color);
    color.connect(low);
    low.connect(high);
    high.connect(compressor);
    compressor.connect(fader);
    fader.connect(pan ?? this.audio.master);
    pan?.connect(this.audio.master);
    bus = { input, color, low, high, compressor, fader, pan };
    this.buses.set(stem.id, bus);
    this.configureProcessing(stem, bus);
    return bus;
  }

  configureProcessing(stem, bus) {
    const context = this.audio.context;
    if (!context || !bus) return;
    const time = context.currentTime;
    const processing = stem.processing ?? {};
    const mic = MIC_COLOR[processing.mic] ?? { frequency: 1800, gain: 0, q: 0.8 };
    let eqGain = mic.gain;
    if (processing.eq === 'spectra-eq') eqGain += 1.4;
    if (processing.eq === 'broad-musical') eqGain += 2.2;
    bus.color.frequency.setTargetAtTime(mic.frequency, time, 0.03);
    bus.color.Q.setTargetAtTime(mic.q, time, 0.03);
    bus.color.gain.setTargetAtTime(eqGain, time, 0.03);
    const comp = COMP[processing.compressor] ?? COMP.none;
    bus.compressor.threshold.setTargetAtTime(comp.threshold, time, 0.03);
    bus.compressor.ratio.setTargetAtTime(comp.ratio, time, 0.03);
    bus.compressor.attack.setTargetAtTime(comp.attack, time, 0.03);
    bus.compressor.release.setTargetAtTime(comp.release, time, 0.03);
  }

  updateMix(session = this.session) {
    if (!session || !this.audio.context) return;
    const time = this.audio.context.currentTime;
    const activeIds = new Set();
    const anySolo = session.stems.some((stem) => stem.solo);
    for (const stem of session.stems) {
      activeIds.add(stem.id);
      const bus = this.ensureBus(stem);
      this.configureProcessing(stem, bus);
      bus.low.gain.setTargetAtTime((stem.low ?? 0) * 15, time, 0.025);
      bus.high.gain.setTargetAtTime((stem.high ?? 0) * 15, time, 0.025);
      const audible = !stem.mute && (!anySolo || stem.solo);
      bus.fader.gain.setTargetAtTime(audible ? stem.level : 0, time, 0.025);
      if (bus.pan) bus.pan.pan.setTargetAtTime(stem.pan ?? 0, time, 0.025);
    }
    for (const [id, bus] of this.buses) {
      if (activeIds.has(id)) continue;
      for (const node of Object.values(bus)) node?.disconnect?.();
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

  renderDrumEvent(name, bus, when) {
    switch (name) {
      case 'kick':
        this.kick(bus, when);
        break;
      case 'snare':
        this.oscillator(185, 0.09, bus, { type: 'triangle', volume: 0.075, when });
        this.noise(bus, when + 0.008, 0.08, 0.085);
        break;
      case 'closed-hat':
        this.noise(bus, when, 0.035, 0.06);
        break;
      case 'open-hat':
        this.noise(bus, when, 0.14, 0.07);
        break;
      case 'low-tom':
        this.oscillator(112, 0.22, bus, { type: 'sine', volume: 0.1, when });
        break;
      case 'high-tom':
        this.oscillator(176, 0.18, bus, { type: 'sine', volume: 0.085, when });
        break;
      case 'crash':
        this.noise(bus, when, 0.42, 0.08);
        this.oscillator(420, 0.34, bus, { type: 'triangle', volume: 0.035, when });
        break;
    }
  }

  renderPerformance(stem, step, when) {
    const performance = stem.performance;
    if (!performance?.events?.length) return false;
    const bus = this.ensureBus(stem).input;
    const sourceBpm = performance.bpm || this.bpm;
    const stepDuration = 60 / sourceBpm / 4;
    const loopSteps = Math.max(16, Math.min(256, Math.ceil((performance.duration || 4) / stepDuration)));
    const current = step % loopSteps;
    for (const event of performance.events) {
      const eventStep = Math.round((event.time || 0) / stepDuration) % loopSteps;
      if (eventStep !== current) continue;
      if (event.drum) {
        this.renderDrumEvent(event.drum, bus, when);
        continue;
      }
      this.oscillator(event.frequency || 440, performance.noteDuration || 0.42, bus, {
        type: performance.wave || 'triangle',
        volume: performance.volume || 0.065,
        when,
      });
      if (performance.octaveLayer) {
        this.oscillator((event.frequency || 440) * 2, (performance.noteDuration || 0.42) * 0.72, bus, {
          type: 'triangle',
          volume: (performance.volume || 0.065) * 0.22,
          when: when + 0.012,
        });
      }
    }
    return true;
  }

  renderStem(stem, step, when) {
    const bus = this.ensureBus(stem).input;
    const anySolo = this.session?.stems.some((candidate) => candidate.solo);
    if (stem.mute || (anySolo && !stem.solo)) return;
    const recording = this.session?.recordings.get(stem.id);
    if (recording) {
      if (step === 0) {
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
      return;
    }
    if (this.renderPerformance(stem, step, when)) return;
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
        for (const ratio of [1, 1.25, 1.5]) {
          this.oscillator(root * ratio, 0.34, bus, {
            type: 'triangle',
            volume: 0.045,
            when,
          });
        }
      }
      return;
    }
    if (stem.kind === 'synth' || stem.kind === 'keys' || stem.kind === 'vocal') {
      if (step % 8 === 0) {
        const root = step % 16 === 0 ? NOTE.C4 : NOTE.A3;
        for (const ratio of [1, 1.25, 1.5]) {
          this.oscillator(root * ratio, 0.7, bus, {
            type: stem.kind === 'vocal' ? 'sine' : 'sawtooth',
            volume: stem.kind === 'vocal' ? 0.02 : 0.035,
            when,
          });
        }
      }
    }
  }

  async loadAlignedAssets(session) {
    const stems = session.stems.filter((stem) => stem.assetId);
    if (!stems.length || !this.audio.assets) return null;
    const loaded = await Promise.all(
      stems.map(async (stem) => [stem.id, await this.audio.assets.audio(stem.assetId, this.audio.context)]),
    );
    const buffers = new Map(loaded.filter(([, buffer]) => !!buffer));
    return buffers.size === stems.length ? buffers : null;
  }

  startAlignedAssets(session, buffers) {
    const start = this.audio.context.currentTime + 0.06;
    for (const stem of session.stems) {
      if (!stem.assetId) continue;
      const buffer = buffers.get(stem.id);
      if (!buffer) continue;
      const source = this.audio.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.ensureBus(stem).input);
      source.onended = () => {
        source.disconnect();
        this.sources.delete(source);
      };
      this.sources.add(source);
      source.start(start);
    }
    this.realSessionPlaying = true;
    this.audio.setExternalTransport?.('studio', `${session.name} · real multitrack`, 60 / this.bpm / 4, {
      vibe: 0.58,
    });
  }

  async play(session) {
    if (!this.audio.context) return false;
    this.stop();
    this.session = session;
    this.updateMix(session);

    const alignedAssets = await this.loadAlignedAssets(session);
    if (alignedAssets) {
      this.assetBuffers = alignedAssets;
      this.startAlignedAssets(session, alignedAssets);
      return true;
    }

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
        this.step = (this.step + 1) % 256;
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
    this.realSessionPlaying = false;
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
      for (const node of Object.values(bus)) node?.disconnect?.();
    }
    this.buses.clear();
    this.assetBuffers.clear();
    this.session = null;
  }
}
