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
  const solids = [
    ...walls,
    centralSuite,
    ...closedSuites,
    ...platforms,
    ...fixtures,
    ...stairFloors,
  ];
  const surfaces = [
    ...floorRooms.map((r, i) => ({ ...r, y: 0, priority: i })),
    ...[...platforms, ...fixtures].map((p) => ({ ...p, y: p.y2, priority: 20 })),
    ...stairFloors.map((p) => ({ ...p, y: p.y2, priority: 30 })),
    ...(gameSpace
      ? [
          {
            ...centralSuite,
            id: 'polygon-perch',
            name: 'Polygon perch · above Closed Suite',
            y: centralSuite.y2,
            priority: 40,
          },
        ]
      : []),
  ];
  return {
    id: 'upstairs',
    layoutRevision: 'a103-spatial-4',
    pass,
    title: 'UPSTAIRS — BREAKGLASS STUDIOS',
    model: 'upstairs-building',
    provenance: {
      status: 'A-103 topology / GAME circulation',
      reference: PLAN_SOURCE,
      note: 'Canonical entry, Clark exit and Below stair locations now compile directly into the wall plan.',
    },
    background: 0x171d24,
    fog: [45, 100],
    cameraOffset: [8, 10, 11],
    lights: [
      { color: 0xffd9ad, intensity: 8, distance: 30, position: at(575, 650, 7) },
      { color: 0xa2c8d6, intensity: 5, distance: 20, position: at(240, 770, 5) },
    ],
    spawns: gameSpace?.spawns ?? {
      start: waypoints.entry,
      stairs: waypoints.belowStairsTop,
    },
    intro: [
      'THIRD FLOOR',
      'Main entry is beside Storage. The southeast stair descends to Below; the west landing exits to Clark.',
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
      drums: { name: 'Drum kit', position: at(583, 632), radius: 1.7, action: 'drums' },
      piano: { name: 'Piano', position: at(647, 750), radius: 1.6, action: 'piano' },
      synth: { name: 'Synth', position: at(590, 824), radius: 1.6, action: 'synth' },
      console: {
        name: 'Spectra console',
        position: at(254, 809, pass === 'B' ? 0.28 : 0),
        radius: 1.8,
        action: 'console',
      },
      stairs: {
        name: 'Stairs → Below Breakglass',
        position: gameSpace?.stairAnchor ?? waypoints.belowStairsBottom,
        radius: 1.4,
        action: 'travel',
        target: 'downstairs',
      },
    },
    npcs: [],
  };
}
