import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { rectangle } from '../collision/shapes.js';

/**
 * Visual + collision doors whose lock state follows boolean GameState fields.
 * Gates are deliberately data-driven so future difficulty modes can change clues
 * without changing room topology.
 */
export class ProgressionGateSystem {
  constructor(root, collision, configs = []) {
    this.root = root;
    this.collision = collision;
    this.gates = [];

    for (const config of configs) {
      const shape = config.collision;
      if (!shape) continue;
      const obstacle = {
        id: config.id,
        ...shape,
        points: shape.points ?? rectangle(shape.x1, shape.x2, shape.z1, shape.z2),
      };
      collision.obstacles.push(obstacle);

      let mesh = null;
      const visual = config.visual;
      if (visual) {
        const material = new MeshStandardMaterial({
          color: visual.color ?? 0x334238,
          roughness: 0.78,
          metalness: 0.12,
          emissive: visual.emissive ?? 0x07140b,
          emissiveIntensity: 0.5,
        });
        mesh = new Mesh(new BoxGeometry(visual.size[0], visual.size[1], visual.size[2]), material);
        mesh.name = `progression-gate:${config.id}`;
        mesh.position.fromArray(visual.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
      }

      this.gates.push({ config, obstacle, mesh, unlocked: false });
    }
  }

  setUnlocked(id, unlocked) {
    const gate = this.gates.find((item) => item.config.id === id);
    if (!gate) return false;
    const nextUnlocked = unlocked === true;
    const changed = gate.unlocked !== nextUnlocked;
    gate.unlocked = nextUnlocked;
    gate.obstacle.player = !gate.unlocked;
    gate.obstacle.camera = !gate.unlocked;
    if (gate.mesh) gate.mesh.visible = !gate.unlocked;
    if (changed) this.collision?.markNavigationChanged?.();
    return true;
  }

  sync(state = {}) {
    for (const gate of this.gates) {
      const requirement = gate.config.requires;
      this.setUnlocked(gate.config.id, requirement ? state[requirement] === true : false);
    }
  }

  snapshot() {
    return this.gates.map((gate) => ({
      id: gate.config.id,
      requires: gate.config.requires ?? null,
      unlocked: gate.unlocked,
    }));
  }

  dispose() {
    for (const gate of this.gates) {
      const index = this.collision.obstacles.indexOf(gate.obstacle);
      if (index >= 0) this.collision.obstacles.splice(index, 1);
      if (gate.mesh) {
        gate.mesh.removeFromParent();
        gate.mesh.geometry.dispose();
        gate.mesh.material.dispose();
      }
    }
    this.gates = [];
  }
}
