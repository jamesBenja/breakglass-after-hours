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

const SESSION_DJ_TRACK_IDS = new Set();

export function registerDjSessionTrack(track) {
  if (!track?.id || !String(track.id).startsWith('session-')) return null;
  const normalized = {
    id: String(track.id).slice(0, 64),
    label: String(track.label || track.filename || 'Uploaded track').slice(0, 80),
    bpm: clamp(Number(track.bpm) || 120, 60, 200),
    energy: clamp(Number(track.energy ?? 0.7)),
    key: String(track.key || '—').slice(0, 12),
    session: true,
    url: track.url || null,
    mime: track.mime || 'application/octet-stream',
    size: Math.max(0, Number(track.size) || 0),
    filename: String(track.filename || '').slice(0, 180),
    uploadedBy: track.uploadedBy || null,
    uploadedByName: String(track.uploadedByName || '').slice(0, 40),
    createdAt: Number(track.createdAt) || Date.now(),
  };
  const index = DJ_TRACKS.findIndex((candidate) => candidate.id === normalized.id);
  if (index >= 0) DJ_TRACKS[index] = normalized;
  else DJ_TRACKS.push(normalized);
  SESSION_DJ_TRACK_IDS.add(normalized.id);
  return normalized;
}

export function unregisterDjSessionTrack(trackId) {
  if (!SESSION_DJ_TRACK_IDS.has(trackId)) return false;
  const index = DJ_TRACKS.findIndex((track) => track.id === trackId);
  if (index >= 0) DJ_TRACKS.splice(index, 1);
  SESSION_DJ_TRACK_IDS.delete(trackId);
  return true;
}

const trackById = (id) => DJ_TRACKS.find((track) => track.id === id) ?? DJ_TRACKS[0];

function createDeckState(id, trackId, crossSide, deviceMode) {
  return {
    id,
    trackId,
    crossSide,
    deviceMode,
    playing: false,
    level: 0.82,
    pan: 0,
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
    mediaNode: null,
    playGeneration: 0,
    nodes: null,
    voices: new Set(),
  };
}

/**
 * Four independent WebAudio source buses feeding a four-channel DJ mixer.
 *
 * Deck A = left CDJ, B = right CDJ, C = left SL-1200, D = right SL-1200. The
 * crossfader groups A/C on the left and B/D on the right while every channel keeps its own
 * transport, track, EQ/filter state and level.
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
      A: createDeckState('A', 'got-you-dancin', 'A', 'cdj'),
      B: createDeckState('B', 'in-flux-just-be', 'B', 'cdj'),
      C: createDeckState('C', 'atrakar', 'A', 'vinyl'),
      D: createDeckState('D', 'dubki', 'B', 'vinyl'),
    };
    this.crossfader = -0.72;
    this.elapsed = 0;
    this.backgroundSnapshot = [];
    this.sessionBuffers = new Map();
  }

  get context() {
    return this.audio.context;
  }

  tracks() {
    return DJ_TRACKS;
  }

  registerSessionTrack(track) {
    return registerDjSessionTrack(track);
  }

  unregisterSessionTrack(trackId) {
    this.sessionBuffers.delete(trackId);
    return unregisterDjSessionTrack(trackId);
  }

  audioBufferForTrack(trackId) {
    const track = trackById(trackId);
    if (!track?.session) return this.audio.assets?.audio?.(trackId, this.context) ?? null;
    if (!track.url || !this.context) return null;
    if (!this.sessionBuffers.has(track.id)) {
      const request = fetch(track.url)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data) => this.context.decodeAudioData(data))
        .catch(() => {
          this.sessionBuffers.delete(track.id);
          return null;
        });
      this.sessionBuffers.set(track.id, request);
    }
    return this.sessionBuffers.get(track.id);
  }

  ensureDeckNodes(deck) {
    if (deck.nodes || !this.context) return deck.nodes;
    const input = this.context.createGain();
    const low = this.context.createBiquadFilter();
    const high = this.context.createBiquadFilter();
    const level = this.context.createGain();
    const pan = this.context.createStereoPanner?.() ?? this.context.createGain();
    const cross = this.context.createGain();
    low.type = 'lowshelf';
    low.frequency.value = 220;
    high.type = 'highshelf';
    high.frequency.value = 3500;
    input.connect(low);
    low.connect(high);
    high.connect(level);
    level.connect(pan);
    pan.connect(cross);
    cross.connect(this.audio.sourceDestination?.('dj') ?? this.audio.master);
    deck.nodes = { input, low, high, level, pan, cross };
    this.updateDeckNodes(deck);
    this.updateCrossfader();
    return deck.nodes;
  }

  nativeCrossGain(deckId) {
    const x = (clamp(this.crossfader, -1, 1) + 1) / 2;
    const side = this.decks[deckId]?.crossSide ?? (['A', 'C'].includes(deckId) ? 'A' : 'B');
    return side === 'A' ? Math.cos(x * Math.PI * 0.5) : Math.sin(x * Math.PI * 0.5);
  }

  updateNativeDeckLevels() {
    const environment = this.audio.sourceGain?.('dj') ?? this.audio.environment?.gain ?? 1;
    for (const [deckId, deck] of Object.entries(this.decks)) {
      if (!deck.media) continue;
      deck.media.volume = deck.mediaNode
        ? 1
        : clamp(deck.level * this.nativeCrossGain(deckId) * environment * 0.92);
    }
  }

  updateDeckNodes(deck) {
    if (deck.nodes && this.context) {
      const now = this.context.currentTime;
      deck.nodes.level.gain.setTargetAtTime(clamp(deck.level), now, 0.02);
      deck.nodes.pan?.pan?.setTargetAtTime(clamp(deck.pan, -1, 1), now, 0.02);
      deck.nodes.low.gain.setTargetAtTime(clamp(deck.low, -1, 1) * 15, now, 0.03);
      deck.nodes.high.gain.setTargetAtTime(clamp(deck.high, -1, 1) * 15, now, 0.03);
    }
    this.updateNativeDeckLevels();
  }

  updateCrossfader() {
    if (this.context) {
      for (const [deckId, deck] of Object.entries(this.decks)) {
        if (!deck.nodes) continue;
        deck.nodes.cross.gain.setTargetAtTime(
          this.nativeCrossGain(deckId),
          this.context.currentTime,
          0.018,
        );
      }
    }
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

  setPan(deckId, value) {
    const deck = this.decks[deckId];
    if (!deck) return false;
    deck.pan = clamp(Number(value) || 0, -1, 1);
    this.updateDeckNodes(deck);
    return deck.pan;
  }

  masterLevels() {
    let left = 0;
    let right = 0;
    for (const [deckId, deck] of Object.entries(this.decks)) {
      if (!deck.playing) continue;
      const postFader = clamp(deck.level) * this.nativeCrossGain(deckId);
      const pan = clamp(deck.pan, -1, 1);
      const leftBalance = pan <= 0 ? 1 : 1 - pan;
      const rightBalance = pan >= 0 ? 1 : 1 + pan;
      left += postFader * leftBalance;
      right += postFader * rightBalance;
    }
    return { left: clamp(left), right: clamp(right) };
  }

  masterBpm() {
    let best = null;
    let bestWeight = -1;
    for (const [deckId, deck] of Object.entries(this.decks)) {
      if (!deck.playing) continue;
      const weight = clamp(deck.level) * this.nativeCrossGain(deckId);
      if (weight > bestWeight) {
        best = deck;
        bestWeight = weight;
      }
    }
    return best ? Number(best.bpm) || null : null;
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
    if (!['A', 'B'].includes(deckId)) return false;
    const deck = this.decks[deckId];
    const other = this.decks[deckId === 'A' ? 'B' : 'A'];
    if (!deck || !other) return false;
    this.setBpm(deckId, other.bpm);
    if (other.playing && this.context) {
      deck.step = other.step;
      deck.nextTime = other.nextTime;
    }
    this.updateVibe();
    return true;
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
    const track = trackById(deck.trackId);
    const url = track?.session ? track.url : this.audio.assets?.mediaUrl?.(deck.trackId);
    if (!url || typeof Audio === 'undefined') return false;
    const media = new Audio();
    media.preload = 'auto';
    media.loop = true;
    media.playsInline = true;
    if (track?.session) media.crossOrigin = 'anonymous';
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

    let mediaNode = null;
    if (track?.session && this.context?.createMediaElementSource) {
      try {
        mediaNode = this.context.createMediaElementSource(media);
        mediaNode.connect(this.ensureDeckNodes(deck).input);
      } catch {
        mediaNode = null;
      }
    }
    deck.media = media;
    deck.mediaNode = mediaNode;
    this.updateNativeDeckLevels();
    try {
      await media.play();
      seek();
      return true;
    } catch {
      if (deck.mediaNode === mediaNode) deck.mediaNode = null;
      try {
        mediaNode?.disconnect?.();
      } catch {
        // Already disconnected.
      }
      if (deck.media === media) deck.media = null;
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
    const track = trackById(deck.trackId);
    const baseBpm = Math.max(1, track.bpm);
    const generation = (Number(deck.playGeneration) || 0) + 1;
    deck.playGeneration = generation;
    deck.playing = true;
    deck.transportOffset = safeOffset;
    deck.transportStartedAt = this.context.currentTime;
    const sourceStepSeconds = 60 / baseBpm / 4;
    deck.step = Math.floor(safeOffset / sourceStepSeconds) % 16;
    deck.nextTime = this.context.currentTime;

    let mediaStarted = false;
    let buffer = null;
    if (track.session) mediaStarted = await this.playNativeMedia(deck, safeOffset);
    else buffer = await this.audioBufferForTrack(deck.trackId);

    if (!deck.playing || deck.playGeneration !== generation) return false;

    if (!mediaStarted && !buffer && track.session) {
      buffer = await this.audioBufferForTrack(deck.trackId);
      if (!deck.playing || deck.playGeneration !== generation) return false;
    }

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
    } else if (!mediaStarted && !track.session && !(await this.playNativeMedia(deck, safeOffset))) {
      if (!deck.playing || deck.playGeneration !== generation) return false;
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
    } else if (!mediaStarted && !buffer) {
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
    deck.playGeneration = (Number(deck.playGeneration) || 0) + 1;
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
    if (deck.mediaNode) {
      try {
        deck.mediaNode.disconnect();
      } catch {
        // Already disconnected.
      }
      deck.mediaNode = null;
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
    if (!active.length) return { playing: false, vibe: 0, mixQuality: 0, energy: 0 };

    const audible = active.map((deck) => ({
      deck,
      weight: this.nativeCrossGain(deck.id) * clamp(deck.level),
    }));
    const audibleTotal = audible.reduce((sum, item) => sum + item.weight, 0);
    let pairWeight = 0;
    let qualityWeighted = 0;

    for (let leftIndex = 0; leftIndex < audible.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < audible.length; rightIndex += 1) {
        const left = audible[leftIndex];
        const right = audible[rightIndex];
        const overlap = Math.min(left.weight, right.weight);
        if (overlap <= 0.001) continue;
        const phaseLeft = this.phase(left.deck);
        const phaseRight = this.phase(right.deck);
        const distance = Math.min(
          Math.abs(phaseLeft - phaseRight),
          1 - Math.abs(phaseLeft - phaseRight),
        );
        const alignment = clamp(1 - distance * 2.4);
        const bpmDistance = Math.abs(left.deck.bpm - right.deck.bpm);
        const pairQuality = clamp(
          0.94 - (1 - alignment) * 0.62 - Math.min(0.34, bpmDistance * 0.03),
        );
        qualityWeighted += pairQuality * overlap;
        pairWeight += overlap;
      }
    }

    const mixQuality = pairWeight > 0 ? clamp(qualityWeighted / pairWeight) : 0.86;
    const energyNumerator = audible.reduce(
      (sum, item) => sum + trackById(item.deck.trackId).energy * item.weight,
      0,
    );
    const energy = energyNumerator / Math.max(0.001, audibleTotal);
    const vibe = clamp(energy * (0.54 + mixQuality * 0.52));
    return { playing: true, vibe, mixQuality, energy };
  }

  updateVibe() {
    const metrics = this.metrics();
    if (!metrics.playing) {
      this.audio.clearExternalTransport?.('dj');
      return;
    }
    const active = Object.values(this.decks).filter((deck) => deck.playing);
    const activeBpm = active.reduce((sum, deck) => sum + deck.bpm, 0) / Math.max(1, active.length);
    const interval = 60 / activeBpm / 4;
    const activeLabels = active.map((deck) => trackById(deck.trackId).label).join(' / ');
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
    for (const deckId of Object.keys(this.decks)) this.stopDeck(deckId);
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
            crossSide: deck.crossSide,
            deviceMode: deck.deviceMode,
            playing: deck.playing,
            level: deck.level,
            pan: deck.pan,
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
    this.sessionBuffers.clear();
    for (const deck of Object.values(this.decks)) {
      if (!deck.nodes) continue;
      for (const node of Object.values(deck.nodes)) node.disconnect();
      deck.nodes = null;
    }
  }
}
