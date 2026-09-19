export const INSTALLATION_PROGRAMS = Object.freeze([
  {
    id: 'abstract-drift',
    label: 'Abstract Drift',
    artist: 'Breakglass',
    available: true,
    kind: 'procedural',
    description:
      'The original eight-speaker synthetic installation: slow tonal movement, changing depth and psychedelic spatial drift.',
    toneFrequencies: [82.41, 110, 146.83, 164.81, 220, 293.66, 329.63, 440],
    toneWaves: ['sine', 'triangle', 'sine', 'triangle', 'sine', 'triangle', 'sine', 'triangle'],
    toneLevel: 1,
    noiseLevel: 0.025,
    noiseFilter: 'lowpass',
    noiseFrequency: 7600,
    movementRate: 1,
    movementDepth: 1,
    space: 0.52,
    lowpassHz: 18500,
  },
  {
    id: 'rainforest-study',
    label: 'Photo Ambisonic Immersive Rainforest · Dawn Field',
    artist: 'James Benjamin',
    available: true,
    kind: 'ambix-recorded',
    assetId: 'rainforest-ambix-dawn-loop',
    ambixFormat: 'ACN/SN3D',
    ambixOrder: 1,
    sourceHour: 6,
    sourceOffsetSeconds: 1800,
    description:
      'A real first-order AmbiX excerpt from the Costa Rica Photo Ambisonic installation, decoded over the eight-speaker Take A Break array. The compact game loop is sourced from the 06:00 hourly master while the full 24-hour installation remains archived in Drive.',
    // Retained only as a fail-safe if the compact AmbiX media cannot be decoded in a browser.
    fallbackKind: 'procedural',
    toneFrequencies: [1760, 2330, 1480, 2860, 1980, 3180, 1260, 2480],
    toneWaves: ['sine', 'triangle', 'sine', 'sine', 'triangle', 'sine', 'triangle', 'sine'],
    toneLevel: 0.34,
    noiseLevel: 1.05,
    noiseFilter: 'bandpass',
    noiseFrequency: 2400,
    noiseSpread: 2200,
    movementRate: 0.58,
    movementDepth: 0.86,
    space: 0.68,
    lowpassHz: 16500,
  },
  {
    id: 'beach-field',
    label: 'Beach Field',
    artist: 'Breakglass',
    available: true,
    kind: 'procedural',
    description:
      'A slow eight-speaker shoreline study: filtered surf rolls around the room with low distant water energy and long spatial breathing.',
    toneFrequencies: [55, 65.41, 73.42, 82.41, 61.74, 49, 69.3, 77.78],
    toneWaves: ['sine', 'sine', 'triangle', 'sine', 'sine', 'triangle', 'sine', 'sine'],
    toneLevel: 0.2,
    noiseLevel: 1.2,
    noiseFilter: 'lowpass',
    noiseFrequency: 1550,
    noiseSpread: 900,
    movementRate: 0.34,
    movementDepth: 1.05,
    space: 0.74,
    lowpassHz: 12500,
  },
  {
    id: 'mountain-snowstorm',
    label: 'Mountain Snowstorm',
    artist: 'Breakglass',
    available: true,
    kind: 'procedural',
    description:
      'A cold, high-altitude storm field: wind bands shear between the eight positions while low mountain pressure moves underneath.',
    toneFrequencies: [46.25, 55, 61.74, 73.42, 82.41, 51.91, 65.41, 43.65],
    toneWaves: ['sine', 'triangle', 'sine', 'sine', 'triangle', 'sine', 'triangle', 'sine'],
    toneLevel: 0.26,
    noiseLevel: 1.28,
    noiseFilter: 'highpass',
    noiseFrequency: 1250,
    noiseSpread: 1750,
    movementRate: 0.82,
    movementDepth: 1.28,
    space: 0.8,
    lowpassHz: 17800,
  },

  {
    id: 'mfteot-nature',
    label: 'Music for the End of the World · NATURE',
    artist: 'James Benjamin',
    available: true,
    kind: 'recorded-playlist',
    description:
      'Five full-length NATURE works presented as a continuous listening program inside Take A Break.',
    assetIds: [
      'mfteot-nature-waterfall-rebirth',
      'mfteot-nature-birds-at-the-sinks',
      'mfteot-nature-zona',
      'mfteot-nature-cellular-imaginings',
      'mfteot-nature-to-philly',
    ],
  },
  {
    id: 'mfteot-man',
    label: 'Music for the End of the World · MAN',
    artist: 'James Benjamin',
    available: true,
    kind: 'recorded-playlist',
    description:
      'Six full-length MAN works presented as a continuous listening program inside Take A Break.',
    assetIds: [
      'mfteot-man-to-dream',
      'mfteot-man-phaser',
      'mfteot-man-dead-mans',
      'mfteot-man-decisions',
      'mfteot-man-deeper-b',
      'mfteot-man-nick-cave-esque',
    ],
  },
  {
    id: 'breakglass-compositions',
    label: 'Breakglass Compositions',
    artist: 'Breakglass artists',
    available: false,
    kind: 'catalog-slot',
    description:
      'Reserved program bank for pieces composed specifically for the eight-speaker Take A Break room.',
  },
  {
    id: 'guest-pieces',
    label: 'Guest Pieces',
    artist: 'Guest artists',
    available: false,
    kind: 'catalog-slot',
    description:
      'Reserved program bank for invited artists and spatial-audio works presented inside the virtual room.',
  },
]);

export const DEFAULT_INSTALLATION_PROGRAM_ID = 'abstract-drift';

export function installationProgramById(id) {
  return (
    INSTALLATION_PROGRAMS.find((program) => program.id === id) ??
    INSTALLATION_PROGRAMS.find((program) => program.id === DEFAULT_INSTALLATION_PROGRAM_ID)
  );
}

export function availableInstallationPrograms() {
  return INSTALLATION_PROGRAMS.filter((program) => program.available);
}
