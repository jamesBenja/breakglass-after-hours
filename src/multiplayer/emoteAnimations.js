import { PlayerController } from '../player/PlayerController.js';

let installed = false;

const durations = {
  wave: 1.35,
  highfive: 1.05,
};

export function installMultiplayerEmoteAnimations() {
  if (installed) return;
  installed = true;

  const baseAnimate = PlayerController.prototype.animate;

  PlayerController.prototype.performMultiplayerGesture = function performMultiplayerGesture(kind) {
    if (!durations[kind] || this.seated) return false;
    this.multiplayerGesture = kind;
    this.multiplayerGestureDuration = durations[kind];
    this.multiplayerGestureRemaining = durations[kind];
    return true;
  };

  PlayerController.prototype.animate = function animateMultiplayerGesture(dt) {
    baseAnimate.call(this, dt);
    if (!this.multiplayerGesture || this.seated) return;

    this.multiplayerGestureRemaining = Math.max(0, this.multiplayerGestureRemaining - dt);
    const duration = Math.max(0.001, this.multiplayerGestureDuration || 1);
    const progress = 1 - this.multiplayerGestureRemaining / duration;
    const ease = Math.sin(Math.min(1, progress) * Math.PI);

    if (this.multiplayerGesture === 'wave') {
      const wave = Math.sin(progress * Math.PI * 7.5);
      this.rightArm.rotation.x = -0.22 + wave * 0.18;
      this.rightArm.rotation.z = -1.55 - wave * 0.28;
      this.leftArm.rotation.x *= 0.25;
      this.head.rotation.y = -0.08 * ease;
      this.object.rotation.z += 0.035 * ease;
    } else if (this.multiplayerGesture === 'highfive') {
      // One clear hand-up-and-forward motion, held near the midpoint long enough to read as a
      // high-five rather than another wave.
      const reach = Math.sin(Math.min(1, progress) * Math.PI);
      const contactHold = progress > 0.34 && progress < 0.7 ? 1 : reach;
      this.rightArm.rotation.x = -1.08 - contactHold * 0.42;
      this.rightArm.rotation.z = -0.82 - contactHold * 0.48;
      this.leftArm.rotation.x *= 0.18;
      this.body.rotation.x = -0.05 * contactHold;
      this.head.rotation.y = -0.06 * contactHold;
    }

    if (this.multiplayerGestureRemaining <= 0) {
      this.multiplayerGesture = null;
      this.multiplayerGestureDuration = 0;
      this.body.rotation.x = 0;
    }
  };
}
