import { Group } from 'three';
import { createUpstairsDefinition } from '../world/upstairs/definition.js';
import { createLevel } from './createLevel.js';
import { buildUpstairsBlockout, buildUpstairsFixtures } from './geometry/upstairsBlockout.js';
import { buildStudioFurniture } from './geometry/roomFurniture.js';
import { createPrimitives } from './geometry/primitives.js';

const addAnimatedTapeReels = (root, definition) => {
  const machine = root.getObjectByName('neve-tape-machine');
  if (!machine || machine.getObjectByName('neve-tape-reel-left-animation')) return;
  const fixture = definition.fixtures.find((item) => item.id === 'neve-tape-machine');
  if (!fixture) return;

  const { box, mat } = createPrimitives();
  const spokeMaterial = mat(0x30363a, 0.46, 0.38);
  const markerMaterial = mat(0xd7c79d, 0.42, 0.24);
  const depth = fixture.z2 - fixture.z1;
  const reelFaceZ = -depth / 2 - 0.102;

  for (const [index, x] of [-0.25, 0.25].entries()) {
    const spinner = new Group();
    spinner.name = `neve-tape-reel-${index === 0 ? 'left' : 'right'}-animation`;
    spinner.position.set(x, 1.27, reelFaceZ);
    spinner.userData.tapeReel = true;
    spinner.userData.tapeDirection = 1;
    // Slightly different angular speeds make the two reels read as supply/take-up spools.
    spinner.userData.tapeSpeed = index === 0 ? 6.1 : 7.15;
    machine.add(spinner);

    // The original reel meshes are intentionally retained. These dark three-spoke overlays are
    // what make rotation legible at game camera distance when archive playback is running.
    for (let spokeIndex = 0; spokeIndex < 3; spokeIndex++) {
      const spoke = box(spinner, 0.36, 0.025, 0.014, spokeMaterial, 0, 0, 0);
      spoke.rotation.z = (spokeIndex * Math.PI) / 3;
    }
    box(spinner, 0.055, 0.055, 0.02, markerMaterial, 0.145, 0, -0.004);
  }
};

const buildOrientedUpstairsFixtures = (root, definition) => {
  buildUpstairsFixtures(root, definition);
  buildStudioFurniture(root, definition);
  addAnimatedTapeReels(root, definition);
  // The storage archive fixture used to expose its labels/boxes toward the wall. Rotate only
  // the rendered rack, leaving its footprint/collision envelope unchanged.
  const tapeRack = root.getObjectByName('tape-archive-shelves');
  if (tapeRack) tapeRack.rotation.y += Math.PI;
};

export const createUpstairsScene = (assets, pass) =>
  createLevel(
    createUpstairsDefinition(pass),
    { architecture: buildUpstairsBlockout, fixtures: buildOrientedUpstairsFixtures },
    assets,
  );
