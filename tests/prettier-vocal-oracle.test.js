import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import prettier from 'prettier';

test('print exact Prettier patch for Vocal fix', async () => {
  const paths = [
    'src/interactions/createActions.js',
    'src/studio/StudioPlayback.js',
    'tests/spectra-fader-routing.test.js',
  ];
  const dir = mkdtempSync(join(tmpdir(), 'prettier-vocal-'));
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    const config = await prettier.resolveConfig(path);
    const formatted = await prettier.format(source, { ...config, filepath: path });
    if (formatted === source) continue;
    const output = join(dir, path.replaceAll('/', '__'));
    writeFileSync(output, formatted);
    let patch = '';
    try {
      execFileSync('diff', ['-u', path, output], { encoding: 'utf8' });
    } catch (error) {
      patch = String(error.stdout || '');
    }
    console.log('\nPRETTIER PATCH FOR ' + path + '\n' + patch);
  }
});
