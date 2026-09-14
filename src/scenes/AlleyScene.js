import { alleyLevel } from '../world/alley.js';
import { createLevel } from './createLevel.js';
import { buildAlleyBlockout, buildAlleyFixtures } from './geometry/alleyBlockout.js';

const alleyWithMaddox = {
  ...alleyLevel,
  maddox: {
    name: 'Maddox',
    companionOnly: true,
    start: [-1.6, 0, -1.1],
    radius: 1.4,
    speed: 0.9,
    roamPoints: [
      [-1.6, 0, -1.1],
      [1.1, 0, 0.8],
      [3.4, 0, 1.9],
      [-3.2, 0, 1.4],
    ],
    napPoints: [
      [-2.1, 0, 2.2],
      [2.4, 0, 2.35],
    ],
  },
};

export const createAlleyScene = (assets) =>
  createLevel(
    alleyWithMaddox,
    { architecture: buildAlleyBlockout, fixtures: buildAlleyFixtures },
    assets,
  );
