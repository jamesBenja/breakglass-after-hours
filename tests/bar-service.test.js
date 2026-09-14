import test from 'node:test';
import assert from 'node:assert/strict';
import { BarServiceSystem } from '../src/gameplay/BarServiceSystem.js';

function harness() {
  const state = {
    data: { intoxication: 0, drinksServed: 0 },
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

test('bar service only intercepts bartender interactions downstairs', () => {
  const h = harness();
  assert.equal(h.system.handle({ npcId: 'nora' }), false);
  h.system.sceneManager.current.definition.id = 'upstairs';
  assert.equal(h.system.handle({ npcId: 'courtney' }), false);
});
