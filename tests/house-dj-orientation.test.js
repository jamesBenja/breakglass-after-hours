import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_DJS } from '../src/gameplay/HouseDjSystem.js';

test('house DJ roster remains intact through orientation pass', () => {
  assert.ok(HOUSE_DJS.length >= 10);
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'lunice'));
  assert.ok(HOUSE_DJS.some((dj) => dj.id === 'kaytranada'));
});
