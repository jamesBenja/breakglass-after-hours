import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { MaddoxSystem } from '../src/pets/MaddoxSystem.js';
import {
  MaddoxInteractionSystem,
  ROOF_AFFECTION_THRESHOLD,
} from '../src/gameplay/MaddoxInteractionSystem.js';

test('Maddox follows a waypoint route and settles at the hidden roof passage', () => {
  const root = new Group();
  const maddox = new MaddoxSystem(root, {
    start: [0, 0, 0],
    speed: 3,
    roofLeadRoute: [
      [0.6, 0, 0],
      [0.6, 0, 0.6],
      [1.2, 0, 0.6],
    ],
  });
  assert.equal(maddox.startLead(), true);
  for (let i = 0; i < 240 && !maddox.arrivedAtLeadTarget; i++) maddox.update(1 / 60);
  assert.equal(maddox.arrivedAtLeadTarget, true);
  assert.equal(maddox.snapshot().state, 'sit');
  assert.ok(Math.abs(maddox.positionOf().x - 1.2) < 0.13);
  assert.ok(Math.abs(maddox.positionOf().z - 0.6) < 0.13);
  maddox.dispose();
});

test('petting Maddox enough unlocks the roof secret and starts guide behavior', () => {
  const root = new Group();
  const route = [
    [0.5, 0, 0],
    [1, 0, 0],
  ];
  const maddox = new MaddoxSystem(root, { start: [0, 0, 0], roofLeadRoute: route });
  const state = {
    data: {
      maddoxPets: 0,
      maddoxAffection: 0,
      roofSecretUnlocked: false,
    },
  };
  const panels = [];
  const ui = {
    panel: (title, text, actions = []) => panels.push({ title, text, actions }),
  };
  const sceneManager = {
    current: {
      maddox,
      definition: { maddox: { roofLeadRoute: route } },
    },
  };
  let saves = 0;
  const interaction = new MaddoxInteractionSystem({
    state,
    ui,
    sceneManager,
    saveState: () => saves++,
  });

  assert.equal(interaction.handle({ action: 'maddox' }), true);
  for (let i = 0; i < ROOF_AFFECTION_THRESHOLD; i++) interaction.pet();

  assert.equal(state.data.maddoxPets, ROOF_AFFECTION_THRESHOLD);
  assert.equal(state.data.maddoxAffection, ROOF_AFFECTION_THRESHOLD);
  assert.equal(state.data.roofSecretUnlocked, true);
  assert.equal(maddox.snapshot().leading, true);
  assert.ok(saves >= ROOF_AFFECTION_THRESHOLD);
  assert.equal(panels.at(-1).title, 'MADDOX KNOWS A WAY UP');
  maddox.dispose();
});
