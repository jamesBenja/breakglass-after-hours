import { DoubleSide, Mesh, MeshStandardMaterial, RingGeometry } from 'three';
import { createPrimitives } from './primitives.js';
import {
  clubFloorMaterial,
  clubWallMaterial,
  darkFloorMaterial,
} from '../materials/BreakglassMaterials.js';

// Preserved V2.1 blockout proportions; visual treatment now follows supplied club references.
export function buildBelowBlockout(downScene) {
  const { mat, box, label, floor } = createPrimitives();
  const mainFloor = clubFloorMaterial();
  const serviceFloor = darkFloorMaterial();
  const wallMaterial = clubWallMaterial();
  const wall = (x, z, w, d, h = 3.2) => box(downScene, w, h, d, wallMaterial, x, h / 2, z);

  // ---------------- BELOW: based on actual technical diagram ----------------
  // Main club room ratio approx 45'3" x 26'
  floor(downScene, 0, 0, 12.2, 7.0, mainFloor);
  wall(0, -3.5, 12.2, 0.24);
  wall(-6.1, 0, 0.24, 7.0);
  wall(6.1, 0, 0.24, 7.0);
  wall(0, 3.5, 12.2, 0.24);

  // Take A Break on left/top: warmer floor reads separately from the club.
  floor(downScene, -8.1, 1.7, 3.8, 4.3, mat(0x5e4331));
  wall(-10, 1.7, 0.24, 4.3);
  wall(-8.1, 3.85, 3.8, 0.24);
  wall(-8.1, -0.45, 3.8, 0.24);
  wall(-6.2, 2.6, 0.24, 2.5);
  label(downScene, 'TAKE A BREAK', -8.1, 2.9, 1.7, 0.45);

  // Storage behind club.
  floor(downScene, -1.6, 5.1, 7.0, 2.7, serviceFloor);
  wall(-1.6, 6.45, 7, 0.24);
  wall(-5.1, 5.1, 0.24, 2.7);
  wall(1.9, 5.1, 0.24, 2.7);
  label(downScene, 'STORAGE', -1.6, 2.8, 5.1, 0.4);

  // Service + production + bar stack right.
  floor(downScene, 7.65, 4.8, 2.8, 3.2, serviceFloor);
  floor(downScene, 7.65, 1.5, 2.8, 2.6, serviceFloor);
  floor(downScene, 7.65, -1.4, 2.8, 3.0, mat(0x4d2f2d));
  wall(9.05, 1.7, 0.24, 9.4);
  wall(7.65, 6.4, 2.8, 0.24);
  wall(7.65, -2.9, 2.8, 0.24);
  label(downScene, 'KITCHEN', 7.65, 2.55, 4.8, 0.32);
  label(downScene, 'PRODUCTION', 7.65, 2.55, 1.5, 0.3);
  label(downScene, 'BAR', 7.65, 2.55, -1.4, 0.35);

  // Coat check / entrance protrusion.
  floor(downScene, 4.6, -4.65, 2.3, 1.9, serviceFloor);
  wall(3.45, -4.65, 0.24, 1.9);
  wall(5.75, -4.65, 0.24, 1.9);
  wall(4.6, -5.6, 2.3, 0.24);
  label(downScene, 'COAT CHECK', 4.6, 2.2, -4.8, 0.31);
}

// Fixtures can stay visible while a surveyed building shell replaces the walls/floors.
export function buildBelowFixtures(downScene) {
  const { mat, MAT, box, cyl, label } = createPrimitives();

  // Raised booth language: this is GAME dressing on the real lower-center booth relationship.
  box(downScene, 3.7, 0.16, 1.75, mat(0x2d2725), 1.5, 0.08, -2.42);
  box(downScene, 1.7, 0.1, 0.42, mat(0x4a3a31), 1.5, 0.05, -1.38);
  box(downScene, 3.0, 1.0, 1.2, MAT.wood, 1.5, 0.66, -2.45);
  box(downScene, 0.95, 0.13, 0.52, MAT.dark, 0.55, 1.18, -2.45);
  box(downScene, 0.95, 0.13, 0.52, MAT.dark, 2.45, 1.18, -2.45);
  box(downScene, 0.8, 0.17, 0.55, MAT.metal, 1.5, 1.18, -2.45);
  label(downScene, 'DJ BOOTH', 1.5, 2.05, -2.5, 0.36);

  // The large dark floor ring is one of the strongest real-room visual landmarks.
  const ring = new Mesh(
    new RingGeometry(1.8, 2.35, 64),
    new MeshStandardMaterial({ color: 0x111015, roughness: 0.72, metalness: 0.02, side: DoubleSide }),
  );
  ring.name = 'below-floor-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-0.3, 0.012, 0.25);
  ring.receiveShadow = true;
  downScene.add(ring);

  // Danley-ish four-corner speakers + sub: intentionally stylized, not millimetre-accurate.
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

  // Reference-inspired vertical wood/acoustic treatment. Placement is decorative, not surveyed.
  const slat = mat(0x7a5539, 0.86, 0.01);
  for (let i = 0; i < 23; i++) {
    const x = -4.5 + i * 0.4;
    box(downScene, 0.09, 2.35, 0.09, slat, x, 1.45, 3.34);
  }

  // Dark overhead bars help the compact room read as a club rather than an empty box.
  for (const z of [-2.2, -0.75, 0.7, 2.15])
    box(downScene, 10.8, 0.12, 0.14, mat(0x111012), 0, 3.02, z);

  // Lounge / bar furniture.
  box(downScene, 3.5, 1.0, 0.9, MAT.wood, 7.25, 0.5, -1.45);
  box(downScene, 2.6, 0.62, 0.82, MAT.red, -8.1, 0.33, 1.55);
  box(downScene, 1.25, 0.48, 0.72, mat(0x6f4936), -8.5, 0.24, 2.75);
  box(downScene, 1.25, 0.48, 0.72, mat(0x4e3d52), -7.3, 0.24, 2.75);

  // Stair landing on left, matching actual plan's stairway-to-Clark side.
  for (let i = 0; i < 6; i++)
    box(downScene, 2.3, 0.17, 0.45, MAT.wood, -6.8, 0.11 + i * 0.11, -1.1 - i * 0.36);
  label(downScene, 'STAIRS ↑ STUDIO', -6.6, 2.25, -3.0, 0.38, '#d8c1ff');

  label(downScene, 'BELOW BREAKGLASS', 0, 3.8, -3.1, 0.66);
}
