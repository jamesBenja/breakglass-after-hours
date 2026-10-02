import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import {
  createInteractionItem,
  INTERACTION_ITEM_PROFILES,
} from '../src/gameplay/InteractionPropSystem.js';
import { BarServiceSystem } from '../src/gameplay/BarServiceSystem.js';
import { createLightweightHuman } from '../src/avatar/LightweightHuman.js';
import { dialogues } from '../src/npcs/dialogues.js';
import { NpcSystem } from '../src/npcs/NpcSystem.js';
import { DJ_BOOTH_VISUAL_REVISION } from '../src/scenes/geometry/djBoothRealism.js';

test('food, drink, coffee and candy all have physical interaction props', () => {
  for (const kind of ['beer', 'mixed', 'water', 'coffee', 'hotdog', 'taco', 'candy']) {
    assert.ok(INTERACTION_ITEM_PROFILES[kind], `missing ${kind}`);
    const prop = createInteractionItem(kind);
    assert.ok(prop.children.length > 0, `${kind} should render visible geometry`);
  }
});

test('bar service requests visible handoffs and coffee consumption', () => {
  const events = [];
  const state = { data: { intoxication: 0, caffeine: 0, drinksServed: 0, coffeesMade: 0 } };
  const system = new BarServiceSystem({
    state,
    player: { setIntoxication() {} },
    ui: { panel() {} },
    sceneManager: {
      current: {
        definition: { id: 'downstairs' },
        npcs: { triggerServe() {}, triggerHandoff() {}, get: () => ({ name: 'Courtney' }) },
      },
    },
    saveState() {},
  });
  system.interactionProps = {
    receiveFromNpc: (id, kind) => events.push(['receive', id, kind]),
    selfServe: (kind) => events.push(['self', kind]),
  };
  system.order('courtney', { id: 'beer', label: 'Beer / cider', strength: 0.17 });
  system.water('courtney');
  system.coffee();
  assert.deepEqual(events, [
    ['receive', 'courtney', 'beer'],
    ['receive', 'courtney', 'water'],
    ['self', 'coffee'],
  ]);
});

test('Devin exposes both directions of the candy exchange again', () => {
  assert.match(dialogues.devin.takeCandyPrompt, /take.*candy/i);
  assert.match(dialogues.devin.giveCandyPrompt, /give.*candy/i);
});

test('generic NPCs can perform a handoff pose', () => {
  const root = new Group();
  const system = new NpcSystem(root, {
    anchors: {},
    npcs: [{ id: 'beaver', name: 'Beaver', role: 'host', position: [0, 0, 0] }],
  });
  assert.equal(system.triggerHandoff('beaver', 'hotdog'), true);
  assert.ok(system.get('beaver').handoffPulse > 0);
  system.dispose();
});

test('lightweight people now include more facial anatomy without changing their root rig', () => {
  const model = createLightweightHuman();
  const names = new Set(model.head.children.map((child) => child.name));
  for (const name of [
    'ear-left',
    'ear-right',
    'iris-left',
    'iris-right',
    'nose-bridge',
    'nose-tip',
  ])
    assert.ok(names.has(name), `missing ${name}`);
});

test('DJ booth visual model includes the raised platform revision', () => {
  assert.equal(DJ_BOOTH_VISUAL_REVISION, '2026-09-16-realism-3-platform');
});
