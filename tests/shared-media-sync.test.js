import test from 'node:test';
import assert from 'node:assert/strict';

import { SharedMediaSync, SHARED_MEDIA_OBJECTS } from '../src/multiplayer/SharedMediaSync.js';
import { StudioSession } from '../src/studio/StudioSession.js';

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
    resources: new Map(),
    hydrate() {},
    handleObjectState(message) {
      if (message?.objectId) this.objects.set(message.objectId, message.data);
    },
  };
  const client = {
    joined,
    localId,
    world,
    ui: {
      panelElement: { classList: { contains: () => false } },
    },
    game: {
      studio: new StudioSession(),
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
  assert.equal(applyCalls, 1, "another player's shared Studio packet must still be applied");

  sync.dispose();
});

test('non-owner Spectra playback changes cannot publish over the console owner', async () => {
  const { client, playback, sent } = makeClient({ joined: true, localId: 'phone-b' });
  client.world.resources.set('upstairs:console', {
    id: 'upstairs:console',
    ownerId: 'phone-a',
    ownerName: 'James',
  });
  const sync = new SharedMediaSync(client);
  const session = client.game.studio;

  await playback.play(session, 0, { restartTransport: true });

  assert.equal(
    sent.some((message) => message.objectId === SHARED_MEDIA_OBJECTS.studio),
    false,
  );

  sync.dispose();
});

test('remote Spectra session merges into the follower mixer session and preserves surviving local audio', async () => {
  const { client, playback } = makeClient({ joined: true, localId: 'phone-b' });
  client.game.sceneManager.current = {
    definition: { id: 'upstairs' },
    collision: { surfaceAt: () => ({ surface: { id: 'spectra' } }) },
  };
  client.game.player = { position: { x: 0, y: 0, z: 0 } };
  client.game.spatialAudio = {
    sourceEnvironmentFor: () => ({ gain: 1 }),
  };
  client.world.resources.set('upstairs:console', {
    id: 'upstairs:console',
    ownerId: 'phone-a',
    ownerName: 'James',
  });

  const surviving = client.game.studio.stems.find((stem) => stem.inputKey === 'guitar');
  const localBuffer = { duration: 2.5 };
  client.game.studio.recordings.set(surviving.id, localBuffer);

  const remote = client.game.studio.snapshot();
  remote.takeCounter += 1;
  remote.stems.push({
    id: 'guitar-remote-1',
    label: 'Nora · Guitar',
    kind: 'guitar',
    level: 0.68,
    pan: 0,
    low: 0,
    high: 0,
    reverb: 0,
    delay: 0,
    mute: false,
    solo: false,
    monitor: true,
    recordArm: false,
    clipActive: true,
    clipStart: 0,
    sourceOffset: 0,
    sourceDuration: 0,
    inputKey: null,
    source: 'spectra-collaborative-capture',
    performance: {
      mode: 'guitar',
      label: 'Nora · Guitar',
      baseMidi: 48,
      wave: 'triangle',
      volume: 0.065,
      noteDuration: 0.42,
      octaveLayer: false,
      bpm: 118,
      duration: 8,
      events: [
        { time: 0, midi: 52, frequency: 164.81 },
        { time: 0.5, midi: 55, frequency: 196 },
      ],
    },
  });

  const sync = new SharedMediaSync(client);
  sync.sourceAudible = () => true;
  await sync.applyStudio({
    playing: true,
    session: remote,
    position: 0,
    sentAt: 1000,
    originId: 'phone-a',
    controllerId: 'phone-a',
  });

  assert.equal(playback.session, client.game.studio);
  assert.ok(client.game.studio.stems.some((stem) => stem.id === 'guitar-remote-1'));
  assert.equal(client.game.studio.recordings.get(surviving.id), localBuffer);

  sync.dispose();
});
