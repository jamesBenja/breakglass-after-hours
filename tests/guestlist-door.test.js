import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BREAKGLASS_DOOR_QUESTIONS,
  installGuestlistDoorEnhancements,
} from '../src/gameplay/guestlistDoorEnhancements.js';

function makeHarness() {
  let panel = null;
  let fallbackDispatches = 0;
  let saves = 0;
  const ui = {
    panel(title, text, actions = []) {
      panel = { title, text, actions };
    },
    warning() {},
  };
  const bouncer = {
    admitted: false,
    waitUntil: 0,
    wrongAnswers: 0,
    guestPanel() {},
    djQuiz() {},
    enter() {
      this.admitted = true;
      this.waitUntil = 0;
    },
  };
  const game = {
    crowdDoor: { bouncer },
    state: {
      data: {
        avatar: { displayName: 'Test Guest' },
      },
    },
    sceneManager: { current: { definition: { id: 'alley' } } },
    interactions: {
      dispatch() {
        fallbackDispatches += 1;
      },
    },
    save() {
      saves += 1;
    },
  };
  installGuestlistDoorEnhancements(game, ui);
  return {
    game,
    bouncer,
    currentPanel: () => panel,
    fallbackDispatches: () => fallbackDispatches,
    saves: () => saves,
  };
}

const choose = (panel, label) => {
  const action = panel.actions.find(([name]) => name === label);
  assert.ok(action, `missing action: ${label}`);
  action[1]();
};

test('guestlist claim sends player to James, polite request adds them, and Sam then clears them', () => {
  const harness = makeHarness();
  const { game, bouncer } = harness;

  bouncer.guestPanel();
  choose(harness.currentPanel(), 'Yes, I should be on the guestlist');
  assert.equal(game.state.data.guestlistReferralPending, true);
  assert.equal(game.state.data.guestlistApproved, undefined);
  assert.equal(bouncer.admitted, false);
  assert.equal(harness.currentPanel().title, 'SAM · NOT ON THE LIST');

  game.interactions.dispatch({ action: 'dialogue', id: 'james', npcId: 'james' });
  assert.equal(harness.currentPanel().title, 'JAMES · GUESTLIST');
  choose(
    harness.currentPanel(),
    'A friend of Breakglass. Sorry for the mix-up — could you please add me?',
  );
  assert.equal(game.state.data.guestlistApproved, true);
  assert.equal(game.state.data.guestlistReferralPending, false);
  assert.equal(game.state.data.guestlistAddedByJames, true);

  bouncer.guestPanel();
  choose(harness.currentPanel(), 'Yes, I should be on the guestlist');
  assert.equal(bouncer.admitted, true);
  assert.ok(harness.saves() >= 2);
});

test('rude James answer does not add the player to the guestlist', () => {
  const harness = makeHarness();
  const { game } = harness;
  game.state.data.guestlistReferralPending = true;

  game.interactions.dispatch({ action: 'dialogue', id: 'james', npcId: 'james' });
  choose(harness.currentPanel(), 'I do not remember. Just put me on the list.');

  assert.notEqual(game.state.data.guestlistApproved, true);
  assert.equal(game.state.data.guestlistReferralPending, true);
});

test('non-guestlist route uses Breakglass questions: wrong answer waits, correct answer clears', () => {
  const harness = makeHarness();
  const { bouncer } = harness;

  bouncer.guestPanel();
  choose(harness.currentPanel(), 'No, I am not on the guestlist');
  const firstQuestion = BREAKGLASS_DOOR_QUESTIONS[0];
  const wrong = firstQuestion.choices.find((choice) => choice !== firstQuestion.correct);
  choose(harness.currentPanel(), wrong);
  assert.equal(bouncer.admitted, false);
  assert.ok(bouncer.waitUntil > Date.now());

  bouncer.waitUntil = 0;
  bouncer.guestPanel();
  choose(harness.currentPanel(), 'No, I am not on the guestlist');
  const secondQuestion = BREAKGLASS_DOOR_QUESTIONS[1];
  choose(harness.currentPanel(), secondQuestion.correct);
  assert.equal(bouncer.admitted, true);
});

test('James guestlist interception only runs after Sam has referred the player', () => {
  const harness = makeHarness();
  harness.game.interactions.dispatch({ action: 'dialogue', id: 'james', npcId: 'james' });
  assert.equal(harness.fallbackDispatches(), 1);
});
