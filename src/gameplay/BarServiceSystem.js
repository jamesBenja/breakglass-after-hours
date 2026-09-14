const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const BARTENDERS = new Set(['courtney', 'simla']);

const DRINKS = [
  { id: 'beer', label: 'Beer / cider', strength: 0.17 },
  { id: 'mixed', label: 'Mixed drink', strength: 0.23 },
];

const stateLabel = (value) => {
  if (value < 0.08) return 'clear-headed';
  if (value < 0.3) return 'buzzed';
  if (value < 0.52) return 'tipsy';
  if (value < 0.76) return 'drunk';
  return 'very drunk';
};

/**
 * Small, deliberately game-like bar loop.
 *
 * Alcohol raises a persistent intoxication value that changes player handling/animation. Water
 * lowers it, intoxication also decays slowly while the game is running, and bartenders cut the
 * player off at the upper end instead of allowing an unlimited stack.
 */
export class BarServiceSystem {
  constructor({ state, player, ui, sceneManager, saveState = () => {} }) {
    this.state = state;
    this.player = player;
    this.ui = ui;
    this.sceneManager = sceneManager;
    this.saveState = saveState;
    this.elapsedSinceSave = 0;
    this.player?.setIntoxication?.(this.state?.data?.intoxication ?? 0);
  }

  get level() {
    return clamp(Number(this.state?.data?.intoxication) || 0);
  }

  set level(value) {
    if (!this.state?.data) return;
    this.state.data.intoxication = clamp(Number(value) || 0);
    this.player?.setIntoxication?.(this.state.data.intoxication);
  }

  bartenderName(id) {
    return (
      this.sceneManager.current?.npcs?.get?.(id)?.name ?? (id === 'simla' ? 'Simla' : 'Courtney')
    );
  }

  serveAnimation(id) {
    this.sceneManager.current?.npcs?.triggerServe?.(id);
  }

  order(id, drink) {
    if (this.level >= 0.82) {
      this.serveAnimation(id);
      this.panel(
        id,
        `${this.bartenderName(id)} cuts you off for now and puts a water in front of you.`,
      );
      return;
    }
    this.level += drink.strength;
    this.state.data.drinksServed =
      Math.max(0, Math.floor(Number(this.state.data.drinksServed) || 0)) + 1;
    this.serveAnimation(id);
    this.saveState();
    this.panel(id, `${this.bartenderName(id)} serves you a ${drink.label.toLowerCase()}.`);
  }

  water(id) {
    this.level -= 0.2;
    this.serveAnimation(id);
    this.saveState();
    this.panel(id, `${this.bartenderName(id)} hands you a water.`);
  }

  panel(id, lead = '') {
    const name = this.bartenderName(id);
    const intoxication = this.level;
    const cutOff = intoxication >= 0.82;
    const drinks = Math.max(0, Math.floor(Number(this.state?.data?.drinksServed) || 0));
    const status = `You feel ${stateLabel(intoxication)} · ${(intoxication * 100).toFixed(0)}% intoxication · ${drinks} alcoholic drink${drinks === 1 ? '' : 's'} served this save.`;
    this.ui.panel(
      `${name.toUpperCase()} · KITCHEN BAR`,
      `${lead ? `${lead} ` : ''}${status}${cutOff ? ' The bar will only serve water until you sober up a bit.' : ''}`,
      [
        ...(!cutOff ? DRINKS.map((drink) => [drink.label, () => this.order(id, drink)]) : []),
        ['Water', () => this.water(id)],
        ['Back', () => this.ui.panel('BAR', 'Step away from the kitchen bar.')],
      ],
    );
  }

  handle(target) {
    const id = target?.npcId ?? target?.id;
    if (this.sceneManager.current?.definition?.id !== 'downstairs' || !BARTENDERS.has(id))
      return false;
    this.state?.meet?.(id);
    this.saveState();
    this.panel(id);
    return true;
  }

  update(dt) {
    if (!this.state?.data || this.level <= 0) return;
    // Roughly fourteen minutes of continuous play from maximum intoxication back to clear.
    const before = this.level;
    this.level = before - dt * 0.0012;
    if (Math.abs(this.level - before) > 0.00001) this.elapsedSinceSave += dt;
    if (this.elapsedSinceSave >= 8) {
      this.saveState();
      this.elapsedSinceSave = 0;
    }
  }

  snapshot() {
    return {
      intoxication: this.level,
      label: stateLabel(this.level),
      drinksServed: Math.max(0, Math.floor(Number(this.state?.data?.drinksServed) || 0)),
    };
  }
}
