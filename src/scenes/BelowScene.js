import { levels } from '../world/levels.js';
import { createLevel } from './createLevel.js';
import { buildBelowBlockout, buildBelowFixtures } from './geometry/belowBlockout.js';

const downstairsWithMaddox = {
  ...levels.downstairs,
  maddox: {
    name: 'Maddox',
    companionOnly: true,
    start: [-4.7, 0, -1.0],
    radius: 1.4,
    speed: 0.86,
    roamPoints: [
      [-4.7, 0, -1.0],
      [-2.7, 0, 1.9],
      [3.8, 0, 1.6],
      [-7.0, 0, 1.65],
    ],
    napPoints: [
      [-7.3, 0, 2.55],
      [-3.8, 0, 2.55],
    ],
  },
};

export const createBelowScene = (assets) =>
  createLevel(
    downstairsWithMaddox,
    { architecture: buildBelowBlockout, fixtures: buildBelowFixtures },
    assets,
  );
