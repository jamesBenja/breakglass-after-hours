import { TakeABreakImmersiveSystem } from '../gameplay/TakeABreakImmersiveSystem.js';
import { levels } from '../world/levels.js';
import { createLevel } from './createLevel.js';
import { buildBelowBlockout, buildBelowFixtures } from './geometry/belowBlockout.js';
import { buildTakeABreakFurniture } from './geometry/roomFurniture.js';

const buildFurnishedBelowFixtures = (root, definition) => {
  buildBelowFixtures(root, definition);
  buildTakeABreakFurniture(root, definition);
};

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

export const createBelowScene = async (assets) => {
  const level = await createLevel(
    downstairsWithMaddox,
    { architecture: buildBelowBlockout, fixtures: buildFurnishedBelowFixtures },
    assets,
  );
  const immersive = new TakeABreakImmersiveSystem(level.gameplay);
  const baseUpdate = level.update.bind(level);
  const baseDispose = level.dispose.bind(level);
  level.takeABreakImmersive = immersive;
  level.update = (dt, audio, playerPosition = null) => {
    baseUpdate(dt, audio, playerPosition);
    immersive.update(dt, audio, playerPosition);
  };
  level.dispose = () => {
    immersive.dispose();
    baseDispose();
  };
  return level;
};
