import { DoubleSide, Mesh, MeshStandardMaterial, RingGeometry } from 'three';
import { createPrimitives } from './primitives.js';
import { buildRealisticDjBooth } from './djBoothRealism.js';
import {
  clubFloorMaterial,
  clubWallMaterial,
  darkFloorMaterial,
} from '../materials/BreakglassMaterials.js';

// Preserved V2.1 blockout proportions; visual treatment now follows supplied club references.
export function buildBelowBlockout(downScene) {
  const { mat, box, label, floor, doorwayFrame } = createPrimitives();
  const mainFloor = clubFloorMaterial();
  const serviceFloor = darkFloorMaterial();
  const wallMaterial = clubWallMaterial();
  const wall = (x, z, w, d, h = 3.2) => box(downScene, w, h, d, wallMaterial, x, h / 2, z);

  floor(downScene, 0, 0, 12.2, 7.0, mainFloor);
  wall(-1.275, -3.5, 9.65, 0.24);
  wall(5.875, -3.5, 0.45, 0.24);
  doorwayFrame(downScene, 4.6, -3.38, 'horizontal', 'CLARK EMERGENCY');

  // The Clark stair used to be hidden behind a continuous west wall. Split the wall around a
  // generous opening so the relationship between club and studio reads immediately.
  // West wall now has two explicit openings: one into the bar and one onto the Clark stair.
  wall(-6.1, -2.8, 0.24, 1.4);
  wall(-6.1, -0.05, 0.24, 1.0);
  wall(-6.1, 2.45, 0.24, 2.1);
  doorwayFrame(downScene, -5.98, -1.34, 'vertical', 'STUDIO ↑');
  doorwayFrame(downScene, -5.98, 0.92, 'vertical', 'BAR');

  // East wall now has one intentional club opening: the doorway into Take A Break.
  // The old lower service opening was the confusing invisible/ghost door and is sealed.
  wall(6.1, -1.075, 0.24, 4.85);
  wall(6.1, 3.15, 0.24, 0.7);
  doorwayFrame(downScene, 5.98, 2.05, 'vertical', 'TAKE A BREAK');
  wall(0, 3.5, 12.2, 0.24);

  // West room: kitchen + bar. The original shell is preserved but its function is swapped.
  floor(downScene, -8.1, 1.7, 3.8, 4.3, mat(0x4d2f2d));
  wall(-10, 1.7, 0.24, 4.3);
  wall(-8.1, 3.85, 3.8, 0.24);
  wall(-8.1, -0.45, 3.8, 0.24);
  wall(-6.2, 2.6, 0.24, 2.5);
  box(downScene, 0.95, 0.035, 0.88, mat(0xb75c50), -6.08, 0.018, 0.9);
  label(downScene, 'KITCHEN + BAR', -8.1, 2.9, 1.7, 0.42);

  floor(downScene, -1.6, 5.1, 7.0, 2.7, serviceFloor);
  wall(-1.6, 6.45, 7, 0.24);
  wall(-5.1, 5.1, 0.24, 2.7);
  wall(1.9, 5.1, 0.24, 2.7);
  label(downScene, 'STORAGE', -1.6, 2.8, 5.1, 0.4);

  // East side: Take A Break now occupies most of the room entered directly from the club.
  // The smaller room beside it becomes Nora's photo / production room and keeps the wall space.
  floor(downScene, 7.65, 3.6, 2.8, 5.6, mat(0x5e4331));
  floor(downScene, 7.65, -1.05, 2.8, 3.7, serviceFloor);
  wall(9.05, 1.7, 0.24, 9.4);
  wall(7.65, 6.4, 2.8, 0.24);
  wall(7.65, -2.9, 2.8, 0.24);
  // Divider between Take A Break and the photo room, with a real internal doorway at the west edge.
  wall(8.25, 0.8, 1.6, 0.24);
  doorwayFrame(downScene, 6.72, 0.8, 'horizontal', 'PHOTO ROOM');
  box(downScene, 0.95, 0.035, 1.28, mat(0xc58a66), 6.08, 0.018, 2.05);
  label(downScene, 'TAKE A BREAK', 7.65, 2.55, 3.9, 0.32);
  label(downScene, 'NORA PHOTO ROOM', 7.65, 2.55, -1.05, 0.27);

  floor(downScene, 4.6, -4.65, 2.3, 1.9, serviceFloor);
  wall(3.45, -4.65, 0.24, 1.9);
  wall(5.75, -4.65, 0.24, 1.9);
  wall(3.78, -5.6, 0.66, 0.24);
  wall(5.42, -5.6, 0.66, 0.24);
  doorwayFrame(downScene, 4.6, -5.48, 'horizontal', 'ALLEY');
  label(downScene, 'COAT CHECK', 4.6, 2.2, -4.0, 0.31);
  label(downScene, 'EMERGENCY EXIT · CLARK', 4.6, 2.85, -5.34, 0.31, '#ffd7ad');

  const stairMaterial = mat(0x57463b, 0.86, 0.02);
  for (let i = 0; i < 6; i++) {
    const height = 0.12 * (i + 1);
    box(downScene, 1.55, height, 0.31, stairMaterial, 4.6, height / 2, -3.58 - i * 0.31);
  }
  const rail = mat(0x2c3035, 0.52, 0.18);
  for (const x of [3.76, 5.44]) box(downScene, 0.06, 1.05, 1.9, rail, x, 0.65, -4.45);

  // Wide Clark stair to the studio. The navigable ramp in levels.js follows this visible run.
  const studioStep = mat(0x66564a, 0.88, 0.02);
  const studioRail = mat(0x3a3f43, 0.5, 0.2);
  for (let i = 0; i < 8; i++) {
    const height = 0.105 * (i + 1);
    const z = -0.82 - i * 0.32;
    box(downScene, 2.5, height, 0.35, studioStep, -6.55, height / 2, z);
  }
  box(downScene, 2.5, 0.84, 0.42, studioStep, -6.55, 0.42, -3.34);
  for (const x of [-7.82, -5.28]) {
    box(downScene, 0.07, 1.15, 2.8, studioRail, x, 0.78, -2.0);
    box(downScene, 0.09, 0.09, 2.95, studioRail, x, 1.32, -2.0).rotation.x = -0.23;
  }
  doorwayFrame(downScene, -6.55, -3.45, 'horizontal', 'STUDIO ↑ · ALLEY ↓');
  label(downScene, 'STAIRS ↑ STUDIO', -6.55, 2.35, -3.1, 0.36, '#d8c1ff');

  // The shared west stair turns at its bottom landing and continues physically down to the alley.
  // This replaces the old abstract passage button with readable stair architecture.
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
}

export function buildBelowFixtures(downScene) {
  const { mat, MAT, box, cyl, label } = createPrimitives();

  buildRealisticDjBooth(downScene);

  const ring = new Mesh(
    new RingGeometry(1.8, 2.35, 64),
    new MeshStandardMaterial({
      color: 0x111015,
      roughness: 0.72,
      metalness: 0.02,
      side: DoubleSide,
    }),
  );
  ring.name = 'below-floor-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-0.3, 0.012, 0.25);
  ring.receiveShadow = true;
  downScene.add(ring);

  for (const [x, z] of [
    [-5.25, -2.8],
    [-5.25, 2.8],
    [5.25, -2.8],
    [5.25, 2.8],
  ]) {
    box(downScene, 0.7, 1.48, 0.72, MAT.speaker, x, 0.74, z);
    box(downScene, 0.54, 0.08, 0.54, mat(0x1f1f1f), x, 1.08, z - 0.37);
  }
  cyl(downScene, 0.72, 0.62, MAT.speaker, -1.7, 0.31, -0.3);

  const slat = mat(0x7a5539, 0.86, 0.01);
  for (let i = 0; i < 23; i++) {
    const x = -4.5 + i * 0.4;
    box(downScene, 0.09, 2.35, 0.09, slat, x, 1.45, 3.34);
  }

  const truss = mat(0x111012, 0.55, 0.24);
  for (const z of [-2.2, -0.75, 0.7, 2.15]) {
    box(downScene, 10.8, 0.12, 0.14, truss, 0, 3.02, z);
    for (const x of [-4.3, -2.15, 0, 2.15, 4.3]) {
      box(downScene, 0.22, 0.16, 0.26, MAT.dark, x, 2.88, z);
      box(downScene, 0.035, 0.25, 0.035, mat(0x595d62, 0.5, 0.25), x, 2.72, z);
    }
  }
  for (const x of [-4.8, -1.6, 1.6, 4.8])
    box(downScene, 0.035, 0.035, 6.2, mat(0x25262a, 0.68, 0.12), x, 3.14, 0);

  // Zander is a progression key, so his name stays visible even before the player walks into
  // the normal interaction radius.
  label(downScene, 'ZANDER', -5.42, 2.42, -1.42, 0.32, '#d9ffe9');

  // David's storage room is intentionally dense: old furniture, paintings and studio overflow.
  // The club-facing opening looks like a wall of furniture until David explains the passage.
  const storageWood = mat(0x5a4030, 0.9, 0.02);
  const storageFabric = mat(0x57464e, 0.96, 0.01);
  const storageGold = mat(0xa68445, 0.66, 0.05);
  const storageDark = mat(0x242326, 0.92, 0.02);
  for (const [x, z, w, d, h] of [
    [-4.25, 5.72, 1.25, 0.58, 0.72],
    [-2.65, 5.55, 1.65, 0.68, 0.78],
    [-0.55, 5.82, 1.35, 0.62, 0.74],
    [0.95, 5.4, 1.0, 0.55, 0.68],
    [-4.35, 4.3, 0.82, 0.82, 0.56],
    [0.72, 4.22, 0.9, 0.74, 0.62],
  ])
    box(downScene, w, h, d, storageFabric, x, h / 2, z);
  for (const [x, z, w, d] of [
    [-3.65, 4.82, 1.15, 0.55],
    [-1.72, 5.0, 1.35, 0.62],
    [0.15, 4.75, 1.05, 0.5],
  ]) {
    box(downScene, w, 0.12, d, storageWood, x, 0.72, z);
    for (const dx of [-w * 0.38, w * 0.38])
      for (const dz of [-d * 0.32, d * 0.32])
        box(downScene, 0.07, 0.68, 0.07, storageDark, x + dx, 0.34, z + dz);
  }
  for (const [x, z, r] of [
    [-4.5, 3.95, -0.25],
    [-3.7, 4.08, 0.18],
    [-0.9, 4.0, -0.15],
    [0.15, 4.05, 0.24],
  ]) {
    const seat = box(downScene, 0.52, 0.12, 0.52, storageWood, x, 0.52, z);
    seat.rotation.y = r;
    box(downScene, 0.52, 0.75, 0.12, storageWood, x, 0.88, z + 0.22).rotation.y = r;
  }
  for (const [x, y, z, w, h, color] of [
    [-4.82, 1.85, 5.2, 0.78, 1.0, 0x8c463e],
    [-2.2, 2.0, 6.15, 1.1, 0.72, 0x4f7390],
    [0.9, 1.78, 6.12, 0.82, 1.08, 0x756646],
    [1.55, 1.55, 4.9, 0.64, 0.8, 0x765376],
  ]) {
    box(downScene, w + 0.12, h + 0.12, 0.08, storageGold, x, y, z);
    box(downScene, w, h, 0.045, mat(color, 0.84, 0.02), x, y, z - 0.065);
  }
  // Disguised club-side furniture panel marking the secret route without an always-visible label.
  box(downScene, 1.4, 2.25, 0.28, storageWood, -2.15, 1.13, 3.34);
  box(downScene, 1.08, 0.18, 0.35, storageDark, -2.15, 0.55, 3.13);
  box(downScene, 0.7, 0.06, 0.36, storageGold, -2.15, 1.68, 3.16);

  // Take A Break installation/chill room. Detailed couches and loose cushions are built by
  // roomFurniture.js so the room reads as a real lounge rather than placeholder boxes.
  box(downScene, 0.08, 1.45, 2.35, mat(0xb7929f, 0.45, 0.02), 8.84, 1.55, 4.8);
  box(downScene, 0.78, 0.52, 0.78, mat(0x2b242c), 7.65, 0.26, 4.8);
  cyl(downScene, 0.19, 1.05, mat(0xd4a45f, 0.38, 0.12), 7.65, 1.03, 4.8);
  label(downScene, 'IMMERSIVE INSTALLATION', 7.65, 2.45, 5.95, 0.23, '#f2c7df');

  for (const [x, y, z, accent] of [
    [6.55, 1.25, 3.65, 0xc98696],
    [8.55, 1.45, 3.75, 0x7799a6],
    [6.55, 1.6, 5.9, 0xb69b63],
    [8.55, 1.25, 6.0, 0x81719e],
  ]) {
    box(downScene, 0.24, 0.38, 0.2, mat(0x27242b), x, y, z);
    cyl(downScene, 0.07, 0.035, mat(accent, 0.48, 0.1), x, y + 0.02, z - 0.115).rotation.x =
      Math.PI / 2;
  }

  label(downScene, 'NORA · NIGHT PHOTOS', 8.72, 3.25, -1.05, 0.24, '#f3d4df');
  for (const z of [-2.1, -1.05, 0.0])
    box(downScene, 0.08, 0.22, 0.08, mat(0x262226), 8.86, 3.05, z);

  // The studio's Mortal Kombat II cabinet. Geometry mirrors the real early-90s Midway silhouette
  // and colour language without embedding copyrighted cabinet art or game assets.
  const cabinetDark = mat(0x191a1d, 0.72, 0.06);
  const cabinetRed = mat(0x7d1e25, 0.67, 0.04);
  const cabinetGold = mat(0xd1a448, 0.46, 0.08);
  const screenMaterial = new MeshStandardMaterial({
    color: 0x11141a,
    emissive: 0x263a59,
    emissiveIntensity: 0.75,
    roughness: 0.28,
    metalness: 0.02,
  });
  box(downScene, 0.9, 1.72, 0.76, cabinetDark, -9.15, 0.86, -0.02);
  box(downScene, 0.08, 1.64, 0.78, cabinetRed, -9.58, 0.86, -0.02);
  box(downScene, 0.08, 1.64, 0.78, cabinetRed, -8.72, 0.86, -0.02);
  box(downScene, 0.82, 0.28, 0.1, cabinetRed, -9.15, 1.72, -0.405);
  box(downScene, 0.72, 0.54, 0.035, screenMaterial, -9.15, 1.31, -0.421);
  // Tiny abstract fighters make the lit CRT read as an active fighting game from across the room.
  box(downScene, 0.12, 0.3, 0.018, mat(0x2b75b6), -9.34, 1.29, -0.445);
  box(downScene, 0.12, 0.3, 0.018, mat(0xc94e3c), -8.96, 1.29, -0.445);
  box(downScene, 0.76, 0.12, 0.42, cabinetDark, -9.15, 0.92, -0.44).rotation.x = -0.16;
  cyl(downScene, 0.035, 0.18, cabinetGold, -9.36, 1.03, -0.55);
  cyl(downScene, 0.055, 0.035, mat(0xb52b2f), -9.03, 1.04, -0.57);
  cyl(downScene, 0.055, 0.035, mat(0xe0b444), -8.88, 1.04, -0.57);
  for (const x of [-9.34, -9.15, -8.96])
    box(downScene, 0.085, 0.02, 0.025, cabinetGold, x, 1.57, -0.46);
  box(downScene, 0.22, 0.07, 0.025, mat(0x642228), -9.15, 0.47, -0.41);
  label(downScene, 'MORTAL KOMBAT II', -9.15, 1.76, -0.49, 0.14, '#ffd469');
  label(downScene, 'MKII', -9.15, 2.02, -0.02, 0.2, '#d5b056');

  const counterZ = 2.55;
  box(downScene, 2.7, 1.0, 0.82, MAT.wood, -8.15, 0.5, counterZ);
  box(downScene, 2.8, 0.075, 0.9, mat(0xb18a61), -8.15, 1.025, counterZ);
  for (const x of [-9.15, -8.48, -7.81, -7.14]) {
    cyl(downScene, 0.22, 0.62, MAT.metal, x, 0.31, 1.62);
    cyl(downScene, 0.3, 0.08, mat(0x4e2729), x, 0.66, 1.62);
  }

  const shelf = mat(0x6f523d, 0.78, 0.03);
  for (const y of [1.05, 1.62, 2.19]) {
    box(downScene, 3.1, 0.07, 0.24, shelf, -8.15, y, 3.62);
    for (let i = 0; i < 10; i++) {
      const x = -9.35 + i * 0.265;
      const bottleHeight = 0.18 + ((i + Math.round(y * 10)) % 3) * 0.045;
      cyl(
        downScene,
        0.04,
        bottleHeight,
        mat([0x526a48, 0x74503c, 0x6a5178, 0x8c7646][i % 4], 0.38, 0.04),
        x,
        y + bottleHeight / 2 + 0.04,
        3.54,
      );
    }
  }

  // Espresso machine on the working side of the west-room bar.
  const steel = mat(0xa5a8a4, 0.3, 0.62);
  const coffeeDark = mat(0x242526, 0.5, 0.24);
  box(downScene, 0.78, 0.52, 0.42, steel, -9.18, 1.1, 2.55);
  box(downScene, 0.72, 0.12, 0.4, coffeeDark, -9.18, 1.41, 2.55);
  box(downScene, 0.68, 0.08, 0.34, MAT.metal, -9.18, 0.81, 2.51);
  for (const x of [-9.36, -9.0]) {
    cyl(downScene, 0.055, 0.12, coffeeDark, x, 1.16, 2.32).rotation.x = Math.PI / 2;
    cyl(downScene, 0.022, 0.2, MAT.metal, x, 0.96, 2.33);
  }
  cyl(downScene, 0.035, 0.34, MAT.metal, -8.78, 1.02, 2.48).rotation.z = 0.28;
  for (const x of [-9.4, -9.18, -8.96]) {
    cyl(downScene, 0.075, 0.09, mat(0xe0d4c2, 0.82, 0.01), x, 1.54, 2.59);
  }
  label(downScene, 'COFFEE', -9.18, 1.92, 2.55, 0.2, '#f1dfc6');

  for (const x of [-8.45, -8.08, -7.71]) {
    cyl(downScene, 0.035, 0.44, MAT.metal, x, 1.28, 2.93);
    box(downScene, 0.18, 0.05, 0.1, MAT.metal, x, 1.49, 2.89);
  }
  label(downScene, 'COURTNEY + SIMLA · BAR', -8.15, 2.62, 3.25, 0.23, '#ffc9b0');

  // House record board in the bar. Live values are shown in the interaction panel.
  box(downScene, 0.08, 1.42, 1.72, mat(0x101916, 0.52, 0.06), -9.84, 1.72, 0.92);
  box(downScene, 0.035, 1.24, 1.54, mat(0x26372f, 0.6, 0.03), -9.78, 1.72, 0.92);
  label(downScene, 'BREAKGLASS SCOREBOARD', -9.68, 2.55, 0.92, 0.19, '#d8ffd5');
  for (const z of [0.43, 0.68, 0.93, 1.18, 1.43])
    box(downScene, 0.025, 0.025, 1.2, mat(0x7ca58c, 0.7, 0.02), -9.73, 1.35, z);

  box(downScene, 1.45, 0.34, 0.08, mat(0x3f6c55, 0.45, 0.04), 4.6, 2.45, -3.33);
  label(downScene, 'EXIT', 4.6, 2.5, -3.28, 0.26, '#d9ffe3');
  label(downScene, 'STAIRS ↑ STUDIO', -6.55, 2.45, -3.18, 0.33, '#d8c1ff');
  label(downScene, 'BELOW BREAKGLASS', 0, 3.8, -3.1, 0.66);
}
