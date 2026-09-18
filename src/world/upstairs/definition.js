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
  const spawns = gameSpace?.spawns ?? {
    start: waypoints.entry,
    stairs: waypoints.belowStairsTop,
  };
  const fridgePosition = at(785, 635);
  const doorGate = (id, requires, position, size) => {
    const [x, , z] = position;
    return {
      id,
      requires,
      collision: {
        x1: x - size[0] / 2,
        x2: x + size[0] / 2,
        z1: z - size[2] / 2,
        z2: z + size[2] / 2,
        y1: 0,
        y2: size[1],
      },
      visual: { position: [x, size[1] / 2, z], size, color: 0x34463a },
    };
  };
  const progressionGates = [
    doorGate('dead-room-gate', 'deadRoomAccessGranted', at(386, 692), [1.72, 2.25, 0.16]),
    doorGate('storage-gallery-gate', 'tapeArchiveAccessGranted', at(415, 995), [1.68, 2.25, 0.16]),
    doorGate('storage-hall-gate', 'tapeArchiveAccessGranted', at(519, 1024), [0.16, 2.25, 1.48]),
    doorGate('alley-shortcut-gate', 'alleyShortcutUnlocked', at(414, 1116), [1.64, 2.25, 0.18]),
  ];
  const guidePoints = {
    storage: { player: at(430, 1020), npc: at(410, 1008) },
    deadRoom: { player: at(386, 666), npc: at(386, 684) },
  };
  return {
    id: 'upstairs',
    layoutRevision: 'a103-spatial-9-circulation-fix',
    pass,
    title: 'UPSTAIRS — BREAKGLASS STUDIOS',
    model: 'upstairs-building',
    provenance: {
      status: 'A-103 topology / historical Neve Suite / GAME circulation',
      reference: PLAN_SOURCE,
      note: 'Main entry, Clark exit and Below stair now match the corrected Breakglass circulation. The historic Neve Suite remains intentionally open-topped for the third-person camera.',
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
      alleyShortcut: at(414, 1090),
    },
    intro: [
      'THIRD FLOOR',
      'Main entry is beside Storage. The southeast stair goes down to Below; the west landing exits to Clark. Build a session, explore the archive and say hello to Maddox if you see him.',
    ],
    rooms: floorRooms,
    solids,
    doors,
    platforms,
    fixtures,
    stairFloors,
    centralSuite,
    closedSuites,
    progressionGates,
    guidePoints,
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
      coffeeMachine: {
        name: 'Studio kitchen espresso machine',
        position: at(786, 594),
        radius: 1.5,
        action: 'coffee',
      },
      instruments: {
        name: 'Guitar + bass rack',
        position: at(305, 625),
        radius: 1.7,
        action: 'instruments',
        requires: 'deadRoomAccessGranted',
      },
      amps: {
        name: 'Dead Room amps',
        position: at(365, 605),
        radius: 1.8,
        action: 'amps',
        requires: 'deadRoomAccessGranted',
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
      modularSynth: {
        name: 'Patchable modular synth + sequencer',
        position: at(195, 777),
        radius: 1.75,
        action: 'modularSynth',
      },
      gentrificationKey: {
        name: 'Glowing condominium-shaped key',
        position: [1.7, 3.1, 1.5],
        radius: 1.2,
        action: 'gentrificationKey',
        requiresNot: 'gentrificationKey',
      },
      tapeArchive: {
        name: 'Breakglass tape archive',
        position: at(383, 1027),
        radius: 1.55,
        action: 'tapeArchive',
        requires: 'tapeArchiveAccessGranted',
      },
      deadRoomLock: {
        name: 'Dead Room · locked',
        position: at(386, 700),
        radius: 1.55,
        action: 'progressionDoor',
        progression: 'dead-room',
        requiresNot: 'deadRoomAccessGranted',
      },
      storageLock: {
        name: 'Storage · locked',
        position: at(415, 986),
        radius: 1.55,
        action: 'progressionDoor',
        progression: 'storage',
        requiresNot: 'tapeArchiveAccessGranted',
      },
      storageHallLock: {
        name: 'Storage · locked',
        position: at(532, 1024),
        radius: 1.55,
        action: 'progressionDoor',
        progression: 'storage',
        requiresNot: 'tapeArchiveAccessGranted',
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
      alleyShortcut: {
        name: 'Service stair ↓ alley',
        position: at(414, 1100),
        radius: 1.55,
        action: 'travel',
        target: 'alley@studioShortcut',
        requires: 'alleyShortcutUnlocked',
      },
      alleyShortcutLock: {
        name: 'Service stair · locked',
        position: at(414, 1100),
        radius: 1.55,
        action: 'progressionDoor',
        progression: 'shortcut',
        requiresNot: 'alleyShortcutUnlocked',
      },
      stairs: {
        name: 'Stairs ↓ Below Breakglass',
        position: gameSpace?.stairAnchor ?? waypoints.belowStairsBottom,
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
        position: waypoints.galleryE,
        route: [
          waypoints.galleryE,
          waypoints.live,
          waypoints.galleryNW,
          waypoints.neveDoor,
          waypoints.galleryS,
        ],
        speed: 0.43,
      },
      {
        id: 'jace',
        name: 'Jace',
        role: 'producer',
        position: waypoints.mixingAisleNorth,
        route: [
          waypoints.mixingAisleNorth,
          waypoints.galleryNW,
          waypoints.galleryNE,
          waypoints.gallerySE,
          waypoints.mixingAisleSouth,
        ],
        speed: 0.36,
      },
      {
        id: 'zander',
        name: 'Zander',
        role: 'tech',
        position: waypoints.dead,
        route: [waypoints.dead, waypoints.storageDoor, waypoints.mixing, waypoints.dead],
        speed: 0.39,
      },
      {
        id: 'boogaloo',
        name: 'Boogaloo',
        role: 'artist',
        position: waypoints.live,
        route: [
          waypoints.live,
          waypoints.synthApproach,
          waypoints.deadDoor,
          waypoints.live,
        ],
        speed: 0.48,
      },
      {
        id: 'nora',
        name: 'Nora',
        role: 'photographer',
        position: waypoints.live,
        route: [
          waypoints.live,
          waypoints.mixing,
          waypoints.synthApproach,
          waypoints.bar,
          waypoints.live,
        ],
        speed: 0.5,
      },
    ],
  };
}
