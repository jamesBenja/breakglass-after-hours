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

const setVisible = (object, visible) => {
  if (object) object.visible = visible;
};

/**
 * Rooftop ambience plus physical one-shot animations used by the roof interactions.
 */
export class RoofSystem {
  constructor(root, config = {}) {
    this.root = root;
    this.config = config;
    this.elapsed = 0;
    this.throwCount = 0;
    this.throwAge = Infinity;
    this.throwDuration = 1.45;
    this.nextThrow = 7.5;
    this.start = new Vector3();
    this.end = new Vector3();
    this.activeJunk = null;
    this.gentrificationAge = -1;
    this.gentrificationDuration = 3.2;
    this.acKickAge = -1;

    this.group = new Group();
    this.group.name = 'roof-throwback-ambience';
    root.add(this.group);

    this.junkMaterial = new MeshStandardMaterial({
      color: 0x85745f,
      roughness: 0.88,
      metalness: 0.04,
    });

    this.throwables = {
      box: new Mesh(new BoxGeometry(0.38, 0.32, 0.42), this.junkMaterial),
      lumber: new Mesh(new BoxGeometry(0.13, 0.13, 1.15), this.junkMaterial),
      chair: new Group(),
    };
    const chairSeat = new Mesh(new BoxGeometry(0.55, 0.08, 0.55), this.junkMaterial);
    const chairBack = new Mesh(new BoxGeometry(0.55, 0.65, 0.08), this.junkMaterial);
    chairBack.position.set(0, 0.33, 0.24);
    this.throwables.chair.add(chairSeat, chairBack);
    for (const [kind, object] of Object.entries(this.throwables)) {
      object.name = `roof-${kind}-in-flight`;
      object.visible = false;
      object.traverse?.((child) => {
        if (child.isMesh) child.castShadow = true;
      });
      this.group.add(object);
    }

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
      this.smoke.push({
        puff,
        material,
        smoker,
        phase: phase * Math.PI * 2,
        speed: 0.18 + seeded(i, 92) * 0.18,
      });
    }
  }

  sceneObject(name) {
    return this.root.parent?.getObjectByName?.(name) ?? null;
  }

  beginThrow({ source = null, kind = 'box', player = false } = {}) {
    const sources = this.config.throwSources ?? [[0, 1.1, 2.8]];
    const target = this.config.dumpster ?? [1.4, -2.8, 7.0];
    const selected = source ?? sources[this.throwCount % sources.length];
    this.start.fromArray(selected);
    this.end.fromArray(target);
    this.throwAge = 0;
    this.throwCount += 1;

    for (const object of Object.values(this.throwables)) object.visible = false;
    this.activeJunk = this.throwables[kind] ?? this.throwables.box;
    this.activeJunk.visible = true;
    this.activeJunk.position.copy(this.start);
    this.activeJunk.rotation.set(0, 0, 0);
    this.junkMaterial.color.setHex(
      kind === 'lumber' ? 0xa17d53 : kind === 'chair' ? 0x5f676f : 0x85745f,
    );
    this.nextThrow = player ? 13 : 9 + seeded(this.throwCount, 77) * 8;
  }

  throwInteractive(kind, source) {
    this.beginThrow({ kind, source, player: true });
  }

  kickAc() {
    this.acKickAge = 0;
  }

  syncGentrification(done) {
    if (this.gentrificationAge >= 0) return;
    const oldSkyline = this.sceneObject('roof-skyline-old');
    const newSkyline = this.sceneObject('roof-skyline-gentrified');
    if (done) {
      setVisible(oldSkyline, false);
      setVisible(newSkyline, true);
      if (newSkyline) {
        newSkyline.position.y = 0;
        newSkyline.rotation.z = 0;
      }
    } else {
      setVisible(oldSkyline, true);
      setVisible(newSkyline, false);
    }
  }

  startGentrification() {
    const oldSkyline = this.sceneObject('roof-skyline-old');
    const newSkyline = this.sceneObject('roof-skyline-gentrified');
    if (!oldSkyline || !newSkyline) return false;
    this.gentrificationAge = 0;
    oldSkyline.visible = true;
    oldSkyline.position.y = 0;
    oldSkyline.rotation.z = 0;
    newSkyline.visible = true;
    newSkyline.position.y = -8;
    return true;
  }

  update(dt) {
    this.elapsed += dt;
    this.nextThrow -= dt;
    if (this.nextThrow <= 0 && !this.activeJunk?.visible) this.beginThrow();

    if (this.activeJunk?.visible) {
      this.throwAge += dt;
      const t = Math.min(1, this.throwAge / this.throwDuration);
      this.activeJunk.position.lerpVectors(this.start, this.end, t);
      this.activeJunk.position.y += Math.sin(Math.PI * t) * 2.25;
      this.activeJunk.rotation.x += dt * 5.4;
      this.activeJunk.rotation.z += dt * 3.8;
      if (t >= 1) {
        this.activeJunk.visible = false;
        this.activeJunk = null;
      }
    }

    if (this.acKickAge >= 0) {
      this.acKickAge += dt;
      const ac = this.sceneObject('roof-ac-unit');
      if (ac) {
        ac.rotation.z = Math.sin(this.acKickAge * 38) * Math.max(0, 0.055 - this.acKickAge * 0.04);
        ac.position.x += Math.sin(this.acKickAge * 31) * 0.002;
      }
      if (this.acKickAge > 1.3) {
        if (ac) ac.rotation.z = 0;
        this.acKickAge = -1;
      }
    }

    if (this.gentrificationAge >= 0) {
      this.gentrificationAge += dt;
      const t = Math.min(1, this.gentrificationAge / this.gentrificationDuration);
      const oldSkyline = this.sceneObject('roof-skyline-old');
      const newSkyline = this.sceneObject('roof-skyline-gentrified');
      if (oldSkyline) {
        oldSkyline.rotation.z = t * 0.72;
        oldSkyline.position.y = -t * 7;
      }
      if (newSkyline) newSkyline.position.y = -8 + t * 8;
      if (t >= 1) {
        setVisible(oldSkyline, false);
        if (newSkyline) newSkyline.position.y = 0;
        this.gentrificationAge = -1;
      }
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
    return {
      throws: this.throwCount,
      nextThrow: Math.max(0, this.nextThrow),
      gentrifying: this.gentrificationAge >= 0,
    };
  }

  dispose() {
    this.group.removeFromParent();
    for (const object of Object.values(this.throwables)) {
      object.traverse?.((child) => {
        if (child.isMesh) child.geometry?.dispose?.();
      });
    }
    this.junkMaterial.dispose();
    this.smokeGeometry.dispose();
    for (const smoke of this.smoke) smoke.material.dispose();
    this.smoke = [];
  }
}
