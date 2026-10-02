import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialAudioSystem } from '../src/audio/SpatialAudioSystem.js';

function param(value = 0) {
  return {
    value,
    setTargetAtTime(next) {
      this.value = next;
    },
    setValueAtTime(next) {
      this.value = next;
    },
    exponentialRampToValueAtTime(next) {
      this.value = next;
    },
    cancelScheduledValues() {},
  };
}

function node() {
  return {
    gain: param(),
    frequency: param(),
    detune: param(),
    connect() {},
    disconnect() {},
  };
}

function oscillator() {
  return {
    ...node(),
    type: 'sine',
    started: false,
    stopped: false,
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
      this.onended?.();
    },
    onended: null,
  };
}

test('spatial point machine uses an HRTF panner at the supplied world position', () => {
  const oscillators = [];
  const panners = [];
  const context = {
    currentTime: 0,
    createGain: node,
    createOscillator() {
      const osc = oscillator();
      oscillators.push(osc);
      return osc;
    },
    createPanner() {
      const panner = {
        ...node(),
        positionX: param(),
        positionY: param(),
        positionZ: param(),
        panningModel: '',
        distanceModel: '',
        refDistance: 0,
        maxDistance: 0,
        rolloffFactor: 0,
      };
      panners.push(panner);
      return panner;
    },
  };
  const audio = {
    context,
    master: node(),
    timers: { setTimeout: (fn) => fn() },
  };
  const spatial = new SpatialAudioSystem(audio);

  assert.equal(
    spatial.setPointMachine('roof-ac', {
      position: [5.35, 0.72, -2.55],
      baseFrequency: 91,
      secondaryFrequency: 143,
      volume: 0.027,
      pulseRate: 7.8,
      pulseDepth: 0.0065,
    }),
    true,
  );

  const machine = spatial.pointMachines.get('roof-ac');
  assert.ok(machine);
  assert.equal(oscillators.length, 3);
  assert.equal(machine.base.frequency.value, 91);
  assert.equal(machine.secondary.frequency.value, 143);
  assert.equal(machine.lfo.frequency.value, 7.8);
  assert.equal(machine.panner.panningModel, 'HRTF');
  assert.equal(machine.panner.distanceModel, 'inverse');
  assert.equal(machine.panner.positionX.value, 5.35);
  assert.equal(machine.panner.positionY.value, 0.72);
  assert.equal(machine.panner.positionZ.value, -2.55);

  spatial.stopPointMachine('roof-ac', 0);
  assert.equal(spatial.pointMachines.has('roof-ac'), false);
  assert.ok(oscillators.every((source) => source.stopped));
});

test('spatial point tone creates a localized one-shot and cleans it up', () => {
  const panners = [];
  const sources = [];
  const context = {
    currentTime: 2,
    createGain: node,
    createOscillator() {
      const osc = oscillator();
      const originalStop = osc.stop.bind(osc);
      osc.stop = () => {
        originalStop();
      };
      sources.push(osc);
      return osc;
    },
    createPanner() {
      const panner = {
        ...node(),
        positionX: param(),
        positionY: param(),
        positionZ: param(),
        panningModel: '',
        distanceModel: '',
      };
      panners.push(panner);
      return panner;
    },
  };
  const audio = { context, master: node() };
  const spatial = new SpatialAudioSystem(audio);

  assert.equal(
    spatial.pointTone([5.35, 0.72, -2.55], {
      frequency: 74,
      endFrequency: 48,
      duration: 0.16,
      volume: 0.13,
      wave: 'square',
    }),
    true,
  );
  assert.equal(panners[0].panningModel, 'HRTF');
  assert.equal(panners[0].positionX.value, 5.35);
  assert.equal(sources[0].started, true);
  assert.equal(sources[0].stopped, true);
  assert.equal(spatial.pointShots.size, 0);
});
