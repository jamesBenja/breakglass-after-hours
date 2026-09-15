import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { AlleyCrowdSystem } from '../src/alley/AlleyCrowdSystem.js';
import { doorAccessTier } from '../src/gameplay/crowdDoorEnhancements.js';
import {
  alignedSourcePosition,
  estimateBeatOffset,
} from '../src/gameplay/djSyncEnhancements.js';

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

test('DJ phase sync preserves musical beat phase across different source BPMs', () => {
  const masterPosition = 12.31;
  const slavePosition = 27.4;
  const target = alignedSourcePosition(masterPosition, 130, slavePosition, 118);
  const masterPhase = mod(masterPosition / (60 / 130), 1);
  const slavePhase = mod(target / (60 / 118), 1);
  assert.ok(Math.abs(masterPhase - slavePhase) < 1e-9);
  assert.ok(Math.abs(target - slavePosition) <= 60 / 118 / 2 + 1e-9);
});

test('decoded masters get a musical beat-grid offset instead of assuming time zero is a beat', () => {
  const sampleRate = 48000;
  const seconds = 8;
  const bpm = 120;
  const beat = 60 / bpm;
  const expectedOffset = 0.137;
  const data = new Float32Array(sampleRate * seconds);

  for (let time = expectedOffset; time < seconds; time += beat) {
    const start = Math.round(time * sampleRate);
    const burst = Math.round(sampleRate * 0.08);
    for (let i = 0; i < burst && start + i < data.length; i += 1) {
      const envelope = Math.exp(-i / (sampleRate * 0.022));
      data[start + i] += Math.sin((2 * Math.PI * 82 * i) / sampleRate) * envelope;
    }
  }

  const buffer = {
    sampleRate,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
  const estimated = estimateBeatOffset(buffer, bpm);
  const difference = Math.min(
    Math.abs(estimated - expectedOffset),
    beat - Math.abs(estimated - expectedOffset),
  );
  assert.ok(difference < 0.025, `expected ${expectedOffset}s beat phase, got ${estimated}s`);
});

test('door difficulty lets DJs and promoters straight in while listeners face the guest flow', () => {
  assert.equal(doorAccessTier('dj'), 'direct');
  assert.equal(doorAccessTier('promoter'), 'direct');
  assert.equal(doorAccessTier('producer'), 'working');
  assert.equal(doorAccessTier('photographer'), 'working');
  assert.equal(doorAccessTier('explorer'), 'guest');
  assert.equal(doorAccessTier('dancer'), 'guest');
});

test('alley crowd turns occupancy into visible interactive people', () => {
  const root = new Group();
  const crowd = new AlleyCrowdSystem(root, { max: 52, door: [-3, 0, 0] });
  crowd.update(0.1, {
    occupancy: 27,
    conversationLevel: 0.55,
    rowdyLevel: 0.35,
  });
  assert.equal(crowd.visibleCount, 27);
  const targets = crowd.interactionTargets();
  assert.equal(targets.length, 27);
  assert.equal(targets[0].action, 'alleyGuest');
  assert.equal(targets[0].guestIndex, 0);
  crowd.dispose();
});
