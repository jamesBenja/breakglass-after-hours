const ROOF_AFFECTION_THRESHOLD = 4;

/**
 * Keeps the memorial interaction small and warm: pet Maddox over multiple encounters and he
 * eventually decides to show the player the old hidden roof route. Unlocking that bond also
 * enables the lightweight companion mode used across the studio and rooftop.
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
    const companion = unlocked && data.maddoxCompanion === true;
    const stateLabel = dog.snapshot?.().state ?? 'roam';
    const levelId = this.sceneManager.current?.definition?.id;

    let text;
    if (unlocked) {
      text =
        levelId === 'roof'
          ? 'Maddox made it up with you. He patrols the roof edge, checks the hangout, then circles back to your side.'
          : companion
            ? 'Maddox knows you now and is sticking close. He will follow you through the studio and come with you to the roof.'
            : stateLabel === 'nap'
              ? 'Maddox is asleep nearby. He already showed you the old way to the roof.'
              : 'Maddox knows you now. He looks toward the back of the studio, then back at you.';
    } else if ((data.maddoxAffection ?? 0) >= ROOF_AFFECTION_THRESHOLD - 1) {
      text = 'Maddox leans into the attention, then looks down the hall toward Storage.';
    } else if (stateLabel === 'nap') {
      text = 'Maddox is curled up asleep. He opens one eye when you come close.';
    } else {
      text = 'Maddox is making his rounds through the studio. He stops beside you for a minute.';
    }

    const actions = [['Pet Maddox', () => this.pet()]];
    if (unlocked) {
      if (levelId === 'upstairs' && (this.currentConfig()?.roofLeadRoute ?? []).length)
        actions.push(['Lead me to the roof', () => this.leadToRoof()]);
      actions.push([
        companion ? 'Let Maddox wander for a while' : 'Maddox, come with me',
        () => this.toggleCompanion(),
      ]);
    }
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
      data.maddoxCompanion = true;
      dog.startLead(this.currentConfig()?.roofLeadRoute ?? []);
      this.saveState();
      this.ui.panel(
        'MADDOX KNOWS A WAY UP',
        'Maddox gets up, looks back to make sure you are watching, and starts toward the back of the studio. From now on he can also stay with you as you move around Breakglass.',
        [['Follow him to the roof hatch', () => this.leadToRoof()]],
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

  toggleCompanion() {
    const data = this.state.data;
    if (!data.roofSecretUnlocked) return;
    data.maddoxCompanion = !data.maddoxCompanion;
    const dog = this.currentDog();
    dog?.setFollowing?.(data.maddoxCompanion);
    this.saveState();
    this.ui.panel(
      'MADDOX · COMPANION MODE',
      data.maddoxCompanion
        ? 'Maddox falls in beside you. He will now follow you around the playable studio spaces and accompany you onto the roof.'
        : 'Maddox goes back to making his own rounds. You can ask him to follow again any time.',
      [['Back', () => this.open()]],
    );
  }

  leadToRoof() {
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
