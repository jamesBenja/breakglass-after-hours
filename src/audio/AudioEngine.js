const TRACKS = {
  'night-bus': { label: 'Playing: Night Bus session', interval: 0.25 },
  'glass-floor': { label: 'DJ: Glass Floor', interval: 0.235 },
  '3am-tool': { label: 'DJ: 3AM Tool', interval: 0.235 },
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** One user-activated AudioContext and master analyser shared across the building. */
export class AudioEngine {
  constructor({ assets, onTrack = () => {}, contextFactory, timers = globalThis } = {}) {
    this.assets = assets;
    this.onTrack = onTrack;
    this.contextFactory =
      contextFactory ?? (() => new (window.AudioContext || window.webkitAudioContext)());
    this.timers = timers;
    this.context = null;
    this.master = null;
    this.environmentFilter = null;
    this.environmentGain = null;
    this.environment = { gain: 1, lowpassHz: 20000, label: 'open' };
    this.analyser = null;
    this.frequencyData = null;
    this.voices = new Map();
    this.nativeMedia = new Map();
    this.timer = null;
    this.trackId = null;
    this.generation = 0;
    this.hatBuffer = null;
    this.externalTransports = new Map();
    this.continuousHums = new Map();
    this.assetVoices = new Map();
    this.assetGenerations = new Map();
    this.sourceBuses = new Map();
    this.sourceEnvironments = new Map();
    this.prioritySource = null;
    this.priorityDuck = 0.32;
  }

  get activeExternalTransport() {
    const values = [...this.externalTransports.values()];
    for (let index = values.length - 1; index >= 0; index--) {
      const transport = values[index];
      if (this.sourceGain(transport.owner) > 0.001) return transport;
    }
    return null;
  }

  get label() {
    return TRACKS[this.trackId]?.label ?? this.activeExternalTransport?.label ?? '';
  }

  get playing() {
    return this.trackId !== null || this.activeExternalTransport !== null;
  }

  setExternalTransport(owner, label, interval = 0.125, metrics = {}) {
    this.externalTransports.delete(owner);
    this.externalTransports.set(owner, {
      owner,
      label,
      interval: Math.max(0.045, Number(interval) || 0.125),
      vibe: clamp(Number(metrics.vibe) || 0.5),
      mixQuality: clamp(Number(metrics.mixQuality) || 0.5),
    });
  }

  updateExternalTransport(owner, patch = {}) {
    const current = this.externalTransports.get(owner);
    if (!current) return false;
    this.externalTransports.set(owner, {
      ...current,
      ...patch,
      vibe: patch.vibe == null ? current.vibe : clamp(Number(patch.vibe) || 0),
      mixQuality:
        patch.mixQuality == null ? current.mixQuality : clamp(Number(patch.mixQuality) || 0),
    });
    return true;
  }

  clearExternalTransport(owner) {
    this.externalTransports.delete(owner);
  }

  setParam(parameter, value, timeConstant = 0.04) {
    if (!parameter) return;
    if (this.context && typeof parameter.setTargetAtTime === 'function')
      parameter.setTargetAtTime(value, this.context.currentTime, timeConstant);
    else parameter.value = value;
  }

  setEnvironment({ gain = 1, lowpassHz = 20000, label = 'open' } = {}) {
    this.environment = {
      gain: clamp(Number(gain) || 0, 0.05, 1.2),
      lowpassHz: clamp(Number(lowpassHz) || 20000, 350, 22000),
      label,
    };
    this.setParam(this.environmentGain?.gain, this.environment.gain, 0.08);
    this.setParam(this.environmentFilter?.frequency, this.environment.lowpassHz, 0.08);
    for (const [owner, media] of this.nativeMedia) {
      media.element.volume = clamp(media.baseVolume * this.sourceGain(owner));
    }
  }

  ensureSourceBus(owner) {
    if (!owner || !this.context || !this.master) return null;
    let bus = this.sourceBuses.get(owner);
    if (bus) return bus;

    const filter = this.context.createBiquadFilter?.() ?? null;
    const gain = this.context.createGain();
    const input = filter ?? gain;
    if (filter) {
      filter.type = 'lowpass';
      filter.Q.value = 0.45;
      filter.connect(gain);
    }
    gain.connect(this.master);
    bus = { input, filter, gain };
    this.sourceBuses.set(owner, bus);
    this.applySourceEnvironment(owner);
    return bus;
  }

  sourceDestination(owner) {
    return this.ensureSourceBus(owner)?.input ?? this.master;
  }

  sourceGain(owner) {
    const environment = this.sourceEnvironments.get(owner) ?? {
      gain: 1,
      lowpassHz: 20000,
      label: 'local source',
    };
    const priority =
      this.prioritySource && owner !== this.prioritySource ? this.priorityDuck : 1;
    return clamp(environment.gain * priority, 0, 1.2);
  }

  applySourceEnvironment(owner) {
    const bus = this.sourceBuses.get(owner);
    const environment = this.sourceEnvironments.get(owner) ?? {
      gain: 1,
      lowpassHz: 20000,
      label: 'local source',
    };
    if (bus) {
      this.setParam(bus.gain?.gain, this.sourceGain(owner), 0.08);
      this.setParam(bus.filter?.frequency, environment.lowpassHz, 0.08);
    }
    const media = this.nativeMedia.get(owner);
    if (media) media.element.volume = clamp(media.baseVolume * this.sourceGain(owner));
  }

  setSourceEnvironment(owner, { gain = 1, lowpassHz = 20000, label = 'local source' } = {}) {
    if (!owner) return;
    this.sourceEnvironments.set(owner, {
      gain: clamp(Number(gain) || 0, 0, 1.2),
      lowpassHz: clamp(Number(lowpassHz) || 20000, 280, 22000),
      label,
    });
    this.applySourceEnvironment(owner);
  }

  setPrioritySource(owner = null, duck = 0.32) {
    this.prioritySource = owner || null;
    this.priorityDuck = clamp(Number(duck) || 0.32, 0.08, 1);
    for (const sourceOwner of this.sourceBuses.keys()) this.applySourceEnvironment(sourceOwner);
    for (const sourceOwner of this.nativeMedia.keys()) this.applySourceEnvironment(sourceOwner);
  }

  async init() {
    if (!this.context) {
      this.context = this.contextFactory();
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      this.environmentFilter = this.context.createBiquadFilter?.() ?? null;
      this.environmentGain = this.context.createGain();
      if (this.environmentFilter) {
        this.environmentFilter.type = 'lowpass';
        this.environmentFilter.frequency.value = this.environment.lowpassHz;
        if (this.environmentFilter.Q) this.environmentFilter.Q.value = 0.45;
        this.master.connect(this.environmentFilter);
        this.environmentFilter.connect(this.environmentGain);
      } else this.master.connect(this.environmentGain);
      this.environmentGain.gain.value = this.environment.gain;
      if (typeof this.context.createAnalyser === 'function') {
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.74;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.environmentGain.connect(this.analyser);
        this.analyser.connect(this.context.destination);
      } else {
        this.environmentGain.connect(this.context.destination);
      }
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /** Serializable signal snapshot for lighting, crowd energy and future multiplayer sync. */
  metrics() {
    if (!this.context || !this.playing)
      return { playing: false, energy: 0, bass: 0, beat: 0, vibe: 0, mixQuality: 0 };

    let energy = 0.46;
    let bass = 0.5;
    if (this.analyser && this.frequencyData) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      let total = 0;
      let low = 0;
      const lowBins = Math.max(2, Math.floor(this.frequencyData.length * 0.12));
      for (let i = 0; i < this.frequencyData.length; i++) {
        const value = this.frequencyData[i] / 255;
        total += value;
        if (i < lowBins) low += value;
      }
      energy = Math.min(1, (total / this.frequencyData.length) * 2.2);
      bass = Math.min(1, (low / lowBins) * 1.8);
    }

    const external = this.activeExternalTransport;
    // Native media streams intentionally bypass WebAudio when Drive denies CORS. Keep lighting
    // and crowd response alive from transport metadata in that fallback path.
    if (external) {
      energy = Math.max(energy, external.vibe * 0.72);
      bass = Math.max(bass, external.vibe * 0.62);
    }
    const interval = TRACKS[this.trackId]?.interval ?? external?.interval ?? 0.25;
    const phase = ((this.context.currentTime % interval) + interval) % interval;
    const transportBeat = Math.max(0, 1 - phase / Math.max(0.045, interval * 0.42));
    const beat = Math.min(1, transportBeat * (0.55 + bass * 0.65));
    const vibe = external?.vibe ?? Math.min(1, 0.35 + energy * 0.65);
    const mixQuality = external?.mixQuality ?? 0.72;
    return { playing: true, energy, bass, beat, vibe, mixQuality };
  }

  voice(source, ...nodes) {
    this.voices.set(source, nodes);
    source.onended = () => {
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      this.voices.delete(source);
    };
  }

  startContinuousHum(owner, { frequency = 124, volume = 0.022, type = 'triangle' } = {}) {
    if (!owner || !this.context || !this.master) return false;
    this.stopContinuousHum(owner, 0);

    const time = this.context.currentTime;
    const masterGain = this.context.createGain();
    const base = this.context.createOscillator();
    const harmonic = this.context.createOscillator();
    const baseGain = this.context.createGain();
    const harmonicGain = this.context.createGain();

    base.type = type;
    base.frequency.value = Math.max(40, Number(frequency) || 124);
    harmonic.type = 'sine';
    harmonic.frequency.value = base.frequency.value * 2.01;

    baseGain.gain.value = 0.82;
    harmonicGain.gain.value = 0.18;

    if (masterGain.gain?.setValueAtTime) {
      masterGain.gain.setValueAtTime(0.0001, time);
      masterGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, Number(volume) || 0.022),
        time + 0.08,
      );
    } else {
      masterGain.gain.value = Math.max(0.0002, Number(volume) || 0.022);
    }

    base.connect(baseGain);
    harmonic.connect(harmonicGain);
    baseGain.connect(masterGain);
    harmonicGain.connect(masterGain);
    masterGain.connect(this.master);

    const hum = {
      sources: [base, harmonic],
      nodes: [baseGain, harmonicGain, masterGain],
      masterGain,
    };
    this.continuousHums.set(owner, hum);

    let ended = 0;
    const cleanup = () => {
      ended += 1;
      if (ended < hum.sources.length) return;
      for (const source of hum.sources) source.disconnect?.();
      for (const node of hum.nodes) node.disconnect?.();
    };
    base.onended = cleanup;
    harmonic.onended = cleanup;
    base.start(time);
    harmonic.start(time);
    return true;
  }

  stopContinuousHum(owner, fadeSeconds = 0.09) {
    const hum = this.continuousHums.get(owner);
    if (!hum) return false;
    this.continuousHums.delete(owner);

    const time = this.context?.currentTime ?? 0;
    const fade = Math.max(0, Number(fadeSeconds) || 0);
    const gain = hum.masterGain?.gain;
    if (gain?.cancelScheduledValues) gain.cancelScheduledValues(time);
    if (gain?.setValueAtTime && gain?.exponentialRampToValueAtTime && fade > 0) {
      gain.setValueAtTime(Math.max(0.0001, gain.value || 0.0001), time);
      gain.exponentialRampToValueAtTime(0.0001, time + fade);
    } else if (gain) {
      gain.value = 0.0001;
    }

    for (const source of hum.sources) {
      try {
        source.stop(time + fade + 0.015);
      } catch {
        source.disconnect?.();
      }
    }
    return true;
  }

  tone(freq = 220, duration = 0.18, type = 'sine', volume = 0.1, when = 0) {
    if (!this.context) return;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    const time = this.context.currentTime + when;
    source.type = type;
    source.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(gain);
    gain.connect(this.master);
    this.voice(source, gain);
    source.start(time);
    source.stop(time + duration + 0.03);
  }

  kick(when = 0, volume = 0.22) {
    if (!this.context) return;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    const time = this.context.currentTime + when;
    source.frequency.setValueAtTime(130, time);
    source.frequency.exponentialRampToValueAtTime(45, time + 0.18);
    gain.gain.setValueAtTime(clamp(Number(volume) || 0.22, 0.001, 0.3), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    source.connect(gain);
    gain.connect(this.master);
    this.voice(source, gain);
    source.start(time);
    source.stop(time + 0.22);
  }

  chord(root = 220, when = 0) {
    [1, 1.25, 1.5].forEach((multiple, i) =>
      this.tone(root * multiple, 0.5, 'triangle', 0.06, when + i * 0.025),
    );
  }

  hat(when = 0, volume = 0.07) {
    if (!this.context) return;
    if (!this.hatBuffer) {
      const length = Math.floor(this.context.sampleRate * 0.04);
      this.hatBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.hatBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.hatBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    gain.gain.value = clamp(Number(volume) || 0.07, 0.001, 0.16);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.voice(source, filter, gain);
    source.start(this.context.currentTime + when);
  }

  pattern(id, step, when) {
    if (id === 'night-bus') {
      if (step % 4 === 0) this.kick(when);
      if (step % 2 === 1) this.hat(when);
      if (step % 8 === 0) this.chord(step % 16 ? 196 : 220, when);
      if (step % 4 === 2) this.tone(step % 8 === 2 ? 73.4 : 82.4, 0.25, 'sawtooth', 0.07, when);
    } else {
      this.kick(when);
      if (step % 2) this.hat(when);
      if (step % 4 === 0)
        this.tone(id === 'glass-floor' ? 110 : 82.4, 0.22, 'sawtooth', 0.075, when);
      if (id === 'glass-floor' && step % 8 === 4) this.chord(247, when);
    }
  }

  async play(id) {
    if (!TRACKS[id] || !this.context) return false;
    this.stop();
    const generation = this.generation;
    const buffer = this.assets ? await this.assets.audio(id, this.context) : null;
    if (generation !== this.generation) return false;
    this.trackId = id;
    this.onTrack(id);
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.master);
      this.voice(source);
      source.start();
    } else {
      let step = 0;
      let nextTime = this.context.currentTime;
      const schedule = () => {
        if (this.context.state !== 'running') return;
        nextTime = Math.max(nextTime, this.context.currentTime);
        while (nextTime < this.context.currentTime + 0.1) {
          this.pattern(id, step, nextTime - this.context.currentTime);
          step = (step + 1) % 16;
          nextTime += TRACKS[id].interval;
        }
      };
      schedule();
      this.timer = this.timers.setInterval(schedule, 25);
    }
    return true;
  }

  async playAsset(
    id,
    { owner = 'archive', label = id, loop = true, vibe = 0.28, baseVolume = 0.82, offset = 0 } = {},
  ) {
    if (!this.context || !this.assets?.entry?.(id)) return false;
    this.stopAsset(owner);
    const generation = (this.assetGenerations.get(owner) ?? 0) + 1;
    this.assetGenerations.set(owner, generation);
    const buffer = await this.assets.audio(id, this.context);
    if (generation !== this.assetGenerations.get(owner)) return false;
    this.setExternalTransport(owner, label, 0.25, { vibe, mixQuality: 0.92 });
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(this.sourceDestination(owner));
      source.onended = () => {
        source.disconnect();
        if (this.assetVoices.get(owner) === source) this.assetVoices.delete(owner);
        if (!loop) this.clearExternalTransport(owner);
      };
      this.assetVoices.set(owner, source);
      const startOffset =
        buffer.duration > 0 ? Math.max(0, Number(offset) || 0) % buffer.duration : 0;
      source.start(0, startOffset);
      return true;
    }

    const url = this.assets.mediaUrl?.(id);
    if (!url || typeof Audio === 'undefined') {
      this.clearExternalTransport(owner);
      return false;
    }
    const element = new Audio();
    element.preload = 'auto';
    element.loop = loop;
    element.playsInline = true;
    element.src = url;
    element.volume = clamp(baseVolume * this.sourceGain(owner));
    const seek = () => {
      if (!(offset > 0)) return;
      try {
        const duration = Number(element.duration);
        element.currentTime =
          Number.isFinite(duration) && duration > 0 ? Number(offset) % duration : Number(offset);
      } catch {
        // Remote media may not expose seeking until metadata is available.
      }
    };
    if (element.readyState >= 1) seek();
    else element.addEventListener?.('loadedmetadata', seek, { once: true });
    try {
      await element.play();
      seek();
      this.nativeMedia.set(owner, { element, baseVolume, owner });
      element.onended = () => {
        this.nativeMedia.delete(owner);
        this.clearExternalTransport(owner);
      };
      return true;
    } catch {
      element.pause();
      element.removeAttribute('src');
      element.load?.();
      this.clearExternalTransport(owner);
      return false;
    }
  }

  stopAsset(owner = 'archive') {
    this.assetGenerations.set(owner, (this.assetGenerations.get(owner) ?? 0) + 1);
    const source = this.assetVoices.get(owner);
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already ended.
      }
      source.disconnect?.();
      this.assetVoices.delete(owner);
    }
    const media = this.nativeMedia.get(owner);
    if (media) {
      media.element.pause();
      media.element.removeAttribute('src');
      media.element.load?.();
      this.nativeMedia.delete(owner);
    }
    this.clearExternalTransport(owner);
  }

  stop() {
    for (const owner of [...this.continuousHums.keys()]) this.stopContinuousHum(owner, 0);
    this.generation++;
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
    this.trackId = null;
    for (const [source, nodes] of this.voices) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // An ended one-shot needs only disconnection.
      }
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    }
    this.voices.clear();
    for (const owner of new Set([...this.assetVoices.keys(), ...this.nativeMedia.keys()])) {
      this.stopAsset(owner);
    }
    this.externalTransports.clear();
  }

  async suspend() {
    if (this.context?.state === 'running') await this.context.suspend();
    for (const media of this.nativeMedia.values()) media.element.pause();
  }

  async resume() {
    if (this.context?.state === 'suspended') await this.context.resume();
    for (const media of this.nativeMedia.values()) {
      try {
        await media.element.play();
      } catch {
        // Browser can require another user gesture; gameplay can continue silently.
      }
    }
  }

  async dispose() {
    this.stop();
    this.externalTransports.clear();
    this.continuousHums.clear();
    this.assetVoices.clear();
    this.assetGenerations.clear();
    for (const bus of this.sourceBuses.values()) {
      bus.input?.disconnect?.();
      bus.filter?.disconnect?.();
      bus.gain?.disconnect?.();
    }
    this.sourceBuses.clear();
    this.sourceEnvironments.clear();
    this.master?.disconnect();
    this.environmentFilter?.disconnect();
    this.environmentGain?.disconnect();
    this.analyser?.disconnect();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.master = null;
    this.environmentFilter = null;
    this.environmentGain = null;
    this.analyser = null;
    this.frequencyData = null;
    this.hatBuffer = null;
  }
}
