import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/world/levels.js';
import { TAKE_A_BREAK_SEATS } from '../src/scenes/geometry/roomFurniture.js';
import { validateSave } from '../src/state/GameState.js';

test('Below room functions are on the correct opposite sides', () => {
  const downstairs = levels.downstairs;
  const lounge = downstairs.navigation.surfaces.find((surface) => surface.id === 'lounge');
  const bar = downstairs.navigation.surfaces.find((surface) => surface.id === 'service');
  assert.ok(lounge.x1 > 6, 'Take A Break should be on the east side');
  assert.ok(bar.x2 < -6, 'bar should be on the west side');
  assert.ok(downstairs.anchors.installation.position[0] > 6);
  assert.ok(downstairs.anchors.coffeeMachine.position[0] < -6);
  assert.ok(TAKE_A_BREAK_SEATS.every(([x]) => x > 6));
});

test('studio stair is gated by Zander and remains spatially accessible', () => {
  const downstairs = levels.downstairs;
  assert.equal(downstairs.anchors.stairs.requires, 'studioAccessGranted');
  assert.ok(downstairs.navigation.surfaces.some((surface) => surface.id === 'studio-stairs'));
  const zander = downstairs.npcs.find((npc) => npc.id === 'zander');
  assert.ok(zander);
  assert.ok(Math.abs(zander.position[0] + 5.42) < 0.01);
});

test('James gates discovery of the house-DJ producer table', () => {
  assert.equal(levels.upstairs.anchors.houseDjDesk.requires, 'houseDjDeskIntroduced');
});

test('new progression flags survive save validation', () => {
  const state = validateSave({
    version: 1,
    sceneId: 'downstairs',
    studioAccessGranted: true,
    houseDjDeskIntroduced: true,
  });
  assert.equal(state.studioAccessGranted, true);
  assert.equal(state.houseDjDeskIntroduced, true);
});
