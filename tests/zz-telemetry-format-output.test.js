import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

test('emit formatted telemetry diff', () => {
  const source = 'src/gameplay/PlaytestTelemetry.js';
  const formatted = execFileSync('pnpm', ['exec', 'prettier', source], { encoding: 'utf8' });
  const output = '/tmp/PlaytestTelemetry.formatted.js';
  writeFileSync(output, formatted);
  const diff = spawnSync('diff', ['-u', source, output], { encoding: 'utf8' });
  console.log('FORMATTED_TELEMETRY_DIFF_BEGIN');
  console.log(diff.stdout || '(no diff)');
  console.log('FORMATTED_TELEMETRY_DIFF_END');
  assert.ok(formatted.includes('export class PlaytestTelemetry'));
});
