import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVITATION_PROFILES,
  applyInvitationAccess,
  installInvitationAccess,
  invitationProfile,
  invitationSaveKey,
} from '../src/gameplay/InvitationAccess.js';

test('invitation profiles expose the requested access classes including Resident Producer', () => {
  assert.deepEqual(Object.keys(INVITATION_PROFILES), [
    'participant',
    'guestlist',
    'dj',
    'producer',
    'residentproducer',
    'promoter',
  ]);
  assert.deepEqual(invitationProfile('participant').access, {
    guestlist: false,
    dj: false,
    studioFastTrack: false,
  });
  assert.deepEqual(invitationProfile('guestlist').access, {
    guestlist: true,
    dj: false,
    studioFastTrack: false,
  });
  assert.deepEqual(invitationProfile('dj').access, {
    guestlist: true,
    dj: true,
    studioFastTrack: false,
  });
  assert.deepEqual(invitationProfile('producer').access, {
    guestlist: true,
    dj: false,
    studioFastTrack: true,
  });
  assert.deepEqual(invitationProfile('residentproducer').access, {
    guestlist: true,
    dj: false,
    studioFastTrack: true,
  });
  assert.deepEqual(invitationProfile('residentproducer').entry, {
    sceneId: 'upstairs',
    position: [4.85, 0, -2.3],
  });
  assert.deepEqual(invitationProfile('promoter').access, {
    guestlist: true,
    dj: false,
    studioFastTrack: false,
  });
});

test('privileged invitation types use isolated saves while participant uses the regular save', () => {
  assert.equal(invitationSaveKey('participant'), undefined);
  const keys = ['guestlist', 'dj', 'producer', 'residentproducer', 'promoter'].map(
    invitationSaveKey,
  );
  assert.equal(new Set(keys).size, 5);
  for (const key of keys) assert.match(key, /^breakglass\.after-hours\.invite\./);
});

test('applying invitation grants only its explicit access', () => {
  for (const id of Object.keys(INVITATION_PROFILES)) {
    const game = { state: { data: {} }, save() {} };
    applyInvitationAccess(game, invitationProfile(id));
    const access = INVITATION_PROFILES[id].access;
    assert.equal(game.state.data.invitationType, id);
    assert.deepEqual(game.state.data.invitationAccess, access);
    assert.equal(game.state.data.guestlistApproved === true, access.guestlist);
    assert.equal(game.state.data.djAccessGranted === true, access.dj);
    assert.equal(game.state.data.studioInviteAccess === true, access.studioFastTrack);
    assert.equal(game.state.data.studioAccessGranted === true, id === 'residentproducer');
  }
});

function fixture(profileId = 'participant') {
  let sceneId = 'downstairs';
  let baseDispatches = 0;
  let saved = 0;
  let resolvedPolice = 0;
  let toldJames = 0;
  let policePresent = false;
  const panels = [];
  const warnings = [];
  const ui = {
    panel(title, text, actions = []) {
      panels.push({ title, text, actions });
    },
    warning(message) {
      warnings.push(message);
    },
  };
  const bouncer = {
    admitted: false,
    waitUntil: 0,
    elapsed: 0,
    handle() {
      return 'base-bouncer';
    },
    guestPanel() {
      ui.panel('BASE GUESTLIST', 'base', []);
    },
    enter() {
      this.admitted = true;
    },
  };
  const alley = {
    snapshot() {
      return { policePresent };
    },
    resolvePolice(response) {
      if (response === 'cooperate') resolvedPolice += 1;
      policePresent = false;
      return 'The police accept the response.';
    },
  };
  const game = {
    state: { data: {} },
    crowdDoor: { bouncer },
    scenes: new Map([['alley', { alley }]]),
    sceneManager: {
      current: {
        definition: {
          get id() {
            return sceneId;
          },
        },
        progressionGates: { sync() {} },
      },
    },
    interactions: {
      dispatch() {
        baseDispatches += 1;
      },
    },
    policeResponse: {
      tellJames() {
        toldJames += 1;
        return true;
      },
    },
    update() {},
    save() {
      saved += 1;
    },
  };
  applyInvitationAccess(game, invitationProfile(profileId));
  installInvitationAccess(game, ui, invitationProfile(profileId));
  return {
    game,
    ui,
    bouncer,
    panels,
    warnings,
    setScene(value) {
      sceneId = value;
    },
    setPolice(value) {
      policePresent = value;
    },
    counts() {
      return { baseDispatches, saved, resolvedPolice, toldJames };
    },
  };
}

test('regular invite blocks the DJ booth until James grants access', () => {
  const f = fixture('participant');
  f.game.interactions.dispatch({ id: 'dj-booth', action: 'dj' });
  assert.equal(f.panels.at(-1).title, 'DJ BOOTH · NOT CLEARED YET');
  assert.equal(f.counts().baseDispatches, 0);

  f.game.interactions.dispatch({ id: 'james', action: 'dialogue' });
  const james = f.panels.at(-1);
  const ask = james.actions.find(([label]) => label.includes('DJ tonight'));
  assert.ok(ask, 'James should offer DJ access');
  ask[1]();
  assert.equal(f.game.state.data.djAccessGranted, true);

  f.game.interactions.dispatch({ id: 'dj-booth', action: 'dj' });
  assert.equal(f.counts().baseDispatches, 1);
});

test('DJ invitation lets Sam admit the DJ without James', () => {
  const f = fixture('dj');
  f.setScene('alley');
  f.bouncer.handle({ id: 'sam', action: 'dialogue' });
  const sam = f.panels.at(-1);
  const dj = sam.actions.find(([label]) => label.includes('DJ tonight'));
  assert.ok(dj, 'Sam should recognize DJ invitation');
  dj[1]();
  assert.equal(f.bouncer.admitted, true);
  assert.equal(f.game.state.data.djAccessGranted, true);
});

test('producer invitation lets Zander grant studio access immediately', () => {
  const f = fixture('producer');
  f.game.interactions.dispatch({ id: 'zander', action: 'dialogue' });
  assert.equal(f.game.state.data.studioAccessGranted, true);
  assert.equal(f.panels.at(-1).title, 'ZANDER · STUDIO ACCESS');
  assert.equal(f.counts().baseDispatches, 0);
});

test('Resident Producer already has studio access without a Zander handoff', () => {
  const f = fixture('residentproducer');
  assert.equal(f.game.state.data.studioAccessGranted, true);
  f.game.interactions.dispatch({ id: 'zander', action: 'dialogue' });
  assert.equal(f.counts().baseDispatches, 1);
});

test('police arrival offers James or self response and James can resolve shared police state', () => {
  const f = fixture('guestlist');
  f.setPolice(true);
  f.game.update(1000);
  const alert = f.panels.at(-1);
  assert.equal(alert.title, 'POLICE HAVE ARRIVED');
  assert.ok(alert.actions.some(([label]) => label.includes('find James')));
  assert.ok(alert.actions.some(([label]) => label.includes('police myself')));

  f.game.interactions.dispatch({ id: 'james', action: 'dialogue' });
  const james = f.panels.at(-1);
  const police = james.actions.find(([label]) => label === 'The police are here');
  assert.ok(police, 'James should offer the visible police-response sequence');
  police[1]();
  assert.equal(f.counts().toldJames, 1);
  assert.equal(
    f.counts().resolvedPolice,
    0,
    'James must not resolve police instantly from the club',
  );
  assert.equal(f.game.state.data.policePlan, 'james');
});
