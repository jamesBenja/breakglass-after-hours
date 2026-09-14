export const TAPE_ARCHIVE = [
  {
    id: 'got-you-dancin-reel',
    label: 'Archive dub · Got U Dancin',
    assetId: 'got-you-dancin',
    source: 'DJ Swisha × James Benjamin master',
    root: 55,
  },
  {
    id: 'atrakar-reel',
    label: 'Archive dub · ATRAKAR',
    assetId: 'atrakar',
    source: 'Jashim · ATRAKAR final master',
    root: 65.4,
  },
  {
    id: 'in-flux-just-be-reel',
    label: 'Archive dub · In-Flux / Just Be',
    assetId: 'in-flux-just-be',
    source: 'James Benjamin × Jamvvis master',
    root: 73.4,
  },
  {
    id: 'dubki-reel',
    label: 'Archive dub · Dubki',
    assetId: 'dubki',
    source: 'Boogaloo Jones master',
    root: 82.4,
  },
];

export const ARCHIVE_TAPE_IDS = TAPE_ARCHIVE.map((tape) => tape.id);
export const tapeArchiveById = (id) => TAPE_ARCHIVE.find((tape) => tape.id === id) ?? null;
