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

export const STUDIO_SESSION_TEMPLATES = [
  {
    id: 'dance-shoes',
    label: 'Dance Shoes · BG Mix · 4 stems',
    name: 'Dance Shoes · BG Mix',
    bpm: 118,
    stems: [
      stem('dance-shoes-drums', 'Dance Shoes · Drums', 'drums', 'dance-shoes-drums', 0.78),
      stem('dance-shoes-bass', 'Dance Shoes · Bass', 'bass', 'dance-shoes-bass', 0.74),
      stem('dance-shoes-synths-fx', 'Dance Shoes · Synths + FX', 'synth', 'dance-shoes-synths-fx', 0.66, 0.08),
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

export const studioSessionById = (id) =>
  STUDIO_SESSION_TEMPLATES.find((session) => session.id === id) ?? null;
