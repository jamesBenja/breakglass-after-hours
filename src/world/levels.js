import { createUpstairsDefinition } from './upstairs/definition.js';
import { alleyLevel } from './alley.js';

// Y up. Upstairs is assembled from A-103 tracing; Below retains V2.1 authoring units.
// Neither coordinate system is surveyed metres. Reconcile meshes and navigation together.
const surface = (id, name, x1, x2, z1, z2) => ({ id, name, x1, x2, z1, z2, y: 0 });
const rampSurface = (id, name, x1, x2, z1, z2, from, to) => ({
  id,
  name,
  x1,
  x2,
  z1,
  z2,
  priority: 20,
  ramp: { axis: 'z', from, to },
});
const anchor = (name, position, radius, action) => ({ name, position, radius, action });

export const levels = {
  upstairs: createUpstairsDefinition(),
  alley: alleyLevel,
  downstairs: {
    id: 'downstairs',
    title: 'DOWNSTAIRS — BELOW BREAKGLASS',
    model: 'below-building',
    provenance: {
      status: 'A-102-informed playable blockout',
      reference: 'Breakglass Studios - FULL FLOOR PLANS PACKAGE.pdf / A-102',
      note: 'Plan-informed room relationships; detailed wall/collision reconciliation is still ongoing.',
    },
    background: 0x060408,
    fog: [18, 58],
    cameraOffset: [4.2, 3.0, 4.6],
    camera: {
      mode: 'close',
      fov: 67,
      distance: 3.7,
      minDistance: 2.1,
      maxDistance: 6.2,
      pitch: 0.34,
      targetHeight: 1.34,
    },
    lights: [
      { color: 0x8749d6, intensity: 3.2, distance: 8, position: [-6.6, 2.2, -2.5] },
      { color: 0xffb06b, intensity: 2.8, distance: 7, position: [-8.1, 2.35, 1.65] },
      { color: 0xff7f50, intensity: 2.2, distance: 6, position: [7.45, 2.2, 4.7] },
    ],
    lightingRig: {
      preset: 'warmup',
      haze: 0.42,
      hazeFar: 10.5,
      hazeVolume: {
        x1: -5.55,
        x2: 5.55,
        y1: 0.35,
        y2: 2.6,
        z1: -3.0,
        z2: 3.0,
        count: 22,
      },
      fixtures: [
        { name: 'club-west-red', color: 0xff253f, intensity: 5.6, distance: 15, position: [-4.9, 2.7, -2.55], phase: 0 },
        { name: 'club-east-magenta', color: 0xff3bc8, intensity: 4.8, distance: 15, position: [4.8, 2.8, -2.4], phase: 1.7 },
        { name: 'club-west-violet', color: 0x6f4cff, intensity: 5.2, distance: 15, position: [-4.7, 2.5, 2.45], phase: 3.2 },
        { name: 'club-east-blue', color: 0x2c74ff, intensity: 4.6, distance: 15, position: [4.7, 2.45, 2.5], phase: 4.9 },
        { name: 'booth-wash', color: 0xff2a55, intensity: 3.8, distance: 10, position: [1.5, 2.7, -2.45], phase: 2.4 },
      ],
      strobe: { color: 0xffffff, intensity: 11, distance: 13, position: [0, 3.0, 0] },
      laser: { color: 0x55ffd8, position: [1.5, 2.55, -2.45], count: 6, length: 10, tilt: 0.72, sweepSpeed: 0.62 },
    },
    crowd: {
      start: 72,
      min: 18,
      idle: 28,
      max: 110,
      zones: [
        { x1: -4.7, x2: 4.7, z1: -2.15, z2: 2.75, weight: 8, kind: 'dance' },
        { x1: -5.45, x2: -4.65, z1: -2.25, z2: 2.65, weight: 1.25, kind: 'social' },
        { x1: 4.65, x2: 5.45, z1: -1.8, z2: 2.7, weight: 1.1, kind: 'social' },
        { x1: -9.35, x2: -6.55, z1: 0.0, z2: 3.35, weight: 2.1, kind: 'social' },
        { x1: 6.35, x2: 8.55, z1: 3.35, z2: 4.05, weight: 1.7, kind: 'social' },
      ],
      avoid: [
        { x1: 0.0, x2: 3.15, z1: -3.15, z2: -1.55 },
        { x1: -6.2, x2: -5.35, z1: -3.2, z2: -1.0 },
      ],
    },
    spawns: {
      start: [-5.9, 0, -2.25],
      stairs: [-5.9, 0, -2.25],
      alley: [4.6, 0.64, -5.0],
    },
    intro: [
      'BELOW BREAKGLASS',
      'The club is alive now. Push toward the booth, slip into Take A Break, find the kitchen bar and coffee machine, find Nora for a photo, or take the marked stairs beside coat check up to the alley.',
    ],
    navigation: {
      surfaces: [
        surface('club', 'Below Breakglass', -5.85, 5.85, -3.25, 3.25),
        surface('lounge', 'Take A Break', -9.75, -6.25, -0.25, 3.6),
        surface('lounge-door', 'Take A Break Doorway', -6.5, -5.65, 0.05, 1.45),
        surface('storage', 'Storage', -5, 1.8, 3.35, 6.2),
        surface('service', 'Service / Bar', 6.2, 8.8, -2.7, 6.15),
        surface('bar-door', 'Bar Doorway', 5.65, 6.5, -2.05, -0.55),
        surface('coat-check', 'Coat Check / Alley Entry', 3.55, 5.65, -5.35, -3.2),
        rampSurface('alley-stairs', 'Stairs to alley', 3.82, 5.38, -5.2, -3.4, 0.72, 0),
        surface('stair-landing', 'Clark Stair Landing', -6.8, -5.5, -3.1, -1.1),
      ],
      obstacles: [],
    },
    anchors: {
      dj: anchor('DJ booth', [1.5, 0, -2.15], 1.7, 'dj'),
      stairs: {
        ...anchor('Stairs upstairs', [-6.35, 0, -2.2], 1.45, 'travel'),
        target: 'upstairs',
      },
      alleyExit: {
        ...anchor('Stairs to alley / club entrance', [4.6, 0.64, -5.0], 1.3, 'travel'),
        target: 'alley@clubDoor',
      },
      nora: anchor('Nora', [-2.5, 0, 1.3], 1.2, 'dialogue'),
      jashim: anchor('Jashim', [-0.7, 0, 0.6], 1.2, 'dialogue'),
      courtney: anchor('Courtney', [7.05, 0, 5.15], 1.2, 'dialogue'),
      simla: anchor('Simla', [8.05, 0, 5.15], 1.2, 'dialogue'),
      coffeeMachine: anchor('Kitchen coffee machine', [6.72, 0, 5.4], 1.35, 'coffee'),
      devin: anchor('Devin', [-4.95, 0, 2.7], 1.2, 'dialogue'),
      installation: anchor('Take A Break installation', [-8.75, 0, 1.85], 1.5, 'installation'),
      photoWall: anchor('Nora photo wall', [-8.15, 0, 3.0], 1.6, 'photoWall'),
    },
    npcs: [
      {
        id: 'nora',
        name: 'Nora',
        anchor: 'nora',
        role: 'photographer',
        route: [
          [-2.5, 0, 1.3],
          [0.2, 0, 2.0],
          [3.5, 0, -0.7],
          [-6.8, 0, 1.0],
          [-8.2, 0, 2.3],
          [-2.5, 0, 1.3],
        ],
        speed: 0.56,
      },
      {
        id: 'james',
        name: 'James',
        position: [-4.6, 0, -1.3],
        role: 'host',
        route: [
          [-4.6, 0, -1.3],
          [-1.2, 0, -0.5],
          [4.4, 0, 1.6],
          [6.5, 0, -0.4],
          [-7.0, 0, 1.9],
        ],
        speed: 0.46,
      },
      { id: 'jashim', name: 'Jashim', anchor: 'jashim', role: 'artist', color: 0x60728f },
      {
        id: 'courtney',
        name: 'Courtney',
        anchor: 'courtney',
        role: 'bartender',
        color: 0x8b5e83,
        rotationY: Math.PI,
      },
      {
        id: 'simla',
        name: 'Simla',
        anchor: 'simla',
        role: 'bartender',
        color: 0x5a806a,
        rotationY: Math.PI,
      },
      {
        id: 'devin',
        name: 'Devin',
        anchor: 'devin',
        role: 'tech',
        route: [
          [-4.95, 0, 2.7],
          [-3.9, 0, -1.5],
          [3.8, 0, 2.2],
          [-4.95, 0, 2.7],
        ],
        speed: 0.38,
        color: 0x4b6e7d,
      },
      { id: 'friend', position: [2.8, 0, 0.7], color: 0x7e5b78, interactive: false },
    ],
  },
};

export const LEVEL_IDS = Object.keys(levels);
