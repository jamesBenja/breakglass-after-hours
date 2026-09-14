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

  update(dt, musicPlaying) {
    this.elapsed += dt;
    for (const npc of this.npcs) {
      npc.group.position.y =
        npc.baseY + (musicPlaying ? Math.abs(Math.sin(this.elapsed / 0.23 + npc.phase)) * 0.12 : 0);
      npc.group.rotation.y = musicPlaying ? Math.sin(this.elapsed / 0.4 + npc.phase) * 0.18 : 0;
    }
  }

  dispose() {
    this.npcs = [];
  }
}
