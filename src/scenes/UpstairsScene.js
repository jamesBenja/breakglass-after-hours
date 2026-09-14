import { createUpstairsDefinition } from '../world/upstairs/definition.js';
import { createLevel } from './createLevel.js';
import { buildUpstairsBlockout, buildUpstairsFixtures } from './geometry/upstairsBlockout.js';

const buildOrientedUpstairsFixtures = (root, definition) => {
  buildUpstairsFixtures(root, definition);
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
