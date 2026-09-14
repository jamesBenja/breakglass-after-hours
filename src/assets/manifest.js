// Source masters and multitracks stay in Drive. Only optimized web copies belong in public/.
// Paths are relative to Vite's public/base URL, e.g. assets/models/below.glb.
export const assetManifest = {
  'upstairs-building': {
    type: 'model',
    url: null,
    includesFixtures: false,
    source: 'Breakglass Studios - FULL FLOOR PLANS PACKAGE.pdf',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  'below-building': {
    type: 'model',
    url: null,
    includesFixtures: false,
    source: 'Below Breakglass 2025.skp + technical diagram',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  'alley-building': {
    type: 'model',
    url: null,
    includesFixtures: false,
    source: 'Breakglass Studios - FULL FLOOR PLANS PACKAGE.pdf / A-101',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },
  'night-bus': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
  'glass-floor': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
  '3am-tool': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },

  // First approved catalogue master prepared from Drive as an optimized web copy.
  'got-you-dancin': {
    type: 'audio',
    url: 'assets/audio/got-you-dancin.mp3',
    source: 'DJ Swisha x James Benjamin - Got U Dancin master',
  },
  'in-flux': { type: 'audio', url: null, source: 'Breakglass catalogue slot' },
  atrakar: { type: 'audio', url: null, source: 'Breakglass catalogue slot' },
  dubki: { type: 'audio', url: null, source: 'Breakglass catalogue slot' },
  'diet-cake': { type: 'audio', url: null, source: 'Breakglass catalogue slot' },

  // Real multitrack demo session. These four files share the same start and duration so
  // StudioPlayback can launch them sample-aligned into independent console channels.
  'dance-shoes-drums': {
    type: 'audio',
    url: 'assets/audio/dance-shoes/drums.mp3',
    source: 'DANCE SHOES BG MIX STEMS - drums',
  },
  'dance-shoes-bass': {
    type: 'audio',
    url: 'assets/audio/dance-shoes/bass.mp3',
    source: 'DANCE SHOES BG MIX STEMS - bass',
  },
  'dance-shoes-synths-fx': {
    type: 'audio',
    url: 'assets/audio/dance-shoes/synths-fx.mp3',
    source: 'DANCE SHOES BG MIX STEMS - synths and sound FX',
  },
  'dance-shoes-vox': {
    type: 'audio',
    url: 'assets/audio/dance-shoes/vox.mp3',
    source: 'DANCE SHOES BG MIX STEMS - vocals',
  },
};
