import { createUpstairsDefinition } from '../world/upstairs/definition.js';
import { createLevel } from './createLevel.js';
import { buildUpstairsBlockout, buildUpstairsFixtures } from './geometry/upstairsBlockout.js';

export const createUpstairsScene = (assets, pass) =>
  createLevel(
    createUpstairsDefinition(pass),
    { architecture: buildUpstairsBlockout, fixtures: buildUpstairsFixtures },
    assets,
  );
