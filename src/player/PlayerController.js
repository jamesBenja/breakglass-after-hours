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

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function capsule(radius, length, material, radialSegments = 9) {
  return shadow(new Mesh(new CapsuleGeometry(radius, length, 6, radialSegments), material));
}

function sphere(radius, material, width = 14, height = 10) {
  return shadow(new Mesh(new SphereGeometry(radius, width, height), material));
}

function box(width, height, depth, material) {
  return shadow(new Mesh(new BoxGeometry(width, height, depth), material));
}

function makeHand(skinMaterial, side) {
  const group = new Group();
  const palm = sphere(0.067, skinMaterial, 10, 8);
  palm.scale.set(0.78, 1.14, 0.62);
  const thumb = capsule(0.019, 0.055, skinMaterial, 6);
  thumb.position.set(side * 0.052, -0.006, 0.012);
  thumb.rotation.z = side * 0.72;
  const knuckle = sphere(0.056, skinMaterial, 9, 7);
  knuckle.position.y = -0.035;
  knuckle.scale.set(0.88, 0.58, 0.62);
  group.add(palm, thumb, knuckle);
  return group;
}

function makeArm(bodyMaterial, skinMaterial, side) {
  const shoulder = new Group();
  const upper = capsule(0.067, 0.245, bodyMaterial);
  upper.position.y = -0.165;
  upper.scale.set(1.02, 1, 0.94);

  const elbow = new Group();
  elbow.position.y = -0.34;
  const joint = sphere(0.062, skinMaterial, 10, 8);
  joint.scale.set(0.92, 0.78, 0.9);
  const forearm = capsule(0.056, 0.225, skinMaterial);
  forearm.position.y = -0.145;
  forearm.scale.set(0.95, 1.02, 0.9);
  const hand = makeHand(skinMaterial, side);
  hand.position.y = -0.325;
  elbow.add(joint, forearm, hand);
  shoulder.add(upper, elbow);
  return { shoulder, upper, elbow, forearm, hand };
}

function makeShoe(shoeMaterial, side) {
  const group = new Group();
  const sole = box(0.17, 0.07, 0.29, shoeMaterial);
  sole.position.z = 0.055;
  const toe = sphere(0.095, shoeMaterial, 10, 7);
  toe.scale.set(0.9, 0.42, 1.06);
  toe.position.set(0, 0.005, 0.15);
  const heel = box(0.145, 0.085, 0.13, shoeMaterial);
  heel.position.set(0, 0.018, -0.07);
  group.add(sole, toe, heel);
  group.rotation.y = side * 0.018;
  return group;
}

function makeLeg(trouserMaterial, shoeMaterial, side) {
  const hip = new Group();
  const upper = capsule(0.09, 0.32, trouserMaterial);
  upper.position.y = -0.215;
  upper.scale.set(0.98, 1.02, 0.92);

  const knee = new Group();
  knee.position.y = -0.43;
  const joint = sphere(0.085, trouserMaterial, 10, 8);
  joint.scale.set(0.92, 0.7, 0.86);
  const lower = capsule(0.072, 0.29, trouserMaterial);
  lower.position.y = -0.19;
  lower.scale.set(0.96, 1.04, 0.88);
  const shoe = makeShoe(shoeMaterial, side);
  shoe.position.set(0, -0.405, 0.075);
  knee.add(joint, lower, shoe);
  hip.add(upper, knee);
  return { hip, upper, knee, lower, shoe };
}

function makeHairStyles(material) {
  const root = new Group();
  const styles = {};

  const short = new Group();
  const shortCap = sphere(0.25, material, 14, 9);
  shortCap.scale.set(0.94, 0.48, 0.95);
  shortCap.position.y = 0.17;
  const shortFront = box(0.34, 0.07, 0.1, material);
  shortFront.position.set(0, 0.105, 0.19);
  shortFront.rotation.x = -0.2;
  short.add(shortCap, shortFront);
  styles.short = short;

  const buzz = new Group();
  const buzzCap = sphere(0.252, material, 14, 9);
  buzzCap.scale.set(0.94, 0.22, 0.95);
  buzzCap.position.y = 0.19;
  buzz.add(buzzCap);
  styles.buzz = buzz;

  const bob = new Group();
  const bobCap = sphere(0.26, material, 14, 10);
  bobCap.scale.set(1.02, 0.7, 1.02);
  bobCap.position.y = 0.1;
  const bobBack = capsule(0.18, 0.28, material);
  bobBack.scale.set(1.25, 1, 0.58);
  bobBack.position.set(0, -0.07, -0.12);
  const bobLeft = capsule(0.07, 0.26, material, 7);
  const bobRight = bobLeft.clone();
  bobLeft.position.set(-0.205, -0.06, 0.015);
  bobRight.position.set(0.205, -0.06, 0.015);
  bob.add(bobCap, bobBack, bobLeft, bobRight);
  styles.bob = bob;

  const long = new Group();
  const longCap = sphere(0.26, material, 14, 10);
  longCap.scale.set(1.02, 0.7, 1.02);
  longCap.position.y = 0.1;
  const back = capsule(0.16, 0.62, material);
  back.scale.set(1.36, 1, 0.55);
  back.position.set(0, -0.23, -0.13);
  const left = capsule(0.055, 0.5, material, 7);
  const right = left.clone();
  left.position.set(-0.215, -0.18, 0.02);
  right.position.set(0.215, -0.18, 0.02);
  long.add(longCap, back, left, right);
  styles.long = long;

  for (const [name, style] of Object.entries(styles)) {
    style.name = `hair-${name}`;
    root.add(style);
  }
  return { root, styles };
}

export class PlayerController {
  constructor(profile) {
    this.object = new Group();
    this.object.name = 'player';

    this.bodyMaterial = standard();
    this.skinMaterial = standard({ roughness: 0.73 });
    this.hairMaterial = standard({ roughness: 0.9 });
    this.trouserMaterial = standard({ color: 0x25272d, roughness: 0.9 });
    this.shoeMaterial = standard({ color: 0x17191d, roughness: 0.78 });
    this.eyeWhiteMaterial = standard({ color: 0xf0eee7, roughness: 0.48 });
    this.eyeMaterial = standard({ color: 0x3b2d26, roughness: 0.45 });
    this.pupilMaterial = standard({ color: 0x111015, roughness: 0.4 });
    this.mouthMaterial = standard({ color: 0x704946, roughness: 0.8 });
    this.clothingDetailMaterial = standard({ color: 0x181a20, roughness: 0.86 });

    // Torso is built as a layered human silhouette rather than one capsule. Keeping `body` as a
    // Group preserves every existing animation/emote hook that rotates the player's torso.
    this.body = new Group();
    this.body.position.y = 1.05;
    this.pelvis = sphere(0.235, this.trouserMaterial);
    this.pelvis.position.y = -0.255;
    this.pelvis.scale.set(1.12, 0.68, 0.82);
    this.waist = capsule(0.205, 0.13, this.bodyMaterial);
    this.waist.position.y = -0.08;
    this.waist.scale.set(1.03, 1, 0.76);
    this.chest = capsule(0.245, 0.22, this.bodyMaterial);
    this.chest.position.y = 0.145;
    this.chest.scale.set(1.08, 1, 0.76);
    this.body.add(this.pelvis, this.waist, this.chest);

    this.jacket = new Group();
    const leftLapel = box(0.075, 0.29, 0.025, this.clothingDetailMaterial);
    const rightLapel = leftLapel.clone();
    leftLapel.position.set(-0.075, 0.13, 0.202);
    rightLapel.position.set(0.075, 0.13, 0.202);
    leftLapel.rotation.z = -0.18;
    rightLapel.rotation.z = 0.18;
    const hem = box(0.37, 0.035, 0.035, this.clothingDetailMaterial);
    hem.position.set(0, -0.125, 0.184);
    this.jacket.add(leftLapel, rightLapel, hem);
    this.body.add(this.jacket);

    this.neck = capsule(0.075, 0.09, this.skinMaterial, 8);
    this.neck.position.y = 1.475;
    this.neck.scale.set(0.95, 1, 0.9);

    // The head remains a public Group so selfie face textures can still be attached by the
    // existing face-avatar feature, while the procedural face now has a jaw, eye whites/irises,
    // ears and softer proportions underneath.
    this.head = new Group();
    this.head.position.y = 1.7;
    this.cranium = sphere(0.245, this.skinMaterial, 18, 14);
    this.cranium.scale.set(0.93, 1.03, 0.91);
    this.jaw = sphere(0.192, this.skinMaterial, 16, 12);
    this.jaw.position.y = -0.135;
    this.jaw.scale.set(0.92, 0.72, 0.86);
    this.head.add(this.cranium, this.jaw);

    this.eyes = [];
    for (const x of [-0.082, 0.082]) {
      const eye = new Group();
      eye.position.set(x, 0.032, 0.218);
      const white = sphere(0.036, this.eyeWhiteMaterial, 10, 7);
      white.scale.set(1.15, 0.66, 0.36);
      const iris = sphere(0.017, this.eyeMaterial, 9, 6);
      iris.position.z = 0.029;
      iris.scale.z = 0.48;
      const pupil = sphere(0.0085, this.pupilMaterial, 8, 5);
      pupil.position.z = 0.038;
      pupil.scale.z = 0.4;
      eye.add(white, iris, pupil);
      this.head.add(eye);
      this.eyes.push({ group: eye, iris, pupil });

      const brow = box(0.083, 0.014, 0.018, this.hairMaterial);
      brow.position.set(x, 0.098, 0.225);
      brow.rotation.z = x < 0 ? -0.09 : 0.09;
      this.head.add(brow);
    }

    const noseBridge = capsule(0.025, 0.075, this.skinMaterial, 7);
    noseBridge.position.set(0, -0.005, 0.224);
    noseBridge.rotation.x = Math.PI / 2;
    const noseTip = sphere(0.035, this.skinMaterial, 9, 7);
    noseTip.scale.set(0.78, 0.72, 0.9);
    noseTip.position.set(0, -0.048, 0.252);
    this.head.add(noseBridge, noseTip);

    const mouth = box(0.094, 0.012, 0.016, this.mouthMaterial);
    mouth.position.set(0, -0.122, 0.207);
    mouth.rotation.x = -0.08;
    this.head.add(mouth);

    for (const x of [-0.238, 0.238]) {
      const ear = sphere(0.047, this.skinMaterial, 9, 7);
      ear.scale.set(0.48, 1, 0.42);
      ear.position.set(x, -0.005, -0.004);
      this.head.add(ear);
    }

    const hair = makeHairStyles(this.hairMaterial);
    this.hair = hair.root;
    this.hairStyles = hair.styles;
    this.hair.position.y = 0;
    this.head.add(this.hair);

    const leftArm = makeArm(this.bodyMaterial, this.skinMaterial, -1);
    const rightArm = makeArm(this.bodyMaterial, this.skinMaterial, 1);
    this.leftArm = leftArm.shoulder;
    this.rightArm = rightArm.shoulder;
    this.leftForearm = leftArm.elbow;
    this.rightForearm = rightArm.elbow;
    this.leftHand = leftArm.hand;
    this.rightHand = rightArm.hand;
    this.leftArm.position.set(-0.335, 1.345, 0);
    this.rightArm.position.set(0.335, 1.345, 0);
    this.leftArm.rotation.z = -0.045;
    this.rightArm.rotation.z = 0.045;

    const leftLeg = makeLeg(this.trouserMaterial, this.shoeMaterial, -1);
    const rightLeg = makeLeg(this.trouserMaterial, this.shoeMaterial, 1);
    this.leftLeg = leftLeg.hip;
    this.rightLeg = rightLeg.hip;
    this.leftKnee = leftLeg.knee;
    this.rightKnee = rightLeg.knee;
    this.leftShoe = leftLeg.shoe;
    this.rightShoe = rightLeg.shoe;
    this.leftLeg.position.set(-0.135, 0.79, 0);
    this.rightLeg.position.set(0.135, 0.79, 0);

    this.object.add(
      this.body,
      this.neck,
      this.head,
      this.leftArm,
      this.rightArm,
      this.leftLeg,
      this.rightLeg,
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
    const outfit = avatarPalette.outfit[this.avatar.outfit];
    this.bodyMaterial.color.setHex(outfit);
    this.skinMaterial.color.setHex(avatarPalette.skin[this.avatar.skinTone]);
    this.hairMaterial.color.setHex(avatarPalette.hair[this.avatar.hair]);

    // Derive seams/lapels from the outfit instead of using a generic black slab across the chest.
    const r = Math.max(0, ((outfit >> 16) & 255) - 24);
    const g = Math.max(0, ((outfit >> 8) & 255) - 24);
    const b = Math.max(0, (outfit & 255) - 24);
    this.clothingDetailMaterial.color.setRGB(r / 255, g / 255, b / 255);

    const width = this.avatar.body === 'slim' ? 0.9 : this.avatar.body === 'broad' ? 1.12 : 1;
    const shoulder = this.avatar.body === 'slim' ? 0.315 : this.avatar.body === 'broad' ? 0.37 : 0.335;
    this.body.scale.set(width, 1, this.avatar.body === 'broad' ? 1.05 : 1);
    this.leftArm.position.x = -shoulder;
    this.rightArm.position.x = shoulder;
    this.leftLeg.position.x = -(this.avatar.body === 'broad' ? 0.15 : 0.135);
    this.rightLeg.position.x = -this.leftLeg.position.x;
    this.head.scale.set(
      this.avatar.body === 'broad' ? 1.035 : this.avatar.body === 'slim' ? 0.985 : 1,
      this.avatar.body === 'broad' ? 1.02 : 1,
      1,
    );

    for (const style of Object.values(this.hairStyles)) style.visible = false;
    if (this.avatar.hair !== 'bald') {
      const style = this.hairStyles[this.avatar.hair] ?? this.hairStyles.short;
      style.visible = true;
    }
    this.hair.visible = this.avatar.hair !== 'bald';
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
    const beforeX = this.position.x;
    const beforeZ = this.position.z;
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

  resetPose() {
    this.body.position.set(0, 1.05, 0);
    this.body.rotation.set(0, 0, 0);
    this.neck.position.set(0, 1.475, 0);
    this.neck.rotation.set(0, 0, 0);
    this.head.position.set(0, 1.7, 0);
    this.head.rotation.set(0, 0, 0);
    this.leftArm.position.y = this.rightArm.position.y = 1.345;
    this.leftArm.rotation.set(0, 0, -0.045);
    this.rightArm.rotation.set(0, 0, 0.045);
    this.leftForearm.rotation.set(0, 0, 0);
    this.rightForearm.rotation.set(0, 0, 0);
    this.leftLeg.position.y = this.rightLeg.position.y = 0.79;
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    this.leftKnee.rotation.set(0, 0, 0);
    this.rightKnee.rotation.set(0, 0, 0);
    this.leftShoe.rotation.x = 0;
    this.rightShoe.rotation.x = 0;
  }

  animate(dt) {
    this.elapsed += dt;
    this.landingPulse *= Math.exp(-12 * dt);
    this.resetPose();

    if (this.seated) {
      this.object.scale.set(1, 1, 1);
      this.body.position.y = 0.9;
      this.neck.position.y = 1.305;
      this.head.position.y = 1.52;
      this.leftArm.position.y = this.rightArm.position.y = 1.17;
      this.leftArm.rotation.x = -0.34;
      this.rightArm.rotation.x = -0.34;
      this.leftForearm.rotation.x = -0.52;
      this.rightForearm.rotation.x = -0.52;
      this.leftLeg.position.y = this.rightLeg.position.y = 0.69;
      this.leftLeg.rotation.x = -1.12;
      this.rightLeg.rotation.x = -1.12;
      this.leftKnee.rotation.x = 1.48;
      this.rightKnee.rotation.x = 1.48;
      this.leftShoe.rotation.x = -0.26;
      this.rightShoe.rotation.x = -0.26;
      this.head.rotation.y = Math.sin(this.elapsed * 0.45) * 0.025;
      this.chest.scale.y = 1 + Math.sin(this.elapsed * 1.55) * 0.012;
      this.object.rotation.z = 0;
      return;
    }

    this.object.scale.set(
      1 + this.landingPulse * 0.28,
      1 - this.landingPulse,
      1 + this.landingPulse * 0.28,
    );

    this.danceRemaining = Math.max(0, this.danceRemaining - dt);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const walk = this.grounded ? Math.min(1, speed / 3.2) : 0;
    const cadence = 7.1 + walk * 2.8;
    const gait = Math.sin(this.elapsed * cadence) * walk;
    const opposite = Math.sin(this.elapsed * cadence + Math.PI) * walk;
    const stepBounce = Math.abs(Math.sin(this.elapsed * cadence)) * walk;
    const dance = this.danceRemaining > 0 ? Math.sin(this.elapsed / 0.085) : 0;
    const danceSlow = this.danceRemaining > 0 ? Math.sin(this.elapsed * 3.1) : 0;

    // Hip/knee articulation gives a readable human walk rather than swinging rigid full legs.
    this.leftLeg.rotation.x = -gait * 0.58;
    this.rightLeg.rotation.x = -opposite * 0.58;
    this.leftKnee.rotation.x = Math.max(0, gait) * 0.58 + walk * 0.04;
    this.rightKnee.rotation.x = Math.max(0, opposite) * 0.58 + walk * 0.04;
    this.leftShoe.rotation.x = -Math.max(0, gait) * 0.2;
    this.rightShoe.rotation.x = -Math.max(0, opposite) * 0.2;

    this.leftArm.rotation.x = gait * 0.62 + dance * 0.38;
    this.rightArm.rotation.x = -gait * 0.62 - dance * 0.38;
    this.leftForearm.rotation.x = -0.08 - Math.max(0, -gait) * 0.18;
    this.rightForearm.rotation.x = -0.08 - Math.max(0, gait) * 0.18;

    // Counter-rotation through shoulders/hips and subtle head movement makes the gait feel much
    // less like a rotating mannequin while staying cheap enough for many multiplayer avatars.
    this.body.position.y += stepBounce * 0.018;
    this.body.rotation.y = -gait * 0.055;
    this.body.rotation.z = -gait * 0.018 + danceSlow * 0.055;
    this.head.rotation.y = Math.sin(this.elapsed * 0.52) * (walk > 0.05 ? 0.02 : 0.035);
    this.head.rotation.x = stepBounce * 0.012 - danceSlow * 0.035;
    this.chest.scale.y = 1 + Math.sin(this.elapsed * 1.55) * (walk > 0.05 ? 0.006 : 0.012);

    // Tiny independent eye motion reads strongly at close multiplayer distance without needing
    // skeletal facial animation.
    const glanceX = Math.sin(this.elapsed * 0.63) * 0.012;
    const glanceY = Math.sin(this.elapsed * 0.41 + 1.2) * 0.005;
    for (const eye of this.eyes) {
      eye.iris.position.x = glanceX;
      eye.iris.position.y = glanceY;
      eye.pupil.position.x = glanceX;
      eye.pupil.position.y = glanceY;
    }

    if (this.danceRemaining > 0) {
      this.leftArm.rotation.z = -0.18 + Math.sin(this.elapsed * 4.2) * 0.34;
      this.rightArm.rotation.z = 0.18 - Math.sin(this.elapsed * 4.2 + 1.1) * 0.34;
      this.leftForearm.rotation.x -= 0.38 + Math.max(0, dance) * 0.42;
      this.rightForearm.rotation.x -= 0.38 + Math.max(0, -dance) * 0.42;
      this.leftKnee.rotation.x += Math.max(0, danceSlow) * 0.24;
      this.rightKnee.rotation.x += Math.max(0, -danceSlow) * 0.24;
      this.body.position.y += Math.abs(dance) * 0.02;
      this.head.rotation.y += dance * 0.05;
    }

    const danceLean = dance * 0.1;
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
