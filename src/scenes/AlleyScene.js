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

const turnToward = (current, target, amount) => {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
};

export const createAlleyScene = async (assets) => {
  const level = await createLevel(
    alleyWithMaddox,
    { architecture: buildAlleyBlockout, fixtures: buildAlleyFixtures },
    assets,
  );
  const baseUpdate = level.update.bind(level);
  level.update = (dt, audio, playerPosition = null) => {
    baseUpdate(dt, audio, playerPosition);

    // AlleySystem owns the real spill-out count. Mirror that number into a non-dancing visual
    // crowd so a shutdown visibly empties Below into the alley instead of turning people off.
    if (level.crowd && level.alley) {
      const count = Math.max(0, Math.min(level.crowd.max, Math.round(level.alley.occupancy)));
      level.crowd.attendance = count;
      level.crowd.targetAttendance = count;
      level.crowd.danceShare = 0;
      level.crowd.update(0, {
        playing: false,
        energy: 0,
        bass: 0,
        beat: 0,
        vibe: 0,
        mixQuality: 0.9,
      });
    }

    const sam = level.npcs?.get?.('sam');
    if (!sam?.group || !playerPosition) return;
    const dx = playerPosition.x - sam.group.position.x;
    const dz = playerPosition.z - sam.group.position.z;
    if (Math.hypot(dx, dz) < 0.08) return;
    const target = Math.atan2(dx, dz);
    const smoothing = 1 - Math.exp(-5.8 * dt);
    sam.group.rotation.y = turnToward(sam.group.rotation.y, target, smoothing);
    // Keep the head near the player's direction too, while leaving a little natural motion.
    sam.head.rotation.y *= Math.exp(-4.5 * dt);
  };
  return level;
};
