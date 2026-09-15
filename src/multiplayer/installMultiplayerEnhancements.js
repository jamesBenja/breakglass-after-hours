import { installMultiplayerEmoteAnimations } from './emoteAnimations.js';
import { InstrumentSync } from './InstrumentSync.js';
import { MultiplayerClient, resolveMultiplayerConfig } from './MultiplayerClient.js';
import { SharedMediaSync } from './SharedMediaSync.js';

const EXTRA_SHARED_STATIONS = new Set([
  'houseDjDesk',
  'tapeArchive',
  'tapeMachine',
  'liveArchive',
  'livePlayback',
]);

export function installMultiplayerEnhancements(game, ui) {
  if (!game || game.multiplayer) return game?.multiplayer ?? null;
  installMultiplayerEmoteAnimations();
  const config = resolveMultiplayerConfig();
  const multiplayer = new MultiplayerClient({
    game,
    ui,
    url: config.url,
    room: config.room,
  });
  game.multiplayer = multiplayer;

  const baseResourceForTarget = multiplayer.world.resourceForTarget.bind(multiplayer.world);
  multiplayer.world.resourceForTarget = (target) => {
    if (EXTRA_SHARED_STATIONS.has(target?.action)) {
      const sceneId = game.sceneManager.current?.definition?.id ?? 'unknown';
      const id = String(target.id || target.action)
        .replace(/[^a-z0-9:._-]/gi, '-')
        .slice(0, 72);
      return `${sceneId}:${id}`;
    }
    return baseResourceForTarget(target);
  };

  const instrumentSync = new InstrumentSync(multiplayer);
  multiplayer.instrumentSync = instrumentSync;
  const sharedMedia = new SharedMediaSync(multiplayer);
  multiplayer.sharedMedia = sharedMedia;

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
    if (multiplayer.joined) {
      void multiplayer.world.useTarget(target, () => baseDispatch(target));
      return;
    }
    baseDispatch(target);
  };

  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    instrumentSync.update();
    sharedMedia.update();
    multiplayer.update(now);
    return baseUpdate(now, movementOverride);
  };

  const baseDispose = game.dispose.bind(game);
  game.dispose = async () => {
    instrumentSync.dispose();
    sharedMedia.dispose();
    multiplayer.dispose();
    return baseDispose();
  };

  return multiplayer;
}
