import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';
import { dialogues } from './dialogues.js';

export const CHARACTER_LOOKS = {
  nora: {
    skin: 0xc99779,
    hair: 0xef4d87,
    outfit: 0x303139,
    accent: 0xa95c83,
    hairStyle: 'long',
    prop: 'camera',
    bodyWidth: 0.9,
    heightScale: 0.99,
    tattoos: true,
  },
  malaika: {
    skin: 0xc89073,
    hair: 0xe8d2a9,
    outfit: 0x15171b,
    trousers: 0x111318,
    accent: 0xcf4058,
    hairStyle: 'long',
    curls: true,
    glasses: true,
    tattoos: true,
    lipColor: 0xd94f62,
    bodyWidth: 0.88,
    heightScale: 1.0,
  },
  sam: {
    skin: 0xc68f72,
    hair: 0x211b1b,
    outfit: 0x1c2026,
    trousers: 0x12151b,
    accent: 0x606b77,
    hairStyle: 'bald',
    tattoos: true,
    headTattoo: true,
    bodyWidth: 0.78,
    heightScale: 1.13,
  },
  james: {
    skin: 0xc79472,
    hair: 0xd1b47c,
    outfit: 0x1d2025,
    accent: 0x607184,
    hairStyle: 'long',
    bodyWidth: 0.9,
    heightScale: 1.02,
    prop: 'camera',
  },
  jace: {
    skin: 0xc28f70,
    hair: 0xc7a878,
    outfit: 0x1d2024,
    accent: 0x9f4c5a,
    hairStyle: 'long',
    glasses: true,
    bodyWidth: 0.96,
    heightScale: 1.04,
  },
  zander: {
    skin: 0xd1a083,
    hair: 0x76563e,
    outfit: 0xe6e0d5,
    trousers: 0x7b8792,
    accent: 0x493d39,
    hairStyle: 'long',
    curls: true,
    glasses: true,
    bodyWidth: 0.84,
    heightScale: 1.05,
  },
  boogaloo: {
    skin: 0x9b684c,
    hair: 0x211b1a,
    outfit: 0xc9cac6,
    accent: 0xc0a35f,
    hairStyle: 'long',
    curls: true,
    bodyWidth: 0.92,
    heightScale: 1.06,
  },
  courtney: {
    skin: 0xc18b70,
    hair: 0x251a1a,
    outfit: 0x202126,
    accent: 0xa9577c,
    hairStyle: 'bob',
    bun: true,
    glasses: true,
    tattoos: true,
    bodyWidth: 0.9,
    heightScale: 0.98,
    prop: 'bar',
  },
  simla: {
    skin: 0xa97860,
    hair: 0x22191a,
    outfit: 0xd36c83,
    accent: 0xefb1c0,
    hairStyle: 'bob',
    bodyWidth: 0.86,
    heightScale: 0.98,
    prop: 'bar',
  },
  lunice: {
    skin: 0x73503f,
    hair: 0x211b19,
    outfit: 0xe2e0db,
    accent: 0x7467a8,
    hairStyle: 'buzz',
    beard: true,
    bodyWidth: 1.02,
    heightScale: 1.04,
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
  david: {
    skin: 0xb68a68,
    hair: 0x5a4638,
    outfit: 0x66513f,
    accent: 0xa88a62,
    hairStyle: 'short',
  },
  beaver: {
    skin: 0xc28b6a,
    hair: 0x654736,
    outfit: 0x242326,
    accent: 0xc26d3e,
    hairStyle: 'short',
    beard: true,
    mustache: true,
    bodyWidth: 1.18,
    heightScale: 1.02,
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

function addReferenceDetails(model, look) {
  const ink = material(0x27262b);
  if (look.glasses) {
    for (const x of [-0.074, 0.074]) {
      for (const y of [0.062, -0.002]) {
        const bar = new Mesh(new BoxGeometry(0.12, 0.012, 0.012), ink);
        bar.position.set(x, y, 0.232);
        model.head.add(bar);
      }
      for (const side of [-1, 1]) {
        const bar = new Mesh(new BoxGeometry(0.012, 0.072, 0.012), ink);
        bar.position.set(x + side * 0.054, 0.03, 0.232);
        model.head.add(bar);
      }
    }
    const bridge = new Mesh(new BoxGeometry(0.035, 0.01, 0.012), ink);
    bridge.position.set(0, 0.031, 0.234);
    model.head.add(bridge);
  }
  if (look.lipColor) {
    const lips = new Mesh(new BoxGeometry(0.086, 0.018, 0.016), material(look.lipColor));
    lips.position.set(0, -0.116, 0.204);
    model.head.add(lips);
  }
  if (look.tattoos) {
    for (const arm of [model.leftForearm, model.rightForearm]) {
      for (let i = 0; i < 4; i++) {
        const mark = new Mesh(new BoxGeometry(0.055 + i * 0.008, 0.012, 0.012), ink);
        mark.position.set((i % 2 ? 1 : -1) * 0.018, -0.08 - i * 0.058, 0.054);
        mark.rotation.z = i * 0.43;
        arm.add(mark);
      }
    }
  }
  if (look.headTattoo) {
    for (let i = 0; i < 3; i++) {
      const mark = new Mesh(new BoxGeometry(0.018, 0.085 - i * 0.014, 0.012), ink);
      mark.position.set((i - 1) * 0.038, 0.135 - i * 0.02, 0.214);
      mark.rotation.z = (i - 1) * 0.24;
      model.head.add(mark);
    }
  }
  if (look.beard) {
    const beard = new Mesh(new SphereGeometry(0.15, 9, 7), model.materials.hair);
    beard.scale.set(0.82, 0.52, 0.55);
    beard.position.set(0, -0.145, 0.13);
    model.head.add(beard);
  }
  if (look.mustache) {
    const moustache = new Mesh(new BoxGeometry(0.105, 0.025, 0.02), model.materials.hair);
    moustache.position.set(0, -0.086, 0.216);
    model.head.add(moustache);
  }
  if (look.bun) {
    const bun = new Mesh(new SphereGeometry(0.12, 9, 7), model.materials.hair);
    bun.position.set(0, 0.16, -0.17);
    model.head.add(bun);
  }
  if (look.curls) {
    for (const [x, y, z, s] of [
      [-0.18, -0.12, -0.08, 1],
      [0.18, -0.12, -0.08, 1],
      [-0.15, -0.3, -0.1, 0.9],
      [0.15, -0.3, -0.1, 0.9],
      [-0.05, -0.42, -0.12, 0.82],
      [0.08, -0.45, -0.12, 0.82],
    ]) {
      const curl = new Mesh(new SphereGeometry(0.074 * s, 8, 6), model.materials.hair);
      curl.scale.set(0.75, 1.25, 0.72);
      curl.position.set(x, y, z);
      model.head.add(curl);
    }
  }
}

export function createNpcCharacter(npc) {
  const look = { ...DEFAULT_LOOK, ...(CHARACTER_LOOKS[npc.id] ?? {}), ...(npc.appearance ?? {}) };
  const bodyWidth = look.bodyWidth ?? 0.94 + variation(npc.id, 2) * 0.13;
  const model = createLightweightHuman({
    skin: look.skin,
    hair: look.hair,
    outfit: look.outfit ?? npc.color ?? DEFAULT_LOOK.outfit,
    trousers: look.trousers ?? 0x181a1e,
    shoes: look.shoes ?? 0x14161a,
    accent: look.accent,
    hairStyle: look.hairStyle,
  });
  const group = model.group;
  group.name = `npc:${npc.id}`;
  model.body.scale.x = bodyWidth;
  model.leftArm.position.x *= bodyWidth;
  model.rightArm.position.x *= bodyWidth;
  addReferenceDetails(model, look);

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
    heightScale: look.heightScale ?? null,
  };
}

export class NpcSystem {
  constructor(root, definition) {
    this.definition = definition;
    this.npcs = (definition.npcs ?? []).map((npc, index) => {
      const model = createNpcCharacter(npc);
      const position = npc.anchor ? definition.anchors[npc.anchor].position : npc.position;
      model.group.position.fromArray(position ?? [0, 0, 0]);
      const heightScale = model.heightScale ?? 0.96 + variation(npc.id, 19) * 0.09;
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
