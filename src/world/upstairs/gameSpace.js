import { at, trace, footprint, rooms, waypoints } from './plan.js';
import { platform } from './compile.js';

// GAME-only kit. No inferred uses of private suites; all records can be removed
// without changing A-103's room/wall topology. Dimensions are authoring units.
const prop = (id, px, pz, w, d, h, color, extra = {}) => {
  const [x, , z] = at(px, pz);
  return platform(id, x, z, w, d, h, color, extra);
};
export function createGameSpace() {
  const platforms = [
    prop('gallery-bench', 394, 739, 1.8, 0.6, 0.28, 0xb68b58, { name: 'Polygon gallery bench' }),
    prop('listening-deck', 260, 828, 4.7, 3.5, 0.28, 0x98724f, {
      name: 'Mixing Suite A · listening platform',
    }),
    prop('drum-riser', 583, 606, 3.5, 2.7, 0.28, 0x7a5038, {
      name: 'Live Room · drum riser',
    }),
    prop('overlook-step', 557, 849, 0.8, 1.55, 0.3, 0xbba166, { name: 'Overlook step' }),
    prop('live-overlook', 583, 849, 1.8, 1.55, 1.1, {
      name: 'Live Room · polygon overlook',
    }),
    prop('overlook-upper-case', 568, 850, 0.8, 0.85, 2.1, 0x527075, {
      name: 'Overlook upper case',
    }),
    prop('polygon-hop-ledge', 542, 850, 1.1, 1.55, 3.1, 0xb7a077, {
      name: 'Polygon hop ledge · GAME overlook',
      y1: 2.9,
    }),
    prop('live-case-low', 678, 650, 1.1, 1.2, 0.3, 0x567274, { name: 'Flight case' }),
    prop('live-case-mid', 678, 678, 1.1, 1.2, 0.85, 0x527075, { name: 'Flight case' }),
    prop('live-case-high', 678, 706, 1.1, 1.2, 1.45, 0x527075, {
      name: 'Live Room · case perch',
    }),
    prop('dead-room-bench', 290, 552, 2.7, 0.9, 0.3, 0x6b7c73, {
      name: 'Dead Room · quiet nook',
    }),
    prop('storage-case-low', 374, 1060, 1.2, 1.2, 0.3, 0x847156, {
      name: 'Storage cases',
    }),
    prop('storage-case-mid', 403, 1060, 1.2, 1.2, 0.85, 0x847156, {
      name: 'Storage cases',
    }),
    prop('storage-perch', 435, 1075, 1.3, 1.5, 1.4, 0x847156, {
      name: 'Storage · hidden perch',
    }),
    prop('kitchen-bench', 781, 612, 2, 0.85, 0.3, 0x9b7757, { name: 'Bar / Kitchen' }),
  ];
  // Actual blocking envelopes for equipment; anchors sit on the listening side.
  const fixtures = [
    prop('spectra-console', 254, 836, 3.6, 1.15, 1.5, 0x54778b, { kind: 'equipment' }),
    prop('monitor-left', 219, 852, 0.65, 0.6, 2.1, 0x1f292b, { kind: 'equipment' }),
    prop('monitor-right', 289, 852, 0.65, 0.6, 2.1, 0x1f292b, { kind: 'equipment' }),
    prop('tape-bank', 189, 830, 1, 2.2, 1.8, 0x78604b, { kind: 'equipment' }),
    prop('patch-rack', 185, 777, 0.5, 2.2, 2, 0x534c43, { kind: 'equipment' }),
    prop('side-rack', 310, 714, 0.85, 1.3, 1.7, 0x414f57, { kind: 'equipment' }),
    prop('piano-body', 647, 726, 2.1, 1.2, 1.05, 0x493c35, { kind: 'equipment' }),
    prop('synth-table', 590, 807, 1.6, 0.8, 0.95, 0x434f57, { kind: 'equipment' }),
    prop('drum-shells', 583, 602, 1.8, 1.25, 1.25, 0x947342, { kind: 'equipment' }),
    prop('bar-counter', 809, 567, 1.15, 3.3, 1.1, 0xa88157, { kind: 'equipment' }),
    prop('dead-gobo', 294, 578, 2.8, 0.22, 1.65, 0x455655, { kind: 'equipment' }),

    // Dead Room GAME gear wall. These are selectable stations, not surveyed placement.
    prop('dead-amp-tweed', 404, 548, 0.78, 0.58, 0.78, 0x8b6847, { kind: 'equipment' }),
    prop('dead-amp-clean', 404, 575, 0.9, 0.62, 0.9, 0x29343a, { kind: 'equipment' }),
    prop('dead-amp-stack', 404, 610, 1.0, 0.7, 1.5, 0x242426, { kind: 'equipment' }),
    prop('dead-bass-stack', 404, 650, 1.05, 0.75, 1.65, 0x191b1d, { kind: 'equipment' }),
    prop('instrument-rack', 270, 625, 0.72, 2.1, 1.55, 0x6a4a35, { kind: 'equipment' }),
    prop('mic-locker', 274, 665, 0.7, 0.55, 1.45, 0x58636a, { kind: 'equipment' }),

    // Historic Neve Suite: placement is GAME dressing informed by the 2019 console photo,
    // not a claim of surveyed historic furniture coordinates. The console/monitor package is
    // rotated toward the room so the player approaches the working surface instead of its back.
    prop('neve-console', 426, 790, 3.45, 0.95, 1.35, 0x342f2a, {
      kind: 'equipment',
      rotationY: Math.PI,
    }),
    prop('neve-monitor-left', 405, 775, 0.58, 0.5, 1.95, 0x151719, {
      kind: 'equipment',
      rotationY: Math.PI,
    }),
    prop('neve-monitor-right', 451, 775, 0.58, 0.5, 1.95, 0x151719, {
      kind: 'equipment',
      rotationY: Math.PI,
    }),
    prop('neve-side-rack', 461, 821, 0.72, 0.72, 1.72, 0x34383a, { kind: 'equipment' }),
    prop('neve-tape-machine', 396, 880, 1.02, 0.82, 1.62, 0x5a5d5d, { kind: 'equipment' }),

    // Storage archive shelving. Reel labels/content remain intentionally generic until
    // catalogued source metadata is attached to each playable tape. It hugs the west wall so
    // the east-hand storage circulation remains fully traversable.
    prop('tape-archive-shelves', 362, 1027, 0.65, 2.2, 1.9, 0x51483e, { kind: 'equipment' }),
  ];
  // Replace just the west end of the floor with a real descending stair run.
  const stairFloors = [0, 1, 2, 3].map((i) => {
    const x2 = 211 - i * 20,
      x1 = i === 3 ? 132 : x2 - 20;
    return {
      id: `clark-step-${i}`,
      name: 'Clark stair ↓ Below',
      points: trace([
        [x1, 938],
        [x2, 938],
        [x2, 982],
        [x1, 982],
      ]),
      y1: -1.5,
      y2: -(i + 1) * 0.28,
      color: 0x887486,
      kind: 'stair',
    };
  });
  const floorRooms = rooms.map((room) =>
    room.id === 'circulation'
      ? {
          ...room,
          points: trace([
            [172, 518],
            [842, 518],
            [842, 1040],
            [692, 1040],
            [692, 1116],
            [345, 1116],
            [345, 982],
            [211, 982],
            [211, 938],
            [172, 938],
          ]),
        }
      : room.id === 'clark-stair'
        ? {
            ...room,
            points: trace([
              [211, 938],
              [345, 938],
              [345, 982],
              [211, 982],
            ]),
          }
        : room,
  );
  return {
    platforms,
    fixtures,
    stairFloors,
    rooms: floorRooms,
    boundary: footprint,
    spawns: { start: waypoints.entry, stairs: at(227, 958) },
    stairAnchor: at(152, 958, -0.84),
  };
}
