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

  // Expanded James Benjamin / Boogieman runtime catalogue.
  'team-break': {
    type: 'audio',
    url: 'assets/audio/catalog/dance-beyond-genre/team-break.mp3',
    source: 'James Benjamin - Team Break',
  },
  'ancillary-things': {
    type: 'audio',
    url: 'assets/audio/catalog/dance-beyond-genre/ancillary-things.mp3',
    source: 'James Benjamin - Ancillary Things',
  },
  gairage: {
    type: 'audio',
    url: 'assets/audio/catalog/james-benjamin/gairage.mp3',
    source: 'James Benjamin × Jamvvis - Gairage',
  },
  'hit-the-floor': {
    type: 'audio',
    url: 'assets/audio/catalog/james-benjamin/hit-the-floor.mp3',
    source: 'James Benjamin ft Star Amerasu + Kizaba - Hit the Floor',
  },
  'chi-town-drop': {
    type: 'audio',
    url: 'assets/audio/catalog/james-benjamin/chi-town-drop.mp3',
    source: 'James Benjamin ft AmirSaysNothing - Chi Town Drop',
  },
  'guestlist-andy-s': {
    type: 'audio',
    url: 'assets/audio/catalog/james-benjamin/guestlist-andy-s.mp3',
    source: 'James Benjamin ft Andy S - Guestlist',
  },
  'drop-in': {
    type: 'audio',
    url: 'assets/audio/catalog/got-you-dancin/drop-in.mp3',
    source: 'James Benjamin - Drop In',
  },
  'body-check': {
    type: 'audio',
    url: 'assets/audio/catalog/got-you-dancin/body-check.mp3',
    source: 'James Benjamin - Body Check',
  },
  'play-ball-people': {
    type: 'audio',
    url: 'assets/audio/catalog/got-you-dancin/play-ball-people.mp3',
    source: 'James Benjamin - Play Ball (People)',
  },
  etcetera: {
    type: 'audio',
    url: 'assets/audio/catalog/got-you-dancin/etcetera.mp3',
    source: 'James Benjamin - Etcetera',
  },
  'airtime-express': {
    type: 'audio',
    url: 'assets/audio/catalog/got-you-dancin/airtime-express.mp3',
    source: 'James Benjamin - Airtime Express',
  },
  'rotations-the-roll': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/the-roll.mp3',
    source: 'Boogieman - The Roll',
  },
  'rotations-den-naben': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/den-naben.mp3',
    source: 'Boogieman - Den Naben',
  },
  'rotations-water-is-boiling': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/water-is-boiling.mp3',
    source: 'Boogieman - Water Is Boiling',
  },
  'rotations-adjust': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/adjust.mp3',
    source: 'Boogieman - Adjust',
  },
  'rotations-she': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/she.mp3',
    source: 'Boogieman - She',
  },
  'rotations-devils-mountain': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/devils-mountain.mp3',
    source: 'Boogieman - Devils Mountain and Ngorongoro Crater',
  },
  'rotations-fences': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/fences.mp3',
    source: 'Boogieman - Fences',
  },
  'rotations-water-is-boiling-outro': {
    type: 'audio',
    url: 'assets/audio/catalog/boogieman/rotations/water-is-boiling-outro.mp3',
    source: 'Boogieman - Water Is Boiling (Outro)',
  },

  // Music for the End of the World listening bank for Take A Break.
  'mfteot-nature-waterfall-rebirth': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/nature/waterfall-rebirth.mp3',
    source: 'Music for the End of the World - NATURE - Waterfall Rebirth',
  },
  'mfteot-nature-birds-at-the-sinks': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/nature/birds-at-the-sinks.mp3',
    source: 'Music for the End of the World - NATURE - The Birds at the Sinks',
  },
  'mfteot-nature-zona': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/nature/zona.mp3',
    source: 'Music for the End of the World - NATURE - Zona',
  },
  'mfteot-nature-cellular-imaginings': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/nature/cellular-imaginings.mp3',
    source: 'Music for the End of the World - NATURE - Cellular Imaginings 1',
  },
  'mfteot-nature-to-philly': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/nature/to-philly.mp3',
    source: 'Music for the End of the World - NATURE - To Philly v3 2022',
  },
  'mfteot-man-to-dream': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/man/to-dream.mp3',
    source: 'Music for the End of the World - MAN - To Dream',
  },
  'mfteot-man-phaser': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/man/phaser.mp3',
    source: 'Music for the End of the World - MAN - Phaser',
  },
  'mfteot-man-dead-mans': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/man/dead-mans.mp3',
    source: 'Music for the End of the World - MAN - Dead Mans',
  },
  'mfteot-man-decisions': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/man/decisions.mp3',
    source: 'Music for the End of the World - MAN - Decisions (Instrumental)',
  },
  'mfteot-man-deeper-b': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/man/deeper-b.mp3',
    source: 'Music for the End of the World - MAN - Deeper B',
  },
  'mfteot-man-nick-cave-esque': {
    type: 'audio',
    url: 'assets/audio/ambient/mfteot/man/nick-cave-esque.mp3',
    source: 'Music for the End of the World - MAN - Nick Cave Esque',
  },

  // Real grouped multitracks. Each session's buses have identical start and duration.
  'gairage-drums': {
    type: 'audio',
    url: 'assets/audio/studio/gairage/drums.mp3',
    source: 'Gairage grouped drums',
  },
  'gairage-bass': {
    type: 'audio',
    url: 'assets/audio/studio/gairage/bass.mp3',
    source: 'Gairage grouped bass',
  },
  'gairage-synths': {
    type: 'audio',
    url: 'assets/audio/studio/gairage/synths.mp3',
    source: 'Gairage grouped synths',
  },
  'gairage-fx': {
    type: 'audio',
    url: 'assets/audio/studio/gairage/fx.mp3',
    source: 'Gairage grouped FX',
  },
  'gairage-vocal-chop': {
    type: 'audio',
    url: 'assets/audio/studio/gairage/vocal-chop.mp3',
    source: 'Gairage vocal chop',
  },
  'in-an-instant-keys': {
    type: 'audio',
    url: 'assets/audio/studio/in-an-instant/keys.mp3',
    source: 'In an Instant ASR-88 keys',
  },
  'in-an-instant-jx3p': {
    type: 'audio',
    url: 'assets/audio/studio/in-an-instant/jx3p.mp3',
    source: 'In an Instant JX-3P',
  },
  'in-an-instant-syncussion': {
    type: 'audio',
    url: 'assets/audio/studio/in-an-instant/syncussion.mp3',
    source: 'In an Instant Syncussion',
  },
  'in-an-instant-modular-drums': {
    type: 'audio',
    url: 'assets/audio/studio/in-an-instant/modular-drums.mp3',
    source: 'In an Instant modular drums',
  },
  'in-an-instant-low-pulse': {
    type: 'audio',
    url: 'assets/audio/studio/in-an-instant/low-pulse.mp3',
    source: 'In an Instant low pulse',
  },

  'rainforest-ambix-dawn-loop': {
    type: 'audio',
    url: 'assets/audio/ambient/rainforest/rainforest-ambix-dawn-loop.wav',
    source:
      'James Benjamin · Photo Ambisonic Immersive Rainforest · 06.wav · compact first-order AmbiX game derivative',
  },
  'take-a-break-installation': {
    type: 'audio',
    url: null,
    source: 'Spatial installation media slot',
  },
};
