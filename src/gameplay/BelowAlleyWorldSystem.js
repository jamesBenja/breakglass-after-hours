const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export class BelowAlleyWorldSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
  }

  save() {
    this.game.save?.();
  }

  talkToDavid() {
    const state = this.game.state.data;
    this.game.state.meet?.('david');
    const firstUnlock = state.storageAccessGranted !== true;
    state.storageAccessGranted = true;
    this.save();
    this.ui.panel(
      'DAVID · FURNITURE DEALER',
      firstUnlock
        ? '“See that impossible wall of furniture beside storage? Push the narrow panel behind the little gold frame. It is not a wall. Just do not knock over half my inventory getting through.” The hidden storage passage is now usable.'
        : '“The panel with the little gold frame still opens. Everything behind it is technically organized, depending on your definition.”',
      [],
    );
  }

  moveThroughStorage(inside) {
    if (this.game.state.data.storageAccessGranted !== true) {
      this.ui.panel(
        'OVERSTUFFED FURNITURE WALL',
        'It looks like a dead end made of stacked furniture. There is probably a trick to it, but you do not know it yet.',
        [],
      );
      return;
    }
    const position = inside ? [-2.15, 0, 4.05] : [-2.15, 0, 2.72];
    this.game.player.position.set(...position);
    this.game.player.velocity?.set?.(0, 0, 0);
    this.game.camera?.recenter?.();
    this.ui.warning?.(
      inside
        ? 'The furniture panel shifts. You squeeze into David’s packed storage room.'
        : 'You push back through the disguised furniture wall into the club.',
    );
    this.save();
  }

  emergencyExit() {
    this.ui.panel(
      'CLARK EMERGENCY EXIT',
      'This stair is the emergency exit to Clark. The normal route to the alley is at Zander’s stair core on the other side of the club.',
      [],
    );
  }

  beaverPanel() {
    const state = this.game.state.data;
    this.game.state.meet?.('beaver');
    this.save();
    this.ui.panel(
      'BEAVER · BACK ALLEY BBQ',
      `The grill is going beside the picnic tables. Hot dogs eaten: ${state.hotDogsEaten || 0}. Tacos eaten: ${state.tacosEaten || 0}. Beers from Beaver count toward your Breakglass drink total.`,
      [
        [
          'Buy a hot dog',
          () => {
            state.hotDogsEaten = Math.min(999, (state.hotDogsEaten || 0) + 1);
            this.game.interactionProps?.receiveFromNpc?.('beaver', 'hotdog');
            this.save();
            this.ui.warning?.('Beaver hands you a hot dog straight off the grill.');
            this.beaverPanel();
          },
        ],
        [
          'Buy a taco',
          () => {
            state.tacosEaten = Math.min(999, (state.tacosEaten || 0) + 1);
            this.game.interactionProps?.receiveFromNpc?.('beaver', 'taco');
            this.save();
            this.ui.warning?.('Beaver passes you a taco from the alley prep table.');
            this.beaverPanel();
          },
        ],
        [
          'Buy a beer',
          () => {
            state.drinksServed = Math.min(999, (state.drinksServed || 0) + 1);
            state.intoxication = clamp01((state.intoxication || 0) + 0.08);
            this.game.interactionProps?.receiveFromNpc?.('beaver', 'beer');
            this.save();
            this.ui.warning?.('Beaver pulls a cold beer from the cooler.');
            this.beaverPanel();
          },
        ],
      ],
    );
  }

  handle(target) {
    const sceneId = this.game.sceneManager.current?.definition?.id;
    if (sceneId === 'downstairs' && (target?.npcId === 'david' || target?.id === 'david')) {
      this.talkToDavid();
      return true;
    }
    if (sceneId === 'downstairs' && target?.action === 'storagePassage') {
      this.moveThroughStorage(true);
      return true;
    }
    if (sceneId === 'downstairs' && target?.action === 'storageExit') {
      this.moveThroughStorage(false);
      return true;
    }
    if (sceneId === 'downstairs' && target?.action === 'clarkEmergencyExit') {
      this.emergencyExit();
      return true;
    }
    if (
      sceneId === 'alley' &&
      (target?.action === 'beaverBbq' || target?.npcId === 'beaver' || target?.id === 'beaver')
    ) {
      this.beaverPanel();
      return true;
    }
    return false;
  }
}

export function installBelowAlleyWorldSystem(game, ui) {
  if (game.belowAlleyWorld) return game.belowAlleyWorld;
  const system = new BelowAlleyWorldSystem(game, ui);
  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (system.handle(target)) return;
    baseDispatch(target);
  };
  game.belowAlleyWorld = system;
  return system;
}
