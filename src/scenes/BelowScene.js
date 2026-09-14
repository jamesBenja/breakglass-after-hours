import { levels } from '../world/levels.js';
import { createLevel } from './createLevel.js';
import { buildBelowBlockout, buildBelowFixtures } from './geometry/belowBlockout.js';

export const createBelowScene = (assets) =>
  createLevel(
    levels.downstairs,
    { architecture: buildBelowBlockout, fixtures: buildBelowFixtures },
    assets,
  );
