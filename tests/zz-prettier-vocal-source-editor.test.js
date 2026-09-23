import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as prettier from 'prettier';

test('emit targeted canonical vocal source editor formatting', async () => {
  const cases = [
    ['src/interactions/createActions.js', [[500, 760]]],
    ['src/studio/StudioPlayback.js', [[50, 155], [970, 1210], [1290, 1435], [1530, 1610]]],
  ];
  for (const [path, ranges] of cases) {
    const input = await readFile(path, 'utf8');
    const config = (await prettier.resolveConfig(path)) ?? {};
    const output = await prettier.format(input, { ...config, filepath: path });
    const lines = output.split('\n');
    for (const [start, end] of ranges) {
      console.log('PRETTIER_RANGE_START:' + path + ':' + start + ':' + end);
      console.log(lines.slice(start - 1, end).join('\n'));
      console.log('PRETTIER_RANGE_END:' + path + ':' + start + ':' + end);
    }
  }
});
