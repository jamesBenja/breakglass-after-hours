import {
  CapsuleGeometry,
  Color,
  DynamicDrawUsage,
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
  0x232329, 0x343947, 0x6a334f, 0x274a52, 0x74462f, 0x4e3f68, 0x58643a, 0x8a5d37,
];
const SKIN_COLORS = [0xe7c2a5, 0xc99470, 0xa87558, 0x805640, 0x60402f, 0x452e24];

function chooseZone(zones, index) {
  const total = zones.reduce((sum, zone) => sum + (zone.weight ?? 1), 0) || 1;
  let pick = seeded(index, 4) * total;
  for (const zone of zones) {
    pick -= zone.weight ?? 1;
    if (pick <= 0) return zone;
  }
  return zones[zones.length - 1];
}

function inside(rect, x, z) {
  return x >= rect.x1 && x <= rect.x2 && z >= rect.z1 && z <= rect.z2;
}

/**
 * Lightweight club crowd built from two instanced meshes.
 *
 * Attendance is shared-state friendly; individual dancers remain deterministic client-side
 * decoration. DJ vibe/mix quality move people into or out of the room over time.
 */
export class CrowdSystem {
  constructor(root, config = {}) {
    this.config = config;
    this.max = Math.max(0, config.max ?? 72);
    this.idle = Math.min(this.max, Math.max(0, config.idle ?? 28));
    this.attendance = Math.min(this.max, Math.max(0, config.start ?? 44));
    this.targetAttendance = this.attendance;
    this.lastVibe = 0;
    this.lastMixQuality = 0;
    this.elapsed = 0;
    this.zones = config.zones ?? [];
    this.avoid = config.avoid ?? [];
    this.members = [];
    this.matrix = new Matrix4();
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.rotation = new Quaternion();
    this.yAxis = new Vector3(0, 1, 0);

    const bodyGeometry = new CapsuleGeometry(0.22, 0.58, 3, 6);
    const headGeometry = new SphereGeometry(0.205, 8, 6);
    const bodyMaterial = new MeshStandardMaterial({ roughness: 0.78, metalness: 0.04 });
    const headMaterial = new MeshStandardMaterial({ roughness: 0.82, metalness: 0.02 });
    this.body = new InstancedMesh(bodyGeometry, bodyMaterial, this.max);
    this.head = new InstancedMesh(headGeometry, headMaterial, this.max);
    this.body.name = 'crowd:bodies';
    this.head.name = 'crowd:heads';
    this.body.castShadow = true;
    this.head.castShadow = true;
    this.body.instanceMatrix.setUsage(DynamicDrawUsage);
    this.head.instanceMatrix.setUsage(DynamicDrawUsage);
    root.add(this.body, this.head);

    for (let i = 0; i < this.max; i++) {
      const zone = chooseZone(this.zones, i) ?? {
        x1: -4,
        x2: 4,
        z1: -2,
        z2: 2,
        kind: 'dance',
      };
      let x = 0;
      let z = 0;
      for (let attempt = 0; attempt < 8; attempt++) {
        x = zone.x1 + seeded(i + attempt * 31, 7) * (zone.x2 - zone.x1);
        z = zone.z1 + seeded(i + attempt * 43, 8) * (zone.z2 - zone.z1);
        if (!this.avoid.some((rect) => inside(rect, x, z))) break;
      }
      const member = {
        x,
        z,
        currentX: x,
        currentZ: z,
        kind: zone.kind ?? 'dance',
        phase: seeded(i, 9) * Math.PI * 2,
        tempo: 0.8 + seeded(i, 10) * 0.7,
        scale: 0.87 + seeded(i, 11) * 0.28,
      };
      this.members.push(member);
      this.body.setColorAt(i, new Color(BODY_COLORS[i % BODY_COLORS.length]));
      this.head.setColorAt(i, new Color(SKIN_COLORS[(i * 3) % SKIN_COLORS.length]));
    }
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    if (this.head.instanceColor) this.head.instanceColor.needsUpdate = true;
    this.setVisibleCount(Math.round(this.attendance));
    this.update(0, { playing: false, energy: 0, bass: 0, beat: 0 });
  }

  setVisibleCount(count) {
    const visible = Math.max(0, Math.min(this.max, count));
    this.body.count = visible;
    this.head.count = visible;
  }

  movementScaleAt(position) {
    const count = Math.round(this.attendance);
    let pressure = 0;
    for (let i = 0; i < count; i++) {
      const member = this.members[i];
      const distance = Math.hypot(position.x - member.currentX, position.z - member.currentZ);
      if (distance < 0.72) pressure += (0.72 - distance) / 0.72;
    }
    // You can always make progress, but a peak-time floor should require visibly pushing through.
    return clamp(1 - pressure * 0.14, 0.36, 1);
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

    const attraction = playing
      ? clamp(0.08 + vibe * 0.72 + mixQuality * 0.16 + beat * 0.04)
      : 0;
    const musicalTarget = playing
      ? this.idle + (this.max - this.idle) * attraction
      : this.idle;
    this.targetAttendance = Math.max(this.idle, Math.min(this.max, musicalTarget));
    const attendanceSpeed = playing ? 0.16 : 0.06;
    this.attendance +=
      (this.targetAttendance - this.attendance) * (1 - Math.exp(-attendanceSpeed * dt));
    const count = Math.round(this.attendance);
    this.setVisibleCount(count);

    const bodyScale = new Vector3();
    const headScale = new Vector3();
    for (let i = 0; i < count; i++) {
      const member = this.members[i];
      const dance = member.kind === 'dance';
      const localEnergy = dance ? clamp(energy * 0.55 + vibe * 0.55) : energy * 0.25;
      const speed = member.tempo * (1.4 + localEnergy * 2.5);
      const sway = Math.sin(this.elapsed * speed + member.phase);
      const side = Math.cos(this.elapsed * (speed * 0.72) + member.phase * 1.7);
      const beatLift = dance ? beat * 0.055 : 0;
      const bob =
        (dance ? 0.035 + localEnergy * 0.105 : 0.012 + localEnergy * 0.025) *
          Math.abs(sway) +
        beatLift;
      const drift = dance ? 0.055 + bass * 0.035 : 0.022;
      const px = member.x + side * drift;
      const pz = member.z + sway * drift * 0.55;
      member.currentX = px;
      member.currentZ = pz;
      const yaw = side * (dance ? 0.32 + localEnergy * 0.24 : 0.12);
      this.rotation.setFromAxisAngle(this.yAxis, yaw);

      bodyScale.set(member.scale, member.scale, member.scale);
      this.position.set(px, 0.68 * member.scale + bob, pz);
      this.matrix.compose(this.position, this.rotation, bodyScale);
      this.body.setMatrixAt(i, this.matrix);

      headScale.set(member.scale, member.scale, member.scale);
      this.position.set(px, 1.47 * member.scale + bob, pz);
      this.matrix.compose(this.position, this.rotation, headScale);
      this.head.setMatrixAt(i, this.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
  }

  snapshot() {
    return {
      attendance: Math.round(this.attendance),
      targetAttendance: Math.round(this.targetAttendance),
      capacity: this.max,
      density: this.max ? this.attendance / this.max : 0,
      vibe: this.lastVibe,
      mixQuality: this.lastMixQuality,
    };
  }

  dispose() {
    this.body.removeFromParent();
    this.head.removeFromParent();
    this.body.geometry.dispose();
    this.head.geometry.dispose();
    this.body.material.dispose();
    this.head.material.dispose();
    this.members = [];
  }
}
