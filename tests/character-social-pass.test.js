import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_LOOKS } from '../src/npcs/NpcSystem.js';
import { HOUSE_DJS } from '../src/gameplay/HouseDjSystem.js';
import { groupPhotoCountdownLabel } from '../src/gameplay/GroupPhotoSystem.js';
import { preparePartyLifeWorld } from '../src/gameplay/partyLifeEnhancements.js';
import { levels } from '../src/world/levels.js';

preparePartyLifeWorld();

test('Sam replaces the generic front-door bouncer', () => {
  assert.ok(levels.alley.npcs.some((npc) => npc.id === 'sam' && npc.role === 'security'));
  assert.equal(
    levels.alley.npcs.some((npc) => npc.id === 'bouncer'),
    false,
  );
  assert.ok(levels.alley.anchors.sam);
  assert.equal(CHARACTER_LOOKS.sam.hairStyle, 'bald');
  assert.equal(CHARACTER_LOOKS.sam.tattoos, true);
  assert.equal(CHARACTER_LOOKS.sam.headTattoo, true);
  assert.ok(CHARACTER_LOOKS.sam.heightScale > 1.08);
  assert.ok(CHARACTER_LOOKS.sam.bodyWidth < 0.85);
});

test('Malaika roams with Nora and can appear as DJ FLLEUR', () => {
  const malaika = levels.downstairs.npcs.find((npc) => npc.id === 'malaika');
  const nora = levels.downstairs.npcs.find((npc) => npc.id === 'nora');
  assert.ok(malaika);
  assert.ok(nora);
  assert.ok(malaika.route.length >= 5);
  assert.equal(malaika.companionId, 'nora');
  assert.deepEqual(malaika.companionOffset, [0.9, 0, 0.45]);
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'malaika' && dj.name === 'DJ FLLEUR'));
  assert.equal(CHARACTER_LOOKS.malaika.hairStyle, 'long');
  assert.equal(CHARACTER_LOOKS.malaika.curls, true);
  assert.equal(CHARACTER_LOOKS.malaika.glasses, true);
  assert.equal(CHARACTER_LOOKS.malaika.tattoos, true);
});

test('photo-backed recurring characters have explicit non-random reference traits', () => {
  for (const id of [
    'nora',
    'james',
    'beaver',
    'courtney',
    'simla',
    'zander',
    'jace',
    'boogaloo',
    'lunice',
    'jashim',
    'dave',
  ]) {
    assert.ok(CHARACTER_LOOKS[id], `missing look for ${id}`);
    assert.ok(Number.isFinite(CHARACTER_LOOKS[id].bodyWidth), `missing body width for ${id}`);
    assert.ok(Number.isFinite(CHARACTER_LOOKS[id].heightScale), `missing height scale for ${id}`);
  }
});

test('Jashim and roof-founder Dave use their photo references without colliding with David', () => {
  assert.equal(CHARACTER_LOOKS.jashim.hairStyle, 'long');
  assert.equal(CHARACTER_LOOKS.jashim.bangs, true);
  assert.equal(CHARACTER_LOOKS.jashim.tattoos, true);
  assert.equal(CHARACTER_LOOKS.jashim.neckTattoo, true);
  assert.equal(CHARACTER_LOOKS.jashim.handTattoos, true);
  assert.equal(CHARACTER_LOOKS.dave.cap, true);
  assert.equal(CHARACTER_LOOKS.dave.beard, true);
  assert.equal(CHARACTER_LOOKS.dave.mustache, true);
  assert.notEqual(CHARACTER_LOOKS.david.cap, true);
  assert.ok(levels.roof.npcs.some((npc) => npc.id === 'dave' && npc.role === 'founder'));
  assert.equal(
    levels.roof.npcs.some((npc) => npc.id === 'david'),
    false,
  );
});

test('group photo countdown resolves to a synchronized 3-2-1-flash sequence', () => {
  assert.equal(groupPhotoCountdownLabel(1000, 4500), '3');
  assert.equal(groupPhotoCountdownLabel(1800, 4500), '3');
  assert.equal(groupPhotoCountdownLabel(2600, 4500), '2');
  assert.equal(groupPhotoCountdownLabel(3600, 4500), '1');
  assert.equal(groupPhotoCountdownLabel(4400, 4500), 'FLASH');
});

test('Below room orientation remains the recovered architecture', () => {
  const surfaces = new Map(
    levels.downstairs.navigation.surfaces.map((surface) => [surface.id, surface]),
  );
  assert.equal(surfaces.get('lounge').name, 'Take A Break');
  assert.ok(surfaces.get('lounge').x1 > 0, 'Take A Break must remain on east side');
  assert.equal(surfaces.get('service').name, 'Kitchen + Bar');
  assert.ok(surfaces.get('service').x2 < 0, 'Kitchen + Bar must remain on west side');
  assert.equal(surfaces.get('east-service').name, 'Nora Photo Room / Production');
});
