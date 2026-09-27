import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedMediaSync } from '../src/multiplayer/SharedMediaSync.js';

function setup() {
  const session = {
    snapshot: () => ({
      bpm: 118,
      loopEnabled: true,
      loopBars: 4,
      stems: [{ id: 'guitar', mute: false, solo: false, level: 0.7 }],
    }),
  };
  const playback = {
    playing: true,
    session,
    play: async () => true,
    stop: () => true,
    updateMix: () => true,
    updateStemMix: () => true,
    applyChannelAudibility: () => true,
    position: () => 0,
  };
  const world = {
    resources: new Map([['upstairs:console', { id: 'upstairs:console', ownerId: 'producer' }]]),
    objects: new Map(),
    hydrate: () => {},
    handleObjectState: () => {},
  };
  const game = {
    studioPlayback: playback,
    partyLife: null,
    sceneManager: { current: null },
  };
  const client = {
    game,
    ui: {},
    world,
    joined: true,
    localId: 'producer',
    serverNow: () => 1000,
    send: () => true,
  };
  const sync = new SharedMediaSync(client);
  let publishes = 0;
  sync.publishStudio = () => {
    publishes += 1;
    return true;
  };
  return { sync, playback, session, publishes: () => publishes };
}

test('Spectra mute and solo audibility changes publish the shared mixer state', () => {
  const { playback, session, publishes } = setup();
  playback.applyChannelAudibility(session);
  assert.equal(publishes(), 1);
});

test('Spectra per-channel mixer changes publish the shared mixer state', () => {
  const { playback, session, publishes } = setup();
  playback.updateStemMix(session, 'guitar', { immediate: true });
  assert.equal(publishes(), 1);
});
