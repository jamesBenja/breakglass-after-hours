import { APPROVED_STUDIO_SOURCES } from '../audio/musicLibrary.js';

const stem = (id, label, kind, assetId, level = 0.72, pan = 0, source = 'Breakglass archive') => ({
  id,
  label,
  kind,
  assetId,
  level,
  pan,
  mute: false,
  solo: false,
  source,
});

// Sources approved in the music review but not yet optimized into same-origin runtime stems.
// Keeping these separate from STUDIO_SESSION_TEMPLATES prevents broken console choices while
// giving the ingest pass one authoritative queue to work through.
export const PENDING_STUDIO_SESSION_SOURCES = APPROVED_STUDIO_SOURCES.filter(
  (source) => !source.runtimeReady,
);

const ALL_STUDIO_SESSION_TEMPLATES = [
  // Dance Shoes remains internally addressable because older save/session code imports its stem
  // layout. The completed music review excluded it from selectable studio options, so the public
  // STUDIO_SESSION_TEMPLATES export filters it out below.
  {
    id: 'dance-shoes',
    label: 'Dance Shoes · BG Mix · 4 stems',
    name: 'Dance Shoes · BG Mix',
    bpm: 118,
    reviewExcluded: true,
    stems: [
      stem('dance-shoes-drums', 'Dance Shoes · Drums', 'drums', 'dance-shoes-drums', 0.78),
      stem('dance-shoes-bass', 'Dance Shoes · Bass', 'bass', 'dance-shoes-bass', 0.74),
      stem(
        'dance-shoes-synths-fx',
        'Dance Shoes · Synths + FX',
        'synth',
        'dance-shoes-synths-fx',
        0.66,
        0.08,
      ),
      stem('dance-shoes-vox', 'Dance Shoes · Vocals', 'vocal', 'dance-shoes-vox', 0.7),
    ],
  },
  {
    id: 'atrakar-two-stem',
    label: 'Jashim · ATRAKAR · instrumental + vocal',
    name: 'ATRAKAR · 2-stem BG mix',
    bpm: 128,
    stems: [
      stem('atrakar-instrumental', 'ATRAKAR · Instrumental', 'audio', 'atrakar-instrumental', 0.78),
      stem('atrakar-vocal', 'ATRAKAR · Vocal', 'vocal', 'atrakar-vocal', 0.72),
    ],
  },

  {
    id: 'gairage-multitrack',
    label: 'James Benjamin × Jamvvis · Gairage · 5 buses',
    name: 'Gairage · real multitrack',
    bpm: 152,
    stems: [
      stem('gairage-drums', 'Gairage · Drums', 'drums', 'gairage-drums', 0.78),
      stem('gairage-bass', 'Gairage · Bass', 'bass', 'gairage-bass', 0.74),
      stem('gairage-synths', 'Gairage · Synths', 'synth', 'gairage-synths', 0.66, 0.08),
      stem('gairage-fx', 'Gairage · FX', 'audio', 'gairage-fx', 0.58, -0.08),
      stem('gairage-vocal-chop', 'Gairage · Vocal Chop', 'vocal', 'gairage-vocal-chop', 0.62),
    ],
  },
  {
    id: 'in-an-instant-multitrack',
    label: 'James Benjamin · In an Instant · 5 buses',
    name: 'In an Instant · real multitrack',
    bpm: 129,
    stems: [
      stem(
        'in-an-instant-modular-drums',
        'In an Instant · Modular Drums',
        'drums',
        'in-an-instant-modular-drums',
        0.76,
      ),
      stem(
        'in-an-instant-low-pulse',
        'In an Instant · Low Pulse',
        'bass',
        'in-an-instant-low-pulse',
        0.7,
      ),
      stem(
        'in-an-instant-jx3p',
        'In an Instant · JX-3P',
        'synth',
        'in-an-instant-jx3p',
        0.68,
        -0.1,
      ),
      stem(
        'in-an-instant-syncussion',
        'In an Instant · Syncussion',
        'drums',
        'in-an-instant-syncussion',
        0.62,
        0.12,
      ),
      stem('in-an-instant-keys', 'In an Instant · ASR-88 Keys', 'keys', 'in-an-instant-keys', 0.64),
    ],
  },
  {
    id: 'got-you-dancin-master',
    label: 'DJ Swisha × James Benjamin · Got U Dancin',
    name: 'Got U Dancin · master playback',
    bpm: 130,
    stems: [
      stem('got-you-dancin-master', 'Got U Dancin · Master', 'audio', 'got-you-dancin', 0.78),
    ],
  },
  {
    id: 'in-flux-just-be',
    label: 'James Benjamin × Jamvvis · Just Be',
    name: 'In-Flux · Just Be',
    bpm: 126,
    stems: [stem('in-flux-just-be-master', 'Just Be · Master', 'audio', 'in-flux-just-be', 0.78)],
  },
  {
    id: 'in-flux-breath',
    label: 'James Benjamin × Jamvvis · Breath',
    name: 'In-Flux · Breath',
    bpm: 126,
    stems: [stem('in-flux-breath-master', 'Breath · Master', 'audio', 'in-flux-breath', 0.78)],
  },
  {
    id: 'in-flux-break',
    label: 'James Benjamin × Jamvvis · Break',
    name: 'In-Flux · Break',
    bpm: 126,
    stems: [stem('in-flux-break-master', 'Break · Master', 'audio', 'in-flux-break', 0.78)],
  },
  {
    id: 'in-flux-gingele',
    label: 'James Benjamin × Jamvvis · Gingele',
    name: 'In-Flux · Gingele',
    bpm: 126,
    stems: [stem('in-flux-gingele-master', 'Gingele · Master', 'audio', 'in-flux-gingele', 0.78)],
  },
  {
    id: 'dubki-master',
    label: 'Boogaloo Jones · Dubki',
    name: 'Dubki · master playback',
    bpm: 124,
    stems: [stem('dubki-master', 'Dubki · Master', 'audio', 'dubki', 0.78)],
  },
  {
    id: 'paharpur-master',
    label: 'Boogaloo Jones · Paharpur',
    name: 'Paharpur · master playback',
    bpm: 124,
    stems: [stem('paharpur-master', 'Paharpur · Master', 'audio', 'paharpur', 0.78)],
  },
  {
    id: 'fakir-master',
    label: 'Boogaloo Jones · Fakir',
    name: 'Fakir · master playback',
    bpm: 124,
    stems: [stem('fakir-master', 'Fakir · Master', 'audio', 'fakir', 0.78)],
  },
  {
    id: 'bhab-master',
    label: 'Boogaloo Jones · Bhab',
    name: 'Bhab · master playback',
    bpm: 124,
    stems: [stem('bhab-master', 'Bhab · Master', 'audio', 'bhab', 0.78)],
  },
];

export const STUDIO_SESSION_TEMPLATES = ALL_STUDIO_SESSION_TEMPLATES.filter(
  (session) => !session.reviewExcluded,
);

export const studioSessionById = (id) =>
  ALL_STUDIO_SESSION_TEMPLATES.find((session) => session.id === id) ?? null;
