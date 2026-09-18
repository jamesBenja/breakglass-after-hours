import './ui/styles.css';
import './ui/mobilePerformance.css';
import './ui/mobileMixing.css';
import './ui/musicEnhancements.css';
import './ui/performanceRealism.css';
import './ui/avatarFace.css';
import './ui/multiplayer.css';
import './ui/arcade.css';
import './ui/godMode.css';
import './ui/invitation.css';
import './ui/freightElevator.css';
import './ui/mobileMixerEnhancements.js';
import { Game } from './core/Game.js';
import { installFaceAvatarEnhancements } from './avatar/faceAvatarEnhancements.js';
import { installMusicEnhancements } from './gameplay/musicEnhancements.js';
import { installPartyPressureEnhancements } from './gameplay/partyPressureEnhancements.js';
import { installPartyLifeEnhancements } from './gameplay/partyLifeEnhancements.js';
import { installDjSyncEnhancements } from './gameplay/djSyncEnhancements.js';
import { installDjPerformanceRealism } from './gameplay/DjPerformanceRealismSystem.js';
import { installDjAccuracyEnhancements } from './gameplay/DjAccuracyEnhancements.js';
import { installDjLessonSystem } from './gameplay/DjLessonSystem.js';
import { installStudioLoopEnhancements } from './gameplay/StudioLoopEnhancements.js';
import { installClubBathroomSystem } from './gameplay/ClubBathroomSystem.js';
import { installModularSynthSystem } from './gameplay/ModularSynthSystem.js';
import { installRoofEndgameSystem } from './gameplay/RoofEndgameSystem.js';
import { installFreightElevatorSystem } from './gameplay/FreightElevatorSystem.js';
import { installPerformanceRealismSystems } from './gameplay/installPerformanceRealismSystems.js';
import { installCrowdDoorEnhancements } from './gameplay/crowdDoorEnhancements.js';
import { installEntryEnhancements } from './gameplay/entryEnhancements.js';
import { installGuestlistDoorEnhancements } from './gameplay/guestlistDoorEnhancements.js';
import { installRoomExperienceEnhancements } from './gameplay/roomExperienceEnhancements.js';
import { installGameStatsEnhancements } from './gameplay/GameStatsSystem.js';
import { installBelowAlleyWorldSystem } from './gameplay/BelowAlleyWorldSystem.js';
import { installAudioReliabilityEnhancements } from './gameplay/audioReliabilityEnhancements.js';
import { PlaytestTelemetry } from './gameplay/PlaytestTelemetry.js';
import {
  clearRememberedGodModeForInvitation,
  installClubRegressionFixes,
} from './gameplay/ClubRegressionFixes.js';
import {
  applyGodMode,
  GOD_MODE_SAVE_KEY,
  mountGodModeControls,
  resolveGodModeAccess,
} from './gameplay/GodMode.js';
import {
  applyInvitationAccess,
  installInvitationAccess,
  invitationSaveKey,
  mountInvitationLetter,
  resolveInvitationAccess,
} from './gameplay/InvitationAccess.js';
import { installMultiplayerEnhancements } from './multiplayer/installMultiplayerEnhancements.js';
import { Hud } from './ui/Hud.js';

installFaceAvatarEnhancements();

const invitation = await resolveInvitationAccess();
// An explicit invitation link always means “test this invitation”, even on a browser that was
// previously authorized for God Mode. The God link can be used again later to re-enable it.
clearRememberedGodModeForInvitation(invitation);
const godMode = await resolveGodModeAccess();
const telemetry = new PlaytestTelemetry({ invitation, godMode: godMode.enabled });
const ui = new Hud(document);
mountInvitationLetter(document, invitation);
telemetry.mountNotice(document);
let game;
try {
  game = new Game(ui, {
    spatialPass: new URLSearchParams(location.search).get('pass') ?? undefined,
    saveKey: godMode.enabled ? GOD_MODE_SAVE_KEY : invitationSaveKey(invitation),
  });
  applyInvitationAccess(game, invitation);
  if (godMode.enabled) {
    applyGodMode(game, ui);
    mountGodModeControls(document);
  }
  installMusicEnhancements(game, ui);
  installPartyPressureEnhancements(game, ui);
  installPartyLifeEnhancements(game, ui);
  installDjSyncEnhancements(game, ui);
  installDjPerformanceRealism(game, ui);
  installDjAccuracyEnhancements(game, ui);
  installStudioLoopEnhancements(game, ui);
  installClubBathroomSystem(game, ui);
  installModularSynthSystem(game, ui);
  installRoofEndgameSystem(game, ui);
  installFreightElevatorSystem(game, ui);
  installPerformanceRealismSystems(game, ui);
  installDjLessonSystem(game, ui);
  installCrowdDoorEnhancements(game, ui);
  installEntryEnhancements(game, ui);
  installGuestlistDoorEnhancements(game, ui);
  installRoomExperienceEnhancements(game, ui);
  installGameStatsEnhancements(game, ui);
  installBelowAlleyWorldSystem(game, ui);
  installAudioReliabilityEnhancements(game, ui);
  installMultiplayerEnhancements(game, ui);
  installInvitationAccess(game, ui, invitation);
  installClubRegressionFixes(game, ui);
  telemetry.attach(game, ui);
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
