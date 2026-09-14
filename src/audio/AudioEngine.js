const TRACKS = {
  'night-bus': { label: 'Playing: Night Bus session', interval: 0.25 },
  'glass-floor': { label: 'DJ: Glass Floor', interval: 0.235 },
  '3am-tool': { label: 'DJ: 3AM Tool', interval: 0.235 },
};

/** One user-activated AudioContext and transport shared across both scenes. */
export class AudioEngine {
  constructor({ assets, onTrack = () => {}, contextFactory, timers = globalThis } = {}) {
    this.assets = assets;
    this.onTrack = onTrack;
    this.contextFactory =
      contextFactory ?? (() => new (window.AudioContext || window.webkitAudioContext)());
    this.timers = timers;
    this.context = null;
    this.master = null;
    this.voices = new Map();
    this.timer = null;
    this.trackId = null;
    this.generation = 0;
    this.hatBuffer = null;
  }

  get label() {
    return TRACKS[this.trackId]?.label ?? '';
  }
  get playing() {
    return this.trackId !== null;
  }

  async init() {
    if (!this.context) {
      this.context = this.contextFactory();
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
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
    // Stop or a later selection wins over a slow asset request.
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
        // Recover from a delayed background tick without a burst of stale notes.
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
        /* An ended one-shot needs only disconnection. */
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
    this.master?.disconnect();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.hatBuffer = null;
  }
}
