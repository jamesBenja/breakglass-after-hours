import { AMPS, BASSES, DRUM_KITS, GUITARS, MICS, PROCESSORS, SYNTHS, gearById } from './gear.js';
import { studioSessionById } from './sessionCatalog.js';
import { normalizeSpatialPosition } from './SpectraSpatialLayout.js';

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
  {
    id: 'input-drum-machine',
    label: 'Drum Machine',
    kind: 'drums',
    inputKey: 'drum-machine',
    level: 0.72,
    pan: 0,
    mute: false,
    monitor: true,
    recordArm: false,
  },
  {
    id: 'input-drum-kit',
    label: 'Drum Kit',
    kind: 'drums',
    inputKey: 'drum-kit',
    level: 0.74,
    pan: 0,
    mute: false,
    monitor: true,
    recordArm: false,
  },
  {
    id: 'input-synth',
    label: 'Synth',
    kind: 'synth',
    inputKey: 'synth',
    level: 0.66,
    pan: 0,
    mute: false,
    monitor: true,
    recordArm: false,
  },
  {
    id: 'input-modular',
    label: 'Modular Synth',
    kind: 'synth',
    inputKey: 'modular',
    level: 0.66,
    pan: 0,
    mute: false,
    monitor: true,
    recordArm: false,
  },
  {
    id: 'input-guitar',
    label: 'Guitar',
    kind: 'guitar',
    inputKey: 'guitar',
    level: 0.64,
    pan: 0,
    mute: false,
    monitor: true,
    recordArm: false,
  },
  {
    id: 'input-piano',
    label: 'Piano',
    kind: 'keys',
    inputKey: 'piano',
    level: 0.66,
    pan: 0,
    mute: false,
    monitor: true,
    recordArm: false,
  },
];

export const DANCE_SHOES_STEMS = studioSessionById('dance-shoes').stems;

const LOOP_BAR_OPTIONS = [1, 2, 4, 8, 16];
const QUANTIZE_OPTIONS = ['1/4', '1/8', '1/16'];

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
  id: typeof stem.id === 'string' ? stem.id.slice(0, 48) : `stem-${index}`,
  label: typeof stem.label === 'string' ? stem.label.slice(0, 64) : `Stem ${index + 1}`,
  kind: typeof stem.kind === 'string' ? stem.kind.slice(0, 24) : 'audio',
  level: clamp(Number(stem.level) || 0, 0, 1),
  pan: clamp(Number(stem.pan) || 0, -1, 1),
  low: clamp(Number(stem.low) || 0, -1, 1),
  high: clamp(Number(stem.high) || 0, -1, 1),
  fx: clamp(Number(stem.fx) || 0, 0, 1),
  mute: stem.mute === true,
  solo: stem.solo === true,
  monitor: stem.monitor !== false,
  recordArm: stem.recordArm === true,
  inputKey: typeof stem.inputKey === 'string' ? stem.inputKey.slice(0, 32) : null,
  clipActive: stem.clipActive !== false,
  clipStart: clamp(Number(stem.clipStart) || 0, 0, 120),
  spatial: normalizeSpatialPosition(stem.spatial),
  assetId: typeof stem.assetId === 'string' ? stem.assetId.slice(0, 64) : null,
  renderedAudio: stem.renderedAudio === true,
  renderedAudioAt: Number.isFinite(Number(stem.renderedAudioAt))
    ? Math.max(0, Number(stem.renderedAudioAt))
    : null,
  source: typeof stem.source === 'string' ? stem.source.slice(0, 100) : 'session',
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

const LEGACY_PROTOTYPE_IDS = ['drums', 'bass', 'guitar', 'synth'];

const isUntouchedPrototype = (value = {}) => {
  if (Math.floor(Number(value.takeCounter) || 0) !== 0) return false;
  if (!Array.isArray(value.stems)) return true;
  if (value.stems.length !== LEGACY_PROTOTYPE_IDS.length) return false;
  return value.stems.every(
    (stem, index) =>
      stem?.id === LEGACY_PROTOTYPE_IDS[index] && !stem?.assetId && !stem?.performance,
  );
};

const isLegacyAutoTemplate = (value = {}, template = null) => {
  if (!template || value.project === true || Math.floor(Number(value.takeCounter) || 0) !== 0)
    return false;
  if (value.name !== template.name || !Array.isArray(value.stems)) return false;
  if (value.stems.length !== template.stems.length) return false;
  return value.stems.every(
    (stem, index) =>
      stem?.id === template.stems[index]?.id &&
      stem?.assetId === template.stems[index]?.assetId &&
      !stem?.performance,
  );
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

  const legacyTemplate = studioSessionById('dance-shoes');
  const upgrade = isUntouchedPrototype(value) || isLegacyAutoTemplate(value, legacyTemplate);
  const isProject = value.project === true;
  const sourceStems = upgrade
    ? DEFAULT_STEMS
    : Array.isArray(value.stems) && (value.stems.length || isProject)
      ? value.stems
      : DEFAULT_STEMS;
  const legacyFiveInputIds = [
    'input-drum-machine',
    'input-drum-kit',
    'input-synth',
    'input-guitar',
    'input-piano',
  ];
  const restoreMissingModular =
    !sourceStems.some((stem) => stem?.inputKey === 'modular' || stem?.id === 'input-modular') &&
    legacyFiveInputIds.every((id) => sourceStems.some((stem) => stem?.id === id));
  const migratedSourceStems = restoreMissingModular
    ? sourceStems.flatMap((stem) =>
        stem?.id === 'input-synth'
          ? [
              stem,
              {
                id: 'input-modular',
                label: 'Modular Synth',
                kind: 'synth',
                inputKey: 'modular',
                level: 0.66,
                pan: 0,
                mute: false,
                monitor: true,
                recordArm: false,
              },
            ]
          : [stem],
      )
    : sourceStems;
  const stems = migratedSourceStems.slice(0, 12).map(normalizeStem);

  return {
    project: isProject,
    name: upgrade
      ? 'Spectra Session'
      : typeof value.name === 'string' && value.name.trim()
        ? value.name.trim().slice(0, 64)
        : 'Spectra Session',
    bpm: clamp(Number(value.bpm) || 118, 50, 220),
    setup,
    stems,
    takeCounter: Math.max(0, Math.floor(Number(value.takeCounter) || 0)),
    loopEnabled: value.loopEnabled === true,
    loopBars: LOOP_BAR_OPTIONS.includes(Number(value.loopBars)) ? Number(value.loopBars) : 4,
    quantize: QUANTIZE_OPTIONS.includes(value.quantize) ? value.quantize : '1/16',
    swing: clamp(Number(value.swing) || 0, 0, 0.45),
    clickEnabled: value.clickEnabled === true,
  };
}

export class StudioSession {
  constructor(value) {
    const normalized = normalizeStudioSession(value);
    this.project = normalized.project;
    this.name = normalized.name;
    this.bpm = normalized.bpm;
    this.setup = normalized.setup;
    this.stems = normalized.stems;
    this.takeCounter = normalized.takeCounter;
    this.loopEnabled = normalized.loopEnabled;
    this.loopBars = normalized.loopBars;
    this.quantize = normalized.quantize;
    this.swing = normalized.swing;
    this.clickEnabled = normalized.clickEnabled;
    this.recordings = new Map();
    this.recordingBlobs = new Map();
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

  replace(value = {}) {
    const normalized = normalizeStudioSession(value);
    this.project = normalized.project;
    this.name = normalized.name;
    this.bpm = normalized.bpm;
    this.setup = normalized.setup;
    this.stems = normalized.stems;
    this.takeCounter = normalized.takeCounter;
    this.loopEnabled = normalized.loopEnabled;
    this.loopBars = normalized.loopBars;
    this.quantize = normalized.quantize;
    this.swing = normalized.swing;
    this.clickEnabled = normalized.clickEnabled;
    this.recordings.clear();
    this.recordingBlobs.clear();
    return this;
  }

  newProject(name = 'Untitled Spectra Session', bpm = 118) {
    return this.replace({
      project: true,
      name,
      bpm,
      stems: DEFAULT_STEMS.map((stem) => ({ ...stem })),
      takeCounter: 0,
      loopEnabled: true,
      loopBars: 4,
      quantize: '1/16',
      swing: 0,
      setup: { ...this.setup },
    });
  }

  loadTemplate(id) {
    const template = studioSessionById(id);
    if (!template) return false;
    this.project = false;
    this.name = template.name;
    this.bpm = template.bpm;
    this.stems = template.stems.map((stem, index) => normalizeStem(stem, index));
    this.takeCounter = 0;
    this.recordings.clear();
    this.recordingBlobs.clear();
    return template;
  }

  addInputTrack(inputKey, label = null) {
    const definitions = {
      'drum-machine': { label: 'Drum Machine', kind: 'drums', level: 0.72 },
      'drum-kit': { label: 'Drum Kit', kind: 'drums', level: 0.74 },
      synth: { label: 'Synth', kind: 'synth', level: 0.66 },
      modular: { label: 'Modular Synth', kind: 'synth', level: 0.66 },
      guitar: { label: 'Guitar', kind: 'guitar', level: 0.64 },
      piano: { label: 'Piano', kind: 'keys', level: 0.66 },
    };
    const definition = definitions[inputKey];
    if (!definition || this.stems.length >= 12) return null;

    const siblingCount = this.stems.filter((stem) => stem.inputKey === inputKey).length;
    const number = siblingCount + 1;
    this.takeCounter += 1;
    const stem = normalizeStem(
      {
        id: `input-${inputKey}-${this.takeCounter}`,
        label: label || `${definition.label} ${number}`,
        kind: definition.kind,
        inputKey,
        level: definition.level,
        pan: 0,
        low: 0,
        high: 0,
        fx: 0,
        mute: false,
        solo: false,
        monitor: true,
        recordArm: false,
        clipActive: true,
        clipStart: 0,
        source: 'spectra-input-track',
      },
      this.stems.length,
    );
    this.stems.push(stem);
    return stem;
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
      fx: 0,
      mute: false,
      solo: false,
      clipActive: true,
      clipStart: 0,
      spatial: normalizeSpatialPosition(),
      assetId: null,
      source,
      performance: null,
      processing: processing ? { ...processing } : null,
    };
    this.stems.push(stem);
    if (this.stems.length > 12) this.stems.splice(0, this.stems.length - 12);
    return stem;
  }

  attachRecording(stemId, audioBuffer, blob = null) {
    if (audioBuffer) this.recordings.set(stemId, audioBuffer);
    if (blob) this.recordingBlobs.set(stemId, blob);
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

  setFx(id, value) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.fx = clamp(Number(value) || 0, 0, 1);
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

  toggleRecordArm(id) {
    const stem = this.stems.find((item) => item.id === id);
    if (!stem) return false;
    stem.recordArm = !stem.recordArm;
    stem.monitor = true;
    return stem.recordArm;
  }

  armedStems() {
    return this.stems.filter((stem) => stem.recordArm === true);
  }

  snapshot() {
    return {
      project: this.project === true,
      name: this.name,
      bpm: this.bpm,
      setup: { ...this.setup },
      stems: this.stems.map((stem) => ({
        ...stem,
        performance: stem.performance
          ? { ...stem.performance, events: stem.performance.events.map((event) => ({ ...event })) }
          : null,
        processing: stem.processing ? { ...stem.processing } : null,
      })),
      takeCounter: this.takeCounter,
      loopEnabled: this.loopEnabled === true,
      loopBars: LOOP_BAR_OPTIONS.includes(Number(this.loopBars)) ? Number(this.loopBars) : 4,
      quantize: QUANTIZE_OPTIONS.includes(this.quantize) ? this.quantize : '1/16',
      swing: clamp(Number(this.swing) || 0, 0, 0.45),
      clickEnabled: this.clickEnabled === true,
    };
  }
}
