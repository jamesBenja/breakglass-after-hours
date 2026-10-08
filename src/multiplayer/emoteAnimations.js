import { socialGestureDuration } from '../gameplay/DanceFloorSocial.js';
import { PlayerController } from '../player/PlayerController.js';

let gestureMethodInstalled = false;
let prototypeInstalled = false;
const installedPlayers = new WeakSet();

function installGestureMethod() {
  if (gestureMethodInstalled) return;
  gestureMethodInstalled = true;

  PlayerController.prototype.performMultiplayerGesture = function performMultiplayerGesture(kind) {
    const duration = socialGestureDuration(kind);
    if (!duration || this.seated) return false;
    this.multiplayerGesture = kind;
    this.multiplayerGestureDuration = duration;
    this.multiplayerGestureRemaining = duration;
    return true;
  };
}

export function applyPlayerSocialGestureFrame(player, dt) {
  if (!player?.multiplayerGesture || player.seated) return false;

  player.multiplayerGestureRemaining = Math.max(0, player.multiplayerGestureRemaining - dt);
  const duration = Math.max(0.001, player.multiplayerGestureDuration || 1);
  const progress = 1 - player.multiplayerGestureRemaining / duration;
  const ease = Math.sin(Math.min(1, progress) * Math.PI);

  if (player.multiplayerGesture === 'wave') {
    const wave = Math.sin(progress * Math.PI * 7.5);
    player.rightArm.rotation.x = -0.42;
    player.rightArm.rotation.z = -1.05 - ease * 0.24;
    player.rightForearm.rotation.x = -1.02 + wave * 0.11;
    player.rightForearm.rotation.z = -0.18 + wave * 0.42;
    player.leftArm.rotation.x *= 0.25;
    player.leftForearm.rotation.x *= 0.4;
    player.head.rotation.y = -0.08 * ease;
    player.object.rotation.z += 0.025 * ease;
  } else if (player.multiplayerGesture === 'dance') {
    const hip = Math.sin(progress * Math.PI * 10);
    const bounce = Math.abs(Math.sin(progress * Math.PI * 8));
    const arms = Math.sin(progress * Math.PI * 5);
    player.body.rotation.y = hip * 0.3;
    player.body.rotation.z = hip * 0.09;
    player.body.position.y += bounce * 0.055;
    player.leftArm.rotation.x = 0.35 + arms * 0.55;
    player.rightArm.rotation.x = -0.35 - arms * 0.55;
    player.leftArm.rotation.z = -0.28 + hip * 0.22;
    player.rightArm.rotation.z = 0.28 + hip * 0.22;
    player.leftForearm.rotation.x = -0.48 - Math.max(0, arms) * 0.35;
    player.rightForearm.rotation.x = -0.48 - Math.max(0, -arms) * 0.35;
    player.leftKnee.rotation.x += 0.12 + Math.max(0, hip) * 0.28;
    player.rightKnee.rotation.x += 0.12 + Math.max(0, -hip) * 0.28;
    player.head.rotation.y = -hip * 0.12;
    player.object.rotation.z += hip * 0.035;
  } else if (player.multiplayerGesture === 'highfive') {
    const reach = Math.sin(Math.min(1, progress) * Math.PI);
    const contactHold = progress > 0.34 && progress < 0.7 ? 1 : reach;
    player.rightArm.rotation.x = -0.92 - contactHold * 0.22;
    player.rightArm.rotation.z = -0.72 - contactHold * 0.34;
    player.rightForearm.rotation.x = -0.45 - contactHold * 0.55;
    player.rightForearm.rotation.z = -0.06 - contactHold * 0.08;
    player.leftArm.rotation.x *= 0.18;
    player.leftForearm.rotation.x *= 0.35;
    player.body.rotation.x = -0.045 * contactHold;
    player.body.rotation.y = -0.035 * contactHold;
    player.head.rotation.y = -0.065 * contactHold;
  } else if (player.multiplayerGesture === 'handsup') {
    const sway = Math.sin(progress * Math.PI * 8);
    const bounce = Math.abs(Math.sin(progress * Math.PI * 6));
    player.leftArm.rotation.x = -0.24;
    player.rightArm.rotation.x = -0.24;
    player.leftArm.rotation.z = 1.52 + sway * 0.12;
    player.rightArm.rotation.z = -1.52 + sway * 0.12;
    player.leftForearm.rotation.x = -0.35 - bounce * 0.18;
    player.rightForearm.rotation.x = -0.35 - bounce * 0.18;
    player.body.position.y += bounce * 0.045;
    player.body.rotation.z = sway * 0.1;
    player.leftKnee.rotation.x += bounce * 0.16;
    player.rightKnee.rotation.x += (1 - bounce) * 0.12;
    player.head.rotation.y = -sway * 0.08;
  } else if (player.multiplayerGesture === 'shake') {
    const shake = Math.sin(progress * Math.PI * 14);
    const bounce = Math.abs(Math.sin(progress * Math.PI * 8));
    player.body.rotation.y = shake * 0.38;
    player.body.rotation.z = shake * 0.08;
    player.body.position.y -= 0.045 + bounce * 0.035;
    player.leftLeg.rotation.x = -0.16 + shake * 0.08;
    player.rightLeg.rotation.x = -0.16 - shake * 0.08;
    player.leftKnee.rotation.x += 0.24 + Math.max(0, shake) * 0.22;
    player.rightKnee.rotation.x += 0.24 + Math.max(0, -shake) * 0.22;
    player.leftArm.rotation.x = -0.1 - shake * 0.2;
    player.rightArm.rotation.x = -0.1 + shake * 0.2;
    player.leftArm.rotation.z = -0.28 + shake * 0.22;
    player.rightArm.rotation.z = 0.28 + shake * 0.22;
    player.head.rotation.y = -shake * 0.12;
    player.object.rotation.z += shake * 0.035;
  } else if (player.multiplayerGesture === 'grind') {
    const hip = Math.sin(progress * Math.PI * 10);
    const dip = Math.abs(Math.sin(progress * Math.PI * 5));
    player.body.rotation.y = hip * 0.34;
    player.body.rotation.z = hip * 0.07;
    player.body.position.y -= 0.04 + dip * 0.055;
    player.leftLeg.rotation.x = -0.18 + hip * 0.08;
    player.rightLeg.rotation.x = -0.18 - hip * 0.08;
    player.leftKnee.rotation.x += 0.22 + dip * 0.24;
    player.rightKnee.rotation.x += 0.22 + dip * 0.24;
    player.leftArm.rotation.x = -0.28 + hip * 0.12;
    player.rightArm.rotation.x = -0.28 - hip * 0.12;
    player.leftForearm.rotation.x = -0.44;
    player.rightForearm.rotation.x = -0.44;
  } else if (player.multiplayerGesture === 'circle') {
    const pulse = Math.sin(progress * Math.PI * 10);
    const bounce = Math.abs(Math.sin(progress * Math.PI * 7));
    player.leftArm.rotation.z = 1.18 + pulse * 0.32;
    player.rightArm.rotation.z = -1.18 + pulse * 0.32;
    player.leftForearm.rotation.x = -0.72 - Math.max(0, pulse) * 0.3;
    player.rightForearm.rotation.x = -0.72 - Math.max(0, -pulse) * 0.3;
    player.body.rotation.y = pulse * 0.18;
    player.body.rotation.z = pulse * 0.07;
    player.body.position.y += bounce * 0.055;
    player.leftKnee.rotation.x += 0.12 + Math.max(0, pulse) * 0.22;
    player.rightKnee.rotation.x += 0.12 + Math.max(0, -pulse) * 0.22;
  }

  if (player.multiplayerGestureRemaining <= 0) {
    player.multiplayerGesture = null;
    player.multiplayerGestureDuration = 0;
    player.body.rotation.x = 0;
  }
  return true;
}

function wrapPlayerInstance(player) {
  if (!player || installedPlayers.has(player)) return;
  installedPlayers.add(player);
  const baseAnimate = player.animate.bind(player);
  player.animate = (dt) => {
    baseAnimate(dt);
    applyPlayerSocialGestureFrame(player, dt);
  };
}

function installPrototypeFallback() {
  if (prototypeInstalled) return;
  prototypeInstalled = true;
  const baseAnimate = PlayerController.prototype.animate;
  PlayerController.prototype.animate = function animateMultiplayerGesture(dt) {
    baseAnimate.call(this, dt);
    applyPlayerSocialGestureFrame(this, dt);
  };
}

export function installMultiplayerEmoteAnimations(player = null) {
  installGestureMethod();

  // The live game already has an instance-level animate wrapper installed by the performance
  // realism pass. Wrap that exact live function so social gestures run after those pose systems
  // instead of patching a prototype that the player instance no longer calls.
  if (player) {
    wrapPlayerInstance(player);
    return;
  }

  // Keep a prototype fallback for isolated PlayerController consumers and tests.
  installPrototypeFallback();
}
