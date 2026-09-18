import test from 'node:test';
import assert from 'node:assert/strict';
import { DjMixer } from '../src/dj/DjMixer.js';
import { installDjSyncEnhancements } from '../src/gameplay/djSyncEnhancements.js';
import { installDjPerformanceRealism } from '../src/gameplay/DjPerformanceRealismSystem.js';
import { installDjAccuracyEnhancements } from '../src/gameplay/DjAccuracyEnhancements.js';

function mixerHarness() {
  const audio = {
    context: { currentTime: 0, state: 'running' },
    master: {},
    environment: { gain: 1 },
    externalTransports: new Map(),
    setExternalTransport() {},
    updateExternalTransport() {},
    clearExternalTransport() {},
  };
  const mixer = new DjMixer(audio, globalThis);
  const game = { dj: mixer };
  installDjSyncEnhancements(game, null);
  installDjPerformanceRealism(game, null);
  installDjAccuracyEnhancements(game, null);
  return mixer;
}

test('free-time records cannot be falsely beat-synced to a fixed-grid master', () => {
  const mixer = mixerHarness();
  mixer.load('A', 'rotations-water-is-boiling-outro');
  mixer.load('B', 'got-you-dancin');
  mixer.decks.B.playing = true;
  assert.equal(mixer.snapshot().decks.A.freeTime, true);
  assert.equal(mixer.sync('A'), false);
});


test('active player DJ decks are recreated from their transport position after backgrounding', async () => {
  const mixer = mixerHarness();
  mixer.context.currentTime = 15;
  mixer.decks.A.playing = true;
  mixer.decks.A.transportOffset = 12;
  mixer.decks.A.transportStartedAt = 10;

  assert.equal(mixer.prepareForBackground(), true);
  assert.equal(mixer.decks.A.playing, false);
  assert.equal(mixer.backgroundSnapshot.length, 1);
  assert.ok(mixer.backgroundSnapshot[0].position > 16.9);

  let restarted = null;
  mixer.playDeck = async (deckId, position) => {
    restarted = { deckId, position };
    mixer.decks[deckId].playing = true;
    return true;
  };

  assert.equal(await mixer.recoverAfterBackground(), true);
  assert.equal(restarted.deckId, 'A');
  assert.equal(restarted.position, mixer.decks.A.transportOffset);
  assert.equal(mixer.backgroundSnapshot.length, 0);
});
