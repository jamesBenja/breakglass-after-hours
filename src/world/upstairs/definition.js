import {
  rooms,
  footprint,
  centralSuite,
  closedSuites,
  wallRuns,
  at,
  PLAN_SOURCE,
  waypoints,
} from './plan.js';
import { compileWalls } from './compile.js';
import { createGameSpace } from './gameSpace.js';

export function createUpstairsDefinition(pass = 'B') {
  const { solids: walls, doors } = compileWalls(wallRuns);
  pass = pass === 'A' ? 'A' : 'B';
  const gameSpace = pass === 'B' ? createGameSpace() : null;
  const platforms = gameSpace?.platforms ?? [];
  const floorRooms = gameSpace?.rooms ?? rooms;
  const fixtures = gameSpace?.fixtures ?? [];
  const stairFloors = gameSpace?.stairFloors ?? [];
  if (gameSpace) for (const wall of walls) if (wall.id.startsWith('outside-')) wall.y1 = -1.5;
  const solids = [...walls, ...closedSuites, ...platforms, ...fixtures, ...stairFloors];
  const surfaces = [
    ...floorRooms.map((r, i) => ({ ...r, y: 0, priority: i })),
    ...[...platforms, ...fixtures].map((p) => ({ ...p, y: p.y2, priority: 20 })),
    ...stairFloors.map((p) => ({ ...p, y: p.y2, priority: 30 })),
    ...(gameSpace
      ? [
          {
            ...centralSuite,
            id: 'polygon-perch',
            name: 'Historic Neve Suite · GAME roof perch',
            y: centralSuite.y2,
            priority: 40,
          },
        ]
      : []),
  ];
  return {
    id: 'upstairs',
    layoutRevision: 'a103-spatial-4-neve',
    pass,
    title: 'UPSTAIRS — BREAKGLASS STUDIOS',
    model: 'upstairs-building',
    provenance: {
      status: 'A-103 topology / historical Neve Suite / GAME circulation',
      reference: PLAN_SOURCE,
      note: 'Traced room relationships; widened polygon gallery and Clark landing for traversal. Central suite historical use comes from Breakglass; Neve equipment placement is photo-informed gameplay dressing.',
    },
    background: 0x171d24,
    fog: [45, 100],
    cameraOffset: [8, 10, 11],
    lights: [
      { color: 0xffd9ad, intensity: 8, distance: 30, position: at(575, 650, 7) },
      { color: 0xa2c8d6, intensity: 5, distance: 20, position: at(240, 770, 5) },
      { color: 0xffc98a, intensity: 3.8, distance: 11, position: at(427, 850, 3.2) },
    ],
    spawns: gameSpace?.spawns ?? { start: waypoints.entry, stairs: at(227, 958) },
    intro: [
      'THIRD FLOOR',
      'Build a session, explore the tape archive, mix on the Spectra console, or enter the historic Neve Suite.',
    ],
    rooms: floorRooms,
    solids,
    doors,
    platforms,
    fixtures,
    stairFloors,
    centralSuite,
    closedSuites,
    navigation: { allowAirborne: true, boundary: footprint, surfaces, obstacles: solids },
    anchors: {
      drums: { name: 'Drum station', position: at(583, 632), radius: 1.7, action: 'drums' },
      piano: { name: 'Piano', position: at(647, 750), radius: 1.6, action: 'piano' },
      synth: { name: 'Synth + organ station', position: at(590, 824), radius: 1.6, action: 'synth' },
      instruments: {
        name: 'Guitar + bass rack',
        position: at(305, 625),
        radius: 1.7,
        action: 'instruments',
      },
      amps: {
        name: 'Dead Room amps',
        position: at(365, 605),
        radius: 1.8,
        action: 'amps',
      },
      micLocker: {
        name: 'Microphone locker',
        position: at(305, 665),
        radius: 1.55,
        action: 'mics',
      },
      console: {
        name: 'Spectra console',
        position: at(254, 809, pass === 'B' ? 0.28 : 0),
        radius: 1.8,
        action: 'console',
      },
      tapeArchive: {
        name: 'Breakglass tape archive',
        position: at(438, 1028),
        radius: 1.55,
        action: 'tapeArchive',
      },
      neveConsole: {
        name: 'Historic Neve console',
        position: at(426, 813),
        radius: 1.6,
        action: 'neveConsole',
      },
      tapeMachine: {
        name: 'Neve Suite tape machine',
        position: at(408, 880),
        radius: 1.4,
        action: 'tapeMachine',
      },
      liveArchive: {
        name: 'Live From Breakglass archive',
        position: at(448, 905),
        radius: 1.45,
        action: 'liveArchive',
      },
      stairs: {
        name: 'Clark stair → Below',
        position: gameSpace?.stairAnchor ?? waypoints.clark,
        radius: 1.4,
        action: 'travel',
        target: 'downstairs',
      },
    },
    npcs: [],
  };
}
