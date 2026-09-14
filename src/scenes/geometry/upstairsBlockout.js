import { ExtrudeGeometry, Group, Mesh, Shape } from 'three';
import { buildStudioEquipment } from './upstairsFixtures.js';
import { buildSelectableStudioGear } from './studioGearProps.js';
import { at } from '../../world/upstairs/plan.js';
import { createPrimitives } from './primitives.js';
import {
  acousticFabricMaterial,
  controlRoomFloorMaterial,
  controlRoomWallMaterial,
  corridorFloorMaterial,
  darkFloorMaterial,
  deadRoomFloorMaterial,
  kitchenFloorMaterial,
  liveRoomFloorMaterial,
  studioFloorMaterial,
  studioGlassMaterial,
  studioWallMaterial,
  woodSlatMaterial,
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

function floorMaterialFor(room) {
  if (room.id === 'mixing-suite' || room.id === 'neve-suite') return controlRoomFloorMaterial();
  if (room.id === 'live-room') return liveRoomFloorMaterial();
  if (room.id === 'dead-room') return deadRoomFloorMaterial();
  if (room.id === 'bar-kitchen') return kitchenFloorMaterial();
  if (['circulation', 'emergency-hall', 'east-hall', 'entry', 'clark-stair'].includes(room.id))
    return corridorFloorMaterial();
  if (room.id === 'storage') return darkFloorMaterial();
  return studioFloorMaterial();
}

function wallMaterialFor(solid, shared) {
  if (solid.kind === 'stair') return shared.stair;
  if (solid.id?.startsWith('neve-')) return shared.control;
  if (solid.id?.includes('mixing')) return shared.control;
  if (solid.id?.includes('dead')) return shared.cool;
  if (solid.id?.includes('bar')) return shared.warm;
  if (solid.id?.includes('closed') || solid.id?.startsWith('adjacent-')) return shared.closed;
  return shared.wall;
}

function buildPlanWindows(root) {
  const { box, mat } = createPrimitives();
  const glass = studioGlassMaterial();
  const frame = mat(0x3e4547, 0.55, 0.12);

  const horizontalWindow = (x1, x2, pz, y = 1.55, height = 1.28) => {
    const [ax, , z] = at(x1, pz);
    const [bx] = at(x2, pz);
    const width = Math.abs(bx - ax);
    const cx = (ax + bx) / 2;
    box(root, width, height, 0.045, glass, cx, y, z + 0.16);
    for (const x of [ax, bx]) box(root, 0.07, height + 0.14, 0.08, frame, x, y, z + 0.15);
    box(root, width + 0.08, 0.07, 0.08, frame, cx, y - height / 2, z + 0.15);
    box(root, width + 0.08, 0.07, 0.08, frame, cx, y + height / 2, z + 0.15);
    const panes = Math.max(1, Math.round(width / 2.8));
    for (let i = 1; i < panes; i++) {
      const x = ax + ((bx - ax) * i) / panes;
      box(root, 0.045, height, 0.07, frame, x, y, z + 0.145);
    }
  };

  const verticalWindow = (px, z1, z2, y = 1.55, height = 1.28) => {
    const [x, , az] = at(px, z1);
    const [, , bz] = at(px, z2);
    const depth = Math.abs(bz - az);
    const cz = (az + bz) / 2;
    box(root, 0.045, height, depth, glass, x + 0.16, y, cz);
    for (const z of [az, bz]) box(root, 0.08, height + 0.14, 0.07, frame, x + 0.15, y, z);
    box(root, 0.08, 0.07, depth + 0.08, frame, x + 0.15, y - height / 2, cz);
    box(root, 0.08, 0.07, depth + 0.08, frame, x + 0.15, y + height / 2, cz);
    const panes = Math.max(1, Math.round(depth / 2.8));
    for (let i = 1; i < panes; i++) {
      const z = az + ((bz - az) * i) / panes;
      box(root, 0.07, height, 0.045, frame, x + 0.145, y, z);
    }
  };

  // Window runs are simplified from the visible A-103 exterior glazing. They preserve the
  // facade rhythm without pretending every mullion dimension was surveyed.
  horizontalWindow(267, 420, 518);
  horizontalWindow(476, 650, 518);
  horizontalWindow(716, 820, 518);
  verticalWindow(172, 704, 900);
}

function buildArchitecturalFinish(root) {
  const { box, mat } = createPrimitives();
  const baseboard = mat(0x4f4338, 0.84, 0.01);
  const trim = mat(0x9d7d57, 0.78, 0.02);

  // Low trim lines make the traced walls read as rooms instead of level-editor solids.
  for (const [a, b] of [
    [
      [242, 518],
      [242, 668],
    ],
    [
      [443, 518],
      [443, 692],
    ],
    [
      [172, 678],
      [172, 938],
    ],
    [
      [704, 665],
      [704, 874],
    ],
    [
      [706, 639],
      [842, 639],
    ],
    [
      [345, 995],
      [519, 995],
    ],
  ]) {
    const [ax, , az] = at(...a);
    const [bx, , bz] = at(...b);
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    const piece = box(root, length, 0.11, 0.055, baseboard, (ax + bx) / 2, 0.055, (az + bz) / 2);
    piece.rotation.y = -Math.atan2(dz, dx);
  }

  // Control-room fabric absorbers and warm wood treatment follow the supplied 2026/2025 room
  // references. Exact panel count/placement remains modular rather than asserted as surveyed.
  const controlFabric = acousticFabricMaterial([58, 76, 84]);
  for (const px of [202, 230, 258, 286, 314]) {
    const [x, , z] = at(px, 685);
    box(root, 1.0, 1.6, 0.14, controlFabric, x, 1.52, z + 0.08);
  }
  const wood = woodSlatMaterial();
  for (const pz of [548, 573, 598, 623, 648]) {
    const [x, , z] = at(447, pz);
    box(root, 0.12, 1.95, 0.82, wood, x + 0.08, 1.58, z);
  }

  // Small practical details around Mixing Suite A give the west side the visual density seen in
  // current control-room photos without inventing new architecture.
  const [rackX, , rackZ] = at(181, 720);
  box(root, 0.14, 1.1, 1.5, trim, rackX + 0.1, 0.62, rackZ);
  const [railX, , railZ] = at(175, 915);
  box(root, 0.08, 0.08, 4.1, trim, railX + 0.12, 0.82, railZ - 0.25);
}

export function buildUpstairsBlockout(root, definition) {
  const shared = {
    wall: studioWallMaterial(),
    warm: studioWallMaterial({ warm: true }),
    cool: studioWallMaterial({ warm: false }),
    control: controlRoomWallMaterial(),
    closed: studioWallMaterial({ dark: true, warm: false }),
    stair: studioWallMaterial({ dark: true, warm: true }),
  };
  const { mat, box, label } = createPrimitives();

  for (const [i, room] of definition.rooms.entries()) {
    drawPrism(
      root,
      { ...room, y1: -0.25, y2: i === 0 ? 0 : 0.004 + i * 0.0003 },
      floorMaterialFor(room),
    );
    // Room names remain available as subtle wayfinding rather than dominating the architecture.
    if (room.label) label(root, room.name.toUpperCase(), ...room.label, 0.44, '#e8dfcf');
  }

  for (const solid of definition.solids) {
    if (solid.kind === 'equipment' || solid.kind === 'platform') continue;
    const mesh = drawPrism(root, solid, wallMaterialFor(solid, shared));
    mesh.userData.collisionId = solid.id;
    if (solid.label) label(root, solid.name.toUpperCase(), ...solid.label, 0.3, '#c9d1cb');
  }

  for (const door of definition.doors) {
    const width = Math.hypot(door.b[0] - door.a[0], door.b[1] - door.a[1]);
    const group = new Group();
    group.position.set(door.center[0], 0, door.center[1]);
    group.rotation.y = -Math.atan2(door.b[1] - door.a[1], door.b[0] - door.a[0]);
    root.add(group);
    const threshold = mat(0x795d42, 0.8, 0.02);
    const jamb = mat(0x5b4736, 0.78, 0.02);
    box(group, width, 0.028, 0.38, threshold, 0, 0.018, 0);
    for (const x of [-width / 2, width / 2]) box(group, 0.065, 2.42, 0.24, jamb, x, 1.21, 0);
    box(group, width + 0.06, 0.065, 0.24, jamb, 0, 2.39, 0);
  }

  buildPlanWindows(root);
  buildArchitecturalFinish(root);
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
  const trim = mat(0x9f8157),
    dark = mat(0x203f43);
  for (const material of [trim, dark]) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
  }

  // Historic Neve Suite stays intentionally open-topped for camera visibility.
  for (const [i, a] of definition.centralSuite.points.entries()) {
    const b = definition.centralSuite.points[(i + 1) % definition.centralSuite.points.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const strip = box(root, length, 0.045, 0.035, trim, (a[0] + b[0]) / 2, 0.35, (a[1] + b[1]) / 2);
    strip.rotation.y = -Math.atan2(dz, dx);
  }

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
    box(root, 0.12, 0.012, 0.12, trim, x, 0.018, z);
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

  for (const suite of definition.closedSuites) {
    const x = suite.points[0][0] - 0.014,
      z = (suite.points[0][1] + suite.points[3][1]) / 2;
    box(root, 0.024, 1.9, 0.88, dark, x, 0.95, z);
    box(root, 0.03, 0.04, 0.64, trim, x - 0.008, 1.42, z);
  }

  const [ex, , ez] = at(720, 1038);
  box(root, 1.9, 2.2, 0.06, dark, ex, 1.1, ez);
  box(root, 1.9, 0.11, 0.07, trim, ex, 2.15, ez - 0.02);
  label(root, 'MAIN ENTRY', ex, 2.65, ez, 0.36, '#d8f0df');
  const [cx, , cz] = at(144, 958);
  label(root, '↓ BELOW', cx, 2.0, cz, 0.46, '#ead1f0');

  const [sx, , sz] = at(620, 535);
  box(root, 3.8, 2.2, 0.11, dark, sx, 1.72, sz);
  box(root, 3.42, 1.82, 0.035, mat(0xdce2de, 0.55, 0.01), sx, 1.72, sz + 0.07);
  box(root, 0.15, 0.82, 0.15, dark, sx, 0.43, sz + 0.02);
  box(root, 1.3, 0.08, 0.72, dark, sx, 0.04, sz + 0.1);
  label(root, 'LIVE FROM BREAKGLASS', sx, 3.02, sz + 0.08, 0.34, '#e9f2ee');
}
