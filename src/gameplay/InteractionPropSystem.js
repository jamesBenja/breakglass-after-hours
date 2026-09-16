import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
} from 'three';

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const material = (color, options = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.68, metalness: 0.03, ...options });

export const INTERACTION_ITEM_PROFILES = Object.freeze({
  beer: { label: 'beer', consume: true, consumeSeconds: 1.7 },
  mixed: { label: 'mixed drink', consume: true, consumeSeconds: 1.6 },
  water: { label: 'water', consume: true, consumeSeconds: 1.45 },
  coffee: { label: 'espresso', consume: true, consumeSeconds: 1.55 },
  hotdog: { label: 'hot dog', consume: true, consumeSeconds: 1.85 },
  taco: { label: 'taco', consume: true, consumeSeconds: 1.85 },
  candy: { label: 'candy', consume: false, consumeSeconds: 0.8 },
});

const add = (group, geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) => {
  const mesh = new Mesh(geometry, mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
};

export function createInteractionItem(kind) {
  const group = new Group();
  group.name = `interaction-item:${kind}`;
  const dark = material(0x252429);
  const silver = material(0xb5b7ba, { metalness: 0.55, roughness: 0.34 });
  const paper = material(0xe6ded0, { roughness: 0.9 });

  if (kind === 'beer') {
    const glass = material(0x8c5a2c, { roughness: 0.28, metalness: 0.02 });
    add(group, new CylinderGeometry(0.055, 0.06, 0.27, 12), glass);
    add(group, new CylinderGeometry(0.022, 0.022, 0.04, 10), silver, [0, 0.155, 0]);
    add(group, new BoxGeometry(0.09, 0.07, 0.008), paper, [0, 0, 0.058]);
  } else if (kind === 'mixed' || kind === 'water') {
    const liquid = material(kind === 'water' ? 0x91c7d5 : 0xd29a63, {
      transparent: true,
      opacity: 0.78,
      roughness: 0.2,
    });
    add(group, new CylinderGeometry(0.075, 0.065, 0.21, 12), liquid);
    add(group, new CylinderGeometry(0.08, 0.08, 0.012, 12), silver, [0, -0.11, 0]);
  } else if (kind === 'coffee') {
    const cup = material(0xe5ded3, { roughness: 0.72 });
    const coffee = material(0x3a2419, { roughness: 0.52 });
    add(group, new CylinderGeometry(0.072, 0.058, 0.12, 12), cup);
    add(group, new CylinderGeometry(0.057, 0.057, 0.008, 12), coffee, [0, 0.061, 0]);
    const handle = add(group, new TorusGeometry(0.047, 0.012, 6, 12, Math.PI * 1.55), cup, [0.075, 0.005, 0]);
    handle.rotation.y = Math.PI / 2;
  } else if (kind === 'hotdog') {
    const bun = material(0xd79c5e, { roughness: 0.82 });
    const sausage = material(0x9f4934, { roughness: 0.76 });
    const mustard = material(0xe0b329, { roughness: 0.62 });
    add(group, new CapsuleGeometry(0.075, 0.25, 5, 10), bun, [-0.065, 0, 0], [0, 0, Math.PI / 2]);
    add(group, new CapsuleGeometry(0.075, 0.25, 5, 10), bun, [0.065, 0, 0], [0, 0, Math.PI / 2]);
    add(group, new CapsuleGeometry(0.047, 0.3, 5, 10), sausage, [0, 0.035, 0], [0, 0, Math.PI / 2]);
    for (const x of [-0.1, 0, 0.1]) add(group, new BoxGeometry(0.08, 0.014, 0.016), mustard, [x, 0.094, 0], [0, 0, x * 4]);
    group.scale.setScalar(0.82);
  } else if (kind === 'taco') {
    const shell = material(0xd9aa55, { roughness: 0.86 });
    const filling = material(0x5d8b47, { roughness: 0.9 });
    const meat = material(0x6e4130, { roughness: 0.9 });
    add(group, new BoxGeometry(0.3, 0.025, 0.17), shell, [0, -0.035, 0], [0, 0, 0.48]);
    add(group, new BoxGeometry(0.3, 0.025, 0.17), shell, [0, -0.035, 0], [0, 0, -0.48]);
    add(group, new BoxGeometry(0.24, 0.055, 0.07), meat, [0, 0.035, 0]);
    add(group, new BoxGeometry(0.25, 0.025, 0.085), filling, [0, 0.075, 0]);
  } else {
    const wrapper = material(0xef5b89, { roughness: 0.5, metalness: 0.08 });
    add(group, new BoxGeometry(0.14, 0.065, 0.045), wrapper);
    add(group, new BoxGeometry(0.06, 0.025, 0.035), wrapper, [-0.095, 0, 0], [0, 0, 0.48]);
    add(group, new BoxGeometry(0.06, 0.025, 0.035), wrapper, [0.095, 0, 0], [0, 0, -0.48]);
    add(group, new BoxGeometry(0.05, 0.012, 0.048), paper, [0, 0.026, 0]);
  }

  group.traverse((object) => {
    if (object.isMesh) object.receiveShadow = true;
  });
  return group;
}

const disposeGroup = (group) => {
  group?.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((entry) => entry?.dispose?.());
    else object.material?.dispose?.();
  });
  group?.removeFromParent?.();
};

/**
 * Short, visual-only interaction choreography. It never changes navigation, audio transport,
 * multiplayer routing or level definitions; gameplay systems remain responsible for state.
 */
export class InteractionPropSystem {
  constructor(game) {
    this.game = game;
    this.player = game.player;
    this.sceneManager = game.sceneManager;
    this.active = null;
    this.elapsed = 0;
  }

  npc(id) {
    return this.sceneManager.current?.npcs?.get?.(id) ?? null;
  }

  playerHandWorld() {
    return this.player.object.localToWorld(new Vector3(0.34, 1.02, 0.3));
  }

  npcHandWorld(id) {
    const npc = this.npc(id);
    if (!npc?.group) return null;
    return npc.group.localToWorld(new Vector3(0.3, 1.04, 0.28));
  }

  begin({ kind, npcId = null, direction = 'receive', consume = null } = {}) {
    if (!INTERACTION_ITEM_PROFILES[kind]) return false;
    this.cancel();
    const level = this.sceneManager.current;
    if (!level?.scene) return false;
    const item = createInteractionItem(kind);
    level.scene.add(item);
    const fromNpc = direction === 'receive';
    const start = fromNpc ? this.npcHandWorld(npcId) : this.playerHandWorld();
    const end = fromNpc ? this.playerHandWorld() : this.npcHandWorld(npcId);
    if (!start || !end) {
      disposeGroup(item);
      return false;
    }
    item.position.copy(start);
    this.active = {
      kind,
      npcId,
      direction,
      consume: consume ?? (fromNpc && INTERACTION_ITEM_PROFILES[kind].consume),
      item,
      start: start.clone(),
      end: end.clone(),
      phase: 'handoff',
      time: 0,
      duration: 0.62,
    };
    this.sceneManager.current?.npcs?.triggerHandoff?.(npcId, kind);
    return true;
  }

  receiveFromNpc(npcId, kind, options = {}) {
    return this.begin({ kind, npcId, direction: 'receive', ...options });
  }

  giveToNpc(npcId, kind = 'candy') {
    return this.begin({ kind, npcId, direction: 'give', consume: false });
  }

  selfServe(kind) {
    if (!INTERACTION_ITEM_PROFILES[kind]) return false;
    this.cancel();
    const item = createInteractionItem(kind);
    this.player.object.add(item);
    item.position.set(0.38, 0.94, 0.3);
    this.active = {
      kind,
      npcId: null,
      direction: 'self',
      consume: true,
      item,
      phase: 'consume',
      time: 0,
      duration: INTERACTION_ITEM_PROFILES[kind].consumeSeconds,
    };
    return true;
  }

  attachForConsume(active) {
    const worldPosition = active.item.getWorldPosition(new Vector3());
    active.item.removeFromParent();
    this.player.object.add(active.item);
    const local = this.player.object.worldToLocal(worldPosition);
    active.item.position.copy(local);
    active.phase = active.consume ? 'consume' : 'pocket';
    active.time = 0;
    active.duration = active.consume
      ? INTERACTION_ITEM_PROFILES[active.kind].consumeSeconds
      : 0.5;
  }

  update(dt) {
    this.elapsed += dt;
    const active = this.active;
    if (!active) return;
    active.time += dt;

    if (active.phase === 'handoff') {
      const t = smooth(active.time / active.duration);
      active.start.lerp(active.end, t);
      active.item.position.copy(active.start);
      active.item.rotation.y += dt * 2.1;
      if (active.time >= active.duration) {
        if (active.direction === 'give') {
          this.finish();
          return;
        }
        this.attachForConsume(active);
      }
      return;
    }

    if (active.phase === 'pocket') {
      const t = smooth(active.time / active.duration);
      active.item.position.lerp(new Vector3(0.23, 0.73, 0.08), t);
      active.item.scale.setScalar(1 - t * 0.75);
      this.player.rightArm.rotation.x = -0.3 - t * 0.35;
      this.player.rightForearm.rotation.x = -0.55 - t * 0.28;
      if (active.time >= active.duration) this.finish();
      return;
    }

    const t = clamp01(active.time / active.duration);
    const cycle = Math.sin(Math.min(1, t * 1.18) * Math.PI);
    const eating = active.kind === 'hotdog' || active.kind === 'taco';
    const mouth = eating ? [0.18, 1.55, 0.29] : [0.16, 1.5, 0.27];
    const hand = [0.36, 0.98, 0.29];
    active.item.position.set(
      hand[0] + (mouth[0] - hand[0]) * cycle,
      hand[1] + (mouth[1] - hand[1]) * cycle,
      hand[2] + (mouth[2] - hand[2]) * cycle,
    );
    active.item.rotation.x = eating ? -0.18 * cycle : -0.9 * cycle;
    active.item.rotation.z = eating ? 0.12 : 0.08 * cycle;
    this.player.rightArm.rotation.x = -0.24 - cycle * 0.82;
    this.player.rightArm.rotation.z = 0.12 + cycle * 0.08;
    this.player.rightForearm.rotation.x = -0.42 - cycle * 1.0;
    this.player.head.rotation.x = -cycle * (eating ? 0.05 : 0.1);
    if (eating && t > 0.48) active.item.scale.setScalar(Math.max(0.28, 1 - (t - 0.48) * 0.95));
    if (active.time >= active.duration) this.finish();
  }

  finish() {
    if (!this.active) return;
    disposeGroup(this.active.item);
    this.active = null;
  }

  cancel() {
    if (!this.active) return;
    disposeGroup(this.active.item);
    this.active = null;
  }

  dispose() {
    this.cancel();
  }
}
