import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { dialogues } from './dialogues.js';

const CHARACTER_LOOKS = {
  nora: { skin: 0xb98768, hair: 0x2b1c18, outfit: 0x25252a, accent: 0x8f315e, hairStyle: 'long', prop: 'camera' },
  james: { skin: 0xc49a78, hair: 0x2c211d, outfit: 0x20232a, accent: 0x495e74, hairStyle: 'short', prop: 'camera' },
  jace: { skin: 0xc18f6f, hair: 0x33231c, outfit: 0x283c46, accent: 0x7d664a, hairStyle: 'short' },
  zander: { skin: 0xb77d5e, hair: 0x211a18, outfit: 0x30363d, accent: 0x5e776e, hairStyle: 'short' },
  boogaloo: { skin: 0x81543f, hair: 0x231a17, outfit: 0x4d354f, accent: 0xa05f32, hairStyle: 'short' },
  courtney: { skin: 0x9d6b52, hair: 0x251a18, outfit: 0x472d46, accent: 0xb66b93, hairStyle: 'bob' },
  simla: { skin: 0x9d7258, hair: 0x1f1917, outfit: 0x345444, accent: 0x6ea886, hairStyle: 'long' },
  jashim: { skin: 0x9a6b50, hair: 0x201817, outfit: 0x35465e, accent: 0x657fb2, hairStyle: 'short' },
  devin: { skin: 0xb57f60, hair: 0x2a201c, outfit: 0x294752, accent: 0x5d8998, hairStyle: 'short' },
  bouncer: { skin: 0x8b624c, hair: 0x231b19, outfit: 0x22272b, accent: 0x454f57, hairStyle: 'buzz' },
};

const DEFAULT_LOOK = { skin: 0xaa7a5f, hair: 0x2d211d, outfit: 0x3f4650, accent: 0x7a5f70, hairStyle: 'short' };
const material = (color) => new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 });
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function createCharacter(npc) {
  const look = { ...DEFAULT_LOOK, ...(CHARACTER_LOOKS[npc.id] ?? {}), ...(npc.appearance ?? {}) };
  const group = new Group();
  group.name = `npc:${npc.id}`;
  const bodyMat = material(look.outfit ?? npc.color ?? DEFAULT_LOOK.outfit);
  const skinMat = material(look.skin);
  const hairMat = material(look.hair);
  const accentMat = material(look.accent);
  const darkMat = material(0x181a1e);

  const torso = new Mesh(new CapsuleGeometry(0.24, 0.53, 4, 8), bodyMat);
  torso.position.y = 1.03;
  torso.castShadow = true;

  const head = new Mesh(new SphereGeometry(0.22, 12, 9), skinMat);
  head.position.y = 1.67;
  head.castShadow = true;

  const hair = new Mesh(new BoxGeometry(0.37, 0.16, 0.35), hairMat);
  hair.position.y = 1.84;
  hair.castShadow = true;
  if (look.hairStyle === 'long') {
    hair.scale.set(1.04, 2.1, 1.06);
    hair.position.y = 1.73;
  } else if (look.hairStyle === 'bob') {
    hair.scale.set(1.08, 1.55, 1.08);
    hair.position.y = 1.78;
  } else if (look.hairStyle === 'buzz') {
    hair.scale.set(1.02, 0.34, 1.02);
    hair.position.y = 1.84;
  }

  const leftArm = new Mesh(new CapsuleGeometry(0.07, 0.43, 3, 6), skinMat);
  const rightArm = leftArm.clone();
  leftArm.material = skinMat;
  rightArm.material = skinMat;
  leftArm.position.set(-0.34, 1.08, 0);
  rightArm.position.set(0.34, 1.08, 0);
  leftArm.rotation.z = -0.08;
  rightArm.rotation.z = 0.08;

  const leftLeg = new Mesh(new CapsuleGeometry(0.085, 0.46, 3, 6), darkMat);
  const rightLeg = leftLeg.clone();
  leftLeg.material = darkMat;
  rightLeg.material = darkMat;
  leftLeg.position.set(-0.13, 0.44, 0);
  rightLeg.position.set(0.13, 0.44, 0);

  const shoesLeft = new Mesh(new BoxGeometry(0.16, 0.09, 0.28), darkMat);
  const shoesRight = shoesLeft.clone();
  shoesLeft.position.set(-0.13, 0.08, 0.055);
  shoesRight.position.set(0.13, 0.08, 0.055);

  const accent = new Mesh(new BoxGeometry(0.31, 0.13, 0.06), accentMat);
  accent.position.set(0, 1.28, 0.225);

  for (const mesh of [leftArm, rightArm, leftLeg, rightLeg, shoesLeft, shoesRight, accent]) {
    mesh.castShadow = true;
  }
  group.add(torso, head, hair, leftArm, rightArm, leftLeg, rightLeg, shoesLeft, shoesRight, accent);

  let prop = null;
  if (look.prop === 'camera') {
    prop = new Mesh(new BoxGeometry(0.2, 0.13, 0.12), darkMat);
    prop.position.set(0.31, 1.22, 0.19);
    const lens = new Mesh(new BoxGeometry(0.07, 0.07, 0.07), accentMat);
    lens.position.set(0, 0, 0.08);
    prop.add(lens);
    group.add(prop);
  }

  return { group, torso, head, hair, leftArm, rightArm, leftLeg, rightLeg, prop };
}

export class NpcSystem {
  constructor(root, definition) {
    this.definition = definition;
    this.npcs = (definition.npcs ?? []).map((npc, index) => {
      const model = createCharacter(npc);
      const position = npc.anchor ? definition.anchors[npc.anchor].position : npc.position;
      model.group.position.fromArray(position ?? [0, 0, 0]);
      root.add(model.group);
      const route = (npc.route ?? []).map((point) => new Vector3().fromArray(point));
      return {
        ...model,
        id: npc.id,
        name: npc.name ?? npc.id,
        role: npc.role ?? 'guest',
        interactive: npc.interactive !== false && !npc.id.startsWith('line-') && !npc.id.startsWith('smoker-') && npc.id !== 'friend',
        radius: npc.radius ?? 1.25,
        route,
        routeIndex: 0,
        speed: npc.speed ?? 0.48,
        phase: index * 2.1,
        photoPulse: 0,
        moving: false,
      };
    });
    this.elapsed = 0;
  }

  has(id) {
    return this.npcs.some((npc) => npc.id === id);
  }

  get(id) {
    return this.npcs.find((npc) => npc.id === id) ?? null;
  }

  positionOf(id) {
    return this.get(id)?.group.position ?? null;
  }

  interactionTargets() {
    return this.npcs
      .filter((npc) => npc.interactive)
      .map((npc) => ({
        id: npc.id,
        npcId: npc.id,
        name: npc.name,
        position: npc.group.position.toArray(),
        radius: npc.radius,
        action: 'dialogue',
      }));
  }

  triggerPhoto(id = 'nora') {
    const npc = this.get(id);
    if (!npc) return false;
    npc.photoPulse = 1.15;
    return true;
  }

  dialogue(id) {
    return dialogues[id] ?? null;
  }

  update(dt, audioState) {
    this.elapsed += dt;
    const metrics =
      typeof audioState === 'boolean'
        ? { playing: audioState, energy: audioState ? 0.5 : 0, bass: audioState ? 0.5 : 0 }
        : (audioState ?? { playing: false, energy: 0, bass: 0 });
    const energy = clamp(metrics.energy ?? 0);
    const bass = clamp(metrics.bass ?? energy);

    for (const npc of this.npcs) {
      npc.photoPulse = Math.max(0, npc.photoPulse - dt);
      npc.moving = false;
      if (npc.route.length > 1 && npc.photoPulse <= 0) {
        const target = npc.route[npc.routeIndex % npc.route.length];
        const dx = target.x - npc.group.position.x;
        const dz = target.z - npc.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.16) npc.routeIndex = (npc.routeIndex + 1) % npc.route.length;
        else {
          const amount = Math.min(distance, npc.speed * dt);
          npc.group.position.x += (dx / distance) * amount;
          npc.group.position.z += (dz / distance) * amount;
          npc.group.position.y += (target.y - npc.group.position.y) * (1 - Math.exp(-5 * dt));
          npc.group.rotation.y = Math.atan2(dx, dz);
          npc.moving = true;
        }
      }

      const gait = Math.sin(this.elapsed * (npc.moving ? 7.5 : 2.2) + npc.phase);
      const clubDance = metrics.playing && ['dancer', 'photographer', 'host', 'artist'].includes(npc.role);
      const danceAmount = clubDance ? 0.045 + energy * 0.09 : 0;
      const bob = npc.moving ? Math.abs(gait) * 0.025 : clubDance ? Math.abs(gait) * danceAmount : 0;
      npc.torso.position.y = 1.03 + bob;
      npc.head.position.y = 1.67 + bob;
      npc.hair.position.y += (npc.photoPulse > 0 ? 0 : 0) * dt;

      const limb = npc.moving ? gait * 0.45 : clubDance ? gait * (0.12 + bass * 0.18) : 0;
      npc.leftArm.rotation.x = limb;
      npc.rightArm.rotation.x = -limb;
      npc.leftLeg.rotation.x = -limb * 0.65;
      npc.rightLeg.rotation.x = limb * 0.65;

      if (npc.photoPulse > 0 && npc.prop) {
        const lift = clamp(npc.photoPulse / 0.45);
        npc.prop.position.set(0.08, 1.46 + lift * 0.18, 0.28);
        npc.rightArm.rotation.x = -1.25 * lift;
        npc.leftArm.rotation.x = -1.0 * lift;
      } else if (npc.prop) {
        npc.prop.position.set(0.31, 1.22, 0.19);
      }
    }
  }

  dispose() {
    for (const npc of this.npcs) npc.group.removeFromParent();
    this.npcs = [];
  }
}
