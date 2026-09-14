// Source masters and multitracks stay in Drive. Runtime audio is served from same-origin files
// under public/assets/audio so WebAudio can decode them reliably in every supported browser.
// See MEDIA_SETUP.md and the downloadable audio pack prepared for this branch.
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
  'roof-building': {
    type: 'model',
    url: null,
    includesFixtures: false,
    source: 'Breakglass rooftop founding-days memory-space prototype',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
  },

  // Procedural prototype slots retained for debugging / fallback gameplay.
  'night-bus': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
  'glass-floor': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },
  '3am-tool': { type: 'audio', url: null, source: 'Synthesized V2.1 placeholder' },

  // Breakglass catalogue. These paths intentionally point to local public assets rather than
  // Drive links: Drive's download endpoints are not a dependable CORS-enabled media CDN.
  'got-you-dancin': {
    type: 'audio',
    url: 'assets/audio/catalog/got-you-dancin.mp3',
    source: 'DJ Swisha × James Benjamin - Got U Dancin master',
  },
  'in-flux': {
    type: 'audio',
    url: 'assets/audio/catalog/in-flux/just-be.mp3',
    source: 'James Benjamin × Jamvvis - In Flux - Just Be',
  },
  'in-flux-just-be': {
    type: 'audio',
    url: 'assets/audio/catalog/in-flux/just-be.mp3',
    source: 'James Benjamin × Jamvvis - Just Be',
  },
  'in-flux-breath': {
    type: 'audio',
    url: 'assets/audio/catalog/in-flux/breath.mp3',
    source: 'James Benjamin × Jamvvis - Breath',
  },
  'in-flux-break': {
    type: 'audio',
    url: 'assets/audio/catalog/in-flux/break.mp3',
    source: 'James Benjamin × Jamvvis - Break',
  },
  'in-flux-gingele': {
    type: 'audio',
    url: 'assets/audio/catalog/in-flux/gingele.mp3',
    source: 'James Benjamin × Jamvvis - Gingele',
  },
  atrakar: {
    type: 'audio',
    url: 'assets/audio/catalog/jashim/atrakar.mp3',
    source: 'Jashim - ATRAKAR BG mix FINAL MASTERED',
  },
  'atrakar-instrumental': {
    type: 'audio',
    url: 'assets/audio/catalog/jashim/atrakar-instrumental.mp3',
    source: 'Jashim - ATRAKAR BG mix INSTRUMENTAL',
  },
  'atrakar-vocal': {
    type: 'audio',
    url: 'assets/audio/catalog/jashim/atrakar-vocal.mp3',
    source: 'Jashim - ATRAKAR BG mix ACAPELLA',
  },
  dubki: {
    type: 'audio',
    url: 'assets/audio/catalog/boogaloo/dubki.mp3',
    source: 'Boogaloo Jones - Dubki master',
  },
  paharpur: {
    type: 'audio',
    url: 'assets/audio/catalog/boogaloo/paharpur.mp3',
    source: 'Boogaloo Jones - Paharpur master',
  },
  fakir: {
    type: 'audio',
    url: 'assets/audio/catalog/boogaloo/fakir.mp3',
    source: 'Boogaloo Jones - Fakir master',
  },
  bhab: {
    type: 'audio',
    url: 'assets/audio/catalog/boogaloo/bhab.mp3',
    source: 'Boogaloo Jones - Bhab master',
  },
  'diet-cake': { type: 'audio', url: null, source: 'Breakglass catalogue slot' },

  // Dance Shoes multitrack. All four files share the same start/duration and are exported with
  // identical codec settings so StudioPlayback can launch them together as console channels.
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

  'take-a-break-installation': {
    type: 'audio',
    url: null,
    source: 'Spatial installation media slot',
  },
};
