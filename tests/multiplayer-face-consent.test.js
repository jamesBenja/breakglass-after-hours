import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplayerAvatar } from '../src/avatar/profile.js';

const face = 'data:image/webp;base64,ZmFrZS1mYWNl';

test('multiplayer avatar never sends a face texture without explicit opt-in', () => {
  const avatar = multiplayerAvatar({ displayName: 'Guest', faceTexture: face });
  assert.equal(avatar.faceTexture, null);
  assert.equal(avatar.shareFaceMultiplayer, false);
});

test('multiplayer avatar includes the processed face texture after explicit opt-in', () => {
  const avatar = multiplayerAvatar({
    displayName: 'Guest',
    faceTexture: face,
    shareFaceMultiplayer: true,
  });
  assert.equal(avatar.faceTexture, face);
  assert.equal(avatar.shareFaceMultiplayer, true);
});
