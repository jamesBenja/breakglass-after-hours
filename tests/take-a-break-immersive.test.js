import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';
import {
  TAKE_A_BREAK_SPEAKERS,
  TakeABreakImmersiveSystem,
  isTakeABreakPosition,
} from '../src/gameplay/TakeABreakImmersiveSystem.js';

test('Take A Break installation uses exactly eight virtual speaker positions', () => {
  assert.equal(TAKE_A_BREAK_SPEAKERS.length, 8);
  assert.ok(TAKE_A_BREAK_SPEAKERS.every((position) => position.length === 3));
  assert.equal(new Set(TAKE_A_BREAK_SPEAKERS.map((position) => position.join(','))).size, 8);

  const spatial = new SpatialAudioSystem({
    activeExternalTransport: { owner: 'dj' },
    environment: {},
  });
  assert.equal(spatial.snapshot().emitters, 8);
});

test('Take A Break bounds identify the immersive listening room', () => {
  assert.equal(isTakeABreakPosition(new Vector3(7.6, 0, 4.4)), true);
  assert.equal(isTakeABreakPosition(new Vector3(0, 0, 0)), false);
  assert.equal(isTakeABreakPosition(new Vector3(7.6, 0, -1)), false);
});

test('installation makes club audio quiet filtered bleed inside the room', () => {
  const spatial = new SpatialAudioSystem({
    activeExternalTransport: { owner: 'dj' },
    environment: {},
  });
  const environment = spatial.environmentFor({ definition: { id: 'downstairs' } }, 'lounge');
  assert.ok(environment.gain <= 0.1);
  assert.ok(environment.lowpassHz <= 1000);
  assert.match(environment.label, /immersive installation/i);
});

test('cosmic breach remains a moving visual system without a second audio engine', () => {
  const root = new Group();
  const system = new TakeABreakImmersiveSystem(root);
  system.update(1 / 60);
  assert.equal(system.snapshot().speakers, 8);
  assert.ok(system.snapshot().cosmicObjects > 8);
  assert.equal('audioBus' in system, false);
  system.dispose();
});