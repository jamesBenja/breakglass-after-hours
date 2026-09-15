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
  0x25252b, 0x5e3550, 0x31525a, 0x76503a, 0x4e4269, 0x3f5b43, 0x8a5e3b, 0x354f75,
];
const SKIN_COLORS = [0xe8c8ad, 0xd5a784, 0xb98463, 0x95664f, 0x704b39, 0x503528];
const HAIR_COLORS = [0x171417, 0x2c211d, 0x4b3426, 0x744d32, 0x9a7651, 0x402b35];
const LEG_COLORS = [0x16171a, 0x242830, 0x302c34, 0x24343d];

function avoidTables(x, z) {
  const inA = x > 4.2 && x < 6.8 && z > 0.45;
  const inB = x > 10.0 && x < 12.6 && z > -0.55 && z < 0.8;
  if (inA) return { x, z: -0.9 };
  if (inB) return { x, z: 1.1 };
  return { x, z };
}

function targetFor(index) {
  const east = seeded(index, 1) < 0.76;
  const x = east ? 0.2 + seeded(index, 2) * 23.5 : -17 + seeded(index, 3) * 12;
  const z = -1.55 + seeded(index, 4) * 3.1;
  return avoidTables(x, z);
}

/** Mobile-friendly outdoor crowd made from articulated instanced silhouettes. */
export class AlleyCrowdSystem {
  constructor(root, { max = 52, door = [-2.9, 0, -0.35] } = {}) {
    this.root = root;
    this.max = max;
    this.visibleCount = 0;
    this.targetCount = 0;
    this.elapsed = 0;
    this.door = new Vector3().fromArray(door);
    this.members = [];
    this.matrix = new Matrix4();
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.rotation = new Quaternion();
    this.euler = new Euler();

    const bodyMaterial = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.03 });
    const skinMaterial = new MeshStandardMaterial({ roughness: 0.8, metalness: 0.015 });
    const hairMaterial = new MeshStandardMaterial({ roughness: 0.9, metalness: 0.01 });
    const legMaterial = new MeshStandardMaterial({ roughness: 0.86, metalness: 0.02 });

    this.body = new InstancedMesh(new CapsuleGeometry(0.205, 0.5, 3, 6), bodyMaterial, max);
    this.head = new InstancedMesh(new SphereGeometry(0.185, 9, 7), skinMaterial, max);
    this.hair = new InstancedMesh(new SphereGeometry(0.19, 8, 6), hairMaterial, max);
    this.leftArm = new InstancedMesh(
      new CapsuleGeometry(0.052, 0.22, 3, 5),
      bodyMaterial.clone(),
      max,
    );
    this.rightArm = new InstancedMesh(
      new CapsuleGeometry(0.052, 0.22, 3, 5),
      bodyMaterial.clone(),
      max,
    );
    this.leftForearm = new InstancedMesh(
      new CapsuleGeometry(0.045, 0.18, 3, 5),
      skinMaterial.clone(),
      max,
    );
    this.rightForearm = new InstancedMesh(
      new CapsuleGeometry(0.045, 0.18, 3, 5),
      skinMaterial.clone(),
      max,
    );
    this.leftLeg = new InstancedMesh(new CapsuleGeometry(0.068, 0.33, 3, 5), legMaterial, max);
    this.rightLeg = new InstancedMesh(
      new CapsuleGeometry(0.068, 0.33, 3, 5),
      legMaterial.clone(),
      max,
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
      'body',
      'head',
      'hair',
      'left-upper-arm',
      'right-upper-arm',
      'left-forearm',
      'right-forearm',
      'left-leg',
      'right-leg',
    ];
    for (const [index, mesh] of this.meshes.entries()) {
      mesh.name = `alley-crowd:${names[index]}`;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = true;
      root.add(mesh);
    }

    for (let i = 0; i < max; i++) {
      const target = targetFor(i);
      const member = {
        id: `alley-guest-${i + 1}`,
        targetX: target.x,
        targetZ: target.z,
        currentX: this.door.x + seeded(i, 12) * 0.8,
        currentZ: this.door.z + (seeded(i, 13) - 0.5) * 1.2,
        scale: 0.88 + seeded(i, 14) * 0.24,
        shoulder: 0.9 + seeded(i, 29) * 0.2,
        phase: seeded(i, 15) * Math.PI * 2,
        tempo: 0.75 + seeded(i, 16) * 0.8,
        hairStyle: Math.floor(seeded(i, 27) * 4),
        smoker: seeded(i, 17) < 0.48,
        generous: seeded(i, 18) < 0.62,
        reaction: 0,
        quietPulse: 0,
        active: false,
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
    this.setVisibleCount(0);
  }

  setInstance(mesh, index, x, y, z, yaw, sx, sy, sz, pitch = 0, roll = 0) {
    this.position.set(x, y, z);
    this.euler.set(pitch, yaw, roll, 'YXZ');
    this.rotation.setFromEuler(this.euler);
    this.scale.set(sx, sy, sz);
    this.matrix.compose(this.position, this.rotation, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  setVisibleCount(value) {
    const next = Math.max(0, Math.min(this.max, Math.round(value)));
    if (next > this.visibleCount) {
      for (let i = this.visibleCount; i < next; i++) {
        const member = this.members[i];
        member.currentX = this.door.x + (seeded(i, 31) - 0.5) * 0.75;
        member.currentZ = this.door.z + (seeded(i, 32) - 0.5) * 1.1;
        member.active = true;
      }
    } else if (next < this.visibleCount) {
      for (let i = next; i < this.visibleCount; i++) this.members[i].active = false;
    }
    this.visibleCount = next;
    for (const mesh of this.meshes) mesh.count = next;
  }

  update(dt, snapshot = {}) {
    this.elapsed += dt;
    this.targetCount = Math.max(0, Math.min(this.max, Number(snapshot.occupancy) || 0));
    if (Math.abs(this.targetCount - this.visibleCount) >= 0.5)
      this.setVisibleCount(this.targetCount);

    const rowdy = clamp(snapshot.rowdyLevel ?? 0);
    const conversation = clamp(snapshot.conversationLevel ?? 0.2);
    const evacuation = snapshot.evacuationStarted === true;
    const mood = clamp(conversation * 0.52 + rowdy * 0.82 + (evacuation ? 0.38 : 0));

    for (let i = 0; i < this.visibleCount; i++) {
      const member = this.members[i];
      member.reaction = Math.max(0, member.reaction - dt * 0.72);
      member.quietPulse = Math.max(0, member.quietPulse - dt * 0.8);
      const moveSpeed = evacuation ? 1.55 : 0.62 + mood * 0.42;
      const move = 1 - Math.exp(-moveSpeed * dt);
      member.currentX += (member.targetX - member.currentX) * move;
      member.currentZ += (member.targetZ - member.currentZ) * move;

      const sway = Math.sin(this.elapsed * member.tempo * (1.5 + mood * 2.3) + member.phase);
      const side = Math.cos(this.elapsed * member.tempo * 1.1 + member.phase * 1.7);
      const reaction = member.reaction;
      const quiet = member.quietPulse;
      const bob = Math.abs(sway) * (0.008 + mood * 0.045) + reaction * 0.065;
      const px = member.currentX + side * (0.018 + mood * 0.025);
      const pz = member.currentZ + sway * 0.014;
      const yaw = side * (0.08 + mood * 0.24);
      const s = member.scale;
      const shoulderWidth = 0.275 * s * member.shoulder;
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const forwardX = Math.sin(yaw);
      const forwardZ = Math.cos(yaw);
      const armEnergy = Math.max(0, mood + reaction * 0.9 - quiet * 0.55);
      const gait = sway * (0.12 + armEnergy * 0.48);
      const leftUpperPitch = -gait - reaction * 0.66;
      const rightUpperPitch = gait - reaction * 0.8;
      const leftElbow = -0.12 - Math.max(0, -sway) * armEnergy * 0.35 - reaction * 0.2;
      const rightElbow = -0.12 - Math.max(0, sway) * armEnergy * 0.35 - reaction * 0.32;

      this.setInstance(
        this.body,
        i,
        px,
        0.79 * s + bob,
        pz,
        yaw,
        s * member.shoulder,
        s,
        s * 0.9,
        evacuation ? -0.035 : sway * mood * 0.02,
        side * mood * 0.025,
      );
      this.setInstance(this.head, i, px, 1.5 * s + bob, pz, yaw, s * 0.94, s, s * 0.93);

      const hairTall = member.hairStyle === 1 ? 1.5 : member.hairStyle === 2 ? 1.16 : 0.72;
      const hairWide = member.hairStyle === 3 ? 1.08 : 1;
      this.setInstance(
        this.hair,
        i,
        px,
        (member.hairStyle === 1 ? 1.58 : 1.61) * s + bob,
        pz - forwardZ * 0.035,
        yaw,
        s * hairWide,
        s * hairTall,
        s * (member.hairStyle === 1 ? 0.72 : 0.92),
      );

      const upperArmY = 1.09 * s + bob;
      const forearmY = 0.88 * s + bob;
      this.setInstance(
        this.leftArm,
        i,
        px - rightX * shoulderWidth,
        upperArmY,
        pz - rightZ * shoulderWidth,
        yaw,
        s,
        s,
        s,
        leftUpperPitch,
        -0.06,
      );
      this.setInstance(
        this.rightArm,
        i,
        px + rightX * shoulderWidth,
        upperArmY,
        pz + rightZ * shoulderWidth,
        yaw,
        s,
        s,
        s,
        rightUpperPitch,
        0.06,
      );
      this.setInstance(
        this.leftForearm,
        i,
        px - rightX * shoulderWidth + forwardX * leftUpperPitch * 0.09,
        forearmY + Math.abs(leftUpperPitch) * 0.025,
        pz - rightZ * shoulderWidth + forwardZ * leftUpperPitch * 0.09,
        yaw,
        s,
        s,
        s,
        leftUpperPitch + leftElbow,
        -0.03,
      );
      this.setInstance(
        this.rightForearm,
        i,
        px + rightX * shoulderWidth + forwardX * rightUpperPitch * 0.09,
        forearmY + Math.abs(rightUpperPitch) * 0.025,
        pz + rightZ * shoulderWidth + forwardZ * rightUpperPitch * 0.09,
        yaw,
        s,
        s,
        s,
        rightUpperPitch + rightElbow,
        0.03,
      );

      const hip = 0.115 * s;
      const legY = 0.34 * s + bob * 0.12;
      const legSwing = evacuation ? sway * 0.56 : sway * (0.12 + mood * 0.16);
      this.setInstance(
        this.leftLeg,
        i,
        px - rightX * hip + forwardX * legSwing * 0.045,
        legY,
        pz - rightZ * hip + forwardZ * legSwing * 0.045,
        yaw,
        s,
        s,
        s,
        legSwing,
      );
      this.setInstance(
        this.rightLeg,
        i,
        px + rightX * hip - forwardX * legSwing * 0.045,
        legY,
        pz + rightZ * hip - forwardZ * legSwing * 0.045,
        yaw,
        s,
        s,
        s,
        -legSwing,
      );
    }

    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  interactionTargets() {
    const result = [];
    for (let i = 0; i < this.visibleCount; i++) {
      const member = this.members[i];
      result.push({
        id: member.id,
        guestIndex: i,
        name: member.smoker ? 'Person smoking outside' : 'Person hanging out outside',
        position: [member.currentX, 0, member.currentZ],
        radius: 1.18,
        action: 'alleyGuest',
      });
    }
    return result;
  }

  member(index) {
    return this.members[Math.max(0, Math.min(this.visibleCount - 1, Number(index) || 0))] ?? null;
  }

  react(index, type) {
    const member = this.member(index);
    if (!member) return;
    if (type === 'rowdy') member.reaction = 1;
    if (type === 'quiet') member.quietPulse = 1;
    for (let i = 0; i < this.visibleCount; i++) {
      if (i === index) continue;
      const other = this.members[i];
      const distance = Math.hypot(
        other.currentX - member.currentX,
        other.currentZ - member.currentZ,
      );
      if (distance > 3.4) continue;
      if (type === 'rowdy') other.reaction = Math.max(other.reaction, 0.55);
      if (type === 'quiet') other.quietPulse = Math.max(other.quietPulse, 0.6);
    }
  }

  smokePosition(index) {
    const member = this.member(index);
    return member ? [member.currentX, 0, member.currentZ] : null;
  }

  askForSmoke(index) {
    const member = this.member(index);
    return !!member?.smoker && member.generous;
  }

  voice(audio, type = 'talk') {
    const context = audio?.context;
    const destination = audio?.master;
    if (!context || !destination) return false;
    const duration = type === 'rowdy' ? 0.48 : type === 'quiet' ? 0.2 : 0.28;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const envelope = Math.sin((Math.PI * i) / Math.max(1, length - 1));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = type === 'rowdy' ? 920 : type === 'quiet' ? 1280 : 1050;
    filter.Q.value = type === 'rowdy' ? 0.7 : 1.15;
    gain.gain.value = type === 'rowdy' ? 0.12 : type === 'quiet' ? 0.035 : 0.065;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start();
    if (type === 'rowdy') {
      audio.tone?.(220, 0.18, 'sawtooth', 0.018, 0.03);
      audio.tone?.(294, 0.14, 'triangle', 0.016, 0.13);
    }
    return true;
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes = [];
  }
}
