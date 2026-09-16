import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { trackForPeer } from '../src/multiplayer/PartyPhone.js';
import { effectiveVoiceGain } from '../src/multiplayer/SpatialVoice.js';

test('private call sends media only to the selected peer', () => {
  const partyTrack = { id: 'party' };
  const privateTrack = { id: 'call' };

  assert.equal(
    trackForPeer({
      peerId: 'nora',
      activePeerId: 'nora',
      privateTrack,
      partyTrack,
    }),
    privateTrack,
  );
  assert.equal(
    trackForPeer({
      peerId: 'jashim',
      activePeerId: 'nora',
      privateTrack,
      partyTrack,
    }),
    null,
  );
});

test('ending a private call restores the normal party track plan', () => {
  const partyTrack = { id: 'party' };
  assert.equal(
    trackForPeer({ peerId: 'nora', activePeerId: null, privateTrack: null, partyTrack }),
    partyTrack,
  );
  assert.equal(
    trackForPeer({ peerId: 'jashim', activePeerId: null, privateTrack: null, partyTrack }),
    partyTrack,
  );
});

test('private call audio ignores distance and mutes other player voices', () => {
  assert.equal(
    effectiveVoiceGain({ remoteId: 'nora', privatePeerId: 'nora', spatialGain: 0 }),
    1,
  );
  assert.equal(
    effectiveVoiceGain({ remoteId: 'jashim', privatePeerId: 'nora', spatialGain: 1 }),
    0,
  );
  assert.equal(
    effectiveVoiceGain({ remoteId: 'jashim', privatePeerId: null, spatialGain: 0.42 }),
    0.42,
  );
});

test('mobile chat and phone quickbar is moved away from bottom action controls', async () => {
  const css = await readFile(new URL('../src/ui/multiplayer.css', import.meta.url), 'utf8');
  assert.match(css, /\.live-social-dock\s*\{[\s\S]*left:\s*50%;[\s\S]*top:/);
  assert.match(css, /\.live-social-quickbar/);
  assert.match(css, /\.party-phone-toggle/);
});
