import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_MULTIPLAYER_ROOM,
  CANONICAL_MULTIPLAYER_SERVER,
  liveBackendSelection,
  liveVerificationServer,
} from '../src/runtime/LiveBackendPolicy.js';

test('production ignores alternate server, room and offline query parameters', () => {
  const selection = liveBackendSelection({
    search: '?server=https://old.example.test&room=other-room&offline=1',
    production: true,
    globalServer: 'https://global.example.test',
    envServer: 'https://env.example.test',
    storedServer: 'https://stored.example.test',
  });

  assert.deepEqual(selection, {
    server: CANONICAL_MULTIPLAYER_SERVER,
    room: CANONICAL_MULTIPLAYER_ROOM,
    offline: false,
    queryServer: null,
  });
});

test('production God Mode and invitations verify against the same canonical server', () => {
  assert.equal(
    liveVerificationServer({
      search: '?server=https://old.example.test',
      production: true,
    }),
    CANONICAL_MULTIPLAYER_SERVER,
  );
});

test('development retains explicit alternate backend controls for local testing', () => {
  const selection = liveBackendSelection({
    search: '?server=http://127.0.0.1:8787&room=test-room&offline=1',
    production: false,
  });

  assert.equal(selection.server, 'http://127.0.0.1:8787');
  assert.equal(selection.room, 'test-room');
  assert.equal(selection.offline, true);
});
