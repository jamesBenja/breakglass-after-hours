import {
  AMPS,
  BASSES,
  DRUM_KITS,
  GUITARS,
  MICS,
  PROCESSORS,
  SYNTHS,
  gearById,
} from './gear.js';

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

  const sourceStems = Array.isArray(value.stems) && value.stems.length ? value.stems : DEFAULT_STEMS;
  const stems = sourceStems.slice(0, 12).map((stem, index) => ({
    id: typeof stem.id === 'string' ? stem.id.slice(0, 32) : `stem-${index}`,
    label: typeof stem.label === 'string' ? stem.label.slice(0, 40) : `Stem ${index + 1}`,
    kind: typeof stem.kind === 'string' ? stem.kind.slice(0, 24) : 'audio',
    level: clamp(Number(stem.level) || 0, 0, 1),
    pan: clamp(Number(stem.pan) || 0, -1, 1),
    mute: stem.mute === true,
    source: typeof stem.source === 'string' ? stem.source.slice(0, 80) : 'session',
  }));

  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 48) : 'Breakglass Session',
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

  addTake(kind, label, source = 'gameplay') {
    this.takeCounter += 1;
    const id = `${kind}-${this.takeCounter}`;
    const stem = {
      id,
      label: label || `${kind} take ${this.takeCounter}`,
      kind,
      level: 0.68,
      pan: 0,
      mute: false,
      source,
    };
    this.stems.push(stem);
    if (this.stems.length > 12) this.stems.splice(0, this.stems.length - 12);
    return stem;
  }

  attachRecording(stemId, audioBuffer) {
    if (audioBuffer) this.recordings.set(stemId, audioBuffer);
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

  toggleMute(id) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.mute = !stem.mute;
    return stem.mute;
  }

  snapshot() {
    return {
      name: this.name,
      setup: { ...this.setup },
      stems: this.stems.map((stem) => ({ ...stem })),
      takeCounter: this.takeCounter,
    };
  }
}
