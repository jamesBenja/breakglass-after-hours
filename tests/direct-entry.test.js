import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeDirectEntry,
  directEntryFromLocation,
  resolveDirectEntryLanding,
} from '../src/runtime/DirectEntry.js';

test('direct entry aliases resolve from hash and query parameters', () => {
  assert.deepEqual(
    directEntryFromLocation({
      href: 'https://example.test/game/#start=dj-booth',
      search: '',
      hash: '#start=dj-booth',
    }),
    { id: 'dj-booth', sceneId: 'downstairs', anchorId: 'dj' },
  );
  assert.deepEqual(
    directEntryFromLocation({
      href: 'https://example.test/game/?start=spectra',
      search: '?start=spectra',
      hash: '',
    }),
    { id: 'spectra', sceneId: 'upstairs', anchorId: 'console' },
  );
  assert.equal(
    directEntryFromLocation({
      href: 'https://example.test/game/#start=unknown',
      search: '',
      hash: '#start=unknown',
    }),
    null,
  );
});

test('consuming direct entry removes only start and preserves invitation parameters', () => {
  const calls = [];
  const historyRef = {
    state: { test: true },
    replaceState(...args) {
      calls.push(args);
    },
  };
  const locationRef = {
    href: 'https://example.test/game/#invite=abc123&start=spectra',
    search: '',
    hash: '#invite=abc123&start=spectra',
  };

  const entry = consumeDirectEntry(locationRef, historyRef);

  assert.equal(entry?.id, 'spectra');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], 'https://example.test/game/#invite=abc123');
});

test('direct entries land at the configured live anchor without granting access', () => {
  const makeLevel = (sceneId, anchorId, position) => ({
    definition: {
      id: sceneId,
      anchors: {
        [anchorId]: { position, radius: 1.5 },
      },
    },
    collision: {
      isValidPosition(candidate) {
        return candidate.x === position[0] && candidate.z === position[2];
      },
    },
  });
  const game = {
    scenes: new Map([
      ['downstairs', makeLevel('downstairs', 'dj', [1.5, 0, -2.15])],
      ['upstairs', makeLevel('upstairs', 'console', [-12.3, 0.28, -0.55])],
    ]),
    state: { data: { djAccessGranted: false, studioAccessGranted: false } },
  };

  assert.deepEqual(
    resolveDirectEntryLanding(game, {
      id: 'dj-booth',
      sceneId: 'downstairs',
      anchorId: 'dj',
    }),
    {
      id: 'dj-booth',
      sceneId: 'downstairs',
      anchorId: 'dj',
      position: [1.5, 0, -2.15],
    },
  );
  assert.deepEqual(
    resolveDirectEntryLanding(game, {
      id: 'spectra',
      sceneId: 'upstairs',
      anchorId: 'console',
    }),
    {
      id: 'spectra',
      sceneId: 'upstairs',
      anchorId: 'console',
      position: [-12.3, 0.28, -0.55],
    },
  );
  assert.equal(game.state.data.djAccessGranted, false);
  assert.equal(game.state.data.studioAccessGranted, false);
});
