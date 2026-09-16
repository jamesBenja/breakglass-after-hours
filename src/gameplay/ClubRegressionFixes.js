// Temporary regression/geometry fixes isolated from the Night Director design work.
// This module intentionally avoids changing shared DJ transport or multiplayer authority.

import { DJ_PLATFORM, DJ_REFRESHMENTS_POSITION } from '../scenes/geometry/djBoothRealism.js';

const GOD_TOKEN_STORAGE_KEY = 'breakglass.god.token';

export function clearRememberedGodModeForInvitation(invitation) {
  if (invitation?.source !== 'link') return false;
  try {
    globalThis.localStorage?.removeItem(GOD_TOKEN_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function addDjPlatformCollision(game) {
  const level = game?.scenes?.get?.('downstairs');
  if (!level?.collision || level._djPlatformCollisionInstalled) return;
  level._djPlatformCollisionInstalled = true;
  level.collision.surfaces.push({
    id: 'dj-raised-platform',
    name: 'Raised DJ platform',
    x1: DJ_PLATFORM.x1,
    x2: DJ_PLATFORM.x2,
    z1: DJ_PLATFORM.z1,
    z2: DJ_PLATFORM.z2,
    y: DJ_PLATFORM.y,
    priority: 30,
  });
  level.definition.anchors.dj.position = [DJ_PLATFORM.x, DJ_PLATFORM.y, DJ_PLATFORM.z];
  level.definition.anchors.dj.radius = Math.max(2.15, level.definition.anchors.dj.radius || 0);
  level.definition.anchors.djRefreshments = {
    name: 'DJ booth water + drinks',
    position: [...DJ_REFRESHMENTS_POSITION],
    radius: 1.05,
    action: 'djRefreshments',
  };
}

function installArcadeAudioContinuity(game) {
  if (!game?.stopAll || game._arcadeAudioContinuityInstalled) return;
  game._arcadeAudioContinuityInstalled = true;
  const baseStopAll = game.stopAll.bind(game);

  // The two cabinet entry paths call stopAll() immediately before arcade.start(). Deferring only
  // the downstairs non-emergency stop by one microtask lets the cabinet become active first; in
  // that case the club transport is deliberately left running underneath the arcade, which is
  // also what a real cabinet in Below would sound like. Evacuation/context-loss still stop audio.
  game.stopAll = (...args) => {
    const downstairs = game.sceneManager?.current?.definition?.id === 'downstairs';
    if (!downstairs || game.evacuationStarted) return baseStopAll(...args);
    queueMicrotask(() => {
      if (!game.arcade?.active) baseStopAll(...args);
    });
  };
}

function installDjPlatformInteraction(game, ui) {
  if (!game?.interactions?.dispatch || game._djPlatformInteractionInstalled) return;
  game._djPlatformInteractionInstalled = true;
  const baseDispatch = game.interactions.dispatch.bind(game.interactions);

  const drinkPanel = () => {
    const state = game.state?.data;
    const props = game.interactionProps;
    const level = Math.max(0, Math.min(1, Number(state?.intoxication) || 0));
    ui.panel(
      'DJ BOOTH · WATER + DRINKS',
      'A few waters and drinks are tucked beside the raised booth platform so the DJ does not have to leave the decks.',
      [
        [
          'Drink water',
          () => {
            if (state) state.intoxication = Math.max(0, level - 0.2);
            game.barService?.syncPlayer?.();
            props?.selfServe?.('water');
            game.save?.();
            drinkPanel();
          },
        ],
        [
          'Have a beer / cider',
          () => {
            if (state) {
              state.intoxication = Math.min(1, level + 0.17);
              state.drinksServed = Math.max(0, Math.floor(Number(state.drinksServed) || 0)) + 1;
            }
            game.barService?.syncPlayer?.();
            props?.selfServe?.('beer');
            game.save?.();
            drinkPanel();
          },
        ],
      ],
    );
  };

  game.interactions.dispatch = (target) => {
    const sceneId = game.sceneManager?.current?.definition?.id;
    if (sceneId === 'downstairs' && target?.action === 'djRefreshments') {
      drinkPanel();
      return;
    }
    if (
      sceneId === 'downstairs' &&
      target?.action === 'dj' &&
      (game.godMode || game.state?.data?.djAccessGranted === true)
    ) {
      game.player?.spawn?.([DJ_PLATFORM.x, DJ_PLATFORM.y, DJ_PLATFORM.z], game.sceneManager.current.collision);
    }
    return baseDispatch(target);
  };
}

export function installClubRegressionFixes(game, ui) {
  if (!game || game._clubRegressionFixesInstalled) return;
  game._clubRegressionFixesInstalled = true;
  installArcadeAudioContinuity(game);
  installDjPlatformInteraction(game, ui);

  const baseInitialize = game.initialize.bind(game);
  game.initialize = async (...args) => {
    const result = await baseInitialize(...args);
    addDjPlatformCollision(game);
    return result;
  };
}
