const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export const REQUIRED_GOOD_PLUNGES = 4;
export const PLUNGE_ANGLE_TOLERANCE = 7;

export function createPlungeChallenge(attempt = 0) {
  const targets = [45, 60, 35];
  return {
    angle: attempt % 2 === 0 ? 20 : 75,
    targetAngle: targets[Math.abs(Math.floor(attempt)) % targets.length],
    water: 36,
    goodPlunges: 0,
    turns: 0,
    lastSeal: 'The cup is not sealed yet.',
    status: 'active',
  };
}

const resolveFlood = (challenge) => ({
  ...challenge,
  water: clamp(challenge.water, 0, 100),
  status: challenge.water >= 100 ? 'flooded' : challenge.status,
});

export function adjustPlungerAngle(challenge, delta) {
  if (!challenge || challenge.status !== 'active') return challenge;
  const next = {
    ...challenge,
    angle: clamp(challenge.angle + Number(delta || 0), 5, 85),
    water: challenge.water + 5,
    turns: challenge.turns + 1,
  };
  const offset = next.targetAngle - next.angle;
  next.lastSeal =
    Math.abs(offset) <= PLUNGE_ANGLE_TOLERANCE
      ? 'The rubber cup sits flat. You have a good seal.'
      : offset > 0
        ? 'The seal is leaking on the right. Tilt the handle farther right.'
        : 'The seal is leaking on the left. Tilt the handle farther left.';
  return resolveFlood(next);
}

export function plungeToilet(challenge) {
  if (!challenge || challenge.status !== 'active') return challenge;
  const offset = Math.abs(challenge.targetAngle - challenge.angle);
  const sealed = offset <= PLUNGE_ANGLE_TOLERANCE;
  const goodPlunges = challenge.goodPlunges + (sealed ? 1 : 0);
  const water = challenge.water + 7 + (sealed ? -18 : 18);
  const status = goodPlunges >= REQUIRED_GOOD_PLUNGES ? 'cleared' : 'active';
  return resolveFlood({
    ...challenge,
    water,
    goodPlunges,
    turns: challenge.turns + 1,
    status,
    lastSeal: sealed
      ? 'Good seal. The drain gulps and the water drops.'
      : 'Bad angle. Air slips past the cup and the bowl surges higher.',
  });
}

function percent(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

export class ClubBathroomSystem {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.challenge = null;
  }

  data() {
    return this.game.state.data;
  }

  save() {
    this.game.save?.();
  }

  floodMesh() {
    return this.game.scenes?.get?.('downstairs')?.scene?.getObjectByName?.('bathroom-flood-water');
  }

  syncFloodVisual() {
    const mesh = this.floodMesh();
    if (mesh) mesh.visible = this.data().bathroomFlooded === true;
  }

  useFixture(target) {
    this.syncFloodVisual();
    const kind = target.fixtureKind ?? 'toilet';
    if (kind === 'sink') {
      this.ui.panel(
        'BELOW BATHROOM · SINK',
        'A battered club sink, soap and paper towel dispenser. The tap works.',
        [['Wash your hands', () => this.washHands()]],
      );
      return;
    }

    const label = kind === 'urinal' ? 'URINAL' : (target.name ?? 'TOILET').toUpperCase();
    if (this.data().bathroomFlooded) {
      this.ui.panel(
        `BELOW BATHROOM · ${label}`,
        'There is water across the bathroom floor. The plumbing needs to be reset before anybody should use this.',
        [['Mop up and reset the drain', () => this.resetFlood()]],
      );
      return;
    }

    if (target.clogged && !this.data().bathroomClogCleared) {
      this.ui.panel(
        'STALL 2 · CLOGGED TOILET',
        'The bowl is already too full. One flush will send it over the edge. The plunger is beside the stall.',
        [
          ['Plunge it before it floods', () => this.startChallenge()],
          ['Back away from the toilet', () => {}],
        ],
      );
      return;
    }

    this.ui.panel(
      `BELOW BATHROOM · ${label}`,
      kind === 'urinal'
        ? 'You use the urinal. Functional club infrastructure counts as a luxury at this hour.'
        : 'You use the toilet and flush. Everything disappears the way it is supposed to.',
      [['Wash your hands', () => this.washHands()]],
    );
    this.data().bathroomUses = Math.min(999, (this.data().bathroomUses ?? 0) + 1);
    this.save();
  }

  washHands() {
    this.data().handsWashed = Math.min(999, (this.data().handsWashed ?? 0) + 1);
    this.save();
    this.ui.panel(
      'HANDS WASHED',
      'Soap, water, rinse. The bass is still coming through the wall while you dry your hands.',
      [],
    );
  }

  startChallenge() {
    const attempt = (this.data().bathroomPlungeWins ?? 0) + (this.data().bathroomFloods ?? 0);
    this.data().bathroomFlooded = false;
    this.challenge = createPlungeChallenge(attempt);
    this.syncFloodVisual();
    this.showChallenge();
  }

  changeAngle(delta) {
    this.challenge = adjustPlungerAngle(this.challenge, delta);
    this.resolveChallenge();
  }

  plunge() {
    this.challenge = plungeToilet(this.challenge);
    this.resolveChallenge();
  }

  resolveChallenge() {
    if (this.challenge?.status === 'cleared') {
      this.data().bathroomClogCleared = true;
      this.data().bathroomFlooded = false;
      this.data().bathroomPlungeWins = Math.min(999, (this.data().bathroomPlungeWins ?? 0) + 1);
      this.save();
      this.syncFloodVisual();
      this.ui.panel(
        'DRAIN CLEARED',
        `Four solid plunges with a proper seal. The water drops from ${percent(this.challenge.water)} and the toilet drains cleanly.`,
        [
          [
            'Use the toilet',
            () => this.useFixture({ name: 'Stall 2 toilet', fixtureKind: 'toilet' }),
          ],
          ['Practice the plunger again', () => this.startChallenge()],
        ],
      );
      return;
    }

    if (this.challenge?.status === 'flooded') {
      this.data().bathroomFlooded = true;
      this.data().bathroomFloods = Math.min(999, (this.data().bathroomFloods ?? 0) + 1);
      this.save();
      this.syncFloodVisual();
      this.ui.panel(
        'TOILET FLOOD',
        'Too late. The bowl crests and water starts running across the tile.',
        [['Mop up, reset and try again', () => this.resetFlood(true)]],
      );
      return;
    }
    this.showChallenge();
  }

  resetFlood(retry = false) {
    this.data().bathroomFlooded = false;
    this.challenge = null;
    this.save();
    this.syncFloodVisual();
    if (retry) this.startChallenge();
    else
      this.ui.panel(
        'BELOW BATHROOM',
        'The floor is mopped and the bowl has settled. The plunger is still beside Stall 2.',
        [['Try the plunger', () => this.startChallenge()]],
      );
  }

  showChallenge() {
    const challenge = this.challenge;
    if (!challenge) return this.startChallenge();
    this.ui.panel(
      'STALL 2 · PLUNGER',
      `Water ${percent(challenge.water)} · handle ${Math.round(challenge.angle)}° · good plunges ${challenge.goodPlunges}/${REQUIRED_GOOD_PLUNGES}. ${challenge.lastSeal} Every adjustment costs time and the bowl keeps filling.`,
      [
        ['Tilt handle left −5°', () => this.changeAngle(-5)],
        ['Tilt handle right +5°', () => this.changeAngle(5)],
        ['PLUNGE', () => this.plunge()],
        ['Stop plunging', () => {}],
      ],
    );
  }

  handle(target) {
    if (target?.action === 'bathroomFixture') {
      this.useFixture(target);
      return true;
    }
    if (target?.action === 'bathroomPlunge') {
      this.startChallenge();
      return true;
    }
    return false;
  }
}

export function installClubBathroomSystem(game, ui) {
  if (!game || game._clubBathroomSystemInstalled) return game?.clubBathroom ?? null;
  game._clubBathroomSystemInstalled = true;
  const bathroom = new ClubBathroomSystem(game, ui);
  game.clubBathroom = bathroom;
  const baseDispatch = game.interactions.dispatch.bind(game.interactions);
  game.interactions.dispatch = (target) => {
    if (bathroom.handle(target)) return;
    baseDispatch(target);
  };
  return bathroom;
}
