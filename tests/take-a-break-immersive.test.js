import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import {
  TAKE_A_BREAK_SPEAKERS,
  TakeABreakImmersiveSystem,
  isTakeABreakPosition,
} from '../src/gameplay/TakeABreakImmersiveSystem.js';

test('Take A Break installation uses eight virtual speaker positions', () => {
  assert.equal(TAKE_A_BREAK_SPEAKERS.length, 8);
  assert.ok(TAKE_A_BREAK_SPEAKERS.every((position) => position.length === 3));
  assert.ok(new Set(TAKE_A_BREAK_SPEAKERS.map((position) => position.join(','))).size === 8);
});

test('Take A Break bounds identify the immersive listening room', () => {
  assert.equal(isTakeABreakPosition(new Vector3(7.6, 0, 4.4)), true);
  assert.equal(isTakeABreakPosition(new Vector3(0, 0, 0)), false);
  assert.equal(isTakeABreakPosition(new Vector3(7.6, 0, -1)), false);
});

test('installation turns club audio into quiet filtered bleed inside the room', () => {
  const root = new Group();
  const system = new TakeABreakImmersiveSystem(root);
  const environments = [];
  const audio = {
    context: null,
    setEnvironment(environment) {
      environments.push(environment);
    },
  };
  system.update(1 / 60, audio, new Vector3(7.4, 0, 4.2));
  assert.equal(environments.length, 1);
  assert.ok(environments[0].gain <= 0.1);
  assert.ok(environments[0].lowpassHz <= 1000);
  assert.match(environments[0].label, /immersive installation/i);
  assert.ok(system.snapshot().cosmicObjects > 8);
  system.dispose();
});
