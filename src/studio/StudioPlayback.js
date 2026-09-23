import { spectraInputStems } from './SpectraInputs.js';

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

function writeSwitchParam(parameter, value, time) {
  if (!parameter) return;
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    try {
      parameter.cancelAndHoldAtTime(time);
    } catch {
      parameter.cancelScheduledValues?.(time);
    }
  } else {
    parameter.cancelScheduledValues?.(time);
  }
  if (parameter.setValueAtTime) parameter.setValueAtTime(value, time);
  else parameter.value = value;
}

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

function isMicrophoneRecordingStem(stem) {
  return stem?.kind === 'vocal' || stem?.source === 'browser-microphone';
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
    this.blobStems = new Map();
    this.blobUrls = new Map();
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
    this.frozenGates = new Map();
    this.soloFaderActive = false;
  }

  get playing() {
    return (
      this.timer !== null ||
      this.transportUnsubscribe !== null ||
      this.realSessionPlaying ||
      this.nativeStems.size > 0 ||
      this.blobStems.size > 0 ||
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
    const delaySend = context.createGain();
    const delayNode = context.createDelay(1.2);
    const delayFeedback = context.createGain();
    const reverbSend = context.createGain();
    const reverbDelayA = context.createDelay(0.3);
    const reverbDelayB = context.createDelay(0.3);
    const reverbDampingA = context.createBiquadFilter();
    const reverbDampingB = context.createBiquadFilter();
    const reverbFeedbackA = context.createGain();
    const reverbFeedbackB = context.createGain();
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
    const hardMute = context.createGain();
    const meter = typeof context.createAnalyser === 'function' ? context.createAnalyser() : null;
    if (meter) {
      meter.fftSize = 64;
      meter.smoothingTimeConstant = 0.62;
    }
    const spatialPost = hardMute;
    const dry = context.createGain();
    dry.gain.value = 1;
    gate.gain.value = 1;
    hardMute.gain.value = 1;
    fader.connect(channelSum);
    channelSum.connect(gate);
    gate.connect(hardMute);
    if (meter) {
      hardMute.connect(meter);
      meter.connect(dry);
    } else {
      hardMute.connect(dry);
    }
    dry.connect(pan ?? destination);
    pan?.connect(destination);

    delaySend.gain.value = 0;
    delayNode.delayTime.value = 0.25;
    delayFeedback.gain.value = 0.3;
    fader.connect(delaySend);
    delaySend.connect(delayNode);
    delayNode.connect(channelSum);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    reverbSend.gain.value = 0;
    reverbDampingA.type = 'lowpass';
    reverbDampingB.type = 'lowpass';
    reverbDampingA.frequency.value = 9000;
    reverbDampingB.frequency.value = 9000;
    reverbDelayA.delayTime.value = 0.052;
    reverbDelayB.delayTime.value = 0.071;
    reverbFeedbackA.gain.value = 0.48;
    reverbFeedbackB.gain.value = 0.44;
    fader.connect(reverbSend);
    reverbSend.connect(reverbDelayA);
    reverbSend.connect(reverbDelayB);
    reverbDelayA.connect(reverbDampingA);
    reverbDelayB.connect(reverbDampingB);
    reverbDampingA.connect(channelSum);
    reverbDampingB.connect(channelSum);
    reverbDampingA.connect(reverbFeedbackA);
    reverbDampingB.connect(reverbFeedbackB);
    reverbFeedbackA.connect(reverbDelayA);
    reverbFeedbackB.connect(reverbDelayB);

    bus = {
      input,
      color,
      low,
      high,
      compressor,
      fader,
      channelSum,
      gate,
      hardMute,
      meter,
      meterData: meter ? new Float32Array(meter.fftSize) : null,
      spatialPost,
      dry,
      pan,
      delaySend,
      delayNode,
      delayFeedback,
      reverbSend,
      reverbDelayA,
      reverbDelayB,
      reverbDampingA,
      reverbDampingB,
      reverbFeedbackA,
      reverbFeedbackB,
    };
    this.buses.set(stem.id, bus);
    this.configureProcessing(stem, bus);
    this.configureFx(stem, bus, { immediate: true });
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

  configureFx(stem, bus, { immediate = false } = {}) {
    const context = this.audio.context;
    if (!context || !bus) return;
    const time = context.currentTime;
    const settings = stem.fxSettings ?? {};
    const reverb = clamp(stem.reverb ?? (stem.fx ?? 0) * 0.55, 0, 1);
    const delay = clamp(stem.delay ?? stem.fx ?? 0, 0, 1);
    const reverbSize = clamp(settings.reverbSize ?? 0.55, 0, 1);
    const reverbDamping = clamp(settings.reverbDamping ?? 0.35, 0, 1);
    const delayTime = clamp(settings.delayTime ?? 0.25, 0.05, 1.2);
    const delayFeedback = clamp(settings.delayFeedback ?? 0.3, 0, 0.82);

    writeAudioParam(bus.reverbSend?.gain, reverb * 0.3, time, { immediate });
    writeAudioParam(bus.delaySend?.gain, delay * 0.42, time, { immediate });
    writeAudioParam(bus.delayNode?.delayTime, delayTime, time, { immediate });
    writeAudioParam(bus.delayFeedback?.gain, delayFeedback, time, { immediate });

    const dampingHz = 14000 - reverbDamping * 11500;
    const feedback = 0.24 + reverbSize * 0.5;
    writeAudioParam(bus.reverbDampingA?.frequency, dampingHz, time, { immediate });
    writeAudioParam(bus.reverbDampingB?.frequency, dampingHz * 0.92, time, { immediate });
    writeAudioParam(bus.reverbDelayA?.delayTime, 0.025 + reverbSize * 0.055, time, {
      immediate,
    });
    writeAudioParam(bus.reverbDelayB?.delayTime, 0.037 + reverbSize * 0.073, time, {
      immediate,
    });
    writeAudioParam(bus.reverbFeedbackA?.gain, feedback, time, { immediate });
    writeAudioParam(bus.reverbFeedbackB?.gain, Math.max(0, feedback - 0.04), time, {
      immediate,
    });
  }

  applyChannelAudibility(session = this.session) {
    if (!session || !this.audio.context) return false;
    this.anySolo = session.stems.some((stem) => stem.solo === true);
    for (const stem of session.stems) {
      const bus = this.ensureBus(stem);
      const selected = !this.auditionStemId || stem.id === this.auditionStemId;
      const active = selected && stem.clipActive !== false;
      const time = this.audio.context.currentTime;

      // SOLO is implemented by StudioSession as derived MUTE state. There is only one live
      // audibility rule here: the exact same mute path controls manual mute and solo.
      const gateOpen = active && stem.mute !== true;

      const frozenGate = this.frozenGates.get(stem.id);
      if (frozenGate) {
        // Frozen recordings get their own source gate. Keep the shared downstream switch open so
        // Safari cannot accidentally silence the soloed recording while non-solo recordings are
        // being gated off.
        writeSwitchParam(frozenGate.gain, gateOpen ? 1 : 0, time);
        writeSwitchParam(bus?.hardMute?.gain, 1, time);
      } else {
        writeSwitchParam(bus?.hardMute?.gain, gateOpen ? 1 : 0, time);
      }
      writeSwitchParam(bus?.gate?.gain, 1, time);
    }
    this.soloFaderActive = false;
    this.updateNativeMix(session);
    this.updateBlobMix(session);
    return true;
  }

  updateNativeMix(session = this.session) {
    if (!session || !this.nativeStems.size) return;
    const environment = this.audio.sourceGain?.('studio') ?? this.audio.environment?.gain ?? 1;
    for (const stem of session.stems) {
      const media = this.nativeStems.get(stem.id);
      if (!media) continue;
      const selected = !this.auditionStemId || stem.id === this.auditionStemId;
      const active = selected && stem.clipActive !== false;
      const level = active && stem.mute !== true ? stem.level : 0;
      media.volume = clamp(level * environment * 0.88);
    }
  }

  updateBlobMix(session = this.session) {
    if (!session || !this.blobStems.size) return;
    const environment = this.audio.sourceGain?.('studio') ?? this.audio.environment?.gain ?? 1;
    for (const stem of session.stems) {
      const media = this.blobStems.get(stem.id);
      if (!media) continue;
      const selected = !this.auditionStemId || stem.id === this.auditionStemId;
      const active = selected && stem.clipActive !== false;
      media.volume = clamp(active && stem.mute !== true ? stem.level * environment * 0.88 : 0);
    }
  }

  updateStemMix(session = this.session, stemId, { immediate = true } = {}) {
    if (!session || !this.audio.context || !stemId) return false;
    const stem = session.stems.find((item) => item.id === stemId);
    if (!stem) return false;
    const time = this.audio.context.currentTime;
    const bus = this.ensureBus(stem);
    this.configureProcessing(stem, bus);
    writeAudioParam(bus.low.gain, (stem.low ?? 0) * 15, time, { immediate });
    writeAudioParam(bus.high.gain, (stem.high ?? 0) * 15, time, { immediate });
    writeAudioParam(bus.fader.gain, stem.level, time, { immediate });
    this.configureFx(stem, bus, { immediate });
    if (bus.pan) writeAudioParam(bus.pan.pan, stem.pan ?? 0, time, { immediate });
    this.spatialMixer?.updateStem?.(stem, bus, { immediate });
    this.applyChannelAudibility(session);
    return true;
  }

  updateMix(session = this.session, { immediate = false } = {}) {
    if (!session || !this.audio.context) return;
    const time = this.audio.context.currentTime;
    const activeIds = new Set();
    this.anySolo = session.stems.some((stem) => stem.solo === true);
    for (const stem of session.stems) {
      activeIds.add(stem.id);
      const bus = this.ensureBus(stem);
      this.configureProcessing(stem, bus);
      writeAudioParam(bus.low.gain, (stem.low ?? 0) * 15, time, { immediate });
      writeAudioParam(bus.high.gain, (stem.high ?? 0) * 15, time, { immediate });
      writeAudioParam(bus.fader.gain, stem.level, time, { immediate });
      writeSwitchParam(bus.gate.gain, 1, time);
      this.configureFx(stem, bus, { immediate });
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
    const stems = spectraInputStems(session, config, resourceId, { monitoredOnly: true });
    if (!stems.length) return false;
    const delay = Math.max(0, Number(when) || 0);

    for (const stem of stems) {
      const hadBus = this.buses.has(stem.id);
      const busObject = this.ensureBus(stem);
      if (!hadBus) {
        // Initialize newly added input tracks once. Existing monitored channels reuse their
        // Web Audio graph so live performance remains cheap.
        this.updateStemMix?.(session, stem.id, { immediate: true }) ??
          this.updateMix(session, { immediate: true });
      }
      const bus = busObject.input;

      if (event.type === 'drum' && event.name) {
        this.renderDrumEvent(event.name, bus, delay, level);
        continue;
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
        continue;
      }
      if (event.type === 'midi') playMidi(event.midi);
    }
    return event.type === 'drum' || event.type === 'midi' || event.type === 'chord';
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