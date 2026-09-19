import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAvatar, normalizeFaceTexture } from '../src/avatar/profile.js';
import { ENTRY_SCENE_ID, installEntryEnhancements } from '../src/gameplay/entryEnhancements.js';

test('avatar profile keeps only small local data-image face textures', () => {
  const valid = 'data:image/webp;base64,AAAA';
  assert.equal(normalizeFaceTexture(valid), valid);
  assert.equal(normalizeAvatar({ faceTexture: valid }).faceTexture, valid);
  assert.equal(normalizeFaceTexture('https://example.com/face.jpg'), null);
  assert.equal(normalizeFaceTexture(`data:image/png;base64,${'A'.repeat(180001)}`), null);
});

test('normal game boot is forced to the alley start instead of a saved interior position', async () => {
  const starts = [];
  const bouncer = {
    admitted: false,
    reset() {
      this.admitted = false;
    },
    handle() {
      return false;
    },
  };
  const sceneManager = {
    current: { definition: { id: 'upstairs' } },
    start(id, position) {
      starts.push([id, position]);
    },
    request() {},
  };
  const game = {
    crowdDoor: { bouncer },
    sceneManager,
    async initialize() {
      sceneManager.start('upstairs', [4, 0, 3]);
    },
  };
  installEntryEnhancements(game, { panel() {}, warning() {} });
  await game.initialize();
  assert.deepEqual(starts, [[ENTRY_SCENE_ID, null]]);
});

test('direct-entry invitation starts at its authored studio position', async () => {
  const starts = [];
  const sceneManager = {
    current: { definition: { id: 'alley' } },
    start(id, position) {
      starts.push([id, position]);
    },
    request() {},
  };
  const game = {
    invitation: { entry: { sceneId: 'upstairs', position: [4.85, 0, -2.3] } },
    crowdDoor: {
      bouncer: {
        reset() {},
        handle() {
          return false;
        },
      },
    },
    sceneManager,
    async initialize() {
      sceneManager.start('alley', null);
    },
  };
  installEntryEnhancements(game, { panel() {}, warning() {} });
  await game.initialize();
  assert.deepEqual(starts, [['upstairs', [4.85, 0, -2.3]]]);
});

test('Sam performs security clearance and the club door opens only after that', () => {
  const transitions = [];
  const panels = [];
  const bouncer = {
    admitted: false,
    waitUntil: 0,
    reset() {},
    remainingWait() {
      return 0;
    },
    enter() {
      this.admitted = true;
      transitions.push('old-direct-entry');
    },
    handle(target) {
      if (target?.id !== 'bouncer') return false;
      this.enter();
      return true;
    },
  };
  const game = {
    crowdDoor: { bouncer },
    sceneManager: {
      current: { definition: { id: ENTRY_SCENE_ID } },
      request(destination) {
        transitions.push(destination);
      },
      start() {},
    },
    async initialize() {},
  };
  const ui = {
    panel(title) {
      panels.push(title);
    },
    warning() {},
  };
  installEntryEnhancements(game, ui);

  assert.equal(bouncer.handle({ id: 'clubDoor', target: 'downstairs@alley' }), true);
  assert.deepEqual(transitions, []);
  assert.equal(panels.at(-1), 'DOOR · SECURITY FIRST');

  assert.equal(bouncer.handle({ id: 'sam', npcId: 'sam', action: 'dialogue' }), true);
  assert.equal(bouncer.admitted, true);
  assert.deepEqual(transitions, []);
  assert.equal(panels.at(-1), 'DOOR · CLEARED BY SECURITY');

  assert.equal(bouncer.handle({ id: 'clubDoor', target: 'downstairs@alley' }), true);
  assert.deepEqual(transitions, ['downstairs@alley']);
});

test('God Mode opens the club door immediately and never routes Sam through security', () => {
  const transitions = [];
  let securityHandles = 0;
  const bouncer = {
    admitted: false,
    waitUntil: 9999999999999,
    reset() {},
    remainingWait() {
      return 999;
    },
    enter() {
      this.admitted = true;
    },
    handle() {
      securityHandles += 1;
      return true;
    },
  };
  const game = {
    godMode: true,
    crowdDoor: { bouncer },
    sceneManager: {
      current: { definition: { id: ENTRY_SCENE_ID } },
      request(destination) {
        transitions.push(destination);
      },
      start() {},
    },
    async initialize() {},
  };
  const panels = [];
  installEntryEnhancements(game, {
    panel(title) {
      panels.push(title);
    },
    warning() {},
  });

  assert.equal(bouncer.handle({ id: 'clubDoor', target: 'downstairs@alley' }), true);
  assert.deepEqual(transitions, ['downstairs@alley']);
  assert.equal(bouncer.admitted, true);
  assert.equal(bouncer.waitUntil, 0);
  assert.equal(securityHandles, 0);
  assert.deepEqual(panels, []);

  assert.equal(bouncer.handle({ id: 'sam', npcId: 'sam', action: 'dialogue' }), false);
  assert.equal(securityHandles, 0);
});
