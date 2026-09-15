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
    prop('drum-riser', 583, 606, 3.5, 2.7, 0.28, 0x7a5038, { name: 'Live Room · drum riser' }),
    prop('overlook-step', 557, 849, 0.8, 1.55, 0.3, 0xbba166, { name: 'Overlook step' }),
    prop('live-overlook', 583, 849, 1.8, 1.55, 1.1, 0xa58555, {
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
    prop('live-case-high', 678, 706, 1.1, 1.2, 1.45, 0x527075, { name: 'Live Room · case perch' }),
    prop('dead-room-bench', 290, 552, 2.7, 0.9, 0.3, 0x6b7c73, { name: 'Dead Room · quiet nook' }),
    prop('storage-case-low', 374, 1060, 1.2, 1.2, 0.3, 0x847156, { name: 'Storage cases' }),
    prop('storage-case-mid', 403, 1060, 1.2, 1.2, 0.85, 0x847156, { name: 'Storage cases' }),
    prop('storage-perch', 435, 1075, 1.3, 1.5, 1.4, 0x847156, { name: 'Storage · hidden perch' }),
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
  ];
  // Below now descends at the former southeast MAIN ENTRY position.
  const stairFloors = [0, 1, 2, 3].map((i) => {
    const z1 = 980 + i * 15,
      z2 = i === 3 ? 1040 : z1 + 15;
    return {
      id: `below-step-${i}`,
      name: 'Stairs ↓ Below Breakglass',
      points: trace([
        [704, z1],
        [736, z1],
        [736, z2],
        [704, z2],
      ]),
      y1: -1.5,
      y2: -(i + 1) * 0.28,
      color: 0x887486,
      kind: 'stair',
    };
  });
  // Keep the old west Clark landing flat, and notch only the southeast circulation floor
  // so the new stair run has real descending collision surfaces.
  const floorRooms = rooms
    .filter((room) => room.id !== 'entry')
    .map((room) =>
      room.id === 'circulation'
        ? {
            ...room,
            points: trace([
              [172, 518],
              [842, 518],
              [842, 1040],
              [736, 1040],
              [736, 980],
              [704, 980],
              [704, 1040],
              [692, 1040],
              [692, 1116],
              [345, 1116],
              [345, 982],
              [132, 982],
              [132, 938],
              [172, 938],
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
    spawns: {
      start: at(544, 1086),
      stairs: at(720, 970),
    },
    stairAnchor: at(720, 1018, -0.84),
  };
}
