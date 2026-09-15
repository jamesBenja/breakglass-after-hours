import { MeshStandardMaterial } from 'three';
import { createPrimitives } from './primitives.js';

const DEVICE_SCALE = 1.9;

export function buildRealisticDjBooth(root) {
  const { box, cyl, mat, MAT, label } = createPrimitives();
  const centerX = 1.5;
  const deskZ = -2.48;
  const topY = 1.2;

  // Wider booth surface sized from real hardware proportions rather than generic rectangles.
  box(root, 4.65, 0.16, 1.52, mat(0x2b211d, 0.82, 0.03), centerX, 0.08, deskZ);
  box(root, 4.25, 1.0, 1.18, MAT.wood, centerX, 0.64, deskZ);
  box(root, 4.42, 0.09, 1.32, mat(0x604734, 0.68, 0.04), centerX, 1.12, deskZ);

  const black = mat(0x17191d, 0.55, 0.16);
  const dark = mat(0x25272b, 0.48, 0.22);
  const silver = mat(0xaeb4b8, 0.35, 0.72);
  const platter = mat(0x5e6469, 0.34, 0.68);
  const white = mat(0xd8dce0, 0.42, 0.28);
  const green = mat(0x5cff78, 0.34, 0.2);
  const amber = mat(0xffba52, 0.34, 0.2);
  const red = mat(0xff4b54, 0.34, 0.2);
  const blue = mat(0x56a8ff, 0.34, 0.2);
  const screen = new MeshStandardMaterial({
    color: 0x081018,
    emissive: 0x287db8,
    emissiveIntensity: 1.25,
    roughness: 0.22,
    metalness: 0.08,
  });

  const turntable = (x, side) => {
    // SL-1200 family proportions: 453 × 353 mm footprint, 332 mm platter.
    const width = 0.453 * DEVICE_SCALE;
    const depth = 0.353 * DEVICE_SCALE;
    const height = 0.12;
    box(root, width, height, depth, silver, x, topY + height / 2, deskZ);
    cyl(root, 0.332 * DEVICE_SCALE * 0.5, 0.055, platter, x - 0.06 * side, topY + 0.14, deskZ);
    cyl(root, 0.053, 0.065, dark, x - 0.06 * side, topY + 0.17, deskZ);
    // Tonearm base + angled arm and headshell.
    cyl(root, 0.065, 0.075, dark, x + 0.31 * side, topY + 0.14, deskZ + 0.19);
    const arm = box(root, 0.035, 0.035, 0.48, silver, x + 0.22 * side, topY + 0.19, deskZ + 0.03);
    arm.rotation.y = side * 0.42;
    box(root, 0.11, 0.04, 0.08, black, x + 0.06 * side, topY + 0.19, deskZ - 0.18);
    // Pitch fader and start/stop.
    box(root, 0.045, 0.018, 0.34, dark, x + 0.34 * side, topY + 0.195, deskZ - 0.1);
    box(root, 0.035, 0.025, 0.07, white, x + 0.34 * side, topY + 0.215, deskZ - 0.2);
    cyl(root, 0.055, 0.028, green, x - 0.35 * side, topY + 0.2, deskZ + 0.24);
    label(root, side < 0 ? 'SL-1200 L' : 'SL-1200 R', x, topY + 0.52, deskZ, 0.13, '#d6d8d9');
  };

  const cdj = (x, side) => {
    // CDJ-3000 proportions: 329 × 453 mm footprint, 118 mm high.
    const width = 0.329 * DEVICE_SCALE;
    const depth = 0.453 * DEVICE_SCALE;
    box(root, width, 0.13, depth, black, x, topY + 0.065, deskZ);
    // 9-inch screen block, jog wheel, transport and hot cues.
    box(root, width * 0.82, 0.045, depth * 0.3, screen, x, topY + 0.17, deskZ - depth * 0.26);
    const jog = cyl(root, 0.21, 0.055, platter, x, topY + 0.18, deskZ + 0.08);
    jog.name = side < 0 ? 'cdj-left-jog' : 'cdj-right-jog';
    cyl(root, 0.155, 0.02, dark, x, topY + 0.215, deskZ + 0.08);
    for (let i = 0; i < 4; i += 1) {
      box(
        root,
        0.085,
        0.025,
        0.055,
        [red, amber, green, blue][i],
        x - 0.14 + i * 0.095,
        topY + 0.205,
        deskZ + depth * 0.37,
      );
    }
    cyl(root, 0.055, 0.028, green, x - 0.2, topY + 0.205, deskZ + depth * 0.39);
    cyl(root, 0.045, 0.028, amber, x - 0.06, topY + 0.205, deskZ + depth * 0.39);
    box(root, 0.04, 0.025, 0.28, dark, x + 0.23, topY + 0.205, deskZ + 0.21);
    label(root, side < 0 ? 'CDJ-3000 L' : 'CDJ-3000 R', x, topY + 0.54, deskZ, 0.13, '#70c9ff');
  };

  const mixer = (x) => {
    // DJM-A9 proportions: 407.4 × 458.3 × 107.9 mm.
    const width = 0.4074 * DEVICE_SCALE;
    const depth = 0.4583 * DEVICE_SCALE;
    box(root, width, 0.13, depth, black, x, topY + 0.065, deskZ);
    const channelX = [-0.24, -0.08, 0.08, 0.24];
    for (let channel = 0; channel < 4; channel += 1) {
      const cx = x + channelX[channel];
      for (const [z, color] of [
        [-0.28, amber],
        [-0.18, white],
        [-0.08, blue],
      ]) {
        cyl(root, 0.025, 0.027, color, cx, topY + 0.2, deskZ + z);
      }
      box(root, 0.026, 0.018, 0.25, dark, cx, topY + 0.205, deskZ + 0.19);
      box(root, 0.06, 0.028, 0.045, silver, cx, topY + 0.22, deskZ + 0.21);
    }
    // Crossfader + master FX section.
    box(root, 0.52, 0.018, 0.035, dark, x, topY + 0.205, deskZ + 0.39);
    box(root, 0.06, 0.03, 0.055, silver, x - 0.12, topY + 0.22, deskZ + 0.39);
    for (let i = 0; i < 6; i += 1)
      cyl(root, 0.022, 0.026, i % 2 ? blue : amber, x - 0.27 + i * 0.11, topY + 0.2, deskZ - 0.39);
    label(root, 'DJM-A9', x, topY + 0.55, deskZ, 0.14, '#f2f2f2');
  };

  const positions = {
    ttLeft: -0.27,
    cdjLeft: 0.67,
    mixer: 1.5,
    cdjRight: 2.33,
    ttRight: 3.27,
  };
  turntable(positions.ttLeft, -1);
  cdj(positions.cdjLeft, -1);
  mixer(positions.mixer);
  cdj(positions.cdjRight, 1);
  turntable(positions.ttRight, 1);

  // Small nearfields and headphone hook make the booth read as a working station rather than a prop.
  for (const x of [-0.65, 3.65]) {
    box(root, 0.38, 0.58, 0.34, MAT.speaker, x, 1.48, deskZ + 0.28);
    cyl(root, 0.105, 0.03, dark, x, 1.52, deskZ + 0.09).rotation.x = Math.PI / 2;
  }
  cyl(root, 0.11, 0.035, black, 1.93, 1.35, deskZ + 0.57).rotation.x = Math.PI / 2;

  // Programmable LED wall. LedWallSystem replaces this material with a live CanvasTexture.
  const ledMaterial = new MeshStandardMaterial({
    color: 0x09030c,
    emissive: 0xff4fb8,
    emissiveIntensity: 0.55,
    roughness: 0.42,
    metalness: 0.05,
  });
  const led = box(root, 4.55, 1.25, 0.08, ledMaterial, centerX, 2.25, -3.23);
  led.name = 'dj-led-wall';
  box(root, 4.75, 0.08, 0.14, dark, centerX, 2.91, -3.22);
  box(root, 4.75, 0.08, 0.14, dark, centerX, 1.59, -3.22);
  label(root, 'DJ / HYBRID BOOTH', centerX, 3.05, deskZ, 0.24, '#f0d8be');

  // Dedicated lighting/VJ/LED controller off to the side of the booth.
  box(root, 0.7, 0.75, 0.5, mat(0x242229, 0.56, 0.16), 4.55, 0.9, -2.3);
  box(root, 0.58, 0.05, 0.34, screen, 4.55, 1.31, -2.3);
  label(root, 'VISUALS', 4.55, 1.78, -2.3, 0.16, '#73dfff');
}
