import test from 'node:test';
import assert from 'node:assert/strict';

import { SharedMediaSync, SHARED_MEDIA_OBJECTS } from '../src/multiplayer/SharedMediaSync.js';

function makeClient({ joined = false, localId = 'local-player' } = {}) {
  const sent = [];
  const playback = {
    playing: false,
    session: null,
    async play(session, offset = 0, options = {}) {
      this.playing = true;
      this.session = session;
      this.lastPlay = { session, offset, options };
      return true;
    },
    stop() {
      this.playing = false;
      return true;
    },
    updateMix() {
      return true;
    },
    position() {
      return 0.25;
    },
  };
  const world = {
    objects: new Map(),
    hydrate() {},
    handleObjectState(message) {
      if (message?.objectId) this.objects.set(message.objectId, message.data);
    },
  };
  const client = {
    joined,
    localId,
    world,
    ui: {},
    game: {
      studioPlayback: playback,
      partyLife: {},
      sceneManager: { current: null },
      spatialAudio: null,
      audio: {},
    },
    serverNow: () => 1000,
    send(payload) {
      sent.push(payload);
      return true;
    },
  };
  return { client, playback, sent };
}

test('SharedMediaSync preserves StudioPlayback PLAY options', async () => {
  const { client, playback } = makeClient({ joined: false });
  const sync = new SharedMediaSync(client);
  const session = { snapshot: () => ({ name: 'Test I' }) };
  const options = { restartTransport: true, stemId: 'input-vocal-22' };

  assert.equal(await playback.play(session, 0, options), true);
  assert.deepEqual(playback.lastPlay.options, options);

  sync.dispose();
});

test('SharedMediaSync tags local studio publications and ignores their echoed packet', async () => {
  const { client, playback, sent } = makeClient({ joined: true, localId: 'phone-a' });
  const sync = new SharedMediaSync(client);
  const session = {
    name: 'Test I',
    snapshot: () => ({ name: 'Test I', stems: [] }),
  };

  await playback.play(session, 0, { restartTransport: true });
  const published = sent.find((message) => message.objectId === SHARED_MEDIA_OBJECTS.studio);
  assert.ok(published);
  assert.equal(published.data.originId, 'phone-a');

  let applyCalls = 0;
  sync.applyStudio = async () => {
    applyCalls += 1;
  };
  sync.handleObjectState(SHARED_MEDIA_OBJECTS.studio, published.data);
  await Promise.resolve();

  assert.equal(applyCalls, 0, 'the sender must never re-apply its own shared Studio packet');

  sync.handleObjectState(SHARED_MEDIA_OBJECTS.studio, {
    ...published.data,
    originId: 'phone-b',
  });
  await Promise.resolve();
  assert.equal(applyCalls, 1, 'another player\'s shared Studio packet must still be applied');

  sync.dispose();
});
