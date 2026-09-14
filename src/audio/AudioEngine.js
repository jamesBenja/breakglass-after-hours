const TRACKS = {
  'night-bus': { label: 'Playing: Night Bus session', interval: 0.25 },
  'glass-floor': { label: 'DJ: Glass Floor', interval: 0.235 },
  '3am-tool': { label: 'DJ: 3AM Tool', interval: 0.235 },
};

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
    this.analyser = null;
    this.frequencyData = null;
    this.voices = new Map();
    this.timer = null;
    this.trackId = null;
    this.generation = 0;
    this.hatBuffer = null;
    this.externalTransports = new Map();
  }

  get activeExternalTransport() {
    const values = [...this.externalTransports.values()];
    return values[values.length - 1] ?? null;
  }

  get label() {
    return TRACKS[this.trackId]?.label ?? this.activeExternalTransport?.label ?? '';
  }
  get playing() {
    return this.trackId !== null || this.externalTransports.size > 0;
  }

  setExternalTransport(owner, label, interval = 0.125, metrics = {}) {
    this.externalTransports.delete(owner);
    this.externalTransports.set(owner, {
      owner,
      label,
      interval: Math.max(0.045, Number(interval) || 0.125),
      vibe: Math.max(0, Math.min(1, Number(metrics.vibe) || 0.5)),
      mixQuality: Math.max(0, Math.min(1, Number(metrics.mixQuality) || 0.5)),
    });
  }

  updateExternalTransport(owner, patch = {}) {
    const current = this.externalTransports.get(owner);
    if (!current) return false;
    this.externalTransports.set(owner, {
      ...current,
      ...patch,
      vibe: patch.vibe == null ? current.vibe : Math.max(0, Math.min(1, Number(patch.vibe) || 0)),
      mixQuality:
        patch.mixQuality == null
          ? current.mixQuality
          : Math.max(0, Math.min(1, Number(patch.mixQuality) || 0)),
    });
    return true;
  }

  clearExternalTransport(owner) {
    this.externalTransports.delete(owner);
  }

  async init() {
    if (!this.context) {
      this.context = this.contextFactory();
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      if (typeof this.context.createAnalyser === 'function') {
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.74;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.master.connect(this.analyser);
        this.analyser.connect(this.context.destination);
      } else {
        this.master.connect(this.context.destination);
      }
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  /**
   * Serializable signal snapshot for lighting, crowd energy and future multiplayer sync.
   * Every sub-engine routes through the same analyser, while the transport gives a stable beat.
   */
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

  kick(when = 0) {
    if (!this.context) return;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    const time = this.context.currentTime + when;
    source.frequency.setValueAtTime(130, time);
    source.frequency.exponentialRampToValueAtTime(45, time + 0.18);
    gain.gain.setValueAtTime(0.22, time);
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

  hat(when = 0) {
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
    gain.gain.value = 0.07;
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

  stop() {
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
  }

  async suspend() {
    if (this.context?.state === 'running') await this.context.suspend();
  }

  async resume() {
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  async dispose() {
    this.stop();
    this.externalTransports.clear();
    this.master?.disconnect();
    this.analyser?.disconnect();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.master = null;
    this.analyser = null;
    this.frequencyData = null;
    this.hatBuffer = null;
  }
}
