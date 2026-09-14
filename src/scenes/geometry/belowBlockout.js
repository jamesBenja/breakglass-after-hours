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

  // ---------------- BELOW: based on actual technical diagram ----------------
  // Main club room ratio approx 45'3" x 26'.
  floor(downScene, 0, 0, 12.2, 7.0, mainFloor);
  // South wall is split at the coat-check/alley corridor so the exit is physically visible.
  wall(-1.275, -3.5, 9.65, 0.24);
  wall(5.875, -3.5, 0.45, 0.24);
  doorwayFrame(downScene, 4.6, -3.38, 'horizontal', 'ALLEY / COAT CHECK');
  // West wall is split around the real-world relationship to Take A Break so the room is playable.
  wall(-6.1, -1.7, 0.24, 3.6);
  wall(-6.1, 2.45, 0.24, 2.1);
  // East wall is split around the bar/service doorway.
  wall(6.1, -2.825, 0.24, 1.35);
  wall(6.1, 1.475, 0.24, 4.05);
  wall(0, 3.5, 12.2, 0.24);

  // Take A Break on left/top: warmer floor reads separately from the club.
  floor(downScene, -8.1, 1.7, 3.8, 4.3, mat(0x5e4331));
  wall(-10, 1.7, 0.24, 4.3);
  wall(-8.1, 3.85, 3.8, 0.24);
  wall(-8.1, -0.45, 3.8, 0.24);
  // Keep the eastern wall above the doorway, leaving a generous playable opening below it.
  wall(-6.2, 2.6, 0.24, 2.5);
  box(downScene, 0.95, 0.035, 1.28, mat(0xc58a66), -6.08, 0.018, 0.76);
  label(downScene, 'TAKE A BREAK', -8.1, 2.9, 1.7, 0.45);

  // Storage behind club.
  floor(downScene, -1.6, 5.1, 7.0, 2.7, serviceFloor);
  wall(-1.6, 6.45, 7, 0.24);
  wall(-5.1, 5.1, 0.24, 2.7);
  wall(1.9, 5.1, 0.24, 2.7);
  label(downScene, 'STORAGE', -1.6, 2.8, 5.1, 0.4);

  // Service stack right. The physical bar now lives back inside the kitchen at the north end.
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

  // Coat check / alley entrance. The previous version had a hidden scene trigger here but no
  // legible physical route; this visible stair run now points players directly to the alley.
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
  // Side rails make the exit read instantly even through a busy dance floor.
  const rail = mat(0x2c3035, 0.52, 0.18);
  for (const x of [3.76, 5.44]) {
    box(downScene, 0.06, 1.05, 1.9, rail, x, 0.65, -4.45);
  }
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
  // Visible CDJ jog wheels, mixer strips and small booth monitor make the playable decks read.
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

  // The large dark floor ring is one of the strongest real-room visual landmarks.
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

  // Dark overhead bars, cabling and small fixture bodies make the compact ceiling read like a club.
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

  // Take A Break: permanent warm installation/chill room.
  box(downScene, 2.6, 0.62, 0.82, MAT.red, -8.1, 0.33, 1.0);
  box(downScene, 1.25, 0.48, 0.72, mat(0x6f4936), -8.65, 0.24, 3.0);
  box(downScene, 1.25, 0.48, 0.72, mat(0x4e3d52), -7.25, 0.24, 3.0);
  // Projection / installation wall and a small sculptural plinth.
  box(downScene, 0.08, 1.45, 2.35, mat(0xb7929f, 0.45, 0.02), -9.76, 1.55, 1.85);
  box(downScene, 0.78, 0.52, 0.78, mat(0x2b242c), -8.72, 0.26, 1.85);
  cyl(downScene, 0.19, 1.05, mat(0xd4a45f, 0.38, 0.12), -8.72, 1.03, 1.85);
  label(downScene, 'IMMERSIVE INSTALLATION', -8.9, 2.45, 1.85, 0.25, '#f2c7df');

  // Four small sculptural speakers correspond to the HRTF emitters in SpatialAudioSystem.
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

  // Nora's actual captured images are mounted dynamically in six frames on this north wall.
  label(downScene, 'NORA · NIGHT PHOTOS', -8.1, 3.32, 3.67, 0.27, '#f3d4df');
  for (const x of [-9.18, -8.13, -7.08]) {
    box(downScene, 0.08, 0.22, 0.08, mat(0x262226), x, 3.15, 3.68);
  }

  // The real-room arcade idea lives behind a curtain in the corner rather than floating in the club.
  const curtain = mat(0x4d2334, 0.93, 0.01);
  box(downScene, 0.08, 2.45, 1.55, curtain, -9.62, 1.23, -0.08);
  box(downScene, 0.75, 1.7, 0.72, mat(0x24262d, 0.68, 0.08), -9.15, 0.85, -0.02);
  box(downScene, 0.58, 0.42, 0.035, mat(0x445c6c, 0.4, 0.08), -9.15, 1.25, -0.395);
  box(downScene, 0.5, 0.25, 0.5, mat(0x58394c), -9.15, 0.75, -0.3);
  for (const x of [-9.28, -9.03]) cyl(downScene, 0.045, 0.06, mat(0xd7b05f), x, 0.83, -0.57);
  label(downScene, 'ARCADE', -9.15, 2.0, -0.02, 0.22, '#d9c4ee');

  // Kitchen bar: moved back to the north end of the service room and reversed. Guests approach
  // from the south; Courtney and Simla work from the north side against the back bar.
  const counterZ = 4.42;
  box(downScene, 2.58, 1.0, 0.82, MAT.wood, 7.65, 0.5, counterZ);
  box(downScene, 2.68, 0.075, 0.9, mat(0xb18a61), 7.65, 1.025, counterZ);
  for (const x of [6.78, 7.36, 7.94, 8.52]) {
    cyl(downScene, 0.22, 0.62, MAT.metal, x, 0.31, 3.55);
    cyl(downScene, 0.3, 0.08, mat(0x4e2729), x, 0.66, 3.55);
  }

  // Back bar shelves and bottles hug the kitchen's north wall, behind the bartenders.
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
  // Taps now sit on the bartender/north side of the counter rather than facing into the wall.
  for (const x of [7.28, 7.65, 8.02]) {
    cyl(downScene, 0.035, 0.44, MAT.metal, x, 1.28, 4.72);
    box(downScene, 0.18, 0.05, 0.1, MAT.metal, x, 1.49, 4.68);
  }
  label(downScene, 'COURTNEY + SIMLA · BAR', 7.65, 2.62, 5.45, 0.23, '#ffc9b0');

  // Alley exit details are intentionally bright enough to find through the crowd.
  box(downScene, 1.45, 0.34, 0.08, mat(0x3f6c55, 0.45, 0.04), 4.6, 2.45, -3.33);
  label(downScene, 'EXIT', 4.6, 2.5, -3.28, 0.26, '#d9ffe3');

  // Stair landing on left, matching actual plan's stairway-to-Clark side.
  for (let i = 0; i < 6; i++)
    box(downScene, 2.3, 0.17, 0.45, MAT.wood, -6.8, 0.11 + i * 0.11, -1.1 - i * 0.36);
  label(downScene, 'STAIRS ↑ STUDIO', -6.6, 2.25, -3.0, 0.38, '#d8c1ff');

  label(downScene, 'BELOW BREAKGLASS', 0, 3.8, -3.1, 0.66);
}
