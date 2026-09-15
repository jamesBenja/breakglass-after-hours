import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';
import { dialogues } from './dialogues.js';

const CHARACTER_LOOKS = {
  nora: {
    skin: 0xb98768,
    hair: 0x2b1c18,
    outfit: 0x25252a,
    accent: 0x8f315e,
    hairStyle: 'long',
    prop: 'camera',
  },
  james: {
    skin: 0xc49a78,
    hair: 0x2c211d,
    outfit: 0x20232a,
    accent: 0x495e74,
    hairStyle: 'short',
    prop: 'camera',
  },
  jace: {
    skin: 0xc18f6f,
    hair: 0x33231c,
    outfit: 0x283c46,
    accent: 0x7d664a,
    hairStyle: 'short',
  },
  zander: {
    skin: 0xb77d5e,
    hair: 0x211a18,
    outfit: 0x30363d,
    accent: 0x5e776e,
    hairStyle: 'short',
  },
  boogaloo: {
    skin: 0x81543f,
    hair: 0x231a17,
    outfit: 0x4d354f,
    accent: 0xa05f32,
    hairStyle: 'short',
  },
  courtney: {
    skin: 0x9d6b52,
    hair: 0x251a18,
    outfit: 0x472d46,
    accent: 0xb66b93,
    hairStyle: 'bob',
    prop: 'bar',
  },
  simla: {
    skin: 0x9d7258,
    hair: 0x1f1917,
    outfit: 0x345444,
    accent: 0x6ea886,
    hairStyle: 'long',
    prop: 'bar',
  },
  jashim: {
    skin: 0x9a6b50,
    hair: 0x201817,
    outfit: 0x35465e,
    accent: 0x657fb2,
    hairStyle: 'short',
  },
  devin: {
    skin: 0xb57f60,
    hair: 0x2a201c,
    outfit: 0x294752,
    accent: 0x5d8998,
    hairStyle: 'short',
    prop: 'candy',
  },
  bouncer: {
    skin: 0x8b624c,
    hair: 0x231b19,
    outfit: 0x22272b,
    accent: 0x454f57,
    hairStyle: 'buzz',
  },
};

const DEFAULT_LOOK = {
  skin: 0xaa7a5f,
  hair: 0x2d211d,
  outfit: 0x3f4650,
  accent: 0x7a5f70,
  hairStyle: 'short',
};
const material = (color) => new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 });
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const variation = (id, salt = 0) => {
  let value = salt + 13;
  for (const char of String(id)) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return (value % 1000) / 999;
};

function createCharacter(npc) {
  const look = { ...DEFAULT_LOOK, ...(CHARACTER_LOOKS[npc.id] ?? {}), ...(npc.appearance ?? {}) };
  const bodyWidth = 0.94 + variation(npc.id, 2) * 0.13;
  const model = createLightweightHuman({
    skin: look.skin,
    hair: look.hair,
    outfit: look.outfit ?? npc.color ?? DEFAULT_LOOK.outfit,
    trousers: 0x181a1e,
    shoes: 0x14161a,
    accent: look.accent,
    hairStyle: look.hairStyle,
  });
  const group = model.group;
  group.name = `npc:${npc.id}`;
  model.body.scale.x = bodyWidth;
  model.leftArm.position.x *= bodyWidth;
  model.rightArm.position.x *= bodyWidth;

  const accentMat = model.materials.accent;
  const darkMat = material(0x181a1e);
  const accent = new Mesh(new BoxGeometry(0.24, 0.055, 0.025), accentMat);
  accent.position.set(0, 0.115, 0.205);
  model.body.add(accent);

  let prop = null;
  if (look.prop === 'camera') {
    prop = new Mesh(new BoxGeometry(0.2, 0.13, 0.12), darkMat);
    prop.position.set(0.31, 1.2, 0.2);
    const lens = new Mesh(new SphereGeometry(0.045, 8, 6), accentMat);
    lens.scale.z = 0.65;
    lens.position.set(0, 0, 0.085);
    prop.add(lens);
    group.add(prop);
  } else if (look.prop === 'candy') {
    prop = new Mesh(new BoxGeometry(0.15, 0.07, 0.035), accentMat);
    prop.position.set(0.31, 1.03, 0.18);
    prop.rotation.z = 0.35;
    group.add(prop);
  } else if (look.prop === 'bar') {
    prop = new Mesh(new BoxGeometry(0.085, 0.18, 0.085), accentMat);
    prop.position.set(0.3, 1.02, 0.2);
    prop.rotation.z = 0.06;
    group.add(prop);
  }

  return {
    ...model,
    torso: model.body,
    shoulder: model.body,
    hairBaseY: model.hair.position.y,
    hairBack: null,
    hairBackBaseY: 0,
    accent,
    prop,
    propKind: look.prop ?? null,
  };
}

export class NpcSystem {
  constructor(root, definition) {
    this.definition = definition;
    this.npcs = (definition.npcs ?? []).map((npc, index) => {
      const model = createCharacter(npc);
      const position = npc.anchor ? definition.anchors[npc.anchor].position : npc.position;
      model.group.position.fromArray(position ?? [0, 0, 0]);
      const heightScale = 0.96 + variation(npc.id, 19) * 0.09;
      model.group.scale.set(heightScale, heightScale, heightScale);
      if (Number.isFinite(npc.rotationY)) model.group.rotation.y = npc.rotationY;
      root.add(model.group);
      const route = (npc.route ?? []).map((point) => new Vector3().fromArray(point));
      return {
        ...model,
        id: npc.id,
        name: npc.name ?? npc.id,
        role: npc.role ?? 'guest',
        interactive:
          npc.interactive !== false &&
          !npc.id.startsWith('line-') &&
          !npc.id.startsWith('smoker-') &&
          npc.id !== 'friend',
        radius: npc.radius ?? 1.25,
        route,
        routeIndex: 0,
        speed: npc.speed ?? 0.48,
        phase: index * 2.1,
        photoPulse: 0,
        servePulse: 0,
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

  triggerServe(id) {
    const npc = this.get(id);
    if (!npc || npc.role !== 'bartender') return false;
    npc.servePulse = 1.15;
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
      npc.servePulse = Math.max(0, npc.servePulse - dt);
      npc.moving = false;
      if (npc.route.length > 1 && npc.photoPulse <= 0 && npc.servePulse <= 0) {
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

      const clubDance =
        metrics.playing && ['dancer', 'photographer', 'host', 'artist'].includes(npc.role);
      poseLightweightHuman(npc, {
        time: this.elapsed,
        phase: npc.phase,
        moving: npc.moving,
        dancing: clubDance,
        energy: clamp(energy * 0.72 + bass * 0.28),
      });

      // Named characters subtly look around when idle instead of staring straight ahead.
      if (!npc.moving && !clubDance && npc.photoPulse <= 0 && npc.servePulse <= 0) {
        npc.head.rotation.y += Math.sin(this.elapsed * 0.45 + npc.phase) * 0.035;
        npc.head.rotation.x += Math.sin(this.elapsed * 0.31 + npc.phase * 0.7) * 0.012;
      }

      if (npc.photoPulse > 0 && npc.prop && ['nora', 'james'].includes(npc.id)) {
        const lift = clamp(npc.photoPulse / 0.45);
        npc.prop.position.set(0.07, 1.48 + lift * 0.1, 0.29);
        npc.rightArm.rotation.x = -1.08 * lift;
        npc.leftArm.rotation.x = -0.94 * lift;
        npc.rightForearm.rotation.x = -0.92 * lift;
        npc.leftForearm.rotation.x = -0.82 * lift;
        npc.head.rotation.x = -0.035 * lift;
      } else if (npc.prop && ['nora', 'james'].includes(npc.id)) {
        npc.prop.position.set(0.31, 1.2, 0.2);
      }

      if (npc.role === 'bartender' && npc.propKind === 'bar' && npc.prop) {
        if (npc.servePulse > 0) {
          const phase = 1 - clamp(npc.servePulse / 1.15);
          const reach = Math.sin(Math.min(1, phase * 1.3) * Math.PI) * 0.42;
          npc.prop.position.set(0.18, 1.1 + reach * 0.2, 0.2 + reach);
          npc.rightArm.rotation.x = -0.2 - reach * 1.1;
          npc.rightForearm.rotation.x = -0.25 - reach * 1.15;
          npc.leftArm.rotation.x = -0.1 - reach * 0.25;
          npc.leftForearm.rotation.x = -0.12 - reach * 0.4;
          npc.body.rotation.x = -reach * 0.045;
        } else {
          npc.prop.position.set(0.3, 1.02, 0.2);
        }
      }
    }
  }

  dispose() {
    for (const npc of this.npcs) npc.group.removeFromParent();
    this.npcs = [];
  }
}
