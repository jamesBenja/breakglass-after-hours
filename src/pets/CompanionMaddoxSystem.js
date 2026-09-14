import { Vector3 } from 'three';
import { MaddoxSystem } from './MaddoxSystem.js';

const followPoint = new Vector3();

/**
 * Extends the memorial/roof-guide Maddox with an optional cross-room companion mode.
 * The base dog behavior remains unchanged until the player unlocks him.
 */
export class CompanionMaddoxSystem extends MaddoxSystem {
  constructor(root, config = {}) {
    super(root, config);
    this.companionOnly = config.companionOnly === true;
    this.following = false;
    this.root.visible = !this.companionOnly;
  }

  interactionTargets() {
    if (!this.root.visible) return [];
    return super.interactionTargets();
  }

  setFollowing(enabled) {
    const next = enabled === true;
    if (next === this.following) return;
    this.following = next;
    this.currentTarget = null;
    this.pendingNap = false;
    this.leadRoute = [];
    this.leadIndex = 0;
    this.arrivedAtLeadTarget = false;
    this.state = next ? 'follow' : 'roam';
    this.stateTime = 0;
  }

  setPresence({ visible = true, following = false, position = null, snap = false } = {}) {
    this.root.visible = visible === true;
    this.setFollowing(this.root.visible && following === true);
    if (this.root.visible && snap && position) {
      const x = Number(position.x ?? position[0]) || 0;
      const y = Number(position.y ?? position[1]) || 0;
      const z = Number(position.z ?? position[2]) || 0;
      this.root.position.set(x - 0.8, y, z + 0.72);
    }
  }

  update(dt, metrics, playerPosition = null) {
    if (!this.root.visible) return;
    if (!this.following || !playerPosition) {
      super.update(dt, metrics);
      return;
    }

    const dx = playerPosition.x - this.root.position.x;
    const dz = playerPosition.z - this.root.position.z;
    const distance = Math.hypot(dx, dz);

    // Scene transitions can put the player into another coordinate system. Snap Maddox nearby
    // rather than making him run across impossible geometry from the previous authored space.
    if (distance > 8) {
      this.root.position.set(playerPosition.x - 0.8, playerPosition.y, playerPosition.z + 0.72);
    }

    const nextDx = playerPosition.x - this.root.position.x;
    const nextDz = playerPosition.z - this.root.position.z;
    const nextDistance = Math.max(0.0001, Math.hypot(nextDx, nextDz));
    const desiredGap = 1.05;
    if (nextDistance > 1.28) {
      followPoint.set(
        playerPosition.x - (nextDx / nextDistance) * desiredGap,
        playerPosition.y,
        playerPosition.z - (nextDz / nextDistance) * desiredGap,
      );
      this.leadRoute = [followPoint.clone()];
      this.leadIndex = 0;
      this.arrivedAtLeadTarget = false;
      this.state = 'lead';
    } else {
      this.leadRoute = [this.root.position.clone()];
      this.leadIndex = 0;
      this.arrivedAtLeadTarget = false;
      this.state = 'sit';
    }

    super.update(dt, metrics);
    // `super.update` uses lead/sit internally for the walking animation. Preserve the public
    // companion state so interactions and debugging can tell why he is staying near the player.
    this.following = true;
  }

  snapshot() {
    return {
      ...super.snapshot(),
      following: this.following,
      visible: this.root.visible,
    };
  }
}
