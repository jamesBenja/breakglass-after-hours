// Source masters and multitracks stay in Drive. For catalogue material that is already shared
// as link-readable, the prototype can stream the source directly. A future deploy should mirror
// these into optimized same-origin web copies for lower latency, tighter deck starts and mobile data use.
const driveDownload = (id) => `https://drive.google.com/uc?export=download&id=${id}`;

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

  // Breakglass catalogue masters sourced from James's Drive. The player first tries decoded
  // WebAudio; DJ/tape/studio transports can fall back to native browser streaming when Drive
  // does not grant CORS access to decodeAudioData.
  'got-you-dancin': {
    type: 'audio',
    url: driveDownload('1JLUgk49QDfwX2kZ16T9v6j38IXFnMsFo'),
    source: 'DJ Swisha × James Benjamin - Got U Dancin.mp3',
    remote: true,
  },
  'in-flux': {
    type: 'audio',
    url: driveDownload('1P6t7zj4l3KICvNLvzPcpwWZ1qADLQWsV'),
    source: 'James Benjamin × Jamvvis - In Flux - Just Be.mp3',
    remote: true,
  },
  'in-flux-just-be': {
    type: 'audio',
    url: driveDownload('1P6t7zj4l3KICvNLvzPcpwWZ1qADLQWsV'),
    source: 'James Benjamin × Jamvvis - Just Be.mp3',
    remote: true,
  },
  'in-flux-breath': {
    type: 'audio',
    url: driveDownload('1bO-uNngeBgXN0Ds-AyqXeUIId2siPsoX'),
    source: 'James Benjamin × Jamvvis - Breath.mp3',
    remote: true,
  },
  'in-flux-break': {
    type: 'audio',
    url: driveDownload('18JxuPqiODFjoE5pO7hNzb4lEXpToPiIH'),
    source: 'James Benjamin × Jamvvis - Break.mp3',
    remote: true,
  },
  'in-flux-gingele': {
    type: 'audio',
    url: driveDownload('18Shfdoc0NRJTEyMkVr8BENQTsUdi_wdx'),
    source: 'James Benjamin × Jamvvis - Gingele.mp3',
    remote: true,
  },
  atrakar: {
    type: 'audio',
    url: driveDownload('1dQcdZ0XQC1-u2sRyMqySBObNrzpHEdgX'),
    source: 'Jashim - ATRAKAR BG mix FINAL MASTERED.wav',
    remote: true,
  },
  'atrakar-instrumental': {
    type: 'audio',
    url: driveDownload('1VDLzuchjwNIX1g0Qm9e-zYSIJPgCnEa7'),
    source: 'Jashim - ATRAKAR BG mix INSTRUMENTAL.wav',
    remote: true,
  },
  'atrakar-vocal': {
    type: 'audio',
    url: driveDownload('13U8AiI-pDwJo-8dUQIlLnhw3Hi6HeT-m'),
    source: 'Jashim - ATRAKAR BG mix ACAPELLA.mp3',
    remote: true,
  },
  dubki: {
    type: 'audio',
    url: driveDownload('1QGGdLdIzWeJ2q9eoJP5HcVZXssOskdJ8'),
    source: 'Boogaloo Jones - Dubki master.mp3',
    remote: true,
  },
  paharpur: {
    type: 'audio',
    url: driveDownload('1gjN65vQbQczjJt04RzWUyGIsG9TLwBXh'),
    source: 'Boogaloo Jones - Paharpur master.mp3',
    remote: true,
  },
  fakir: {
    type: 'audio',
    url: driveDownload('1fX_FjToZ7Ew04W0LIVAvWRSUbDy2eLdw'),
    source: 'Boogaloo Jones - Fakir master.mp3',
    remote: true,
  },
  bhab: {
    type: 'audio',
    url: driveDownload('1MyvYGVPBFlmm2_5R-BzjCKoLX0uKUezk'),
    source: 'Boogaloo Jones - Bhab master.mp3',
    remote: true,
  },
  'diet-cake': { type: 'audio', url: null, source: 'Breakglass catalogue slot' },

  // Real multitrack demo session. These four source WAVs share a common start/duration.
  'dance-shoes-drums': {
    type: 'audio',
    url: driveDownload('19sjrt3914VeGuOH___ys9DYJT_x7cpWU'),
    source: 'DANCE SHOES BG MIX STEMS - drums.wav',
    remote: true,
  },
  'dance-shoes-bass': {
    type: 'audio',
    url: driveDownload('1MU0KJOYGlpXXEyWSPyXjZC63z6rnSLYQ'),
    source: 'DANCE SHOES BG MIX STEMS - bass.wav',
    remote: true,
  },
  'dance-shoes-synths-fx': {
    type: 'audio',
    url: driveDownload('1bAJjCl8JX_Lo52_z1_GnaiAJfe7IayU-'),
    source: 'DANCE SHOES BG MIX STEMS - synths and sound FX.wav',
    remote: true,
  },
  'dance-shoes-vox': {
    type: 'audio',
    url: driveDownload('1snVDkF49BR6HXkFwb1Sjbd6gnb6RR7qz'),
    source: 'DANCE SHOES BG MIX STEMS - vocals.wav',
    remote: true,
  },

  // Optional local media slot for replacing the procedural Take A Break sound field later.
  'take-a-break-installation': {
    type: 'audio',
    url: null,
    source: 'Spatial installation media slot',
  },
};
