import { Shape, ExtrudeGeometry, Mesh, MeshStandardMaterial, Group } from 'three';
import { buildStudioEquipment } from './upstairsFixtures.js';
import { buildSelectableStudioGear } from './studioGearProps.js';
import { at } from '../../world/upstairs/plan.js';
import { createPrimitives } from './primitives.js';
import {
  darkFloorMaterial,
  studioFloorMaterial,
  studioWallMaterial,
} from '../materials/BreakglassMaterials.js';

export function drawPrism(root, solid, material) {
  const shape = new Shape();
  solid.points.forEach(([x, z], index) =>
    index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z),
  );
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: solid.y2 - solid.y1, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = solid.id;
  mesh.position.y = solid.y1;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

export function buildUpstairsBlockout(root, definition) {
  const wallMaterial = studioWallMaterial();
  const woodFloor = studioFloorMaterial();
  const circulationFloor = studioFloorMaterial({ dark: true });
  const serviceFloor = darkFloorMaterial();
  const { mat, box, label } = createPrimitives();
  for (const [i, room] of definition.rooms.entries()) {
    let roomMaterial = woodFloor;
    if (['circulation', 'emergency-hall', 'east-hall'].includes(room.id))
      roomMaterial = circulationFloor;
    if (['storage'].includes(room.id)) roomMaterial = serviceFloor;
    drawPrism(root, { ...room, y1: -0.25, y2: i === 0 ? 0 : 0.004 + i * 0.0003 }, roomMaterial);
    if (room.label) label(root, room.name.toUpperCase(), ...room.label, 0.65, '#fff3d6');
  }
  for (const solid of definition.solids) {
    if (solid.kind === 'equipment' || solid.kind === 'platform') continue;
    const mesh = drawPrism(root, solid, solid.color ? mat(solid.color) : wallMaterial);
    mesh.userData.collisionId = solid.id;
    if (solid.label)
      label(
        root,
        solid.name.toUpperCase(),
        ...solid.label,
        solid.id === 'central-closed-suite' ? 0.76 : 0.4,
        '#eff4e7',
      );
  }
  for (const door of definition.doors) {
    const width = Math.hypot(door.b[0] - door.a[0], door.b[1] - door.a[1]);
    const group = new Group();
    group.position.set(door.center[0], 0, door.center[1]);
    group.rotation.y = -Math.atan2(door.b[1] - door.a[1], door.b[0] - door.a[0]);
    root.add(group);
    box(group, width, 0.035, 0.45, mat(0xdcb671), 0, 0.025, 0);
    for (const x of [-width / 2, width / 2])
      box(group, 0.07, 2.45, 0.3, mat(0xc2924e), x, 1.225, 0);
    label(root, door.name.toUpperCase(), door.center[0], 3.2, door.center[1], 0.38, '#ffe3a7');
  }
}

export function buildUpstairsFixtures(root, definition) {
  if (definition.pass === 'B') {
    const { mat } = createPrimitives();
    for (const p of definition.platforms) drawPrism(root, p, mat(p.color));
    buildStudioEquipment(root, definition);
    buildSelectableStudioGear(root, definition);
    buildLandmarks(root, definition);
    return;
  }
  // Pass A: musical anchors get only simple physical markers, no decorative clutter.
  const { box, mat, label } = createPrimitives();
  for (const [id, anchor] of Object.entries(definition.anchors)) {
    if (id === 'stairs') continue;
    const [x, y, z] = anchor.position;
    box(root, 1.2, 0.5, 0.8, mat(id === 'console' ? 0x597b91 : 0x6d5048), x, y + 0.25, z - 0.8);
    label(root, anchor.name.toUpperCase(), x, y + 1.7, z, 0.36);
  }
}

function buildLandmarks(root, definition) {
  const { box, mat, label } = createPrimitives();
  const trim = mat(0xd0ae6c),
    dark = mat(0x203f43),
    blue = mat(0x435d70);
  for (const material of [trim, dark]) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
  }
  // The historic Neve Suite deliberately has no game ceiling or roof slab. Its tall faceted
  // wall silhouette remains, but the third-person camera can look directly into the room.
  for (const [i, a] of definition.centralSuite.points.entries()) {
    const b = definition.centralSuite.points[(i + 1) % definition.centralSuite.points.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const strip = box(root, length, 0.045, 0.035, trim, (a[0] + b[0]) / 2, 0.35, (a[1] + b[1]) / 2);
    strip.rotation.y = -Math.atan2(dz, dx);
  }
  // Shallow floor marks indicate a continuous gallery, not painted false doors.
  for (const [px, pz] of [
    [720, 986],
    [725, 947],
    [713, 898],
    [671, 898],
    [574, 909],
    [536, 939],
    [522, 884],
    [512, 823],
    [493, 787],
    [468, 735],
    [424, 720],
    [376, 722],
    [353, 766],
    [352, 867],
    [351, 926],
    [385, 980],
    [459, 980],
    [516, 975],
  ]) {
    const [x, , z] = at(px, pz);
    box(root, 0.16, 0.018, 0.16, trim, x, 0.023, z);
  }
  for (const p of definition.platforms) {
    const x = (p.x1 + p.x2) / 2,
      z = (p.z1 + p.z2) / 2,
      w = p.x2 - p.x1,
      d = p.z2 - p.z1;
    if (p.id.includes('case') || p.id === 'storage-perch') {
      for (const side of [-1, 1])
        box(root, 0.04, p.y2, 0.035, trim, x + side * (w / 2 - 0.03), p.y2 / 2, z - d / 2 - 0.005);
      box(root, w, 0.045, d, mat(0xb4ada0), x, p.y2 - 0.025, z);
      box(root, 0.24, 0.08, 0.025, dark, x, p.y2 * 0.5, z - d / 2 - 0.015);
    }
  }
  for (const step of definition.stairFloors) {
    const x = step.points[1][0],
      z = (step.points[0][1] + step.points[3][1]) / 2;
    box(
      root,
      0.055,
      0.015,
      step.points[3][1] - step.points[0][1],
      trim,
      x - 0.025,
      step.y2 + 0.008,
      z,
    );
  }
  // Closed panels are visibly sealed; all open, gold-framed doors are compiled gaps.
  for (const suite of definition.closedSuites) {
    const x = suite.points[0][0] - 0.014,
      z = (suite.points[0][1] + suite.points[3][1]) / 2;
    box(root, 0.024, 1.9, 0.88, dark, x, 0.95, z);
    box(root, 0.03, 0.04, 0.64, trim, x - 0.008, 1.42, z);
  }
  const [ex, , ez] = at(720, 1038);
  box(root, 1.9, 2.2, 0.06, dark, ex, 1.1, ez);
  box(root, 1.9, 0.11, 0.07, trim, ex, 2.15, ez - 0.02);
  label(root, 'MAIN ENTRY', ex, 2.75, ez, 0.5, '#d8f0df');
  const [cx, , cz] = at(144, 958);
  label(root, '↓ BELOW', cx, 2.1, cz, 0.65, '#ead1f0');
  for (const [px, pz, text] of [
    [713, 907, 'LIVE ROOM ←'],
    [531, 939, '↶ POLYGON LOOP'],
  ]) {
    const [x, , z] = at(px, pz);
    label(root, text, x, 2.4, z, 0.4, '#ffe0a1');
  }
  // Reference-derived alternating acoustic panels; kept against the walls.
  for (const px of [208, 249, 290]) {
    const [x, , z] = at(px, 686);
    box(root, 1.1, 1.65, 0.12, blue, x, 1.6, z);
  }
  for (const pz of [550, 590, 630]) {
    const [x, , z] = at(447, pz);
    box(root, 0.1, 1.9, 1.2, mat(0x8b6846), x, 1.7, z);
  }

  // The Live Room doubles as the archive screening room after a session is loaded on the Neve.
  // The screen is GAME hardware, not a claim about permanent present-day installation.
  const [sx, , sz] = at(620, 535);
  box(root, 3.8, 2.2, 0.11, dark, sx, 1.72, sz);
  box(root, 3.42, 1.82, 0.035, mat(0xdce2de, 0.55, 0.01), sx, 1.72, sz + 0.07);
  box(root, 0.15, 0.82, 0.15, dark, sx, 0.43, sz + 0.02);
  box(root, 1.3, 0.08, 0.72, dark, sx, 0.04, sz + 0.1);
  label(root, 'LIVE FROM BREAKGLASS', sx, 3.15, sz + 0.08, 0.42, '#e9f2ee');
  label(root, 'LOAD SESSION ON NEVE', sx, 2.78, sz + 0.08, 0.26, '#d0ae6c');
}
