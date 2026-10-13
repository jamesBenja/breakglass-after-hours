import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.js';

function param() {
  return {
    value: 0,
    setValueAtTime(value) {
      this.value = value;
    },
    exponentialRampToValueAtTime(value) {
      this.value = value;
    },
    cancelScheduledValues() {},
  };
}

function node() {
  return {
    gain: param(),
    frequency: param(),
    connect() {},
    disconnect() {},
  };
}

test('AudioEngine starts and stops a named continuous hum cleanly', async () => {
  const oscillators = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: node,
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', Q: param() }),
    createOscillator() {
      const osc = {
        ...node(),
        type: 'sine',
        started: false,
        stopped: false,
        onended: null,
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      oscillators.push(osc);
      return osc;
    },
    async close() {
      this.state = 'closed';
    },
  };

  const audio = new AudioEngine({ contextFactory: () => context });
  await audio.init();

  assert.equal(
    audio.startContinuousHum('freight-elevator', {
      frequency: 118,
      volume: 0.024,
      type: 'triangle',
    }),
    true,
  );
  assert.equal(audio.continuousHums.has('freight-elevator'), true);
  assert.equal(oscillators.length, 2);
  assert.equal(oscillators[0].started, true);
  assert.equal(oscillators[0].frequency.value, 118);
  assert.equal(oscillators[1].frequency.value, 118 * 2.01);

  assert.equal(audio.stopContinuousHum('freight-elevator'), true);
  assert.equal(audio.continuousHums.has('freight-elevator'), false);
  assert.ok(oscillators.every((osc) => osc.stopped));

  await audio.dispose();
});
