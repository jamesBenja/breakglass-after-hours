import { Group, Mesh, CapsuleGeometry, SphereGeometry, MeshStandardMaterial } from 'three';
import { disposeObject } from '../scenes/disposeObject.js';

export class PlayerController {
  constructor() {
    this.object = new Group();
    this.object.name = 'player';
    const body = new Mesh(
      new CapsuleGeometry(0.32, 0.9, 4, 8),
      new MeshStandardMaterial({ color: 0xdddddd, roughness: 0.8, metalness: 0.08 }),
    );
    body.position.y = 0.77;
    body.castShadow = true;
    const head = new Mesh(
      new SphereGeometry(0.29, 16, 12),
      new MeshStandardMaterial({ color: 0xb9997b, roughness: 0.8, metalness: 0.08 }),
    );
    head.position.y = 1.62;
    head.castShadow = true;
    this.object.add(body, head);
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
