// Hand-traced from the supplied A-103 PNG (1275 x 1650), not surveyed metres.
// Keeping source pixel coordinates here makes each footprint auditable against the image.
export const PLAN_SOURCE =
  'breakglass_codex_support/references/architecture/03_upstairs_floor_plan.png';
export const planPoint = (x, y) => [(x - 500) / 20, (y - 820) / 20];
export const trace = (points) => points.map(([x, y]) => planPoint(x, y));
export const at = (x, y, height = 0) => {
  const [wx, wz] = planPoint(x, y);
  return [wx, height, wz];
};

export const footprint = trace([
  [172, 518],
  [842, 518],
  [842, 1040],
  [692, 1040],
  [692, 1116],
  [345, 1116],
  [345, 982],
  [132, 982],
  [132, 938],
  [172, 938],
]);

const centralSuiteSourcePoints = [
  [376, 774],
  [403, 748],
  [442, 748],
  [466, 773],
  [488, 843],
  [488, 941],
  [469, 963],
  [386, 963],
  [372, 946],
  [372, 846],
];
const centralSuitePoints = trace(centralSuiteSourcePoints);

export const rooms = [
  {
    id: 'circulation',
    name: 'Central gallery / circulation',
    points: footprint,
    color: 0x887c68,
    label: null,
  },
  {
    id: 'neve-suite',
    name: 'Historic Neve Suite',
    color: 0x5d4938,
    label: at(428, 850, 2.75),
    points: centralSuitePoints,
  },
  {
    id: 'dead-room',
    name: 'Dead Room',
    color: 0x687a75,
    label: at(340, 582, 2.8),
    points: trace([
      [242, 518],
      [443, 518],
      [443, 692],
      [335, 692],
      [242, 668],
    ]),
  },
  {
    id: 'live-room',
    name: 'Live Room',
    color: 0xb48b58,
    label: at(570, 570, 3.6),
    points: trace([
      [443, 518],
      [682, 518],
      [706, 639],
      [704, 874],
      [542, 874],
      [542, 835],
      [502, 692],
      [443, 692],
    ]),
  },
  {
    id: 'mixing-suite',
    name: 'Studio Mixing Suite A',
    color: 0x687d89,
    label: at(249, 739, 3.0),
    points: trace([
      [172, 678],
      [242, 668],
      [335, 692],
      [335, 835],
      [286, 938],
      [172, 938],
    ]),
  },
  {
    id: 'storage',
    name: 'Storage',
    color: 0x736953,
    label: at(411, 1045, 2.5),
    points: trace([
      [345, 995],
      [519, 995],
      [519, 1056],
      [472, 1056],
      [472, 1116],
      [345, 1116],
    ]),
  },
  {
    id: 'emergency-hall',
    name: 'Emergency hall',
    color: 0x92927c,
    label: at(616, 899, 2.3),
    points: trace([
      [542, 874],
      [752, 874],
      [752, 923],
      [542, 923],
    ]),
  },
  {
    id: 'east-hall',
    name: 'East circulation',
    color: 0x92927c,
    label: null,
    points: trace([
      [704, 639],
      [752, 639],
      [752, 1040],
      [692, 1040],
      [692, 923],
      [704, 923],
    ]),
  },
  {
    id: 'bar-kitchen',
    name: 'Bar / Kitchen',
    color: 0x988875,
    label: at(774, 564, 2.9),
    points: trace([
      [682, 518],
      [842, 518],
      [842, 639],
      [706, 639],
    ]),
  },
  {
    id: 'below-stair',
    name: 'Below stair landing',
    color: 0x806d81,
    label: null,
    points: trace([
      [692, 980],
      [752, 980],
      [752, 1040],
      [692, 1040],
    ]),
  },
  {
    id: 'clark-exit',
    name: 'Clark exit landing',
    color: 0x806d81,
    label: null,
    points: trace([
      [132, 938],
      [345, 938],
      [345, 982],
      [132, 982],
    ]),
  },
];

// The polygon footprint and widened exterior gallery remain GAME adaptations of A-103.
// Historical use as the Neve Suite comes from Breakglass; equipment dressing is photo-referenced.
export const centralSuite = {
  id: 'historic-neve-suite',
  name: 'Historic Neve Suite',
  color: 0x4b3b31,
  y1: 0,
  y2: 4.1,
  points: centralSuitePoints,
  label: at(428, 851, 4.5),
  confidence:
    'A-103 footprint / historical Neve use supplied by Breakglass / GAME gallery clearance',
};

export const closedSuites = [
  { id: 'east-closed-north', name: 'Closed Suite', x1: 752, x2: 842, z1: 639, z2: 746 },
  { id: 'adjacent-b', name: 'Adjacent Suite B', x1: 752, x2: 842, z1: 746, z2: 848 },
  { id: 'east-closed-south', name: 'Closed Suite', x1: 752, x2: 842, z1: 848, z2: 944 },
  { id: 'adjacent-a', name: 'Adjacent Suite A', x1: 752, x2: 842, z1: 944, z2: 1040 },
  { id: 'lower-closed-suite', name: 'Closed Suite', x1: 568, x2: 692, z1: 923, z2: 1116 },
].map((r) => ({
  id: r.id,
  name: r.name,
  points: trace([
    [r.x1, r.z1],
    [r.x2, r.z1],
    [r.x2, r.z2],
    [r.x1, r.z2],
  ]),
  label: at((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2, 2.65),
  y1: 0,
  y2: 2.35,
  color: 0x394851,
  confidence: 'A location; modular undecorated interior',
}));

// A door is a real gap in these same wall segments, plus a physical overhead lintel.
const wall = (id, a, b, openings = [], height = 2.9) => ({
  id,
  a: planPoint(...a),
  b: planPoint(...b),
  openings,
  height,
  thickness: 0.22,
});

// Public circulation is authored into the shell itself so wall gaps, signage, collision,
// travel anchors and the rendered architecture agree in the live multiplayer build.
const exteriorOpenings = {
  2: [{ id: 'below-door', name: 'Below Breakglass', at: 0.81, width: 2.0, exterior: true }],
  4: [{ id: 'main-entry-door', name: 'Main entry', at: 0.43, width: 2.0, exterior: true }],
  7: [{ id: 'clark-exit-door', name: 'Exit to Clark', at: 0.5, width: 1.8, exterior: true }],
};

export const wallRuns = [
  ...footprint.map((p, i) => ({
    id: `outside-${i}`,
    a: p,
    b: footprint[(i + 1) % footprint.length],
    openings: exteriorOpenings[i] ?? [],
    height: 2.9,
    thickness: 0.26,
  })),
  wall('dead-west', [242, 518], [242, 668]),
  wall('dead-live', [443, 518], [443, 692]),
  wall('dead-mixing', [242, 668], [335, 692]),
  wall(
    'dead-gallery',
    [335, 692],
    [443, 692],
    [{ id: 'dead-door', name: 'Dead Room', at: 0.47, width: 1.65 }],
  ),
  wall(
    'mixing-gallery',
    [335, 692],
    [335, 835],
    [{ id: 'mixing-door', name: 'Mixing Suite A', at: 0.57, width: 1.8 }],
  ),
  wall('mixing-splay', [335, 835], [286, 938]),
  wall(
    'mixing-clark',
    [172, 938],
    [286, 938],
    [{ id: 'clark-door', name: 'Clark landing', at: 0.52, width: 1.9 }],
  ),
  wall('live-gallery-north', [443, 692], [502, 692]),
  wall(
    'live-gallery-splay',
    [502, 692],
    [542, 835],
    [{ id: 'live-west-door', name: 'Live Room', at: 0.51, width: 1.9 }],
  ),
  wall('live-gallery-south', [542, 835], [542, 874]),
  wall(
    'live-emergency',
    [542, 874],
    [704, 874],
    [{ id: 'live-emergency-door', name: 'Live Room', at: 0.48, width: 2 }],
  ),
  wall('live-east', [704, 665], [704, 874]),
  wall('live-bar', [682, 518], [706, 639]),
  wall(
    'bar-hall',
    [706, 639],
    [842, 639],
    [{ id: 'bar-door', name: 'Bar / Kitchen', at: 0.16, width: 1.45 }],
  ),
  wall(
    'storage-north',
    [345, 995],
    [519, 995],
    [{ id: 'storage-gallery-door', name: 'Storage', at: 0.4, width: 1.6 }],
  ),
  wall(
    'storage-east',
    [519, 995],
    [519, 1056],
    [{ id: 'storage-hall-door', name: 'Storage', at: 0.47, width: 1.4 }],
  ),
  wall('storage-notch', [519, 1056], [472, 1056]),
  wall('storage-south-east', [472, 1056], [472, 1116]),

  // Historic central Neve Suite. The east-side opening is a gameplay-authored access point
  // informed by the A-103 doorway mark; exact as-built aperture dimensions are not surveyed.
  wall('neve-nw', [376, 774], [403, 748], [], 4.1),
  wall('neve-north', [403, 748], [442, 748], [], 4.1),
  wall('neve-ne', [442, 748], [466, 773], [], 4.1),
  wall('neve-east-splay', [466, 773], [488, 843], [], 4.1),
  wall(
    'neve-east',
    [488, 843],
    [488, 941],
    [{ id: 'neve-door', name: 'Historic Neve Suite', at: 0.5, width: 1.65 }],
    4.1,
  ),
  wall('neve-se', [488, 941], [469, 963], [], 4.1),
  wall('neve-south', [469, 963], [386, 963], [], 4.1),
  wall('neve-sw', [386, 963], [372, 946], [], 4.1),
  wall('neve-west', [372, 946], [372, 846], [], 4.1),
  wall('neve-nw-splay', [372, 846], [376, 774], [], 4.1),
];

export const waypoints = {
  entry: at(544, 1086),
  entryPassage: at(544, 1005),
  belowStairsTop: at(720, 970),
  belowStairsBottom: at(720, 1018, -0.84),
  eastHall: at(728, 809),
  eastHallNorth: at(727, 665),
  barDoor: at(727, 639),
  deadDoor: at(386, 692),
  storageDoor: at(415, 995),
  storageCenter: at(430, 1024),
  storageEast: at(519, 1024),
  eastJunction: at(728, 898),
  southLiveDoor: at(620, 874),
  liveSouthAisle: at(638, 806),
  gallerySE: at(535, 974),
  galleryE: at(514, 850),
  galleryNE: at(492, 769),
  galleryN: at(423, 721),
  galleryNW: at(355, 727),
  galleryW: at(353, 811),
  gallerySW: at(349, 971),
  galleryS: at(419, 979),
  live: at(597, 774),
  mixingDoor: at(335, 774),
  mixing: at(265, 791),
  mixingAisleNorth: at(304, 791),
  mixingAisleSouth: at(304, 868),
  clarkDoor: at(231, 938),
  clark: at(152, 958),
  dead: at(364, 634),
  bar: at(732, 602),
  synthApproach: at(560, 824),
  neveDoor: at(488, 892),
  neveConsole: at(427, 790),
  neveTape: at(398, 878),
  neveArchive: at(447, 912),
};

// Route A is intentionally all on the ground: jumping is optional, never an access tax.
export const mainRoute = [
  'entry',
  'entryPassage',
  'gallerySE',
  'galleryS',
  'gallerySW',
  'galleryW',
  'galleryNW',
  'galleryN',
  'galleryNE',
  'live',
  'galleryNE',
  'galleryN',
  'galleryNW',
  'galleryW',
  'mixingDoor',
  'mixing',
  'mixingAisleNorth',
  'mixingAisleSouth',
  'clarkDoor',
  'clark',
];
export const loopRoute = [
  'gallerySE',
  'galleryS',
  'gallerySW',
  'galleryW',
  'galleryNW',
  'galleryN',
  'galleryNE',
  'galleryE',
  'gallerySE',
];
