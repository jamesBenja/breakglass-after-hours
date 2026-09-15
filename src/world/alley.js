const surface = (id, name, x1, x2, z1, z2) => ({ id, name, x1, x2, z1, z2, y: 0 });
const anchor = (name, position, radius, action) => ({ name, position, radius, action });

// A-101 gives the alley/garden as approximately 15 ft wide x 196 ft long, entered from
// De Castelnau, with the Breakglass stair door near the middle of the north side. The game
// compresses the long axis slightly while keeping those relationships legible.
export const alleyLevel = {
  id: 'alley',
  title: 'ALLEYWAY — BREAKGLASS',
  model: 'alley-building',
  provenance: {
    status: 'A-101 plan-informed exterior blockout',
    reference: 'Breakglass Studios - FULL FLOOR PLANS PACKAGE.pdf / A-101',
    note: 'Approximate 15 x 196 ft garden/alley compressed for play; surrounding facades are stylized.',
  },
  background: 0x111722,
  fog: [38, 105],
  cameraOffset: [5.2, 5.0, 7.4],
  camera: {
    mode: 'follow',
    fov: 60,
    distance: 7.6,
    minDistance: 4.8,
    maxDistance: 10.5,
    pitch: 0.54,
    targetHeight: 1.22,
  },
  lights: [
    { color: 0xffc98f, intensity: 4.6, distance: 16, position: [-4, 3.4, -1.6] },
    { color: 0xa7c6ff, intensity: 3.0, distance: 18, position: [-20, 4.2, 0.5] },
    { color: 0xff9c72, intensity: 2.8, distance: 17, position: [18, 3.6, -0.5] },
  ],
  alleySystem: {
    startOccupancy: 7,
    conversationLevel: 0.26,
    disturbance: 0.14,
    neighborTolerance: 0.55,
  },
  spawns: {
    start: [-27.5, 0, 0],
    stairs: [-3.7, 0, -1.0],
    clubDoor: [-3.7, 0, -1.0],
  },
  intro: [
    'BREAKGLASS ALLEY',
    'The line is outside. People step out for air and conversation, but this is not a second dance floor. Keep it quiet for the neighbours.',
  ],
  navigation: {
    surfaces: [surface('alley', 'Breakglass alley / garden', -29.5, 29.5, -2.3, 2.3)],
    obstacles: [
      { id: 'north-wall-west', x1: -29.5, x2: -4.7, z1: -2.5, z2: -2.25, y1: 0, y2: 3.2 },
      { id: 'north-wall-east', x1: -2.7, x2: 29.5, z1: -2.5, z2: -2.25, y1: 0, y2: 3.2 },
      { id: 'south-wall', x1: -29.5, x2: 29.5, z1: 2.25, z2: 2.5, y1: 0, y2: 3.0 },
      { id: 'picnic-a', x1: 4.6, x2: 6.4, z1: 0.7, z2: 1.45, y1: 0, y2: 0.75 },
      { id: 'picnic-b', x1: 10.4, x2: 12.2, z1: -0.25, z2: 0.5, y1: 0, y2: 0.75 },
    ],
  },
  anchors: {
    clubDoor: {
      ...anchor('Stairwell ↑ Breakglass', [-3.7, 0, -1.72], 1.7, 'travel'),
      target: 'downstairs@alley',
    },
    bouncer: anchor('Bouncer', [-4.9, 0, -1.2], 1.2, 'dialogue'),
    social: anchor('Alley conversation', [7.7, 0, 0.7], 1.9, 'alleySocial'),
  },
  npcs: [
    { id: 'bouncer', name: 'Door', anchor: 'bouncer', role: 'staff', color: 0x394653 },
    {
      id: 'james',
      name: 'James',
      position: [1.0, 0, 0.45],
      role: 'host',
      route: [
        [1.0, 0, 0.45],
        [-3.2, 0, 0.4],
        [4.0, 0, 0.55],
      ],
      speed: 0.42,
    },
    { id: 'line-1', position: [-7.2, 0, -0.45], color: 0x66506e, interactive: false },
    { id: 'line-2', position: [-8.1, 0, -0.2], color: 0x49636b, interactive: false },
    { id: 'line-3', position: [-9.0, 0, -0.55], color: 0x7c5b4b, interactive: false },
    { id: 'smoker-1', position: [6.2, 0, -0.6], color: 0x596b4f, interactive: false },
    { id: 'smoker-2', position: [7.0, 0, 0.15], color: 0x6d5571, interactive: false },
  ],
};
