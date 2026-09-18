const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const DJ_TRACKS = [
  { id: 'glass-floor', label: 'Glass Floor · prototype tool', bpm: 128, energy: 0.72, key: 'Dm' },
  { id: '3am-tool', label: '3AM Tool · prototype tool', bpm: 128, energy: 0.82, key: 'Fm' },
  {
    id: 'got-you-dancin',
    label: 'DJ Swisha × James Benjamin · Got U Dancin',
    bpm: 130,
    energy: 0.88,
    key: 'Gm',
    real: true,
  },
  {
    id: 'in-flux-just-be',
    label: 'James Benjamin × Jamvvis · Just Be',
    bpm: 126,
    energy: 0.7,
    key: 'Am',
    real: true,
  },
  {
    id: 'in-flux-breath',
    label: 'James Benjamin × Jamvvis · Breath',
    bpm: 126,
    energy: 0.68,
    key: 'Am',
    real: true,
  },
  {
    id: 'in-flux-break',
    label: 'James Benjamin × Jamvvis · Break',
    bpm: 126,
    energy: 0.76,
    key: 'Am',
    real: true,
  },
  {
    id: 'in-flux-gingele',
    label: 'James Benjamin × Jamvvis · Gingele',
    bpm: 126,
    energy: 0.74,
    key: 'Am',
    real: true,
  },
  { id: 'atrakar', label: 'Jashim · ATRAKAR', bpm: 128, energy: 0.8, key: 'Cm', real: true },
  { id: 'dubki', label: 'Boogaloo Jones · Dubki', bpm: 124, energy: 0.66, key: 'Em', real: true },
  {
    id: 'paharpur',
    label: 'Boogaloo Jones · Paharpur',
    bpm: 124,
    energy: 0.68,
    key: 'Em',
    real: true,
  },
  { id: 'fakir', label: 'Boogaloo Jones · Fakir', bpm: 124, energy: 0.7, key: 'Em', real: true },
  { id: 'bhab', label: 'Boogaloo Jones · Bhab', bpm: 124, energy: 0.72, key: 'Em', real: true },

  {
    id: 'team-break',
    label: 'James Benjamin · Team Break',
    bpm: 95.7,
    energy: 0.66,
    key: '—',
    real: true,
  },
  {
    id: 'ancillary-things',
    label: 'James Benjamin · Ancillary Things',
    bpm: 143.55,
    energy: 0.82,
    key: '—',
    real: true,
  },
  {
    id: 'gairage',
    label: 'James Benjamin × Jamvvis · Gairage',
    bpm: 152,
    energy: 0.86,
    key: '—',
    real: true,
  },
  {
    id: 'hit-the-floor',
    label: 'James Benjamin ft Star Amerasu + Kizaba · Hit the Floor',
    bpm: 129.2,
    energy: 0.9,
    key: '—',
    real: true,
  },
  {
    id: 'chi-town-drop',
    label: 'James Benjamin ft AmirSaysNothing · Chi Town Drop',
    bpm: 136,
    energy: 0.88,
    key: '—',
    real: true,
  },
  {
    id: 'guestlist-andy-s',
    label: 'James Benjamin ft Andy S · Guestlist',
    bpm: 143.55,
    energy: 0.84,
    key: '—',
    real: true,
  },
  {
    id: 'drop-in',
    label: 'James Benjamin · Drop In',
    bpm: 92.29,
    energy: 0.72,
    key: '—',
    real: true,
  },
  {
    id: 'body-check',
    label: 'James Benjamin · Body Check',
    bpm: 103.36,
    energy: 0.76,
    key: '—',
    real: true,
  },
  {
    id: 'play-ball-people',
    label: 'James Benjamin · Play Ball (People)',
    bpm: 143.55,
    energy: 0.9,
    key: '—',
    real: true,
  },
  {
    id: 'etcetera',
    label: 'James Benjamin · Etcetera',
    bpm: 92.29,
    energy: 0.72,
    key: '—',
    real: true,
  },
  {
    id: 'airtime-express',
    label: 'James Benjamin · Airtime Express',
    bpm: 99.38,
    energy: 0.7,
    key: '—',
    real: true,
  },
  {
    id: 'rotations-the-roll',
    label: 'Boogieman · The Roll',
    bpm: 117.45,
    energy: 0.64,
    key: '—',
    real: true,
  },
  {
    id: 'rotations-den-naben',
    label: 'Boogieman · Den Naben',
    bpm: 107.67,
    energy: 0.58,
    key: '—',
    real: true,
  },
  {
    id: 'rotations-water-is-boiling',
    label: 'Boogieman · Water Is Boiling',
    bpm: 99.38,
    energy: 0.62,
    key: '—',
    real: true,
  },
  {
    id: 'rotations-adjust',
    label: 'Boogieman · Adjust',
    bpm: 136,
    energy: 0.8,
    key: '—',
    real: true,
  },
  { id: 'rotations-she', label: 'Boogieman · She', bpm: 129.2, energy: 0.72, key: '—', real: true },
  {
    id: 'rotations-devils-mountain',
    label: 'Boogieman · Devils Mountain and Ngorongoro Crater',
    bpm: 89.1,
    energy: 0.6,
    key: '—',
    real: true,
  },
  {
    id: 'rotations-fences',
    label: 'Boogieman · Fences',
    bpm: 117.45,
    energy: 0.66,
    key: '—',
    real: true,
  },
  {
    id: 'rotations-water-is-boiling-outro',
    label: 'Boogieman · Water Is Boiling (Outro)',
    bpm: 123.05,
    energy: 0.6,
    key: '—',
    real: true,
  },
  {
    id: 'diet-cake',
    label: 'Beaver Sheppard · Diet Cake · media slot',
    bpm: 118,
    energy: 0.57,
    key: 'C',
  },
];

const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];

function createDeckState(id, trackId) {
  return {
    id,
    trackId,
    playing: false,
    level: 0.82,
    low: 0,
    high: 0,
    bpm: trackById(trackId).bpm,
    step: 0,
    nextTime: 0,
    transportOffset: 0,
    transportStartedAt: 0,
    timer: null,
    source: null,
    media: null,
    nodes: null,
    voices: new Set(),
  };
}

/**
 * Two WebAudio deck buses with constant-power crossfade, basic EQ and sync.
 *
 * Real catalogue files first try decodeAudioData so they get the full EQ path. Remote Drive
 * sources can deny CORS to fetch(); in that case a native HTMLAudio stream is used so the real
 * recording still plays, with tempo, deck level and crossfader retained. EQ remains a WebAudio-
 * only control until the catalogue is mirrored to same-origin optimized files.
 */
export class DjMixer {
  constructor(audio, timers = globalThis) {
    this.audio = audio;
    this.timers = timers;
    this.decks = {
      A: createDeckState('A', 'got-you-dancin'),
      B: createDeckState('B', 'in-flux-just-be'),
    };
    this.crossfader = -0.72;
    this.elapsed = 0;
    this.backgroundSnapshot = [];
  }

  get context() {
    return this.audio.context;
  }

  ensureDeckNodes(deck) {
    if (deck.nodes || !this.context) return deck.nodes;
    const input = this.context.createGain();
    const low = this.context.createBiquadFilter();
    const high = this.context.createBiquadFilter();
    const level = this.context.createGain();
    const cross = this.context.createGain();
    low.type = 'lowshelf';
    low.frequency.value = 220;
    high.type = 'highshelf';
    high.frequency.value = 3500;
    input.connect(low);
    low.connect(high);
    high.connect(level);
    level.connect(cross);
    cross.connect(this.audio.sourceDestination?.('dj') ?? this.audio.master);
    deck.nodes = { input, low, high, level, cross };
    this.updateDeckNodes(deck);
    this.updateCrossfader();
    return deck.nodes;
  }

  nativeCrossGain(deckId) {
    const x = (clamp(this.crossfader, -1, 1) + 1) / 2;
    return deckId === 'A' ? Math.cos(x * Math.PI * 0.5) : Math.sin(x * Math.PI * 0.5);
  }

  updateNativeDeckLevels() {
    const environment = this.audio.sourceGain?.('dj') ?? this.audio.environment?.gain ?? 1;
    for (const [deckId, deck] of Object.entries(this.decks)) {
      if (!deck.media) continue;
      deck.media.volume = clamp(deck.level * this.nativeCrossGain(deckId) * environment * 0.92);
    }
  }

  updateDeckNodes(deck) {
    if (deck.nodes && this.context) {
      const now = this.context.currentTime;
      deck.nodes.level.gain.setTargetAtTime(clamp(deck.level), now, 0.02);
      deck.nodes.low.gain.setTargetAtTime(clamp(deck.low, -1, 1) * 15, now, 0.03);
      deck.nodes.high.gain.setTargetAtTime(clamp(deck.high, -1, 1) * 15, now, 0.03);
    }
    this.updateNativeDeckLevels();
  }

  updateCrossfader() {
    const x = (clamp(this.crossfader, -1, 1) + 1) / 2;
    const gainA = Math.cos(x * Math.PI * 0.5);
    const gainB = Math.sin(x * Math.PI * 0.5);
    if (this.decks.A.nodes && this.context)
      this.decks.A.nodes.cross.gain.setTargetAtTime(gainA, this.context.currentTime, 0.018);
    if (this.decks.B.nodes && this.context)
      this.decks.B.nodes.cross.gain.setTargetAtTime(gainB, this.context.currentTime, 0.018);
    this.updateNativeDeckLevels();
  }

  load(deckId, trackId) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    const wasPlaying = deck.playing;
    if (wasPlaying) this.stopDeck(deckId);
    const track = trackById(trackId);
    deck.trackId = track.id;
    deck.bpm = track.bpm;
    deck.step = 0;
    deck.transportOffset = 0;
    deck.transportStartedAt = this.context?.currentTime ?? 0;
    if (wasPlaying) void this.playDeck(deckId);
    return track;
  }

  setLevel(deckId, value) {
    const deck = this.decks[deckId];
    if (!deck) return;
    deck.level = clamp(Number(value) || 0);
    this.updateDeckNodes(deck);
  }

  setEq(deckId, band, value) {
    const deck = this.decks[deckId];
    if (!deck || !['low', 'high'].includes(band)) return;
    deck[band] = clamp(Number(value) || 0, -1, 1);
    this.updateDeckNodes(deck);
  }

  setCrossfader(value) {
    this.crossfader = clamp(Number(value) || 0, -1, 1);
    this.updateCrossfader();
    this.updateVibe();
  }

  setBpm(deckId, bpm) {
    const deck = this.decks[deckId];
    if (!deck) return;
    const position = this.deckPosition(deckId);
    const base = trackById(deck.trackId).bpm;
    deck.bpm = clamp(Number(bpm) || base, base * 0.92, base * 1.08);
    if (deck.playing && this.context) {
      deck.transportOffset = position;
      deck.transportStartedAt = this.context.currentTime;
    }
    if (deck.source?.playbackRate) deck.source.playbackRate.value = deck.bpm / base;
    if (deck.media) deck.media.playbackRate = deck.bpm / base;
    this.updateVibe();
  }

  sync(deckId) {
    const deck = this.decks[deckId];
    const other = this.decks[deckId === 'A' ? 'B' : 'A'];
    if (!deck || !other) return;
    this.setBpm(deckId, other.bpm);
    if (other.playing && this.context) {
      deck.step = other.step;
      deck.nextTime = other.nextTime;
    }
    this.updateVibe();
  }

  oscillator(deck, freq, duration, when, type = 'sawtooth', volume = 0.055) {
    if (!this.context) return;
    const nodes = this.ensureDeckNodes(deck);
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + when;
    source.type = type;
    source.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(nodes.input);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      deck.voices.delete(source);
    };
    deck.voices.add(source);
    source.start(start);
    source.stop(start + duration + 0.025);
  }

  kick(deck, when) {
    if (!this.context) return;
    const nodes = this.ensureDeckNodes(deck);
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime + when;
    source.frequency.setValueAtTime(135, start);
    source.frequency.exponentialRampToValueAtTime(44, start + 0.17);
    gain.gain.setValueAtTime(0.19, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
    source.connect(gain);
    gain.connect(nodes.input);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      deck.voices.delete(source);
    };
    deck.voices.add(source);
    source.start(start);
    source.stop(start + 0.21);
  }

  noise(deck, when, volume = 0.045) {
    if (!this.context) return;
    const nodes = this.ensureDeckNodes(deck);
    const length = Math.floor(this.context.sampleRate * 0.035);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = 5600;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(nodes.input);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      deck.voices.delete(source);
    };
    deck.voices.add(source);
    source.start(this.context.currentTime + when);
  }

  pattern(deck, step, when) {
    const track = trackById(deck.trackId);
    const seed = DJ_TRACKS.findIndex((candidate) => candidate.id === track.id) + 1;
    if (step % 4 === 0) this.kick(deck, when);
    if (step % 2 === 1) this.noise(deck, when + 0.01, 0.035 + (seed % 3) * 0.008);
    if (step % 4 === 2) {
      const bases = [73.42, 82.41, 98, 110, 65.41, 87.31, 103.83];
      const base = bases[seed % bases.length];
      const note = step % 8 === 2 ? base : base * 1.122;
      this.oscillator(deck, note, 0.2, when, seed % 2 ? 'sawtooth' : 'square', 0.05);
    }
    if (step % 8 === 4 && track.energy < 0.78) {
      const root = 196 + (seed % 3) * 24;
      for (const ratio of [1, 1.25, 1.5])
        this.oscillator(deck, root * ratio, 0.42, when, 'triangle', 0.025);
    }
  }

  deckPosition(deckId) {
    const deck = this.decks[deckId];
    if (!deck) return 0;
    if (deck.media && Number.isFinite(deck.media.currentTime))
      return Math.max(0, deck.media.currentTime);
    const offset = Math.max(0, Number(deck.transportOffset) || 0);
    if (!deck.playing || !this.context) return offset;
    const baseBpm = Math.max(1, trackById(deck.trackId).bpm);
    const rate = Math.max(0.001, deck.bpm / baseBpm);
    let position =
      offset + Math.max(0, this.context.currentTime - (deck.transportStartedAt || 0)) * rate;
    const duration = deck.source?.buffer?.duration;
    if (Number.isFinite(duration) && duration > 0) position %= duration;
    return Math.max(0, position);
  }

  async playNativeMedia(deck, offset = 0) {
    const url = this.audio.assets?.mediaUrl?.(deck.trackId);
    if (!url || typeof Audio === 'undefined') return false;
    const media = new Audio();
    media.preload = 'auto';
    media.loop = true;
    media.playsInline = true;
    media.src = url;
    media.playbackRate = deck.bpm / trackById(deck.trackId).bpm;
    const seek = () => {
      if (!(offset > 0)) return;
      try {
        const duration = Number(media.duration);
        media.currentTime = Number.isFinite(duration) && duration > 0 ? offset % duration : offset;
      } catch {
        // Metadata may not be seekable yet; loadedmetadata will try again.
      }
    };
    if (media.readyState >= 1) seek();
    else media.addEventListener?.('loadedmetadata', seek, { once: true });
    deck.media = media;
    this.updateNativeDeckLevels();
    try {
      await media.play();
      seek();
      return true;
    } catch {
      deck.media = null;
      media.pause();
      media.removeAttribute('src');
      media.load?.();
      return false;
    }
  }

  async playDeck(deckId, offset = 0) {
    const deck = this.decks[deckId];
    if (!deck || !this.context || deck.playing) return false;
    this.ensureDeckNodes(deck);
    const safeOffset = Math.max(0, Number(offset) || 0);
    const baseBpm = Math.max(1, trackById(deck.trackId).bpm);
    deck.playing = true;
    deck.transportOffset = safeOffset;
    deck.transportStartedAt = this.context.currentTime;
    const sourceStepSeconds = 60 / baseBpm / 4;
    deck.step = Math.floor(safeOffset / sourceStepSeconds) % 16;
    deck.nextTime = this.context.currentTime;

    const buffer = this.audio.assets
      ? await this.audio.assets.audio(deck.trackId, this.context)
      : null;
    if (!deck.playing) return false;
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = deck.bpm / baseBpm;
      source.connect(deck.nodes.input);
      source.onended = () => {
        source.disconnect();
        if (deck.source === source) deck.source = null;
      };
      deck.source = source;
      const startOffset = buffer.duration > 0 ? safeOffset % buffer.duration : 0;
      source.start(0, startOffset);
    } else if (!(await this.playNativeMedia(deck, safeOffset))) {
      const schedule = () => {
        if (!deck.playing || !this.context || this.context.state !== 'running') return;
        deck.nextTime = Math.max(deck.nextTime, this.context.currentTime);
        const interval = 60 / deck.bpm / 4;
        while (deck.nextTime < this.context.currentTime + 0.1) {
          this.pattern(deck, deck.step, deck.nextTime - this.context.currentTime);
          deck.step = (deck.step + 1) % 16;
          deck.nextTime += interval;
        }
      };
      schedule();
      deck.timer = this.timers.setInterval(schedule, 25);
    }
    this.updateVibe();
    return true;
  }

  prepareForBackground() {
    const active = Object.entries(this.decks)
      .filter(([, deck]) => deck.playing)
      .map(([deckId]) => ({
        deckId,
        position: this.deckPosition(deckId),
      }));
    if (!active.length) {
      this.backgroundSnapshot = [];
      return false;
    }

    this.backgroundSnapshot = active;
    for (const { deckId } of active) this.stopDeck(deckId);
    return true;
  }

  async recoverAfterBackground() {
    if (!this.backgroundSnapshot.length || this.context?.state !== 'running') return false;
    const snapshot = this.backgroundSnapshot;
    this.backgroundSnapshot = [];

    let recovered = false;
    for (const { deckId, position } of snapshot) {
      recovered = (await this.playDeck(deckId, position)) || recovered;
    }
    return recovered;
  }

  async restartDeckAt(deckId, position = 0) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    const wasPlaying = deck.playing;
    this.stopDeck(deckId);
    deck.transportOffset = Math.max(0, Number(position) || 0);
    deck.transportStartedAt = this.context?.currentTime ?? 0;
    if (!wasPlaying) return true;
    return this.playDeck(deckId, deck.transportOffset);
  }

  stopDeck(deckId) {
    const deck = this.decks[deckId];
    if (!deck) return;
    const position = this.deckPosition(deckId);
    deck.playing = false;
    deck.transportOffset = position;
    deck.transportStartedAt = 0;
    if (deck.timer !== null) this.timers.clearInterval(deck.timer);
    deck.timer = null;
    if (deck.source) {
      deck.source.onended = null;
      try {
        deck.source.stop();
      } catch {
        // Already stopped.
      }
      deck.source.disconnect();
      deck.source = null;
    }
    if (deck.media) {
      deck.media.pause();
      deck.media.removeAttribute('src');
      deck.media.load?.();
      deck.media = null;
    }
    for (const source of deck.voices) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already ended.
      }
      source.disconnect();
    }
    deck.voices.clear();
    this.updateVibe();
  }

  phase(deck) {
    if (!deck?.playing) return 0;
    const baseBpm = Math.max(1, trackById(deck.trackId).bpm);
    const beat = 60 / baseBpm;
    const position = this.deckPosition(deck.id);
    return (((position % beat) + beat) % beat) / beat;
  }

  metrics() {
    const active = Object.values(this.decks).filter((deck) => deck.playing);
    if (!active.length) return { playing: false, vibe: 0, mixQuality: 0 };
    let mixQuality = 0.82;
    if (active.length === 2) {
      const a = this.phase(this.decks.A);
      const b = this.phase(this.decks.B);
      const distance = Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
      const alignment = clamp(1 - distance * 2.4);
      const centerExposure = 1 - Math.abs(this.crossfader);
      mixQuality = 0.92 - centerExposure * (1 - alignment) * 0.78;
      const bpmDistance = Math.abs(this.decks.A.bpm - this.decks.B.bpm);
      mixQuality -= centerExposure * Math.min(0.35, bpmDistance * 0.035);
      mixQuality = clamp(mixQuality);
    }
    const x = (this.crossfader + 1) / 2;
    const weightA = Math.cos(x * Math.PI * 0.5) * (this.decks.A.playing ? 1 : 0);
    const weightB = Math.sin(x * Math.PI * 0.5) * (this.decks.B.playing ? 1 : 0);
    const total = weightA + weightB || 1;
    const energy =
      (trackById(this.decks.A.trackId).energy * weightA +
        trackById(this.decks.B.trackId).energy * weightB) /
      total;
    const vibe = clamp(energy * (0.54 + mixQuality * 0.52));
    return { playing: true, vibe, mixQuality, energy };
  }

  updateVibe() {
    const metrics = this.metrics();
    if (!metrics.playing) {
      this.audio.clearExternalTransport?.('dj');
      return;
    }
    const activeBpm =
      this.decks.A.playing && this.decks.B.playing
        ? (this.decks.A.bpm + this.decks.B.bpm) / 2
        : this.decks.A.playing
          ? this.decks.A.bpm
          : this.decks.B.bpm;
    const interval = 60 / activeBpm / 4;
    const activeLabels = Object.values(this.decks)
      .filter((deck) => deck.playing)
      .map((deck) => trackById(deck.trackId).label)
      .join(' / ');
    const label = `DJ mix · ${activeLabels}`;
    if (this.audio.externalTransports?.has('dj'))
      this.audio.updateExternalTransport('dj', { label, interval, ...metrics });
    else this.audio.setExternalTransport?.('dj', label, interval, metrics);
  }

  update(dt) {
    this.elapsed += dt;
    this.updateNativeDeckLevels();
    this.updateVibe();
  }

  stop() {
    this.stopDeck('A');
    this.stopDeck('B');
    this.audio.clearExternalTransport?.('dj');
  }

  snapshot() {
    return {
      crossfader: this.crossfader,
      metrics: this.metrics(),
      decks: Object.fromEntries(
        Object.entries(this.decks).map(([id, deck]) => [
          id,
          {
            trackId: deck.trackId,
            playing: deck.playing,
            level: deck.level,
            low: deck.low,
            high: deck.high,
            bpm: deck.bpm,
            nativeStream: !!deck.media,
          },
        ]),
      ),
    };
  }

  dispose() {
    this.stop();
    for (const deck of Object.values(this.decks)) {
      if (!deck.nodes) continue;
      for (const node of Object.values(deck.nodes)) node.disconnect();
      deck.nodes = null;
    }
  }
}
