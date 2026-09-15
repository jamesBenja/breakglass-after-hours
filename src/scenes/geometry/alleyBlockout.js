import { createPrimitives } from './primitives.js';

export function buildAlleyBlockout(root) {
  const { mat, box, cyl, label, doorwayFrame } = createPrimitives();
  const pavement = mat(0x4b4b4a, 0.96, 0.01);
  const brick = mat(0x5a4239, 0.94, 0.01);
  const darkBrick = mat(0x332d2d, 0.96, 0.01);
  const garden = mat(0x4d5c3e, 0.95, 0.01);
  const wood = mat(0x6b4b32, 0.84, 0.01);
  const metal = mat(0x30343a, 0.55, 0.18);
  const warm = mat(0xffd69c, 0.6, 0.02);

  box(root, 59, 0.18, 4.6, pavement, 0, -0.09, 0);
  box(root, 24.8, 3.25, 0.26, darkBrick, -17.1, 1.625, -2.38);
  box(root, 32.2, 3.25, 0.26, brick, 13.4, 1.625, -2.38);
  box(root, 59, 3.05, 0.25, darkBrick, 0, 1.525, 2.38);

  // Breakglass stair door / club-night entrance, based on A-101's mid-alley stair relationship.
  // The doorway now reads as an actual stairwell down to Below rather than a flat teleport marker.
  doorwayFrame(root, -3.7, -2.24, 'horizontal', 'BREAKGLASS');
  box(root, 3.5, 0.16, 0.8, garden, -3.7, 0.04, -1.55);
  label(root, 'CLUB ENTRANCE ↓ BELOW', -3.7, 3.35, -2.2, 0.42, '#ffd4a8');

  const stair = mat(0x453a34, 0.88, 0.02);
  for (let i = 0; i < 5; i++) {
    const depth = 0.22;
    box(root, 1.55, 0.08, depth, stair, -3.7, 0.01 - i * 0.035, -1.58 - i * 0.2);
  }
  // Low stairwell cheeks and rails frame the descent without blocking the playable alley path.
  for (const x of [-4.55, -2.85]) {
    box(root, 0.08, 0.75, 1.0, metal, x, 0.38, -1.72);
  }
  box(root, 1.7, 0.07, 0.07, metal, -3.7, 0.78, -1.28);

  // A small line-management lane makes the approach read before the full bouncer system lands.
  for (const x of [-6.6, -8.4, -10.2]) {
    cyl(root, 0.045, 0.95, metal, x, 0.48, -1.25);
    box(root, 1.75, 0.035, 0.035, metal, x - 0.88, 0.76, -1.25);
  }

  // Garden / smoking area furniture. No loudspeaker objects outside by design.
  for (const [x, z] of [
    [5.5, 1.05],
    [11.3, 0.12],
    [17.6, 1.0],
  ]) {
    box(root, 1.75, 0.12, 0.72, wood, x, 0.72, z);
    box(root, 1.75, 0.12, 0.28, wood, x, 0.47, z - 0.65);
    box(root, 1.75, 0.12, 0.28, wood, x, 0.47, z + 0.65);
    for (const dx of [-0.68, 0.68]) {
      box(root, 0.11, 0.62, 0.11, metal, x + dx, 0.34, z);
    }
  }

  // Beaver's alley BBQ: grill, prep table and cooler, kept deliberately low-key outside.
  const grill = mat(0x25282b, 0.5, 0.28);
  const grillHot = mat(0x6d2d1f, 0.72, 0.05);
  box(root, 1.05, 0.18, 0.62, grill, 15.35, 0.82, -0.78);
  box(root, 1.0, 0.22, 0.58, grill, 15.35, 1.04, -0.78).rotation.x = -0.22;
  for (const x of [14.95, 15.75]) box(root, 0.08, 0.8, 0.08, metal, x, 0.4, -0.78);
  for (const x of [15.02, 15.25, 15.48, 15.7])
    box(root, 0.15, 0.04, 0.34, grillHot, x, 0.94, -0.78);
  box(root, 1.25, 0.1, 0.65, wood, 13.45, 0.72, -0.45);
  for (const x of [12.95, 13.95]) box(root, 0.08, 0.68, 0.08, metal, x, 0.34, -0.45);
  box(root, 0.82, 0.58, 0.62, mat(0x48647a, 0.7, 0.08), 16.65, 0.29, -0.52);
  box(root, 0.84, 0.08, 0.64, mat(0xd8d7cc, 0.7, 0.03), 16.65, 0.62, -0.52);
  label(root, 'BEAVER · BBQ', 14.65, 2.35, -2.15, 0.3, '#ffd0a6');
  label(root, 'HOT DOGS · TACOS · BEER', 15.1, 1.85, -2.12, 0.2, '#f6dfc7');

  // Planters / trees create the narrow garden rhythm visible from De Castelnau.
  for (const [x, z] of [
    [-23, 1.25],
    [-14, 1.35],
    [1.5, 1.25],
    [23, 1.3],
  ]) {
    box(root, 0.82, 0.55, 0.82, garden, x, 0.28, z);
    cyl(root, 0.12, 2.25, wood, x, 1.4, z);
    box(root, 1.35, 0.8, 1.35, garden, x, 2.5, z);
  }

  // Warm overhead points suggest the real garden/string-light atmosphere without turning
  // the alley into a second party room.
  for (let x = -24; x <= 24; x += 4) {
    box(root, 0.1, 0.1, 0.1, warm, x, 3.0 + Math.sin(x * 0.2) * 0.12, 0);
  }

  label(root, 'DE CASTELNAU →', -25.5, 1.2, -0.4, 0.33, '#dbe5f3');
  label(root, 'KEEP IT QUIET OUT HERE', 13.5, 2.5, -2.2, 0.3, '#f1d9c7');
}

export function buildAlleyFixtures() {}
