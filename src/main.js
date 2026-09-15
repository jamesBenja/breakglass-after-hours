import './ui/styles.css';
import './ui/mobilePerformance.css';
import './ui/mobileMixing.css';
import './ui/musicEnhancements.css';
import './ui/performanceRealism.css';
import './ui/avatarFace.css';
import './ui/multiplayer.css';
import './ui/arcade.css';
import './ui/mobileMixerEnhancements.js';
import { Game } from './core/Game.js';
import { installFaceAvatarEnhancements } from './avatar/faceAvatarEnhancements.js';
import { installMusicEnhancements } from './gameplay/musicEnhancements.js';
import { installPartyPressureEnhancements } from './gameplay/partyPressureEnhancements.js';
import { installPartyLifeEnhancements } from './gameplay/partyLifeEnhancements.js';
import { installDjSyncEnhancements } from './gameplay/djSyncEnhancements.js';
import { installDjPerformanceRealism } from './gameplay/DjPerformanceRealismSystem.js';
import { installStudioLoopEnhancements } from './gameplay/StudioLoopEnhancements.js';
import { installPerformanceRealismSystems } from './gameplay/installPerformanceRealismSystems.js';
import { installCrowdDoorEnhancements } from './gameplay/crowdDoorEnhancements.js';
import { installEntryEnhancements } from './gameplay/entryEnhancements.js';
import { installGuestlistDoorEnhancements } from './gameplay/guestlistDoorEnhancements.js';
import { installRoomExperienceEnhancements } from './gameplay/roomExperienceEnhancements.js';
import { installGameStatsEnhancements } from './gameplay/GameStatsSystem.js';
import { installBelowAlleyWorldSystem } from './gameplay/BelowAlleyWorldSystem.js';
import { installAudioReliabilityEnhancements } from './gameplay/audioReliabilityEnhancements.js';
import { installMultiplayerEnhancements } from './multiplayer/installMultiplayerEnhancements.js';
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
  installDjPerformanceRealism(game, ui);
  installStudioLoopEnhancements(game, ui);
  installPerformanceRealismSystems(game, ui);
  installCrowdDoorEnhancements(game, ui);
  installEntryEnhancements(game, ui);
  installGuestlistDoorEnhancements(game, ui);
  installRoomExperienceEnhancements(game, ui);
  installGameStatsEnhancements(game, ui);
  installBelowAlleyWorldSystem(game, ui);
  installAudioReliabilityEnhancements(game, ui);
  installMultiplayerEnhancements(game, ui);
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
