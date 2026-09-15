import { createPrimitives } from './primitives.js';

// Preserved V2.1 blockout; see level provenance before replacing geometry.
export function buildBelowBlockout(downScene) {
  const { mat, MAT, box, cyl, label, floor, wall, doorwayFrame } = createPrimitives();
  // ---------------- BELOW: based on actual technical diagram ----------------
  // Main club room ratio approx 45'3" x 26'
  floor(downScene, 0, 0, 12.2, 7.0, mat(0x171416));
  wall(downScene, 0, -3.5, 12.2, 0.24);
  wall(downScene, -6.1, 0, 0.24, 7.0);
  wall(downScene, 6.1, 0, 0.24, 7.0);
  wall(downScene, 0, 3.5, 12.2, 0.24);

  // Take A Break on left/top
  floor(downScene, -8.1, 1.7, 3.8, 4.3, mat(0x26211f));
  wall(downScene, -10, 1.7, 0.24, 4.3);
  wall(downScene, -8.1, 3.85, 3.8, 0.24);
  wall(downScene, -8.1, -0.45, 3.8, 0.24);
  wall(downScene, -6.2, 2.6, 0.24, 2.5);
  label(downScene, 'TAKE A BREAK', -8.1, 2.9, 1.7, 0.45);

  // storage behind club
  floor(downScene, -1.6, 5.1, 7.0, 2.7, mat(0x211e21));
  wall(downScene, -1.6, 6.45, 7, 0.24);
  wall(downScene, -5.1, 5.1, 0.24, 2.7);
  wall(downScene, 1.9, 5.1, 0.24, 2.7);
  label(downScene, 'STORAGE', -1.6, 2.8, 5.1, 0.4);

  // service + production + bar stack right
  floor(downScene, 7.65, 4.8, 2.8, 3.2, mat(0x1d2529));
  floor(downScene, 7.65, 1.5, 2.8, 2.6, mat(0x2b2026));
  floor(downScene, 7.65, -1.4, 2.8, 3.0, mat(0x322124));
  wall(downScene, 9.05, 1.7, 0.24, 9.4);
  wall(downScene, 7.65, 6.4, 2.8, 0.24);
  wall(downScene, 7.65, -2.9, 2.8, 0.24);
  label(downScene, 'KITCHEN', 7.65, 2.55, 4.8, 0.32);
  label(downScene, 'PRODUCTION', 7.65, 2.55, 1.5, 0.3);
  label(downScene, 'BAR', 7.65, 2.55, -1.4, 0.35);

  // coat check / entrance protrusion
  floor(downScene, 4.6, -4.65, 2.3, 1.9, mat(0x26201d));
  wall(downScene, 3.45, -4.65, 0.24, 1.9);
  wall(downScene, 5.75, -4.65, 0.24, 1.9);
  wall(downScene, 4.6, -5.6, 2.3, 0.24);
  label(downScene, 'COAT CHECK', 4.6, 2.2, -4.8, 0.31);
}

// Fixtures can stay visible while a surveyed building shell replaces the walls/floors.
export function buildBelowFixtures(downScene) {
  const { mat, MAT, box, cyl, label } = createPrimitives();
  // actual-ish DJ booth location B near lower center
  box(downScene, 3.0, 1.0, 1.2, MAT.wood, 1.5, 0.5, -2.45);
  box(downScene, 0.95, 0.13, 0.52, MAT.dark, 0.55, 1.08, -2.45);
  box(downScene, 0.95, 0.13, 0.52, MAT.dark, 2.45, 1.08, -2.45);
  box(downScene, 0.8, 0.17, 0.55, MAT.metal, 1.5, 1.08, -2.45);
  label(downScene, 'DJ BOOTH', 1.5, 2.0, -2.5, 0.36);

  // Danley-ish four-corner speakers + sub
  for (const [x, z] of [
    [-5.25, -2.8],
    [-5.25, 2.8],
    [5.25, -2.8],
    [5.25, 2.8],
  ])
    box(downScene, 0.52, 1.15, 0.52, MAT.speaker, x, 0.58, z);
  cyl(downScene, 0.65, 0.55, MAT.speaker, -1.7, 0.3, -0.3);

  // lounge / bar furniture
  box(downScene, 3.5, 1.0, 0.9, MAT.wood, 7.25, 0.5, -1.45);
  box(downScene, 2.6, 0.62, 0.82, MAT.red, -8.1, 0.33, 1.55);

  // Shared staircase at the Clark side. The upper run climbs to the studio.
  for (let i = 0; i < 6; i++)
    box(downScene, 2.3, 0.17, 0.45, MAT.wood, -6.8, 0.11 + i * 0.11, -1.1 - i * 0.36);
  label(downScene, 'STAIRS ↑ STUDIO', -6.6, 2.25, -3.0, 0.38, '#d8c1ff');

  // At the bottom landing the stair twists 90° and continues DOWN toward the alleyway.
  // Keep this visually tied to the passage interaction instead of reading as a dead end.
  box(downScene, 2.45, 0.12, 0.78, MAT.dark, -6.8, -0.015, -0.62);
  for (let i = 0; i < 6; i++) {
    const x = -7.15 - i * 0.36;
    const y = 0.015 - i * 0.105;
    box(downScene, 0.45, 0.17, 1.72, MAT.wood, x, y, -0.62);
  }
  box(downScene, 1.05, 0.1, 1.82, MAT.dark, -9.25, -0.62, -0.62);

  // Simple rails/posts make the change of direction legible from the club floor.
  for (const [x, y] of [
    [-7.15, 0.42],
    [-7.9, 0.2],
    [-8.65, -0.02],
  ]) {
    box(downScene, 0.06, 0.9, 0.06, MAT.metal, x, y, -1.48);
    box(downScene, 0.06, 0.9, 0.06, MAT.metal, x, y, 0.24);
  }
  box(downScene, 2.05, 0.055, 0.055, MAT.metal, -7.9, 0.78, -1.48);
  box(downScene, 2.05, 0.055, 0.055, MAT.metal, -7.9, 0.78, 0.24);

  label(downScene, 'STAIRS ↓ ALLEYWAY', -8.0, 1.55, -0.58, 0.36, '#d8c1ff');
  label(downScene, '↓ ALLEY', -9.05, 0.65, -0.58, 0.28, '#ead1f0');

  // club atmosphere, based on real red/purple photos
  label(downScene, 'BELOW BREAKGLASS', 0, 3.8, -3.1, 0.66);
}
