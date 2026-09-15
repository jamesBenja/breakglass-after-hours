export const GAME_DIFFICULTIES = ['easy', 'medium', 'hard'];

const HINTS = {
  storage: {
    easy: 'Storage is locked. Find Jace upstairs and ask him about the studio tape archives.',
    medium: 'Storage is staff access. Someone on the studio floor who knows the archive history can open it for you.',
    hard: 'Storage is locked.',
  },
  'dead-room': {
    easy: 'The Dead Room is locked. Find Boogaloo upstairs and ask which guitars and amps belong together.',
    medium: 'The Dead Room is locked. One of the artists upstairs knows the guitar and amp setup well enough to let you in.',
    hard: 'The Dead Room is locked.',
  },
  shortcut: {
    easy: 'The service stair needs a special key. Complete every Spectra mixing challenge to earn it.',
    medium: 'A strange keyway is built into the service-stair door. The Spectra console may have something to do with it.',
    hard: 'The service stair is locked by an unusual keyway.',
  },
};

export function normalizeDifficulty(value) {
  return GAME_DIFFICULTIES.includes(value) ? value : 'medium';
}

export function progressionHint(id, difficulty = 'medium') {
  const mode = normalizeDifficulty(difficulty);
  const hints = HINTS[id] ?? {};
  return hints[mode] ?? hints.medium ?? 'Locked.';
}
