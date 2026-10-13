import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGodMode } from '../src/gameplay/GodMode.js';
import { FreightElevatorSystem } from '../src/gameplay/FreightElevatorSystem.js';
import {
  GOD_MODE_INVITATION_PROFILE,
  invitationDisplayProfile,
} from '../src/gameplay/InvitationAccess.js';

test('God Mode invitation is They Who Remain', () => {
  const profile = invitationDisplayProfile(GOD_MODE_INVITATION_PROFILE);
  assert.equal(profile.id, 'godmode');
  assert.equal(profile.label, 'THEY WHO REMAIN');
  assert.match(profile.intro, /they who remain/i);
  assert.match(profile.accessNote, /do not need.*mission|all access is open/i);
});

test('God Mode explicitly unlocks the freight elevator without completing anything', () => {
  const data = {
    roofSecretUnlocked: false,
    mixingChallengeCompleted: [],
    mixingRewardKey: false,
    alleyShortcutUnlocked: false,
    roofEscapeUnlocked: false,
    maddoxAffection: 0,
  };
  const game = {
    state: { data },
    save() {},
  };
  applyGodMode(game, { warning() {} });

  assert.equal(game.godMode, true);
  assert.equal(data.roofEscapeUnlocked, true);

  // Deliberately leave every endgame task incomplete. God Mode itself must be sufficient.
  data.djLessonCompleted = false;
  data.arcadeWins = 0;
  data.bathroomPlungeWins = 0;
  data.studio = { stems: [] };
  data.studioSongs = [];
  data.deadRoomAccessGranted = false;
  data.tapeArchiveAccessGranted = false;
  data.threadedTape = null;
  data.roofStoriesHeard = [];
  data.roofAcFixed = false;
  data.gentrificationTransformed = false;

  const freight = new FreightElevatorSystem(game, {
    panel() {},
    warning() {},
    document: null,
    buttons: null,
  });
  assert.equal(freight.unlocked(), true);
});

test('God Mode freight access does not depend on the persisted roof escape flag', () => {
  const game = {
    godMode: true,
    state: { data: { roofEscapeUnlocked: false, freightElevatorPosition: 0 } },
  };
  const freight = new FreightElevatorSystem(game, {
    panel() {},
    warning() {},
    document: null,
    buttons: null,
  });
  assert.equal(freight.unlocked(), true);
});
