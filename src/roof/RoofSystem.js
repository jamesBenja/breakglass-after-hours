import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

const seeded = (index, salt = 0) => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Small ambient system for the founders' rooftop hangout. It keeps the throwback readable without
 * scripting the NPC dialogue: cigarette smoke drifts above the group and, every so often, a harmless
 * bit of studio junk arcs over the parapet into the alley dumpster below.
 */
export class RoofSystem {
  constructor(root, config = {}) {
    this.root = root;
    this.config = config;
    this.elapsed = 0;
    this.throwCount = 0;
    this.throwAge = Infinity;
    this.throwDuration = 1.45;
    this.nextThrow = 5.5;
    this.start = new Vector3();
    this.end = new Vector3();

    this.group = new Group();
    this.group.name = 'roof-throwback-ambience';
    root.add(this.group);

    this.junkMaterial = new MeshStandardMaterial({ color: 0x85745f, roughness: 0.88, metalness: 0.04 });
    this.junk = new Mesh(new BoxGeometry(0.18, 0.12, 0.22), this.junkMaterial);
    this.junk.name = 'roof-junk-in-flight';
    this.junk.visible = false;
    this.junk.castShadow = true;
    this.group.add(this.junk);

    this.smokeGeometry = new SphereGeometry(0.11, 7, 5);
    this.smoke = [];
    const smokers = config.smokers ?? [];
    for (let i = 0; i < Math.max(6, smokers.length * 3); i++) {
      const smoker = smokers[i % Math.max(1, smokers.length)] ?? [0, 1.55, 0];
      const material = new MeshBasicMaterial({
        color: 0xc9c8c1,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      });
      const puff = new Mesh(this.smokeGeometry, material);
      const phase = seeded(i, 91);
      puff.position.set(smoker[0], smoker[1] + phase * 0.6, smoker[2]);
      puff.scale.setScalar(0.55 + phase * 0.9);
      this.group.add(puff);
      this.smoke.push({ puff, material, smoker, phase: phase * Math.PI * 2, speed: 0.18 + seeded(i, 92) * 0.18 });
    }
  }

  beginThrow() {
    const sources = this.config.throwSources ?? [[0, 1.1, 2.8]];
    const target = this.config.dumpster ?? [1.4, -2.8, 7.0];
    const source = sources[this.throwCount % sources.length];
    this.start.fromArray(source);
    this.end.fromArray(target);
    this.throwAge = 0;
    this.throwCount += 1;
    this.junk.visible = true;
    this.junk.scale.set(
      0.7 + seeded(this.throwCount, 12) * 0.7,
      0.65 + seeded(this.throwCount, 13) * 0.8,
      0.7 + seeded(this.throwCount, 14) * 0.7,
    );
    const palette = [0x85745f, 0x5f676f, 0x6e533f, 0x9a8d72];
    this.junkMaterial.color.setHex(palette[this.throwCount % palette.length]);
    this.nextThrow = 9 + seeded(this.throwCount, 77) * 8;
  }

  update(dt) {
    this.elapsed += dt;
    this.nextThrow -= dt;
    if (this.nextThrow <= 0 && !this.junk.visible) this.beginThrow();

    if (this.junk.visible) {
      this.throwAge += dt;
      const t = Math.min(1, this.throwAge / this.throwDuration);
      this.junk.position.lerpVectors(this.start, this.end, t);
      this.junk.position.y += Math.sin(Math.PI * t) * 2.25;
      this.junk.rotation.x += dt * 5.4;
      this.junk.rotation.z += dt * 3.8;
      if (t >= 1) this.junk.visible = false;
    }

    for (let i = 0; i < this.smoke.length; i++) {
      const smoke = this.smoke[i];
      const cycle = (this.elapsed * smoke.speed + smoke.phase) % 1;
      const rise = cycle * 0.95;
      smoke.puff.position.set(
        smoke.smoker[0] + Math.sin(this.elapsed * 0.35 + smoke.phase) * rise * 0.18,
        smoke.smoker[1] + 0.15 + rise,
        smoke.smoker[2] + Math.cos(this.elapsed * 0.29 + smoke.phase) * rise * 0.13,
      );
      const size = 0.45 + cycle * 1.55;
      smoke.puff.scale.set(size * 1.2, size, size * 1.1);
      smoke.material.opacity = Math.max(0, 0.105 * (1 - cycle));
    }
  }

  snapshot() {
    return { throws: this.throwCount, nextThrow: Math.max(0, this.nextThrow) };
  }

  dispose() {
    this.group.removeFromParent();
    this.junk.geometry.dispose();
    this.junkMaterial.dispose();
    this.smokeGeometry.dispose();
    for (const smoke of this.smoke) smoke.material.dispose();
    this.smoke = [];
  }
}
