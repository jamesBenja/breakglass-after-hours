import { MultiplayerClient, resolveMultiplayerConfig } from './MultiplayerClient.js';

export function installMultiplayerEnhancements(game, ui) {
  if (!game || game.multiplayer) return game?.multiplayer ?? null;
  const config = resolveMultiplayerConfig();
  const multiplayer = new MultiplayerClient({
    game,
    ui,
    url: config.url,
    room: config.room,
  });
  game.multiplayer = multiplayer;

  const baseReady = ui.ready.bind(ui);
  ui.ready = (start) =>
    baseReady(async (avatarProfile) => {
      await start(avatarProfile);
      multiplayer.start(game.state.data.avatar);
    });

  const baseCandidates = game.interactions.candidates.bind(game.interactions);
  game.interactions.candidates = () => [...baseCandidates(), ...multiplayer.interactionTargets()];

  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (target?.action === 'remote-player' && multiplayer.showInteraction(target)) return;
    baseDispatch(target);
  };

  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    multiplayer.update(now);
    return baseUpdate(now, movementOverride);
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    multiplayer.dispose();
    return baseDispose();
  };

  return multiplayer;
}
