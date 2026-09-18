import test from 'node:test';
import assert from 'node:assert/strict';
import { acousticEnvironmentFor, sourceIsAudible } from '../src/audio/AcousticZones.js';

test('Neve tape is local to the upstairs studio floor', () => {
  const neve = acousticEnvironmentFor('archive', 'upstairs', 'neve-suite');
  const live = acousticEnvironmentFor('archive', 'upstairs', 'live-room');
  const roof = acousticEnvironmentFor('archive', 'roof', 'roof-deck');
  const below = acousticEnvironmentFor('archive', 'downstairs', 'club');
  const alley = acousticEnvironmentFor('archive', 'alley', 'alley');

  assert.equal(neve.gain, 1);
  assert.ok(live.gain > 0 && live.gain < neve.gain);
  assert.equal(roof.gain, 0);
  assert.equal(below.gain, 0);
  assert.equal(alley.gain, 0);
  assert.equal(sourceIsAudible(roof), false);
});

test('DJ bleed only crosses floors through intentional acoustic paths', () => {
  const club = acousticEnvironmentFor('dj', 'downstairs', 'club');
  const downstairsStair = acousticEnvironmentFor('dj', 'downstairs', 'studio-stairs');
  const upstairsStair = acousticEnvironmentFor('dj', 'upstairs', 'below-step-2');
  const upstairsRoom = acousticEnvironmentFor('dj', 'upstairs', 'mixing-suite');
  const roof = acousticEnvironmentFor('dj', 'roof', 'roof-deck');

  assert.equal(club.gain, 1);
  assert.equal(downstairsStair.portal, true);
  assert.equal(upstairsStair.portal, true);
  assert.ok(upstairsStair.gain > upstairsRoom.gain);
  assert.equal(roof.gain, 0);
});

test('studio playback is strong in control/live rooms and silent off-floor', () => {
  const control = acousticEnvironmentFor('studio', 'upstairs', 'mixing-suite');
  const live = acousticEnvironmentFor('studio', 'upstairs', 'live-room');
  const stair = acousticEnvironmentFor('studio', 'upstairs', 'below-step-1');
  const roof = acousticEnvironmentFor('studio', 'roof', 'roof-deck');

  assert.equal(control.gain, 1);
  assert.ok(live.gain > stair.gain);
  assert.equal(stair.portal, true);
  assert.equal(roof.gain, 0);
});

test('Take A Break focus locally ducks the club bus further', () => {
  const normal = acousticEnvironmentFor('dj', 'downstairs', 'lounge');
  const focus = acousticEnvironmentFor('dj', 'downstairs', 'lounge', {
    installationFocus: true,
  });
  assert.ok(focus.gain < normal.gain);
  assert.ok(focus.lowpassHz < normal.lowpassHz);
});


test('alley and bathroom hear quiet muffled club bleed without muting the club source', () => {
  const club = acousticEnvironmentFor('house-dj', 'downstairs', 'club');
  const bathroom = acousticEnvironmentFor('house-dj', 'downstairs', 'bathroom');
  const circulation = acousticEnvironmentFor('house-dj', 'downstairs', 'circulation');
  const alley = acousticEnvironmentFor('house-dj', 'alley', 'alley');

  assert.equal(club.gain, 1);
  assert.ok(bathroom.gain < circulation.gain);
  assert.ok(bathroom.lowpassHz <= 1000);
  assert.ok(alley.gain < 0.1);
  assert.ok(alley.lowpassHz <= 600);
  assert.equal(alley.portal, true);
});
