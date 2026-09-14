import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

const material = (color, roughness = 0.9) =>
  new MeshStandardMaterial({ color, roughness, metalness: 0.02 });
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function buildMaddoxModel() {
  const root = new Group();
  root.name = 'maddox';

  const merle = material(0x8d8b84);
  const merleLight = material(0xb8b5aa);
  const dark = material(0x272725);
  const white = material(0xe4dfd3);
  const noseMat = material(0x111213, 0.62);
  const eyeMat = material(0x4b2f18, 0.48);
  const collarMat = material(0x2c2521, 0.55);
  const brass = material(0xb88a45, 0.42);

  // Maddox was tall, lean and long-legged. The body is intentionally less barrel-shaped than
  // the generic dog proportions used elsewhere in games.
  const body = new Mesh(new CapsuleGeometry(0.34, 0.86, 7, 12), merle);
  body.rotation.x = Math.PI / 2;
  body.scale.set(0.92, 1.02, 1.06);
  body.position.set(0, 0.82, 0.03);
  body.castShadow = true;

  const chest = new Mesh(new CapsuleGeometry(0.2, 0.34, 6, 10), white);
  chest.position.set(0, 0.76, 0.41);
  chest.scale.set(0.86, 1.05, 0.52);
  chest.rotation.x = -0.18;
  chest.castShadow = true;

  const neck = new Mesh(new CapsuleGeometry(0.23, 0.28, 6, 10), merle);
  neck.position.set(0, 1.05, 0.45);
  neck.rotation.x = -0.38;
  neck.castShadow = true;

  const headPivot = new Group();
  headPivot.position.set(0, 1.26, 0.66);
  root.add(headPivot);

  const head = new Mesh(new SphereGeometry(0.27, 18, 14), merleLight);
  head.scale.set(0.88, 1.04, 1.06);
  head.castShadow = true;
  headPivot.add(head);

  const muzzle = new Mesh(new CapsuleGeometry(0.12, 0.2, 5, 9), merleLight);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.08, 0.25);
  muzzle.scale.set(0.95, 0.82, 1.18);
  muzzle.castShadow = true;
  headPivot.add(muzzle);

  const nose = new Mesh(new SphereGeometry(0.075, 10, 7), noseMat);
  nose.position.set(0, -0.075, 0.385);
  nose.scale.set(1.15, 0.78, 0.92);
  headPivot.add(nose);

  for (const x of [-0.092, 0.092]) {
    const eye = new Mesh(new SphereGeometry(0.034, 9, 7), eyeMat);
    eye.position.set(x, 0.055, 0.232);
    eye.scale.z = 0.72;
    headPivot.add(eye);
  }

  // Large upright ears are one of Maddox's clearest silhouettes in the supplied references.
  for (const x of [-0.15, 0.15]) {
    const ear = new Mesh(new ConeGeometry(0.115, 0.36, 5), dark);
    ear.position.set(x, 0.31, 0.015);
    ear.rotation.z = x < 0 ? -0.12 : 0.12;
    ear.rotation.x = -0.04;
    ear.castShadow = true;
    headPivot.add(ear);
  }

  const collar = new Mesh(new BoxGeometry(0.48, 0.085, 0.075), collarMat);
  collar.position.set(0, 1.02, 0.55);
  collar.rotation.x = -0.32;
  root.add(collar);
  const tag = new Mesh(new SphereGeometry(0.055, 8, 6), brass);
  tag.position.set(0, 0.91, 0.61);
  tag.scale.y = 0.78;
  root.add(tag);

  const legPivots = [];
  const legPositions = [
    [-0.22, 0.56, 0.38],
    [0.22, 0.56, 0.38],
    [-0.22, 0.56, -0.38],
    [0.22, 0.56, -0.38],
  ];
  for (let i = 0; i < legPositions.length; i++) {
    const pivot = new Group();
    pivot.position.fromArray(legPositions[i]);
    const leg = new Mesh(new CapsuleGeometry(0.075, 0.55, 5, 8), i < 2 ? merleLight : merle);
    leg.position.y = -0.28;
    leg.castShadow = true;
    const paw = new Mesh(new SphereGeometry(0.09, 8, 6), white);
    paw.position.set(0, -0.58, 0.035);
    paw.scale.set(0.9, 0.55, 1.25);
    paw.castShadow = true;
    pivot.add(leg, paw);
    root.add(pivot);
    legPivots.push(pivot);
  }

  const tailPivot = new Group();
  tailPivot.position.set(0, 0.93, -0.58);
  const tail = new Mesh(new CapsuleGeometry(0.065, 0.55, 5, 8), dark);
  tail.position.set(0, 0.05, -0.27);
  tail.rotation.x = Math.PI / 2.25;
  tail.castShadow = true;
  tailPivot.add(tail);
  root.add(tailPivot);

  // Irregular raised markings give the procedural model a merle read without a heavy texture.
  const spots = [
    [-0.26, 0.94, 0.18, 0.12],
    [0.24, 0.8, 0.02, 0.1],
    [-0.18, 0.72, -0.28, 0.09],
    [0.16, 0.96, -0.34, 0.115],
    [0.02, 1.33, 0.82, 0.065],
    [-0.14, 1.25, 0.86, 0.055],
  ];
  for (const [x, y, z, radius] of spots) {
    const spot = new Mesh(new SphereGeometry(radius, 8, 6), dark);
    spot.position.set(x, y, z);
    spot.scale.set(1.2, 0.45, 0.78);
    spot.castShadow = true;
    root.add(spot);
  }

  root.add(body, chest, neck, collar, tag);
  root.scale.setScalar(0.94);
  return { root, body, headPivot, legPivots, tailPivot };
}

const toVector = (point) =>
  point instanceof Vector3 ? point.clone() : new Vector3().fromArray(point ?? [0, 0, 0]);

/**
 * Maddox is intentionally separate from the humanoid NPC system: he can roam, nap, react to
 * petting and lead the player to the roof passage without forcing dog behavior into NPC code.
 */
export class MaddoxSystem {
  constructor(root, config = {}) {
    const model = buildMaddoxModel();
    Object.assign(this, model);
    this.root.position.fromArray(config.start ?? [0, 0, 0]);
    root.add(this.root);

    this.name = config.name ?? 'Maddox';
    this.radius = config.radius ?? 1.35;
    this.roamPoints = (config.roamPoints ?? []).map(toVector);
    this.napPoints = (config.napPoints ?? []).map(toVector);
    this.roofLeadRoute = (config.roofLeadRoute ?? []).map(toVector);
    this.roamIndex = 0;
    this.napIndex = 0;
    this.speed = config.speed ?? 0.72;
    this.elapsed = 0;
    this.state = 'roam';
    this.stateTime = 0;
    this.petPulse = 0;
    this.currentTarget = null;
    this.pendingNap = false;
    this.leadRoute = [];
    this.leadIndex = 0;
    this.arrivedAtLeadTarget = false;
    this.nextNapAfter = 22;
  }

  positionOf() {
    return this.root.position;
  }

  interactionTargets() {
    return [
      {
        id: 'maddox',
        name: 'Maddox',
        position: this.root.position.toArray(),
        radius: this.radius,
        action: 'maddox',
      },
    ];
  }

  pet() {
    this.petPulse = 1.6;
    this.state = 'pet';
    this.stateTime = 0;
    this.currentTarget = null;
    this.pendingNap = false;
  }

  startLead(route = this.roofLeadRoute) {
    const source = Array.isArray(route?.[0]) || route?.[0] instanceof Vector3 ? route : [route];
    this.leadRoute = source.filter(Boolean).map(toVector);
    if (!this.leadRoute.length) return false;
    this.leadIndex = 0;
    this.arrivedAtLeadTarget = false;
    this.state = 'lead';
    this.stateTime = 0;
    this.currentTarget = null;
    this.pendingNap = false;
    return true;
  }

  chooseRoamTarget() {
    if (!this.roamPoints.length) return null;
    const target = this.roamPoints[this.roamIndex % this.roamPoints.length];
    this.roamIndex = (this.roamIndex + 1) % this.roamPoints.length;
    return target;
  }

  chooseNapTarget() {
    if (!this.napPoints.length) return null;
    const target = this.napPoints[this.napIndex % this.napPoints.length];
    this.napIndex = (this.napIndex + 1) % this.napPoints.length;
    return target;
  }

  moveToward(target, dt) {
    if (!target) return true;
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) return true;
    const amount = Math.min(distance, this.speed * dt);
    this.root.position.x += (dx / distance) * amount;
    this.root.position.z += (dz / distance) * amount;
    this.root.position.y += (target.y - this.root.position.y) * (1 - Math.exp(-6 * dt));
    this.root.rotation.y = Math.atan2(dx, dz);
    return false;
  }

  update(dt) {
    this.elapsed += dt;
    this.stateTime += dt;
    this.petPulse = Math.max(0, this.petPulse - dt);

    let moving = false;
    if (this.state === 'lead') {
      const target = this.leadRoute[this.leadIndex];
      const arrived = this.moveToward(target, dt);
      moving = !arrived;
      if (arrived) {
        this.leadIndex += 1;
        if (this.leadIndex >= this.leadRoute.length) {
          this.arrivedAtLeadTarget = true;
          this.state = 'sit';
          this.stateTime = 0;
        }
      }
    } else if (this.state === 'pet') {
      if (this.stateTime > 1.6) {
        this.state = 'sit';
        this.stateTime = 0;
      }
    } else if (this.state === 'nap') {
      if (this.stateTime > 11) {
        this.state = 'roam';
        this.stateTime = 0;
        this.currentTarget = this.chooseRoamTarget();
      }
    } else if (this.state === 'sit') {
      if (this.stateTime > 4.5 && !this.arrivedAtLeadTarget) {
        this.state = 'roam';
        this.stateTime = 0;
        this.currentTarget = this.chooseRoamTarget();
      }
    } else {
      if (!this.currentTarget) {
        if (this.elapsed >= this.nextNapAfter && this.napPoints.length) {
          this.currentTarget = this.chooseNapTarget();
          this.pendingNap = true;
        } else {
          this.currentTarget = this.chooseRoamTarget();
        }
      }
      const arrived = this.moveToward(this.currentTarget, dt);
      moving = !arrived;
      if (arrived) {
        this.currentTarget = null;
        if (this.pendingNap) {
          this.pendingNap = false;
          this.state = 'nap';
          this.stateTime = 0;
          this.nextNapAfter = this.elapsed + 28;
        }
      }
    }

    const gait = Math.sin(this.elapsed * 9.2);
    for (let i = 0; i < this.legPivots.length; i++) {
      const phase = i % 2 === 0 ? gait : -gait;
      this.legPivots[i].rotation.x = moving ? phase * 0.28 : 0;
    }

    const wagStrength = this.petPulse > 0 ? 0.72 : this.state === 'lead' ? 0.34 : 0.12;
    this.tailPivot.rotation.y =
      Math.sin(this.elapsed * (this.petPulse > 0 ? 13 : 5.5)) * wagStrength;
    this.headPivot.rotation.y = this.petPulse > 0 ? Math.sin(this.elapsed * 3.4) * 0.12 : 0;

    const nap = this.state === 'nap';
    const sit = this.state === 'sit' || this.state === 'pet';
    const targetBodyY = nap ? 0.42 : sit ? 0.7 : 0.82;
    this.body.position.y += (targetBodyY - this.body.position.y) * (1 - Math.exp(-8 * dt));
    this.root.rotation.z += ((nap ? -0.3 : 0) - this.root.rotation.z) * (1 - Math.exp(-6 * dt));
  }

  snapshot() {
    return {
      state: this.state,
      position: this.root.position.toArray(),
      leading: this.state === 'lead',
      arrivedAtLeadTarget: this.arrivedAtLeadTarget,
      leadIndex: this.leadIndex,
      petPulse: clamp(this.petPulse / 1.6),
    };
  }

  dispose() {
    this.root.removeFromParent();
  }
}
