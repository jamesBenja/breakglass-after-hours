import { createLevel } from './createLevel.js';
import { roofLevel } from '../world/roof.js';
import { buildRoofBlockout, buildRoofFixtures } from './geometry/roofBlockout.js';

export async function createRoofScene(assets) {
  return createLevel(
    roofLevel,
    {
      architecture: buildRoofBlockout,
      fixtures: buildRoofFixtures,
    },
    assets,
  );
}
