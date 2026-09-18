import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SpectraTransport,
  quantizeSpectraTime,
  spectraLoopSeconds,
} from '../src/studio/SpectraTransport.js';

function fakeClock() {
  const context = { currentTime: 10, state: 'running' };
  let nextTimer = 1;
  const callbacks = new Map();
  return {
    context,
    timers: {
      setInterval(callback) {
        const id = nextTimer++;
        callbacks.set(id, callback);
        return id;
      },
      clearInterval(id) {
        callbacks.delete(id);
      },
    },
    callbacks,
  };
}

function session(overrides = {}) {
  return {
    bpm: 120,
    loopEnabled: true,
    loopBars: 4,
    quantize: '1/16',
    swing: 0.24,
    ...overrides,
  };
}

test('Spectra transport gives every attached instrument the same scheduled step and swing', () => {
  const clock = fakeClock();
  let externalTransportCalls = 0;
  const audio = {
    context: clock.context,
    setExternalTransport: () => {
      externalTransportCalls += 1;
    },
  };
  const transport = new SpectraTransport(audio, session(), clock.timers);
  const drums = [];
  const modular = [];
  transport.subscribe('drums', (event) => drums.push(event));
  transport.subscribe('modular', (event) => modular.push(event));

  transport.acquire('drums', { position: 0 });
  transport.acquire('modular');

  assert.equal(drums.length, 1);
  assert.equal(modular.length, 1);
  assert.equal(drums[0].absoluteStep, 0);
  assert.equal(drums[0].contextTime, modular[0].contextTime);

  clock.context.currentTime = 10.16;
  transport.schedule();

  assert.equal(drums[1].absoluteStep, 1);
  assert.equal(drums[1].contextTime, modular[1].contextTime);
  assert.ok(Math.abs(drums[1].swingDelay - 0.03) < 1e-9);
  assert.equal(externalTransportCalls, 0, 'musical clock must not register in game audio metrics');
});

test('Spectra transport remains alive until the final instrument owner releases it', () => {
  const clock = fakeClock();
  const transport = new SpectraTransport({ context: clock.context }, session(), clock.timers);

  transport.acquire('drum-machine');
  transport.acquire('modular-synth');
  assert.equal(transport.running, true);

  transport.release('drum-machine');
  assert.equal(transport.running, true);

  transport.release('modular-synth');
  assert.equal(transport.running, false);
});

test('Spectra quantization places live events on the shared swung loop grid', () => {
  const active = session();
  assert.equal(spectraLoopSeconds(active), 8);
  assert.ok(Math.abs(quantizeSpectraTime(active, 0.14) - 0.155) < 1e-9);
  assert.equal(quantizeSpectraTime(active, 0.02), 0);
  assert.ok(Math.abs(quantizeSpectraTime(active, 8.14) - 0.155) < 1e-9);
});

test('tempo changes preserve the musical step instead of restarting independent clocks', () => {
  const clock = fakeClock();
  const active = session({ swing: 0 });
  const transport = new SpectraTransport({ context: clock.context }, active, clock.timers);
  transport.acquire('drum-machine', { position: 0 });

  clock.context.currentTime = 10.54;
  const before = transport.position() / transport.stepDuration;
  transport.setTempo(100);
  const after = transport.position() / transport.stepDuration;

  assert.ok(Math.abs(before - after) < 0.05);
  assert.equal(active.bpm, 100);
  assert.equal(transport.running, true);
});
