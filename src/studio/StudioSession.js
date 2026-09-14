import { AMPS, BASSES, DRUM_KITS, GUITARS, MICS, PROCESSORS, SYNTHS, gearById } from './gear.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const DEFAULT_SETUP = {
  instrumentType: 'guitar',
  guitar: GUITARS[0].id,
  bass: BASSES[0].id,
  amp: AMPS[0].id,
  mic: MICS[0].id,
  synth: SYNTHS[0].id,
  drums: DRUM_KITS[0].id,
  eq: PROCESSORS.eq[0].id,
  compressor: PROCESSORS.compressor[0].id,
};

export const DEFAULT_STEMS = [
  { id: 'drums', label: 'Drums', kind: 'drums', level: 0.76, pan: 0, mute: false },
  { id: 'bass', label: 'Bass', kind: 'bass', level: 0.7, pan: 0, mute: false },
  { id: 'guitar', label: 'Guitar', kind: 'guitar', level: 0.56, pan: -0.18, mute: false },
  { id: 'synth', label: 'Synth / Keys', kind: 'synth', level: 0.58, pan: 0.18, mute: false },
];

export const DANCE_SHOES_STEMS = [
  {
    id: 'dance-shoes-drums',
    label: 'Dance Shoes · Drums',
    kind: 'drums',
    level: 0.78,
    pan: 0,
    mute: false,
    assetId: 'dance-shoes-drums',
    source: 'Breakglass multitrack',
  },
  {
    id: 'dance-shoes-bass',
    label: 'Dance Shoes · Bass',
    kind: 'bass',
    level: 0.74,
    pan: 0,
    mute: false,
    assetId: 'dance-shoes-bass',
    source: 'Breakglass multitrack',
  },
  {
    id: 'dance-shoes-synths-fx',
    label: 'Dance Shoes · Synths + FX',
    kind: 'synth',
    level: 0.66,
    pan: 0.08,
    mute: false,
    assetId: 'dance-shoes-synths-fx',
    source: 'Breakglass multitrack',
  },
  {
    id: 'dance-shoes-vox',
    label: 'Dance Shoes · Vocals',
    kind: 'vocal',
    level: 0.7,
    pan: 0,
    mute: false,
    assetId: 'dance-shoes-vox',
    source: 'Breakglass multitrack',
  },
];

const normalizePerformance = (performance) => {
  if (!performance || typeof performance !== 'object' || !Array.isArray(performance.events)) {
    return null;
  }
  const events = performance.events.slice(0, 512).flatMap((event) => {
    const time = clamp(Number(event?.time) || 0, 0, 120);
    if (typeof event?.drum === 'string') return [{ time, drum: event.drum.slice(0, 24) }];
    const midi = clamp(Math.round(Number(event?.midi) || 60), 24, 96);
    const frequency = clamp(Number(event?.frequency) || 440, 25, 5000);
    return [{ time, midi, frequency }];
  });
  return {
    mode: typeof performance.mode === 'string' ? performance.mode.slice(0, 24) : 'synth',
    label: typeof performance.label === 'string' ? performance.label.slice(0, 48) : 'Performance',
    baseMidi: clamp(Math.round(Number(performance.baseMidi) || 48), 24, 84),
    wave: typeof performance.wave === 'string' ? performance.wave.slice(0, 24) : 'triangle',
    volume: clamp(Number(performance.volume) || 0.065, 0.01, 0.22),
    noteDuration: clamp(Number(performance.noteDuration) || 0.42, 0.06, 1.5),
    octaveLayer: performance.octaveLayer === true,
    bpm: clamp(Number(performance.bpm) || 118, 50, 220),
    duration: clamp(Number(performance.duration) || 0, 0, 120),
    events,
  };
};

const normalizeStem = (stem, index) => ({
  id: typeof stem.id === 'string' ? stem.id.slice(0, 32) : `stem-${index}`,
  label: typeof stem.label === 'string' ? stem.label.slice(0, 40) : `Stem ${index + 1}`,
  kind: typeof stem.kind === 'string' ? stem.kind.slice(0, 24) : 'audio',
  level: clamp(Number(stem.level) || 0, 0, 1),
  pan: clamp(Number(stem.pan) || 0, -1, 1),
  low: clamp(Number(stem.low) || 0, -1, 1),
  high: clamp(Number(stem.high) || 0, -1, 1),
  mute: stem.mute === true,
  solo: stem.solo === true,
  assetId: typeof stem.assetId === 'string' ? stem.assetId.slice(0, 64) : null,
  source: typeof stem.source === 'string' ? stem.source.slice(0, 80) : 'session',
  performance: normalizePerformance(stem.performance),
  processing:
    stem.processing && typeof stem.processing === 'object'
      ? {
          mic: typeof stem.processing.mic === 'string' ? stem.processing.mic : null,
          amp: typeof stem.processing.amp === 'string' ? stem.processing.amp : null,
          eq: typeof stem.processing.eq === 'string' ? stem.processing.eq : null,
          compressor:
            typeof stem.processing.compressor === 'string' ? stem.processing.compressor : null,
        }
      : null,
});

const isUntouchedPrototype = (value = {}) => {
  if (Math.floor(Number(value.takeCounter) || 0) !== 0) return false;
  if (value.name && value.name !== 'Breakglass Session') return false;
  if (!Array.isArray(value.stems) || value.stems.length !== DEFAULT_STEMS.length)
    return !value.stems;
  return value.stems.every((stem, index) => stem?.id === DEFAULT_STEMS[index].id && !stem?.assetId);
};

export function normalizeStudioSession(value = {}) {
  const setup = { ...DEFAULT_SETUP, ...(value.setup ?? {}) };
  setup.guitar = gearById(GUITARS, setup.guitar).id;
  setup.bass = gearById(BASSES, setup.bass).id;
  setup.amp = gearById(AMPS, setup.amp).id;
  setup.mic = gearById(MICS, setup.mic).id;
  setup.synth = gearById(SYNTHS, setup.synth).id;
  setup.drums = gearById(DRUM_KITS, setup.drums).id;
  setup.eq = gearById(PROCESSORS.eq, setup.eq).id;
  setup.compressor = gearById(PROCESSORS.compressor, setup.compressor).id;

  const upgrade = isUntouchedPrototype(value);
  const sourceStems = upgrade
    ? DANCE_SHOES_STEMS
    : Array.isArray(value.stems) && value.stems.length
      ? value.stems
      : DANCE_SHOES_STEMS;
  const stems = sourceStems.slice(0, 12).map(normalizeStem);

  return {
    name: upgrade
      ? 'Dance Shoes · BG Mix'
      : typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, 48)
        : 'Dance Shoes · BG Mix',
    setup,
    stems,
    takeCounter: Math.max(0, Math.floor(Number(value.takeCounter) || 0)),
  };
}

export class StudioSession {
  constructor(value) {
    const normalized = normalizeStudioSession(value);
    this.name = normalized.name;
    this.setup = normalized.setup;
    this.stems = normalized.stems;
    this.takeCounter = normalized.takeCounter;
    this.recordings = new Map();
  }

  select(group, id) {
    const collections = {
      guitar: GUITARS,
      bass: BASSES,
      amp: AMPS,
      mic: MICS,
      synth: SYNTHS,
      drums: DRUM_KITS,
      eq: PROCESSORS.eq,
      compressor: PROCESSORS.compressor,
    };
    const collection = collections[group];
    if (!collection) return false;
    const item = gearById(collection, id);
    this.setup[group] = item.id;
    return item;
  }

  loadTemplate(id) {
    if (id !== 'dance-shoes') return false;
    this.name = 'Dance Shoes · BG Mix';
    this.stems = DANCE_SHOES_STEMS.map((stem, index) => normalizeStem(stem, index));
    this.takeCounter = 0;
    this.recordings.clear();
    return true;
  }

  addTake(kind, label, source = 'gameplay', processing = null) {
    this.takeCounter += 1;
    const id = `${kind}-${this.takeCounter}`;
    const stem = {
      id,
      label: label || `${kind} take ${this.takeCounter}`,
      kind,
      level: 0.68,
      pan: 0,
      low: 0,
      high: 0,
      mute: false,
      solo: false,
      assetId: null,
      source,
      performance: null,
      processing: processing ? { ...processing } : null,
    };
    this.stems.push(stem);
    if (this.stems.length > 12) this.stems.splice(0, this.stems.length - 12);
    return stem;
  }

  attachRecording(stemId, audioBuffer) {
    if (audioBuffer) this.recordings.set(stemId, audioBuffer);
  }

  attachPerformance(stemId, performance) {
    const stem = this.stems.find((item) => item.id === stemId);
    if (!stem) return false;
    stem.performance = normalizePerformance(performance);
    return !!stem.performance;
  }

  setLevel(id, value) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.level = clamp(Number(value) || 0, 0, 1);
    return true;
  }

  setPan(id, value) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.pan = clamp(Number(value) || 0, -1, 1);
    return true;
  }

  setEq(id, band, value) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem || !['low', 'high'].includes(band)) return false;
    stem[band] = clamp(Number(value) || 0, -1, 1);
    return true;
  }

  toggleMute(id) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.mute = !stem.mute;
    return stem.mute;
  }

  toggleSolo(id) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.solo = !stem.solo;
    return stem.solo;
  }

  snapshot() {
    return {
      name: this.name,
      setup: { ...this.setup },
      stems: this.stems.map((stem) => ({
        ...stem,
        performance: stem.performance
          ? { ...stem.performance, events: stem.performance.events.map((event) => ({ ...event })) }
          : null,
        processing: stem.processing ? { ...stem.processing } : null,
      })),
      takeCounter: this.takeCounter,
    };
  }
}
