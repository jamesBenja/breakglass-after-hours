import './ui/styles.css';
import './ui/mobilePerformance.css';
import './ui/mobileMixing.css';
import './ui/musicEnhancements.css';
import './ui/avatarFace.css';
import './ui/arcade.css';
import './ui/mobileMixerEnhancements.js';
import { Game } from './core/Game.js';
import { installFaceAvatarEnhancements } from './avatar/faceAvatarEnhancements.js';
import { installMusicEnhancements } from './gameplay/musicEnhancements.js';
import { installPartyPressureEnhancements } from './gameplay/partyPressureEnhancements.js';
import { installPartyLifeEnhancements } from './gameplay/partyLifeEnhancements.js';
import { installDjSyncEnhancements } from './gameplay/djSyncEnhancements.js';
import { installCrowdDoorEnhancements } from './gameplay/crowdDoorEnhancements.js';
import { installEntryEnhancements } from './gameplay/entryEnhancements.js';
import { installAudioReliabilityEnhancements } from './gameplay/audioReliabilityEnhancements.js';
import { Hud } from './ui/Hud.js';

installFaceAvatarEnhancements();

const ui = new Hud(document);
let game;
try {
  game = new Game(ui, {
    spatialPass: new URLSearchParams(location.search).get('pass') ?? undefined,
  });
  installMusicEnhancements(game, ui);
  installPartyPressureEnhancements(game, ui);
  installPartyLifeEnhancements(game, ui);
  installDjSyncEnhancements(game, ui);
  installCrowdDoorEnhancements(game, ui);
  installEntryEnhancements(game, ui);
  installAudioReliabilityEnhancements(game, ui);
  await game.initialize();
} catch (error) {
  console.error('Breakglass startup failed', error);
  await game?.dispose();
  ui.fatal(error);
}

if (import.meta.hot) {
  // Full reload preserves a single renderer/audio/input owner during development.
  import.meta.hot.dispose(() => {
    void game?.dispose();
  });
}
