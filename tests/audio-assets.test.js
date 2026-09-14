import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { AudioEngine } from '../src/audio/AudioEngine.js';
import { AssetLoader } from '../src/assets/AssetLoader.js';
import { disposeObject } from '../src/scenes/disposeObject.js';
import { createLevel } from '../src/scenes/createLevel.js';
import { levels } from '../src/world/levels.js';

function audioHarness(assets) {
  const timers = new Map();
  let nextTimer = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const sources = [];
  const node = () => ({
    gain: param(),
    frequency: param(),
    connect() {},
    disconnect() {
      this.disconnected = true;
    },
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
    },
  });
  const source = () => {
    const value = node();
    sources.push(value);
    return value;
  };
  const context = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createGain: node,
    createOscillator: source,
    createBufferSource: source,
    createBiquadFilter: node,
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    async resume() {
      this.state = 'running';
    },
    async suspend() {
      this.state = 'suspended';
    },
    async close() {
      this.state = 'closed';
    },
  };
  let contextsCreated = 0;
  const engine = new AudioEngine({
    assets,
    contextFactory: () => {
      contextsCreated++;
      return context;
    },
    timers: {
      setInterval(fn) {
        timers.set(++nextTimer, fn);
        return nextTimer;
      },
      clearInterval(id) {
        timers.delete(id);
      },
    },
  });
  return { engine, context, sources, timers, contextsCreated: () => contextsCreated };
}

test('audio starts after activation, keeps one transport/context, and Stop cancels scheduled voices', async () => {
  const h = audioHarness();
  assert.equal(await h.engine.play('night-bus'), false);
  await h.engine.init();
  await h.engine.init();
  assert.equal(h.contextsCreated(), 1);
  for (const id of ['night-bus', 'glass-floor', '3am-tool']) {
    await h.engine.play(id);
    assert.equal(h.engine.trackId, id);
    assert.equal(h.timers.size, 1);
  }
  assert.ok(h.engine.voices.size > 0);
  h.engine.stop();
  assert.equal(h.engine.playing, false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.engine.voices.size, 0);
  assert.ok(h.sources.every((s) => s.stopped && s.disconnected));
  await h.engine.dispose();
  assert.equal(h.context.state, 'closed');
});

test('slow audio downloads cannot restart after Stop or override a later selection', async () => {
  const pending = new Map();
  const h = audioHarness({ audio: (id) => new Promise((resolve) => pending.set(id, resolve)) });
  await h.engine.init();
  const oldSelection = h.engine.play('night-bus');
  const currentSelection = h.engine.play('glass-floor');
  pending.get('glass-floor')({});
  assert.equal(await currentSelection, true);
  pending.get('night-bus')({});
  assert.equal(await oldSelection, false);
  assert.equal(h.engine.trackId, 'glass-floor');
  const stoppedSelection = h.engine.play('3am-tool');
  h.engine.stop();
  pending.get('3am-tool')({});
  assert.equal(await stoppedSelection, false);
  assert.equal(h.engine.playing, false);
  await h.engine.dispose();
});

test('background suspension does not schedule notes and one-shots release their graph', async () => {
  const h = audioHarness();
  await h.engine.init();
  h.engine.hat();
  const shot = h.sources.at(-1);
  shot.onended();
  assert.equal(h.engine.voices.size, 0);
  await h.engine.play('night-bus');
  await h.engine.suspend();
  const count = h.sources.length;
  h.context.currentTime = 100;
  for (const tick of h.timers.values()) tick();
  assert.equal(h.sources.length, count);
  await h.engine.resume();
  for (const tick of h.timers.values()) tick();
  assert.ok(h.sources.length - count < 10, 'no catch-up burst after a delayed timer');
  await h.engine.dispose();
});

test('pending model does not fetch; failed configured asset falls back and can be retried', async () => {
  const warnings = [];
  const loader = new AssetLoader(
    {
      pending: { type: 'model', url: null },
      missing: { type: 'model', url: 'assets/missing.glb' },
    },
    {
      baseUrl: 'https://example.test/game/',
      onWarning: (message) => warnings.push(message),
    },
  );
  let calls = 0;
  loader.gltf = {
    async loadAsync(url) {
      calls++;
      assert.equal(url, 'https://example.test/game/assets/missing.glb');
      throw new Error('404');
    },
  };
  assert.equal(await loader.model('pending'), null);
  assert.equal(calls, 0);
  assert.equal(await loader.model('missing'), null);
  assert.equal(await loader.model('missing'), null);
  assert.equal(calls, 2);
  assert.equal(warnings.length, 2);
  await loader.dispose();
});

test('model instances are separate owned trees with configured transforms', async () => {
  const source = new Group();
  source.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  const loader = new AssetLoader(
    { building: { type: 'model', url: 'building.glb', scale: 2, position: [1, 2, 3] } },
    { baseUrl: 'https://example.test/' },
  );
  let calls = 0;
  loader.gltf = {
    async loadAsync() {
      calls++;
      return { scene: source };
    },
  };
  const a = await loader.model('building');
  const b = await loader.model('building');
  assert.equal(calls, 1);
  assert.notEqual(a, b);
  assert.notEqual(a.children[0].geometry, b.children[0].geometry);
  assert.notEqual(a.children[0].material, source.children[0].material);
  assert.deepEqual(a.position.toArray(), [1, 2, 3]);
  assert.equal(a.scale.x, 2);
  disposeObject(a);
  disposeObject(b);
  await loader.dispose();
});

test('replacement shells keep fixtures and gameplay, furnished models suppress duplicate fixtures', async () => {
  for (const includesFixtures of [false, true]) {
    const model = new Group();
    const assets = {
      manifest: { 'upstairs-building': { includesFixtures } },
      async model() {
        return model;
      },
    };
    const calls = [];
    const level = await createLevel(
      levels.upstairs,
      {
        architecture() {
          calls.push('architecture');
        },
        fixtures() {
          calls.push('fixtures');
        },
      },
      assets,
    );
    assert.equal(level.geometrySource, 'model');
    assert.equal(level.architecture.children[0], model);
    assert.deepEqual(calls, includesFixtures ? [] : ['fixtures']);
    assert.notEqual(level.gameplay, level.architecture);
    assert.ok(level.scene.children.some((child) => child.isPointLight));
    assert.equal(level.collision.surfaceAt(5, -4.5).surface.id, 'live-room');
    level.dispose();
  }
});
