import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANONICAL_SPATIAL_PASS,
  assertSingleBuildEntryProfile,
  resolveEntrySpatialPass,
} from '../src/runtime/LiveEntryPolicy.js';
import {
  GOD_MODE_INVITATION_PROFILE,
  INVITATION_PROFILES,
} from '../src/gameplay/InvitationAccess.js';

test('production entries always use the same canonical spatial pass', () => {
  for (const search of ['', '?pass=A', '?pass=B', '?pass=legacy', '?invite=token&pass=A']) {
    assert.equal(resolveEntrySpatialPass({ search, production: true }), CANONICAL_SPATIAL_PASS);
  }
});

test('development can still explicitly exercise Pass A for regression testing', () => {
  assert.equal(resolveEntrySpatialPass({ search: '?pass=A', production: false }), 'A');
  assert.equal(resolveEntrySpatialPass({ search: '?pass=B', production: false }), 'B');
  assert.equal(resolveEntrySpatialPass({ search: '', production: false }), 'B');
});

test('all invitation and God Mode profiles are access/spawn profiles, never build selectors', () => {
  for (const profile of [...Object.values(INVITATION_PROFILES), GOD_MODE_INVITATION_PROFILE]) {
    assert.equal(assertSingleBuildEntryProfile(profile), true);
    if (profile.entry) {
      assert.deepEqual(
        Object.keys(profile.entry).sort(),
        ['position', 'sceneId'],
        `${profile.id} entry may only choose spawn position and scene`,
      );
    }
  }
});
