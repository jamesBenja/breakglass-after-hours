export const LIVE_FROM_BREAKGLASS = [
  {
    id: 'barr-brothers-kexp-2017',
    label: 'The Barr Brothers · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: 'M6eP7VTMQmw',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'besnard-lakes-kexp-2017',
    label: 'The Besnard Lakes · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: 'WCth8d562p0',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'paupiere-kexp-2017',
    label: 'Paupière · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: '1f4QptrkeoE',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'moon-king-natty-g-kexp-2017',
    label: 'Moon King & Natty G · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: 'uojij2MZQ90',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'tess-roby-kexp-2017',
    label: 'Tess Roby · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: 'Cyko-s0jshY',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'luyas-kexp-2017',
    label: 'The Luyas · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: 'FA1QVUuE3LA',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'big-brave-kexp-2017',
    label: 'Big Brave · Live on KEXP at Breakglass',
    year: 2017,
    youtubeId: 'bxES-V1_Xpg',
    source: 'Live From Breakglass / KEXP',
  },
  {
    id: 'fieldnote-launch-2026',
    label: 'Fieldnote · Breakglass Records launch · March 2026',
    year: 2026,
    youtubeId: null,
    source: 'Breakglass local archive slot',
  },
];

export const LIVE_ARCHIVE_IDS = LIVE_FROM_BREAKGLASS.map((session) => session.id);

export const liveArchiveById = (id) =>
  LIVE_FROM_BREAKGLASS.find((session) => session.id === id) ?? null;
