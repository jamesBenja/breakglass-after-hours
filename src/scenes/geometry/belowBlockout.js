import { DoubleSide, Mesh, MeshStandardMaterial, RingGeometry } from 'three';
import { createPrimitives } from './primitives.js';
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
  doorwayFrame(downScene, 4.6, -3.38, 'horizontal', 'ALLEY / COAT CHECK');

  // The Clark stair used to be hidden behind a continuous west wall. Split the wall around a
  // generous opening so the relationship between club and studio reads immediately.
  wall(-6.1, -0.55, 0.24, 1.3);
  wall(-6.1, 2.45, 0.24, 2.1);
  wall(6.1, -2.825, 0.24, 1.35);
  wall(6.1, 1.475, 0.24, 4.05);
  wall(0, 3.5, 12.2, 0.24);

  floor(downScene, -8.1, 1.7, 3.8, 4.3, mat(0x5e4331));
  wall(-10, 1.7, 0.24, 4.3);
  wall(-8.1, 3.85, 3.8, 0.24);
  wall(-8.1, -0.45, 3.8, 0.24);
  wall(-6.2, 2.6, 0.24, 2.5);
  box(downScene, 0.95, 0.035, 1.28, mat(0xc58a66), -6.08, 0.018, 0.76);
  label(downScene, 'TAKE A BREAK', -8.1, 2.9, 1.7, 0.45);

  floor(downScene, -1.6, 5.1, 7.0, 2.7, serviceFloor);
  wall(-1.6, 6.45, 7, 0.24);
  wall(-5.1, 5.1, 0.24, 2.7);
  wall(1.9, 5.1, 0.24, 2.7);
  label(downScene, 'STORAGE', -1.6, 2.8, 5.1, 0.4);

  floor(downScene, 7.65, 4.8, 2.8, 3.2, serviceFloor);
  floor(downScene, 7.65, 1.5, 2.8, 2.6, serviceFloor);
  floor(downScene, 7.65, -1.4, 2.8, 3.0, mat(0x4d2f2d));
  wall(9.05, 1.7, 0.24, 9.4);
  wall(7.65, 6.4, 2.8, 0.24);
  wall(7.65, -2.9, 2.8, 0.24);
  box(downScene, 0.95, 0.035, 1.28, mat(0xb75c50), 6.08, 0.018, -1.3);
  label(downScene, 'KITCHEN + BAR', 7.65, 2.55, 4.8, 0.3);
  label(downScene, 'PRODUCTION', 7.65, 2.55, 1.5, 0.3);
  label(downScene, 'SERVICE', 7.65, 2.55, -1.4, 0.32);

  floor(downScene, 4.6, -4.65, 2.3, 1.9, serviceFloor);
  wall(3.45, -4.65, 0.24, 1.9);
  wall(5.75, -4.65, 0.24, 1.9);
  wall(3.78, -5.6, 0.66, 0.24);
  wall(5.42, -5.6, 0.66, 0.24);
  doorwayFrame(downScene, 4.6, -5.48, 'horizontal', 'ALLEY');
  label(downScene, 'COAT CHECK', 4.6, 2.2, -4.0, 0.31);
  label(downScene, 'ALLEY / EXIT ↑', 4.6, 2.85, -5.34, 0.36, '#ffd7ad');

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
  doorwayFrame(downScene, -6.55, -3.45, 'horizontal', 'UPSTAIRS / STUDIO');
}

export function buildBelowFixtures(downScene) {
  const { mat, MAT, box, cyl, label } = createPrimitives();

  box(downScene, 3.7, 0.16, 1.75, mat(0x2d2725), 1.5, 0.08, -2.42);
  box(downScene, 1.7, 0.1, 0.42, mat(0x4a3a31), 1.5, 0.05, -1.38);
  box(downScene, 3.0, 1.0, 1.2, MAT.wood, 1.5, 0.66, -2.45);
  box(downScene, 0.95, 0.13, 0.52, MAT.dark, 0.55, 1.18, -2.45);
  box(downScene, 0.95, 0.13, 0.52, MAT.dark, 2.45, 1.18, -2.45);
  box(downScene, 0.8, 0.17, 0.55, MAT.metal, 1.5, 1.18, -2.45);
  for (const x of [0.55, 2.45]) {
    cyl(downScene, 0.22, 0.055, mat(0x5d6269, 0.36, 0.5), x, 1.27, -2.45);
    cyl(downScene, 0.08, 0.06, MAT.dark, x, 1.3, -2.45);
  }
  for (let i = 0; i < 4; i++) {
    const x = 1.27 + i * 0.15;
    box(downScene, 0.025, 0.035, 0.35, mat(0xb6b4aa), x, 1.28, -2.45);
  }
  box(downScene, 0.48, 0.42, 0.34, MAT.speaker, 3.25, 1.28, -2.55);
  label(downScene, 'DJ BOOTH', 1.5, 2.05, -2.5, 0.36);

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

  // Take A Break installation/chill room. Detailed couches and loose cushions are built by
  // roomFurniture.js so the room reads as a real lounge rather than placeholder boxes.
  box(downScene, 0.08, 1.45, 2.35, mat(0xb7929f, 0.45, 0.02), -9.76, 1.55, 1.85);
  box(downScene, 0.78, 0.52, 0.78, mat(0x2b242c), -8.72, 0.26, 1.85);
  cyl(downScene, 0.19, 1.05, mat(0xd4a45f, 0.38, 0.12), -8.72, 1.03, 1.85);
  label(downScene, 'IMMERSIVE INSTALLATION', -8.9, 2.45, 1.85, 0.25, '#f2c7df');

  for (const [x, y, z, accent] of [
    [-9.15, 1.25, 0.35, 0xc98696],
    [-7.05, 1.45, 0.55, 0x7799a6],
    [-9.2, 1.6, 2.95, 0xb69b63],
    [-7.0, 1.25, 3.0, 0x81719e],
  ]) {
    box(downScene, 0.24, 0.38, 0.2, mat(0x27242b), x, y, z);
    cyl(downScene, 0.07, 0.035, mat(accent, 0.48, 0.1), x, y + 0.02, z - 0.115).rotation.x =
      Math.PI / 2;
  }

  label(downScene, 'NORA · NIGHT PHOTOS', -8.1, 3.32, 3.67, 0.27, '#f3d4df');
  for (const x of [-9.18, -8.13, -7.08])
    box(downScene, 0.08, 0.22, 0.08, mat(0x262226), x, 3.15, 3.68);

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

  const counterZ = 4.42;
  box(downScene, 2.58, 1.0, 0.82, MAT.wood, 7.65, 0.5, counterZ);
  box(downScene, 2.68, 0.075, 0.9, mat(0xb18a61), 7.65, 1.025, counterZ);
  for (const x of [6.78, 7.36, 7.94, 8.52]) {
    cyl(downScene, 0.22, 0.62, MAT.metal, x, 0.31, 3.55);
    cyl(downScene, 0.3, 0.08, mat(0x4e2729), x, 0.66, 3.55);
  }

  const shelf = mat(0x6f523d, 0.78, 0.03);
  for (const y of [1.05, 1.62, 2.19]) {
    box(downScene, 2.35, 0.07, 0.24, shelf, 7.65, y, 6.08);
    for (let i = 0; i < 9; i++) {
      const x = 6.7 + i * 0.235;
      const bottleHeight = 0.18 + ((i + Math.round(y * 10)) % 3) * 0.045;
      cyl(
        downScene,
        0.04,
        bottleHeight,
        mat([0x526a48, 0x74503c, 0x6a5178, 0x8c7646][i % 4], 0.38, 0.04),
        x,
        y + bottleHeight / 2 + 0.04,
        6.0,
      );
    }
  }

  // Espresso machine on the working side of the kitchen bar.
  const steel = mat(0xa5a8a4, 0.3, 0.62);
  const coffeeDark = mat(0x242526, 0.5, 0.24);
  box(downScene, 0.78, 0.52, 0.42, steel, 6.72, 1.1, 5.62);
  box(downScene, 0.72, 0.12, 0.4, coffeeDark, 6.72, 1.41, 5.62);
  box(downScene, 0.68, 0.08, 0.34, MAT.metal, 6.72, 0.81, 5.58);
  for (const x of [6.54, 6.9]) {
    cyl(downScene, 0.055, 0.12, coffeeDark, x, 1.16, 5.39).rotation.x = Math.PI / 2;
    cyl(downScene, 0.022, 0.2, MAT.metal, x, 0.96, 5.4);
  }
  cyl(downScene, 0.035, 0.34, MAT.metal, 7.12, 1.02, 5.55).rotation.z = 0.28;
  for (const x of [6.5, 6.72, 6.94]) {
    cyl(downScene, 0.075, 0.09, mat(0xe0d4c2, 0.82, 0.01), x, 1.54, 5.66);
  }
  label(downScene, 'COFFEE', 6.72, 1.92, 5.62, 0.2, '#f1dfc6');

  for (const x of [7.28, 7.65, 8.02]) {
    cyl(downScene, 0.035, 0.44, MAT.metal, x, 1.28, 4.72);
    box(downScene, 0.18, 0.05, 0.1, MAT.metal, x, 1.49, 4.68);
  }
  label(downScene, 'COURTNEY + SIMLA · BAR', 7.65, 2.62, 5.45, 0.23, '#ffc9b0');

  box(downScene, 1.45, 0.34, 0.08, mat(0x3f6c55, 0.45, 0.04), 4.6, 2.45, -3.33);
  label(downScene, 'EXIT', 4.6, 2.5, -3.28, 0.26, '#d9ffe3');
  label(downScene, 'STAIRS ↑ STUDIO', -6.55, 2.45, -3.18, 0.33, '#d8c1ff');
  label(downScene, 'BELOW BREAKGLASS', 0, 3.8, -3.1, 0.66);
}
