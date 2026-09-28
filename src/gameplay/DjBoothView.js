export const DJ_BOOTH_POV_POSITION = Object.freeze([1.5, 0, -2.96]);
export const DJ_DANCE_FLOOR_FOCUS = Object.freeze([0, 0, 0.75]);

export function djBoothPovYaw(
  position = DJ_BOOTH_POV_POSITION,
  focus = DJ_DANCE_FLOOR_FOCUS,
) {
  return Math.atan2(position[0] - focus[0], position[2] - focus[2]);
}

export function enterDjBoothPov(game) {
  const level = game?.sceneManager?.current;
  if (!game?.player || !game?.camera || level?.definition?.id !== 'downstairs') return false;
  if (game._djBoothPov) return true;

  game._djBoothPov = {
    previousMode: game.camera.mode,
  };

  game.player.spawn(DJ_BOOTH_POV_POSITION, level.collision);
  game.player.object.rotation.y = 0;

  game.camera.setMode('first');
  const yaw = djBoothPovYaw();
  game.camera.yaw = yaw;
  game.camera.yawTarget = yaw;
  game.camera.cameraYawOffset = 0;
  game.camera.cameraYawOffsetTarget = 0;
  game.camera.initialized = false;
  game.input?.clear?.();
  return true;
}

export function exitDjBoothPov(game) {
  const state = game?._djBoothPov;
  if (!state || !game?.camera) return false;
  game._djBoothPov = null;
  game.camera.setMode(state.previousMode || game.camera.preferredMode || 'follow');
  game.input?.clear?.();
  return true;
}
