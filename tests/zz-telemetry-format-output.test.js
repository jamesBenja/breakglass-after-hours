import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('emit formatted telemetry source', () => {
  const formatted = execFileSync(
    'pnpm',
    ['exec', 'prettier', 'src/gameplay/PlaytestTelemetry.js'],
    { encoding: 'utf8' },
  );
  console.log('FORMATTED_TELEMETRY_BEGIN');
  console.log(Buffer.from(formatted, 'utf8').toString('base64'));
  console.log('FORMATTED_TELEMETRY_END');
  assert.ok(formatted.includes('export class PlaytestTelemetry'));
});
