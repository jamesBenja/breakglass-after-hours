import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_DJS,
  HOUSE_DJ_ROTATION_SECONDS,
  HouseDjSystem,
} from '../src/gameplay/HouseDjSystem.js';

test('house DJ roster remains intact through orientation pass', () => {
  assert.ok(HOUSE_DJS.length >= 10);
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'lunice'));
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'kaytranada'));
});



test('house DJ rotation is 20 minutes and advances building-wide', () => {
  assert.equal(HOUSE_DJ_ROTATION_SECONDS, 20 * 60);

  const externalTransports = new Map([['house-dj', { owner: 'house-dj' }]]);
  const game = {
    state: { data: { houseDjId: 'lunice' } },
    audio: {
      context: { state: 'running', currentTime: 0 },
      externalTransports,
    },
    dj: { metrics: () => ({ playing: false }) },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    scenes: new Map(),
    save() {},
  };
  const system = new HouseDjSystem(game, { panel() {} });
  system.rotationTimer = 0.01;

  let selected = null;
  system.select = async (id) => {
    selected = id;
  };

  system.update(0.02);
  assert.equal(selected, 'kaytranada');
});

test('house DJ snapshots and recreates decoded playback after Safari backgrounding', async () => {
  const externalTransports = new Map([['house-dj', { owner: 'house-dj' }]]);
  let stopped = 0;
  const game = {
    started: true,
    state: { data: { houseDjId: 'james-benjamin' } },
    audio: {
      context: { state: 'running' },
      externalTransports,
      nativeMedia: new Map(),
      stopAsset() {},
      clearExternalTransport(owner) {
        externalTransports.delete(owner);
      },
    },
    dj: { metrics: () => ({ playing: false }) },
  };
  const system = new HouseDjSystem(game, { panel() {} });
  system.programIndex = 2;
  system.programTrackDuration = 120;
  system.programStartedAtMs = Date.now() - 15000;
  system.programRunning = true;
  system.programVoices.add({
    source: {
      stop() {
        stopped += 1;
      },
    },
    gain: { disconnect() {} },
  });

  assert.equal(system.prepareForBackground(), true);
  assert.equal(stopped, 1);
  assert.ok(system.backgroundSnapshot);
  assert.equal(system.isHouseAudio(), false);

  let restarted = null;
  system.start = async (options) => {
    restarted = options;
    externalTransports.set('house-dj', { owner: 'house-dj' });
  };

  assert.equal(await system.recoverAfterBackground(), true);
  assert.ok(restarted.offset >= 14.5 && restarted.offset < 16.5);
  assert.equal(system.backgroundSnapshot, null);
  assert.equal(system.isHouseAudio(), true);
});
