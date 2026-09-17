import assert from 'node:assert/strict';
import test from 'node:test';
import { invitationProfile } from '../src/gameplay/InvitationAccess.js';

const expected = {
  participant: ['PARTICIPANT / EXPLORER', 'explorer'],
  guestlist: ['GUESTLIST', 'explorer'],
  dj: ['DJ', 'dj'],
  producer: ['PRODUCER / MUSICIAN', 'producer'],
  residentproducer: ['RESIDENT PRODUCER', 'producer'],
  promoter: ['PROMOTER', 'promoter'],
};

test('each verified invitation renders its own designed party-goer type', () => {
  for (const [type, [label, role]] of Object.entries(expected)) {
    const profile = invitationProfile(type);
    assert.equal(profile.id, type);
    assert.equal(profile.label, label);
    assert.equal(profile.defaultRole, role);
  }
});
