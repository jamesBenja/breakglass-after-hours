import { Group, MeshBasicMaterial } from 'three';
import { createPrimitives } from './primitives.js';

export function buildRoofBlockout(root) {
  const { mat, box, cyl, label, floor } = createPrimitives();
  const concrete = mat(0x565552, 0.98, 0.01);
  const parapet = mat(0x393b3c, 0.96, 0.01);
  const brick = mat(0x5b4740, 0.93, 0.01);
  const metal = mat(0x5b6163, 0.52, 0.28);
  const wood = mat(0x72543c, 0.86, 0.01);

  floor(root, 0, 0, 16, 10, concrete);

  box(root, 16.4, 1.05, 0.34, parapet, 0, 0.52, -5.08);
  box(root, 16.4, 1.05, 0.34, parapet, 0, 0.52, 5.08);
  box(root, 0.34, 1.05, 10.4, parapet, -8.08, 0.52, 0);
  box(root, 0.34, 1.05, 10.4, parapet, 8.08, 0.52, 0);

  // Existing hidden studio-to-roof route.
  box(root, 2.8, 2.5, 2.45, brick, -5.7, 1.25, -3.45);
  box(root, 1.15, 2.0, 0.08, mat(0x303234, 0.8, 0.08), -5.7, 1.0, -2.19);
  box(root, 1.32, 0.11, 1.22, metal, -5.7, 0.07, -3.65);
  for (let i = 0; i < 6; i++)
    box(root, 0.72, 0.045, 0.06, metal, -5.7, 0.42 + i * 0.31, -2.08);
  for (const x of [-6.05, -5.35])
    box(root, 0.055, 1.9, 0.055, metal, x, 1.18, -2.08);

  // Founders' hangout.
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

  // Player-throwable roof junk: a folding chair, cardboard box and construction lumber.
  const throwChair = new Group();
  throwChair.name = 'roof-throw-chair';
  throwChair.position.set(4.2, 0, 3.05);
  root.add(throwChair);
  box(throwChair, 0.62, 0.08, 0.58, mat(0x44484b, 0.88, 0.05), 0, 0.42, 0);
  box(throwChair, 0.62, 0.72, 0.08, mat(0x4f5457, 0.82, 0.08), 0, 0.78, 0.25);
  for (const x of [-0.24, 0.24]) {
    box(throwChair, 0.055, 0.82, 0.055, metal, x, 0.41, -0.18);
    box(throwChair, 0.055, 0.82, 0.055, metal, x, 0.41, 0.2);
  }

  const throwBox = box(root, 0.78, 0.65, 0.7, mat(0x8a6b48, 0.92, 0), 5.55, 0.33, 3.35);
  throwBox.name = 'roof-throw-box';
  const throwLumber = new Group();
  throwLumber.name = 'roof-throw-lumber';
  throwLumber.position.set(6.55, 0, 2.55);
  root.add(throwLumber);
  for (let i = 0; i < 4; i++) {
    const board = box(
      throwLumber,
      0.16,
      0.16,
      1.65,
      mat(0xa47b4c, 0.88, 0),
      (i - 1.5) * 0.19,
      0.1 + (i % 2) * 0.12,
      0,
    );
    board.rotation.y = (i - 1.5) * 0.025;
  }

  // The stubborn roof AC unit. Gameplay handles its kick/fix states.
  const ac = new Group();
  ac.name = 'roof-ac-unit';
  ac.position.set(5.35, 0, -2.55);
  root.add(ac);
  box(ac, 1.85, 1.15, 1.25, mat(0x7b8587, 0.6, 0.28), 0, 0.58, 0);
  box(ac, 1.45, 0.04, 0.9, mat(0x31383b, 0.6, 0.15), 0, 1.16, 0);
  for (let i = -4; i <= 4; i++)
    box(ac, 0.06, 0.58, 0.03, mat(0x3e4749, 0.58, 0.18), i * 0.15, 0.62, -0.64);
  label(ac, 'AC', 0, 1.52, 0, 0.2, '#c3d1d0');

  // Gentrification key activation point: deliberately unremarkable until the key is found.
  const cityLock = cyl(root, 0.22, 0.08, mat(0x5c5141, 0.62, 0.18), 7.28, 1.02, 1.05);
  cityLock.name = 'roof-gentrification-lock';
  cityLock.rotation.x = Math.PI / 2;

  // Endgame escape panel. The actual ladder stays invisible until the completion gate opens.
  const escapePanel = box(root, 1.18, 0.07, 1.2, mat(0x2e3235, 0.76, 0.08), -6.45, 0.055, 3.75);
  escapePanel.name = 'roof-escape-panel';
  const escapeLadder = new Group();
  escapeLadder.name = 'roof-escape-ladder';
  escapeLadder.visible = false;
  escapeLadder.position.set(-6.45, 0, 4.25);
  root.add(escapeLadder);
  for (let i = 0; i < 7; i++)
    box(escapeLadder, 0.84, 0.05, 0.06, metal, 0, -0.08 - i * 0.32, 0);
  for (const x of [-0.39, 0.39])
    box(escapeLadder, 0.055, 2.15, 0.055, metal, x, -0.98, 0);

  // Alley-facing dumpster, below the parapet.
  box(root, 2.1, 1.25, 1.25, mat(0x365847, 0.88, 0.03), 1.4, -2.55, 6.85);
  const lid = box(root, 2.18, 0.12, 1.32, mat(0x29473a, 0.8, 0.05), 1.4, -1.88, 6.85);
  lid.rotation.x = -0.16;
  label(root, 'ALLEY', 1.4, -0.75, 7.0, 0.2, '#9ba4a8');

  // Old skyline is a separate group so it can literally tumble out of view.
  const skyline = mat(0x171c20, 0.96, 0.01);
  const windowMat = new MeshBasicMaterial({ color: 0xc69a62 });
  const oldSkyline = new Group();
  oldSkyline.name = 'roof-skyline-old';
  root.add(oldSkyline);
  for (let i = 0; i < 11; i++) {
    const x = -13 + i * 2.6;
    const height = 2.4 + ((i * 7) % 5) * 0.72;
    box(oldSkyline, 2.1, height, 1.8, skyline, x, height / 2 - 0.2, 14 + (i % 3) * 1.1);
    if (i % 2 === 0) {
      for (let w = 0; w < 3; w++)
        box(
          oldSkyline,
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

  // Replacement skyline: exaggerated game-language symbols of neighbourhood gentrification.
  const newSkyline = new Group();
  newSkyline.name = 'roof-skyline-gentrified';
  newSkyline.visible = false;
  root.add(newSkyline);
  const condo = mat(0x43515b, 0.48, 0.2);
  const glass = mat(0x8baab8, 0.32, 0.12);
  for (let i = 0; i < 7; i++) {
    const x = -12 + i * 4;
    const height = 6.5 + (i % 3) * 2.4;
    box(newSkyline, 3.1, height, 2.2, condo, x, height / 2 - 0.2, 14.5 + (i % 2) * 1.1);
    for (let y = 1.2; y < height - 0.5; y += 1.05) {
      for (const dx of [-0.75, 0, 0.75])
        box(newSkyline, 0.42, 0.55, 0.035, glass, x + dx, y, 13.38 + (i % 2) * 1.1);
    }
  }
  const signs = [
    [-8.2, 'CONDO'],
    [-3.5, 'CAFÉ'],
    [1.2, 'YOGA'],
    [5.4, 'CO-WORK'],
    [9.1, 'DOG SPA'],
  ];
  for (const [x, copy] of signs)
    label(newSkyline, copy, x, 2.3 + (Math.abs(x) % 2), 12.9, 0.34, '#f0dfc4');

  label(root, 'BREAKGLASS ROOF', -2.5, 2.35, -4.7, 0.34, '#c8beb0');
}

export function buildRoofFixtures() {}
