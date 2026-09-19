// House DJ gameplay feeder.
//
// This is the single tunable document for NPC DJ behaviour. It does not claim to be a critical
// assessment of any real person's ability; the values are game-direction defaults that can be
// edited as playtesting reveals how each booth personality should feel.
//
// transitionSeconds controls overlap between tracks. vibe and mixQuality feed crowd response.
// animationEnergy changes physical booth performance. risk changes how often a transition feels
// assertive rather than conservative and phraseBars describes the intended musical phrasing.

export const HOUSE_DJ_FEEDER = Object.freeze({
  lunice: {
    style: 'athletic club set · sharp rhythmic pivots',
    transitionSeconds: [5.5, 8.5],
    phraseBars: 8,
    vibe: 0.88,
    mixQuality: 0.94,
    risk: 0.82,
    animationEnergy: 0.98,
  },
  kaytranada: {
    style: 'deep groove · patient blends · swing-forward pacing',
    transitionSeconds: [9, 14],
    phraseBars: 16,
    vibe: 0.93,
    mixQuality: 0.97,
    risk: 0.48,
    animationEnergy: 0.7,
  },
  'james-benjamin': {
    style: 'genre-fluid club set · quick pivots · rhythmic edits',
    transitionSeconds: [6, 10],
    phraseBars: 8,
    vibe: 0.9,
    mixQuality: 0.95,
    risk: 0.78,
    animationEnergy: 0.86,
  },
  malaika: {
    style: 'party-forward selections · confident crowd-reading blends',
    transitionSeconds: [7, 11],
    phraseBars: 8,
    vibe: 0.9,
    mixQuality: 0.92,
    risk: 0.68,
    animationEnergy: 0.9,
  },
  'siren-mars': {
    style: 'dark pressure · long tension builds · dramatic releases',
    transitionSeconds: [10, 15],
    phraseBars: 16,
    vibe: 0.86,
    mixQuality: 0.93,
    risk: 0.6,
    animationEnergy: 0.76,
  },
  monib: {
    style: 'left-field club selections · measured genre changes',
    transitionSeconds: [8, 12],
    phraseBars: 16,
    vibe: 0.87,
    mixQuality: 0.93,
    risk: 0.7,
    animationEnergy: 0.78,
  },
  hydra: {
    style: 'fluid momentum · layered blends · gradual pressure changes',
    transitionSeconds: [10, 14],
    phraseBars: 16,
    vibe: 0.88,
    mixQuality: 0.94,
    risk: 0.58,
    animationEnergy: 0.8,
  },
  bootyspoon: {
    style: 'high-impact club tools · fast swaps · playful risk',
    transitionSeconds: [4.5, 7.5],
    phraseBars: 8,
    vibe: 0.92,
    mixQuality: 0.9,
    risk: 0.9,
    animationEnergy: 1,
  },
  'marie-davidson': {
    style: 'driving narrative arc · controlled tension · decisive transitions',
    transitionSeconds: [8, 12],
    phraseBars: 16,
    vibe: 0.9,
    mixQuality: 0.95,
    risk: 0.66,
    animationEnergy: 0.88,
  },
  'frankie-teardrop': {
    style: 'eclectic party set · quick reactions · energetic cuts and blends',
    transitionSeconds: [5, 9],
    phraseBars: 8,
    vibe: 0.89,
    mixQuality: 0.91,
    risk: 0.84,
    animationEnergy: 0.94,
  },
});

export const DEFAULT_HOUSE_DJ_PROFILE = Object.freeze({
  style: 'Breakglass house set',
  transitionSeconds: [7, 11],
  phraseBars: 8,
  vibe: 0.86,
  mixQuality: 0.92,
  risk: 0.65,
  animationEnergy: 0.82,
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

export function houseDjProfile(id) {
  const source = HOUSE_DJ_FEEDER[id] ?? DEFAULT_HOUSE_DJ_PROFILE;
  const range = Array.isArray(source.transitionSeconds) ? source.transitionSeconds : [7, 11];
  const low = Math.max(2.5, Number(range[0]) || 7);
  const high = Math.max(low, Number(range[1]) || low);
  return {
    ...DEFAULT_HOUSE_DJ_PROFILE,
    ...source,
    transitionSeconds: [low, high],
    vibe: clamp(source.vibe ?? DEFAULT_HOUSE_DJ_PROFILE.vibe),
    mixQuality: clamp(source.mixQuality ?? DEFAULT_HOUSE_DJ_PROFILE.mixQuality),
    risk: clamp(source.risk ?? DEFAULT_HOUSE_DJ_PROFILE.risk),
    animationEnergy: clamp(source.animationEnergy ?? DEFAULT_HOUSE_DJ_PROFILE.animationEnergy),
  };
}

export function transitionSecondsForHouseDj(id, random = Math.random) {
  const [low, high] = houseDjProfile(id).transitionSeconds;
  const amount = clamp(typeof random === 'function' ? random() : random);
  return low + (high - low) * amount;
}
