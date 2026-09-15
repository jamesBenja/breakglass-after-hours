import { CanvasTexture, Sprite, SpriteMaterial, Vector3 } from 'three';
import { PlayerController } from '../player/PlayerController.js';
import { normalizeAvatar } from '../avatar/profile.js';

const shortestAngle = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function makeNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '700 40px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const label = String(name || 'Guest').slice(0, 24);
  const width = Math.min(360, context.measureText(label).width + 52);
  context.fillStyle = 'rgba(7, 7, 10, 0.76)';
  context.beginPath();
  context.roundRect?.((canvas.width - width) / 2, 17, width, 62, 24);
  context.fill();
  context.fillStyle = '#fff';
  context.fillText(label, canvas.width / 2, 48);

  const texture = new CanvasTexture(canvas);
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new Sprite(material);
  sprite.scale.set(2.8, 0.7, 1);
  sprite.position.set(0, 2.36, 0);
  sprite.renderOrder = 10;
  return { sprite, texture, material };
}

export class RemotePlayer {
  constructor({ id, avatar, state, scenes }) {
    this.id = id;
    this.scenes = scenes;
    this.avatar = normalizeAvatar(avatar);
    this.controller = new PlayerController(this.avatar);
    this.object = this.controller.object;
    this.object.name = `remote-player:${id}`;
    this.targetPosition = new Vector3();
    this.lastTargetPosition = new Vector3();
    this.targetRotationY = 0;
    this.sceneId = null;
    this.moving = false;
    this.dancing = false;
    this.seated = false;
    this.grounded = true;
    this.lastPacketAt = performance.now();

    const label = makeNameSprite(this.avatar.displayName);
    this.nameSprite = label.sprite;
    this.nameTexture = label.texture;
    this.nameMaterial = label.material;
    this.object.add(this.nameSprite);

    this.applyState(state, { immediate: true });
  }

  attach(sceneId) {
    const level = this.scenes.get(sceneId);
    if (!level) return false;
    if (this.object.parent !== level.scene) {
      this.object.removeFromParent();
      level.scene.add(this.object);
    }
    this.sceneId = sceneId;
    return true;
  }

  applyState(state = {}, { immediate = false } = {}) {
    const sceneId = typeof state.sceneId === 'string' ? state.sceneId : (this.sceneId ?? 'alley');
    this.attach(sceneId);
    const position = Array.isArray(state.position) ? state.position : [0, 0, 0];
    this.lastTargetPosition.copy(this.targetPosition);
    this.targetPosition.set(
      Number(position[0]) || 0,
      Number(position[1]) || 0,
      Number(position[2]) || 0,
    );
    this.targetRotationY = Number(state.rotationY) || 0;
    this.moving = state.moving === true;
    this.dancing = state.dancing === true;
    this.seated = state.seated === true;
    this.grounded = state.grounded !== false;
    this.lastPacketAt = performance.now();
    if (immediate) {
      this.object.position.copy(this.targetPosition);
      this.object.rotation.y = this.targetRotationY;
    }
  }

  emote(kind) {
    if (kind === 'dance') {
      this.controller.dance(1.8);
      return;
    }
    this.controller.performMultiplayerGesture?.(kind);
  }

  facePosition(position) {
    if (!position) return;
    const dx = Number(position.x ?? position[0]) - this.object.position.x;
    const dz = Number(position.z ?? position[2]) - this.object.position.z;
    if (Math.hypot(dx, dz) > 0.01) {
      const facing = Math.atan2(dx, dz);
      this.targetRotationY = facing;
      this.object.rotation.y = facing;
    }
  }

  update(dt) {
    const positionBlend = 1 - Math.exp(-13 * dt);
    this.object.position.lerp(this.targetPosition, positionBlend);
    this.object.rotation.y +=
      shortestAngle(this.object.rotation.y, this.targetRotationY) * (1 - Math.exp(-16 * dt));

    const remaining = this.object.position.distanceTo(this.targetPosition);
    const packetAge = Math.max(0.001, (performance.now() - this.lastPacketAt) / 1000);
    const estimatedSpeed = this.moving ? Math.min(5.8, remaining / Math.max(dt, 1 / 120) + 1.2) : 0;
    this.controller.velocity.x = this.moving
      ? estimatedSpeed * Math.sin(this.object.rotation.y)
      : 0;
    this.controller.velocity.z = this.moving
      ? estimatedSpeed * Math.cos(this.object.rotation.y)
      : 0;
    this.controller.grounded = this.grounded;
    this.controller.seated = this.seated;
    if (this.dancing)
      this.controller.danceRemaining = Math.max(this.controller.danceRemaining, 0.18);
    this.controller.animate(dt);

    // If updates stop arriving, do not leave a remote avatar walking forever.
    if (packetAge > 0.8) {
      this.moving = false;
      this.controller.velocity.x = 0;
      this.controller.velocity.z = 0;
    }
  }

  interactionTarget() {
    return {
      id: `remote-${this.id}`,
      action: 'remote-player',
      multiplayerId: this.id,
      label: this.avatar.displayName,
      role: this.avatar.role,
      position: this.object.position.toArray(),
      radius: 1.8,
    };
  }

  dispose() {
    this.nameTexture.dispose();
    this.nameMaterial.dispose();
    this.controller.dispose();
  }
}
