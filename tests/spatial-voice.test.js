import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialVoiceGain, voiceOccluded } from '../src/multiplayer/SpatialVoice.js';

test('spatial voice is full for a nearby conversation group', () => {
  assert.equal(spatialVoiceGain({ sameScene: true, distance: 1.5 }), 1);
  assert.equal(spatialVoiceGain({ sameScene: true, distance: 2.5 }), 1);
});

test('spatial voice fades with distance and mutes across the building', () => {
  const mid = spatialVoiceGain({ sameScene: true, distance: 5 });
  const far = spatialVoiceGain({ sameScene: true, distance: 7.5 });
  assert.ok(mid < 1 && mid > 0.2);
  assert.ok(far < 0.2 && far > 0);
  assert.equal(spatialVoiceGain({ sameScene: true, distance: 10 }), 0);
  assert.equal(spatialVoiceGain({ sameScene: false, distance: 1 }), 0);
});

test('structural walls strongly muffle nearby voices without treating furniture as walls', () => {
  const wallLevel = {
    collision: { cameraCast: () => ({ fraction: 0.4, target: 'outside-3' }) },
  };
  const furnitureLevel = {
    collision: { cameraCast: () => ({ fraction: 0.4, target: 'spectra-console' }) },
  };
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 2, y: 0, z: 0 };
  assert.equal(voiceOccluded(wallLevel, a, b), true);
  assert.equal(voiceOccluded(furnitureLevel, a, b), false);
  assert.ok(spatialVoiceGain({ sameScene: true, distance: 2, occluded: true }) < 0.1);
});
