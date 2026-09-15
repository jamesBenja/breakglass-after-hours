import { TAKE_A_BREAK_SEATS } from '../scenes/geometry/roomFurniture.js';

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const VIEW_LABELS = {
  follow: 'FOLLOW',
  close: 'CLOSE',
  first: 'POV',
};

export class TakeABreakInteractionSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.previousCameraMode = null;
  }

  get active() {
    return this.game.player?.seated === true && this.game.spatialAudio?.installationFocus === true;
  }

  sit(index) {
    const level = this.game.sceneManager.current;
    if (level?.definition?.id !== 'downstairs') return;
    const seat = TAKE_A_BREAK_SEATS[index] ?? TAKE_A_BREAK_SEATS[0];
    const centre = [-8.72, 1.85];
    const dx = centre[0] - seat[0];
    const dz = centre[1] - seat[2];
    const facing = Math.atan2(dx, dz);
    this.previousCameraMode = this.game.camera.mode;
    this.game.player.sit(seat, level.collision, facing);
    this.game.spatialAudio?.setInstallationFocus?.(true);
    this.game.camera.setMode?.('first');
    this.ui.warning?.('You settle onto a cushion. The club falls away behind the wall.');
    this.show();
  }

  stand({ silent = false } = {}) {
    if (!this.game.player?.seated) return false;
    this.game.player.stand();
    this.game.spatialAudio?.setInstallationFocus?.(false);
    if (this.previousCameraMode) this.game.camera.setMode?.(this.previousCameraMode);
    this.previousCameraMode = null;
    if (!silent) {
      this.ui.warning?.('You stand up. The club mix comes back into the room.');
      this.show();
    }
    return true;
  }

  adjust(parameter, amount) {
    this.game.spatialAudio?.adjustInstallation?.(parameter, amount);
    this.controls();
  }

  controls() {
    const spatial = this.game.spatialAudio;
    const snapshot = spatial?.snapshot?.() ?? {};
    const mix = snapshot.mix ?? {};
    this.ui.panel(
      'TAKE A BREAK · INSTALLATION CONTROLS',
      `Low ${percent(mix.low)} · texture ${percent(mix.texture)} · air ${percent(mix.air)} · motion ${percent(mix.motion)} · space ${percent(mix.space)}. These controls change the actual four-emitter WebAudio piece.`,
      [
        ['Low layer +', () => this.adjust('low', 0.12)],
        ['Low layer −', () => this.adjust('low', -0.12)],
        ['Texture +', () => this.adjust('texture', 0.12)],
        ['Texture −', () => this.adjust('texture', -0.12)],
        ['Air +', () => this.adjust('air', 0.12)],
        ['Air −', () => this.adjust('air', -0.12)],
        ['Motion +', () => this.adjust('motion', 0.12)],
        ['Motion −', () => this.adjust('motion', -0.12)],
        ['Space / delay +', () => this.adjust('space', 0.12)],
        ['Space / delay −', () => this.adjust('space', -0.12)],
        [
          'Reset installation mix',
          () => {
            spatial?.resetInstallationMix?.();
            this.controls();
          },
        ],
        ['Back', () => this.show()],
      ],
    );
  }

  show() {
    const spatial = this.game.spatialAudio;
    const snapshot = spatial?.snapshot?.() ?? {};
    const focused = snapshot.focus === true;
    const seated = this.game.player?.seated === true;
    this.ui.panel(
      'TAKE A BREAK · IMMERSIVE INSTALLATION',
      focused
        ? 'You are seated inside the four-emitter piece. The Below DJ system is now only a quiet, heavily filtered bleed through the wall, while the installation sits in the centre of the listening field.'
        : 'Four HRTF emitters occupy the room. Sit on one of the floor cushions to enter a focused listening mode, or walk around the piece and hear the image change with your position and view.',
      [
        ...(!seated
          ? TAKE_A_BREAK_SEATS.map((_, index) => [
              `Sit on cushion ${index + 1}`,
              () => this.sit(index),
            ])
          : [['Stand up', () => this.stand()]]),
        ['Shape the installation', () => this.controls()],
        [
          snapshot.enabled === false ? 'Activate installation' : 'Mute installation',
          () => {
            const enabled = spatial?.toggleInstallation?.();
            if (enabled && seated) spatial?.setInstallationFocus?.(true);
            this.show();
          },
        ],
      ],
    );
  }

  handle(target) {
    if (this.game.sceneManager.current?.definition?.id !== 'downstairs') return false;
    if (target?.action !== 'installation') return false;
    this.show();
    return true;
  }
}

export function installRoomExperienceEnhancements(game, ui) {
  if (game.roomExperience) return game.roomExperience;
  const takeABreak = new TakeABreakInteractionSystem(game, ui);
  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (takeABreak.handle(target)) return;
    baseDispatch(target);
  };

  const baseUpdate = game.update.bind(game);
  game.update = (now, movementOverride = null) => {
    if (game.started && !game.sceneManager.changing && !globalThis.document?.hidden) {
      if (game.input.consume('toggleView')) {
        const mode = game.camera.toggleMode();
        ui.warning?.(`VIEW · ${VIEW_LABELS[mode] ?? mode.toUpperCase()}`);
      }
      const movement = game.input.movement?.() ?? { x: 0, z: 0 };
      if (game.player.seated && Math.hypot(movement.x, movement.z) > 0.08)
        takeABreak.stand({ silent: true });
    }
    if (game.player.seated && game.sceneManager.current?.definition?.id !== 'downstairs')
      takeABreak.stand({ silent: true });
    return baseUpdate(now, movementOverride);
  };

  game.roomExperience = { takeABreak };
  return game.roomExperience;
}
