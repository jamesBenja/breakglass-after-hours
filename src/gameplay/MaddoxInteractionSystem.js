const ROOF_AFFECTION_THRESHOLD = 4;

/**
 * Keeps the memorial interaction small and warm: pet Maddox over multiple encounters and he
 * eventually decides to show the player the old hidden roof route.
 */
export class MaddoxInteractionSystem {
  constructor({ state, ui, sceneManager, saveState = () => {} }) {
    this.state = state;
    this.ui = ui;
    this.sceneManager = sceneManager;
    this.saveState = saveState;
  }

  handle(target) {
    if (target?.action !== 'maddox') return false;
    this.open();
    return true;
  }

  currentDog() {
    return this.sceneManager.current?.maddox ?? null;
  }

  currentConfig() {
    return this.sceneManager.current?.definition?.maddox ?? null;
  }

  open() {
    const dog = this.currentDog();
    if (!dog) return;
    const data = this.state.data;
    const unlocked = data.roofSecretUnlocked === true;
    const affection = data.maddoxAffection ?? 0;
    const stateLabel = dog.snapshot?.().state ?? 'roam';

    let text;
    if (unlocked) {
      text =
        stateLabel === 'nap'
          ? 'Maddox is asleep nearby. He already showed you the old way to the roof.'
          : 'Maddox knows you now. He looks toward the back of the studio like he is waiting for you to follow.';
    } else if (affection >= ROOF_AFFECTION_THRESHOLD - 1) {
      text = 'Maddox leans into the attention, then looks down the hall toward Storage.';
    } else if (stateLabel === 'nap') {
      text = 'Maddox is curled up asleep. He opens one eye when you come close.';
    } else {
      text = 'Maddox is making his rounds through the studio. He stops beside you for a minute.';
    }

    const actions = [['Pet Maddox', () => this.pet()]];
    if (unlocked) actions.push(['Follow Maddox', () => this.follow()]);
    this.ui.panel('MADDOX · STUDIO DOG', text, actions);
  }

  pet() {
    const dog = this.currentDog();
    if (!dog) return;
    dog.pet();
    const data = this.state.data;
    data.maddoxPets = Math.min(999, (data.maddoxPets ?? 0) + 1);
    data.maddoxAffection = Math.min(9, (data.maddoxAffection ?? 0) + 1);

    const justUnlocked =
      !data.roofSecretUnlocked && data.maddoxAffection >= ROOF_AFFECTION_THRESHOLD;
    if (justUnlocked) {
      data.roofSecretUnlocked = true;
      dog.startLead(this.currentConfig()?.roofLeadRoute ?? []);
      this.saveState();
      this.ui.panel(
        'MADDOX KNOWS A WAY UP',
        'Maddox gets up, looks back to make sure you are watching, and starts toward the back of the studio. A route that looked like nothing before suddenly makes sense.',
        [['Follow him', () => this.follow()]],
      );
      return;
    }

    this.saveState();
    const remaining = Math.max(0, ROOF_AFFECTION_THRESHOLD - data.maddoxAffection);
    this.ui.panel(
      'MADDOX',
      data.roofSecretUnlocked
        ? 'His tail starts going immediately. He seems very pleased with this arrangement.'
        : remaining === 1
          ? 'He stays close instead of wandering off. He seems like he wants to show you something.'
          : 'He leans into the pets, gives a small tail wag, then looks around the studio again.',
      [
        ['Pet him again', () => this.pet()],
        ['Let him wander', () => this.open()],
      ],
    );
  }

  follow() {
    const dog = this.currentDog();
    const route = this.currentConfig()?.roofLeadRoute ?? [];
    if (!dog || !route.length) return;
    dog.startLead(route);
    this.saveState();
    this.ui.panel(
      'FOLLOW MADDOX',
      'He trots toward Storage, pausing at the turns as if he has done this route a hundred times. Follow him to the hidden hatch.',
    );
  }
}

export { ROOF_AFFECTION_THRESHOLD };
