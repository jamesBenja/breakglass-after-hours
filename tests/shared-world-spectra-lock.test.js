import test from 'node:test';
import assert from 'node:assert/strict';

import { SharedWorld } from '../src/multiplayer/SharedWorld.js';

test('Spectra console panel is revoked when another player becomes owner', () => {
  const calls = [];
  const client = {
    localId: 'phone-b',
    send: () => true,
    game: {
      dj: null,
      sceneManager: { current: { definition: { id: 'upstairs' } } },
      player: { position: { x: 0, z: 0, distanceTo: () => 0 }, seated: false },
    },
    ui: {
      panelElement: {
        classList: {
          contains: (name) => name === 'spectra-console-panel',
        },
      },
      clearPanel(title, text) {
        calls.push(['clear', title, text]);
      },
      warning(message) {
        calls.push(['warning', message]);
      },
    },
  };

  const world = new SharedWorld(client);
  world.handleResource({
    resource: {
      id: 'upstairs:console',
      ownerId: 'phone-a',
      ownerName: 'James',
    },
  });

  assert.equal(world.resources.get('upstairs:console').ownerId, 'phone-a');
  assert.equal(calls[0][0], 'clear');
  assert.match(calls[0][1], /IN USE/);
  assert.match(calls[0][2], /James/);
  assert.equal(calls[1][0], 'warning');
});
