import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as prettier from 'prettier';

test('emit canonical direct Vocal playback formatting', async () => {
  const path = 'src/studio/StudioPlayback.js';
  const input = await readFile(path, 'utf8');
  const config = (await prettier.resolveConfig(path)) ?? {};
  const output = await prettier.format(input, { ...config, filepath: path });
  const encoded = Buffer.from(output, 'utf8').toString('base64');
  console.log('PRETTIER_START:' + path + ':' + encoded.length);
  for (let index = 0; index < encoded.length; index += 3000) {
    console.log('PRETTIER_CHUNK:' + path + ':' + index + ':' + encoded.slice(index, index + 3000));
  }
  console.log('PRETTIER_END:' + path);
});
