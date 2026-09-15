from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_one(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact match, found {count}\nMATCH={old[:120]!r}")
    write(path, text.replace(old, new, 1))


def sub_one(path, pattern, replacement):
    text = read(path)
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"{path}: regex expected one match, found {count}\nPATTERN={pattern}")
    write(path, text)


plan = "src/world/upstairs/plan.js"
replace_one(
    plan,
    """  {
    id: 'entry',
    name: '3rd-floor entry',
    color: 0x668783,
    label: null,
    points: trace([
      [692, 980],
      [752, 980],
      [752, 1040],
      [692, 1040],
    ]),
  },
  {
    id: 'clark-stair',
    name: 'Clark stair landing',
    color: 0x806d81,
    label: null,
    points: trace([
      [132, 938],
      [345, 938],
      [345, 982],
      [132, 982],
    ]),
  },""",
    """  {
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
  },""",
)
replace_one(
    plan,
    """const wall = (id, a, b, openings = [], height = 2.9) => ({
  id,
  a: planPoint(...a),
  b: planPoint(...b),
  openings,
  height,
  thickness: 0.22,
});

export const wallRuns = [
  ...footprint.map((p, i) => ({
    id: `outside-${i}`,
    a: p,
    b: footprint[(i + 1) % footprint.length],
    openings: [],
    height: 2.9,
    thickness: 0.26,
  })),""",
    """const wall = (id, a, b, openings = [], height = 2.9) => ({
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
  })),""",
)
replace_one(
    plan,
    "[{ id: 'clark-door', name: 'Clark stair', at: 0.52, width: 1.9 }]",
    "[{ id: 'clark-door', name: 'Clark landing', at: 0.52, width: 1.9 }]",
)
replace_one(
    plan,
    """export const waypoints = {
  entry: at(720, 1012),""",
    """export const waypoints = {
  entry: at(544, 1086),
  entryPassage: at(544, 1005),
  belowStairsTop: at(720, 970),
  belowStairsBottom: at(720, 1018, -0.84),""",
)
replace_one(
    plan,
    """export const mainRoute = [
  'entry',
  'eastJunction',
  'gallerySE',""",
    """export const mainRoute = [
  'entry',
  'entryPassage',
  'gallerySE',""",
)


gamespace = "src/world/upstairs/gameSpace.js"
sub_one(
    gamespace,
    r"  // Replace just the west end of the floor with a real descending stair run\..*?\n  return \{",
    """  // Below descends from the former southeast MAIN ENTRY pocket.
  const stairFloors = [0, 1, 2, 3].map((i) => {
    const z1 = 980 + i * 15;
    const z2 = i === 3 ? 1040 : z1 + 15;
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

  // Remove the flat southeast layers that used to hide the stairs. The old west stair stays
  // flat because that location is the Clark exit landing, not the route to Below.
  const floorRooms = rooms
    .filter((room) => room.id !== 'below-stair')
    .map((room) => {
      if (room.id === 'circulation') {
        return {
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
        };
      }
      if (room.id === 'east-hall') {
        return {
          ...room,
          points: trace([
            [704, 639],
            [752, 639],
            [752, 1040],
            [736, 1040],
            [736, 980],
            [704, 980],
          ]),
        };
      }
      return room;
    });
  return {""",
)
replace_one(
    gamespace,
    """    spawns: { start: waypoints.entry, stairs: at(227, 958) },
    stairAnchor: at(152, 958, -0.84),""",
    """    spawns: { start: waypoints.entry, stairs: waypoints.belowStairsTop },
    stairAnchor: waypoints.belowStairsBottom,""",
)


definition = "src/world/upstairs/definition.js"
replace_one(
    definition,
    "const spawns = gameSpace?.spawns ?? { start: waypoints.entry, stairs: at(227, 958) };",
    """const spawns = gameSpace?.spawns ?? {
    start: waypoints.entry,
    stairs: waypoints.belowStairsTop,
  };""",
)
replace_one(definition, "layoutRevision: 'a103-spatial-8-maddox'", "layoutRevision: 'a103-spatial-9-circulation-fix'")
replace_one(
    definition,
    "Traced room relationships; widened polygon gallery and Clark landing for traversal. The historic Neve Suite is intentionally open-topped in the game so its console, tape machine and archive activity remain visible from the third-person camera.",
    "Main entry, Clark exit and Below stair now match the corrected Breakglass circulation. The historic Neve Suite remains intentionally open-topped for the third-person camera.",
)
replace_one(
    definition,
    "Build a session, play the instruments, explore the tape archive, mix on the Spectra console, enter the historic Neve Suite, and say hello to Maddox if you see him wandering around.",
    "Main entry is beside Storage. The southeast stair goes down to Below; the west landing exits to Clark. Build a session, explore the archive and say hello to Maddox if you see him.",
)
replace_one(
    definition,
    """      stairs: {
        name: 'Clark stair → Below',
        position: gameSpace?.stairAnchor ?? waypoints.clark,""",
    """      stairs: {
        name: 'Stairs ↓ Below Breakglass',
        position: gameSpace?.stairAnchor ?? waypoints.belowStairsBottom,""",
)


upstairs_geo = "src/scenes/geometry/upstairsBlockout.js"
replace_one(
    upstairs_geo,
    "if (['circulation', 'emergency-hall', 'east-hall', 'entry', 'clark-stair'].includes(room.id))",
    "if (['circulation', 'emergency-hall', 'east-hall', 'below-stair', 'clark-exit'].includes(room.id))",
)
replace_one(upstairs_geo, "    [720, 986],\n", "")
replace_one(
    upstairs_geo,
    """  const [ex, , ez] = at(720, 1038);
  box(root, 1.9, 2.2, 0.06, dark, ex, 1.1, ez);
  box(root, 1.9, 0.11, 0.07, trim, ex, 2.15, ez - 0.02);
  label(root, 'MAIN ENTRY', ex, 2.65, ez, 0.36, '#d8f0df');
  const [cx, , cz] = at(144, 958);
  label(root, '↓ BELOW', cx, 2.0, cz, 0.46, '#ead1f0');""",
    """  const [entryX, , entryZ] = at(544, 1110);
  label(root, 'MAIN ENTRY — STUDIOS', entryX, 2.68, entryZ, 0.4, '#d8f0df');

  const [belowX, , belowZ] = at(720, 1004);
  label(root, 'STAIRS ↓ BELOW BREAKGLASS', belowX, 2.35, belowZ, 0.42, '#ead1f0');
  const stairRail = mat(0x454b50, 0.52, 0.18);
  for (const pz of [986, 1004, 1022, 1038]) {
    for (const px of [699, 741]) {
      const [x, , z] = at(px, pz);
      box(root, 0.06, 0.9, 0.06, stairRail, x, 0.45, z);
    }
  }

  const [clarkX, , clarkZ] = at(144, 958);
  label(root, 'EXIT TO CLARK', clarkX, 2.1, clarkZ, 0.42, '#d8f0df');""",
)


levels = "src/world/levels.js"
replace_one(
    levels,
    """const rampSurface = (id, name, x1, x2, z1, z2, from, to) => ({
  id,
  name,
  x1,
  x2,
  z1,
  z2,
  priority: 20,
  ramp: { axis: 'z', from, to },
});""",
    """const rampSurface = (id, name, x1, x2, z1, z2, from, to, axis = 'z') => ({
  id,
  name,
  x1,
  x2,
  z1,
  z2,
  priority: 20,
  ramp: { axis, from, to },
});""",
)
replace_one(levels, "      alley: [4.6, 0.64, -5.0],", "      alley: [-9.25, -0.72, -0.82],")
replace_one(
    levels,
    "The club is alive now. Push toward the booth, slip into Take A Break, play the old Mortal Kombat II cabinet, find the kitchen bar and coffee machine, or take the broad Clark stair back up to the studio.",
    "The club is alive now. The shared west stair goes up to the studio; at its bottom landing the stair turns down to the alleyway. Push toward the booth, Take A Break, the bar or the old Mortal Kombat II cabinet.",
)
replace_one(
    levels,
    "        rampSurface('alley-stairs', 'Stairs to alley', 3.82, 5.38, -5.2, -3.4, 0.72, 0),",
    """        rampSurface(
          'alley-stairs',
          'Stairs down to alley',
          -9.2,
          -6.8,
          -1.28,
          -0.48,
          -0.72,
          0,
          'x',
        ),
        {
          id: 'alley-stair-bottom',
          name: 'Alley stair lower landing',
          x1: -9.45,
          x2: -9.15,
          z1: -1.28,
          z2: -0.48,
          y: -0.72,
          priority: 21,
        },""",
)
replace_one(
    levels,
    "        { x1: -7.9, x2: -5.25, z1: -3.3, z2: -0.7 },",
    """        { x1: -7.9, x2: -5.25, z1: -3.3, z2: -0.7 },
        { x1: -9.55, x2: -6.5, z1: -1.4, z2: -0.4 },""",
)
replace_one(
    levels,
    """      alleyExit: {
        ...anchor('Stairs to alley / club entrance', [4.6, 0.64, -5.0], 1.3, 'travel'),
        target: 'alley@clubDoor',
      },""",
    """      alleyExit: {
        ...anchor('Stairs ↓ Alleyway', [-9.25, -0.72, -0.82], 1.35, 'travel'),
        target: 'alley@clubDoor',
      },""",
)


below_geo = "src/scenes/geometry/belowBlockout.js"
replace_one(
    below_geo,
    "doorwayFrame(downScene, 4.6, -3.38, 'horizontal', 'ALLEY / COAT CHECK');",
    "doorwayFrame(downScene, 4.6, -3.38, 'horizontal', 'COAT CHECK');",
)
sub_one(
    below_geo,
    r"  floor\(downScene, 4\.6, -4\.65, 2\.3, 1\.9, serviceFloor\);.*?\n  const studioStep",
    """  floor(downScene, 4.6, -4.65, 2.3, 1.9, serviceFloor);
  wall(3.45, -4.65, 0.24, 1.9);
  wall(5.75, -4.65, 0.24, 1.9);
  wall(4.6, -5.6, 2.3, 0.24);
  label(downScene, 'COAT CHECK', 4.6, 2.2, -4.0, 0.31);

  const studioStep""",
)
replace_one(
    below_geo,
    "  doorwayFrame(downScene, -6.55, -3.45, 'horizontal', 'UPSTAIRS / STUDIO');\n}",
    """  doorwayFrame(downScene, -6.55, -3.45, 'horizontal', 'UPSTAIRS / STUDIO');
  label(downScene, 'STAIRS ↑ STUDIO', -6.55, 2.35, -3.1, 0.36, '#d8c1ff');

  // At the bottom landing, the shared staircase turns ninety degrees and continues down to
  // the alley. The alley travel interaction lives at the lower landing of this same run.
  const alleyStep = mat(0x4b4039, 0.9, 0.02);
  box(downScene, 2.55, 0.12, 0.82, alleyStep, -6.72, -0.03, -0.82);
  for (let i = 0; i < 7; i++) {
    const x = -7.02 - i * 0.34;
    const top = -0.09 * (i + 1);
    box(downScene, 0.38, 0.14, 1.42, alleyStep, x, top - 0.07, -0.82);
  }
  box(downScene, 0.55, 0.14, 1.42, alleyStep, -9.28, -0.79, -0.82);

  for (const [x, y] of [
    [-7.1, 0.4],
    [-7.85, 0.2],
    [-8.6, -0.02],
  ]) {
    box(downScene, 0.06, 0.92, 0.06, studioRail, x, y, -1.52);
    box(downScene, 0.06, 0.92, 0.06, studioRail, x, y, -0.12);
  }
  doorwayFrame(downScene, -9.35, -0.82, 'vertical', 'ALLEY');
  label(downScene, 'STAIRS ↓ ALLEYWAY', -7.95, 1.45, -0.82, 0.38, '#d8c1ff');
  label(downScene, '↓ ALLEY', -9.15, 0.35, -0.82, 0.28, '#ead1f0');
}""",
)


alley_geo = "src/scenes/geometry/alleyBlockout.js"
replace_one(
    alley_geo,
    "label(root, 'CLUB ENTRANCE ↓ BELOW', -3.7, 3.35, -2.2, 0.42, '#ffd4a8');",
    "label(root, 'STAIRWELL ↑ BREAKGLASS', -3.7, 3.35, -2.2, 0.42, '#ffd4a8');",
)
replace_one(
    alley_geo,
    """  const stair = mat(0x453a34, 0.88, 0.02);
  for (let i = 0; i < 5; i++) {
    const depth = 0.22;
    box(root, 1.55, 0.08, depth, stair, -3.7, 0.01 - i * 0.035, -1.58 - i * 0.2);
  }""",
    """  const stair = mat(0x453a34, 0.88, 0.02);
  for (let i = 0; i < 5; i++) {
    const height = 0.08 * (i + 1);
    box(root, 1.55, height, 0.22, stair, -3.7, height / 2, -1.5 - i * 0.18);
  }""",
)


alley_world = "src/world/alley.js"
replace_one(
    alley_world,
    "...anchor('Bouncer / club entrance', [-3.7, 0, -1.72], 1.7, 'travel')",
    "...anchor('Stairwell ↑ Breakglass', [-3.7, 0, -1.72], 1.7, 'travel')",
)


routes = "tests/spatial-routes.js"
replace_one(
    routes,
    """export const secondaryRoute = [
  'entry',
  'eastJunction',""",
    """export const secondaryRoute = [
  'entry',
  'entryPassage',
  'gallerySE',
  'eastJunction',""",
)
replace_one(
    routes,
    """  'gallerySE',
  'eastJunction',
  'entry',
];""",
    """  'gallerySE',
  'entryPassage',
  'entry',
];""",
)


spatial_test = "tests/spatial.test.js"
replace_one(
    spatial_test,
    "follow(player, world, ['eastJunction', ...loopRoute, 'eastJunction', 'entry'], camera);",
    "follow(player, world, ['eastJunction', ...loopRoute, 'entryPassage', 'entry'], camera);",
)
replace_one(
    spatial_test,
    """    for (const door of level.doors) {
      const position = new Vector3(""",
    """    for (const door of level.doors) {
      if (door.exterior) continue;
      const position = new Vector3(""",
)
replace_one(
    spatial_test,
    "['live', 'galleryNE', 'galleryE', 'gallerySE', 'eastJunction', 'entry']",
    "['live', 'galleryNE', 'galleryE', 'gallerySE', 'entryPassage', 'entry']",
)


browser = "tests/browser-smoke.js"
replace_one(
    browser,
    """    await route(mainRoute.slice(15));
    travel('downstairs');""",
    """    await route([
      'mixing',
      'mixingAisleSouth',
      'gallerySW',
      'galleryS',
      'gallerySE',
      'eastJunction',
      'belowStairsBottom',
    ]);
    travel('downstairs');""",
)
replace_one(
    browser,
    """    await route([...mainRoute].reverse().slice(1));
    await route(['eastJunction', ...loopRoute, 'eastJunction', 'entry']);""",
    """    await route(['eastJunction', ...loopRoute, 'entryPassage', 'entry']);""",
)

print('Live spatial patch applied successfully.')
