import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { disposeObject } from '../scenes/disposeObject.js';
import { avatarPalette, normalizeAvatar } from '../avatar/profile.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const standard = (options) =>
  new MeshStandardMaterial({ roughness: 0.82, metalness: 0.02, ...options });

export class PlayerController {
  constructor(profile) {
    this.object = new Group();
    this.object.name = 'player';
    this.bodyMaterial = standard();
    this.skinMaterial = standard();
    this.hairMaterial = standard({ roughness: 0.9 });
    this.trouserMaterial = standard({ color: 0x25272d, roughness: 0.9 });
    this.shoeMaterial = standard({ color: 0x17191d, roughness: 0.78 });
    this.eyeMaterial = standard({ color: 0x17151a, roughness: 0.5 });
    this.mouthMaterial = standard({ color: 0x704946, roughness: 0.8 });

    this.body = new Mesh(new CapsuleGeometry(0.29, 0.64, 5, 9), this.bodyMaterial);
    this.body.position.y = 1.02;
    this.body.castShadow = true;

    this.neck = new Mesh(new CapsuleGeometry(0.09, 0.08, 4, 7), this.skinMaterial);
    this.neck.position.y = 1.47;

    this.head = new Mesh(new SphereGeometry(0.255, 16, 12), this.skinMaterial);
    this.head.scale.set(0.92, 1.08, 0.95);
    this.head.position.y = 1.69;
    this.head.castShadow = true;
    for (const x of [-0.08, 0.08]) {
      const eye = new Mesh(new SphereGeometry(0.022, 7, 5), this.eyeMaterial);
      eye.position.set(x, 0.03, 0.235);
      this.head.add(eye);
      const brow = new Mesh(new BoxGeometry(0.075, 0.014, 0.012), this.hairMaterial);
      brow.position.set(x, 0.092, 0.235);
      brow.rotation.z = x < 0 ? -0.08 : 0.08;
      this.head.add(brow);
    }
    const nose = new Mesh(new SphereGeometry(0.034, 7, 5), this.skinMaterial);
    nose.scale.set(0.75, 1.1, 0.9);
    nose.position.set(0, -0.018, 0.246);
    this.head.add(nose);
    const mouth = new Mesh(new BoxGeometry(0.09, 0.014, 0.016), this.mouthMaterial);
    mouth.position.set(0, -0.105, 0.226);
    this.head.add(mouth);
    for (const x of [-0.255, 0.255]) {
      const ear = new Mesh(new SphereGeometry(0.045, 7, 5), this.skinMaterial);
      ear.scale.set(0.55, 1, 0.48);
      ear.position.set(x, -0.005, 0);
      this.head.add(ear);
    }

    this.hair = new Mesh(new BoxGeometry(0.45, 0.2, 0.43), this.hairMaterial);
    this.hair.position.y = 1.91;
    this.hair.castShadow = true;

    this.leftArm = new Mesh(new CapsuleGeometry(0.078, 0.43, 4, 7), this.bodyMaterial);
    this.rightArm = this.leftArm.clone();
    this.leftArm.material = this.bodyMaterial;
    this.rightArm.material = this.bodyMaterial;
    this.leftArm.position.set(-0.37, 1.08, 0);
    this.rightArm.position.set(0.37, 1.08, 0);
    this.leftArm.rotation.z = -0.06;
    this.rightArm.rotation.z = 0.06;
    for (const arm of [this.leftArm, this.rightArm]) {
      const hand = new Mesh(new SphereGeometry(0.077, 8, 6), this.skinMaterial);
      hand.position.y = -0.31;
      arm.add(hand);
      arm.castShadow = true;
    }

    this.leftLeg = new Mesh(new CapsuleGeometry(0.095, 0.5, 4, 7), this.trouserMaterial);
    this.rightLeg = this.leftLeg.clone();
    this.leftLeg.material = this.trouserMaterial;
    this.rightLeg.material = this.trouserMaterial;
    this.leftLeg.position.set(-0.14, 0.43, 0);
    this.rightLeg.position.set(0.14, 0.43, 0);
    this.leftLeg.castShadow = this.rightLeg.castShadow = true;

    this.leftShoe = new Mesh(new BoxGeometry(0.18, 0.1, 0.3), this.shoeMaterial);
    this.rightShoe = this.leftShoe.clone();
    this.leftShoe.material = this.shoeMaterial;
    this.rightShoe.material = this.shoeMaterial;
    this.leftShoe.position.set(-0.14, 0.07, 0.07);
    this.rightShoe.position.set(0.14, 0.07, 0.07);

    this.jacket = new Mesh(new BoxGeometry(0.5, 0.1, 0.08), this.bodyMaterial);
    this.jacket.position.set(0, 1.26, 0.26);
    this.jacket.rotation.x = -0.08;

    this.object.add(
      this.body,
      this.neck,
      this.head,
      this.hair,
      this.leftArm,
      this.rightArm,
      this.leftLeg,
      this.rightLeg,
      this.leftShoe,
      this.rightShoe,
      this.jacket,
    );
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
    this.intoxication = 0;
    this.elapsed = 0;
    this.seated = false;
  }

  get position() {
    return this.object.position;
  }

  setIntoxication(value) {
    this.intoxication = clamp(Number(value) || 0);
  }

  applyAvatar(profile) {
    this.avatar = normalizeAvatar(profile);
    this.bodyMaterial.color.setHex(avatarPalette.outfit[this.avatar.outfit]);
    this.skinMaterial.color.setHex(avatarPalette.skin[this.avatar.skinTone]);
    this.hairMaterial.color.setHex(avatarPalette.hair[this.avatar.hair]);

    const bodyScale =
      this.avatar.body === 'slim'
        ? [0.88, 1.02, 0.88]
        : this.avatar.body === 'broad'
          ? [1.13, 1.0, 1.08]
          : [1, 1, 1];
    this.body.scale.set(...bodyScale);
    this.jacket.scale.x = bodyScale[0];
    this.head.scale.set(
      0.92 * (this.avatar.body === 'broad' ? 1.04 : 1),
      1.08 * (this.avatar.body === 'broad' ? 1.04 : 1),
      0.95,
    );

    this.hair.visible = this.avatar.hair !== 'bald';
    if (this.avatar.hair === 'bob') {
      this.hair.scale.set(1.12, 1.65, 1.15);
      this.hair.position.y = 1.84;
    } else if (this.avatar.hair === 'long') {
      this.hair.scale.set(1.06, 2.35, 1.1);
      this.hair.position.y = 1.74;
    } else if (this.avatar.hair === 'buzz') {
      this.hair.scale.set(1.04, 0.35, 1.04);
      this.hair.position.y = 1.92;
    } else {
      this.hair.scale.set(1, 1, 1);
      this.hair.position.y = 1.91;
    }
    this.hairStandingY = this.hair.position.y;
  }

  spawn(position, collision) {
    this.seated = false;
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

  sit(position, collision, rotationY = null) {
    if (position) this.position.fromArray(position);
    const ground = collision?.surfaceAt(this.position.x, this.position.z, this.position.y + 0.8);
    if (ground) this.position.y = ground.height;
    this.seated = true;
    this.grounded = true;
    this.verticalVelocity = 0;
    this.velocity.x = this.velocity.z = 0;
    this.jumpBuffer = 0;
    this.coyoteRemaining = 0;
    this.safePosition.copy(this.position);
    if (Number.isFinite(rotationY)) this.object.rotation.y = rotationY;
    return true;
  }

  stand() {
    if (!this.seated) return false;
    this.seated = false;
    this.velocity.x = this.velocity.z = 0;
    return true;
  }

  dance(duration = 70 / 60) {
    if (this.seated) return;
    this.danceRemaining = duration;
  }

  update(dt, movement, collision, jump = false) {
    if (this.seated) {
      this.velocity.x = this.velocity.z = 0;
      this.verticalVelocity = 0;
      this.animate(dt);
      return;
    }
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

    const drift =
      this.intoxication *
      (Math.sin(this.elapsed * 2.1) * 0.18 + Math.sin(this.elapsed * 0.73 + 0.8) * 0.08);
    const c = Math.cos(drift);
    const s = Math.sin(drift);
    const moveX = movement.x * c - movement.z * s;
    const moveZ = movement.x * s + movement.z * c;
    const input = Math.hypot(moveX, moveZ);
    const response = 1 - this.intoxication * 0.28;
    const acceleration = (this.grounded ? (input ? 42 : 48) : input ? 21 : 3) * response;
    const movementSpeed = this.speed * (1 - this.intoxication * 0.12);
    const approach = (value, target) =>
      value + Math.sign(target - value) * Math.min(Math.abs(target - value), acceleration * dt);
    this.velocity.x = approach(this.velocity.x, moveX * movementSpeed);
    this.velocity.z = approach(this.velocity.z, moveZ * movementSpeed);
    const beforeX = this.position.x,
      beforeZ = this.position.z;
    collision.move(this.position, this.velocity.x * dt, this.velocity.z * dt, {
      grounded: this.grounded,
    });
    if (collision.lastTarget) this.collisionTarget = collision.lastTarget;
    if (Math.abs(this.position.x - beforeX) < 0.00001) this.velocity.x = 0;
    if (Math.abs(this.position.z - beforeZ) < 0.00001) this.velocity.z = 0;
    if (input > 0.1) {
      const desired = Math.atan2(moveX, moveZ);
      const difference = Math.atan2(
        Math.sin(desired - this.object.rotation.y),
        Math.cos(desired - this.object.rotation.y),
      );
      const turnRate = 18 * (1 - this.intoxication * 0.45);
      this.object.rotation.y += difference * (1 - Math.exp(-turnRate * dt));
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
    if (this.seated) {
      this.object.scale.set(1, 1, 1);
      this.body.position.y = 0.84;
      this.neck.position.y = 1.26;
      this.head.position.y = 1.47;
      this.hair.position.y = (this.hairStandingY ?? 1.91) - 0.22;
      this.jacket.position.y = 1.08;
      this.leftArm.position.y = this.rightArm.position.y = 0.92;
      this.leftLeg.position.y = this.rightLeg.position.y = 0.36;
      this.leftShoe.position.y = this.rightShoe.position.y = 0.22;
      this.leftShoe.position.z = this.rightShoe.position.z = 0.38;
      this.leftArm.rotation.x = this.rightArm.rotation.x = -0.42;
      this.leftLeg.rotation.x = this.rightLeg.rotation.x = -1.08;
      this.head.rotation.y = 0;
      this.object.rotation.z = 0;
      return;
    }

    this.body.position.y = 1.02;
    this.neck.position.y = 1.47;
    this.head.position.y = 1.69;
    this.hair.position.y = this.hairStandingY ?? 1.91;
    this.jacket.position.y = 1.26;
    this.leftArm.position.y = this.rightArm.position.y = 1.08;
    this.leftLeg.position.y = this.rightLeg.position.y = 0.43;
    this.leftShoe.position.y = this.rightShoe.position.y = 0.07;
    this.leftShoe.position.z = this.rightShoe.position.z = 0.07;

    this.object.scale.set(
      1 + this.landingPulse * 0.35,
      1 - this.landingPulse,
      1 + this.landingPulse * 0.35,
    );
    this.danceRemaining = Math.max(0, this.danceRemaining - dt);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const walk = this.grounded ? Math.min(1, speed / 3.2) : 0;
    const gait = Math.sin(this.elapsed * (7.5 + walk * 2.5)) * walk;
    const dance = this.danceRemaining > 0 ? Math.sin(this.elapsed / 0.085) : 0;
    this.leftArm.rotation.x = gait * 0.55 + dance * 0.45;
    this.rightArm.rotation.x = -gait * 0.55 - dance * 0.45;
    this.leftLeg.rotation.x = -gait * 0.48;
    this.rightLeg.rotation.x = gait * 0.48;
    this.head.rotation.y = dance * 0.06;
    const danceLean = dance * 0.13;
    const drunkSway =
      this.intoxication *
      (Math.sin(this.elapsed * 1.45) * 0.065 + Math.sin(this.elapsed * 0.53 + 1.4) * 0.03);
    this.object.rotation.z = danceLean + drunkSway;
  }

  dispose() {
    this.object.removeFromParent();
    disposeObject(this.object);
  }
}
