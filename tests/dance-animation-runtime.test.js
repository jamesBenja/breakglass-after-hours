import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerController } from '../src/player/PlayerController.js';
import { installMultiplayerEmoteAnimations } from '../src/multiplayer/emoteAnimations.js';

test('social gestures animate the live player even when an earlier system owns animate()', () => {
  const player = new PlayerController();

  // Reproduce the production ordering bug: PerformanceRealism installs an own-property wrapper
  // before multiplayer gestures are installed, so prototype-only patches are bypassed.
  const preMultiplayerAnimate = player.animate.bind(player);
  player.animate = (dt) => preMultiplayerAnimate(dt);

  installMultiplayerEmoteAnimations(player);
  assert.equal(Object.hasOwn(player, 'animate'), true);
  assert.equal(player.performMultiplayerGesture('handsup'), true);

  player.animate(0.25);

  assert.ok(Math.abs(player.leftArm.rotation.z) > 1, 'left arm should visibly raise');
  assert.ok(Math.abs(player.rightArm.rotation.z) > 1, 'right arm should visibly raise');
  assert.ok(player.multiplayerGestureRemaining > 0);
  assert.ok(player.multiplayerGestureRemaining < player.multiplayerGestureDuration);

  player.dispose();
});

test('shake is a visibly different pose from the original idle stance', () => {
  const player = new PlayerController();
  const preMultiplayerAnimate = player.animate.bind(player);
  player.animate = (dt) => preMultiplayerAnimate(dt);
  installMultiplayerEmoteAnimations(player);

  assert.equal(player.performMultiplayerGesture('shake'), true);
  player.animate(0.2);

  const movement =
    Math.abs(player.body.rotation.y) +
    Math.abs(player.body.rotation.z) +
    Math.abs(player.leftKnee.rotation.x) +
    Math.abs(player.rightKnee.rotation.x);
  assert.ok(movement > 0.45, 'shake should visibly move hips/body/knees');

  player.dispose();
});
