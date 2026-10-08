import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../src/gameplay/roomExperienceEnhancements.js', import.meta.url),
  'utf8',
);

test('enhanced Take A Break panel exposes spatial-program selection instead of legacy four-emitter copy', () => {
  assert.match(source, /Choose spatial experience/);
  assert.match(source, /snapshot\.programs/);
  assert.match(source, /setInstallationProgram/);
  assert.match(source, /eight HRTF virtual speakers/i);
  assert.doesNotMatch(source, /four-emitter/i);
  assert.doesNotMatch(source, /Four HRTF emitters/i);
});

test('canonical installation panel keeps level, focus, shaping and mute controls together', () => {
  assert.match(source, /Installation louder/);
  assert.match(source, /Installation quieter/);
  assert.match(source, /Shape current experience/);
  assert.match(source, /Mute installation/);
  assert.match(source, /Sit on cushion/);
});
