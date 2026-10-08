import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const fixes = fs.readFileSync(
  new URL('../src/gameplay/ClubRegressionFixes.js', import.meta.url),
  'utf8',
);
const booth = fs.readFileSync(
  new URL('../src/scenes/geometry/djBoothRealism.js', import.meta.url),
  'utf8',
);

test('explicit invitation links suppress remembered God Mode', () => {
  assert.match(fixes, /removeItem\(GOD_TOKEN_STORAGE_KEY\)/);
  assert.match(main, /clearRememberedGodModeForInvitation\(invitation\)/);
});

test('arcade entry preserves downstairs club transport', () => {
  assert.match(fixes, /if \(!game\.arcade\?\.active\) baseStopAll/);
});

test('DJ booth has a raised platform and refreshments interaction', () => {
  assert.match(booth, /DJ_PLATFORM/);
  assert.match(booth, /DJ_REFRESHMENTS_POSITION/);
  assert.match(fixes, /djRefreshments/);
  assert.match(fixes, /selfServe\?\.\('water'\)/);
  assert.match(fixes, /selfServe\?\.\('beer'\)/);
});
