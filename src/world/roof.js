const surface = (id, name, x1, x2, z1, z2, y = 0) => ({ id, name, x1, x2, z1, z2, y });
const obstacle = (id, x1, x2, z1, z2, y1 = 0, y2 = 1.2) => ({ id, x1, x2, z1, z2, y1, y2 });
const anchor = (name, position, radius, action, extra = {}) => ({
  name,
  position,
  radius,
  action,
  ...extra,
});

// The hatch/bulkhead is deliberately solid. Spawn just east of it on the deck rather than
// inside the collision volume, so arrival from the secret studio passage is always valid.
const HATCH_APPROACH = [-3.85, 0, -2.72];

export const roofLevel = {
  id: 'roof',
  title: 'ROOF — BREAKGLASS FOUNDERS HANGOUT',
  model: 'roof-building',
  provenance: {
    status: 'GAME memory-space inspired by the studio founders era',
    reference: 'Breakglass building roof / founding-days stories',
    note: 'Atmospheric throwback scene. Specific stories are intentionally kept broad until verified anecdotes are attached.',
  },
  background: 0x10161c,
  fog: [28, 84],
  cameraOffset: [6.5, 5.2, 7.2],
  camera: {
    mode: 'close',
    fov: 62,
    distance: 5.6,
    minDistance: 3.2,
    maxDistance: 8.5,
    pitch: 0.38,
    targetHeight: 1.28,
  },
  lights: [
    { color: 0xaec6da, intensity: 2.2, distance: 28, position: [-2, 7, -2] },
    { color: 0xffbf78, intensity: 3.4, distance: 8, position: [0, 2.1, 0.35] },
    { color: 0x768ca6, intensity: 1.8, distance: 12, position: [4, 2.6, 3.8] },
  ],
  spawns: {
    start: HATCH_APPROACH,
    hatch: HATCH_APPROACH,
    stairs: HATCH_APPROACH,
  },
  intro: [
    'THE ROOF',
    'You found the old roof route. Maddox comes up with you while James, Jace and Dave hang out the way the founders did in the early days: beers, cigarettes, half-finished stories and occasional attempts to land junk in the alley dumpster.',
  ],
  navigation: {
    surfaces: [surface('roof-deck', 'Breakglass roof', -7.78, 7.78, -4.78, 4.78)],
    obstacles: [
      obstacle('roof-south-parapet', -8.2, 8.2, -5.25, -4.88),
      obstacle('roof-north-parapet', -8.2, 8.2, 4.88, 5.25),
      obstacle('roof-west-parapet', -8.25, -7.88, -5.2, 5.2),
      obstacle('roof-east-parapet', 7.88, 8.25, -5.2, 5.2),
      obstacle('roof-bulkhead', -7.1, -4.3, -4.68, -2.22, 0, 2.5),
      obstacle('roof-table', -1.1, 1.1, -0.13, 0.83, 0, 0.9),
    ],
  },
  anchors: {
    hatch: anchor('Hidden hatch back to the studio', HATCH_APPROACH, 1.55, 'travel', {
      target: 'upstairs@roofReturn',
    }),
  },
  maddox: {
    name: 'Maddox',
    companionOnly: true,
    start: [-3.05, 0, -1.95],
    radius: 1.4,
    speed: 0.84,
    roamPoints: [
      [-3.05, 0, -1.95],
      [-1.9, 0, 1.8],
      [2.2, 0, 1.9],
      [4.9, 0, -0.8],
      [2.8, 0, -2.7],
    ],
    napPoints: [
      [-2.0, 0, 2.3],
      [2.55, 0, 2.15],
    ],
  },
  npcs: [
    {
      id: 'james',
      name: 'James',
      role: 'founder',
      position: [-1.55, 0, 1.0],
      rotationY: 2.55,
      appearance: { prop: 'founder' },
    },
    {
      id: 'jace',
      name: 'Jace',
      role: 'founder',
      position: [0, 0, -1.45],
      rotationY: 0.05,
      appearance: { prop: 'founder' },
    },
    {
      id: 'dave',
      name: 'Dave',
      role: 'founder',
      position: [1.55, 0, 1.0],
      rotationY: -2.55,
      appearance: { prop: 'founder' },
    },
  ],
  roofSystem: {
    smokers: [
      [-1.55, 1.62, 1.0],
      [0, 1.62, -1.45],
      [1.55, 1.62, 1.0],
    ],
    throwSources: [
      [-1.55, 1.05, 2.0],
      [0, 1.05, 2.55],
      [1.55, 1.05, 2.0],
    ],
    dumpster: [1.4, -1.9, 6.85],
  },
};
