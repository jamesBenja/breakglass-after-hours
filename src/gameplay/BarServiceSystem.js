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
 * Game-like kitchen/bar loop. Alcohol and caffeine are deliberately kept as separate state:
 * coffee can temporarily reduce the player's handling impairment, but it does not remove the
 * underlying intoxication or bypass the bartender cut-off.
 */
export class BarServiceSystem {
  constructor({ state, player, ui, sceneManager, saveState = () => {} }) {
    this.state = state;
    this.player = player;
    this.ui = ui;
    this.sceneManager = sceneManager;
    this.saveState = saveState;
    this.elapsedSinceSave = 0;
    this.syncPlayer();
  }

  get level() {
    return clamp(Number(this.state?.data?.intoxication) || 0);
  }

  set level(value) {
    if (!this.state?.data) return;
    this.state.data.intoxication = clamp(Number(value) || 0);
    this.syncPlayer();
  }

  get caffeine() {
    return clamp(Number(this.state?.data?.caffeine) || 0);
  }

  set caffeine(value) {
    if (!this.state?.data) return;
    this.state.data.caffeine = clamp(Number(value) || 0);
    this.syncPlayer();
  }

  get effectiveIntoxication() {
    // At maximum coffee alertness roughly 58% of the alcohol handling effect remains.
    return clamp(this.level * (1 - this.caffeine * 0.42));
  }

  syncPlayer() {
    this.player?.setIntoxication?.(this.effectiveIntoxication);
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

  coffee() {
    if (!this.state?.data) return;
    this.caffeine = Math.min(1, this.caffeine + 0.62);
    this.state.data.coffeesMade =
      Math.max(0, Math.floor(Number(this.state.data.coffeesMade) || 0)) + 1;
    this.saveState();
    this.coffeePanel('You make an espresso on the kitchen machine.');
  }

  coffeePanel(lead = '') {
    const coffees = Math.max(0, Math.floor(Number(this.state?.data?.coffeesMade) || 0));
    const alertness = Math.round(this.caffeine * 100);
    this.ui.panel(
      'KITCHEN · COFFEE MACHINE',
      `${lead ? `${lead} ` : ''}Coffee raises alertness and temporarily reduces the game's steering/sway effects, but your underlying alcohol level stays at ${Math.round(this.level * 100)}%. Alertness: ${alertness}% · ${coffees} coffee${coffees === 1 ? '' : 's'} made.`,
      [
        ['Make espresso', () => this.coffee()],
        ['Back', () => this.ui.panel('KITCHEN', 'Step away from the coffee machine.')],
      ],
    );
  }

  panel(id, lead = '') {
    const name = this.bartenderName(id);
    const intoxication = this.level;
    const cutOff = intoxication >= 0.82;
    const drinks = Math.max(0, Math.floor(Number(this.state?.data?.drinksServed) || 0));
    const effective = this.effectiveIntoxication;
    const coffeeNote =
      this.caffeine > 0.04
        ? ` Coffee has handling effects down to ${Math.round(effective * 100)}% for now.`
        : '';
    const status = `You feel ${stateLabel(effective)} · ${Math.round(intoxication * 100)}% underlying intoxication · ${drinks} alcoholic drink${drinks === 1 ? '' : 's'} served this save.${coffeeNote}`;
    this.ui.panel(
      `${name.toUpperCase()} · KITCHEN BAR`,
      `${lead ? `${lead} ` : ''}${status}${cutOff ? ' The bar will only serve water until the underlying level drops.' : ''}`,
      [
        ...(!cutOff ? DRINKS.map((drink) => [drink.label, () => this.order(id, drink)]) : []),
        ['Water', () => this.water(id)],
        ['Back', () => this.ui.panel('BAR', 'Step away from the kitchen bar.')],
      ],
    );
  }

  handle(target) {
    if (this.sceneManager.current?.definition?.id !== 'downstairs') return false;
    if (target?.action === 'coffee') {
      this.coffeePanel();
      return true;
    }
    const id = target?.npcId ?? target?.id;
    if (!BARTENDERS.has(id)) return false;
    this.state?.meet?.(id);
    this.saveState();
    this.panel(id);
    return true;
  }

  update(dt) {
    if (!this.state?.data) return;
    const beforeAlcohol = this.level;
    const beforeCaffeine = this.caffeine;
    // Alcohol clears slowly. The coffee gameplay boost wears off much faster.
    if (beforeAlcohol > 0) this.state.data.intoxication = clamp(beforeAlcohol - dt * 0.0012);
    if (beforeCaffeine > 0) this.state.data.caffeine = clamp(beforeCaffeine - dt * 0.0032);
    this.syncPlayer();
    if (
      Math.abs(this.level - beforeAlcohol) > 0.00001 ||
      Math.abs(this.caffeine - beforeCaffeine) > 0.00001
    ) {
      this.elapsedSinceSave += dt;
    }
    if (this.elapsedSinceSave >= 8) {
      this.saveState();
      this.elapsedSinceSave = 0;
    }
  }

  snapshot() {
    return {
      intoxication: this.level,
      effectiveIntoxication: this.effectiveIntoxication,
      caffeine: this.caffeine,
      label: stateLabel(this.effectiveIntoxication),
      drinksServed: Math.max(0, Math.floor(Number(this.state?.data?.drinksServed) || 0)),
      coffeesMade: Math.max(0, Math.floor(Number(this.state?.data?.coffeesMade) || 0)),
    };
  }
}
