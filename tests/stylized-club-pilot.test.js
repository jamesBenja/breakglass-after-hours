import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { createStylizedHuman } from '../src/avatar/StylizedHuman.js';
import { poseLightweightHuman } from '../src/avatar/LightweightHuman.js';
import { CrowdSystem } from '../src/crowd/CrowdSystem.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
import { levels } from '../src/world/levels.js';

const downstairs = levels.downstairs;

test('downstairs has a ten-person stylized social pilot on the dance floor', () => {
  const pilots = downstairs.npcs.filter((npc) => npc.id.startsWith('club-pilot-'));
  assert.equal(pilots.length, 10);
  assert.ok(pilots.every((npc) => npc.visualStyle === 'stylized'));
  assert.ok(pilots.every((npc) => npc.role === 'dancer'));
  assert.ok(pilots.every((npc) => npc.socialParticipant === true));
  assert.ok(pilots.every((npc) => npc.interactive === false));
  assert.equal(new Set(pilots.map((npc) => npc.motionProfile)).size, 4);
  assert.equal(new Set(pilots.map((npc) => npc.appearance.hairStyle)).size >= 5, true);

  const danceZone = downstairs.crowd.zones.find((zone) => zone.kind === 'dance');
  assert.ok(danceZone);
  for (const pilot of pilots) {
    const [x, , z] = pilot.position;
    assert.ok(x >= danceZone.x1 && x <= danceZone.x2);
    assert.ok(z >= danceZone.z1 && z <= danceZone.z2);
  }
});

test('club pilots expose social-only interaction targets and join dance circles', () => {
  const pilots = downstairs.npcs.filter((npc) => npc.id.startsWith('club-pilot-'));
  const root = new Group();
  const system = new NpcSystem(root, { ...downstairs, npcs: pilots });

  const targets = system.interactionTargets();
  assert.equal(targets.length, 10);
  assert.ok(targets.every((target) => target.action === 'clubSocial'));

  const joined = system.triggerDanceCircle({ x: 0, y: 0, z: 0 }, 5);
  assert.ok(joined >= 6, 'nearby stylized dancers should join a circle');
  assert.ok(system.npcs.some((npc) => npc.socialGesture === 'circle'));

  system.dispose();
});

test('stylized motion personalities produce visibly different dance posture', () => {
  const neutral = createStylizedHuman();
  const bouncy = createStylizedHuman();

  poseLightweightHuman(neutral, {
    time: 0.63,
    phase: 0.3,
    dancing: true,
    energy: 0.85,
    motionProfile: 'neutral',
  });
  poseLightweightHuman(bouncy, {
    time: 0.63,
    phase: 0.3,
    dancing: true,
    energy: 0.85,
    motionProfile: 'bouncy',
  });

  const neutralMotion =
    Math.abs(neutral.body.rotation.z) +
    Math.abs(neutral.leftArm.rotation.x) +
    Math.abs(neutral.head.rotation.y);
  const bouncyMotion =
    Math.abs(bouncy.body.rotation.z) +
    Math.abs(bouncy.leftArm.rotation.x) +
    Math.abs(bouncy.head.rotation.y);

  assert.notEqual(neutral.body.position.y, bouncy.body.position.y);
  assert.notEqual(neutralMotion, bouncyMotion);
});

test('stylized NPC detail LOD hides accessories when the player is far away', () => {
  const pilot = downstairs.npcs.find((npc) => npc.id === 'club-pilot-1');
  const root = new Group();
  const system = new NpcSystem(root, { ...downstairs, npcs: [pilot] });
  const npc = system.get('club-pilot-1');

  assert.equal(npc.lodDetails.visible, true);
  system.update(0.016, {
    playing: true,
    energy: 0.6,
    bass: 0.6,
    playerPosition: new Vector3(30, 0, 30),
  });
  assert.equal(npc.lodDetails.visible, false);

  system.update(0.016, {
    playing: true,
    energy: 0.6,
    bass: 0.6,
    playerPosition: new Vector3(npc.group.position.x, 0, npc.group.position.z),
  });
  assert.equal(npc.lodDetails.visible, true);

  system.dispose();
});

test('generic downstairs crowd uses the stylized-v2 instanced proportions', () => {
  assert.equal(downstairs.crowd.visualStyle, 'stylized-v2');

  const root = new Group();
  const crowd = new CrowdSystem(root, {
    ...downstairs.crowd,
    max: 8,
    min: 8,
    idle: 8,
    start: 8,
  });

  assert.equal(crowd.visualStyle, 'stylized-v2');
  assert.ok(crowd.members.every((member) => member.posture >= 0.82 && member.posture <= 1.18));
  assert.ok(crowd.members.every((member) => member.groove >= 0.82 && member.groove <= 1.22));
  crowd.update(0.1, {
    playing: true,
    energy: 0.75,
    bass: 0.8,
    vibe: 0.8,
    mixQuality: 0.9,
  });
  assert.ok(crowd.danceFloorCount > 0);

  crowd.dispose();
});
