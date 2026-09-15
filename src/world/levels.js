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
    lights: [
      { color: 0x8749d6, intensity: 4.5, distance: 8, position: [-6.6, 2.2, -2.5] },
      { color: 0xff2436, intensity: 7, distance: 17, position: [2.5, 2.8, 1] },
      { color: 0x7a43ff, intensity: 6, distance: 16, position: [-3.5, 2.5, -1.7] },
    ],
    spawns: { start: [-5.9, 0, -2.25], stairs: [-5.9, 0, -2.25] },
    intro: [
      'BELOW BREAKGLASS',
      'Find the DJ booth or talk to people. The stairs lead back up to the studio.',
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
