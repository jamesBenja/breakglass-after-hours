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
      // Raise the upper arm once, then wave mainly from the elbow/forearm instead of swinging the
      // entire limb like a signpost.
      this.rightArm.rotation.x = -0.42;
      this.rightArm.rotation.z = -1.05 - ease * 0.24;
      this.rightForearm.rotation.x = -1.02 + wave * 0.11;
      this.rightForearm.rotation.z = -0.18 + wave * 0.42;
      this.leftArm.rotation.x *= 0.25;
      this.leftForearm.rotation.x *= 0.4;
      this.head.rotation.y = -0.08 * ease;
      this.object.rotation.z += 0.025 * ease;
    } else if (this.multiplayerGesture === 'highfive') {
      // The shoulder brings the hand up and the elbow opens toward the other person. Holding the
      // forearm extension through the midpoint makes contact read clearly in close multiplayer.
      const reach = Math.sin(Math.min(1, progress) * Math.PI);
      const contactHold = progress > 0.34 && progress < 0.7 ? 1 : reach;
      this.rightArm.rotation.x = -0.92 - contactHold * 0.22;
      this.rightArm.rotation.z = -0.72 - contactHold * 0.34;
      this.rightForearm.rotation.x = -0.45 - contactHold * 0.55;
      this.rightForearm.rotation.z = -0.06 - contactHold * 0.08;
      this.leftArm.rotation.x *= 0.18;
      this.leftForearm.rotation.x *= 0.35;
      this.body.rotation.x = -0.045 * contactHold;
      this.body.rotation.y = -0.035 * contactHold;
      this.head.rotation.y = -0.065 * contactHold;
    }

    if (this.multiplayerGestureRemaining <= 0) {
      this.multiplayerGesture = null;
      this.multiplayerGestureDuration = 0;
      this.body.rotation.x = 0;
    }
  };
}
