import { Group } from 'three';
import { createPrimitives } from './primitives.js';

function couch(root, primitives, { x, z, width, depth = 0.9, rotation = 0, color = 0x4c4544 }) {
  const { box, mat } = primitives;
  const group = new Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  group.name = 'studio-couch';
  root.add(group);
  const fabric = mat(color, 0.94, 0.01);
  const darkFabric = mat(Math.max(0, color - 0x080808), 0.96, 0.01);
  const wood = mat(0x3b3029, 0.86, 0.03);
  box(group, width, 0.27, depth, fabric, 0, 0.33, 0);
  box(group, width, 0.52, 0.2, darkFabric, 0, 0.69, depth / 2 - 0.1);
  for (const side of [-1, 1]) {
    box(group, 0.18, 0.43, depth, darkFabric, (side * (width - 0.18)) / 2, 0.43, 0);
    box(group, 0.1, 0.17, 0.1, wood, (side * (width - 0.3)) / 2, 0.085, -depth * 0.28);
  }
  const cushionWidth = Math.max(0.42, (width - 0.42) / Math.max(2, Math.round(width / 0.9)));
  const count = Math.max(2, Math.round(width / 0.9));
  for (let i = 0; i < count; i++) {
    const px = -width / 2 + 0.28 + cushionWidth / 2 + i * cushionWidth;
    box(group, cushionWidth - 0.045, 0.12, depth - 0.28, fabric, px, 0.53, -0.05);
  }
  return group;
}

function floorCushion(root, primitives, x, z, color, rotation = 0) {
  const { box, mat } = primitives;
  const cushion = box(root, 0.7, 0.2, 0.62, mat(color, 0.98, 0), x, 0.11, z);
  cushion.rotation.y = rotation;
  cushion.scale.set(1, 0.82, 1);
  return cushion;
}

export function buildStudioFurniture(root, definition) {
  const primitives = createPrimitives();
  const { box, mat } = primitives;
  for (const fixture of definition.fixtures ?? []) {
    if (!fixture.id?.startsWith('mix-sofa-') && fixture.id !== 'mix-coffee-table') continue;
    const x = (fixture.x1 + fixture.x2) / 2;
    const z = (fixture.z1 + fixture.z2) / 2;
    const fixtureWidth = fixture.x2 - fixture.x1;
    const fixtureDepth = fixture.z2 - fixture.z1;
    if (fixture.id.startsWith('mix-sofa-')) {
      const side = fixture.id.endsWith('side');
      couch(root, primitives, {
        x,
        z,
        width: side ? fixtureDepth : fixtureWidth,
        depth: side ? fixtureWidth : fixtureDepth,
        rotation: fixture.rotationY ?? 0,
        color: side ? 0x62514a : 0x4d4746,
      }).name = fixture.id;
    } else {
      const table = box(
        root,
        fixtureWidth,
        0.12,
        fixtureDepth,
        mat(0x6c4f39, 0.76, 0.04),
        x,
        0.34,
        z,
      );
      table.name = fixture.id;
      for (const dx of [-fixtureWidth * 0.38, fixtureWidth * 0.38])
        for (const dz of [-fixtureDepth * 0.32, fixtureDepth * 0.32])
          box(root, 0.07, 0.32, 0.07, mat(0x302b29, 0.82, 0.04), x + dx, 0.16, z + dz);
    }
  }

  // A few small domestic details make the working control room read as a real long-session room.
  box(root, 0.36, 0.06, 0.36, mat(0x2f3438, 0.75, 0.08), -12.1, 0.43, -2.55);
  box(root, 0.11, 0.28, 0.11, mat(0xd4b77b, 0.54, 0.04), -12.1, 0.6, -2.55);
}

export function buildTakeABreakFurniture(root) {
  const primitives = createPrimitives();
  const { box, cyl, mat } = primitives;

  couch(root, primitives, {
    x: 7.65,
    z: 4.02,
    width: 2.18,
    depth: 0.78,
    color: 0x713e45,
  }).name = 'take-a-break-main-couch';

  couch(root, primitives, {
    x: 7.65,
    z: 5.88,
    width: 2.18,
    depth: 0.72,
    color: 0x504452,
    rotation: Math.PI,
  }).name = 'take-a-break-back-couch';

  const cushionData = [
    [6.72, 4.68, 0x9f6a73, -0.2],
    [8.47, 4.75, 0x6d718f, 0.18],
    [7.58, 5.25, 0xb28b58, -0.08],
  ];
  cushionData.forEach(([x, z, color, rotation], index) => {
    const cushion = floorCushion(root, primitives, x, z, color, rotation);
    cushion.name = `take-a-break-cushion-${index + 1}`;
  });

  box(root, 0.66, 0.1, 0.5, mat(0x594431, 0.83, 0.03), 6.72, 0.27, 5.48);
  for (const x of [6.55, 6.89]) box(root, 0.06, 0.25, 0.06, mat(0x2f2c2d), x, 0.125, 5.48);
  cyl(root, 0.09, 0.9, mat(0x3b3b40, 0.56, 0.15), 8.62, 0.46, 5.82);
  cyl(root, 0.28, 0.18, mat(0xc89062, 0.5, 0.02), 8.62, 1.02, 5.82);
}

export const TAKE_A_BREAK_SEATS = [
  [6.72, 0, 4.68],
  [8.47, 0, 4.75],
  [7.58, 0, 5.25],
];
