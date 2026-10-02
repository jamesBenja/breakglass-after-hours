import test from 'node:test';
import assert from 'node:assert/strict';
import { alleyLevel } from '../src/world/alley.js';

test('Sam remains a fixed alley security NPC for player-facing tracking', () => {
  const sam = alleyLevel.npcs.find((npc) => npc.id === 'sam');
  assert.ok(sam);
  assert.equal(sam.role, 'security');
  assert.ok(sam.anchor === 'sam');
  assert.ok(!sam.route);
});
