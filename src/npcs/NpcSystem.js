import { Group, Mesh, CapsuleGeometry, MeshStandardMaterial } from 'three';
import { dialogues } from './dialogues.js';

export class NpcSystem {
  constructor(root, definition) {
    this.npcs = definition.npcs.map((npc, index) => {
      const group = new Group();
      group.name = `npc:${npc.id}`;
      const position = npc.anchor ? definition.anchors[npc.anchor].position : npc.position;
      group.position.fromArray(position);
      const body = new Mesh(
        new CapsuleGeometry(0.28, 0.75, 4, 8),
        new MeshStandardMaterial({ color: npc.color, roughness: 0.8, metalness: 0.08 }),
      );
      body.position.y = 0.78;
      body.castShadow = true;
      group.add(body);
      root.add(group);
      return { id: npc.id, group, baseY: position[1], phase: index * 2.1 };
    });
    this.elapsed = 0;
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
    const energy = Math.max(0, Math.min(1, metrics.energy ?? 0));
    const bass = Math.max(0, Math.min(1, metrics.bass ?? energy));
    const amount = metrics.playing ? 0.035 + energy * 0.14 : 0;
    const speed = 0.34 - bass * 0.12;
    for (const npc of this.npcs) {
      npc.group.position.y =
        npc.baseY +
        (metrics.playing ? Math.abs(Math.sin(this.elapsed / speed + npc.phase)) * amount : 0);
      npc.group.rotation.y = metrics.playing
        ? Math.sin(this.elapsed / (0.48 - energy * 0.18) + npc.phase) * (0.1 + energy * 0.2)
        : 0;
    }
  }

  dispose() {
    this.npcs = [];
  }
}
