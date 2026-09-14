import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { CompanionMaddoxSystem } from '../src/pets/CompanionMaddoxSystem.js';

test('companion-only Maddox stays hidden until enabled and then follows the player', () => {
  const root = new Group();
  const maddox = new CompanionMaddoxSystem(root, {
    companionOnly: true,
    start: [0, 0, 0],
    speed: 3,
  });
  assert.equal(maddox.root.visible, false);
  assert.deepEqual(maddox.interactionTargets(), []);

  const player = new Vector3(4, 0, 0);
  maddox.setPresence({ visible: true, following: true, position: player, snap: false });
  const start = maddox.positionOf().x;
  for (let i = 0; i < 70; i++) maddox.update(1 / 60, {}, player);
  assert.equal(maddox.root.visible, true);
  assert.equal(maddox.snapshot().following, true);
  assert.ok(maddox.positionOf().x > start);
  assert.ok(Math.abs(player.x - maddox.positionOf().x) < 1.5);
  maddox.dispose();
});
