import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_MUSIC_SESSION_KEY,
  buildSessionRecoveryCheckpoint,
  readActiveMusicSession,
} from '../src/runtime/SessionRecovery.js';
import { SpectraProjectStore } from '../src/studio/SpectraProjectStore.js';

class MapStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test('music recovery checkpoint captures room, position, DJ transport and Spectra state', () => {
  const game = {
    state: {
      saveKey: 'save-key',
      data: { sceneId: 'alley', position: [0, 0, 0], layoutRevision: 3 },
    },
    sceneManager: { current: { definition: { id: 'upstairs', layoutRevision: 7 } } },
    player: { position: { x: 4, y: 0, z: 9 } },
    studio: { snapshot: () => ({ name: 'Recovery song', stems: [] }) },
    studioPlayback: { playing: true, position: () => 3.25 },
    spectraTransport: { snapshot: () => ({ running: true, position: 3.25 }) },
    spectraRecorder: { status: () => ({ armed: true, recording: false }) },
    dj: {
      decks: {
        A: { playing: true },
        B: { playing: false },
      },
      snapshot: () => ({
        crossfader: -0.3,
        decks: {
          A: { trackId: 'got-you-dancin', playing: true, bpm: 130, level: 0.8, low: 0, high: 0 },
          B: { trackId: 'dubki', playing: false, bpm: 124, level: 0.7, low: 0, high: 0 },
        },
      }),
      deckPosition: (id) => (id === 'A' ? 42.5 : 7.25),
    },
  };
  const documentRef = {
    body: {
      classList: {
        contains: (name) => name === 'spectra-console-active',
      },
    },
  };

  const checkpoint = buildSessionRecoveryCheckpoint(game, {
    documentRef,
    now: 12345,
  });

  assert.equal(checkpoint.active, true);
  assert.equal(checkpoint.surface, 'spectra');
  assert.equal(checkpoint.sceneId, 'upstairs');
  assert.deepEqual(checkpoint.position, [4, 0, 9]);
  assert.equal(checkpoint.studioPlayback.position, 3.25);
  assert.equal(checkpoint.dj.decks.A.position, 42.5);
  assert.equal(checkpoint.dj.decks.B.position, 7.25);
});

test('active music marker expires instead of blocking future live updates forever', () => {
  const storage = new MapStorage();
  storage.setItem(
    ACTIVE_MUSIC_SESSION_KEY,
    JSON.stringify({
      active: true,
      savedAt: 1000,
      saveKey: 'save-key',
      surface: 'dj',
    }),
  );

  assert.equal(readActiveMusicSession(storage, 1500)?.surface, 'dj');
  assert.equal(readActiveMusicSession(storage, 31 * 60 * 1000), null);
});


test('recovery store keeps raw microphone blobs when WebAudio decode fails', async () => {
  const store = new SpectraProjectStore(null);
  const blob = new Blob(['voice'], { type: 'audio/mp4' });
  await store.put('recovery', 'vox-1', blob);

  const attached = [];
  const session = {
    attachRecording(stemId, buffer, recordingBlob) {
      attached.push({ stemId, buffer, recordingBlob });
    },
  };
  const audioContext = {
    async decodeAudioData() {
      throw new Error('Safari cannot decode this MediaRecorder container');
    },
  };

  const result = await store.restoreSession('recovery', session, audioContext);
  assert.equal(result.restored, 0);
  assert.equal(result.failed, 1);
  assert.equal(attached.length, 1);
  assert.equal(attached[0].stemId, 'vox-1');
  assert.equal(attached[0].buffer, null);
  assert.equal(attached[0].recordingBlob, blob);
});
