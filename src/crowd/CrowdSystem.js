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
 * Mobile-friendly crowd simulation using two instanced meshes.
 *
 * The important state is not individual NPC AI. Each guest has deterministic dance-floor and
 * social positions, then the collective DJ vibe decides how many people stay, how many commit
 * to the floor, and how quickly a bad blend sends them toward the bar / Take A Break / edges.
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
    return clamp(1 - pressure * 0.14, 0.34, 1);
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
    const bodyScale = new Vector3();
    const headScale = new Vector3();
    for (let i = 0; i < count; i++) {
      const member = this.members[i];
      const wantsFloor = playing && member.engagement < this.danceShare;
      const target = wantsFloor ? member.dance : member.social;
      const switching = wantsFloor !== member.onFloor;
      member.onFloor = wantsFloor;
      if (wantsFloor) onFloor++;

      // A rough transition makes the exodus visible: people walk off the floor instead of
      // merely dancing less. Good mixes pull the same guests back in over a few seconds.
      const migrationSpeed = switching ? (wantsFloor ? 1.05 : 2.15) : wantsFloor ? 0.45 : 0.7;
      const migration = 1 - Math.exp(-migrationSpeed * dt);
      member.currentX += (target.x - member.currentX) * migration;
      member.currentZ += (target.z - member.currentZ) * migration;

      const localEnergy = wantsFloor ? clamp(energy * 0.45 + vibe * 0.72) : energy * 0.18;
      const speed = member.tempo * (1.25 + localEnergy * 2.9);
      const sway = Math.sin(this.elapsed * speed + member.phase);
      const side = Math.cos(this.elapsed * (speed * 0.72) + member.phase * 1.7);
      const cheer = wantsFloor && mixQuality > 0.82 ? beat * 0.09 : 0;
      const bob =
        (wantsFloor ? 0.025 + localEnergy * 0.13 : 0.008 + localEnergy * 0.018) * Math.abs(sway) +
        cheer;
      const drift = wantsFloor ? 0.05 + bass * 0.04 : 0.018;
      const px = member.currentX + side * drift;
      const pz = member.currentZ + sway * drift * 0.55;
      const yaw = side * (wantsFloor ? 0.34 + localEnergy * 0.3 : 0.09);
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
    this.danceFloorCount = onFloor;
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
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
    this.body.removeFromParent();
    this.head.removeFromParent();
    this.body.geometry.dispose();
    this.head.geometry.dispose();
    this.body.material.dispose();
    this.head.material.dispose();
    this.members = [];
  }
}
