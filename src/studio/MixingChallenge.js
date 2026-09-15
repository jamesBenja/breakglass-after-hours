import { StudioSession } from './StudioSession.js';

const values = (level, pan = 0, low = 0, high = 0, fx = 0) => ({
  level,
  pan,
  low,
  high,
  fx,
});

const DANCE_SHOES = {
  drums: 'dance-shoes-drums',
  bass: 'dance-shoes-bass',
  synths: 'dance-shoes-synths-fx',
  vox: 'dance-shoes-vox',
};

/**
 * The challenge catalog intentionally separates the game rules from the audio session.
 * Dance Shoes is a temporary training source; future Breakglass multitracks can replace or
 * extend these entries simply by pointing a level at another sessionId and target profile.
 */
export const MIXING_CHALLENGES = [
  {
    id: 'spectra-01-balance',
    level: 1,
    label: 'Balance',
    sessionId: 'dance-shoes',
    parameters: ['level'],
    tolerances: { level: 0.075 },
    start: {
      [DANCE_SHOES.drums]: values(0.46),
      [DANCE_SHOES.bass]: values(0.53),
      [DANCE_SHOES.synths]: values(0.81),
      [DANCE_SHOES.vox]: values(0.48),
    },
    target: {
      [DANCE_SHOES.drums]: values(0.8),
      [DANCE_SHOES.bass]: values(0.69),
      [DANCE_SHOES.synths]: values(0.61),
      [DANCE_SHOES.vox]: values(0.76),
    },
  },
  {
    id: 'spectra-02-stereo',
    level: 2,
    label: 'Stereo field',
    sessionId: 'dance-shoes',
    parameters: ['level', 'pan'],
    tolerances: { level: 0.07, pan: 0.13 },
    start: {
      [DANCE_SHOES.drums]: values(0.66, -0.28),
      [DANCE_SHOES.bass]: values(0.8, 0.31),
      [DANCE_SHOES.synths]: values(0.54, 0.42),
      [DANCE_SHOES.vox]: values(0.61, -0.37),
    },
    target: {
      [DANCE_SHOES.drums]: values(0.78, 0.02),
      [DANCE_SHOES.bass]: values(0.7, -0.05),
      [DANCE_SHOES.synths]: values(0.63, -0.33),
      [DANCE_SHOES.vox]: values(0.74, 0.23),
    },
  },
  {
    id: 'spectra-03-space',
    level: 3,
    label: 'Tone + space',
    sessionId: 'dance-shoes',
    parameters: ['level', 'pan', 'low', 'high', 'fx'],
    tolerances: { level: 0.065, pan: 0.11, low: 0.14, high: 0.14, fx: 0.1 },
    start: {
      [DANCE_SHOES.drums]: values(0.72, -0.16, -0.24, 0.24, 0.35),
      [DANCE_SHOES.bass]: values(0.62, 0.25, -0.18, 0.22, 0.3),
      [DANCE_SHOES.synths]: values(0.77, 0.2, 0.2, -0.22, 0.05),
      [DANCE_SHOES.vox]: values(0.58, -0.3, 0.18, -0.2, 0.04),
    },
    target: {
      [DANCE_SHOES.drums]: values(0.79, 0.01, 0.1, 0.08, 0.08),
      [DANCE_SHOES.bass]: values(0.68, -0.04, 0.2, -0.1, 0.03),
      [DANCE_SHOES.synths]: values(0.6, -0.3, -0.1, 0.16, 0.25),
      [DANCE_SHOES.vox]: values(0.75, 0.2, -0.14, 0.2, 0.18),
    },
  },
];

export const MIXING_CHALLENGE_IDS = MIXING_CHALLENGES.map((challenge) => challenge.id);

const PARAMETER_RANGE = { level: 1, pan: 2, low: 2, high: 2, fx: 1 };
const PARAMETER_LABEL = {
  level: 'fader',
  pan: 'pan',
  low: 'low shelf',
  high: 'high shelf',
  fx: 'FX send',
};

export const mixingChallengeById = (id) =>
  MIXING_CHALLENGES.find((challenge) => challenge.id === id) ?? null;

export function applyMixProfile(session, profile = {}) {
  if (!session?.stems) return false;
  for (const stem of session.stems) {
    const target = profile[stem.id];
    if (!target) continue;
    if (Number.isFinite(target.level)) session.setLevel(stem.id, target.level);
    if (Number.isFinite(target.pan)) session.setPan(stem.id, target.pan);
    if (Number.isFinite(target.low)) session.setEq(stem.id, 'low', target.low);
    if (Number.isFinite(target.high)) session.setEq(stem.id, 'high', target.high);
    if (Number.isFinite(target.fx)) session.setFx(stem.id, target.fx);
    stem.mute = false;
    stem.solo = false;
  }
  return true;
}

export function startMixingChallenge(session, id) {
  const challenge = mixingChallengeById(id);
  if (!challenge || !session?.loadTemplate?.(challenge.sessionId)) return null;
  applyMixProfile(session, challenge.start);
  return challenge;
}

export function createReferenceMix(id) {
  const challenge = mixingChallengeById(id);
  if (!challenge) return null;
  const session = new StudioSession();
  session.loadTemplate(challenge.sessionId);
  applyMixProfile(session, challenge.target);
  return session;
}

export function scoreMix(session, id) {
  const challenge = mixingChallengeById(id);
  if (!challenge || !session?.stems) {
    return { pass: false, score: 0, misses: [], challenge: null };
  }

  const stems = new Map(session.stems.map((stem) => [stem.id, stem]));
  const misses = [];
  let normalizedError = 0;
  let measurements = 0;
  let pass = true;

  for (const [stemId, target] of Object.entries(challenge.target)) {
    const stem = stems.get(stemId);
    if (!stem) {
      pass = false;
      continue;
    }
    for (const parameter of challenge.parameters) {
      const actual = Number(stem[parameter]) || 0;
      const expected = Number(target[parameter]) || 0;
      const difference = actual - expected;
      const absolute = Math.abs(difference);
      const tolerance = challenge.tolerances[parameter] ?? 0.1;
      const range = PARAMETER_RANGE[parameter] ?? 1;
      normalizedError += Math.min(1, absolute / range);
      measurements += 1;
      if (absolute > tolerance) pass = false;
      misses.push({
        stemId,
        stemLabel: stem.label,
        parameter,
        label: PARAMETER_LABEL[parameter] ?? parameter,
        actual,
        expected,
        difference,
        absolute,
        tolerance,
        severity: tolerance > 0 ? absolute / tolerance : absolute,
      });
    }
  }

  misses.sort((a, b) => b.severity - a.severity);
  const score = Math.max(
    0,
    Math.min(100, Math.round((1 - normalizedError / Math.max(1, measurements)) * 100)),
  );
  return { pass, score, misses: misses.filter((miss) => miss.absolute > miss.tolerance), challenge };
}

function directionFor(miss) {
  const low = miss.difference < 0;
  switch (miss.parameter) {
    case 'level':
      return low ? 'raise it' : 'lower it';
    case 'pan':
      return low ? 'move it right' : 'move it left';
    case 'low':
      return low ? 'add low shelf' : 'reduce low shelf';
    case 'high':
      return low ? 'add high shelf' : 'reduce high shelf';
    case 'fx':
      return low ? 'add more FX' : 'use less FX';
    default:
      return 'adjust it';
  }
}

export function feedbackForMix(result, difficulty = 'medium') {
  if (!result || result.pass) return [];
  if (difficulty === 'hard') return [`Overall match: ${result.score}%.`];
  const limit = difficulty === 'easy' ? 4 : 3;
  return result.misses.slice(0, limit).map((miss) => {
    const direction = directionFor(miss);
    return difficulty === 'easy'
      ? `${miss.stemLabel} · ${miss.label}: ${direction} (${miss.severity > 2 ? 'far off' : 'getting close'}).`
      : `${miss.stemLabel} · ${miss.label}: ${direction}.`;
  });
}

export function mixingGameComplete(completed = []) {
  const done = new Set(completed);
  return MIXING_CHALLENGE_IDS.every((id) => done.has(id));
}

export function nextMixingChallenge(completed = []) {
  const done = new Set(completed);
  return MIXING_CHALLENGES.find((challenge) => !done.has(challenge.id)) ?? null;
}
