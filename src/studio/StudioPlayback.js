import { spectraInputStem } from './SpectraInputs.js';

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

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const midiToFrequency = (midi) => 440 * Math.pow(2, (Number(midi) - 69) / 12);

function writeAudioParam(parameter, value, time, { immediate = false, timeConstant = 0.025 } = {}) {
  if (!parameter) return;
  parameter.cancelScheduledValues?.(time);
  if (immediate && parameter.setValueAtTime) {
    parameter.setValueAtTime(value, time);
    return;
  }
  if (parameter.setTargetAtTime) parameter.setTargetAtTime(value, time, timeConstant);
  else parameter.value = value;
}

/**
 * Multitrack transport. WebAudio assets get a full channel strip:
 * input -> modeled mic/EQ color -> low shelf -> high shelf -> compressor -> fader -> pan.
 *
 * Remote Drive sources can deny CORS to decodeAudioData. In that case aligned native media
 * elements keep the actual stems/music playable and synchronized closely enough for this
 * prototype, with fader/mute/solo retained. Same-origin web copies restore pan/EQ/processing.
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
    this.nativeStems = new Map();
    this.assetBuffers = new Map();
    this.realSessionPlaying = false;
    this.bpm = 118;
    this.transportOffset = 0;
    this.transportStartedAt = 0;
    this.previewDrumInput = null;
    this.spectraTransport = null;
    this.transportUnsubscribe = null;
    this.spatialMixer = null;
    this.auditionStemId = null;
    this.performanceIndex = new WeakMap();
    this.anySolo = false;
    this.noiseBuffer = null;
    this.noiseBufferContext = null;
    this.frozenSources = new Map();
  }

  get playing() {
    return (
      this.timer !== null ||
      this.transportUnsubscribe !== null ||
      this.realSessionPlaying ||
      this.nativeStems.size > 0 ||
      this.frozenSources.size > 0
    );
  }

  position() {
    if (this.transportUnsubscribe && this.spectraTransport?.running) {
      return this.spectraTransport.position();
    }
    if (this.nativeStems.size) {
      const first = this.nativeStems.values().next().value;
      if (Number.isFinite(first?.currentTime)) return Math.max(0, first.currentTime);
    }
    const offset = Math.max(0, Number(this.transportOffset) || 0);
    if (!this.playing || !this.audio.context) return offset;
    let value = offset + Math.max(0, this.audio.context.currentTime - this.transportStartedAt);
    if (this.session?.loopEnabled) {
      const duration =
        (60 / Math.max(1, this.bpm)) * 4 * Math.max(1, Number(this.session.loopBars) || 4);
      if (duration > 0) value %= duration;
    }
    return value;
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
    const fxGain = context.createGain();
    const fxDelay = context.createDelay(0.5);
    const pan =
      typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
    input.connect(color);
    color.connect(low);
    low.connect(high);
    high.connect(compressor);
    compressor.connect(fader);
    const destination = this.audio.sourceDestination?.('studio') ?? this.audio.master;
    // Keep level automation separate from the final mute/solo gate so channel state is authoritative.
    const channelSum = context.createGain();
    const gate = context.createGain();
    const meter = typeof context.createAnalyser === 'function' ? context.createAnalyser() : null;
    if (meter) {
      meter.fftSize = 128;
      meter.smoothingTimeConstant = 0.68;
    }
    const spatialPost = gate;
    const dry = context.createGain();
    dry.gain.value = 1;
    gate.gain.value = 1;
    fader.connect(channelSum);
    channelSum.connect(gate);
    if (meter) {
      gate.connect(meter);
      meter.connect(dry);
    } else {
      gate.connect(dry);
    }
    dry.connect(pan ?? destination);
    pan?.connect(destination);
    fxGain.gain.value = 0;
    fxDelay.delayTime.value = 0.18;
    fader.connect(fxGain);
    fxGain.connect(fxDelay);
    fxDelay.connect(channelSum);
    bus = {
      input,
      color,
      low,
      high,
      compressor,
      fader,
      channelSum,
      gate,
      meter,
      meterData: meter ? new Float32Array(meter.fftSize) : null,
      spatialPost,
      dry,
      pan,
      fxGain,
      fxDelay,
    };
    this.buses.set(stem.id, bus);
    this.configureProcessing(stem, bus);
    return bus;
  }

  configureProcessing(stem, bus) {
    const context = this.audio.context;
    if (!context || !bus) return;
    const processing = stem.processing ?? {};
    const processingKey = [
      processing.mic ?? '',
      processing.eq ?? '',
      processing.compressor ?? '',
    ].join('|');
    if (bus.processingKey === processingKey) return;
    bus.processingKey = processingKey;
    const time = context.currentTime;
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

  applyChannelAudibility(session = this.session) {
    if (!session || !this.audio.context) return false;
    const anySolo = session.stems.some((stem) => stem.solo);
    this.anySolo = anySolo;
    for (const stem of session.stems) {
      const bus = this.ensureBus(stem);
      const selected = !this.auditionStemId || stem.id === this.auditionStemId;
      const audible =
        selected && stem.clipActive !== false && !stem.mute && (!anySolo || stem.solo);
      const gain = bus?.gate?.gain;
      if (gain) {
        const time = this.audio.context.currentTime;
        gain.cancelScheduledValues?.(time);
        // Direct assignment is intentional here. Mute/solo are switches, not automation,
        // and must affect the already-sounding bus immediately on Safari as well as desktop.
        gain.value = audible ? 1 : 0;
      }
    }
    this.updateNativeMix(session);
    return true;
  }

  updateNativeMix(session = this.session) {
    if (!session || !this.nativeStems.size) return;
    const anySolo = session.stems.some((stem) => stem.solo);
    const environment = this.audio.sourceGain?.('studio') ?? this.audio.environment?.gain ?? 1;
    for (const stem of session.stems) {
      const media = this.nativeStems.get(stem.id);
      if (!media) continue;
      const selected = !this.auditionStemId || stem.id === this.auditionStemId;
      const audible =
        selected && stem.clipActive !== false && !stem.mute && (!anySolo || stem.solo);
      media.volume = clamp((audible ? stem.level : 0) * environment * 0.88);
    }
  }

  updateMix(session = this.session, { immediate = false } = {}) {
    if (!session || !this.audio.context) return;
    const time = this.audio.context.currentTime;
    const activeIds = new Set();
    const anySolo = session.stems.some((stem) => stem.solo);
    this.anySolo = anySolo;
    for (const stem of session.stems) {
      activeIds.add(stem.id);
      const bus = this.ensureBus(stem);
      this.configureProcessing(stem, bus);
      writeAudioParam(bus.low.gain, (stem.low ?? 0) * 15, time, { immediate });
      writeAudioParam(bus.high.gain, (stem.high ?? 0) * 15, time, { immediate });
      const selected = !this.auditionStemId || stem.id === this.auditionStemId;
      const audible =
        selected && stem.clipActive !== false && !stem.mute && (!anySolo || stem.solo);
      writeAudioParam(bus.fader.gain, stem.level, time, { immediate });
      bus.gate.gain.value = audible ? 1 : 0;
      writeAudioParam(bus.fxGain.gain, (stem.fx ?? 0) * 0.38, time, { immediate });
      if (bus.pan) writeAudioParam(bus.pan.pan, stem.pan ?? 0, time, { immediate });
      this.spatialMixer?.updateStem?.(stem, bus, { immediate });
    }
    for (const [id, bus] of this.buses) {
      if (activeIds.has(id)) continue;
      for (const node of Object.values(bus)) node?.disconnect?.();
      this.buses.delete(id);
    }
    this.spatialMixer?.sync?.(session, this.buses);
    this.applyChannelAudibility(session);
    return true;
  }

  applyLiveMix(session = this.session) {
    return this.updateMix(session, { immediate: true });
  }

  busMeterLevel(bus) {
    const analyser = bus?.meter;
    const data = bus?.meterData;
    if (!analyser || !data || typeof analyser.getFloatTimeDomainData !== 'function') return 0;
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    let sum = 0;
    for (let index = 0; index < data.length; index += 1) {
      const value = data[index];
      const absolute = Math.abs(value);
      if (absolute > peak) peak = absolute;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / Math.max(1, data.length));
    const level = Math.max(peak * 0.72, rms * 1.55);
    return clamp(level, 0, 1);
  }

  meterSnapshot(session = this.session) {
    const channels = {};
    let leftPower = 0;
    let rightPower = 0;
    for (const stem of session?.stems ?? []) {
      const bus = this.buses.get(stem.id);
      const level = this.busMeterLevel(bus);
      channels[stem.id] = level;
      const pan = clamp(Number(stem.pan) || 0, -1, 1);
      const angle = ((pan + 1) * Math.PI) / 4;
      const left = level * Math.cos(angle);
      const right = level * Math.sin(angle);
      leftPower += left * left;
      rightPower += right * right;
    }
    return {
      channels,
      master: {
        left: clamp(Math.sqrt(leftPower), 0, 1),
        right: clamp(Math.sqrt(rightPower), 0, 1),
      },
    };
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

  sweptOscillator(
    startFrequency,
    endFrequency,
    duration,
    destination,
    { type = 'sine', volume = 0.16, when = 0 } = {},
  ) {
    const context = this.audio.context;
    const source = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + when;
    source.type = type;
    source.frequency.setValueAtTime(Math.max(20, startFrequency), start);
    source.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      start + Math.max(0.02, duration),
    );
    gain.gain.setValueAtTime(Math.max(0.0002, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + Math.max(0.03, duration));
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

  kick(destination, when = 0, level = 1) {
    const context = this.audio.context;
    const source = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + when;
    source.frequency.setValueAtTime(125, start);
    source.frequency.exponentialRampToValueAtTime(42, start + 0.18);
    gain.gain.setValueAtTime(0.23 * clamp(level, 0, 1.5), start);
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

  sharedNoiseBuffer() {
    const context = this.audio.context;
    if (!context) return null;
    if (this.noiseBuffer && this.noiseBufferContext === context) return this.noiseBuffer;
    const duration = 1;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    this.noiseBufferContext = context;
    return buffer;
  }

  noise(destination, when = 0, duration = 0.05, volume = 0.05) {
    const context = this.audio.context;
    const buffer = this.sharedNoiseBuffer();
    if (!context || !buffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const start = context.currentTime + when;
    const safeDuration = Math.max(0.012, Math.min(Number(duration) || 0.05, buffer.duration));
    const maxOffset = Math.max(0, buffer.duration - safeDuration);
    const offset = maxOffset > 0 ? Math.random() * maxOffset : 0;
    filter.type = 'highpass';
    filter.frequency.value = 3200;
    gain.gain.setValueAtTime(Math.max(0.0002, Number(volume) || 0.05), start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + safeDuration);
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
    source.start(start, offset, safeDuration);
  }

  drumPreviewDestination() {
    if (!this.audio.context) return null;
    if (this.previewDrumInput?.context !== this.audio.context) {
      this.previewDrumInput?.disconnect?.();
      this.previewDrumInput = null;
    }
    if (!this.previewDrumInput) {
      this.previewDrumInput = this.audio.context.createGain();
      this.previewDrumInput.gain.value = 0.82;
      this.previewDrumInput.connect(this.audio.sourceDestination?.('studio') ?? this.audio.master);
    }
    return this.previewDrumInput;
  }

  playDrumEvent(name, when = 0, level = 1) {
    const destination = this.drumPreviewDestination();
    if (!destination) return false;
    this.renderDrumEvent(name, destination, Math.max(0, Number(when) || 0), level);
    return true;
  }

  monitorLiveEvent(
    session,
    config = {},
    event = {},
    { resourceId = '', when = 0, level = 1 } = {},
  ) {
    if (!this.audio.context || !session) return false;
    const stem = spectraInputStem(session, config, resourceId);
    if (!stem || stem.monitor === false) return false;
    const hadBus = this.buses.has(stem.id);
    const busObject = this.ensureBus(stem);
    if (!hadBus) {
      // Initialize the channel strip once. Subsequent monitored hits go straight through the
      // existing Web Audio graph; control moves update the graph independently via applyLiveMix.
      this.updateMix(session, { immediate: true });
    }
    const bus = busObject.input;
    const delay = Math.max(0, Number(when) || 0);

    if (event.type === 'drum' && event.name) {
      this.renderDrumEvent(event.name, bus, delay, level);
      return true;
    }

    const playMidi = (midi, offset = 0) => {
      const frequency = midiToFrequency(midi);
      this.oscillator(frequency, Number(config.duration) || 0.42, bus, {
        type: config.wave || 'triangle',
        volume: (Number(config.volume) || 0.065) * clamp(Number(level) || 0, 0, 1.5),
        when: delay + offset,
      });
      if (config.octaveLayer) {
        this.oscillator(frequency * 2, (Number(config.duration) || 0.42) * 0.72, bus, {
          type: 'triangle',
          volume: (Number(config.volume) || 0.065) * 0.22 * clamp(Number(level) || 0, 0, 1.5),
          when: delay + offset + 0.012,
        });
      }
    };

    if (event.type === 'chord' && Array.isArray(event.midis)) {
      const notes = event.direction === 'up' ? [...event.midis].reverse() : event.midis;
      notes.slice(0, 8).forEach((midi, index) => playMidi(midi, index * 0.021));
      return true;
    }
    if (event.type === 'midi') {
      playMidi(event.midi);
      return true;
    }
    return false;
  }

  renderDrumEvent(name, bus, when, gain = 1) {
    const raw = String(name || '').toLowerCase();
    const accent = raw.endsWith('-accent');
    const normalized = accent ? raw.slice(0, -7) : raw;
    const match = normalized.match(/^(808|909|dmx|linn)-(.+)$/);
    const level = clamp(Number(gain) || 0, 0, 1.5) * (accent ? 1.2 : 1);

    if (match) {
      const kit = match[1];
      const voice = match[2];
      const profiles = {
        808: { kick: [168, 42, 0.42, 0.23], snare: [172, 0.11, 0.07, 0.075], tom: 104 },
        909: { kick: [148, 48, 0.25, 0.245], snare: [196, 0.085, 0.085, 0.095], tom: 118 },
        dmx: { kick: [122, 52, 0.18, 0.21], snare: [212, 0.075, 0.07, 0.08], tom: 126 },
        linn: { kick: [112, 54, 0.16, 0.19], snare: [188, 0.095, 0.065, 0.075], tom: 132 },
      };
      const profile = profiles[kit];

      if (voice === 'kick') {
        this.sweptOscillator(profile.kick[0], profile.kick[1], profile.kick[2], bus, {
          type: kit === 'dmx' ? 'triangle' : 'sine',
          volume: profile.kick[3] * level,
          when,
        });
        if (kit !== '808') this.noise(bus, when, 0.018, (kit === '909' ? 0.028 : 0.018) * level);
        return;
      }
      if (voice === 'snare') {
        this.oscillator(profile.snare[0], profile.snare[1], bus, {
          type: kit === 'dmx' ? 'square' : 'triangle',
          volume: profile.snare[2] * level,
          when,
        });
        this.noise(bus, when + 0.006, kit === '909' ? 0.11 : 0.085, profile.snare[3] * level);
        return;
      }
      if (voice === 'clap') {
        const volume = (kit === '909' ? 0.09 : kit === 'dmx' ? 0.075 : 0.065) * level;
        for (const offset of [0, 0.013, 0.027]) this.noise(bus, when + offset, 0.028, volume);
        this.noise(bus, when + 0.042, kit === 'linn' ? 0.07 : 0.1, volume * 0.72);
        return;
      }
      if (voice === 'closed-hat') {
        this.noise(
          bus,
          when,
          kit === '808' ? 0.032 : 0.042,
          (kit === '909' ? 0.075 : 0.06) * level,
        );
        return;
      }
      if (voice === 'open-hat') {
        this.noise(bus, when, kit === '909' ? 0.19 : 0.145, (kit === '909' ? 0.08 : 0.067) * level);
        return;
      }
      if (voice === 'low-tom') {
        this.sweptOscillator(profile.tom * 1.15, profile.tom, kit === '808' ? 0.31 : 0.2, bus, {
          type: 'sine',
          volume: 0.1 * level,
          when,
        });
        return;
      }
      if (voice === 'cowbell') {
        const root = kit === '808' ? 540 : kit === '909' ? 610 : kit === 'dmx' ? 585 : 515;
        this.oscillator(root, 0.11, bus, { type: 'square', volume: 0.045 * level, when });
        this.oscillator(root * 1.48, 0.09, bus, {
          type: 'square',
          volume: 0.03 * level,
          when: when + 0.002,
        });
        return;
      }
      if (voice === 'rim') {
        const frequency = kit === 'linn' ? 1420 : kit === 'dmx' ? 1760 : 1580;
        this.oscillator(frequency, 0.035, bus, {
          type: 'triangle',
          volume: 0.065 * level,
          when,
        });
        this.noise(bus, when, 0.022, 0.025 * level);
        return;
      }
    }

    switch (normalized) {
      case 'kick':
        this.kick(bus, when, level);
        break;
      case 'snare':
        this.oscillator(185, 0.09, bus, {
          type: 'triangle',
          volume: 0.075 * level,
          when,
        });
        this.noise(bus, when + 0.008, 0.08, 0.085 * level);
        break;
      case 'closed-hat':
        this.noise(bus, when, 0.035, 0.06 * level);
        break;
      case 'open-hat':
        this.noise(bus, when, 0.14, 0.07 * level);
        break;
      case 'low-tom':
        this.oscillator(112, 0.22, bus, { type: 'sine', volume: 0.1 * level, when });
        break;
      case 'high-tom':
        this.oscillator(176, 0.18, bus, { type: 'sine', volume: 0.085 * level, when });
        break;
      case 'crash':
        this.noise(bus, when, 0.42, 0.08 * level);
        this.oscillator(420, 0.34, bus, {
          type: 'triangle',
          volume: 0.035 * level,
          when,
        });
        break;
    }
  }

  performanceEventsForStep(stem, performance, step, loopSteps, sourceStepDuration) {
    let cache = this.performanceIndex.get(performance);
    if (
      !cache ||
      cache.events !== performance.events ||
      cache.loopSteps !== loopSteps ||
      cache.stepDuration !== sourceStepDuration
    ) {
      const byStep = new Map();
      for (const event of performance.events) {
        const eventTime = Math.max(0, Number(event.time) || 0);
        const absoluteStep = Math.round(eventTime / sourceStepDuration);
        const eventStep = ((absoluteStep % loopSteps) + loopSteps) % loopSteps;
        const microOffset = Math.max(0, eventTime - absoluteStep * sourceStepDuration);
        const bucket = byStep.get(eventStep) ?? [];
        bucket.push({ event, microOffset });
        byStep.set(eventStep, bucket);
      }
      cache = {
        events: performance.events,
        loopSteps,
        stepDuration: sourceStepDuration,
        byStep,
      };
      this.performanceIndex.set(performance, cache);
    }
    return cache.byStep.get(((step % loopSteps) + loopSteps) % loopSteps) ?? [];
  }

  renderPerformance(stem, step, when) {
    const performance = stem.performance;
    if (!performance?.events?.length) return false;
    const bus = this.ensureBus(stem).input;
    const sourceBpm = performance.bpm || this.bpm;
    const sourceStepDuration = 60 / sourceBpm / 4;
    const loopSteps = this.session?.loopEnabled
      ? Math.max(16, Math.max(1, Number(this.session.loopBars) || 4) * 16)
      : Math.max(16, Math.min(256, Math.ceil((performance.duration || 4) / sourceStepDuration)));
    const events = this.performanceEventsForStep(
      stem,
      performance,
      step,
      loopSteps,
      sourceStepDuration,
    );

    for (const { event, microOffset } of events) {
      const eventWhen = when + microOffset;
      if (event.drum) {
        this.renderDrumEvent(event.drum, bus, eventWhen);
        continue;
      }
      this.oscillator(event.frequency || 440, performance.noteDuration || 0.42, bus, {
        type: performance.wave || 'triangle',
        volume: performance.volume || 0.065,
        when: eventWhen,
      });
      if (performance.octaveLayer) {
        this.oscillator(
          (event.frequency || 440) * 2,
          (performance.noteDuration || 0.42) * 0.72,
          bus,
          {
            type: 'triangle',
            volume: (performance.volume || 0.065) * 0.22,
            when: eventWhen + 0.012,
          },
        );
      }
    }
    return true;
  }

  renderStem(stem, step, when) {
    if (this.auditionStemId && stem.id !== this.auditionStemId) return;
    const bus = this.ensureBus(stem).input;
    if (stem.clipActive === false || stem.mute || (this.anySolo && !stem.solo)) return;
    const recording = this.session?.recordings.get(stem.id);
    if (recording) return;
    if (this.renderPerformance(stem, step, when)) return;
    // Empty input channels are monitor paths, not canned backing generators.
    if (stem.inputKey) return;
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

  hasEventPlayback(session = this.session) {
    return (session?.stems ?? []).some((stem) => {
      if (session?.recordings?.has?.(stem.id)) return false;
      if (stem.performance?.events?.length) return true;
      if (stem.inputKey) return false;
      return !stem.assetId;
    });
  }

  startFrozenRecordings(session, offset = 0, { startTime = null, phaseOffset = null } = {}) {
    const context = this.audio.context;
    if (!context || !session?.recordings?.size) return 0;
    const now = context.currentTime;
    const start =
      Number.isFinite(Number(startTime)) && Number(startTime) >= now
        ? Number(startTime)
        : now + 0.045;
    const loopDuration = session.loopEnabled
      ? (60 / Math.max(1, Number(session.bpm) || this.bpm)) *
        4 *
        Math.max(1, Number(session.loopBars) || 4)
      : null;
    const phase = Number.isFinite(Number(phaseOffset))
      ? Math.max(0, Number(phaseOffset))
      : this.spectraTransport?.running
        ? this.spectraTransport.positionAtOffset(start - now)
        : Math.max(0, Number(offset) || 0);

    let started = 0;
    for (const stem of session.stems) {
      const buffer = session.recordings.get(stem.id);
      if (!buffer?.duration) continue;
      const existing = this.frozenSources.get(stem.id);
      if (existing) {
        try {
          existing.stop();
        } catch {
          // Already stopped.
        }
        existing.disconnect?.();
        this.sources.delete(existing);
      }

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = session.loopEnabled === true;
      if (source.loop) {
        source.loopStart = 0;
        source.loopEnd = Math.min(buffer.duration, loopDuration || buffer.duration);
      }
      source.connect(this.ensureBus(stem).input);
      source.onended = () => {
        source.disconnect?.();
        this.sources.delete(source);
        if (this.frozenSources.get(stem.id) === source) this.frozenSources.delete(stem.id);
      };
      this.sources.add(source);
      this.frozenSources.set(stem.id, source);

      const playableDuration =
        source.loop && source.loopEnd > 0 ? source.loopEnd : Math.max(0.001, buffer.duration);
      const startOffset = playableDuration > 0 ? phase % playableDuration : 0;
      source.start(start, startOffset);
      started += 1;
    }
    return started;
  }

  async loadAlignedAssets(session) {
    const stems = session.stems.filter((stem) => stem.assetId);
    if (!stems.length || stems.length !== session.stems.length || !this.audio.assets) return null;
    const loaded = await Promise.all(
      stems.map(async (stem) => [
        stem.id,
        await this.audio.assets.audio(stem.assetId, this.audio.context),
      ]),
    );
    const buffers = new Map(loaded.filter(([, buffer]) => !!buffer));
    return buffers.size === stems.length ? buffers : null;
  }

  startAlignedAssets(session, buffers, offset = 0) {
    const start = this.audio.context.currentTime + 0.06;
    const safeOffset = Math.max(0, Number(offset) || 0);
    const phaseOffset = this.spectraTransport?.running
      ? this.spectraTransport.positionAtOffset(start - this.audio.context.currentTime)
      : safeOffset;
    this.transportOffset = phaseOffset;
    this.transportStartedAt = start;
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
      const startOffset = buffer.duration > 0 ? phaseOffset % buffer.duration : 0;
      source.start(start, startOffset);
    }
    this.realSessionPlaying = true;
    this.audio.setExternalTransport?.(
      'studio',
      `${session.name} · real multitrack`,
      60 / this.bpm / 4,
      {
        vibe: 0.58,
        mixQuality: 0.92,
      },
    );
  }

  async startNativeAssets(session, offset = 0) {
    if (typeof Audio === 'undefined' || !this.audio.assets?.mediaUrl) return false;
    const safeOffset = Math.max(0, Number(offset) || 0);
    this.transportOffset = safeOffset;
    this.transportStartedAt = this.audio.context?.currentTime ?? 0;
    const stems = session.stems.filter((stem) => stem.assetId);
    if (!stems.length || stems.length !== session.stems.length) return false;
    const created = [];
    for (const stem of stems) {
      const url = this.audio.assets.mediaUrl(stem.assetId);
      if (!url) {
        for (const [, media] of created) media.pause();
        return false;
      }
      const media = new Audio();
      media.preload = 'auto';
      media.loop = true;
      media.playsInline = true;
      media.src = url;
      media.volume = 0;
      const seek = () => {
        if (!(safeOffset > 0)) return;
        try {
          const duration = Number(media.duration);
          media.currentTime =
            Number.isFinite(duration) && duration > 0 ? safeOffset % duration : safeOffset;
        } catch {
          // loadedmetadata will try again when a remote source delays seekability.
        }
      };
      if (media.readyState >= 1) seek();
      else media.addEventListener?.('loadedmetadata', seek, { once: true });
      created.push([stem.id, media]);
    }
    try {
      await Promise.all(created.map(([, media]) => media.play()));
    } catch {
      for (const [, media] of created) {
        media.pause();
        media.removeAttribute('src');
        media.load?.();
      }
      return false;
    }
    this.nativeStems = new Map(created);
    if (this.spectraTransport?.running) {
      const phase = this.spectraTransport.position();
      for (const media of this.nativeStems.values()) {
        try {
          const duration = Number(media.duration);
          media.currentTime = Number.isFinite(duration) && duration > 0 ? phase % duration : phase;
        } catch {
          // The periodic native sync pass retries once the stream becomes seekable.
        }
      }
    }
    this.realSessionPlaying = true;
    this.updateNativeMix(session);
    this.audio.setExternalTransport?.(
      'studio',
      `${session.name} · real archive stream`,
      60 / this.bpm / 4,
      {
        vibe: 0.58,
        mixQuality: 0.88,
      },
    );
    return true;
  }

  async play(session, offset = 0, { stemId = null, restartTransport = false } = {}) {
    if (!this.audio.context) return false;
    this.stop();
    this.auditionStemId = stemId || null;
    const requestedOffset = Math.max(0, Number(offset) || 0);
    this.session = session;
    this.bpm = session.bpm ?? 118;
    this.updateMix(session);

    let safeOffset = requestedOffset;
    let sharedStartTime = null;
    if (this.spectraTransport) {
      safeOffset = this.spectraTransport.running
        ? this.spectraTransport.position()
        : requestedOffset;
      if (this.hasEventPlayback(session)) {
        this.transportUnsubscribe = this.spectraTransport.subscribe(
          'studio-playback',
          (transportEvent) => {
            if (this.session !== session || this.realSessionPlaying || this.nativeStems.size)
              return;
            for (const stem of session.stems) {
              if (session.recordings.has(stem.id)) continue;
              this.renderStem(stem, transportEvent.loopStep, transportEvent.when);
            }
          },
        );
      }
      this.spectraTransport.acquire('studio-playback', { position: safeOffset });
      if (restartTransport) {
        safeOffset = requestedOffset;
        sharedStartTime = this.audio.context.currentTime + 0.06;
        this.spectraTransport.restart(safeOffset, sharedStartTime);
      }
      this.transportOffset = safeOffset;
      this.transportStartedAt =
        this.audio.context.currentTime - Math.max(0, this.spectraTransport.position());
    } else {
      this.transportOffset = safeOffset;
      this.transportStartedAt = this.audio.context.currentTime;
    }

    const alignedAssets = await this.loadAlignedAssets(session);
    if (alignedAssets) {
      this.assetBuffers = alignedAssets;
      const alignedOffset = this.spectraTransport?.running
        ? this.spectraTransport.position()
        : safeOffset;
      this.startAlignedAssets(session, alignedAssets, alignedOffset);
      return true;
    }
    const nativeOffset = this.spectraTransport?.running
      ? this.spectraTransport.position()
      : safeOffset;
    if (await this.startNativeAssets(session, nativeOffset)) return true;

    const frozenCount = this.startFrozenRecordings(session, safeOffset, {
      startTime: sharedStartTime,
      phaseOffset: restartTransport ? safeOffset : null,
    });

    const interval = 60 / this.bpm / 4;
    this.audio.setExternalTransport?.('studio', 'Studio session mix', interval, { vibe: 0.48 });

    if (this.spectraTransport) return true;

    this.step = Math.floor(safeOffset / interval) % 256;
    const remainder = safeOffset % interval;
    this.nextTime = this.audio.context.currentTime + (remainder > 0 ? interval - remainder : 0);
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
    if (this.transportUnsubscribe) this.transportUnsubscribe();
    this.transportUnsubscribe = null;
    this.spectraTransport?.release?.('studio-playback');
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
    this.frozenSources.clear();
    for (const media of this.nativeStems.values()) {
      media.pause();
      media.removeAttribute('src');
      media.load?.();
    }
    this.nativeStems.clear();
    this.transportOffset = 0;
    this.transportStartedAt = 0;
    this.audio.clearExternalTransport?.('studio');
    this.auditionStemId = null;
  }

  dispose() {
    this.stop();
    for (const bus of this.buses.values()) {
      for (const node of Object.values(bus)) node?.disconnect?.();
    }
    this.buses.clear();
    this.previewDrumInput?.disconnect?.();
    this.previewDrumInput = null;
    this.assetBuffers.clear();
    this.performanceIndex = new WeakMap();
    this.noiseBuffer = null;
    this.noiseBufferContext = null;
    this.session = null;
  }
}
