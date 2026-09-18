import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRUM_MACHINE_KITS,
  createDrumMachinePerformance,
  normalizeDrumMachineState,
} from '../src/gameplay/DrumMachineSystem.js';

test('Spectra drum machine keeps four independent 16-step pattern memories', () => {
  const state = normalizeDrumMachineState();
  assert.equal(state.kit, '808');
  assert.equal(state.selectedPattern, 'A');
  assert.deepEqual(Object.keys(state.patterns), ['A', 'B', 'C', 'D']);

  for (const pattern of Object.values(state.patterns)) {
    for (const lane of Object.values(pattern)) assert.equal(lane.length, 16);
  }

  state.patterns.A.kick[1] = 2;
  const restored = normalizeDrumMachineState(state);
  assert.equal(restored.patterns.A.kick[1], 2);
  assert.notEqual(restored.patterns.B.kick[1], 2);
});

test('every drum-machine model creates style-specific Spectra drum events', () => {
  for (const kit of DRUM_MACHINE_KITS) {
    const state = normalizeDrumMachineState({ kit, selectedPattern: 'A' });
    state.patterns.A.kick = Array(16).fill(0);
    state.patterns.A.kick[0] = 2;
    const performance = createDrumMachinePerformance(state, 120, 2, 0.24);
    assert.equal(performance.mode, 'drums');
    assert.equal(performance.bpm, 120);
    assert.equal(performance.duration, 4);
    assert.equal(performance.events.length, 2);
    assert.equal(performance.events[0].drum, `${kit.toLowerCase()}-kick-accent`);
    assert.equal(performance.events[1].drum, `${kit.toLowerCase()}-kick-accent`);
  }
});

test('drum-machine swing delays offbeat sixteenth notes without moving downbeats', () => {
  const state = normalizeDrumMachineState({ kit: '909', selectedPattern: 'A' });
  for (const lane of Object.values(state.patterns.A)) lane.fill(0);
  state.patterns.A['closed-hat'][0] = 1;
  state.patterns.A['closed-hat'][1] = 1;

  const straight = createDrumMachinePerformance(state, 120, 1, 0);
  const swung = createDrumMachinePerformance(state, 120, 1, 0.24);
  assert.equal(straight.events[0].time, 0);
  assert.equal(swung.events[0].time, 0);
  assert.equal(straight.events[1].time, 0.125);
  assert.ok(Math.abs(swung.events[1].time - 0.155) < 1e-9);
});
