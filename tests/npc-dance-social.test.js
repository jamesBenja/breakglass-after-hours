import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { CrowdSystem } from '../src/crowd/CrowdSystem.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';

const definition = {
  id: 'downstairs',
  anchors: {},
  crowd: {
    zones: [{ x1: -4.7, x2: 4.7, z1: -2.15, z2: 2.75, kind: 'dance', weight: 1 }],
  },
  npcs: [
    { id: 'floor-npc', name: 'Floor NPC', role: 'guest', position: [1, 0, 0] },
    { id: 'off-floor-npc', name: 'Off Floor NPC', role: 'guest', position: [7, 0, 0] },
  ],
};

test('named NPCs on the dance floor join a nearby dance circle', () => {
  const root = new Group();
  const npcs = new NpcSystem(root, definition);

  assert.equal(npcs.triggerDanceCircle({ x: 0, y: 0, z: 0 }), 1);
  assert.equal(npcs.get('floor-npc').socialGesture, 'circle');
  assert.ok(npcs.get('floor-npc').socialGestureRemaining > 0);
  assert.equal(npcs.get('off-floor-npc').socialGesture, null);

  npcs.dispose();
});

test('paired NPC social gestures face the initiating player and pause navigation', () => {
  const root = new Group();
  const npcs = new NpcSystem(root, definition);
  const npc = npcs.get('floor-npc');
  npc.navPath = [{ x: 2, y: 0, z: 0 }];

  assert.equal(npcs.triggerSocialGesture('floor-npc', 'highfive', { x: 1, z: 2 }), true);
  assert.equal(npc.socialGesture, 'highfive');
  assert.equal(npc.navPath.length, 0);
  assert.ok(Number.isFinite(npc.group.rotation.y));

  npcs.dispose();
});

test('generic club crowd retains a temporary circle-response state', () => {
  const root = new Group();
  const crowd = new CrowdSystem(root, {
    max: 4,
    min: 4,
    idle: 4,
    start: 4,
    zones: [{ x1: -2, x2: 2, z1: -2, z2: 2, kind: 'dance', weight: 1 }],
  });

  assert.equal(crowd.triggerDanceCircle({ x: 0, z: 0 }, 3, 1), true);
  assert.equal(crowd.danceCircle.radius, 3);
  crowd.update(1.1, { playing: true, energy: 0.7, bass: 0.7, vibe: 0.7, mixQuality: 0.8 });
  assert.equal(crowd.danceCircle, null);

  crowd.dispose();
});
