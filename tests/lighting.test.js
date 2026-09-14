import test from 'node:test';
import assert from 'node:assert/strict';
import { Fog, Scene } from 'three';
import { LightingRig } from '../src/lighting/LightingRig.js';

const config = {
  preset: 'warmup',
  haze: 0.2,
  hazeFar: 24,
  fixtures: [{ color: 0xff0000, intensity: 4, distance: 12, position: [0, 2, 0] }],
  strobe: { position: [0, 3, 0], intensity: 10, distance: 12 },
  laser: { position: [0, 2.5, 0], count: 2, length: 5 },
};

test('lighting rig exposes serializable controls and clamps haze', () => {
  const scene = new Scene();
  scene.fog = new Fog(0x000000, 18, 58);
  const rig = new LightingRig(scene, config);
  assert.equal(rig.snapshot().preset, 'warmup');
  assert.equal(rig.snapshot().lasers, false);
  assert.ok(scene.fog.far < 58);

  rig.applyPreset('peak');
  rig.adjustHaze(10);
  rig.toggleLasers();
  const state = rig.snapshot();
  assert.equal(state.preset, 'peak');
  assert.equal(state.haze, 1);
  assert.equal(state.lasers, true);
  assert.ok(rig.laserPivots.every((laser) => laser.beam.visible));

  rig.adjustHaze(-10);
  assert.equal(rig.haze, 0);
  assert.equal(scene.fog.far, 58);
  rig.dispose();
  assert.equal(scene.getObjectByName('party-lighting'), undefined);
});

test('audio metrics modulate fixture, strobe and laser output', () => {
  const scene = new Scene();
  scene.fog = new Fog(0x000000, 18, 58);
  const rig = new LightingRig(scene, config);
  rig.applyPreset('peak');
  rig.setLasers(true);
  rig.update(1 / 60, { playing: true, energy: 0.9, bass: 0.8, beat: 1 });
  assert.ok(rig.fixtures[0].light.intensity > 0);
  assert.ok(rig.strobe.intensity > 0);
  assert.ok(rig.laserPivots[0].material.opacity > 0.2);

  rig.update(1 / 60, { playing: false, energy: 0, bass: 0, beat: 0 });
  assert.equal(rig.strobe.intensity, 0);
  rig.dispose();
});
