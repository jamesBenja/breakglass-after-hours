import {
  CapsuleGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const seeded = (index, salt = 0) => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const BODY_COLORS = [
  0x232329, 0x343947, 0x6a334f, 0x274a52, 0x74462f, 0x4e3f68, 0x58643a, 0x8a5d37, 0x8a3151,
  0x2f5c49, 0x284d73, 0xa06b3e,
];
const SKIN_COLORS = [0xf0d0b5, 0xe0b18e, 0xc99470, 0xa87558, 0x805640, 0x60402f, 0x452e24];
const HAIR_COLORS = [0x171417, 0x2c211d, 0x4b3426, 0x744d32, 0x9a7651, 0x402b35];
const LEG_COLORS = [0x16171b, 0x22262d, 0x30313a, 0x382e34, 0x24313c];

function chooseZone(zones, index, salt = 4) {
  if (!zones.length) return null;
  const total = zones.reduce((sum, zone) => sum + (zone.weight ?? 1), 0) || 1;
  let pick = seeded(index, salt) * total;
  for (const zone of zones) {
    pick -= zone.weight ?? 1;
    if (pick <= 0) return zone;
  }
  return zones[zones.length - 1];
}

function inside(rect, x, z) {
  return x >= rect.x1 && x <= rect.x2 && z >= rect.z1 && z <= rect.z2;
}

function pointInZone(zone, avoid, index, salt) {
  if (!zone) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    x = zone.x1 + seeded(index + attempt * 31, salt) * (zone.x2 - zone.x1);
    z = zone.z1 + seeded(index + attempt * 43, salt + 1) * (zone.z2 - zone.z1);
    if (!avoid.some((rect) => inside(rect, x, z))) break;
  }
  return { x, z };
}

/**
 * Mobile-friendly crowd simulation built from instanced articulated silhouettes.
 *
 * Nine draw calls give every guest a torso, head, shaped hair, upper/lower arms and separate legs.
 * The extra elbow layer is a small GPU cost but dramatically reduces the mannequin look while
 * keeping dozens of dancers practical on iPhone.
 */
export class CrowdSystem {
  constructor(root, config = {}) {
    this.config = config;
    this.max = Math.max(0, config.max ?? 84);
    this.min = Math.min(this.max, Math.max(0, config.min ?? 14));
    this.idle = Math.min(this.max, Math.max(this.min, config.idle ?? 26));
    this.attendance = Math.min(this.max, Math.max(this.min, config.start ?? 52));
    this.targetAttendance = this.attendance;
    this.danceShare = 0.35;
    this.danceFloorCount = 0;
    this.lastVibe = 0;
    this.lastMixQuality = 0;
    this.elapsed = 0;
    this.zones = config.zones ?? [];
    this.danceZones = this.zones.filter((zone) => zone.kind === 'dance');
    this.socialZones = this.zones.filter((zone) => zone.kind !== 'dance');
    this.avoid = config.avoid ?? [];
    this.members = [];
    this.matrix = new Matrix4();
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.rotation = new Quaternion();
    this.euler = new Euler();

    const bodyMaterial = new MeshStandardMaterial({ roughness: 0.78, metalness: 0.04 });
    const skinMaterial = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.02 });
    const hairMaterial = new MeshStandardMaterial({ roughness: 0.9, metalness: 0.01 });
    const legMaterial = new MeshStandardMaterial({ roughness: 0.84, metalness: 0.025 });
    this.body = new InstancedMesh(new CapsuleGeometry(0.205, 0.51, 3, 6), bodyMaterial, this.max);
    this.head = new InstancedMesh(new SphereGeometry(0.19, 9, 7), skinMaterial, this.max);
    this.hair = new InstancedMesh(new SphereGeometry(0.195, 8, 6), hairMaterial, this.max);
    this.leftArm = new InstancedMesh(
      new CapsuleGeometry(0.052, 0.22, 3, 5),
      bodyMaterial.clone(),
      this.max,
    );
    this.rightArm = new InstancedMesh(
      new CapsuleGeometry(0.052, 0.22, 3, 5),
      bodyMaterial.clone(),
      this.max,
    );
    this.leftForearm = new InstancedMesh(
      new CapsuleGeometry(0.045, 0.19, 3, 5),
      skinMaterial.clone(),
      this.max,
    );
    this.rightForearm = new InstancedMesh(
      new CapsuleGeometry(0.045, 0.19, 3, 5),
      skinMaterial.clone(),
      this.max,
    );
    this.leftLeg = new InstancedMesh(new CapsuleGeometry(0.068, 0.35, 3, 5), legMaterial, this.max);
    this.rightLeg = new InstancedMesh(
      new CapsuleGeometry(0.068, 0.35, 3, 5),
      legMaterial.clone(),
      this.max,
    );
    this.meshes = [
      this.body,
      this.head,
      this.hair,
      this.leftArm,
      this.rightArm,
      this.leftForearm,
      this.rightForearm,
      this.leftLeg,
      this.rightLeg,
    ];
    const names = [
      'bodies',
      'heads',
      'hair',
      'left-upper-arms',
      'right-upper-arms',
      'left-forearms',
      'right-forearms',
      'left-legs',
      'right-legs',
    ];
    for (const [index, mesh] of this.meshes.entries()) {
      mesh.name = `crowd:${names[index]}`;
      mesh.castShadow = true;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      root.add(mesh);
    }

    for (let i = 0; i < this.max; i++) {
      const danceZone = chooseZone(this.danceZones, i, 4) ?? chooseZone(this.zones, i, 4);
      const socialZone =
        chooseZone(this.socialZones, i, 14) ?? chooseZone(this.zones, i + 37, 14) ?? danceZone;
      const dance = pointInZone(danceZone, this.avoid, i, 7);
      const social = pointInZone(socialZone, this.avoid, i, 17);
      const startsOnFloor = seeded(i, 21) < 0.55;
      const member = {
        dance,
        social,
        currentX: startsOnFloor ? dance.x : social.x,
        currentZ: startsOnFloor ? dance.z : social.z,
        onFloor: startsOnFloor,
        engagement: seeded(i, 31),
        phase: seeded(i, 9) * Math.PI * 2,
        tempo: 0.8 + seeded(i, 10) * 0.7,
        scale: 0.87 + seeded(i, 11) * 0.28,
        shoulder: 0.9 + seeded(i, 19) * 0.22,
        hairStyle: Math.floor(seeded(i, 41) * 4),
      };
      this.members.push(member);
      const bodyColor = new Color(BODY_COLORS[i % BODY_COLORS.length]);
      const skinColor = new Color(SKIN_COLORS[(i * 3) % SKIN_COLORS.length]);
      const hairColor = new Color(HAIR_COLORS[(i * 5) % HAIR_COLORS.length]);
      const legColor = new Color(LEG_COLORS[(i * 7) % LEG_COLORS.length]);
      this.body.setColorAt(i, bodyColor);
      this.head.setColorAt(i, skinColor);
      this.hair.setColorAt(i, hairColor);
      this.leftArm.setColorAt(i, bodyColor);
      this.rightArm.setColorAt(i, bodyColor);
      this.leftForearm.setColorAt(i, skinColor);
      this.rightForearm.setColorAt(i, skinColor);
      this.leftLeg.setColorAt(i, legColor);
      this.rightLeg.setColorAt(i, legColor);
    }
    for (const mesh of this.meshes) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.setVisibleCount(Math.round(this.attendance));
    this.update(0, { playing: false, energy: 0, bass: 0, beat: 0 });
  }

  setVisibleCount(count) {
    const visible = Math.max(0, Math.min(this.max, count));
    for (const mesh of this.meshes) mesh.count = visible;
  }

  movementScaleAt(position) {
    const count = Math.round(this.attendance);
    let pressure = 0;
    for (let i = 0; i < count; i++) {
      const member = this.members[i];
      const distance = Math.hypot(position.x - member.currentX, position.z - member.currentZ);
      if (distance < 0.72) pressure += (0.72 - distance) / 0.72;
    }
    return clamp(1 - pressure * 0.14, 0.34, 1);
  }

  setInstance(mesh, index, x, y, z, yaw, sx, sy, sz, pitch = 0, roll = 0) {
    this.position.set(x, y, z);
    this.euler.set(pitch, yaw, roll, 'YXZ');
    this.rotation.setFromEuler(this.euler);
    this.scale.set(sx, sy, sz);
    this.matrix.compose(this.position, this.rotation, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  update(dt, metrics = {}) {
    this.elapsed += dt;
    const energy = clamp(metrics.energy ?? (metrics.playing ? 0.5 : 0));
    const bass = clamp(metrics.bass ?? energy);
    const beat = clamp(metrics.beat ?? 0);
    const vibe = clamp(metrics.vibe ?? energy);
    const mixQuality = clamp(metrics.mixQuality ?? (metrics.playing ? 0.72 : 0));
    const playing = !!metrics.playing;
    this.lastVibe = vibe;
    this.lastMixQuality = mixQuality;

    if (playing) {
      const badBlend = clamp((0.48 - mixQuality) * 1.6);
      const attraction = clamp(vibe * 0.72 + mixQuality * 0.3 - badBlend * 0.58);
      this.targetAttendance = this.min + (this.max - this.min) * attraction;
      this.danceShare = clamp(0.08 + vibe * 0.72 + (mixQuality - 0.5) * 0.62, 0.06, 0.94);
    } else {
      this.targetAttendance = this.idle;
      this.danceShare = 0.1;
    }

    const losingPeople = this.targetAttendance < this.attendance;
    const attendanceSpeed = playing ? (losingPeople ? 0.62 : 0.2) : 0.1;
    this.attendance +=
      (this.targetAttendance - this.attendance) * (1 - Math.exp(-attendanceSpeed * dt));
    const count = Math.round(this.attendance);
    this.setVisibleCount(count);

    let onFloor = 0;
    for (let i = 0; i < count; i++) {
      const member = this.members[i];
      const wantsFloor = playing && member.engagement < this.danceShare;
      const target = wantsFloor ? member.dance : member.social;
      const switching = wantsFloor !== member.onFloor;
      member.onFloor = wantsFloor;
      if (wantsFloor) onFloor++;

      const migrationSpeed = switching ? (wantsFloor ? 1.05 : 2.15) : wantsFloor ? 0.45 : 0.7;
      const migration = 1 - Math.exp(-migrationSpeed * dt);
      member.currentX += (target.x - member.currentX) * migration;
      member.currentZ += (target.z - member.currentZ) * migration;

      const localEnergy = wantsFloor ? clamp(energy * 0.45 + vibe * 0.72) : energy * 0.18;
      const speed = member.tempo * (1.25 + localEnergy * 2.9);
      const sway = Math.sin(this.elapsed * speed + member.phase);
      const side = Math.cos(this.elapsed * (speed * 0.72) + member.phase * 1.7);
      const cheer = wantsFloor && mixQuality > 0.82 ? beat : 0;
      const bob =
        (wantsFloor ? 0.022 + localEnergy * 0.105 : 0.007 + localEnergy * 0.016) *
          Math.abs(sway) +
        cheer * 0.07;
      const drift = wantsFloor ? 0.05 + bass * 0.04 : 0.018;
      const px = member.currentX + side * drift;
      const pz = member.currentZ + sway * drift * 0.55;
      const yaw = side * (wantsFloor ? 0.34 + localEnergy * 0.3 : 0.09);
      const scale = member.scale;
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const forwardX = Math.sin(yaw);
      const forwardZ = Math.cos(yaw);
      const gait = wantsFloor ? sway * (0.18 + localEnergy * 0.62) : side * 0.09;
      const cheerRaise = cheer * 1.05;

      this.setInstance(
        this.body,
        i,
        px,
        0.76 * scale + bob,
        pz,
        yaw,
        scale * member.shoulder,
        scale,
        scale * 0.9,
        wantsFloor ? sway * 0.028 : 0,
        wantsFloor ? side * 0.036 : 0,
      );
      this.setInstance(
        this.head,
        i,
        px,
        1.47 * scale + bob,
        pz,
        yaw + side * 0.025,
        scale * 0.94,
        scale,
        scale * 0.93,
      );

      const hairY = member.hairStyle === 1 ? 1.55 : 1.59;
      const hairScaleY = member.hairStyle === 2 ? 0.7 : member.hairStyle === 1 ? 1.48 : 0.82;
      const hairScaleZ = member.hairStyle === 3 ? 1.12 : member.hairStyle === 1 ? 0.73 : 0.94;
      this.setInstance(
        this.hair,
        i,
        px,
        hairY * scale + bob,
        pz - forwardZ * 0.032,
        yaw,
        scale * (member.hairStyle === 3 ? 1.08 : 1),
        scale * hairScaleY,
        scale * hairScaleZ,
      );

      const shoulderOffset = 0.275 * scale * member.shoulder;
      const upperArmY = 1.08 * scale + bob + cheer * 0.05;
      const forearmY = 0.87 * scale + bob + cheer * 0.08;
      const leftArmPitch = -gait - cheerRaise;
      const rightArmPitch = gait - cheerRaise * (0.65 + seeded(i, 52) * 0.35);
      const leftElbow = -0.1 - Math.max(0, -gait) * 0.42 - cheerRaise * 0.15;
      const rightElbow = -0.1 - Math.max(0, gait) * 0.42 - cheerRaise * 0.18;
      this.setInstance(
        this.leftArm,
        i,
        px - rightX * shoulderOffset,
        upperArmY,
        pz - rightZ * shoulderOffset,
        yaw,
        scale,
        scale,
        scale,
        leftArmPitch,
        -0.06,
      );
      this.setInstance(
        this.rightArm,
        i,
        px + rightX * shoulderOffset,
        upperArmY,
        pz + rightZ * shoulderOffset,
        yaw,
        scale,
        scale,
        scale,
        rightArmPitch,
        0.06,
      );
      this.setInstance(
        this.leftForearm,
        i,
        px - rightX * shoulderOffset + forwardX * leftArmPitch * 0.09,
        forearmY + Math.abs(leftArmPitch) * 0.022,
        pz - rightZ * shoulderOffset + forwardZ * leftArmPitch * 0.09,
        yaw,
        scale,
        scale,
        scale,
        leftArmPitch + leftElbow,
        -0.03,
      );
      this.setInstance(
        this.rightForearm,
        i,
        px + rightX * shoulderOffset + forwardX * rightArmPitch * 0.09,
        forearmY + Math.abs(rightArmPitch) * 0.022,
        pz + rightZ * shoulderOffset + forwardZ * rightArmPitch * 0.09,
        yaw,
        scale,
        scale,
        scale,
        rightArmPitch + rightElbow,
        0.03,
      );

      const hip = 0.12 * scale;
      const legY = 0.29 * scale + bob * 0.15;
      const legSwing = switching ? gait * 0.7 : wantsFloor ? gait * 0.35 : gait * 0.18;
      this.setInstance(
        this.leftLeg,
        i,
        px - rightX * hip + forwardX * legSwing * 0.04,
        legY,
        pz - rightZ * hip + forwardZ * legSwing * 0.04,
        yaw,
        scale,
        scale,
        scale,
        legSwing,
      );
      this.setInstance(
        this.rightLeg,
        i,
        px + rightX * hip - forwardX * legSwing * 0.04,
        legY,
        pz + rightZ * hip - forwardZ * legSwing * 0.04,
        yaw,
        scale,
        scale,
        scale,
        -legSwing,
      );
    }
    this.danceFloorCount = onFloor;
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  snapshot() {
    return {
      attendance: Math.round(this.attendance),
      targetAttendance: Math.round(this.targetAttendance),
      capacity: this.max,
      density: this.max ? this.attendance / this.max : 0,
      danceFloor: this.danceFloorCount,
      danceShare: this.danceShare,
      vibe: this.lastVibe,
      mixQuality: this.lastMixQuality,
    };
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes = [];
    this.members = [];
  }
}
