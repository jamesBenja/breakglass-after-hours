import { createUpstairsDefinition } from './upstairs/definition.js';
// Y up. Upstairs is assembled from A-103 tracing; Below retains V2.1 authoring units.
// Neither coordinate system is surveyed metres. Reconcile meshes and navigation together.
const surface = (id, name, x1, x2, z1, z2) => ({ id, name, x1, x2, z1, z2, y: 0 });
const anchor = (name, position, radius, action) => ({ name, position, radius, action });

export const levels = {
  upstairs: createUpstairsDefinition(),
  downstairs: {
    id: 'downstairs',
    title: 'DOWNSTAIRS — BELOW BREAKGLASS',
    model: 'below-building',
    provenance: {
      status: 'simplified-plan-blockout',
      reference: 'Below Breakglass technical diagram.png',
      note: 'V2.1 plan-informed proportions; mesh/collision reconciliation is still pending.',
    },
    background: 0x060408,
    fog: [18, 58],
    cameraOffset: [12, 15, 14],
    // Architectural/stair accents remain static. Party fixtures live in lightingRig below.
    lights: [{ color: 0x8749d6, intensity: 3.2, distance: 8, position: [-6.6, 2.2, -2.5] }],
    lightingRig: {
      preset: 'warmup',
      haze: 0.26,
      hazeFar: 29,
      fixtures: [
        { name: 'club-west-red', color: 0xff253f, intensity: 5.6, distance: 15, position: [-4.9, 2.7, -2.55], phase: 0 },
        { name: 'club-east-magenta', color: 0xff3bc8, intensity: 4.8, distance: 15, position: [4.8, 2.8, -2.4], phase: 1.7 },
        { name: 'club-west-violet', color: 0x6f4cff, intensity: 5.2, distance: 15, position: [-4.7, 2.5, 2.45], phase: 3.2 },
        { name: 'club-east-blue', color: 0x2c74ff, intensity: 4.6, distance: 15, position: [4.7, 2.45, 2.5], phase: 4.9 },
        { name: 'booth-wash', color: 0xff2a55, intensity: 3.8, distance: 10, position: [1.5, 2.7, -2.45], phase: 2.4 },
      ],
      strobe: { color: 0xffffff, intensity: 11, distance: 13, position: [0, 3.0, 0] },
      laser: {
        color: 0x55ffd8,
        position: [1.5, 2.55, -2.45],
        count: 5,
        length: 10,
        tilt: 0.72,
        sweepSpeed: 0.62,
      },
    },
    spawns: { start: [-5.9, 0, -2.25], stairs: [-5.9, 0, -2.25] },
    intro: [
      'BELOW BREAKGLASS',
      'Find the DJ booth or talk to people. The Clark-side stairs lead back to the studio.',
    ],
    navigation: {
      surfaces: [
        surface('club', 'Below Breakglass', -5.85, 5.85, -3.25, 3.25),
        surface('lounge', 'Take A Break', -9.75, -6.25, -0.25, 3.6),
        surface('storage', 'Storage', -5, 1.8, 3.35, 6.2),
        surface('service', 'Service / Bar', 6.2, 8.8, -2.7, 6.15),
        surface('coat-check', 'Coat Check', 3.55, 5.65, -5.35, -3.2),
        surface('stair-landing', 'Stair Landing', -6.8, -5.5, -3.1, -1.1),
      ],
      obstacles: [],
    },
    anchors: {
      dj: anchor('DJ booth', [1.5, 0, -2.15], 1.7, 'dj'),
      stairs: {
        ...anchor('Stairs upstairs', [-6.35, 0, -2.2], 1.45, 'travel'),
        target: 'upstairs',
      },
      nora: anchor('Nora', [-2.5, 0, 1.3], 1.2, 'dialogue'),
      jashim: anchor('Jashim', [-0.7, 0, 0.6], 1.2, 'dialogue'),
    },
    npcs: [
      { id: 'nora', anchor: 'nora', color: 0xb68e6a },
      { id: 'jashim', anchor: 'jashim', color: 0x60728f },
      { id: 'friend', position: [2.8, 0, 0.7], color: 0x7e5b78 },
    ],
  },
};

export const LEVEL_IDS = Object.keys(levels);
