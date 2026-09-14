import {
  Group,
  Mesh,
  CapsuleGeometry,
  SphereGeometry,
  BoxGeometry,
  MeshStandardMaterial,
} from 'three';
import { disposeObject } from '../scenes/disposeObject.js';
import { avatarPalette, normalizeAvatar } from '../avatar/profile.js';

export class PlayerController {
  constructor(profile) {
    this.object = new Group();
    this.object.name = 'player';
    this.bodyMaterial = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.08 });
    this.skinMaterial = new MeshStandardMaterial({ roughness: 0.82, metalness: 0.02 });
    this.hairMaterial = new MeshStandardMaterial({ roughness: 0.88, metalness: 0.01 });
    this.body = new Mesh(new CapsuleGeometry(0.32, 0.9, 4, 8), this.bodyMaterial);
    this.body.position.y = 0.77;
    this.body.castShadow = true;
    this.head = new Mesh(new SphereGeometry(0.29, 16, 12), this.skinMaterial);
    this.head.position.y = 1.62;
    this.head.castShadow = true;
    this.hair = new Mesh(new BoxGeometry(0.48, 0.18, 0.43), this.hairMaterial);
    this.hair.position.y = 1.84;
    this.hair.castShadow = true;
    this.object.add(this.body, this.head, this.hair);
    this.applyAvatar(profile);

    this.speed = 5.8;
    this.velocity = { x: 0, z: 0 };
    this.coyoteRemaining = 0;
    this.jumpBuffer = 0;
    this.groundTarget = null;
    this.collisionTarget = null;
    this.safePosition = this.position.clone();
    this.landingPulse = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.danceRemaining = 0;
    this.elapsed = 0;
  }

  get position() {
    return this.object.position;
  }

  applyAvatar(profile) {
    this.avatar = normalizeAvatar(profile);
    this.bodyMaterial.color.setHex(avatarPalette.outfit[this.avatar.outfit]);
    this.skinMaterial.color.setHex(avatarPalette.skin[this.avatar.skinTone]);
    this.hairMaterial.color.setHex(avatarPalette.hair[this.avatar.hair]);

    const bodyScale =
      this.avatar.body === 'slim' ? [0.88, 1.02, 0.88] : this.avatar.body === 'broad' ? [1.13, 1.0, 1.08] : [1, 1, 1];
    this.body.scale.set(...bodyScale);
    this.head.scale.setScalar(this.avatar.body === 'broad' ? 1.04 : 1);

    this.hair.visible = this.avatar.hair !== 'bald' && this.avatar.hair !== 'buzz';
    if (this.avatar.hair === 'bob') {
      this.hair.scale.set(1.12, 1.7, 1.15);
      this.hair.position.y = 1.78;
    } else if (this.avatar.hair === 'long') {
      this.hair.scale.set(1.05, 2.5, 1.1);
      this.hair.position.y = 1.7;
    } else {
      this.hair.scale.set(1, 1, 1);
      this.hair.position.y = 1.84;
    }
    if (this.avatar.hair === 'buzz') {
      this.hair.visible = true;
      this.hair.scale.set(1.02, 0.35, 1.02);
      this.hair.position.y = 1.85;
    }
  }

  spawn(position, collision) {
    this.position.fromArray(position);
    const ground = collision.surfaceAt(this.position.x, this.position.z, this.position.y + 0.25);
    this.grounded = !!ground && Math.abs(this.position.y - ground.height) < 0.01;
    this.verticalVelocity = 0;
    this.velocity.x = this.velocity.z = 0;
    this.coyoteRemaining = this.grounded ? 0.13 : 0;
    this.jumpBuffer = 0;
    this.safePosition.copy(this.position);
    this.object.rotation.set(0, 0, 0);
  }

  dance(duration = 70 / 60) {
    this.danceRemaining = duration;
  }

  update(dt, movement, collision, jump = false) {
    if (jump) this.jumpBuffer = 0.16;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    this.collisionTarget = null;
    for (let i = 0; i < steps; i++) this.step(dt / steps, movement, collision);
    this.animate(dt);
  }

  step(dt, movement, collision) {
    this.coyoteRemaining = this.grounded ? 0.13 : Math.max(0, this.coyoteRemaining - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0 && this.coyoteRemaining > 0) {
      this.verticalVelocity = 7.5;
      this.grounded = false;
      this.coyoteRemaining = this.jumpBuffer = 0;
    }
    const input = Math.hypot(movement.x, movement.z);
    const acceleration = this.grounded ? (input ? 42 : 48) : input ? 21 : 3;
    const approach = (value, target) =>
      value + Math.sign(target - value) * Math.min(Math.abs(target - value), acceleration * dt);
    this.velocity.x = approach(this.velocity.x, movement.x * this.speed);
    this.velocity.z = approach(this.velocity.z, movement.z * this.speed);
    const beforeX = this.position.x,
      beforeZ = this.position.z;
    collision.move(this.position, this.velocity.x * dt, this.velocity.z * dt, {
      grounded: this.grounded,
    });
    if (collision.lastTarget) this.collisionTarget = collision.lastTarget;
    if (Math.abs(this.position.x - beforeX) < 0.00001) this.velocity.x = 0;
    if (Math.abs(this.position.z - beforeZ) < 0.00001) this.velocity.z = 0;
    if (input > 0.1) {
      const desired = Math.atan2(movement.x, movement.z);
      const difference = Math.atan2(
        Math.sin(desired - this.object.rotation.y),
        Math.cos(desired - this.object.rotation.y),
      );
      this.object.rotation.y += difference * (1 - Math.exp(-18 * dt));
    }
    const previousY = this.position.y;
    const support = collision.supportAt(this.position.x, this.position.z, previousY + 0.002);
    const snapDistance = this.grounded ? 0.2 : 0.015;
    if (this.verticalVelocity <= 0 && support && previousY - support.height <= snapDistance) {
      this.position.y = support.height;
      this.grounded = true;
      this.verticalVelocity = 0;
    } else {
      this.grounded = false;
      this.verticalVelocity = Math.max(-24, this.verticalVelocity - 21 * dt);
      const nextY = previousY + this.verticalVelocity * dt;
      if (this.verticalVelocity > 0) {
        this.position.y = collision.ceiling(this.position, nextY);
        if (this.position.y < nextY - 0.00001) {
          this.verticalVelocity = 0;
          this.collisionTarget = collision.lastTarget;
        }
      } else if (support && nextY <= support.height) {
        this.position.y = support.height;
        this.landingPulse = Math.min(0.16, Math.abs(this.verticalVelocity) * 0.018);
        this.verticalVelocity = 0;
        this.grounded = true;
      } else this.position.y = nextY;
    }
    this.groundTarget = support?.surface.id ?? null;
    if (this.grounded) this.safePosition.copy(this.position);
    if (this.position.y < -6) this.spawn(this.safePosition.toArray(), collision);
  }

  animate(dt) {
    this.elapsed += dt;
    this.landingPulse *= Math.exp(-12 * dt);
    this.object.scale.set(
      1 + this.landingPulse * 0.35,
      1 - this.landingPulse,
      1 + this.landingPulse * 0.35,
    );
    this.danceRemaining = Math.max(0, this.danceRemaining - dt);
    this.object.rotation.z = this.danceRemaining > 0 ? Math.sin(this.elapsed / 0.085) * 0.13 : 0;
  }

  dispose() {
    this.object.removeFromParent();
    disposeObject(this.object);
  }
}
