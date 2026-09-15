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
    ...[...platforms, ...fixtures]
      .filter((p) => p.surface !== false)
      .map((p) => ({ ...p, y: p.y2, priority: 20 })),
    ...stairFloors.map((p) => ({ ...p, y: p.y2, priority: 30 })),
  ];
  const spawns = gameSpace?.spawns ?? { start: waypoints.entry, stairs: at(227, 958) };
  const fridgePosition = at(785, 635);
  return {
    id: 'upstairs',
    layoutRevision: 'a103-spatial-8-maddox',
    pass,
    title: 'UPSTAIRS — BREAKGLASS STUDIOS',
    model: 'upstairs-building',
    provenance: {
      status: 'A-103 topology / historical Neve Suite / GAME circulation',
      reference: PLAN_SOURCE,
      note: 'Traced room relationships; widened polygon gallery and Clark landing for traversal. The historic Neve Suite is intentionally open-topped in the game so its console, tape machine and archive activity remain visible from the third-person camera.',
    },
    background: 0x171d24,
    fog: [45, 100],
    cameraOffset: [8, 10, 11],
    lights: [
      { color: 0xffd9ad, intensity: 8, distance: 30, position: at(575, 650, 7) },
      { color: 0xa2c8d6, intensity: 5, distance: 20, position: at(240, 770, 5) },
      { color: 0xffc98a, intensity: 3.8, distance: 11, position: at(427, 850, 3.2) },
    ],
    spawns: {
      ...spawns,
      roofReturn: at(435, 1075, 1.4),
    },
    intro: [
      'THIRD FLOOR',
      'Build a session, play the instruments, explore the tape archive, mix on the Spectra console, enter the historic Neve Suite, and say hello to Maddox if you see him wandering around.',
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
      synth: {
        name: 'Synth + organ station',
        position: at(590, 824),
        radius: 1.6,
        action: 'synth',
      },
      livePlayback: {
        name: 'Live From Breakglass screen',
        position: at(620, 565),
        radius: 2.0,
        action: 'livePlayback',
      },
      houseDjDesk: {
        name: 'House DJ production desk',
        position: at(325, 748),
        radius: 1.55,
        action: 'houseDjDesk',
        requires: 'houseDjDeskIntroduced',
      },
      photoFridge: {
        name: 'Kitchen fridge · Nora photos',
        position: fridgePosition,
        radius: 1.6,
        action: 'photoFridge',
      },
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
        position: at(383, 1027),
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
      roofPassage: {
        name: 'Hidden roof hatch',
        position: at(435, 1075, 1.4),
        radius: 1.5,
        action: 'travel',
        target: 'roof@hatch',
        requires: 'roofSecretUnlocked',
      },
      stairs: {
        name: 'Clark stair → Below',
        position: gameSpace?.stairAnchor ?? waypoints.clark,
        radius: 1.4,
        action: 'travel',
        target: 'downstairs',
      },
    },
    maddox: {
      name: 'Maddox',
      start: at(530, 785),
      radius: 1.4,
      speed: 0.78,
      roamPoints: [
        at(530, 785),
        at(600, 760),
        at(515, 850),
        at(422, 721),
        at(355, 727),
        at(320, 805),
        at(386, 692),
        at(430, 980),
      ],
      napPoints: [at(310, 820), at(575, 790), at(365, 635), at(430, 980)],
      roofLeadRoute: [at(515, 850), at(535, 974), at(480, 988), at(430, 1015), at(435, 1075, 1.4)],
    },
    npcs: [
      {
        id: 'james',
        name: 'James',
        role: 'host',
        position: at(520, 780),
        route: [at(520, 780), at(590, 730), at(340, 725), at(486, 890), at(430, 980)],
        speed: 0.43,
      },
      {
        id: 'jace',
        name: 'Jace',
        role: 'producer',
        position: at(304, 810),
        route: [at(304, 810), at(355, 727), at(492, 769), at(535, 974), at(304, 868)],
        speed: 0.36,
      },
      {
        id: 'zander',
        name: 'Zander',
        role: 'tech',
        position: at(365, 635),
        route: [at(365, 635), at(415, 995), at(254, 809), at(365, 635)],
        speed: 0.39,
      },
      {
        id: 'boogaloo',
        name: 'Boogaloo',
        role: 'artist',
        position: at(600, 790),
        route: [at(600, 790), at(590, 824), at(386, 692), at(597, 774)],
        speed: 0.48,
      },
      {
        id: 'nora',
        name: 'Nora',
        role: 'photographer',
        position: at(606, 575),
        route: [at(606, 575), at(269, 819), at(602, 816), at(773, 638), at(606, 575)],
        speed: 0.5,
      },
    ],
  };
}
