// Curated from the Breakglass Game Music Drive review completed 2026-09-17.
//
// Runtime-ready entries already have optimized same-origin audio in public/assets/audio.
// Approved-source entries are intentionally NOT exposed as playable UI until their game audio
// derivatives are ingested. This keeps Drive as the source-master archive without making the
// game depend on expiring/authenticated Drive URLs.

export const RUNTIME_DJ_LIBRARY = [
  {
    id: 'got-you-dancin',
    label: 'DJ Swisha × James Benjamin · Got U Dancin',
    collection: 'Got You Dancin',
  },
  {
    id: 'in-flux-just-be',
    label: 'James Benjamin × Jamvvis · Just Be',
    collection: 'In-Flux',
  },
  {
    id: 'in-flux-breath',
    label: 'James Benjamin × Jamvvis · Breath',
    collection: 'In-Flux',
  },
  {
    id: 'in-flux-break',
    label: 'James Benjamin × Jamvvis · Break',
    collection: 'In-Flux',
  },
  {
    id: 'in-flux-gingele',
    label: 'James Benjamin × Jamvvis · Gingele',
    collection: 'In-Flux',
  },
  { id: 'atrakar', label: 'Jashim · ATRAKAR', collection: 'Breakglass Records' },
  { id: 'dubki', label: 'Boogaloo Jones · Dubki', collection: 'Dubki' },
  { id: 'paharpur', label: 'Boogaloo Jones · Paharpur', collection: 'Dubki' },
  { id: 'fakir', label: 'Boogaloo Jones · Fakir', collection: 'Dubki' },
  { id: 'bhab', label: 'Boogaloo Jones · Bhab', collection: 'Dubki' },
];

export const APPROVED_DJ_INGEST = [
  [
    'team-break',
    'James Benjamin · Team Break',
    'Dance Beyond Genre Vol. 1',
    '1sNTb0aOzS09o874S7rmfppHgwIcwlLcf',
  ],
  [
    'ancillary-things',
    'James Benjamin · Ancillary Things',
    'Dance Beyond Genre Vol. 1',
    '1sNTb0aOzS09o874S7rmfppHgwIcwlLcf',
  ],
  ['gairage', 'James Benjamin × Jamvvis · Gairage', 'Gairage', '1RtHx6LA5mmbijBLvIWaaWtPxESCNRayq'],
  [
    'hit-the-floor',
    'James Benjamin ft Star Amerasu + Kizaba · Hit the Floor',
    'Singles',
    '1RLCmVvPfNh07KhHRA93AsKuqmLTPqUB5',
  ],
  [
    'chi-town-drop',
    'James Benjamin ft AmirSaysNothing · Chi Town Drop',
    'Singles',
    '1RLCmVvPfNh07KhHRA93AsKuqmLTPqUB5',
  ],
  ['drop-in', 'James Benjamin · Drop In', 'Got You Dancin', '10Mb4ssBEBh9yGzuR19liBArUrd4RDbEf'],
  [
    'body-check',
    'James Benjamin · Body Check',
    'Got You Dancin',
    '10Mb4ssBEBh9yGzuR19liBArUrd4RDbEf',
  ],
  [
    'play-ball-people',
    'James Benjamin · Play Ball (People)',
    'Got You Dancin',
    '10Mb4ssBEBh9yGzuR19liBArUrd4RDbEf',
  ],
  ['etcetera', 'James Benjamin · Etcetera', 'Got You Dancin', '10Mb4ssBEBh9yGzuR19liBArUrd4RDbEf'],
  [
    'airtime-express',
    'James Benjamin · Airtime Express',
    'Got You Dancin',
    '10Mb4ssBEBh9yGzuR19liBArUrd4RDbEf',
  ],
  ['rotations-the-roll', 'Boogieman · The Roll', 'Rotations', '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb'],
  [
    'rotations-den-naben',
    'Boogieman · Den Naben',
    'Rotations',
    '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb',
  ],
  [
    'rotations-water-is-boiling',
    'Boogieman · Water Is Boiling',
    'Rotations',
    '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb',
  ],
  ['rotations-adjust', 'Boogieman · Adjust', 'Rotations', '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb'],
  ['rotations-she', 'Boogieman · She', 'Rotations', '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb'],
  [
    'rotations-devils-mountain',
    'Boogieman · Devils Mountain and Ngorongoro Crater',
    'Rotations',
    '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb',
  ],
  ['rotations-fences', 'Boogieman · Fences', 'Rotations', '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb'],
  [
    'rotations-water-is-boiling-outro',
    'Boogieman · Water Is Boiling (Outro)',
    'Rotations',
    '1rWm-iTt0NS89Rj1T9oXsj55jJi8kcaxb',
  ],
  [
    'guestlist-andy-s',
    'James Benjamin ft Andy S · Guestlist',
    'Singles',
    '143l1B1T07K3TJrMiTv3FHQqjGObh6Boj',
  ],
].map(([id, label, collection, sourceFolderId]) => ({
  id,
  label,
  collection,
  sourceFolderId,
  approved: true,
  runtimeReady: false,
}));

// These were explicitly included for the game review, but they contain third-party source works.
// Keep them out of a public/commercial binary ingest until clearance/release scope is resolved.
export const APPROVED_EDIT_INGEST = [
  ['in-ha-mood-flip', 'In Ha Mood · James Benjamin Jersey Club Flip'],
  ['slave-4-u-flip-100', "I'm a Slave 4 U · James Benjamin Footwork Flip · 100 BPM"],
  ['slave-4-u-flip-145', "I'm a Slave 4 U · James Benjamin Footwork Flip · 145 BPM"],
  ['slave-4-u-flip-160', "I'm a Slave 4 U · James Benjamin Footwork Flip · 160 BPM"],
  ['hollaback-girl-flip', 'Hollaback Girl · James Benjamin bubbling flip'],
  ['doom-flip', 'Doom · James Benjamin dembow edit'],
  ['porsche-truck-flip', 'Porsche Truck · James Benjamin Jersey edit · 145 BPM'],
  ['rollout-flip', 'Rollout (My Business) · James Benjamin edit'],
  ['slugo-hoe-flip', "Wouldn't You Like to Be a Ho · James Benjamin edit"],
  ['pata-pata-edit', 'Pata Pata · James Benjamin edit'],
  ['two-phones-coco-edit', '2 Phones x Coco · James Benjamin edit'],
  ['dang-jungle-edit', 'Dang · James Benjamin + Andrea de Tour jungle edit · 150 BPM'],
].map(([id, label]) => ({
  id,
  label,
  approved: true,
  runtimeReady: false,
  rightsGate: 'third-party-source-work',
}));

export const APPROVED_AMBIENT_INGEST = [
  [
    'mfteot-nature-waterfall-rebirth',
    'Waterfall Rebirth',
    'NATURE',
    '1TKGxeDoIqA314b-qppDK1lhzvSfYiwSN',
  ],
  [
    'mfteot-nature-birds-at-the-sinks',
    'The Birds at the Sinks',
    'NATURE',
    '1TKGxeDoIqA314b-qppDK1lhzvSfYiwSN',
  ],
  ['mfteot-nature-zona', 'Zona', 'NATURE', '1TKGxeDoIqA314b-qppDK1lhzvSfYiwSN'],
  [
    'mfteot-nature-cellular-imaginings',
    'Cellular Imaginings 1',
    'NATURE',
    '1TKGxeDoIqA314b-qppDK1lhzvSfYiwSN',
  ],
  ['mfteot-nature-to-philly', 'To Philly v3 2022', 'NATURE', '1TKGxeDoIqA314b-qppDK1lhzvSfYiwSN'],
  ['mfteot-man-to-dream', 'To Dream', 'MAN', '1vL-ZUGdCscOY69_jDQK5yBzmZTDZ45cS'],
  ['mfteot-man-phaser', 'Phaser', 'MAN', '1vL-ZUGdCscOY69_jDQK5yBzmZTDZ45cS'],
  ['mfteot-man-dead-mans', 'Dead Mans', 'MAN', '1vL-ZUGdCscOY69_jDQK5yBzmZTDZ45cS'],
  ['mfteot-man-decisions', 'Decisions (Instrumental)', 'MAN', '1vL-ZUGdCscOY69_jDQK5yBzmZTDZ45cS'],
  ['mfteot-man-deeper-b', 'Deeper B', 'MAN', '1vL-ZUGdCscOY69_jDQK5yBzmZTDZ45cS'],
  ['mfteot-man-nick-cave-esque', 'Nick Cave Esque', 'MAN', '1vL-ZUGdCscOY69_jDQK5yBzmZTDZ45cS'],
].map(([id, label, volume, sourceFolderId]) => ({
  id,
  label,
  collection: `Music for the End of the World · ${volume}`,
  sourceFolderId,
  approved: true,
  runtimeReady: false,
}));

export const APPROVED_STUDIO_SOURCES = [
  ['atrakar-full-stems', 'ATRAKAR · full multitrack', '128', '1ZzQl2p_u6hBKyjYy40IapUVwpW--E9uN'],
  ['gairage-stems', 'Gairage · exports + stems', null, '1RtHx6LA5mmbijBLvIWaaWtPxESCNRayq'],
  ['in-an-instant-stems', 'In an Instant · stems', '129', '11GCLjknD-ry17iV4bNcg-WeueAezAPRZ'],
  [
    'soundscape-jashim-jb',
    'Soundscape · Jashim × James Benjamin',
    null,
    '1m8m1oTDxLx4Lry6NB1slpeMpUF6mG366',
  ],
  ['feedback-loop-stems', 'Feedback Loop · stems', '145', '1Da5gwERMxGeYnBXjrsnjoyZaNR7uuHTb'],
  [
    'babizulu-140-stems',
    'James Benjamin ft Babizulu · stems',
    '140',
    '1WQ_7Y2rEwy39H58u4Wu9upVYY6kM5qZw',
  ],
  [
    'umbrella-jolani-stems',
    'Umbrella · James Benjamin × Jolani · stems',
    null,
    '1tIjDFuTJukMTb2VWRJa2ny0Y1fkPlHdb',
  ],
  ['hit-it-tromac-stems', 'Hit It · stems for Tromac', '145', '1vC2hLgW5tNuKR-Sx_WMOXG1_pREgoIFp'],
  ['opal-stems', 'The Opal · stems', null, '1dzod5irNQbTgwpaguhquMMyhnTyqMIOg'],
  [
    'planet-pillow-stems',
    'Lunice × James Benjamin × Pax · Planet Pillow',
    null,
    '1_Fza_e5CUCE6R9bCKE8qwEOg-jKsxhpi',
  ],
  [
    'kizaba-future-village-stems',
    'Kizaba · Future Village stem collection',
    '85–161',
    '1CfmFKjeA7sSwRvR8EegmR3DjT8tiuRf6',
  ],
  [
    'la-loft-11-lunice-stems',
    'LA Loft 11 · stems for Lunice',
    null,
    '198xHUIc6BRA7AkXvn-XidtRVuhis9Y-n',
  ],
  ['pro-stems-91', 'Unfinished studio session · 91 BPM', '91', '13IEY9J6q66wmhO3WOiIHwiNVWA5HM7pg'],
  [
    'pro-session-stems-88',
    'Unfinished studio session · 88 BPM',
    '88',
    '1bUBAA7JjnPy8Kwllyjvrb_ZlvZ3bT77O',
  ],
].map(([id, label, bpm, sourceFolderId]) => ({
  id,
  label,
  bpm,
  sourceFolderId,
  approved: true,
  runtimeReady: false,
}));

export const RIGHTS_GATED_STUDIO_SOURCES = [
  {
    id: 'honeydrip-remix-stems',
    label: 'Honeydrip · remix stems',
    sourceFolderId: '1lkVrvfcyP7PdniX5eHIwoCqkrO8yFu5_',
    rightsGate: 'needs-rights-check',
  },
  {
    id: 'sound-gyal-remix-stems',
    label: 'Sound Gyal Remix · stems',
    sourceFolderId: '1IgPvmVxpbhXa6aGdN3IuAcN5UwzCiq2L',
    rightsGate: 'needs-rights-check',
  },
];

export const APPROVED_LONGFORM_SOURCES = [
  [
    'james-nts-club-aerobics-2025',
    'James Benjamin · NTS Club Aerobics',
    '1vI9AQ6iRf9s1hHUN1UizJ7BG_tA8uNCe',
    'dj-mix',
  ],
  [
    'james-datcha-isa-jamvvis-2024',
    'James Benjamin / Isa Boom / Jamvvis · Datcha',
    '1vs8K5TgOwXW-BHLiyXPjh-7BHmPEgO01',
    'dj-mix',
  ],
  [
    'james-jamvvis-dotdotdot-2024',
    'James Benjamin b2b Jamvvis · DotDotDot',
    '1OnEuDQVIHZKSMKqiCLWVG6kcNF4THpk7',
    'dj-mix',
  ],
  [
    'james-mal-necessaire-2024',
    'James Benjamin · Mal Nécessaire',
    '1f0qnG-m8uM6RujHOs5finI3i1PzSiqeT',
    'dj-mix',
  ],
  [
    'james-mess-du-dimanche-2024',
    'James Benjamin · Mess du Dimanche 001',
    '1lxOmETjHS2aCmcvvIGdyrHuBnNKMS7Xc',
    'dj-mix',
  ],
  ['james-systeme-2023', 'James Benjamin · Système', '1FiW6TErG6BQuVSVocdB2gUE-M1YgFr0H', 'dj-mix'],
  [
    'james-night-shift-2023',
    'James Benjamin · Night Shift',
    '14K7HfSzmR2o797knVENwKdxJhWO7r9Mi',
    'dj-mix',
  ],
  ['james-datcha-2023', 'James Benjamin · Datcha', '1-Q7mqM77FJjF_WgFqowo2TLz-ZqVdoEX', 'dj-mix'],
  [
    'james-quan-non-stop-2023',
    'James Benjamin × Quan · Non Stop',
    '1K41gOL7zObFDf0C39mzVNkug5t1YEjVo',
    'live-set',
  ],
  [
    'james-quan-homeby6-2024',
    'James Benjamin × Quan · Breakglass × Homeby6',
    '1uNmGIDOeL46h9TnReGoiX9_mvv3X_ogO',
    'live-set',
  ],
  [
    'james-dj-rehearsal-2026',
    'James Benjamin · DJ rehearsal',
    '1Ss8QTl8je1I5blur9mI9lg3gd89ydfJL',
    'video-source',
  ],
].map(([id, label, sourceFolderId, kind]) => ({
  id,
  label,
  kind,
  sourceFolderId,
  approved: true,
  runtimeReady: false,
  rightsGate: kind === 'live-set' ? 'collaborator-and-sample-check' : 'third-party-dj-material',
}));

// James gets a real continuous fallback programme immediately from audio already in the build.
// Once an approved long-form set is optimized and added to the manifest, HouseDjSystem can prefer
// that continuous asset without changing the fallback crate.
export const NPC_DJ_PROGRAMS = {
  'james-benjamin': {
    preferredLongformIds: APPROVED_LONGFORM_SOURCES.filter((entry) => entry.kind === 'dj-mix').map(
      (entry) => entry.id,
    ),
    fallback: [
      { id: 'got-you-dancin', label: 'Got U Dancin' },
      { id: 'in-flux-just-be', label: 'Just Be' },
      { id: 'in-flux-breath', label: 'Breath' },
      { id: 'in-flux-break', label: 'Break' },
      { id: 'in-flux-gingele', label: 'Gingele' },
    ],
  },
};
