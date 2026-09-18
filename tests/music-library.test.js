import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_AMBIENT_INGEST,
  APPROVED_DJ_INGEST,
  APPROVED_EDIT_INGEST,
  APPROVED_LONGFORM_SOURCES,
  APPROVED_STUDIO_SOURCES,
  NPC_DJ_PROGRAMS,
  RUNTIME_DJ_LIBRARY,
} from '../src/audio/musicLibrary.js';
import { DJ_TRACKS } from '../src/dj/DjMixer.js';
import { HouseDjSystem } from '../src/gameplay/HouseDjSystem.js';
import {
  PENDING_STUDIO_SESSION_SOURCES,
  STUDIO_SESSION_TEMPLATES,
} from '../src/studio/sessionCatalog.js';

test('completed review is represented by explicit approved ingest queues', () => {
  assert.equal(APPROVED_DJ_INGEST.length, 19);
  assert.equal(APPROVED_EDIT_INGEST.length, 12);
  assert.equal(APPROVED_AMBIENT_INGEST.length, 11);
  assert.equal(APPROVED_STUDIO_SOURCES.length, 14);
  assert.equal(APPROVED_LONGFORM_SOURCES.length, 11);
  assert.ok(APPROVED_DJ_INGEST.some((track) => track.id === 'rotations-fences'));
  assert.ok(APPROVED_EDIT_INGEST.some((track) => track.id === 'dang-jungle-edit'));
  assert.ok(APPROVED_LONGFORM_SOURCES.some((set) => set.id === 'james-systeme-2023'));
});

test('excluded Dance Shoes session is not selectable while approved stem sources remain queued', () => {
  assert.equal(
    STUDIO_SESSION_TEMPLATES.some((session) => session.id === 'dance-shoes'),
    false,
  );
  assert.notEqual(PENDING_STUDIO_SESSION_SOURCES, APPROVED_STUDIO_SOURCES);
  assert.ok(PENDING_STUDIO_SESSION_SOURCES.some((source) => source.id === 'atrakar-full-stems'));
  assert.ok(PENDING_STUDIO_SESSION_SOURCES.some((source) => source.id === 'planet-pillow-stems'));
  assert.equal(
    PENDING_STUDIO_SESSION_SOURCES.some((source) => source.id === 'gairage-stems'),
    false,
  );
  assert.equal(
    PENDING_STUDIO_SESSION_SOURCES.some((source) => source.id === 'in-an-instant-stems'),
    false,
  );
  assert.ok(STUDIO_SESSION_TEMPLATES.some((session) => session.id === 'gairage-multitrack'));
  assert.ok(STUDIO_SESSION_TEMPLATES.some((session) => session.id === 'in-an-instant-multitrack'));
});

test('James house-DJ fallback is a multi-track programme, not a one-song loop', () => {
  const programme = NPC_DJ_PROGRAMS['james-benjamin'];
  assert.ok(programme.fallback.length >= 5);
  assert.equal(programme.fallback[0].id, 'got-you-dancin');
  assert.ok(programme.preferredLongformIds.includes('james-nts-club-aerobics-2025'));
});

test('James NPC programme advances outside Below when a track naturally ends', async () => {
  const calls = [];
  const audio = {
    context: {},
    playing: false,
    activeExternalTransport: null,
    assets: { entry: () => null },
    async playAsset(id, options) {
      calls.push({ id, options });
      this.playing = true;
      this.activeExternalTransport = { owner: options.owner, label: options.label };
      return true;
    },
    stop() {
      this.playing = false;
      this.activeExternalTransport = null;
    },
    stopAsset() {
      this.playing = false;
      this.activeExternalTransport = null;
    },
  };
  const game = {
    state: { data: { houseDjId: 'james-benjamin' } },
    started: true,
    audio,
    dj: {
      metrics: () => ({ playing: false }),
      stop() {},
    },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    scenes: { get: () => null },
    evacuationStarted: false,
    save() {},
  };
  const system = new HouseDjSystem(game, { panel() {} });

  await system.start();
  assert.equal(calls[0].id, 'got-you-dancin');
  assert.equal(calls[0].options.loop, false);
  assert.equal(system.programRunning, true);

  // Simulate the first song ending while the player is upstairs. The set must continue even
  // though HouseDjSystem is no longer in the downstairs scene.
  audio.playing = false;
  audio.activeExternalTransport = null;
  system.update(0.1);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 2);
  assert.equal(calls[1].id, 'in-flux-just-be');
  assert.equal(system.programIndex, 1);
  assert.equal(system.programRunning, true);
});

test('house DJ uses the same spatial club zones as the player DJ', async () => {
  const { acousticEnvironmentFor } = await import('../src/audio/AcousticZones.js');
  const playerDj = acousticEnvironmentFor('dj', 'downstairs', 'lounge');
  const houseDj = acousticEnvironmentFor('house-dj', 'downstairs', 'lounge');
  assert.deepEqual(houseDj, playerDj);
  assert.ok(houseDj.gain <= 0.05);
  assert.ok(houseDj.lowpassHz <= 800);
});

test('James house DJ continues while an unrelated upstairs source is active', async () => {
  const calls = [];
  const audio = {
    context: {},
    activeExternalTransport: { owner: 'archive', label: 'Neve tape' },
    assets: { entry: () => null },
    async playAsset(id, options) {
      calls.push({ id, options });
      this.activeExternalTransport = { owner: options.owner, label: options.label };
      return true;
    },
    stopAsset(owner) {
      if (this.activeExternalTransport?.owner === owner) this.activeExternalTransport = null;
    },
  };
  Object.defineProperty(audio, 'playing', {
    get() {
      return this.activeExternalTransport !== null;
    },
  });
  const game = {
    state: { data: { houseDjId: 'james-benjamin' } },
    started: true,
    audio,
    dj: { metrics: () => ({ playing: false }), stop() {} },
    sceneManager: { current: { definition: { id: 'upstairs' } } },
    scenes: { get: () => null },
    evacuationStarted: false,
    save() {},
  };
  const system = new HouseDjSystem(game, { panel() {} });

  await system.start();
  assert.equal(calls[0].id, 'got-you-dancin');
  system.programRunning = true;
  audio.activeExternalTransport = { owner: 'archive', label: 'Neve tape' };
  system.update(0.1);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 2);
  assert.equal(calls[1].id, 'in-flux-just-be');
});

test('runtime DJ catalogue exposes the newly ingested James and Boogieman masters', () => {
  for (const id of ['team-break', 'gairage', 'drop-in', 'rotations-fences']) {
    assert.ok(RUNTIME_DJ_LIBRARY.some((track) => track.id === id));
    assert.ok(DJ_TRACKS.some((track) => track.id === id && track.real));
  }
  assert.ok(APPROVED_DJ_INGEST.every((track) => track.runtimeReady));
  assert.ok(APPROVED_AMBIENT_INGEST.every((track) => track.runtimeReady));
});

test('James house-DJ fallback expands beyond the original five-track loop', () => {
  const programme = NPC_DJ_PROGRAMS['james-benjamin'];
  assert.ok(programme.fallback.length >= 20);
  assert.ok(programme.fallback.some((track) => track.id === 'rotations-the-roll'));
  assert.ok(programme.fallback.some((track) => track.id === 'guestlist-andy-s'));
});
