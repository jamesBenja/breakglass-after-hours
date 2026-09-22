import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as prettier from 'prettier';

test('emit canonical teleporter formatting', async () => {
  for (const path of ['src/gameplay/GodMode.js', 'tests/god-mode-teleporter.test.js']) {
    const input = await readFile(path, 'utf8');
    const config = (await prettier.resolveConfig(path)) ?? {};
    const output = await prettier.format(input, { ...config, filepath: path });
    console.log(`PRETTIER_START:${path}`);
    console.log(Buffer.from(output, 'utf8').toString('base64'));
    console.log(`PRETTIER_END:${path}`);
  }
});
