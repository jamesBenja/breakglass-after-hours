import {
  AdditiveBlending,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
} from 'three';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const PRESETS = {
  work: { intensity: 0.45, pulse: 0.08, strobe: 0 },
  warmup: { intensity: 0.72, pulse: 0.18, strobe: 0 },
  party: { intensity: 1.05, pulse: 0.62, strobe: 0.08 },
  peak: { intensity: 1.28, pulse: 1.0, strobe: 0.5 },
  blackout: { intensity: 0.05, pulse: 0, strobe: 0 },
};

/**
 * Lightweight, scene-local party lighting controller.
 *
 * It intentionally keeps lighting state separate from geometry and audio so a future
 * multiplayer room can synchronize only a small JSON-friendly lighting snapshot.
 */
export class LightingRig {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.config = config;
    this.elapsed = 0;
    this.preset = 'warmup';
    this.haze = 0;
    this.lasersEnabled = false;
    this.lastMetrics = {
      energy: 0,
      bass: 0,
      beat: 0,
      vibe: 0,
      mixQuality: 0,
      playing: false,
    };
    this.group = new Group();
    this.group.name = 'party-lighting';
    scene.add(this.group);

    this.baseFog = scene.fog
      ? { near: scene.fog.near, far: scene.fog.far }
      : { near: 18, far: 58 };
    this.hazeFar = config.hazeFar ?? Math.max(11, this.baseFog.far * 0.24);

    this.fixtures = (config.fixtures ?? []).map((fixture, index) => {
      const light = new PointLight(
        fixture.color,
        fixture.intensity ?? 4,
        fixture.distance ?? 16,
        fixture.decay ?? 2,
      );
      light.name = fixture.name ?? `party-light:${index}`;
      light.position.fromArray(fixture.position);
      this.group.add(light);
      return {
        light,
        baseIntensity: fixture.intensity ?? 4,
        phase: fixture.phase ?? index * 1.7,
      };
    });

    this.strobe = null;
    if (config.strobe) {
      this.strobe = new PointLight(
        config.strobe.color ?? 0xffffff,
        0,
        config.strobe.distance ?? 14,
        2,
      );
      this.strobe.name = 'party-strobe';
      this.strobe.position.fromArray(config.strobe.position);
      this.strobe.userData.maxIntensity = config.strobe.intensity ?? 9;
      this.group.add(this.strobe);
    }

    this.laserPivots = [];
    const laser = config.laser;
    if (laser) {
      const count = laser.count ?? 4;
      for (let i = 0; i < count; i++) {
        const pivot = new Group();
        pivot.name = `laser:${i}`;
        pivot.position.fromArray(laser.position);
        pivot.rotation.y = (i / count) * Math.PI * 2;

        const arm = new Group();
        arm.rotation.z = (laser.tilt ?? 0.72) * (i % 2 ? 1 : -1);
        const length = laser.length ?? 9;
        const material = new MeshBasicMaterial({
          color: laser.color ?? 0x53ffd8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: AdditiveBlending,
        });
        const beam = new Mesh(new CylinderGeometry(0.012, 0.055, length, 6, 1, true), material);
        beam.position.y = -length / 2;
        arm.add(beam);
        pivot.add(arm);
        this.group.add(pivot);
        this.laserPivots.push({ pivot, beam, material, phase: i * 1.3 });
      }
    }

    this.applyPreset(config.preset ?? 'warmup');
    this.setHaze(config.haze ?? 0.22);
    this.setLasers(config.lasers ?? false);
  }

  applyPreset(name) {
    if (!PRESETS[name]) return false;
    this.preset = name;
    return true;
  }

  setHaze(value) {
    this.haze = clamp(value);
    if (!this.scene.fog) return;
    // The old haze control only shortened the fog a little. This deliberately makes the
    // top half of the range dramatic enough to read like a hazed club: beams appear solid,
    // distant walls disappear and lighting gains depth.
    const shaped = Math.pow(this.haze, 0.72);
    this.scene.fog.near = Math.max(1.2, this.baseFog.near * (1 - shaped * 0.82));
    this.scene.fog.far = Math.max(
      this.scene.fog.near + 5.5,
      this.baseFog.far + (this.hazeFar - this.baseFog.far) * shaped,
    );
  }

  adjustHaze(delta) {
    this.setHaze(this.haze + delta);
  }

  setLasers(enabled) {
    this.lasersEnabled = !!enabled;
    for (const laser of this.laserPivots) {
      laser.beam.visible = this.lasersEnabled;
      laser.material.opacity = this.lasersEnabled ? 0.18 + this.haze * 0.28 : 0;
    }
  }

  toggleLasers() {
    this.setLasers(!this.lasersEnabled);
  }

  update(dt, metrics = {}) {
    this.elapsed += dt;
    const energy = clamp(metrics.energy ?? (metrics.playing ? 0.5 : 0));
    const bass = clamp(metrics.bass ?? energy);
    const beat = clamp(metrics.beat ?? 0);
    const vibe = clamp(metrics.vibe ?? energy);
    const mixQuality = clamp(metrics.mixQuality ?? (metrics.playing ? 0.72 : 0));
    this.lastMetrics = {
      energy,
      bass,
      beat,
      vibe,
      mixQuality,
      playing: !!metrics.playing,
    };
    const preset = PRESETS[this.preset] ?? PRESETS.warmup;

    for (const fixture of this.fixtures) {
      const drift = 0.5 + 0.5 * Math.sin(this.elapsed * 0.7 + fixture.phase);
      const musicPulse =
        preset.pulse * (energy * 0.24 + bass * 0.18 + beat * 0.62 + vibe * 0.42);
      const skillLift = metrics.playing ? 0.05 + vibe * 0.12 + mixQuality * 0.08 : 0;
      fixture.light.intensity =
        fixture.baseIntensity *
        preset.intensity *
        (0.62 + skillLift + musicPulse + drift * 0.08);
    }

    if (this.strobe) {
      const active = metrics.playing && beat > 0.62 && vibe > 0.42;
      this.strobe.intensity = active
        ? this.strobe.userData.maxIntensity * preset.strobe * beat * (0.65 + mixQuality * 0.5)
        : 0;
    }

    const sweepSpeed = this.config.laser?.sweepSpeed ?? 0.55;
    const hazeBeam = 0.08 + this.haze * 0.4;
    for (const laser of this.laserPivots) {
      laser.pivot.rotation.y =
        this.elapsed * sweepSpeed * (0.85 + vibe * 0.4) + laser.phase + bass * 0.28;
      if (this.lasersEnabled) {
        laser.material.opacity = Math.min(
          0.85,
          hazeBeam + preset.intensity * 0.07 + energy * 0.08 + vibe * 0.12 + beat * 0.18,
        );
      }
    }
  }

  snapshot() {
    return {
      preset: this.preset,
      haze: this.haze,
      lasers: this.lasersEnabled,
      fogNear: this.scene.fog?.near ?? null,
      fogFar: this.scene.fog?.far ?? null,
      ...this.lastMetrics,
    };
  }

  dispose() {
    this.group.removeFromParent();
    for (const laser of this.laserPivots) {
      laser.beam.geometry.dispose();
      laser.material.dispose();
    }
    this.laserPivots = [];
    this.fixtures = [];
    this.strobe = null;
  }
}
