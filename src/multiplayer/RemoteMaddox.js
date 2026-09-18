import { Group, Vector3 } from 'three';
import { MaddoxSystem } from '../pets/MaddoxSystem.js';

const shortestAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const STATES = new Set(['roam', 'lead', 'follow', 'sit', 'nap', 'pet', 'belly']);

export class RemoteMaddox {
  constructor({ ownerId, ownerName, scenes }) {
    this.ownerId = ownerId;
    this.ownerName = ownerName || 'Guest';
    this.scenes = scenes;
    this.sceneId = null;
    this.visible = false;
    this.targetPosition = new Vector3();
    this.targetRotationY = 0;
    this.state = 'sit';
    this.moving = false;
    this.petPulse = 0;
    this.bellyRubPulse = 0;

    const holder = new Group();
    this.dog = new MaddoxSystem(holder, {
      name: `Maddox · ${this.ownerName}`,
      start: [0, 0, 0],
      speed: 0,
    });
    this.dog.root.name = `remote-maddox:${ownerId}`;
    this.dog.root.visible = false;
  }

  attach(sceneId) {
    const level = this.scenes.get(sceneId);
    if (!level) return false;
    const parent = level.gameplay ?? level.scene;
    if (this.dog.root.parent !== parent) {
      this.dog.root.removeFromParent();
      parent.add(this.dog.root);
    }
    this.sceneId = sceneId;
    return true;
  }

  applyState(value = null, sceneId, { immediate = false } = {}) {
    const unlocked = value?.unlocked === true;
    const visible = unlocked && value?.visible === true;
    const changedScene = this.sceneId != null && sceneId !== this.sceneId;

    if (!visible) {
      this.visible = false;
      this.dog.root.visible = false;
      if (sceneId && this.sceneId !== sceneId) this.sceneId = sceneId;
      return;
    }

    if (!this.attach(sceneId)) {
      this.visible = false;
      this.dog.root.visible = false;
      return;
    }

    const position = Array.isArray(value.position) ? value.position : [0, 0, 0];
    this.targetPosition.set(
      Number(position[0]) || 0,
      Number(position[1]) || 0,
      Number(position[2]) || 0,
    );
    this.targetRotationY = Number(value.rotationY) || 0;
    this.state = STATES.has(value.state) ? value.state : 'sit';
    this.moving = value.moving === true;
    this.petPulse = Math.max(0, Math.min(1, Number(value.petPulse) || 0));
    this.bellyRubPulse = Math.max(0, Math.min(1, Number(value.bellyRubPulse) || 0));
    this.visible = true;
    this.dog.root.visible = true;

    if (immediate || changedScene || this.dog.root.position.distanceTo(this.targetPosition) > 7) {
      this.dog.root.position.copy(this.targetPosition);
      this.dog.root.rotation.y = this.targetRotationY;
    }
  }

  update(dt) {
    if (!this.visible || !this.dog.root.visible) return;
    const blend = 1 - Math.exp(-13 * dt);
    this.dog.root.position.lerp(this.targetPosition, blend);
    this.dog.root.rotation.y +=
      shortestAngle(this.dog.root.rotation.y, this.targetRotationY) * (1 - Math.exp(-16 * dt));

    this.dog.elapsed += dt;
    this.dog.state = this.state;
    this.dog.moving = this.moving;
    this.dog.petPulse = Math.max(this.dog.petPulse, this.petPulse * 1.6);
    this.dog.bellyRubPulse = Math.max(this.dog.bellyRubPulse, this.bellyRubPulse * 1.6);
    this.dog.petPulse = Math.max(0, this.dog.petPulse - dt);
    this.dog.bellyRubPulse = Math.max(0, this.dog.bellyRubPulse - dt);
    this.dog.animatePose(dt, this.moving);
  }

  dispose() {
    this.dog.dispose();
  }
}
