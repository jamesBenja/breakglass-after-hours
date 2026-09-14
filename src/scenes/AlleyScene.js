import { alleyLevel } from '../world/alley.js';
import { createLevel } from './createLevel.js';
import { buildAlleyBlockout, buildAlleyFixtures } from './geometry/alleyBlockout.js';

export const createAlleyScene = (assets) =>
  createLevel(
    alleyLevel,
    { architecture: buildAlleyBlockout, fixtures: buildAlleyFixtures },
    assets,
  );
