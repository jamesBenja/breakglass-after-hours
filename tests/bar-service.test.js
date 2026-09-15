import test from 'node:test';
import assert from 'node:assert/strict';
import { BarServiceSystem } from '../src/gameplay/BarServiceSystem.js';

function harness() {
  const state = {
    data: { intoxication: 0, drinksServed: 0, caffeine: 0, coffeesMade: 0 },
    meet() {},
  };
  const player = {
    intoxication: 0,
    setIntoxication(value) {
      this.intoxication = value;
    },
  };
  const served = [];
  const bartender = { name: 'Courtney' };
  const sceneManager = {
    current: {
      definition: { id: 'downstairs' },
      npcs: {
        get: () => bartender,
        triggerServe: (id) => served.push(id),
      },
    },
  };
  const ui = {
    latest: null,
    panel(title, text, actions) {
      this.latest = { title, text, actions };
    },
  };
  let saves = 0;
  const system = new BarServiceSystem({
    state,
    player,
    ui,
    sceneManager,
    saveState: () => saves++,
  });
  return { system, state, player, ui, served, saves: () => saves };
}

test('bartender service raises persistent intoxication and water lowers it', () => {
  const h = harness();
  assert.equal(h.system.handle({ npcId: 'courtney' }), true);
  h.system.order('courtney', { label: 'Beer / cider', strength: 0.17 });
  assert.equal(h.state.data.drinksServed, 1);
  assert.equal(h.state.data.intoxication, 0.17);
  assert.equal(h.player.intoxication, 0.17);
  assert.deepEqual(h.served, ['courtney']);

  h.system.water('courtney');
  assert.equal(h.state.data.intoxication, 0);
  assert.equal(h.player.intoxication, 0);
  assert.equal(h.saves(), 3);
});

test('coffee reduces handling impairment but does not erase underlying alcohol', () => {
  const h = harness();
  h.system.level = 0.6;
  assert.equal(h.system.handle({ id: 'coffeeMachine', action: 'coffee' }), true);
  h.system.coffee();
  assert.equal(h.state.data.intoxication, 0.6);
  assert.equal(h.state.data.coffeesMade, 1);
  assert.ok(h.state.data.caffeine > 0.6);
  assert.ok(h.player.intoxication < 0.6);
  assert.ok(h.player.intoxication > 0.3);

  const effectiveBefore = h.player.intoxication;
  h.system.update(10);
  assert.ok(h.state.data.caffeine < 0.62);
  assert.ok(h.state.data.intoxication < 0.6);
  assert.ok(h.player.intoxication > effectiveBefore - 0.03);
});

test('bar cuts off heavily intoxicated player and intoxication decays over time', () => {
  const h = harness();
  h.system.level = 0.9;
  h.system.order('courtney', { label: 'Mixed drink', strength: 0.23 });
  assert.equal(h.state.data.drinksServed, 0);
  assert.equal(h.state.data.intoxication, 0.9);
  assert.match(h.ui.latest.text, /cuts you off/i);

  h.system.update(10);
  assert.ok(h.state.data.intoxication < 0.9);
  assert.ok(h.state.data.intoxication > 0.88);
});

test('bar service keeps bartenders downstairs but supports studio coffee upstairs', () => {
  const h = harness();
  assert.equal(h.system.handle({ npcId: 'nora' }), false);
  assert.equal(h.system.handle({ action: 'coffee' }), true);
  h.system.sceneManager.current.definition.id = 'upstairs';
  assert.equal(h.system.handle({ npcId: 'courtney' }), false);
  assert.equal(h.system.handle({ action: 'coffee' }), true);
});
