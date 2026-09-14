import test from 'node:test';
import assert from 'node:assert/strict';
import { commandFight, createFightState, stepFight } from '../src/arcade/UndergroundFight.js';

test('underground kombat attacks damage an in-range opponent and blocking reduces damage', () => {
  const open = createFightState({ mode: 'two-player' });
  open.player.x = 0.45;
  open.opponent.x = 0.56;
  commandFight(open, 'player', 'heavy');
  for (let i = 0; i < 30; i++) stepFight(open, 1 / 60, () => 1);
  assert.ok(open.opponent.hp <= 87);

  const blocked = createFightState({ mode: 'two-player' });
  blocked.player.x = 0.45;
  blocked.opponent.x = 0.56;
  commandFight(blocked, 'opponent', 'block', true);
  commandFight(blocked, 'player', 'heavy');
  for (let i = 0; i < 30; i++) stepFight(blocked, 1 / 60, () => 1);
  assert.ok(blocked.opponent.hp > open.opponent.hp);
});

test('single-player CPU closes distance and a finished round reports a winner', () => {
  const state = createFightState({ mode: 'cpu', roundTime: 1 });
  state.player.x = 0.15;
  state.opponent.x = 0.85;
  const start = state.opponent.x;
  for (let i = 0; i < 24; i++) stepFight(state, 1 / 60, () => 0.6);
  assert.ok(state.opponent.x < start);
  state.opponent.hp = 0;
  stepFight(state, 1 / 60, () => 0.6);
  assert.equal(state.status, 'finished');
  assert.equal(state.winner, 'player');
});
