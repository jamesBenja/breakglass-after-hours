import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
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
    const skinMaterial = new MeshStandardMaterial({ roughness: 0.84, metalness: 0.015 });
    const legMaterial = new MeshStandardMaterial({ roughness: 0.86, metalness: 0.02 });
    this.body = new InstancedMesh(new CapsuleGeometry(0.22, 0.56, 3, 6), bodyMaterial, max);
    this.head = new InstancedMesh(new SphereGeometry(0.19, 8, 6), skinMaterial, max);
    this.leftArm = new InstancedMesh(
      new CapsuleGeometry(0.055, 0.34, 3, 5),
      skinMaterial.clone(),
      max,
    );
    this.rightArm = new InstancedMesh(
      new CapsuleGeometry(0.055, 0.34, 3, 5),
      skinMaterial.clone(),
      max,
    );
    this.legs = new InstancedMesh(new BoxGeometry(0.3, 0.62, 0.18), legMaterial, max);
    this.meshes = [this.body, this.head, this.leftArm, this.rightArm, this.legs];
    for (const [index, mesh] of this.meshes.entries()) {
      mesh.name = `alley-crowd:${['body', 'head', 'left-arm', 'right-arm', 'legs'][index]}`;
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
        phase: seeded(i, 15) * Math.PI * 2,
        tempo: 0.75 + seeded(i, 16) * 0.8,
        smoker: seeded(i, 17) < 0.48,
        generous: seeded(i, 18) < 0.62,
        reaction: 0,
        quietPulse: 0,
        active: false,
      };
      this.members.push(member);
      const bodyColor = new Color(BODY_COLORS[i % BODY_COLORS.length]);
      const skinColor = new Color(SKIN_COLORS[(i * 3) % SKIN_COLORS.length]);
      const legColor = new Color(LEG_COLORS[(i * 5) % LEG_COLORS.length]);
      this.body.setColorAt(i, bodyColor);
      this.head.setColorAt(i, skinColor);
      this.leftArm.setColorAt(i, skinColor);
      this.rightArm.setColorAt(i, skinColor);
      this.legs.setColorAt(i, legColor);
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
      const bob = Math.abs(sway) * (0.008 + mood * 0.055) + reaction * 0.08;
      const px = member.currentX + side * (0.018 + mood * 0.025);
      const pz = member.currentZ + sway * 0.014;
      const yaw = side * (0.08 + mood * 0.24);
      const s = member.scale;
      const armEnergy = Math.max(0, mood + reaction * 0.9 - quiet * 0.55);
      const leftPitch = -sway * (0.12 + armEnergy * 0.55) - reaction * 0.8;
      const rightPitch = sway * (0.12 + armEnergy * 0.55) - reaction * 1.05;

      this.setInstance(this.body, i, px, 0.72 * s + bob, pz, yaw, s, s, s);
      this.setInstance(this.head, i, px, 1.48 * s + bob, pz, yaw, s, s, s);
      this.setInstance(
        this.leftArm,
        i,
        px - 0.29 * s,
        1.04 * s + bob,
        pz,
        yaw,
        s,
        s,
        s,
        leftPitch,
        -0.08,
      );
      this.setInstance(
        this.rightArm,
        i,
        px + 0.29 * s,
        1.04 * s + bob,
        pz,
        yaw,
        s,
        s,
        s,
        rightPitch,
        0.08,
      );
      this.setInstance(this.legs, i, px, 0.36 * s, pz, yaw, s, s, s);
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
