import { MeshBasicMaterial } from 'three';
import { createPrimitives } from './primitives.js';

export function buildRoofBlockout(root) {
  const { mat, MAT, box, cyl, label, floor } = createPrimitives();
  const concrete = mat(0x565552, 0.98, 0.01);
  const parapet = mat(0x393b3c, 0.96, 0.01);
  const brick = mat(0x5b4740, 0.93, 0.01);
  const metal = mat(0x5b6163, 0.52, 0.28);
  const wood = mat(0x72543c, 0.86, 0.01);

  floor(root, 0, 0, 16, 10, concrete);

  // Chunky parapets keep the roof feeling like the actual industrial building rather than a
  // floating platform, and make the alley edge legible from the third-person camera.
  box(root, 16.4, 1.05, 0.34, parapet, 0, 0.52, -5.08);
  box(root, 16.4, 1.05, 0.34, parapet, 0, 0.52, 5.08);
  box(root, 0.34, 1.05, 10.4, parapet, -8.08, 0.52, 0);
  box(root, 0.34, 1.05, 10.4, parapet, 8.08, 0.52, 0);

  // Roof bulkhead and the unglamorous hatch/ladder that makes the passage feel secret.
  box(root, 2.8, 2.5, 2.45, brick, -5.7, 1.25, -3.45);
  box(root, 1.15, 2.0, 0.08, mat(0x303234, 0.8, 0.08), -5.7, 1.0, -2.19);
  box(root, 1.32, 0.11, 1.22, metal, -5.7, 0.07, -3.65);
  for (let i = 0; i < 6; i++) {
    box(root, 0.72, 0.045, 0.06, metal, -5.7, 0.42 + i * 0.31, -2.08);
  }
  for (const x of [-6.05, -5.35]) box(root, 0.055, 1.9, 0.055, metal, x, 1.18, -2.08);

  // Founders' low-budget hangout: folding table, mismatched chairs, crate, ashtray and beers.
  box(root, 2.2, 0.11, 0.95, wood, 0, 0.78, 0.35);
  for (const x of [-0.88, 0.88]) {
    for (const z of [0.03, 0.68]) box(root, 0.07, 0.76, 0.07, metal, x, 0.38, z);
  }
  for (const [x, z, rotation] of [
    [-1.65, 0.4, -0.1],
    [0, -1.0, 0],
    [1.65, 0.4, 0.1],
  ]) {
    const seat = box(root, 0.58, 0.09, 0.58, mat(0x37393b, 0.9, 0.02), x, 0.48, z);
    seat.rotation.y = rotation;
    box(root, 0.58, 0.78, 0.08, mat(0x45484b, 0.86, 0.03), x, 0.87, z + 0.28);
  }
  box(root, 0.72, 0.55, 0.72, mat(0x6f563e), 2.6, 0.27, 1.25);
  cyl(root, 0.13, 0.07, mat(0x6a6d6c, 0.48, 0.2), 0.05, 0.88, 0.35);
  for (const [x, z] of [
    [-0.52, 0.25],
    [0.48, 0.2],
    [0.22, 0.57],
    [2.56, 1.16],
  ]) {
    cyl(root, 0.045, 0.29, mat(0x66543a, 0.42, 0.08), x, 0.98, z);
    cyl(root, 0.052, 0.035, mat(0xb2a37a, 0.38, 0.08), x, 1.14, z);
  }

  // Alley-facing dumpster sits visibly below the parapet so the recurring throw animation has a
  // clear destination. It is scenery, not a second navigable copy of the alley.
  box(root, 2.1, 1.25, 1.25, mat(0x365847, 0.88, 0.03), 1.4, -2.55, 6.85);
  const lid = box(root, 2.18, 0.12, 1.32, mat(0x29473a, 0.8, 0.05), 1.4, -1.88, 6.85);
  lid.rotation.x = -0.16;
  label(root, 'ALLEY', 1.4, -0.75, 7.0, 0.2, '#9ba4a8');

  // Crude skyline silhouettes and warm windows keep the roof from ending in empty fog.
  const skyline = mat(0x171c20, 0.96, 0.01);
  const windowMat = new MeshBasicMaterial({ color: 0xc69a62 });
  for (let i = 0; i < 11; i++) {
    const x = -13 + i * 2.6;
    const height = 2.4 + ((i * 7) % 5) * 0.72;
    box(root, 2.1, height, 1.8, skyline, x, height / 2 - 0.2, 14 + (i % 3) * 1.1);
    if (i % 2 === 0) {
      for (let w = 0; w < 3; w++)
        box(
          root,
          0.18,
          0.24,
          0.03,
          windowMat,
          x - 0.45 + w * 0.45,
          1 + w * 0.55,
          13.08 + (i % 3) * 1.1,
        );
    }
  }

  label(root, 'BREAKGLASS ROOF', -2.5, 2.35, -4.7, 0.34, '#c8beb0');
}

export function buildRoofFixtures() {}
