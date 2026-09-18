import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio/AudioEngine.js';

function param(value = 0) {
  return {
    value,
    setTargetAtTime(next) {
      this.value = next;
    },
  };
}

function node() {
  return {
    gain: param(1),
    frequency: param(20000),
    Q: param(),
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
    disconnect() {},
  };
}

function harness() {
  const sources = [];
  const context = {
    currentTime: 4,
    createGain: node,
    createBiquadFilter: node,
    createBufferSource() {
      const source = {
        buffer: null,
        loop: false,
        connections: [],
        started: null,
        stopped: false,
        connect(target) {
          this.connections.push(target);
        },
        disconnect() {},
        start(...args) {
          this.started = args;
        },
        stop() {
          this.stopped = true;
        },
        onended: null,
      };
      sources.push(source);
      return source;
    },
  };
  const assets = {
    entry: () => ({ type: 'audio' }),
    async audio() {
      return { duration: 12 };
    },
  };
  const engine = new AudioEngine({ assets });
  engine.context = context;
  engine.master = node();
  return { engine, sources };
}

test('archive playback no longer stops or replaces the DJ transport', async () => {
  const { engine, sources } = harness();
  engine.setSourceEnvironment('dj', { gain: 1, lowpassHz: 20000 });
  engine.setSourceEnvironment('archive', { gain: 1, lowpassHz: 20000 });
  engine.setExternalTransport('dj', 'Downstairs DJ', 0.25, { vibe: 0.8 });

  assert.equal(
    await engine.playAsset('archive-tape', {
      owner: 'archive',
      label: 'Tape',
      loop: true,
      offset: 15,
    }),
    true,
  );

  assert.equal(engine.externalTransports.has('dj'), true);
  assert.equal(engine.externalTransports.has('archive'), true);
  assert.equal(engine.activeExternalTransport.owner, 'archive');
  assert.deepEqual(sources[0].started, [0, 3], 'shared tape resumes at its synchronized offset');
});

test('inaudible transport stays synchronized without becoming the local active soundtrack', () => {
  const { engine } = harness();
  engine.setSourceEnvironment('dj', { gain: 1, lowpassHz: 20000 });
  engine.setSourceEnvironment('archive', { gain: 0, lowpassHz: 350 });
  engine.setExternalTransport('dj', 'Downstairs DJ', 0.25, { vibe: 0.8 });
  engine.setExternalTransport('archive', 'Neve tape', 0.25, { vibe: 0.3 });

  assert.equal(engine.activeExternalTransport.owner, 'dj');
  assert.equal(engine.playing, true);

  engine.setSourceEnvironment('dj', { gain: 0, lowpassHz: 350 });
  assert.equal(engine.activeExternalTransport, null);
  assert.equal(engine.playing, false);
});

test('local gameplay priority ducks unrelated transports only on this client', () => {
  const { engine } = harness();
  engine.setSourceEnvironment('dj', { gain: 1, lowpassHz: 20000 });
  engine.setSourceEnvironment('studio', { gain: 0.8, lowpassHz: 12000 });
  engine.setSourceEnvironment('archive', { gain: 0.5, lowpassHz: 4000 });

  engine.setPrioritySource('studio', 0.2);
  assert.equal(engine.sourceGain('studio'), 0.8);
  assert.equal(engine.sourceGain('dj'), 0.2);
  assert.equal(engine.sourceGain('archive'), 0.1);

  engine.setPrioritySource(null);
  assert.equal(engine.sourceGain('dj'), 1);
  assert.equal(engine.sourceGain('archive'), 0.5);
});
