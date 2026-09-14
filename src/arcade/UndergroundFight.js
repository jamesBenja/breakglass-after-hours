const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const ATTACKS = {
  light: {
    duration: 0.24,
    hitStart: 0.075,
    hitEnd: 0.17,
    range: 0.145,
    damage: 7,
    knockback: 0.026,
  },
  heavy: {
    duration: 0.48,
    hitStart: 0.19,
    hitEnd: 0.32,
    range: 0.195,
    damage: 13,
    knockback: 0.048,
  },
  special: {
    duration: 0.66,
    hitStart: 0.27,
    hitEnd: 0.43,
    range: 0.255,
    damage: 18,
    knockback: 0.075,
  },
};

const fighter = (side, x) => ({
  side,
  x,
  y: 0,
  vy: 0,
  hp: 100,
  facing: side === 'player' ? 1 : -1,
  moveLeft: false,
  moveRight: false,
  blocking: false,
  attack: null,
  attackTime: 0,
  attackHit: false,
  cooldown: 0,
  hitFlash: 0,
  stun: 0,
});

export function createFightState({ mode = 'cpu', roundTime = 60 } = {}) {
  return {
    mode,
    time: roundTime,
    status: 'fight',
    winner: null,
    player: fighter('player', 0.24),
    opponent: fighter('opponent', 0.76),
    cpuThink: 0,
    eventCounter: 0,
    events: [],
  };
}

function emit(state, event) {
  state.eventCounter += 1;
  state.events.push({ id: state.eventCounter, ...event });
}

export function commandFight(state, side, action, pressed = true) {
  if (!state || state.status !== 'fight') return false;
  const actor = side === 'opponent' ? state.opponent : state.player;
  if (!actor) return false;

  if (action === 'left') actor.moveLeft = pressed;
  else if (action === 'right') actor.moveRight = pressed;
  else if (action === 'block') actor.blocking = pressed;
  else if (action === 'jump' && pressed && actor.y <= 0.001 && actor.stun <= 0) {
    actor.vy = 0.88;
    emit(state, { type: 'jump', side });
  } else if (
    ATTACKS[action] &&
    pressed &&
    !actor.attack &&
    actor.cooldown <= 0 &&
    actor.stun <= 0
  ) {
    actor.attack = action;
    actor.attackTime = 0;
    actor.attackHit = false;
    actor.blocking = false;
    actor.cooldown = action === 'special' ? 0.72 : action === 'heavy' ? 0.46 : 0.26;
    emit(state, { type: 'attack', side, attack: action });
  } else return false;
  return true;
}

function updateCpu(state, dt, random) {
  if (state.mode !== 'cpu' || state.status !== 'fight') return;
  const cpu = state.opponent;
  const player = state.player;
  state.cpuThink -= dt;
  if (state.cpuThink > 0 || cpu.stun > 0) return;
  state.cpuThink = 0.12 + random() * 0.2;

  cpu.moveLeft = false;
  cpu.moveRight = false;
  cpu.blocking = false;
  const distance = Math.abs(player.x - cpu.x);
  if (player.attack && distance < 0.22 && random() < 0.48) {
    cpu.blocking = true;
    return;
  }
  if (distance > 0.18) {
    if (player.x < cpu.x) cpu.moveLeft = true;
    else cpu.moveRight = true;
    if (distance > 0.34 && random() < 0.12) commandFight(state, 'opponent', 'jump');
    return;
  }
  const roll = random();
  if (roll < 0.48) commandFight(state, 'opponent', 'light');
  else if (roll < 0.82) commandFight(state, 'opponent', 'heavy');
  else commandFight(state, 'opponent', 'special');
}

function moveFighter(actor, dt) {
  actor.cooldown = Math.max(0, actor.cooldown - dt);
  actor.hitFlash = Math.max(0, actor.hitFlash - dt);
  actor.stun = Math.max(0, actor.stun - dt);

  if (actor.stun <= 0 && !actor.attack) {
    const direction = Number(actor.moveRight) - Number(actor.moveLeft);
    actor.x += direction * 0.29 * dt;
  }

  actor.vy -= 2.25 * dt;
  actor.y += actor.vy * dt;
  if (actor.y < 0) {
    actor.y = 0;
    actor.vy = 0;
  }
  actor.x = clamp(actor.x, 0.075, 0.925);

  if (actor.attack) {
    actor.attackTime += dt;
    if (actor.attackTime >= ATTACKS[actor.attack].duration) {
      actor.attack = null;
      actor.attackTime = 0;
      actor.attackHit = false;
    }
  }
}

function resolveAttack(state, attacker, defender) {
  if (!attacker.attack || attacker.attackHit) return;
  const spec = ATTACKS[attacker.attack];
  if (attacker.attackTime < spec.hitStart || attacker.attackTime > spec.hitEnd) return;
  const distance = Math.abs(attacker.x - defender.x);
  const verticalDistance = Math.abs(attacker.y - defender.y);
  if (distance > spec.range || verticalDistance > 0.17) return;

  attacker.attackHit = true;
  const guarded = defender.blocking && defender.stun <= 0;
  const damage = guarded ? Math.max(1, Math.round(spec.damage * 0.28)) : spec.damage;
  defender.hp = Math.max(0, defender.hp - damage);
  defender.hitFlash = 0.14;
  defender.stun = guarded ? 0.055 : attacker.attack === 'special' ? 0.24 : 0.13;
  const direction = attacker.x < defender.x ? 1 : -1;
  defender.x = clamp(defender.x + direction * spec.knockback * (guarded ? 0.35 : 1), 0.075, 0.925);
  emit(state, {
    type: 'hit',
    side: attacker.side,
    target: defender.side,
    attack: attacker.attack,
    damage,
    guarded,
  });
}

function separateFighters(a, b) {
  const minimum = 0.092;
  const distance = Math.abs(a.x - b.x);
  if (distance >= minimum) return;
  const middle = (a.x + b.x) / 2;
  const half = minimum / 2;
  if (a.x <= b.x) {
    a.x = clamp(middle - half, 0.075, 0.925);
    b.x = clamp(middle + half, 0.075, 0.925);
  } else {
    a.x = clamp(middle + half, 0.075, 0.925);
    b.x = clamp(middle - half, 0.075, 0.925);
  }
}

function finishRound(state) {
  if (state.status !== 'fight') return;
  if (state.player.hp > 0 && state.opponent.hp > 0 && state.time > 0) return;
  state.status = 'finished';
  if (state.player.hp === state.opponent.hp) state.winner = 'draw';
  else state.winner = state.player.hp > state.opponent.hp ? 'player' : 'opponent';
  emit(state, { type: 'round-end', winner: state.winner });
}

export function stepFight(state, dt, random = Math.random) {
  if (!state || state.status !== 'fight') return [];
  state.events.length = 0;
  const step = Math.max(0, Math.min(0.05, Number(dt) || 0));
  state.time = Math.max(0, state.time - step);
  updateCpu(state, step, random);
  moveFighter(state.player, step);
  moveFighter(state.opponent, step);

  state.player.facing = state.player.x <= state.opponent.x ? 1 : -1;
  state.opponent.facing = -state.player.facing;
  separateFighters(state.player, state.opponent);
  resolveAttack(state, state.player, state.opponent);
  resolveAttack(state, state.opponent, state.player);
  finishRound(state);
  return [...state.events];
}
