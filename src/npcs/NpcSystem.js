import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { createLightweightHuman, poseLightweightHuman } from '../avatar/LightweightHuman.js';
import { createWorldNameplate } from '../ui/WorldNameplate.js';
import { dialogues } from './dialogues.js';
import { NpcNavigator } from './NpcNavigator.js';

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
    skin: 0xb78368,
    hair: 0x151619,
    outfit: 0x111214,
    trousers: 0x777a7d,
    accent: 0x4f565e,
    hairStyle: 'long',
    bangs: true,
    tattoos: true,
    neckTattoo: true,
    handTattoos: true,
    bodyWidth: 1.08,
    heightScale: 0.98,
  },
  devin: {
    skin: 0xb57f60,
    hair: 0x2a201c,
    outfit: 0x294752,
    accent: 0x5d8998,
    hairStyle: 'short',
    prop: 'candy',
  },
  dave: {
    skin: 0xb9876a,
    hair: 0x231c1a,
    outfit: 0x26292c,
    trousers: 0x17191d,
    accent: 0x9b895f,
    hairStyle: 'short',
    beard: true,
    mustache: true,
    cap: true,
    bodyWidth: 1.0,
    heightScale: 1.02,
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
  if (look.bangs) {
    for (const [x, y, scale, tilt] of [
      [-0.13, 0.045, 1.0, -0.22],
      [-0.045, 0.0, 1.12, -0.08],
      [0.045, -0.01, 1.08, 0.08],
      [0.13, 0.035, 0.96, 0.22],
    ]) {
      const lock = new Mesh(new SphereGeometry(0.072 * scale, 8, 6), model.materials.hair);
      lock.scale.set(0.7, 1.55, 0.62);
      lock.position.set(x, y, 0.19);
      lock.rotation.z = tilt;
      model.head.add(lock);
    }
  }
  if (look.neckTattoo) {
    for (let i = 0; i < 3; i++) {
      const mark = new Mesh(new BoxGeometry(0.045 + i * 0.008, 0.012, 0.012), ink);
      mark.position.set((i - 1) * 0.028, -0.015 - i * 0.018, 0.071);
      mark.rotation.z = (i - 1) * 0.45;
      model.neck.add(mark);
    }
  }
  if (look.handTattoos) {
    for (const hand of [model.leftHand, model.rightHand]) {
      for (let i = 0; i < 2; i++) {
        const mark = new Mesh(new BoxGeometry(0.032, 0.009, 0.01), ink);
        mark.position.set((i ? 1 : -1) * 0.016, 0, 0.055);
        mark.rotation.z = i ? 0.6 : -0.6;
        hand.add(mark);
      }
    }
  }
  if (look.cap) {
    const cap = new Mesh(new SphereGeometry(0.238, 10, 7), model.materials.hair);
    cap.scale.set(1.02, 0.43, 1.02);
    cap.position.set(0, 0.185, 0.002);
    const brim = new Mesh(new BoxGeometry(0.24, 0.035, 0.16), model.materials.hair);
    brim.position.set(0, 0.115, 0.21);
    brim.rotation.x = -0.08;
    const badge = new Mesh(new BoxGeometry(0.075, 0.018, 0.012), model.materials.accent);
    badge.position.set(0, 0.155, 0.225);
    model.head.add(cap, brim, badge);
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
  constructor(root, definition, collision = null) {
    this.definition = definition;
    this.collision = collision;
    this.navigator = collision ? new NpcNavigator(collision) : null;
    this.npcs = (definition.npcs ?? []).map((npc, index) => {
      const model = createNpcCharacter(npc);
      const position = npc.anchor ? definition.anchors[npc.anchor].position : npc.position;
      model.group.position.fromArray(position ?? [0, 0, 0]);
      const heightScale = model.heightScale ?? 0.96 + variation(npc.id, 19) * 0.09;
      model.group.scale.set(heightScale, heightScale, heightScale);
      if (Number.isFinite(npc.rotationY)) model.group.rotation.y = npc.rotationY;
      root.add(model.group);
      const route = (npc.route ?? []).map((point) => new Vector3().fromArray(point));
      const interactive =
        npc.interactive !== false &&
        !npc.id.startsWith('line-') &&
        !npc.id.startsWith('smoker-') &&
        npc.id !== 'friend';
      const nameplate = interactive && npc.name ? createWorldNameplate(npc.name) : null;
      if (nameplate) model.group.add(nameplate.sprite);
      return {
        ...model,
        id: npc.id,
        name: npc.name ?? npc.id,
        role: npc.role ?? 'guest',
        interactive,
        nameplate,
        radius: npc.radius ?? 1.25,
        route,
        routeIndex: 0,
        speed: npc.speed ?? 0.48,
        companionId: npc.companionId ?? null,
        companionOffset: Array.isArray(npc.companionOffset)
          ? new Vector3().fromArray(npc.companionOffset)
          : new Vector3(0.85, 0, 0.45),
        phase: index * 2.1,
        photoPulse: 0,
        servePulse: 0,
        handoffPulse: 0,
        handoffKind: null,
        moving: false,
        navPath: [],
        navPathIndex: 0,
        navGoal: null,
        navStuckTime: 0,
        navFailures: 0,
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

  triggerHandoff(id, kind = 'item') {
    const npc = this.get(id);
    if (!npc) return false;
    npc.handoffPulse = 1.15;
    npc.handoffKind = kind;
    return true;
  }

  dialogue(id) {
    return dialogues[id] ?? null;
  }

  resetNavigation(npc) {
    npc.navPath = [];
    npc.navPathIndex = 0;
    npc.navGoal = null;
    npc.navStuckTime = 0;
  }

  planNavigation(npc, target) {
    if (!this.navigator) {
      npc.navPath = [target.clone ? target.clone() : new Vector3(target.x, target.y ?? 0, target.z)];
      npc.navPathIndex = 0;
      npc.navGoal = target.clone ? target.clone() : new Vector3(target.x, target.y ?? 0, target.z);
      return true;
    }

    this.navigator.clearCache();
    const path = this.navigator.plan(npc.group.position, target);
    if (!path.length) {
      npc.navFailures += 1;
      this.resetNavigation(npc);
      return false;
    }

    npc.navPath = path.map((point) => new Vector3(point.x, point.y ?? npc.group.position.y, point.z));
    npc.navPathIndex = 0;
    npc.navGoal = target.clone ? target.clone() : new Vector3(target.x, target.y ?? 0, target.z);
    npc.navFailures = 0;
    npc.navStuckTime = 0;
    return true;
  }

  navigationGoalChanged(npc, target, tolerance = 0.2) {
    if (!npc.navGoal) return true;
    return Math.hypot(npc.navGoal.x - target.x, npc.navGoal.z - target.z) > tolerance;
  }

  moveNpc(npc, target, speed, dt) {
    const dx = target.x - npc.group.position.x;
    const dz = target.z - npc.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-5) return 0;

    const amount = Math.min(distance, speed * dt);
    const beforeX = npc.group.position.x;
    const beforeZ = npc.group.position.z;
    const moveX = (dx / distance) * amount;
    const moveZ = (dz / distance) * amount;

    if (this.collision) {
      this.collision.move(npc.group.position, moveX, moveZ, { grounded: true });
    } else {
      npc.group.position.x += moveX;
      npc.group.position.z += moveZ;
    }

    npc.group.rotation.y = Math.atan2(dx, dz);
    const moved = Math.hypot(
      npc.group.position.x - beforeX,
      npc.group.position.z - beforeZ,
    );
    npc.moving = moved > 0.001;
    return moved;
  }

  followNavigation(npc, target, dt, { dynamic = false, speedMultiplier = 1 } = {}) {
    const arrival = dynamic ? 0.72 : 0.18;
    if (
      !dynamic &&
      Math.hypot(target.x - npc.group.position.x, target.z - npc.group.position.z) <= arrival
    ) {
      this.resetNavigation(npc);
      return true;
    }

    if (
      !npc.navPath.length ||
      npc.navPathIndex >= npc.navPath.length ||
      this.navigationGoalChanged(npc, target, dynamic ? 0.7 : 0.12)
    ) {
      if (!this.planNavigation(npc, target)) return false;
    }

    while (npc.navPathIndex < npc.navPath.length) {
      const waypoint = npc.navPath[npc.navPathIndex];
      const distance = Math.hypot(
        waypoint.x - npc.group.position.x,
        waypoint.z - npc.group.position.z,
      );
      if (distance > 0.18) break;
      npc.navPathIndex += 1;
    }

    if (npc.navPathIndex >= npc.navPath.length) {
      this.resetNavigation(npc);
      return true;
    }

    const waypoint = npc.navPath[npc.navPathIndex];
    const moved = this.moveNpc(npc, waypoint, npc.speed * speedMultiplier, dt);
    const remaining = Math.hypot(
      waypoint.x - npc.group.position.x,
      waypoint.z - npc.group.position.z,
    );

    if (remaining > 0.22 && moved < Math.max(0.0015, npc.speed * dt * 0.12)) {
      npc.navStuckTime += dt;
    } else {
      npc.navStuckTime = Math.max(0, npc.navStuckTime - dt * 2);
    }

    if (npc.navStuckTime > 0.65) {
      npc.navFailures += 1;
      this.resetNavigation(npc);
      if (this.navigator) this.navigator.clearCache();
      return false;
    }

    return false;
  }

  advanceRoute(npc) {
    if (!npc.route.length) return;
    npc.routeIndex = (npc.routeIndex + 1) % npc.route.length;
    this.resetNavigation(npc);
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
      npc.handoffPulse = Math.max(0, npc.handoffPulse - dt);
      if (npc.handoffPulse <= 0) npc.handoffKind = null;
      npc.moving = false;
      const companion = npc.companionId ? this.get(npc.companionId) : null;
      const canWalk = npc.photoPulse <= 0 && npc.servePulse <= 0 && npc.handoffPulse <= 0;
      if (companion && canWalk) {
        const target = companion.group.position.clone().add(npc.companionOffset);
        const distance = Math.hypot(
          target.x - npc.group.position.x,
          target.z - npc.group.position.z,
        );
        if (distance > 0.78) {
          this.followNavigation(npc, target, dt, { dynamic: true, speedMultiplier: 1.18 });
        } else {
          this.resetNavigation(npc);
          npc.group.rotation.y = companion.group.rotation.y;
        }
      } else if (npc.route.length > 1 && canWalk) {
        let attempts = 0;
        while (attempts < npc.route.length) {
          const target = npc.route[npc.routeIndex % npc.route.length];
          const reached = this.followNavigation(npc, target, dt);
          if (reached) {
            this.advanceRoute(npc);
            attempts += 1;
            continue;
          }

          // A route point may sit behind a currently locked progression gate. If pathfinding
          // cannot reach it, skip that leg rather than having the character walk into the wall
          // forever. Once the gate changes, later laps can use the point normally.
          if (!npc.navPath.length && npc.navFailures > 0) {
            this.advanceRoute(npc);
            attempts += 1;
            continue;
          }
          break;
        }
      } else if (!canWalk) {
        this.resetNavigation(npc);
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
      if (
        !npc.moving &&
        !clubDance &&
        npc.photoPulse <= 0 &&
        npc.servePulse <= 0 &&
        npc.handoffPulse <= 0
      ) {
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

      if (npc.handoffPulse > 0 && npc.role !== 'bartender') {
        const phase = 1 - clamp(npc.handoffPulse / 1.15);
        const reach = Math.sin(Math.min(1, phase * 1.32) * Math.PI) * 0.52;
        npc.rightArm.rotation.x = -0.18 - reach * 1.05;
        npc.rightArm.rotation.z = 0.06 + reach * 0.14;
        npc.rightForearm.rotation.x = -0.28 - reach * 1.18;
        npc.leftArm.rotation.x = -0.08 - reach * 0.16;
        npc.body.rotation.x = -reach * 0.045;
        npc.head.rotation.x = -reach * 0.035;
        if (npc.prop && npc.propKind === 'candy') {
          npc.prop.position.set(0.3, 1.17 + reach * 0.08, 0.2 + reach * 0.55);
        }
      } else if (npc.prop && npc.propKind === 'candy') {
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
    for (const npc of this.npcs) {
      npc.nameplate?.dispose?.();
      npc.group.removeFromParent();
    }
    this.npcs = [];
  }
}
